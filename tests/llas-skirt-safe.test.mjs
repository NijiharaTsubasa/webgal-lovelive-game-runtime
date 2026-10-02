import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import SkirtSafe, { inverseLerp } from '../packages/llas_runtime/behaviors/skirt-safe.js';

function fixture(reflect = false) {
  const root = new THREE.Group();
  const node = new THREE.Object3D();
  const child = new THREE.Object3D();
  const knee = new THREE.Object3D();
  node.name = 'skirt'; child.name = 'tip'; root.name = 'parent'; knee.name = 'leg';
  root.add(node, knee); node.add(child);
  child.position.set(reflect ? 1 : -1, 0, -.1);
  const map = new Map([[root.name, root], [node.name, node], [child.name, child], [knee.name, knee]]);
  const definition = {node: 'skirt', child: 'tip', parent: 'parent',
    parentFrame: new THREE.Matrix4().makeScale(reflect ? -1 : 1, 1, 1).toArray(),
    axis: [reflect ? 1 : -1, 0, 0], length: 1, knees: [0],
    dotMin: -1, dotMax: 0, rotationDegrees: 0, kneeSpaceOffset: .2};
  const behavior = new SkirtSafe({THREE, resolveNode: (_, name) => map.get(name)}, [{parameters: {
    managers: [{knees: [{node: 'leg', right: [Math.sqrt(.75), 0, -.5]}], bones: [definition]}],
  }}]);
  behavior.Awake();
  return {root, node, child, knee, definition, behavior};
}

test('SafeCorrect uses native non-endpoint ratio, replaces negative X, and writes child world position', () => {
  for (const reflect of [false, true]) {
    const f = fixture(reflect), original = f.child.position.clone();
    f.behavior.PostPhysics();
    const target = new THREE.Vector3(reflect ? 1 : -1, 0, .1).normalize();
    assert.ok(f.child.getWorldPosition(new THREE.Vector3()).distanceTo(target) < 1e-12);
    const direction = new THREE.Vector3(...f.definition.axis).applyQuaternion(f.node.quaternion);
    assert.ok(direction.distanceTo(target) < 1e-12);
    f.behavior.Update();
    assert.ok(f.child.position.equals(original));
    f.behavior.OnDisable(); f.behavior.OnDestroy();
  }
});

test('SafeCorrect multiplies Y rotation on the right of source frame under rotated/scaled placement', () => {
  const f = fixture(true);
  f.root.rotation.set(.2, -.4, .1); f.root.scale.setScalar(2); f.root.position.set(3, 4, -2);
  f.definition.rotationDegrees = 20;
  // Source ratio=.5 gives Y rotation=10deg. Compute in source coordinates.
  const angle = 10 * Math.PI / 180, c = Math.cos(angle), s = Math.sin(angle);
  const sourceZ = -s + -.1 * c;
  assert.ok(sourceZ < .1);
  const p = new THREE.Vector3(-1, 0, .1).normalize();
  const rotated = new THREE.Vector3(c * p.x + s * p.z, 0, -s * p.x + c * p.z);
  rotated.x *= -1;
  f.root.updateMatrixWorld(true);
  const expected = rotated.applyMatrix4(f.root.matrixWorld);
  f.behavior.PostPhysics();
  assert.ok(f.child.getWorldPosition(new THREE.Vector3()).distanceTo(expected) < 1e-10);
});

test('SafeCorrect leaves sufficiently lifted tips unchanged; equal/reversed dot bounds follow native InverseLerp', () => {
  assert.equal(inverseLerp(1, 1, -10), 0);
  assert.equal(inverseLerp(0, -1, -.25), .25);
  assert.equal(inverseLerp(-1, 0, -2), 0);
  assert.equal(inverseLerp(-1, 0, 1), 1);
  const f = fixture(); f.child.position.z = .3;
  const before = f.child.position.clone(), rotation = f.node.quaternion.clone();
  f.behavior.PostPhysics();
  assert.ok(f.child.position.equals(before)); assert.ok(f.node.quaternion.equals(rotation));
  assert.equal(f.behavior.managers[0].bones[0].written, false);
});
