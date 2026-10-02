// Source: Inspix.SubBoneController, Hasunosora 5.1.0: Swing 0x4F64C00,
// Twist 0x4F64FA0, Move 0x4F63680; local-frame projection is the glTF adaptation.
const EPSILON = 1.401298464324817e-45;
const RAD_TO_DEG = 57.295780181884766;
const AXIS_EPSILON = 9.999999974752427e-7;

// libunity.so 0xEFDA48: the short-arc branch uses normalized Lerp at
// |dot| >= float(0.95), including for SlerpUnclamped extrapolation.
export function unitySlerp(a, b, t) {
  let dot = a.dot(b);
  const target = b.clone();
  if (dot < 0) {
    dot = -dot;
    target.set(-target.x, -target.y, -target.z, -target.w);
  }
  if (dot >= 0.949999988079071) {
    return a.clone().set(
      a.x + (target.x - a.x) * t,
      a.y + (target.y - a.y) * t,
      a.z + (target.z - a.z) * t,
      a.w + (target.w - a.w) * t,
    ).normalize();
  }
  const angle = Math.acos(dot);
  const divisor = Math.sin(angle);
  const left = Math.sin((1 - t) * angle) / divisor;
  const right = Math.sin(t * angle) / divisor;
  return a.clone().set(a.x * left + target.x * right, a.y * left + target.y * right,
    a.z * left + target.z * right, a.w * left + target.w * right);
}

// Native wrappers 0x5AF560 / 0x5AF65C; thresholds are source float constants.
export function unityToAngleAxis(THREE, input) {
  const q = input.clone();
  if (q.length() < 9.999999747378752e-6) q.identity();
  else q.normalize();
  const angle = Math.fround(Math.fround(2 * Math.acos(Math.max(-1, Math.min(1, q.w)))) * RAD_TO_DEG);
  const denominator = Math.sqrt(Math.max(0, 1 - q.w * q.w));
  const axis = denominator > AXIS_EPSILON
    ? new THREE.Vector3(q.x, q.y, q.z).multiplyScalar(1 / denominator)
    : new THREE.Vector3(1, 0, 0);
  return { angle, axis };
}

export function unityAngleAxis(THREE, angle, axis) {
  const length = axis.length();
  if (length <= AXIS_EPSILON) return new THREE.Quaternion();
  const halfAngle = angle / 360 * Math.fround(Math.PI);
  const factor = Math.sin(halfAngle) / length;
  return new THREE.Quaternion(axis.x * factor, axis.y * factor, axis.z * factor, Math.cos(halfAngle));
}

export function unityEuler(input) {
  const q = input.clone();
  if (q.length() < 9.999999747378752e-6) q.identity();
  else q.normalize();
  const { x, y, z, w } = q;
  const p = y * z - x * w;
  const ex = -Math.asin(Math.max(-1, Math.min(1, 2 * p)));
  let ey;
  let ez;
  if (Math.abs(p) < 0.4999989867210388) {
    ey = Math.atan2(2 * (x * z + y * w), w * w + z * z - x * x - y * y);
    ez = Math.atan2(2 * (x * y + z * w), w * w + y * y - z * z - x * x);
  } else {
    const a = x * w - y * z, b = x * y - z * w;
    const c = y * z + x * w, d = x * y + z * w;
    ey = Math.atan2(d * c + a * b, a * c - d * b);
    ez = 0;
  }
  return [ex, ey, ez].map((radians) => {
    let value = Math.fround(Math.fround(radians) * RAD_TO_DEG);
    if (value < -0.005729577969759703) value = Math.fround(value + 360);
    else if (value > 359.9942626953125) value = Math.fround(value - 360);
    return value;
  });
}

export function deltaAngle(a, b) {
  const delta = Math.fround(b - a);
  let value = Math.fround(delta - Math.floor(delta / 360) * 360);
  value = Math.max(0, Math.min(360, value));
  return value > 180 ? Math.fround(value - 360) : value;
}

function decompose(THREE, q, direction) {
  const lengthSq = direction.lengthSq();
  const projection = lengthSq < EPSILON ? new THREE.Vector3()
    : direction.clone().multiplyScalar(
      new THREE.Vector3(q.x, q.y, q.z).dot(direction) / lengthSq,
    );
  const twist = new THREE.Quaternion(projection.x, projection.y, projection.z, q.w);
  if (twist.length() < EPSILON) twist.identity();
  else twist.normalize();
  return { swing: q.clone().multiply(twist.clone().invert()), twist };
}

function evaluate(THREE, rule, q) {
  const delta = q.clone().multiply(rule.main.clone().invert());
  if (rule.category === 1) {
    const limited = unitySlerp(new THREE.Quaternion(), delta, Math.max(0, Math.min(1, rule.magnification)));
    return decompose(THREE, limited, rule.right).swing.multiply(rule.sub);
  }
  if (rule.category === 2) {
    const direction = new THREE.Vector3(1, 0, 0).applyQuaternion(rule.main);
    const twist = decompose(THREE, delta, direction).twist;
    const { angle, axis } = unityToAngleAxis(THREE, twist);
    axis.applyQuaternion(rule.main.clone().invert());
    return unitySlerp(new THREE.Quaternion(), unityAngleAxis(THREE, angle, axis), rule.magnification);
  }
  const component = [undefined, 2, 1, 0][rule.inputAxis];
  let difference = component === undefined ? 0
    : deltaAngle(unityEuler(rule.main)[component], unityEuler(q)[component]);
  difference = Math.max(rule.minAngle, Math.min(rule.maxAngle, difference));
  if (rule.maxAngle < 0) difference -= rule.maxAngle;
  if (rule.minAngle > 0) difference -= rule.minAngle;
  return rule.position.clone().addScaledVector(rule.direction, rule.magnification / 180 * difference);
}

function vector(value, size, label) {
  if (!Array.isArray(value) || value.length !== size || value.some((v) => !Number.isFinite(v))) {
    throw new Error(`Hasunosora.SubBoneController ${label} must contain ${size} finite numbers`);
  }
  return value;
}

function finite(value, label) {
  if (!Number.isFinite(value)) throw new Error(`Hasunosora.SubBoneController invalid ${label}`);
  return value;
}

export default class SubBoneController {
  constructor(context, declarations) {
    if (declarations.length !== 1 || declarations[0].role !== "integrated") {
      throw new Error("Hasunosora.SubBoneController requires one integrated model declaration");
    }
    this.context = context;
    this.parameters = declarations[0].parameters;
    this.owned = [];
  }

  Awake() {
    const { THREE } = this.context;
    const parameters = this.parameters;
    if (!parameters || !Array.isArray(parameters.frames) || !Array.isArray(parameters.rules)) {
      throw new Error("Hasunosora.SubBoneController requires frames and rules");
    }
    this.inverseRoot = new THREE.Matrix4();
    this.frames = parameters.frames.map((frame, index) => {
      const basis = new THREE.Matrix4().fromArray(vector(frame.basis, 16, `frames[${index}].basis`));
      if (Math.abs(basis.determinant()) < 1e-12) throw new Error("SubBoneController basis is singular");
      const node = this.context.resolveNode("integrated", frame.node);
      return { node, basis, inverseBasis: basis.clone().invert(), parent: frame.parent };
    });
    const frame = (index, local = true) => {
      if (!Number.isInteger(index) || !this.frames[index]) throw new Error("SubBoneController invalid frame index");
      const result = this.frames[index];
      if (local && result.parent !== null && (!Number.isInteger(result.parent) || !this.frames[result.parent]
          || result.parent === index)) throw new Error("SubBoneController invalid source parent");
      return result;
    };
    const quaternion = (value, label) => {
      const q = new THREE.Quaternion().fromArray(vector(value, 4, label));
      if (q.lengthSq() < 1e-12) throw new Error(`SubBoneController zero quaternion ${label}`);
      return q;
    };
    this.rules = parameters.rules.map((rule) => {
      if (![1, 2, 7].includes(rule.category) || !Array.isArray(rule.outputs) || !rule.outputs.length) {
        throw new Error("SubBoneController invalid category or outputs");
      }
      const result = {
        ...rule, input: frame(rule.input), outputs: rule.outputs.map((index) => frame(index)),
        magnification: finite(rule.magnification, "magnification"),
        main: quaternion(rule.initialMainRotation, "initialMainRotation"),
      };
      if (rule.category === 1) {
        result.right = new THREE.Vector3().fromArray(vector(rule.initialMainRight, 3, "initialMainRight"));
        result.sub = quaternion(rule.initialSubRotation, "initialSubRotation");
      } else if (rule.category === 7) {
        if (![0, 1, 2, 3].includes(rule.inputAxis) || ![0, 1, 2, 3].includes(rule.outputAxis)
            || finite(rule.minAngle, "minAngle") > finite(rule.maxAngle, "maxAngle")) {
          throw new Error("SubBoneController invalid Move axes/range");
        }
        result.position = new THREE.Vector3().fromArray(vector(rule.initialSubPosition, 3, "initialSubPosition"));
        result.direction = new THREE.Vector3().fromArray([[0, 0, 0], [0, 0, 1], [0, 1, 0], [1, 0, 0]][rule.outputAxis]);
      }
      const property = rule.category === 7 ? "position" : "quaternion";
      for (const output of result.outputs) {
        if (!this.owned.some((entry) => entry.node === output.node && entry.property === property)) {
          this.owned.push({ node: output.node, property, saved: null, written: null });
        }
      }
      return result;
    });
    const ancestors = (node) => {
      const result = new Set();
      while (node) {
        result.add(node);
        node = node.parent;
      }
      return result;
    };
    const firstWriter = new Map();
    this.rules.forEach((rule, index) => {
      const channel = rule.category === 7 ? "position" : "rotation";
      for (const output of rule.outputs) {
        if (!firstWriter.has(output.node)) firstWriter.set(output.node, new Map());
        const channels = firstWriter.get(output.node);
        if (!channels.has(channel)) channels.set(channel, index);
      }
    });
    this.rules.forEach((rule, index) => {
      const input = ancestors(rule.input.node);
      const parent = ancestors(rule.input.parent === null ? null : this.frames[rule.input.parent].node);
      for (const node of new Set([...input, ...parent])) {
        if (input.has(node) !== parent.has(node) && firstWriter.has(node)
            && [...firstWriter.get(node).values()].some((first) => first >= index)) {
          throw new Error("SubBoneController cross-frame feedback requires source state semantics");
        }
      }
    });
  }

  sourceWorld(frame) {
    return this.inverseRoot.clone().multiply(frame.node.matrixWorld).multiply(frame.basis);
  }

  read(frame) {
    const { THREE } = this.context;
    const local = this.sourceWorld(frame);
    if (frame.parent !== null) local.premultiply(this.sourceWorld(this.frames[frame.parent]).invert());
    const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
    local.decompose(p, q, s);
    p.x = -p.x;
    q.set(q.x, -q.y, -q.z, q.w).normalize();
    return { p, q, s };
  }

  write(frame, value, property) {
    const { THREE } = this.context;
    const state = this.read(frame);
    if (property === "quaternion") state.q.copy(value);
    else state.p.copy(value);
    state.p.x = -state.p.x;
    state.q.set(state.q.x, -state.q.y, -state.q.z, state.q.w);
    const target = new THREE.Matrix4().compose(state.p, state.q, state.s);
    if (frame.parent !== null) target.premultiply(this.sourceWorld(this.frames[frame.parent]));
    target.multiply(frame.inverseBasis);
    if (frame.node.parent) {
      target.premultiply(this.inverseRoot.clone().multiply(frame.node.parent.matrixWorld).invert());
    }
    target.decompose(state.p, state.q, state.s);
    frame.node[property].copy(property === "quaternion" ? state.q.normalize() : state.p);
    frame.node.updateWorldMatrix(false, true);
  }

  restoreOwned() {
    for (const entry of this.owned) {
      // A subsequent animation/physics writer owns its new value. Never undo it
      // during disable/dispose or a second LateUpdate without an Update.
      if (entry.written && entry.node[entry.property].equals(entry.written)) {
        entry.node[entry.property].copy(entry.saved);
      }
      entry.saved = entry.written = null;
    }
  }

  Update() {
    this.restoreOwned();
  }

  LateUpdate() {
    this.restoreOwned();
    const { root, THREE } = this.context;
    root.updateWorldMatrix(true, true);
    this.inverseRoot.copy(root.matrixWorld).invert();
    for (const entry of this.owned) entry.saved = entry.node[entry.property].clone();
    for (const rule of this.rules) {
      const value = evaluate(THREE, rule, this.read(rule.input).q);
      for (const output of rule.outputs) this.write(output, value, rule.category === 7 ? "position" : "quaternion");
    }
    for (const entry of this.owned) entry.written = entry.node[entry.property].clone();
  }

  OnDisable() {
    this.restoreOwned();
    this.context.root.updateWorldMatrix(true, true);
  }

  OnDestroy() {
    this.OnDisable();
  }
}
