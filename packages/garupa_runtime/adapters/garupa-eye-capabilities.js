const SIDES = ['L', 'R'];
const SHAPES = ['close', 'joy', 'angry', 'sad', 'fun', 'smile', 'kime', 'serious', 'wink'];
const OPEN_SMILE_AMPLITUDE = 0.06624160640756349;
const FORM_AMPLITUDE = { negative: 0.08631459664726401, positive: 0.01869709489183208 };
const cache = new WeakMap();

function quantile(sorted, fraction) {
  const at = (sorted.length - 1) * fraction;
  const lower = Math.floor(at), upper = Math.ceil(at);
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (at - lower);
}

function mean(ids, read) {
  let total = 0;
  for (const id of ids) total += read(id);
  return total / ids.length;
}

function readRows(bindings, side) {
  return bindings.filter((binding) => binding.channel.region === 'eye' && binding.channel.side === side)
    .flatMap((binding) => {
      const geometry = binding.geometry ?? binding.object?.geometry;
      const base = geometry?.attributes?.position;
      const target = geometry?.morphAttributes?.position?.[binding.index];
      if (!base || !target) return [];
      const cap = Number.isFinite(binding.cap) ? binding.cap : 1;
      const delta = (i, axis) => target[axis](i) - (geometry.morphTargetsRelative === false ? base[axis](i) : 0);
      let squared = 0;
      for (let i = 0; i < target.count; i++) {
        const x = delta(i, 'getX'), y = delta(i, 'getY'), z = delta(i, 'getZ');
        squared += x * x + y * y + z * z;
      }
      return [{ binding, geometry, base, delta, cap, norm: Math.sqrt(squared) }];
    });
}

// Fixed neutral inner-edge anchors are located from the native blink field.
// Every candidate uses those same anchors, so widening and closing are compared
// geometrically instead of inferred from emotion names alone.
function apertureDeltas(rows) {
  let selected = null;
  for (const close of rows.filter((row) => row.binding.name.startsWith('eyelash_') && row.binding.channel.shape === 'close')) {
    const { base, delta } = close;
    let maximum = 0;
    const lengths = new Float64Array(base.count);
    for (let i = 0; i < base.count; i++) {
      lengths[i] = Math.hypot(delta(i, 'getX'), delta(i, 'getY'), delta(i, 'getZ'));
      maximum = Math.max(maximum, lengths[i]);
    }
    const strong = [];
    let minX = Infinity, maxX = -Infinity;
    for (let i = 0; i < base.count; i++) if (lengths[i] > maximum * 0.1) {
      strong.push(i); minX = Math.min(minX, base.getX(i)); maxX = Math.max(maxX, base.getX(i));
    }
    const width = maxX - minX, center = (minX + maxX) / 2;
    if (!(width > 0)) continue;
    // UV seams duplicate coincident contour vertices. Keep numerically equal
    // boundary points together when selecting bands and quartiles; otherwise
    // an invisible Float32-sized offset can choose a different contour subset.
    const tolerance = width * 1e-5;
    let best = null;
    for (const band of [0.1, 0.15, 0.2, 0.25, 0.3]) {
      const ids = strong.filter((i) => Math.abs(base.getX(i) - center) <= width * band + tolerance);
      if (ids.length < 4) continue;
      ids.sort((a, b) => base.getY(a) - base.getY(b));
      let split = 1, largest = -Infinity;
      for (let j = 1; j < ids.length; j++) {
        const gap = base.getY(ids[j]) - base.getY(ids[j - 1]);
        if (gap > largest) { largest = gap; split = j; }
      }
      const lows = ids.slice(0, split), highs = ids.slice(split);
      if (!lows.length || !highs.length) continue;
      const lowLimit = quantile(lows.map((i) => base.getY(i)), 0.75);
      const highLimit = quantile(highs.map((i) => base.getY(i)), 0.25);
      const low = lows.filter((i) => base.getY(i) >= lowLimit - tolerance);
      const high = highs.filter((i) => base.getY(i) <= highLimit + tolerance);
      const gap = mean(high, (i) => base.getY(i)) - mean(low, (i) => base.getY(i));
      if (!(gap > 0)) continue;
      const closeGap = gap + close.cap * (mean(high, (i) => delta(i, 'getY')) - mean(low, (i) => delta(i, 'getY')));
      const score = Math.abs(closeGap / gap);
      if (!best || score < best.score) best = { score, low, high, gap };
    }
    if (!best) continue;
    const gaps = {};
    for (const shape of SHAPES) {
      const row = rows.find((candidate) => candidate.geometry === close.geometry && candidate.binding.channel.shape === shape);
      gaps[shape] = row ? row.cap * (mean(best.high, (i) => row.delta(i, 'getY')) - mean(best.low, (i) => row.delta(i, 'getY'))) / best.gap : 0;
    }
    selected = gaps;
  }
  return selected ?? {};
}

function vector(rows, gain = 1) {
  return Object.fromEntries(rows.filter((row) => row.norm > 0 && row.cap * gain > 1e-12)
    .map((row) => [row.binding.name, row.cap * gain]));
}

function magnitude(rows) {
  return Math.sqrt(rows.reduce((total, row) => total + (row.norm * row.cap) ** 2, 0));
}

// The same capability rules apply to every head. Binding performs the geometry
// measurement once; frame updates consume the resulting short Morph vectors.
export function resolveEyeCapabilities(part, bindings) {
  const cached = cache.get(part);
  if (cached) return cached;
  const joy = part.component?.morphPoses?.find((pose) => pose.name === 'face.Joy');
  const joyNames = new Set(Object.values(joy?.targets ?? {}).flatMap((targets) => Object.keys(targets)));
  const result = {};
  for (const side of SIDES) {
    const rows = readRows(bindings, side);
    const shape = (name) => rows.filter((row) => row.binding.channel.shape === name);
    const blink = magnitude(shape('close'));
    let smile = rows.filter((row) => joyNames.has(row.binding.name));
    if (!smile.some((row) => row.binding.name.startsWith('face_main_eye_'))
      || !smile.some((row) => row.binding.name.startsWith('eyelash_'))) smile = shape('joy');
    if (magnitude(smile) <= blink * 1e-6) smile = shape('wink');
    const smileNorm = magnitude(smile);
    const smileGain = smileNorm > 0 ? Math.min(1, OPEN_SMILE_AMPLITUDE * blink / smileNorm) : 0;
    const gaps = apertureDeltas(rows);
    // Native Fun/Joy are the style-preserving widening families. Other positive
    // gap atoms can represent a different eye design rather than a wider eye.
    const wide = gaps.fun > 1e-4 ? 'fun' : gaps.joy > 1e-4 ? 'joy' : null;
    const negative = ['angry', 'kime', 'serious', 'smile', 'sad']
      .find((name) => gaps[name] < -1e-4 && magnitude(shape(name)) >= blink * 0.01);
    const formVector = (name, amplitude) => {
      const selected = shape(name), norm = magnitude(selected);
      return vector(selected, norm > 0 ? Math.min(1, amplitude * blink / norm) : 0);
    };
    result[side] = {
      close: vector(shape('close')), closedSmile: vector(shape('wink')),
      openSmile: vector(smile, smileGain), wide: vector(shape(wide)),
      formNegative: formVector(negative, FORM_AMPLITUDE.negative),
      formPositive: formVector(wide, FORM_AMPLITUDE.positive),
    };
  }
  cache.set(part, result);
  return result;
}
