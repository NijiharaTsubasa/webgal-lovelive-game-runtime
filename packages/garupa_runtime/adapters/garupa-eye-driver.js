// Gaze is a cross-medium overlay on the source eye pivots. Native node scales
// and rotations remain the underlay; source highlight timing is not simulated.
const neutralHeads = new WeakMap();

function neutralHeadRotation(gltf, THREE) {
  if (neutralHeads.has(gltf)) {
    return neutralHeads.get(gltf);
  }
  const nodes = gltf.parser.json.nodes;
  const heads = nodes.map((node, index) => node.name === 'Head' ? index : -1).filter((index) => index >= 0);
  if (heads.length !== 1) {
    throw new Error('Garupa gaze requires one source Head reference');
  }
  const parents = new Map();
  nodes.forEach((node, index) => {
    for (const child of node.children ?? []) {
      parents.set(child, index);
    }
  });
  const chain = [];
  for (let index = heads[0]; index !== undefined; index = parents.get(index)) {
    if (chain.length >= nodes.length) {
      throw new Error('Cyclic Garupa source Head reference');
    }
    chain.push(nodes[index]);
  }
  const world = new THREE.Matrix4();
  const local = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  for (let index = chain.length - 1; index >= 0; index--) {
    const node = chain[index];
    if (node.matrix) {
      local.fromArray(node.matrix);
    } else {
      position.fromArray(node.translation ?? [0, 0, 0]);
      rotation.fromArray(node.rotation ?? [0, 0, 0, 1]);
      scale.fromArray(node.scale ?? [1, 1, 1]);
      local.compose(position, rotation, scale);
    }
    world.multiply(local);
  }
  world.decompose(position, rotation, scale);
  const inverse = rotation.normalize().invert();
  neutralHeads.set(gltf, inverse);
  return inverse;
}

export class GarupaEyeDriver {
  constructor(context, part, required = false) {
    this.bindings = [];
    this.active = false;
    const { THREE } = context;
    const rootRotation = new THREE.Quaternion();
    const parentRotation = new THREE.Quaternion();
    const basis = new THREE.Quaternion();
    part.root.updateWorldMatrix(true, true);
    if (required) {
      // Composition discards the head component's duplicate core rig. The
      // body's live Head owns motion; the original GLB provides its neutral
      // frame, which is not aligned with the model's front/up axes.
      const owner = context.parts.find((entry) => entry.role === 'body') ?? part;
      context.resolveNode(owner.role, 'Head').getWorldQuaternion(rootRotation);
      rootRotation.normalize().multiply(neutralHeadRotation(owner.gltf, THREE));
    } else {
      part.root.getWorldQuaternion(rootRotation);
    }
    for (const side of ['L', 'R']) {
      for (const suffix of ['', '_Hilight_1', '_Hilight_2', '_Hilight_3']) {
        const prefix = `${side}Eye${suffix}`;
        const pivotName = suffix ? `${prefix}_0` : `${prefix}_0_0`;
        const endName = suffix ? `${prefix}_1` : `${prefix}_0_1`;
        const pivot = required ? context.resolveNode(part.role, pivotName) : part.root.getObjectByName(pivotName);
        const end = required ? context.resolveNode(part.role, endName) : part.root.getObjectByName(endName);
        if (!pivot && !end) {
          continue;
        }
        if (!pivot || !end || !pivot.parent) {
          throw new Error(`Incomplete Garupa eye binding: ${prefix}`);
        }
        pivot.parent.getWorldQuaternion(parentRotation);
        basis.copy(parentRotation).invert().multiply(rootRotation);
        this.bindings.push({
          pivot,
          end,
          highlight: suffix !== '',
          horizontal: new THREE.Vector3(0, 1, 0).applyQuaternion(basis),
          vertical: new THREE.Vector3(-1, 0, 0).applyQuaternion(basis),
          rotation: new THREE.Quaternion(),
          scale: new THREE.Vector3(),
        });
      }
    }
    const pivots = new Set(this.bindings.map((binding) => binding.pivot));
    for (const binding of this.bindings) {
      binding.gazeRoot = true;
      for (let parent = binding.pivot.parent; parent; parent = parent.parent) {
        if (pivots.has(parent)) {
          binding.gazeRoot = false;
          break;
        }
      }
    }
    this.yaw = new THREE.Quaternion();
    this.pitch = new THREE.Quaternion();
  }

  restore() {
    if (this.active) {
      for (const binding of this.bindings) {
        binding.pivot.quaternion.copy(binding.rotation);
        binding.end.scale.copy(binding.scale);
      }
      this.active = false;
    }
  }

  apply(x, y, irisScale, highlight) {
    this.restore();
    if (!x && !y && !irisScale && !highlight) {
      return;
    }
    for (const binding of this.bindings) {
      binding.rotation.copy(binding.pivot.quaternion);
      binding.scale.copy(binding.end.scale);
      // A highlight beneath an eye pivot already inherits its gaze rotation.
      if (binding.gazeRoot) {
        this.yaw.setFromAxisAngle(binding.horizontal, x * 0.12);
        this.pitch.setFromAxisAngle(binding.vertical, y * 0.1);
        binding.pivot.quaternion.copy(this.yaw).multiply(this.pitch).multiply(binding.rotation);
      }
      binding.end.scale.multiplyScalar(1 + (binding.highlight ? highlight * 0.13 : irisScale * 0.075));
    }
    this.active = true;
  }

  dispose() {
    this.restore();
    this.bindings.length = 0;
  }
}
