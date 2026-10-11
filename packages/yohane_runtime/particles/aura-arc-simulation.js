import { updateAuraLineMotion } from './aura-line-motion.js';
// Original AuraArc GPU buffer layouts, expressed in uint32 words.
export const AURA_ARC_LAYOUT = Object.freeze({
  trajectoryCapacity: 2000,
  trajectoryPaddedCapacity: 2048,
  trajectoryWords: 28672,
  stripCount: 1000,
  pointsPerStrip: 64,
  lineWords: 768000,
  trajectoryState: 4096,
  trajectoryPosition: 12288,
  linePosition: 256000,
  lineColor: 512000,
});
const F = Math.fround;
const bits = new Uint32Array(1);
const floats = new Float32Array(bits.buffer);
export function auraHash(value) {
  let x = value >>> 0;
  x = Math.imul(x ^ (x >>> 16), 73244475) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 73244475) >>> 0;
  return (x ^ (x >>> 16)) >>> 0;
}
export function auraRandom(value) {
  bits[0] = (auraHash(value) >>> 9) + 0x3f800000;
  return F(floats[0] - 1);
}
function sortable(value) {
  floats[0] = value;
  const word = bits[0];
  return (word ^ (word & 0x80000000 ? 0xffffffff : 0x80000000)) >>> 0;
}
function requireMatrix(value, name) {
  if (!value || value.length !== 16) {
    throw new Error(`AuraArc requires ${name} matrix`);
  }
}
/** CPU expression results follow graph-original.json expressions 4..70.
 * Matrices and samples remain in Unity space; reflection belongs to the draw bridge.
 */
export function createAuraArcParameters({
  seed,
  vertexCount,
  channelInfo,
  localToWorld,
  worldToLocal,
  properties = {},
  bakedCurve,
  mainTexture,
}) {
  requireMatrix(localToWorld, 'localToWorld');
  requireMatrix(worldToLocal, 'worldToLocal');
  if (!Number.isInteger(vertexCount) || vertexCount <= 0) {
    throw new Error('AuraArc requires source vertexCount');
  }
  if (!Number.isInteger(channelInfo)) {
    throw new Error('AuraArc requires source channelInfo');
  }
  const color1 = properties.ArcColor1 ?? [0.5, 0.10000000149011612, 4, 1];
  const color2 = properties.ArcColor2 ?? [0, 0, 0, 0];
  const widthMin = F(properties.ArcWidthMin ?? 0.019999999552965164);
  const widthMax = F(properties.ArcWidthMax ?? 0.05000000074505806);
  const divergent = F(properties.Divergent ?? 0.5);
  const field = new Float32Array(16),
    inverseField = new Float32Array(16);
  const outputColor1 = Float32Array.from(color1),
    outputColorDelta = new Float32Array(4);
  const currentProperties = { ...properties };
  for (let i = 0; i < 4; i++) {
    outputColorDelta[i] = F(color2[i] - color1[i]);
  }
  const result = {
    uniform_a: localToWorld,
    worldToLocal,
    fieldTransform: field,
    inverseFieldTransform: inverseField,
    uniform_c: (1 ^ seed) >>> 0,
    uniform_i: seed >>> 0,
    uniform_j: (2 ^ seed) >>> 0,
    uniform_l: (9 ^ seed) >>> 0,
    uniform_m: (5 ^ seed) >>> 0,
    uniform_n: (6 ^ seed) >>> 0,
    uniform_o: (7 ^ seed) >>> 0,
    uniform_d: F(vertexCount),
    uniform_e: vertexCount,
    uniform_h: channelInfo,
    uniform_k: new Float32Array([divergent, divergent, divergent]),
    Rate_b: F(properties.ArcSegments ?? 30),
    spawnRate: F(Math.max(F(F(properties.ArcRate ?? 5) * F(properties.Amount ?? 1)), 0)),
    output: {
      uniform_a: widthMin,
      uniform_b: F(widthMax - widthMin),
      uniform_c: outputColor1,
      uniform_d: outputColorDelta,
      Alpha_c: bakedCurve,
      mainTexture,
    },
    setProperties(changes) {
      Object.assign(currentProperties, changes);
      const p = currentProperties;
      result.spawnRate = F(Math.max(F(F(p.ArcRate ?? 5) * F(p.Amount ?? 1)), 0));
      result.Rate_b = F(p.ArcSegments ?? 30);
      result.uniform_k.fill(F(p.Divergent ?? 0.5));
      result.output.uniform_a = F(p.ArcWidthMin ?? 0.019999999552965164);
      result.output.uniform_b = F(
        F(p.ArcWidthMax ?? 0.05000000074505806) - result.output.uniform_a,
      );
      const first = p.ArcColor1 ?? color1,
        second = p.ArcColor2 ?? color2;
      for (let i = 0; i < 4; i++) {
        outputColor1[i] = first[i];
        outputColorDelta[i] = F(second[i] - first[i]);
      }
    },
    setTime(time) {
      // Expressions 31/32/33/36/37/40/44/50/55/66: world * TRS(frac(time/25)*10,0,0).
      const phase = F(F(time) / 25);
      const translation = F(F(phase - Math.floor(phase)) * 10);
      field.set(localToWorld);
      for (let r = 0; r < 4; r++) {
        field[12 + r] = F(F(localToWorld[r] * translation) + localToWorld[12 + r]);
      }
      inverseField.set(worldToLocal);
      for (let c = 0; c < 4; c++) {
        inverseField[c * 4] = F(worldToLocal[c * 4] - F(translation * worldToLocal[c * 4 + 3]));
      }
    },
  };
  result.setTime(0);
  return result;
}
export function createAuraArcSimulation({ seed = 0, parameters, samplePosition }) {
  if (typeof samplePosition !== 'function') {
    throw new Error('AuraArc requires source mesh samplePosition');
  }
  if (!parameters) {
    throw new Error('AuraArc requires original graph parameters');
  }
  const trajectoryAttributes = new Uint32Array(AURA_ARC_LAYOUT.trajectoryWords);
  const trajectoryFloats = new Float32Array(trajectoryAttributes.buffer);
  const lineAttributes = new Uint32Array(AURA_ARC_LAYOUT.lineWords);
  const lineFloats = new Float32Array(lineAttributes.buffer);
  const stripData = new Uint32Array(5000),
    events = new Uint32Array(64000);
  const bounds = new Uint32Array(6),
    deadList = new Uint32Array(2000);
  const trajectoryIds = new Uint32Array(2000),
    activeStripIds = new Uint32Array(1000);
  const stripPresent = new Uint8Array(1000);
  const a = new Float32Array(3),
    b = new Float32Array(3),
    pos = new Float32Array(3);
  const velocity = new Float32Array(3),
    motion = new Float32Array(6);
  let trajectoryCount = 0,
    stripCount = 0,
    deadCount = 2000,
    spawnIndex = 0;
  let spawnFraction = 0,
    accumulated = 0,
    time = 0,
    playing = true,
    paused = false;
  const api = {
    trajectoryAttributes,
    trajectoryFloats,
    lineAttributes,
    lineFloats,
    stripData,
    events,
    bounds,
    activeStripIds,
    parameters,
    seed: seed >>> 0,
    eventCount: 0,
    activeStripCount: 0,
    trajectoryCount: 0,
    time: 0,
    step,
    advance,
    play() {
      playing = true;
    },
    stop() {
      playing = false;
    },
    pause() {
      paused = true;
    },
    resume() {
      paused = false;
    },
    reinitialize,
  };
  function reinitialize(nextSeed = seed) {
    seed = nextSeed >>> 0;
    api.seed = seed;
    trajectoryAttributes.fill(0);
    lineAttributes.fill(0);
    stripData.fill(0);
    stripPresent.fill(0);
    trajectoryCount = stripCount = 0;
    deadCount = 2000;
    for (let i = 0; i < 2000; i++) {
      deadList[i] = 1999 - i;
    }
    // Empty strip sentinel is the StripUpdate host kernel's empty output state.
    for (let i = 0; i < 1000; i++) {
      stripData[i * 5 + 3] = 0xfffffffe;
    }
    spawnIndex = 0;
    spawnFraction = accumulated = time = 0;
    playing = true;
    paused = false;
    api.eventCount = api.activeStripCount = api.trajectoryCount = api.time = 0;
    parameters.uniform_c = (1 ^ seed) >>> 0;
    parameters.uniform_i = seed;
    parameters.uniform_j = (2 ^ seed) >>> 0;
    parameters.uniform_l = (9 ^ seed) >>> 0;
    parameters.uniform_m = (5 ^ seed) >>> 0;
    parameters.uniform_n = (6 ^ seed) >>> 0;
    parameters.uniform_o = (7 ^ seed) >>> 0;
  }
  function sample(random, out) {
    out.fill(0);
    if (parameters.uniform_h === 0xffffffff || (parameters.uniform_h & 255) !== 0) {
      return;
    }
    const index = Math.trunc(F(random * parameters.uniform_d)) % parameters.uniform_e;
    samplePosition(index, out);
    const components = Math.min((parameters.uniform_h >>> 8) & 255, 3);
    if (components < 3) {
      out[2] = 0;
    }
    if (components < 2) {
      out[1] = 0;
    }
  }
  function spawn(count) {
    const allocated = Math.min(count, deadCount);
    for (let k = 0; k < allocated; k++) {
      const id = deadList[--deadCount],
        state = 4096 + id * 4,
        xyz = 12288 + id * 8;
      trajectoryFloats[id * 2] = 1;
      trajectoryAttributes[id * 2 + 1] = (spawnIndex + k) >>> 0;
      trajectoryFloats[state] = trajectoryFloats[state + 1] = 0;
      trajectoryAttributes[state + 2] = trajectoryAttributes[state + 3] = 1;
      trajectoryFloats[xyz] = trajectoryFloats[xyz + 1] = trajectoryFloats[xyz + 2] = 0;
      trajectoryFloats[xyz + 4] = trajectoryFloats[xyz + 5] = trajectoryFloats[xyz + 6] = 1;
      trajectoryIds[trajectoryCount++] = id;
    }
    spawnIndex = (spawnIndex + count) >>> 0;
  }
  function updateTrajectory(dt) {
    api.eventCount = 0;
    let kept = 0;
    for (let k = 0; k < trajectoryCount; k++) {
      const id = trajectoryIds[k],
        state = 4096 + id * 4,
        xyz = 12288 + id * 8;
      if (!trajectoryAttributes[state + 2]) {
        if (id >= 1000) {
          throw new Error('AuraArc original trajectory exceeds attached strip buffer');
        }
        if (trajectoryAttributes[state + 3] && stripData[id * 5 + 3] === 0xfffffffe) {
          deadList[deadCount++] = id;
          trajectoryAttributes[state + 3] = 0;
        } else {
          trajectoryIds[kept++] = id;
        }
        continue;
      }
      trajectoryIds[kept++] = id;
      const particle = trajectoryAttributes[id * 2 + 1];
      const random = auraRandom(particle ^ parameters.uniform_c);
      sample(random, a);
      sample(auraRandom(particle ^ parameters.uniform_l), b);
      const count = F(F(dt * parameters.Rate_b) + trajectoryFloats[state]);
      const event = Math.min(Math.trunc(Math.floor(count)) >>> 0, 1);
      const nextAge = F(trajectoryFloats[state + 1] + dt),
        life = trajectoryFloats[id * 2];
      if (life < nextAge) {
        trajectoryAttributes[state + 2] = 0;
      } else {
        const t = F(trajectoryFloats[state + 1] / life),
          clamped = Math.min(Math.max(t, 0), 1);
        const u = F(1 - clamped),
          uu = F(u * u),
          tt = F(clamped * clamped);
        const ri = auraRandom(particle ^ parameters.uniform_i);
        const rj = auraRandom(particle ^ parameters.uniform_j);
        const rm = auraRandom(particle ^ parameters.uniform_m);
        const rn = auraRandom(particle ^ parameters.uniform_n);
        const ro = auraRandom(particle ^ parameters.uniform_o);
        for (let c = 0; c < 3; c++) {
          const r1 = c === 0 ? ri : c === 1 ? random : rj;
          const r2 = c === 0 ? rm : c === 1 ? rn : ro;
          const ctrl1 = F(F(F(F(r1 * 2) - 1) * parameters.uniform_k[c]) + a[c]);
          const first = F(F(F(ctrl1 * uu) * clamped) * 3);
          const start = F(F(a[c] * uu) * u);
          const ctrl2 = F(F(F(F(r2 * 2) - 1) * parameters.uniform_k[c]) + b[c]);
          const second = F(F(F(ctrl2 * u) * tt) * 3);
          pos[c] = F(F(F(b[c] * tt) * clamped) + F(second + F(start + first)));
        }
        const m = parameters.uniform_a;
        for (let c = 0; c < 3; c++) {
          trajectoryFloats[xyz + c] = F(
            F(F(F(m[c] * pos[0]) + F(pos[1] * m[4 + c])) + F(m[8 + c] * pos[2])) + m[12 + c],
          );
        }
        trajectoryFloats[state] = F(count - Math.floor(count));
        trajectoryFloats[state + 1] = nextAge;
        trajectoryFloats[xyz + 4] = t;
        trajectoryFloats[xyz + 5] = ri;
        trajectoryFloats[xyz + 6] = 1;
      }
      if (event) {
        events[api.eventCount++] = id;
      }
    }
    trajectoryCount = kept;
  }
  function initializeLines() {
    for (let k = 0; k < api.eventCount; k++) {
      const parent = events[k],
        strip = Math.min(parent, 1000);
      if (strip >= 1000) {
        throw new Error('AuraArc original lineInitialize addresses strip 1000 outside capacity');
      }
      const h = strip * 5,
        count = stripData[h + 1];
      if (count >= 64) {
        continue;
      }
      stripData[h + 1] = count + 1;
      const id = strip * 64 + ((count + stripData[h]) & 63),
        v = id * 4;
      const p = 256000 + v,
        color = 512000 + v,
        source = 12288 + parent * 8;
      lineAttributes[v + 3] = 1;
      for (let c = 0; c < 3; c++) {
        lineFloats[v + c] = 0;
        lineFloats[p + c] = trajectoryFloats[source + c];
        lineFloats[color + c] = trajectoryFloats[source + 4 + c];
      }
      lineFloats[p + 3] = 0;
      lineFloats[color + 3] = 2;
      if (!stripPresent[strip]) {
        stripPresent[strip] = 1;
        activeStripIds[stripCount++] = strip;
      }
    }
  }
  function updateLines(dt) {
    bounds[0] = bounds[1] = bounds[2] = 0xffffffff;
    bounds[3] = bounds[4] = bounds[5] = 0;
    const m = parameters.worldToLocal;
    let scaleSum = 0;
    for (let c = 0; c < 3; c++) {
      const x = F(m[c * 4] * F(0.1)),
        y = F(m[c * 4 + 1] * F(0.1)),
        z = F(m[c * 4 + 2] * F(0.1));
      scaleSum = F(scaleSum + F(F(F(x * x) + F(y * y)) + F(z * z)));
    }
    const radius = F(Math.sqrt(scaleSum) * 0.5);
    let kept = 0;
    for (let s = 0; s < stripCount; s++) {
      const strip = activeStripIds[s],
        h = strip * 5;
      stripData[h + 3] = 0xffffffff;
      stripData[h + 4] = 0;
      for (let point = 0; point < 64; point++) {
        const id = strip * 64 + point,
          v = id * 4;
        if (!lineAttributes[v + 3]) {
          continue;
        }
        const p = 256000 + v,
          color = 512000 + v;
        for (let c = 0; c < 3; c++) {
          pos[c] = lineFloats[p + c];
          velocity[c] = lineFloats[v + c];
        }
        updateAuraLineMotion(
          pos,
          velocity,
          lineFloats[color],
          dt,
          parameters.inverseFieldTransform,
          parameters.fieldTransform,
          motion,
        );
        const age = F(lineFloats[p + 3] + dt);
        if (lineFloats[color + 3] < age) {
          lineAttributes[v + 3] = 0;
          continue;
        }
        for (let c = 0; c < 3; c++) {
          lineFloats[p + c] = motion[c];
          lineFloats[v + c] = motion[c + 3];
        }
        lineFloats[p + 3] = age;
        const relative = (point + 64 - stripData[h]) & 63;
        stripData[h + 3] = Math.min(stripData[h + 3], relative);
        stripData[h + 4] = Math.max(stripData[h + 4], relative);
        for (let c = 0; c < 3; c++) {
          const center = F(
            F(F(F(m[c] * motion[0]) + F(m[4 + c] * motion[1])) + F(m[8 + c] * motion[2])) +
              m[12 + c],
          );
          bounds[c] = Math.min(bounds[c], sortable(F(center - radius)));
          bounds[c + 3] = Math.max(bounds[c + 3], sortable(F(center + radius)));
        }
      }
      const first = stripData[h + 3];
      const empty = (first & 0xfffffffe) >>> 0 === 0xfffffffe;
      stripData[h] = empty ? 0 : (first + stripData[h]) % 64;
      stripData[h + 1] = stripData[h + 2] = empty ? 0 : stripData[h + 4] - first + 1;
      stripData[h + 3] = empty ? 0xfffffffe : 0xffffffff;
      stripData[h + 4] = 0;
      if (empty) {
        stripPresent[strip] = 0;
      } else {
        activeStripIds[kept++] = strip;
      }
    }
    stripCount = kept;
  }
  function step(delta) {
    if (paused) {
      return api;
    }
    if (!Number.isFinite(delta) || delta < 0) {
      throw new Error('AuraArc step requires nonnegative finite dt');
    }
    const dt = F(delta);
    time += dt;
    parameters.setTime?.(time);
    if (playing) {
      spawnFraction = F(spawnFraction + F(parameters.spawnRate * dt));
      const count = Math.floor(spawnFraction);
      spawnFraction = F(spawnFraction - count);
      spawn(count);
    }
    updateTrajectory(dt);
    initializeLines();
    updateLines(dt);
    api.activeStripCount = stripCount;
    api.trajectoryCount = trajectoryCount;
    api.time = time;
    return api;
  }
  function advance(delta) {
    if (paused) {
      return api;
    }
    if (!Number.isFinite(delta) || delta < 0) {
      throw new Error('AuraArc advance requires nonnegative finite delta');
    }
    const fixed = 0.01666666753590107;
    accumulated = F(accumulated + F(Math.min(delta, 0.05000000074505806)));
    const steps = Math.floor(F(accumulated / fixed));
    if (steps) {
      accumulated = F(accumulated - F(steps * fixed));
      step(F(steps * fixed));
    }
    return api;
  }
  reinitialize(seed);
  return api;
}
