// Displacement divided by neutral eye-center distance, measured from original MOCs.
// Keys are AvatarDescription.Id role groups; signs have independent gains.
const CURVES = {
  28: [[0.07247043, 0.05579853], [0.07247043, 0.05579853]],
  29: [[0.06625155, 0.06625192], [0.06625155, 0.06625192]],
  36: [[0.0815828, 0.0800842], [0.0815828, 0.0800842]],
  37: [[0.07677987, 0.04944488], [0.07677989, 0.04944488]],
  38: [[0.06117026, 0.06117063], [0.06117026, 0.06117063]],
  39: [[0.08311293, 0.0815864], [0.08311293, 0.0815864]],
  40: [[0.08637282, 0.06588678], [0.08637282, 0.06588678]],
};
const COMMON_CURVE = [[0.07677987, 0.06588678], [0.07677989, 0.06588678]];

export function eyelidCurve(characterId) {
  return CURVES[characterId] ?? COMMON_CURVE;
}

// Source EYELID moves the crease independently of the eye opening. The GLB
// marks complete crease pieces, including their skin-colored backing polygons.
export function createEyelidDriver(context, part, bindings, profile) {
  const root = context.root ?? part.root;
  const groups = new Map();
  const register = (object) => {
    const source = object?.geometry;
    if (!object?.isMesh || !source?.userData?.garupaEyelid) return;
    let group = groups.get(source);
    if (!group) {
      group = { source, objects: new Map() };
      groups.set(source, group);
    }
    group.objects.set(object, object.frustumCulled);
  };
  root?.traverse(register);
  bindings.forEach((binding) => register(binding.object));
  const leftEye = groups.size && context.resolveNode(part.role, 'LEye_0_0');
  const rightEye = groups.size && context.resolveNode(part.role, 'REye_0_0');
  const targets = [];
  for (const { source, objects } of groups.values()) {
    const base = source.attributes.position;
    if (!leftEye || !rightEye) continue;
    const mesh = objects.keys().next().value;
    mesh.updateWorldMatrix(true, false);
    const inverse = new context.THREE.Matrix4().copy(mesh.matrixWorld).invert();
    const leftCenter = leftEye.getWorldPosition(new context.THREE.Vector3()).applyMatrix4(inverse);
    const rightCenter = rightEye.getWorldPosition(new context.THREE.Vector3()).applyMatrix4(inverse);
    const distance = leftCenter.distanceTo(rightCenter);
    const sides = ['left', 'right'].map((side, index) => {
      const indices = source.userData.garupaEyelid[side] ?? [];
      // These indices address the position buffer written below; an out-of-
      // range or fractional index cannot denote a vertex of this primitive.
      if (!Array.isArray(indices) || indices.some((i) => !Number.isInteger(i) || i < 0 || i >= base.count)) {
        throw new Error(`Invalid Garupa eyelid vertex indices: ${side}`);
      }
      return { indices, curve: profile?.[index] };
    });
    if (!sides.some((side) => side.indices.length && side.curve)) continue;
    const geometry = source.clone();
    targets.push({ source, geometry, base, position: geometry.attributes.position, objects, sides, distance });
  }
  let left = NaN, right = NaN, disposed = false;
  return {
    targets,
    apply(l, r) {
      if (disposed) return;
      const changed = l !== left || r !== right;
      for (const work of targets) {
        for (const object of work.objects.keys()) {
          object.geometry = work.geometry;
          object.frustumCulled = false;
        }
        if (!changed) continue;
        for (let side = 0; side < 2; side++) {
          const { indices, curve } = work.sides[side];
          const value = side ? r : l;
          const offset = curve ? value * work.distance * curve[value < 0 ? 0 : 1] : 0;
          for (const i of indices) work.position.setY(i, work.base.getY(i) + offset);
        }
        work.position.needsUpdate = true;
      }
      left = l;
      right = r;
    },
    restore() {
      for (const work of targets) for (const [object, culled] of work.objects) {
        object.geometry = work.source;
        object.frustumCulled = culled;
      }
    },
    dispose() {
      this.restore();
      for (const work of targets) work.geometry.dispose();
      targets.length = 0;
      disposed = true;
    },
  };
}
