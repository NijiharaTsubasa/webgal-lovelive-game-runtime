import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import TransformConstraint from "../packages/garupa_runtime/behaviors/transform-constraint.js";
import AvatarScaler from "../packages/garupa_runtime/behaviors/avatar-scaler.js";
import { composeHumanoidHeadBody } from "webgal-lovelive-gltf-renderer/skeleton-composer.js";
import { indexNodesByName } from "webgal-lovelive-gltf-renderer/model-behaviors.js";

const rotation = (x, y, z) => new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z, "YXZ"));
const close = (actual, expected) => assert.ok(actual.clone().normalize().angleTo(expected.clone().normalize()) < 2e-6,
  `rotation mismatch: ${actual.toArray()} vs ${expected.toArray()}`);
const matrixQuaternion = matrix => {
  const result = new THREE.Quaternion();
  matrix.decompose(new THREE.Vector3(), result, new THREE.Vector3());
  return result.normalize();
};

function rig(prefix, hipRotation, headRotation) {
  const root = new THREE.Group(); root.name = prefix;
  const hips = new THREE.Bone(); hips.name = "Hips"; hips.position.set(0.1, 0.7, -0.03); hips.quaternion.copy(hipRotation);
  const head = new THREE.Bone(); head.name = "Head"; head.position.set(0.03, 0.6, 0.02); head.quaternion.copy(headRotation);
  root.add(hips); hips.add(head);
  return { root, hips, head };
}

function fixture(isolated = false) {
  const body = rig("Body", rotation(0.08, -0.17, 0.13), rotation(0.12, 0.15, -0.2));
  const head = rig("HeadPart", rotation(-0.12, 0.19, -0.09), rotation(-0.13, 0.28, 0.26));
  const auxiliary = new THREE.Bone(); auxiliary.name = "HeadAuxiliary";
  auxiliary.position.set(0.02, 0.03, 0.01); auxiliary.quaternion.copy(rotation(0.16, 0.11, -0.09));
  head.head.add(auxiliary);
  const parts = [
    { role: "head", root: head.root, nodesByName: indexNodesByName(head.root) },
    { role: "body", root: body.root, nodesByName: indexNodesByName(body.root) },
  ];
  const composition = composeHumanoidHeadBody(body.root, head.root);
  parts[0].nodeBindings = composition.nodeBindings;
  const savedBindings = new Map([...composition.nodeBindings].map(([node, binding]) => [node, binding.localMatrix.toArray()]));
  let logicalHead = body.head;
  if (isolated) {
    const scaler = { context: { THREE, parts }, isolations: new WeakMap() };
    logicalHead = AvatarScaler.prototype.isolateBone.call(scaler, body.head);
    // The physical skinned bone may contain a nonuniform affine matrix;
    // descendants and animation use its unscaled logical wrapper instead.
    body.head.matrix.makeScale(1.4, 0.7, 1.1);
    body.head.matrixAutoUpdate = false;
    body.head.matrixWorldNeedsUpdate = true;
  }
  const headBasis = new THREE.Matrix4().makeRotationFromQuaternion(rotation(0.14, -0.11, 0.07));
  const targetBasis = new THREE.Matrix4().makeRotationFromQuaternion(rotation(-0.08, 0.12, 0.05));
  const parameters = {
    frames: [
      { node: "Hips", parent: null, basis: new THREE.Matrix4().toArray() },
      { node: "Head", parent: 0, basis: headBasis.toArray() },
      { node: "HeadAuxiliary", parent: 1, basis: targetBasis.toArray() },
    ],
    constraints: [{ type: "rotation", target: 2, sources: [{ frame: 1, weight: 1 }], weight: 1,
      rotationAtRest: [0, 0, 0], rotationOffset: [17, -23, 31],
      axes: [true, true, true], enabled: true, active: true }],
  };
  const driver = new TransformConstraint({ THREE, root: body.root, parts,
    resolveNode: (role, name) => {
      const matches = parts.find(part => part.role === role).nodesByName.get(name) || [];
      assert.equal(matches.length, 1); return matches[0];
    } }, [{ role: "head", parameters }]);
  driver.Awake();
  return { body, head, parts, auxiliary, logicalHead, driver, parameters, headBasis, targetBasis, savedBindings };
}

for (const isolated of [false, true]) {
  test(`head constraint follows composed body pose with asymmetric bind frames${isolated ? " and AvatarScaler isolation" : ""}`, () => {
    const f = fixture(isolated);
    assert.equal(f.head.hips.parent, null, "duplicate head core rig was removed");
    assert.equal(f.driver.groups[0].frames[1].node, f.logicalHead);
    const offset = rotation(17 * Math.PI / 180, -23 * Math.PI / 180, 31 * Math.PI / 180);
    // Unity-to-glTF reflection of the offset quaternion.
    offset.set(offset.x, -offset.y, -offset.z, offset.w);
    for (const pose of [rotation(0.25, -0.37, 0.18), rotation(-0.32, 0.19, -0.29)]) {
      f.logicalHead.quaternion.copy(pose);
      f.driver.Update(); f.driver.LateUpdate();
      f.body.root.updateMatrixWorld(true);
      const binding = f.parts[0].nodeBindings.get(f.head.head);
      const expectedWorld = f.logicalHead.matrixWorld.clone().multiply(binding.localMatrix).multiply(f.headBasis);
      const expected = matrixQuaternion(expectedWorld).multiply(offset).multiply(matrixQuaternion(f.targetBasis).invert());
      close(f.auxiliary.getWorldQuaternion(new THREE.Quaternion()), expected);
      for (const [node, values] of f.savedBindings) assert.deepEqual(f.parts[0].nodeBindings.get(node).localMatrix.toArray(), values,
        "frame resolution must not mutate shared composition bindings");
    }
  });
}

test("head binding never falls back to a scaled child when the logical index is ambiguous", () => {
  const f = fixture(true);
  f.parts[1].nodesByName.set("Head", [f.logicalHead, new THREE.Bone()]);
  const driver = new TransformConstraint(f.driver.context, [{ role: "head", parameters: f.parameters }]);
  assert.throws(() => driver.Awake(), /cannot resolve AvatarScaler logical binding/);
});
