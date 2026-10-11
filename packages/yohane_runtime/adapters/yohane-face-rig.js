// The source head meshes use X for left/right and Z for face up. These are
// mesh-local axes, so body animation and the normalized Head pose cancel out.
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const EMOTIONS = ['normal', 'smile', 'damage', 'happy', 'sad', 'think', 'surprise', 'verysurprise', 'doubt', 'punsuka'];
const facialChannel = name => EMOTIONS.includes(name) || /^(?:eye_|eyebrow_|mouth_|cheek)/.test(name)
  || /^(?:happy|surprise|doubt|punsuka)_mouth_open$/.test(name) || name === 'ruby_eye_close_smile';

function bounds(position, indices) {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const i of indices) for (let a = 0; a < 3; a++) {
    lo[a] = Math.min(lo[a], position[i * 3 + a]); hi[a] = Math.max(hi[a], position[i * 3 + a]);
  }
  return {center: lo.map((v, a) => (v + hi[a]) / 2), width: hi[0] - lo[0], lo, hi};
}

function connectedIslands(meshes, count) {
  const parent = Array.from({length: count}, (_, i) => i);
  const find = i => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  for (const mesh of meshes) {
    const index = mesh.geometry.index;
    for (let i = 0; i < (index?.count ?? count); i += 3) {
      const a = index ? index.getX(i) : i, b = index ? index.getX(i + 1) : i + 1, c = index ? index.getX(i + 2) : i + 2;
      parent[find(b)] = find(a); parent[find(c)] = find(a);
    }
  }
  const islands = new Map();
  for (let i = 0; i < count; i++) { const id = find(i), group = islands.get(id) ?? []; group.push(i); islands.set(id, group); }
  return [...islands.values()];
}

const fade = t => { const v = clamp(t, 0, 1); return 1 - v * v * (3 - 2 * v); };

export class YohaneFaceRig {
  constructor(meshes, THREE, kind) {
    this.kind = kind;
    this.source = meshes[0].geometry;
    if (!this.source.morphTargetsRelative) throw Error('Yohane face requires relative Morph targets');
    this.channels = new Map(Object.entries(meshes[0].morphTargetDictionary).map(([name, index]) =>
      [name, {index, position: this.source.morphAttributes.position[index], normal: this.source.morphAttributes.normal?.[index]}]));
    this.base = this.source.attributes.position;
    this.position = this.base.clone();
    this.normal = this.source.attributes.normal?.clone();
    this.objects = meshes.map(object => ({object, geometry: object.geometry, culled: object.frustumCulled,
      privateGeometry: object.geometry.clone()}));
    for (const saved of this.objects) {
      saved.privateGeometry.setAttribute('position', this.position);
      if (this.normal) saved.privateGeometry.setAttribute('normal', this.normal);
    }
    this.owned = [...this.channels].filter(([name]) => kind === 'eye' || facialChannel(name)).map(([, channel]) => channel.index);
    this.neutral = this.vector({normal: 1});
    this.neutralNormal = this.vector({normal: 1}, 'normal');
    this.points = new Float32Array(this.base.array.length);
    for (let i = 0; i < this.points.length; i++) this.points[i] = this.base.array[i] + this.neutral[i];
    try {
      if (kind === 'head') this.bindRegions(meshes);
      else {
        this.eyeBounds = bounds(this.points, Array.from({length: this.base.count}, (_, i) => i));
        this.eyeSide = meshes[0].name.match(/(?:^|_)eye_([lr])$/i)[1].toUpperCase();
      }
    } catch (error) { this.dispose(); throw error; }
  }

  vector(weights, attribute = 'position') {
    const result = new Float32Array(this.base.array.length);
    for (const [name, weight] of Object.entries(weights)) {
      const source = this.channels.get(name)?.[attribute];
      if (source && weight) for (let i = 0; i < result.length; i++) result[i] += source.array[i] * weight;
    }
    return result;
  }

  support(names) {
    const result = new Uint8Array(this.base.count);
    for (const name of names) {
      const source = this.channels.get(name)?.position;
      if (!source) continue;
      for (let i = 0; i < result.length; i++) if (Math.hypot(source.getX(i), source.getY(i), source.getZ(i)) > 1e-7) result[i] = 1;
    }
    return result;
  }

  bindRegions(meshes) {
    const mouth = this.support(['mouth_open']), eye = this.support(['eye_close']);
    const islands = connectedIslands(meshes, this.base.count);
    const indices = mask => Array.from(mask.keys()).filter(i => mask[i]);
    const mouthBounds = bounds(this.points, indices(mouth)), eyeBounds = bounds(this.points, indices(eye));
    if (!Number.isFinite(mouthBounds.center[2]) || !Number.isFinite(eyeBounds.center[2]))
      throw Error('Yohane face has no measurable mouth/eye closure channels');
    this.eyeDistance = Math.max(eyeBounds.width * .6, .001);
    this.centerX = eyeBounds.center[0];
    const middle = (mouthBounds.center[2] + eyeBounds.center[2]) / 2;
    const transition = Math.max((eyeBounds.center[2] - mouthBounds.center[2]) * .15, .001);
    this.mouthMask = Float32Array.from(this.points.filter((_, i) => i % 3 === 2), z =>
      clamp((middle + transition - z) / (2 * transition), 0, 1));
    this.browMask = this.support([...this.channels.keys()].filter(name => name.startsWith('eyebrow_')));
    if (!this.browMask.some(Boolean)) {
      const emotionSupport = this.support(['sad', 'punsuka', 'smile']);
      const candidates = islands.map(group => ({group, box: bounds(this.points, group)}))
        .filter(({group,box}) => group.length < this.base.count * .15
          && box.center[2] > eyeBounds.center[2]
          && Math.abs(box.center[0] - this.centerX) > this.eyeDistance * .1
          && group.some(i => emotionSupport[i]) && !group.some(i => mouth[i]));
      // Some disconnected eyelashes have zero eye_close deltas; conversely,
      // Mari's real brows move in eye_close. Neither support test separates
      // them. Anchor each brow to its upper broad island, then include only
      // the co-located pieces rather than every expressive island above eyes.
      for (const side of ['L', 'R']) {
        const onSide = candidates.filter(({box}) => (box.center[0] > this.centerX) === (side === 'L'));
        const anchor = onSide.filter(({box}) => box.width > this.eyeDistance * .2)
          .sort((a,b) => b.box.center[2] - a.box.center[2])[0]?.box;
        if (!anchor) continue;
        const margin = this.eyeDistance * .03;
        for (const {group,box} of onSide) if (box.center[0] >= anchor.lo[0] - margin
          && box.center[0] <= anchor.hi[0] + margin && box.center[2] >= anchor.lo[2] - margin
          && box.center[2] <= anchor.hi[2] + margin)
          for (const i of group) this.browMask[i] = 1;
      }
    }
    this.browBounds = Object.fromEntries(['L', 'R'].map(side => [side, bounds(this.points,
      indices(this.browMask).filter(i => (this.points[i * 3] > this.centerX) === (side === 'L')))]));
    // Brow islands complete openings in the skin mesh. Apply one spatial
    // displacement field to both sides of every seam, with a smooth skin falloff.
    const browSeeds = indices(this.browMask), radius = this.eyeDistance * .08;
    this.browWeights = Float32Array.from({length: this.base.count}, (_, i) => {
      let distance = Infinity;
      for (const j of browSeeds) distance = Math.min(distance, Math.hypot(
        this.points[i*3]-this.points[j*3], this.points[i*3+1]-this.points[j*3+1], this.points[i*3+2]-this.points[j*3+2]));
      return fade(distance / radius);
    });
    // mouth_open also affects cheeks and the chin. Locate the separate lip /
    // inner-mouth islands for form controls, then include adjacent skin smoothly.
    const lips = islands.filter(group => group.length < this.base.count * .15 && group.every(i => mouth[i]))
      .filter(group => { const box = bounds(this.points, group); return Math.abs(box.center[0]-this.centerX) < this.eyeDistance*.15
        && box.hi[2] < middle; }).flat();
    this.mouthBounds = lips.length ? bounds(this.points, lips) : mouthBounds;
    const lipBox = this.mouthBounds, margin = this.eyeDistance * .12;
    this.mouthControlMask = Float32Array.from({length: this.base.count}, (_, i) => {
      let weight = 1;
      for (let a = 0; a < 3; a++) weight *= fade(Math.max(lipBox.lo[a]-this.points[i*3+a], this.points[i*3+a]-lipBox.hi[a], 0)/margin);
      return weight;
    });
    // Closure channels already identify their affected vertices. A height
    // crossfade clips low eyelashes and splits a single eyelid deformation.
    this.eyeMask = new Float32Array(this.base.count).fill(1);
    this.wideEyeMask = Float32Array.from(this.mouthMask, (value,i) => (1-value)*(1-this.browWeights[i]));
    // Precompute the geometry deltas; no source Morph scans are needed per frame.
    this.shapes = Object.fromEntries(['normal','surprise','eye_close',
      'eye_close_smile','ruby_eye_close_smile','mouth_open'].map(name =>
      [name, {position:this.vector({[name]:1}), normal:this.vector({[name]:1}, 'normal')} ]));
  }

  reset() {
    this.position.array.set(this.points);
    if (this.normal) for (let i = 0; i < this.normal.array.length; i++)
      this.normal.array[i] = this.source.attributes.normal.array[i] + this.neutralNormal[i];
  }

  add(name, weight, mask, side) {
    if (!weight) return;
    const shape = this.shapes[name];
    if (!shape) return;
    for (let i = 0; i < this.base.count; i++) {
      if (side && (this.points[i * 3] > this.centerX) !== (side === 'L')) continue;
      const amount = weight * (mask?.[i] ?? 1);
      for (let a = 0; a < 3; a++) {
        const offset = i * 3 + a;
        this.position.array[offset] += shape.position[offset] * amount;
        if (this.normal) this.normal.array[offset] += shape.normal[offset] * amount;
      }
    }
  }

  head(controls) {
    this.reset();
    for (const side of ['L', 'R']) {
      const {open, smile} = controls.eyes[side];
      // Full-face smile targets can contain a wink and hidden alternate lids.
      // Interpolate compatible open/closed eye endpoints instead of adding
      // that full-face shape to a second closure deformation.
      const opened = Math.min(open, 1) * (1 - smile * .12);
      const smilingClose = this.channels.has('eye_close_smile') ? 'eye_close_smile'
        : this.channels.has('ruby_eye_close_smile') ? 'ruby_eye_close_smile' : null;
      this.add('eye_close', (1 - opened) * (smilingClose ? 1 - smile : 1), this.eyeMask, side);
      if (smilingClose) this.add(smilingClose, (1 - opened) * smile, this.eyeMask, side);
      this.add('surprise', Math.max(0, open - 1), this.wideEyeMask, side);
      this.add('normal', -Math.max(0, open - 1), this.wideEyeMask, side);
      const brow = controls.brows[side], box = this.browBounds[side];
      if (!Number.isFinite(box.center[0])) continue;
      const sign = side === 'L' ? 1 : -1, angle = -sign * brow.angle * .38;
      const cos = Math.cos(angle), sin = Math.sin(angle), width = Math.max(box.width, .001);
      for (let i = 0; i < this.base.count; i++) if (this.browWeights[i] && (this.points[i * 3] > this.centerX) === (side === 'L')) {
        const x = this.points[i * 3] - box.center[0], z = this.points[i * 3 + 2] - box.center[2];
        const weight = this.browWeights[i];
        this.position.array[i * 3] += (x * (cos-1) - z * sin + sign * brow.x * this.eyeDistance * .16) * weight;
        this.position.array[i * 3 + 2] += (x * sin + z * (cos-1) + brow.y * this.eyeDistance * .12
          + brow.form * this.eyeDistance * .065 * (1 - clamp(4*x*x/(width*width),0,1))) * weight;
      }
    }
    const {form, open, scale, y} = controls.mouth;
    // Keep the neutral lip seam closed at open=0. Whole-face emotion targets
    // move inner-mouth geometry independently and are unsafe as mouth form.
    this.add('mouth_open', open);
    const center = this.mouthBounds.center;
    for (let i = 0; i < this.base.count; i++) {
      const mask = this.mouthControlMask[i], x = this.position.array[i * 3];
      const u = clamp((this.points[i*3]-center[0]) / Math.max(this.mouthBounds.width*.5,.001),-1,1);
      this.position.array[i * 3] = x + (x - center[0]) * (scale + form) * .12 * mask;
      this.position.array[i * 3 + 2] += (this.position.array[i * 3 + 2] - center[2]) * scale * .12 * mask
        + (y * .1 + form * .035 * u * u) * this.eyeDistance * mask;
    }
  }

  eye(controls, eyeDistance) {
    this.reset();
    const center = this.eyeBounds.center;
    const openness = clamp(controls.eyes[this.eyeSide].open, 0, 1);
    const highlight = this.channels.get('hilight_down')?.position;
    for (let i = 0; i < this.base.count; i++) {
      for (let a=0; a<3; a++) {
        const offset=i*3+a;
        if (highlight) this.position.array[offset] += highlight.array[offset]*controls.highlight;
      }
      this.position.array[i*3] = center[0] + (this.position.array[i*3]-center[0])*(1+controls.gaze.scale*.075*openness)
        + controls.gaze.x*eyeDistance*.038*openness;
      this.position.array[i*3+2] = center[2] + (this.position.array[i*3+2]-center[2])*(1+controls.gaze.scale*.075*openness)
        + controls.gaze.y*eyeDistance*.038*openness;
    }
  }

  activate(changed) {
    for (const {object,privateGeometry} of this.objects) { object.geometry = privateGeometry; object.frustumCulled = false; }
    if (changed) { this.position.needsUpdate = true; if (this.normal) this.normal.needsUpdate = true; }
  }
  restore() { for (const {object,geometry,culled} of this.objects) { object.geometry = geometry; object.frustumCulled = culled; } }
  dispose() { this.restore(); for (const {privateGeometry} of this.objects) privateGeometry.dispose(); }
}
