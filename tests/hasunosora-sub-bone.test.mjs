import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import SubBoneController, { unityEuler, deltaAngle, unitySlerp, unityToAngleAxis, unityAngleAxis } from "../packages/hasunosora_runtime/behaviors/sub-bone.js";

const close = (a, b, tolerance = 1e-6) => assert.ok(Math.abs(a - b) <= tolerance, `${a} != ${b}`);
const unityQ = (axis, degrees) => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(...axis), degrees * Math.PI / 180);
const reflected = (q) => new THREE.Quaternion(q.x, -q.y, -q.z, q.w);
const identity = new THREE.Matrix4().toArray();

test("native Slerp uses normalized Lerp below the source angle threshold, including extrapolation", () => {
  const a = new THREE.Quaternion();
  for (const degrees of [17, 36, 37, 83]) {
    const b = unityQ([0, 0, 1], degrees);
    for (const t of [-.4, .23, 1.8]) {
      const expected = Math.cos(degrees * Math.PI / 360) >= Math.fround(.95)
        ? new THREE.Quaternion(0, 0, b.z * t, 1 + (b.w - 1) * t).normalize()
        : unityQ([0, 0, 1], degrees * t);
      close(unitySlerp(a, b, t).angleTo(expected), 0, 1e-7);
      const negative = b.clone().set(-b.x, -b.y, -b.z, -b.w);
      close(unitySlerp(a, negative, t).angleTo(expected), 0, 1e-7);
    }
  }
  assert.ok(unitySlerp(a, unityQ([0, 0, 1], 30), .23).angleTo(unityQ([0, 0, 1], 30 * .23)) > 1e-4);
});

test("native ToAngleAxis fallback and AngleAxis normalization use recovered thresholds", () => {
  const tiny = unityQ([0, 1, 0], .00001);
  assert.deepEqual(unityToAngleAxis(THREE, tiny).axis.toArray(), [1, 0, 0]);
  const small = unityQ([0, 1, 0], .001);
  close(unityToAngleAxis(THREE, small).axis.x, 0, 1e-8);
  close(unityToAngleAxis(THREE, small).axis.y, 1, 1e-5);
  assert.deepEqual(unityAngleAxis(THREE, 47, new THREE.Vector3(0, 1e-7, 0)).toArray(), [0, 0, 0, 1]);
  close(unityAngleAxis(THREE, 47, new THREE.Vector3(0, 8, 0)).angleTo(unityQ([0, 1, 0], 47)), 0, 1e-7);
});
function fixture(rules, transformRoot = false) {
  const root = new THREE.Group();
  if (transformRoot) {
    root.position.set(7, -2, 4);
    root.quaternion.copy(unityQ([0, 1, 0], 33));
    root.scale.setScalar(2);
  }
  const nodes = ["Parent", "Input", "Output", "Second"].map((name) => {
    const node = new THREE.Bone(); node.name = name; return node;
  });
  root.add(nodes[0]);
  for (const node of nodes.slice(1)) nodes[0].add(node);
  const parameters = {
    frames: nodes.map((node, index) => ({ node: node.name, parent: index ? 0 : null, basis: identity })),
    rules: rules.map((rule) => ({
      category: 1, input: 1, outputs: [2], magnification: 0.5,
      initialMainRotation: [0, 0, 0, 1], initialSubRotation: [0, 0, 0, 1],
      initialMainRight: [1, 0, 0], initialSubPosition: [0, 0, 0],
      inputAxis: 1, outputAxis: 3, minAngle: -90, maxAngle: 90, ...rule,
    })),
  };
  const driver = new SubBoneController({ THREE, root, resolveNode: (role, name) => {
    assert.equal(role, "integrated"); return root.getObjectByName(name);
  } }, [{ role: "integrated", parameters }]);
  driver.Awake();
  return { root, nodes, driver, parameters };
}

test("source Euler order 4, near-zero normalization, and exact signed 180 branch", () => {
  for (const [angle, sign] of [[179.999, 1], [180, 1], [180.001, -1], [-180, 1]]) {
    const result = deltaAngle(0, unityEuler(unityQ([0, 0, 1], angle))[2]);
    assert.equal(Math.sign(result), sign);
    close(Math.abs(result), Math.abs(angle) <= 180 ? Math.abs(angle) : 360 - angle, 2e-5);
  }
  assert.equal(deltaAngle(180, 0), 180);
  for (const euler of [[13, 27, -61], [89.8, 33, 47], [90, 15, -23], [-90, 15, -23]]) {
    const input = new THREE.Quaternion().setFromEuler(new THREE.Euler(...euler.map((v) => v * Math.PI / 180), "YXZ"));
    const output = new THREE.Quaternion().setFromEuler(new THREE.Euler(...unityEuler(input).map((v) => v * Math.PI / 180), "YXZ"));
    close(input.angleTo(output), 0, 1e-6);
  }
  const small = unityQ([0, 0, 1], 42);
  small.set(...small.toArray().map((v) => v * 1e-6));
  assert.deepEqual(unityEuler(small), [-0, 0, 0]);
});

test("Swing clamps interpolation and writes every output, preserving unrelated channels", () => {
  for (const m of [-0.2, 0.5, 2]) {
    const f = fixture([{ magnification: m, outputs: [2, 3] }], true);
    f.nodes[1].quaternion.copy(reflected(unityQ([0, 0, 1], 60)));
    f.nodes[2].position.set(0.04, 0.05, 0.06);
    f.driver.LateUpdate();
    for (const node of f.nodes.slice(2)) close(node.quaternion.angleTo(reflected(unityQ([0, 0, 1], Math.max(0, Math.min(1, m)) * 60))), 0);
    assert.deepEqual(f.nodes[2].position.toArray(), [0.04, 0.05, 0.06]);
    f.driver.Update();
    close(f.nodes[2].quaternion.angleTo(new THREE.Quaternion()), 0);
  }
});

test("Twist is unclamped and does not multiply initialSubRotation", () => {
  for (const m of [-0.5, 1.4]) {
    const f = fixture([{ category: 2, magnification: m, initialSubRotation: unityQ([0, 1, 0], 29).toArray() }]);
    f.nodes[1].quaternion.copy(reflected(unityQ([1, 0, 0], 70)));
    f.driver.LateUpdate();
    close(f.nodes[2].quaternion.angleTo(reflected(unityQ([1, 0, 0], 70 * m))), 0);
  }
});

test("Move evaluates nonendpoints, positive/negative intervals and None axis", () => {
  for (const [angle, minAngle, maxAngle, expected] of [[45, -90, 90, -0.0125], [180, -90, 90, -0.025], [-120, -90, 90, 0.025], [20, 10, 30, -0.05 * 10 / 180], [-20, -30, -10, 0.05 * 10 / 180]]) {
    const f = fixture([{ category: 7, magnification: -0.05, minAngle, maxAngle }]);
    f.nodes[1].quaternion.copy(reflected(unityQ([0, 0, 1], angle)));
    f.driver.LateUpdate();
    close(f.nodes[2].position.x, -expected, 1e-8);
  }
  const f = fixture([{ category: 7, outputAxis: 0, initialSubPosition: [0.1, 0.2, 0.3] }]);
  f.driver.LateUpdate();
  assert.deepEqual(f.nodes[2].position.toArray(), [-0.1, 0.2, 0.3]);
});

test("master order reads preceding output and repeat does not accumulate", () => {
  const f = fixture([{}, { category: 7, input: 2, outputs: [3], magnification: 0.05 }]);
  f.nodes[1].quaternion.copy(reflected(unityQ([0, 0, 1], 80)));
  for (let i = 0; i < 100; i++) {
    if (i % 2) f.driver.Update();
    f.driver.LateUpdate();
    close(f.nodes[3].position.x, -0.05 * 40 / 180, 1e-8);
  }
});

test("restore snapshots each frame and disable never overwrites subsequent animation", () => {
  const f = fixture([{}]);
  const input = reflected(unityQ([0, 0, 1], 48));
  f.nodes[1].quaternion.copy(input);
  f.driver.LateUpdate();
  f.driver.Update();
  const animated = reflected(unityQ([1, 0, 0], 17));
  f.nodes[2].quaternion.copy(animated);
  f.driver.LateUpdate();
  f.driver.Update();
  close(f.nodes[2].quaternion.angleTo(animated), 0);
  f.driver.LateUpdate();
  const newer = reflected(unityQ([0, 1, 0], 27));
  f.nodes[2].quaternion.copy(newer);
  f.driver.OnDisable();
  f.driver.OnDestroy();
  close(f.nodes[2].quaternion.angleTo(newer), 0);
  close(f.nodes[1].quaternion.angleTo(input), 0);
});

test("source-parent and nonidentity canonical basis bridge reads and writes source local rotation", () => {
  const f = fixture([{}], true);
  const basisQ = unityQ([0, 1, 0], 31);
  f.parameters.frames[1].basis = new THREE.Matrix4().makeRotationFromQuaternion(basisQ).toArray();
  f.parameters.frames[2].basis = new THREE.Matrix4().makeRotationFromQuaternion(basisQ).toArray();
  f.driver.Awake();
  f.nodes[1].quaternion.copy(reflected(unityQ([0, 0, 1], 46))).multiply(basisQ.clone().invert());
  f.driver.LateUpdate();
  close(f.nodes[2].quaternion.clone().multiply(basisQ).angleTo(reflected(unityQ([0, 0, 1], 23))), 0);
});

test("invalid category, frame, quaternion and unsupported part reject explicitly", () => {
  assert.throws(() => fixture([{ category: 8 }]), /category/);
  assert.throws(() => fixture([{ input: 999 }]), /frame/);
  assert.throws(() => fixture([{ initialMainRotation: [0, 0, 0, 0] }]), /zero quaternion/);
  assert.throws(() => new SubBoneController({}, [{ role: "body", parameters: {} }]), /integrated/);
  assert.throws(() => fixture([{ input: 2 }]), /cross-frame feedback/);
  assert.throws(() => fixture([{ input: 3 }, { outputs: [3] }]), /cross-frame feedback/);
  assert.throws(() => fixture([
    { category: 7, outputs: [2] }, { input: 2, outputs: [3] }, { outputs: [2] },
  ]), /cross-frame feedback/);
  const f = fixture([{}]);
  // Source parent differs from canonical parent: an output ancestor then
  // contributes to the reconstructed input local transform.
  f.nodes[2].add(f.nodes[1]);
  assert.throws(() => f.driver.Awake(), /cross-frame feedback/);
});
