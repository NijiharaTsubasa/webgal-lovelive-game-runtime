// Source clips supply constant auxiliary TRS and packed visibility curves.
// Unity mixer semantics were checked with native AnimationMixerPlayable probes;
// expression recipe coefficients are this package's input adapter, not Timeline.
const f32 = Math.fround;
const PROPERTIES = new Set(['position', 'quaternion', 'scale', 'visible']);

function vector(value, size) {
  return Array.isArray(value) && value.length === size
    && value.every(component => Number.isFinite(component) && Number.isFinite(f32(component)));
}

export function sampleVisibility(pose, weight) {
  const time = f32(pose.length * f32(weight));
  let key = pose.curve[0];
  for (const candidate of pose.curve) {
    if (candidate[0] > time) break;
    key = candidate;
  }
  const dt = f32(time - key[0]);
  return f32(f32(f32(f32(f32(key[1] * dt) + key[2]) * dt) + key[3]) * dt + key[4]);
}

export function evaluateBinding(binding, weights) {
  const rotation = binding.property === 'quaternion';
  const visibility = binding.property === 'visible';
  const result = Array(visibility ? 1 : binding.default.length).fill(0);
  let total = 0;
  const accumulate = (value, weight) => {
    const sign = rotation && result.reduce((dot, component, i) => dot + component * value[i], 0) < 0 ? -1 : 1;
    for (let i = 0; i < result.length; i++) {
      result[i] = f32(result[i] + f32(value[i] * sign * weight));
    }
  };
  for (const pose of binding.poses) {
    const input = weights[pose.name] ?? 0;
    if (!Number.isFinite(input)) throw new Error(`LLAS.Face non-finite recipe weight: ${pose.name}`);
    // SetInputWeight rejects negative input; the source graph resets inputs first.
    const weight = f32(Math.max(0, input));
    if (!Number.isFinite(weight)) throw new Error(`LLAS.Face recipe weight exceeds float range: ${pose.name}`);
    if (weight === 0) continue;
    total = f32(total + weight);
    accumulate(visibility ? [sampleVisibility(pose, weight)] : pose.value, weight);
  }
  if (!Number.isFinite(total)) throw new Error('LLAS.Face weight sum exceeds float range');
  accumulate(visibility ? [Number(binding.default)] : binding.default, Math.max(0, f32(1 - total)));
  if (!result.every(Number.isFinite)) throw new Error('LLAS.Face non-finite evaluated value');
  if (visibility) {
    // Original libunity.so: property writer RVA 0x5BA494, type 6 at
    // 0x5BA4C8..0x5BA500: (value > f32(.001)) | (value < -f32(.001)).
    return Math.abs(result[0]) > f32(.001);
  }
  if (rotation) {
    const length = Math.hypot(...result);
    if (!(length > 0)) throw new Error('LLAS.Face degenerate evaluated quaternion');
    return result.map(value => value / length);
  }
  return result;
}

export default class Face {
  constructor(context, declarations) {
    if (!Array.isArray(declarations) || declarations.length !== 1 || declarations[0].role !== 'integrated') {
      throw new Error('LLAS.Face requires one integrated declaration');
    }
    this.context = context;
    this.parameters = declarations[0].parameters;
    this.bindings = [];
    this.underlay = null;
    this.enabled = true;
  }

  Awake() {
    const definition = this.context.getExpressionDefinition('integrated');
    const names = new Set(definition?.morphPoses?.map(pose => pose.name));
    if (!names.size) throw new Error('LLAS.Face requires Morph recipes');
    const bindings = this.parameters?.bindings;
    if (!Array.isArray(bindings) || !bindings.length) throw new Error('LLAS.Face missing bindings');
    const owned = new Map();
    const resolved = bindings.map(binding => {
      if (!binding || typeof binding.node !== 'string' || !binding.node || !PROPERTIES.has(binding.property)) {
        throw new Error('LLAS.Face invalid target property');
      }
      const visibility = binding.property === 'visible';
      const size = binding.property === 'quaternion' ? 4 : 3;
      const validValue = value => vector(value, size)
        && (binding.property !== 'quaternion' || Math.hypot(...value) > 0);
      if (visibility ? typeof binding.default !== 'boolean' : !validValue(binding.default)) {
        throw new Error('LLAS.Face invalid default');
      }
      if (!Array.isArray(binding.poses) || !binding.poses.length) throw new Error('LLAS.Face missing poses');
      const poses = new Set();
      for (const pose of binding.poses) {
        if (!pose || !names.has(pose.name) || poses.has(pose.name)) throw new Error('LLAS.Face invalid or duplicate recipe');
        poses.add(pose.name);
        if (!visibility) {
          if (!validValue(pose.value)) throw new Error('LLAS.Face invalid pose value');
        } else {
          if (!Number.isFinite(pose.length) || !Number.isFinite(f32(pose.length)) || pose.length <= 0
            || !Array.isArray(pose.curve) || !pose.curve.length) {
            throw new Error('LLAS.Face invalid visibility curve');
          }
          let previous = -Infinity;
          for (const key of pose.curve) {
            if (!vector(key, 5) || key[0] < 0 || key[0] <= previous) throw new Error('LLAS.Face invalid visibility key');
            previous = key[0];
          }
          if (pose.curve[0][0] !== 0) throw new Error('LLAS.Face visibility curve must start at zero');
        }
      }
      const node = this.context.resolveNode('integrated', binding.node);
      if (!node?.isObject3D) throw new Error('LLAS.Face target is not an Object3D');
      const properties = owned.get(node) || new Set();
      if (properties.has(binding.property)) throw new Error('LLAS.Face duplicate target property');
      properties.add(binding.property);
      owned.set(node, properties);
      return { ...binding, node };
    });
    // No scene mutation occurs until all declarations and references are valid.
    this.bindings = resolved;
    // Exported hidden renderers need the source Animator's default as their
    // initial scene state, even before the first expression snapshot exists.
    for (const binding of this.bindings) {
      if (binding.property === 'visible') binding.node.visible = binding.default;
    }
  }

  restore() {
    if (!this.underlay) return;
    for (const { node, property, value } of this.underlay) {
      if (property === 'visible') node.visible = value;
      else node[property].fromArray(value);
    }
    this.underlay = null;
  }

  setEnabled(value) {
    if (typeof value !== 'boolean') throw new Error('LLAS.Face enabled must be boolean');
    this.enabled = value;
    if (!value) this.restore();
  }

  Update() { this.restore(); }

  LateUpdate() {
    this.restore();
    const state = this.context.getExpressionState('integrated');
    if (!this.enabled || !state?.active) return;
    const outputs = this.bindings.map(binding => evaluateBinding(binding, state.poseWeights));
    this.underlay = this.bindings.map(({ node, property }) => ({
      node, property, value: property === 'visible' ? node.visible : node[property].toArray(),
    }));
    this.bindings.forEach(({ node, property }, index) => {
      if (property === 'visible') node.visible = outputs[index];
      else node[property].fromArray(outputs[index]);
    });
  }

  OnDisable() { this.restore(); }
  OnDestroy() { this.restore(); this.bindings = []; this.enabled = false; }
}
