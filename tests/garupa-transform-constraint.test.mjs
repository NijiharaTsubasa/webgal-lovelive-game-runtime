import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as THREE from "three";
import TransformConstraint, { solveRotation, solveTranslation, solveParentRotation } from "../packages/garupa_runtime/behaviors/transform-constraint.js";

const native = JSON.parse(fs.readFileSync(new URL("./fixtures/rotation-constraint-native.json", import.meta.url)));
const quaternion = degrees => new THREE.Quaternion().setFromEuler(
  new THREE.Euler(...degrees.map(v => v * Math.PI / 180), "YXZ"),
);
const reflected = q => new THREE.Quaternion(q.x, -q.y, -q.z, q.w);
const close = (a, b, tolerance = 3e-6) => assert.ok(
  a.clone().normalize().angleTo(b.clone().normalize()) < tolerance,
  `quaternion mismatch ${a.toArray()} versus ${b.toArray()}`,
);

test("runtime registers the auxiliary solver after AvatarScaler initialization", () => {
  const config = JSON.parse(fs.readFileSync(new URL("../packages/garupa_runtime/config.json", import.meta.url)));
  const definition = name => config.components.find(c => c.type === "behavior" && c.namespace === "Garupa" && c.name === name);
  assert.equal(definition("TransformConstraint").script, "behaviors/transform-constraint.js");
  assert.ok(definition("TransformConstraint").executionOrder > definition("AvatarScaler").executionOrder);
});

test("native Unity vectors: ordered sources, weights, rest, offset and all axis masks over four solves", () => {
  for (const sample of native) {
    const rule = { ...sample, rotationAtRest: sample.rest, rotationOffset: sample.offset,
      axes: [1, 2, 4].map(axis => Boolean(sample.axes & axis)) };
    const sources = sample.sources.filter(s => s.euler.length && s.weight !== 0)
      .map(s => ({ weight: s.weight, rotation: quaternion(s.euler) }));
    let current = quaternion(sample.initial);
    for (let i = 0; i < 4; i++) current = solveRotation(THREE, rule, sources, quaternion(sample.parent), current);
    close(current, new THREE.Quaternion().fromArray(sample.expected));
  }
});

test("partial axes reproduce native SmartEuler branches over consecutive frames", () => {
  const data = JSON.parse(fs.readFileSync(new URL("./fixtures/transform-constraint-partial-native.json", import.meta.url)));
  for (const sample of data.cases) {
    const c = sample.input;
    const rule = { ...c, rotationAtRest: c.rest, rotationOffset: c.offset,
      axes: [1, 2, 4].map(axis => Boolean(c.axes & axis)) };
    const sources = c.sources.map(s => ({ weight: s.weight, rotation: quaternion(s.euler) }));
    let current = quaternion(c.initial);
    for (const step of sample.localSteps) {
      current = solveRotation(THREE, rule, sources, quaternion(c.parent), current, c.hint ?? [0, 0, 0]);
      close(current, new THREE.Quaternion().fromArray(step));
    }
  }
});

function fixture(basis = new THREE.Matrix4()) {
  const root = new THREE.Group();
  const parent = new THREE.Bone(); parent.name = "Parent";
  const target = new THREE.Bone(); target.name = "Target";
  const sourceA = new THREE.Bone(); sourceA.name = "SourceA";
  const sourceB = new THREE.Bone(); sourceB.name = "SourceB";
  root.add(parent, sourceA, sourceB); parent.add(target);
  const nodes = [parent, target, sourceA, sourceB];
  const parameters = {
    frames: nodes.map((node, i) => ({ node: node.name, parent: i === 1 ? 0 : null,
      basis: (i === 1 ? basis : new THREE.Matrix4()).toArray() })),
    constraints: [{ type: "rotation", target: 1, sources: [{ frame: 2, weight: 0.2 }, { frame: 3, weight: 0.7 }],
      weight: 1, rotationAtRest: [13, 27, -51], rotationOffset: [11, -19, 23],
      axes: [true, true, true], enabled: true, active: true }],
  };
  const driver = new TransformConstraint({ THREE, root,
    resolveNode: (role, name) => { assert.equal(role, "body"); return root.getObjectByName(name); } },
  [{ role: "body", parameters }]);
  parent.quaternion.copy(reflected(quaternion([23, -41, 17])));
  sourceA.quaternion.copy(reflected(quaternion([10, 30, -80])));
  sourceB.quaternion.copy(reflected(quaternion([-90, 40, 120])));
  target.quaternion.copy(reflected(quaternion([-29, 37, 61])));
  target.position.set(0.01, 0.02, 0.03);
  root.position.set(2, -3, 1);
  root.quaternion.copy(quaternion([17, 31, -23]));
  root.scale.setScalar(1.7);
  driver.Awake();
  return { root, parent, target, sourceA, sourceB, driver, parameters };
}

test("actual Behavior writes normalized source frame and preserves translation/scale", () => {
  const sample = native.find(s => s.name === "weights[0.2, 0.7]");
  for (const basis of [new THREE.Matrix4(), new THREE.Matrix4().makeRotationFromQuaternion(quaternion([19, 37, 61]))]) {
    const f = fixture(basis);
    const position = f.target.position.clone(), scale = f.target.scale.clone();
    f.driver.LateUpdate();
    const expected = reflected(new THREE.Quaternion().fromArray(sample.expected));
    const offset = new THREE.Quaternion().setFromRotationMatrix(basis).invert();
    close(f.target.quaternion, expected.multiply(offset));
    assert.deepEqual(f.target.position.toArray(), position.toArray());
    assert.deepEqual(f.target.scale.toArray(), scale.toArray());
  }
});

test("absolute solving stays stable and native disable/removal keeps the last transform", () => {
  const f = fixture();
  const initial = f.target.quaternion.clone();
  f.driver.LateUpdate(); const first = f.target.quaternion.clone();
  for (let i = 0; i < 30; i++) {
    if (i % 2) f.driver.Update();
    f.driver.LateUpdate(); close(f.target.quaternion, first);
  }
  f.driver.Update(); close(f.target.quaternion, first);
  const motion = quaternion([61, 19, 37]);
  f.target.quaternion.copy(motion); f.driver.LateUpdate(); f.driver.OnDisable();
  close(f.target.quaternion, first);
  f.driver.LateUpdate(); f.target.quaternion.copy(initial); f.driver.OnDestroy();
  close(f.target.quaternion, initial);
});

test("native Parent/Position offsets, scales, source weights, global weights and axes", () => {
  const fixtures = JSON.parse(fs.readFileSync(new URL("./fixtures/transform-constraint-native.json", import.meta.url)));
  const vector = value => new THREE.Vector3().fromArray(value);
  for (const { input: c, expected } of fixtures) {
    const rule = { ...c, axes: [1, 2, 4].map(axis => Boolean(c.translationAxes & axis)),
      translationAxes: [1, 2, 4].map(axis => Boolean(c.translationAxes & axis)),
      rotationAxes: [1, 2, 4].map(axis => Boolean(c.rotationAxes & axis)),
      translationOffsets: c.sources.map(s => s.translationOffset), rotationOffsets: c.sources.map(s => s.rotationOffset) };
    const inverseParent = new THREE.Matrix4().compose(vector(c.parent.position), quaternion(c.parent.rotation), vector(c.parent.scale)).invert();
    const sources = c.sources.map((s, index) => ({ index, weight: s.weight,
      position: vector(s.pose.position), rotation: quaternion(s.pose.rotation) })).filter(s => s.weight !== 0);
    let position = vector(c.target.position), rotation = quaternion(c.target.rotation);
    for (let i = 0; i < 4; i++) {
      position = solveTranslation(THREE, rule, sources, inverseParent, position);
      if (c.type === "parent") rotation = solveParentRotation(THREE, rule, sources, quaternion(c.parent.rotation), rotation, [0, 0, 0]);
    }
    assert.ok(position.distanceTo(vector(expected.position)) < 3e-6, `${c.name}: ${position.toArray()} vs ${expected.position}`);
    close(rotation, new THREE.Quaternion().fromArray(expected.rotation), 3e-5);
  }
});

test("Parent/Position Behavior writes source-coordinate results through a transformed host root", () => {
  const fixtures = JSON.parse(fs.readFileSync(new URL("./fixtures/transform-constraint-native.json", import.meta.url)));
  for (const { input: c, expected } of fixtures) {
    const root = new THREE.Group();
    root.position.set(2, -1, 3); root.quaternion.copy(quaternion([19, 27, -51])); root.scale.set(1.2, .7, 1.1);
    const node = (name, pose) => {
      const result = new THREE.Bone(); result.name = name;
      result.position.fromArray(pose.position); result.position.x *= -1;
      result.quaternion.copy(reflected(quaternion(pose.rotation))); result.scale.fromArray(pose.scale);
      return result;
    };
    const parent = node("Parent", c.parent), target = node("Target", c.target);
    const sources = c.sources.map((s, i) => node(`Source${i}`, s.pose));
    root.add(parent, ...sources); parent.add(target);
    const nodes = [parent, target, ...sources];
    const parameters = {
      frames: nodes.map((n, i) => ({ node: n.name, parent: i === 1 ? 0 : null, basis: new THREE.Matrix4().toArray() })),
      constraints: [{ type: c.type, target: 1, sources: c.sources.map((s, i) => ({frame: i + 2, weight: s.weight})),
        weight: c.weight, enabled: true, active: true,
        axes: [1,2,4].map(bit=>Boolean(c.translationAxes & bit)),
        translationAxes: [1,2,4].map(bit=>Boolean(c.translationAxes & bit)),
        rotationAxes: [1,2,4].map(bit=>Boolean(c.rotationAxes & bit)),
        translationAtRest: c.translationAtRest, rotationAtRest: c.rotationAtRest,
        translationOffset: c.translationOffset, translationOffsets: c.sources.map(s=>s.translationOffset),
        rotationOffsets: c.sources.map(s=>s.rotationOffset) }],
    };
    const driver = new TransformConstraint({THREE, root, resolveNode: (_, name)=>root.getObjectByName(name)}, [{role:"body",parameters}]);
    driver.Awake();
    for(let i=0;i<4;i++){driver.Update();driver.LateUpdate();}
    const expectedPosition = new THREE.Vector3().fromArray(expected.position); expectedPosition.x *= -1;
    assert.ok(target.position.distanceTo(expectedPosition)<3e-6, `${c.name}: position`);
    close(target.quaternion, reflected(new THREE.Quaternion().fromArray(expected.rotation)), 3e-5);
  }
});

test("disabled/inactive constraints preserve animation and source changes are consumed every frame", () => {
  for (const property of ["enabled", "active"]) {
    const f = fixture(); f.parameters.constraints[0][property] = false;
    const before = f.target.quaternion.clone(); f.driver.LateUpdate(); close(f.target.quaternion, before);
  }
  const f = fixture(); f.driver.LateUpdate(); const before = f.target.quaternion.clone();
  f.sourceA.quaternion.copy(quaternion([80, 10, -90]));
  f.driver.Update(); f.driver.LateUpdate(); assert.ok(f.target.quaternion.angleTo(before) > 0.1);
});

test("logical world rotations do not acquire nonuniform-parent-scale shear", () => {
  const f = fixture();
  const intermediary = new THREE.Bone(); intermediary.name = "Scaled";
  f.root.add(intermediary); intermediary.quaternion.copy(quaternion([19, 37, 61]));
  intermediary.scale.set(1.3, 0.7, 0.9); intermediary.add(f.sourceA);
  // Include the source parent in the exported seam, as the converter does.
  f.parameters.frames.push({ node: "Scaled", parent: null, basis: new THREE.Matrix4().toArray() });
  f.parameters.frames[2].parent = 4;
  const driver = new TransformConstraint({ THREE, root: f.root, resolveNode: (_, name) => f.root.getObjectByName(name) },
    [{ role: "body", parameters: f.parameters }]);
  driver.Awake(); driver.LateUpdate(); const actual = f.target.quaternion.clone();
  driver.Update(); intermediary.scale.set(1, 1, 1); driver.LateUpdate();
  close(f.target.quaternion, actual);
});

test("small invertible source scales remain valid coordinate frames", () => {
  const f = fixture(new THREE.Matrix4().makeScale(1e-13, 2, 3));
  f.driver.LateUpdate();
  const expected = native.find(s => s.name === "weights[0.2, 0.7]");
  close(f.target.quaternion, reflected(new THREE.Quaternion().fromArray(expected.expected)));
});
