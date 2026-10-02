// LLAS SwingBone.SafeCorrect (0x2CB3040), normal force=false path.
// Source Transform axes are supplied by the converter, including reflection.
export function inverseLerp(min, max, value) {
  return min === max ? 0 : Math.max(0, Math.min(1, (value - min) / (max - min)));
}

export function correctSkirtBone(THREE, record, kneeRights) {
  const { definition: d, node, parent, child, frame, work } = record;
  parent.updateWorldMatrix(true, false);
  work.matrix.multiplyMatrices(parent.matrixWorld, frame);
  work.forward.setFromMatrixColumn(work.matrix, 2).normalize();
  let minDot = 1;
  for (const knee of d.knees) minDot = Math.min(minDot, work.forward.dot(kneeRights[knee]));
  const ratio = 1 - inverseLerp(d.dotMin, d.dotMax, minDot);
  child.getWorldPosition(work.target);
  work.rotation.makeRotationY(d.rotationDegrees * ratio * Math.PI / 180);
  work.matrix.multiply(work.rotation);
  work.point.copy(work.target).applyMatrix4(work.inverse.copy(work.matrix).invert());
  const threshold = d.kneeSpaceOffset * ratio;
  if (work.point.z >= threshold) return false;
  work.point.z = threshold;
  work.point.x = -d.length;
  const magnitude = work.point.length();
  if (magnitude > 1e-5) work.point.multiplyScalar(d.length / magnitude);
  else work.point.set(0, 0, 0);
  work.target.copy(work.point).applyMatrix4(work.matrix);
  node.getWorldQuaternion(work.oldRotation);
  node.getWorldPosition(work.origin);
  work.from.fromArray(d.axis).normalize().applyQuaternion(work.oldRotation);
  work.to.subVectors(work.target, work.origin).normalize();
  work.correction.setFromUnitVectors(work.from, work.to);
  work.oldRotation.premultiply(work.correction);
  node.parent.getWorldQuaternion(work.parentRotation).invert();
  node.quaternion.copy(work.parentRotation).multiply(work.oldRotation);
  node.updateWorldMatrix(false, true);
  child.position.copy(child.parent.worldToLocal(work.target));
  child.updateWorldMatrix(false, true);
  return true;
}

function makeWork(THREE) {
  return {
    matrix: new THREE.Matrix4(), inverse: new THREE.Matrix4(), rotation: new THREE.Matrix4(),
    forward: new THREE.Vector3(), target: new THREE.Vector3(), point: new THREE.Vector3(),
    origin: new THREE.Vector3(), from: new THREE.Vector3(), to: new THREE.Vector3(),
    oldRotation: new THREE.Quaternion(), parentRotation: new THREE.Quaternion(),
    correction: new THREE.Quaternion(),
  };
}

export default class SkirtSafe {
  constructor(context, declarations) {
    this.context = context;
    this.parameters = declarations[0]?.parameters;
    this.managers = [];
  }

  Awake() {
    const { THREE } = this.context;
    const resolve = name => this.context.resolveNode('integrated', name);
    const finite = value => Number.isFinite(value);
    const vector = value => Array.isArray(value) && value.length === 3 && value.every(finite);
    if (!Array.isArray(this.parameters?.managers)) throw new Error('LLAS.SkirtSafe requires managers');
    for (const group of this.parameters.managers) {
      if (!Array.isArray(group.knees) || !Array.isArray(group.bones)) throw new Error('LLAS.SkirtSafe invalid manager');
      const knees = group.knees.map(knee => {
        if (!vector(knee.right)) throw new Error('LLAS.SkirtSafe invalid knee axis');
        return { node: resolve(knee.node), right: new THREE.Vector3().fromArray(knee.right), world: new THREE.Vector3() };
      });
      const bones = group.bones.map(definition => {
        const d = definition;
        if (!Array.isArray(d.parentFrame) || d.parentFrame.length !== 16 || !d.parentFrame.every(finite)
            || !vector(d.axis) || !finite(d.length) || d.length < 0
            || ![d.dotMin, d.dotMax, d.rotationDegrees, d.kneeSpaceOffset].every(finite)
            || !Array.isArray(d.knees) || !d.knees.every(i => Number.isInteger(i) && i >= 0 && i < knees.length)) {
          throw new Error('LLAS.SkirtSafe invalid bone parameters');
        }
        const frame = new THREE.Matrix4().fromArray(d.parentFrame);
        if (frame.determinant() === 0) throw new Error('LLAS.SkirtSafe singular source frame');
        return { definition, node: resolve(d.node), parent: resolve(d.parent), child: resolve(d.child), frame,
          work: makeWork(THREE), savedChildPosition: new THREE.Vector3(), written: false };
      });
      this.managers.push({ knees, bones });
    }
  }

  Update() {
    for (const manager of this.managers) for (const r of manager.bones) {
      if (!r.written) continue;
      r.child.position.copy(r.savedChildPosition);
      r.child.updateMatrix();
      r.written = false;
    }
  }

  PostPhysics() {
    const { THREE } = this.context;
    for (const manager of this.managers) {
      for (const knee of manager.knees) {
        knee.node.updateWorldMatrix(true, false);
        knee.world.copy(knee.right).transformDirection(knee.node.matrixWorld);
      }
      const rights = manager.knees.map(knee => knee.world);
      for (const record of manager.bones) {
        record.savedChildPosition.copy(record.child.position);
        record.written = correctSkirtBone(THREE, record, rights);
      }
    }
  }

  OnDisable() { this.Update(); }
  OnDestroy() { this.managers.length = 0; }
}
