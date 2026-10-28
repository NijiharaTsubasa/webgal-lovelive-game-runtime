// Native Unity Rotation/Position/ParentConstraint, with a source-frame bridge
// for Humanoid normalization and composed head/body rigs.
const DEG = Math.PI / 180;

function vector(value, length, label) {
  if (!Array.isArray(value) || value.length !== length || value.some(v => !Number.isFinite(v))) {
    throw new Error(`Garupa.TransformConstraint ${label} requires ${length} finite numbers`);
  }
  return value;
}

function finite(value, label) {
  if (!Number.isFinite(value)) throw new Error(`Garupa.TransformConstraint invalid ${label}`);
  return value;
}

function eulerQuaternion(THREE, value) {
  return new THREE.Quaternion().setFromEuler(new THREE.Euler(...value.map(v => v * DEG), "YXZ"));
}

function lerp(a, b, weight) {
  const sign = a.dot(b) < 0 ? -1 : 1;
  return a.clone().set(
    a.x * (1 - weight) + sign * b.x * weight,
    a.y * (1 - weight) + sign * b.y * weight,
    a.z * (1 - weight) + sign * b.z * weight,
    a.w * (1 - weight) + sign * b.w * weight,
  ).normalize();
}

function eulerZXY(input) {
  const { x, y, z, w } = input.clone().normalize();
  const p = y * z - x * w;
  const ex = -Math.asin(Math.max(-1, Math.min(1, 2 * p)));
  let ey, ez;
  if (Math.abs(p) < 0.4999989867210388) {
    ey = Math.atan2(2 * (x * z + y * w), w * w + z * z - x * x - y * y);
    ez = Math.atan2(2 * (x * y + z * w), w * w + y * y - z * z - x * x);
  } else {
    const a = x * w - y * z, b = x * y - z * w;
    const c = y * z + x * w, d = x * y + z * w;
    ey = Math.atan2(d * c + a * b, a * c - d * b); ez = 0;
  }
  return [ex, ey, ez].map(v => v / DEG);
}

export function smartEuler(THREE, rotation, hint = [0, 0, 0]) {
  const reference = eulerQuaternion(THREE, hint), q = rotation.clone().normalize();
  const sign = q.dot(reference) < 0 ? -1 : 1;
  const chord = Math.hypot(q.x - sign * reference.x, q.y - sign * reference.y,
    q.z - sign * reference.z, q.w - sign * reference.w);
  // Transform.GetLocalEulerAngles(OrderZXY): retain an equivalent hint within
  // 0.001 degree; otherwise choose the nearest Euler branch and quantize it.
  if (chord < 2 * Math.sin(0.001 * DEG / 4)) return [...hint];
  const main = eulerZXY(q);
  const alternate = [180 - main[0], main[1] + 180, main[2] + 180];
  const nearest = angles => angles.map((v, i) => v + 360 * Math.round((hint[i] - v) / 360));
  const a = nearest(main), b = nearest(alternate);
  const distance = angles => angles.reduce((sum, v, i) => sum + (v - hint[i]) ** 2, 0);
  return (distance(b) < distance(a) ? b : a).map(v => Math.round(v * 1000) / 1000);
}

function filterRotation(THREE, desired, current, axes, hint) {
  if (axes.every(Boolean)) return desired.normalize();
  if (!axes.some(Boolean)) return current.clone();
  const solved = eulerZXY(desired), preserved = smartEuler(THREE, current, hint);
  return eulerQuaternion(THREE, solved.map((v, i) => axes[i] ? v : preserved[i]));
}

function mixSources(sources) {
  const total = sources.reduce((sum, source) => sum + source.weight, 0);
  if (total <= 0) return null;
  let world = null;
  for (const source of sources) {
    if (!world) world = source.rotation.clone();
    else world = lerp(world, source.rotation, Math.max(0, Math.min(1, source.weight / total)));
  }
  return world;
}

// Rotation weights use the final source total on every successive Lerp, not
// a running weighted average. The native result depends on source-list order.
export function solveRotation(THREE, rule, sources, parent, current, hint = [0, 0, 0]) {
  if (!rule.sources.length || !rule.axes.some(Boolean)) return current.clone();
  const rest = eulerQuaternion(THREE, rule.rotationAtRest);
  let local = rest;
  const world = mixSources(sources);
  if (world) {
    local = parent.clone().invert().multiply(world).multiply(eulerQuaternion(THREE, rule.rotationOffset));
    local = lerp(rest, local, Math.max(0, Math.min(1, rule.weight)));
  }
  return filterRotation(THREE, local, current, rule.axes, hint);
}

export function solveTranslation(THREE, rule, sources, inverseParent, current) {
  const axes = rule.type === "parent" ? rule.translationAxes : rule.axes;
  if (!rule.sources.length || !axes.some(Boolean)) return current.clone();
  const rest = new THREE.Vector3().fromArray(rule.translationAtRest);
  const total = sources.reduce((sum, source) => sum + source.weight, 0);
  let local = rest.clone();
  if (total > 0) {
    const world = new THREE.Vector3();
    for (const source of sources) {
      const position = source.position.clone();
      if (rule.type === "parent") {
        // Native ParentConstraint rotates source-local offsets but does not
        // multiply them by the source Transform's scale.
        position.add(new THREE.Vector3().fromArray(rule.translationOffsets[source.index]).applyQuaternion(source.rotation));
      }
      world.addScaledVector(position, source.weight);
    }
    // The native single-source path retains its source weight. Only the
    // multi-source path divides the accumulated position by total weight.
    if (rule.sources.length > 1) world.divideScalar(total);
    local = world.applyMatrix4(inverseParent);
    if (rule.type === "position") local.add(new THREE.Vector3().fromArray(rule.translationOffset));
    local.lerpVectors(rest, local, Math.max(0, Math.min(1, rule.weight)));
  }
  for (const [i, key] of ["x", "y", "z"].entries()) if (!axes[i]) local[key] = current[key];
  return local;
}

export function solveParentRotation(THREE, rule, sources, parent, current, hint) {
  const rotations = sources.map(source => ({ weight: source.weight,
    rotation: source.rotation.clone().multiply(eulerQuaternion(THREE, rule.rotationOffsets[source.index])) }));
  return solveRotation(THREE, { ...rule, axes: rule.rotationAxes, rotationOffset: [0, 0, 0] },
    rotations, parent, current, hint);
}

export default class TransformConstraint {
  constructor(context, declarations) {
    this.context = context;
    this.declarations = declarations;
    this.owned = [];
    this.groups = [];
  }

  Awake() {
    const { THREE } = this.context;
    this.inverseRoot = new THREE.Matrix4();
    for (const { role, parameters } of this.declarations) {
      if (!Array.isArray(parameters?.frames) || !Array.isArray(parameters.constraints)) {
        throw new Error("Garupa.TransformConstraint requires frames and constraints");
      }
      const frames = parameters.frames.map((frame, index) => {
        const basis = new THREE.Matrix4().fromArray(vector(frame.basis, 16, `frames[${index}].basis`));
        let node = this.context.resolveNode(role, frame.node);
        const part = this.context.parts?.find(entry => entry.role === role);
        const binding = part?.nodeBindings?.get(node);
        if (binding) {
          // Composition replaces the head's duplicate core rig. Keep the
          // original head bind frame while following its effective body bone.
          basis.premultiply(binding.localMatrix);
          node = binding.node;
          const wrapper = node.parent;
          if (wrapper && `${wrapper.name}$AvatarScalerScaled` === node.name) {
            const matches = this.context.parts?.find(entry => entry.role === "body")
              ?.nodesByName?.get(wrapper.name) || [];
            if (matches.length !== 1 || matches[0] !== wrapper) {
              throw new Error("TransformConstraint cannot resolve AvatarScaler logical binding");
            }
            node = wrapper;
          }
        }
        if (basis.determinant() === 0) throw new Error("TransformConstraint singular frame basis");
        return { node, parent: frame.parent, eulerHint: vector(frame.eulerHint ?? [0, 0, 0], 3, "eulerHint"),
          basis, inverseBasis: basis.clone().invert() };
      });
      const at = index => {
        if (!Number.isInteger(index) || !frames[index]) throw new Error("TransformConstraint invalid frame index");
        return frames[index];
      };
      for (let i = 0; i < frames.length; i++) {
        const visited = new Set([i]);
        let parent = frames[i].parent;
        while (parent !== null) {
          if (visited.has(parent)) throw new Error("TransformConstraint cyclic source parent hierarchy");
          visited.add(parent); parent = at(parent).parent;
        }
      }
      const rules = parameters.constraints.map(rule => {
        const target = at(rule.target);
        if (!["rotation", "position", "parent"].includes(rule.type) || !Array.isArray(rule.sources)
            || typeof rule.enabled !== "boolean" || typeof rule.active !== "boolean") {
          throw new Error("TransformConstraint invalid type/sources/state");
        }
        for (const source of rule.sources) {
          if (source.frame !== null) at(source.frame);
          finite(source.weight, "source weight");
        }
        const axes = value => {
          if (!Array.isArray(value) || value.length !== 3 || value.some(v => typeof v !== "boolean")) {
            throw new Error("TransformConstraint requires three boolean axis flags");
          }
        };
        if (rule.type === "parent") {
          axes(rule.translationAxes); axes(rule.rotationAxes);
          vector(rule.translationAtRest, 3, "translationAtRest"); vector(rule.rotationAtRest, 3, "rotationAtRest");
          if (!Array.isArray(rule.translationOffsets) || !Array.isArray(rule.rotationOffsets)) {
            throw new Error("ParentConstraint requires source offset arrays");
          }
          for (let i = 0; i < rule.sources.length; i++) {
            vector(rule.translationOffsets[i], 3, "translationOffsets"); vector(rule.rotationOffsets[i], 3, "rotationOffsets");
          }
        } else {
          axes(rule.axes);
          for (const key of rule.type === "rotation" ? ["rotationAtRest", "rotationOffset"] : ["translationAtRest", "translationOffset"]) {
            vector(rule[key], 3, key);
          }
        }
        finite(rule.weight, "weight");
        const properties = rule.type === "rotation" ? ["quaternion"]
          : rule.type === "position" ? ["position"] : ["position", "quaternion"];
        for (const property of properties) {
          if (rule.enabled && rule.active && !this.owned.some(entry => entry.node === target.node && entry.property === property)) {
            this.owned.push({ node: target.node, property });
          }
        }
        return rule;
      });
      this.groups.push({ frames, rules, local: new Map(), world: new Map(), source: new Map() });
    }
  }

  sourceWorld(group, index) {
    if (!group.source.has(index)) {
      const frame = group.frames[index];
      group.source.set(index, this.inverseRoot.clone().multiply(frame.node.matrixWorld).multiply(frame.basis));
    }
    return group.source.get(index);
  }

  readLocal(group, index) {
    if (!group.local.has(index)) {
      const { THREE } = this.context, frame = group.frames[index];
      const matrix = this.sourceWorld(group, index).clone();
      if (frame.parent !== null) matrix.premultiply(this.sourceWorld(group, frame.parent).clone().invert());
      const position = new THREE.Vector3(), rotation = new THREE.Quaternion(), scale = new THREE.Vector3();
      matrix.decompose(position, rotation, scale);
      position.x = -position.x;
      rotation.set(rotation.x, -rotation.y, -rotation.z, rotation.w).normalize();
      group.local.set(index, { position, rotation, scale });
    }
    return group.local.get(index);
  }

  readWorldRotation(group, index) {
    if (!group.world.has(index)) {
      const frame = group.frames[index];
      const rotation = this.readLocal(group, index).rotation.clone();
      // Unity Transform.rotation composes local quaternions independently of
      // inherited nonuniform scales; decomposing matrixWorld would add shear.
      if (frame.parent !== null) rotation.premultiply(this.readWorldRotation(group, frame.parent));
      group.world.set(index, rotation);
    }
    return group.world.get(index);
  }

  write(group, index, value) {
    const { THREE } = this.context, frame = group.frames[index];
    const state = this.readLocal(group, index);
    const p = (value.position ?? state.position).clone(); p.x = -p.x;
    const rotation = value.rotation ?? state.rotation;
    const q = new THREE.Quaternion(rotation.x, -rotation.y, -rotation.z, rotation.w);
    const matrix = new THREE.Matrix4().compose(p, q, state.scale);
    if (frame.parent !== null) matrix.premultiply(this.sourceWorld(group, frame.parent));
    matrix.multiply(frame.inverseBasis);
    if (frame.node.parent) {
      matrix.premultiply(this.inverseRoot.clone().multiply(frame.node.parent.matrixWorld).invert());
    }
    matrix.decompose(p, q, new THREE.Vector3());
    if (value.position) frame.node.position.copy(p);
    if (value.rotation) frame.node.quaternion.copy(q.normalize());
    frame.node.updateWorldMatrix(false, true);
    group.local.clear(); group.world.clear(); group.source.clear();
  }

  Update() {}

  LateUpdate() {
    const { root, THREE } = this.context;
    root.updateWorldMatrix(true, true);
    this.inverseRoot.copy(root.matrixWorld).invert();
    for (const group of this.groups) {
      group.local.clear(); group.world.clear(); group.source.clear();
      for (const rule of group.rules) {
        if (!rule.enabled || !rule.active || !rule.sources.length) continue;
        const target = group.frames[rule.target];
        const sources = rule.sources.map((s, index) => ({ ...s, index })).filter(s => s.frame !== null && s.weight !== 0)
          .map(s => {
            const position = new THREE.Vector3().setFromMatrixPosition(this.sourceWorld(group, s.frame));
            position.x = -position.x;
            return { index: s.index, weight: s.weight, position, rotation: this.readWorldRotation(group, s.frame) };
          });
        const parent = target.parent === null ? new THREE.Quaternion() : this.readWorldRotation(group, target.parent);
        const current = this.readLocal(group, rule.target);
        const value = {};
        if (rule.type !== "position" && (rule.type === "parent" ? rule.rotationAxes : rule.axes).some(Boolean)) {
          value.rotation = rule.type === "parent"
            ? solveParentRotation(THREE, rule, sources, parent, current.rotation, target.eulerHint)
            : solveRotation(THREE, rule, sources, parent, current.rotation, target.eulerHint);
        }
        if (rule.type !== "rotation" && (rule.type === "parent" ? rule.translationAxes : rule.axes).some(Boolean)) {
          const inverse = target.parent === null ? new THREE.Matrix4()
            : this.sourceWorld(group, target.parent).clone().invert();
          const reflection = new THREE.Matrix4().makeScale(-1, 1, 1);
          inverse.premultiply(reflection).multiply(reflection);
          value.position = solveTranslation(THREE, rule, sources, inverse, current.position);
        }
        if (value.position || value.rotation) this.write(group, rule.target, value);
      }
    }
  }

  // Native disabling/removal leaves the last constrained Transform in place;
  // subsequent animation writes remain authoritative.
  OnDisable() {}
  OnDestroy() { this.groups = []; this.owned = []; }
}
