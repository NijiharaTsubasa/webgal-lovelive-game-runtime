import { PARAMETER_INDEX } from './garupa-face-controls.js';

const SIDES = ['L', 'R'];
const AXES = ['X', 'Y', 'ANGLE', 'FORM'];
const CLEARANCE_SAMPLES = [
  [1 / 3, 1 / 3, 1 / 3],
  [0.5, 0.5, 0],
  [0.5, 0, 0.5],
  [0, 0.5, 0.5],
];
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// A small spatial lookup of the existing facial surface, in brow mesh bind
// coordinates. This is a direct depth query, not an optimization or simulation.
function skinSurface(face, brow, THREE) {
  if (!face?.geometry?.attributes?.position) return null;
  const geometry = face.geometry,
    base = geometry.attributes.position;
  face.updateWorldMatrix?.(true, false);
  brow.updateWorldMatrix?.(true, false);
  const matrix = new THREE.Matrix4().copy(brow.matrixWorld).invert().multiply(face.matrixWorld);
  const e = matrix.elements,
    points = new Float64Array(base.count * 3);
  const targets = geometry.morphAttributes?.position ?? [];
  const influences = face.morphTargetInfluences ?? [];
  const transform = (i, x, y, z) => {
    points[i * 3] = e[0] * x + e[4] * y + e[8] * z + e[12];
    points[i * 3 + 1] = e[1] * x + e[5] * y + e[9] * z + e[13];
    points[i * 3 + 2] = e[2] * x + e[6] * y + e[10] * z + e[14];
  };
  for (let i = 0; i < base.count; i++) transform(i, base.getX(i), base.getY(i), base.getZ(i));
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (let i = 0; i < base.count; i++) {
    minX = Math.min(minX, points[i * 3]);
    maxX = Math.max(maxX, points[i * 3]);
    minY = Math.min(minY, points[i * 3 + 1]);
    maxY = Math.max(maxY, points[i * 3 + 1]);
  }
  const cell = Math.max(maxX - minX, maxY - minY) / 24;
  if (!(cell > 0)) return null;
  const browBase = brow.geometry.attributes.position,
    middle = (minX + maxX) / 2;
  let queryMinX = Infinity,
    queryMaxX = -Infinity,
    queryMinY = Infinity,
    queryMaxY = -Infinity;
  let browMinX = Infinity,
    browMaxX = -Infinity;
  for (let i = 0; i < browBase.count; i++) {
    browMinX = Math.min(browMinX, browBase.getX(i));
    browMaxX = Math.max(browMaxX, browBase.getX(i));
  }
  const maximumDistance = (browMaxX - browMinX) * 2;
  for (const side of SIDES) {
    const ids = [];
    for (let i = 0; i < browBase.count; i++) if (browBase.getX(i) >= middle === (side === 'L')) ids.push(i);
    if (!ids.length) continue;
    const data = contour(browBase, ids);
    let radius = 0;
    for (const i of ids)
      radius = Math.max(
        radius,
        Math.hypot(
          browBase.getX(i) - data.center[0],
          Math.abs(browBase.getY(i) - data.center[1]) + Math.abs(data.bend) + data.width * 0.08
        )
      );
    queryMinX = Math.min(queryMinX, data.center[0] - radius - maximumDistance * 0.15);
    queryMaxX = Math.max(queryMaxX, data.center[0] + radius + maximumDistance * 0.15);
    queryMinY = Math.min(queryMinY, data.center[1] - radius - maximumDistance * 0.13);
    queryMaxY = Math.max(queryMaxY, data.center[1] + radius + maximumDistance * 0.13);
  }
  const usedSet = new Set();
  const grid = new Map(),
    index = geometry.index,
    total = index?.count ?? base.count;
  const at = (i) => (index ? index.getX(i) : i);
  for (let i = 0; i + 2 < total; i += 3) {
    const ids = [at(i), at(i + 1), at(i + 2)];
    if (
      Math.max(...ids.map((j) => points[j * 3])) < queryMinX - cell ||
      Math.min(...ids.map((j) => points[j * 3])) > queryMaxX + cell ||
      Math.max(...ids.map((j) => points[j * 3 + 1])) < queryMinY - cell ||
      Math.min(...ids.map((j) => points[j * 3 + 1])) > queryMaxY + cell
    )
      continue;
    for (const id of ids) usedSet.add(id);
    const loX = Math.floor((Math.min(...ids.map((j) => points[j * 3])) - minX) / cell) - 1;
    const hiX = Math.floor((Math.max(...ids.map((j) => points[j * 3])) - minX) / cell) + 1;
    const loY = Math.floor((Math.min(...ids.map((j) => points[j * 3 + 1])) - minY) / cell) - 1;
    const hiY = Math.floor((Math.max(...ids.map((j) => points[j * 3 + 1])) - minY) / cell) + 1;
    for (let x = loX; x <= hiX; x++)
      for (let y = loY; y <= hiY; y++) {
        const key = `${x},${y}`;
        if (!grid.has(key)) grid.set(key, []);
        grid.get(key).push(ids);
      }
  }
  const used = Int32Array.from(usedSet),
    neutral = new Float64Array(used.length * 3),
    channels = [];
  for (let i = 0; i < used.length; i++)
    for (let k = 0; k < 3; k++) neutral[i * 3 + k] = points[used[i] * 3 + k];
  for (let k = 0; k < targets.length; k++) {
    const values = new Float64Array(used.length * 3);
    let active = false;
    for (let j = 0; j < used.length; j++) {
      const i = used[j],
        target = targets[k];
      const x = target.getX(i) - (geometry.morphTargetsRelative ? 0 : base.getX(i));
      const y = target.getY(i) - (geometry.morphTargetsRelative ? 0 : base.getY(i));
      const z = target.getZ(i) - (geometry.morphTargetsRelative ? 0 : base.getZ(i));
      values[j * 3] = e[0] * x + e[4] * y + e[8] * z;
      values[j * 3 + 1] = e[1] * x + e[5] * y + e[9] * z;
      values[j * 3 + 2] = e[2] * x + e[6] * y + e[10] * z;
      active ||= x !== 0 || y !== 0 || z !== 0;
    }
    if (active) channels.push({ index: k, values });
  }
  const last = new Float64Array(channels.length).fill(NaN);
  return {
    middle,
    vertices: used.length,
    channels: channels.length,
    refresh() {
      let changed = false;
      for (let k = 0; k < channels.length; k++) {
        const value = influences[channels[k].index] ?? 0;
        changed ||= last[k] !== value;
        last[k] = value;
      }
      if (!changed) return false;
      for (let j = 0; j < used.length; j++)
        for (let axis = 0; axis < 3; axis++) {
          let value = neutral[j * 3 + axis];
          for (let k = 0; k < channels.length; k++)
            if (last[k]) value += channels[k].values[j * 3 + axis] * last[k];
          points[used[j] * 3 + axis] = value;
        }
      return true;
    },
    depth(x, y) {
      let result = -Infinity;
      for (const [a, b, c] of grid.get(`${Math.floor((x - minX) / cell)},${Math.floor((y - minY) / cell)}`) ??
        []) {
        const ax = points[a * 3],
          ay = points[a * 3 + 1],
          bx = points[b * 3],
          by = points[b * 3 + 1];
        const cx = points[c * 3],
          cy = points[c * 3 + 1];
        const den = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
        if (Math.abs(den) < cell * cell * Number.EPSILON) continue;
        const u = ((by - cy) * (x - cx) + (cx - bx) * (y - cy)) / den;
        const v = ((cy - ay) * (x - cx) + (ax - cx) * (y - cy)) / den;
        const w = 1 - u - v;
        if (Math.min(u, v, w) >= -1e-7)
          result = Math.max(result, u * points[a * 3 + 2] + v * points[b * 3 + 2] + w * points[c * 3 + 2]);
      }
      return result;
    },
  };
}

function contour(position, ids) {
  if (!ids.length) return { center: [0, 0], width: 0, slope: 0, bend: 0 };
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;
  for (const i of ids) {
    minX = Math.min(minX, position.getX(i));
    maxX = Math.max(maxX, position.getX(i));
    minY = Math.min(minY, position.getY(i));
    maxY = Math.max(maxY, position.getY(i));
  }
  const width = maxX - minX,
    cx = (minX + maxX) / 2,
    cy = (minY + maxY) / 2;
  const bands = Array.from({ length: 3 }, () => [0, 0, 0, 0]);
  for (const i of ids) {
    const x = position.getX(i),
      y = position.getY(i),
      t = width > 0 ? (x - minX) / width : 0.5;
    const band = bands[Math.min(2, Math.floor(t * 3))];
    band[0] += x;
    band[1] += y;
    band[2] += 1 - ((2 * (x - cx)) / Math.max(width, Number.EPSILON)) ** 2;
    band[3]++;
  }
  for (const band of bands) if (band[3]) for (let k = 0; k < 3; k++) band[k] /= band[3];
  const slope =
    bands.every((b) => b[3]) && bands[2][0] !== bands[0][0]
      ? (bands[2][1] - bands[0][1]) / (bands[2][0] - bands[0][0])
      : 0;
  const curve = bands.every((b) => b[3]) ? bands[1][1] - (bands[0][1] + bands[2][1]) / 2 : 0;
  const contrast = bands[1][2] - (bands[0][2] + bands[2][2]) / 2;
  return { center: [cx, cy], width, slope, bend: contrast > 0 ? curve / contrast : 0 };
}

export function createBrowDriver(context, part, bindings) {
  const { THREE } = context,
    root = context.root ?? part.root;
  const groups = new Map(),
    faces = [];
  for (const binding of bindings) {
    if (/^face_main_(eye|mouth)_/.test(binding.name) && binding.object && !faces.includes(binding.object))
      faces.push(binding.object);
    if (binding.channel?.region !== 'brow' && !/^eyebrow_/.test(binding.name)) continue;
    if (!binding.geometry?.attributes?.position || !binding.object) continue;
    if (!groups.has(binding.geometry)) groups.set(binding.geometry, binding.object);
  }
  const targets = [];
  for (const [source, mesh] of groups) {
    const geometry = source.clone(),
      base = source.attributes.position,
      position = geometry.attributes.position;
    const baseNormal = source.attributes.normal,
      normal = geometry.attributes.normal;
    const surface = skinSurface(faces[0], mesh, THREE);
    const mid =
      surface?.middle ??
      (Math.min(...Array.from({ length: base.count }, (_, i) => base.getX(i))) +
        Math.max(...Array.from({ length: base.count }, (_, i) => base.getX(i)))) /
        2;
    const sides = Object.fromEntries(
      SIDES.map((side) => {
        const ids = [];
        for (let i = 0; i < base.count; i++) if (base.getX(i) >= mid === (side === 'L')) ids.push(i);
        return [side, { indices: ids, ...contour(base, ids) }];
      })
    );
    const distance =
      sides.L.indices.length && sides.R.indices.length
        ? Math.abs(sides.L.center[0] - sides.R.center[0])
        : Math.max(sides.L.width, sides.R.width) * 2;
    const objects = [],
      seen = new Set();
    const register = (object) => {
      if (object?.geometry === source && !seen.has(object)) {
        seen.add(object);
        objects.push({ object, frustumCulled: object.frustumCulled });
      }
    };
    root?.traverse(register);
    bindings.forEach((binding) => register(binding.object));
    const gaps = new Float64Array(base.count),
      margin = distance * 1e-4;
    for (let i = 0; i < base.count; i++) {
      const z = surface?.depth(base.getX(i), base.getY(i));
      gaps[i] = Number.isFinite(z) ? Math.max(margin, base.getZ(i) - z) : margin;
    }
    const triangles = { L: [], R: [] },
      index = source.index,
      count = index?.count ?? base.count;
    for (let i = 0; i + 2 < count; i += 3) {
      const ids = [0, 1, 2].map((k) => (index ? index.getX(i + k) : i + k));
      for (const side of SIDES)
        if (ids.every((v) => base.getX(v) >= mid === (side === 'L'))) triangles[side].push(ids);
    }
    targets.push({
      source,
      geometry,
      base,
      position,
      baseNormal,
      normal,
      sides,
      distance,
      objects,
      surface,
      gaps,
      margin,
      triangles,
    });
  }
  const last = new Float64Array(8).fill(NaN),
    values = new Float64Array(8);
  const stats = {
    vertices: targets.reduce((n, w) => n + w.base.count, 0),
    workspaces: targets.length,
    updates: 0,
    cacheHits: 0,
  };
  let disposed = false;
  return {
    targets,
    stats,
    apply(parameters) {
      if (disposed) return;
      let changed = false;
      for (let s = 0; s < 2; s++)
        for (let a = 0; a < 4; a++) {
          const id = `PARAM_BROW_${SIDES[s]}_${AXES[a]}`;
          const raw = ArrayBuffer.isView(parameters) ? parameters[PARAMETER_INDEX[id]] : parameters[id];
          const value = raw ?? 0;
          if (!Number.isFinite(value)) throw new Error(`Non-finite face parameter: ${id}`);
          values[s * 4 + a] = a < 3 ? clamp(value, -1, 1) : value;
          changed ||= last[s * 4 + a] !== values[s * 4 + a];
        }
      for (const work of targets) {
        changed = work.surface?.refresh() || changed;
        for (const saved of work.objects) {
          saved.object.geometry = work.geometry;
          saved.object.frustumCulled = false;
        }
      }
      if (!changed) {
        stats.cacheHits++;
        return;
      }
      last.set(values);
      for (const work of targets) {
        const { position, base, normal, baseNormal, surface } = work;
        position.array.set(base.array);
        if (normal) normal.array.set(baseNormal.array);
        for (let s = 0; s < 2; s++) {
          const side = SIDES[s],
            sign = s === 0 ? 1 : -1,
            data = work.sides[side],
            [cx, cy] = data.center;
          const xControl = values[s * 4],
            yControl = values[s * 4 + 1],
            angleControl = values[s * 4 + 2],
            form = values[s * 4 + 3];
          const negative = Math.min(1, Math.max(0, -form * 2));
          const targetBend =
            form < 0
              ? -data.width * 0.07 * Math.min(1, -form)
              : data.bend + data.width * 0.08 * Math.min(1, form);
          const bendDelta = form < 0 ? (targetBend - data.bend) * negative : targetBend - data.bend;
          const angle = (-sign * 0.045 - Math.atan(data.slope)) * negative - sign * angleControl * 0.46;
          const cosine = Math.cos(angle),
            sine = Math.sin(angle);
          const active = xControl !== 0 || yControl !== 0 || angleControl !== 0 || form !== 0;
          for (const i of data.indices) {
            const x = base.getX(i) - cx,
              y = base.getY(i) - cy;
            const curve =
              (1 - Math.min(1, ((2 * x) / Math.max(data.width, Number.EPSILON)) ** 2)) * bendDelta;
            const px = cx + x * cosine - (y + curve) * sine + sign * xControl * work.distance * 0.15;
            const py = cy + x * sine + (y + curve) * cosine + yControl * work.distance * 0.13;
            let pz = base.getZ(i);
            if (active) {
              const skin = surface?.depth(px, py);
              if (Number.isFinite(skin)) pz = skin + work.gaps[i];
            }
            position.setXYZ(i, px, py, pz);
            if (normal) {
              const nx = baseNormal.getX(i),
                ny = baseNormal.getY(i);
              normal.setXY(i, nx * cosine - ny * sine, nx * sine + ny * cosine);
            }
          }
          if (active && surface) {
            let shift = 0;
            for (const [a, b, c] of work.triangles[side]) {
              for (const bary of CLEARANCE_SAMPLES) {
                const x =
                  position.getX(a) * bary[0] + position.getX(b) * bary[1] + position.getX(c) * bary[2];
                const y =
                  position.getY(a) * bary[0] + position.getY(b) * bary[1] + position.getY(c) * bary[2];
                const z =
                  position.getZ(a) * bary[0] + position.getZ(b) * bary[1] + position.getZ(c) * bary[2];
                const skin = surface.depth(x, y);
                if (Number.isFinite(skin)) shift = Math.max(shift, skin + work.margin - z);
              }
            }
            if (shift > 0) for (const i of data.indices) position.setZ(i, position.getZ(i) + shift);
          }
        }
        position.needsUpdate = true;
        if (normal) normal.needsUpdate = true;
      }
      stats.updates++;
    },
    restore() {
      for (const work of targets)
        for (const saved of work.objects) {
          saved.object.geometry = work.source;
          saved.object.frustumCulled = saved.frustumCulled;
        }
    },
    dispose() {
      if (disposed) return;
      this.restore();
      for (const work of targets) work.geometry.dispose();
      disposed = true;
    },
  };
}
