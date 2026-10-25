import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import * as THREE from 'three';
import { createMeteorBounds } from '../packages/garupa_runtime/render-profiles/meteor-bounds.js';

const fixture = JSON.parse(fs.readFileSync(new URL('./fixtures/meteor-bounds-native.json', import.meta.url), 'utf8'));
const tolerance = 2e-6; // model units, includes original float32/native-vs-JS TRS rounding.
const identity = () => new THREE.Matrix4().toArray();
const clone = value => structuredClone(value);
function anchorsFor(row) {
  return new Map(Object.entries(row.anchors).map(([key, matrix]) => [key, {
    node: { matrixWorld: new THREE.Matrix4().fromArray(matrix) }, localMatrix: new THREE.Matrix4(),
  }]));
}
function closeVector(actual, expected, label) {
  actual.toArray().forEach((value, axis) => assert.ok(Math.abs(value - expected[axis]) <= tolerance,
    `${label} axis ${axis}: ${value} vs ${expected[axis]} (absolute limit ${tolerance})`));
}
function simple(dynamic = true) {
  const metadata = { rendererId: 'test', updateWhenOffscreen: dynamic,
    root: { node: 'root', bindMatrix: identity() },
    localBounds: { center: [.12, -.23, .34], extents: [.7, .2, .4] },
    bones: [{ node: 'bone', bindMatrix: identity(), center: [.2, .3, .4], extents: [.1, .2, .3] }],
  };
  const anchors = new Map(['root', 'bone'].map(key => [key, { node: { matrixWorld: new THREE.Matrix4() }, localMatrix: new THREE.Matrix4() }]));
  return { metadata, anchors };
}

test('source bone boxes reproduce selected native135 reads within explicit numeric tolerance', () => {
  assert.equal(fixture.provenance.nativeRows, 135);
  assert.equal(fixture.provenance.graphicsDeviceType, 'Null');
  assert.equal(fixture.cases.length, 9);
  let maximumError = 0;
  for (const row of fixture.cases) {
    const result = createMeteorBounds(THREE, row.metadata, anchorsFor(row)).update();
    closeVector(result.center, row.expected.center, `${row.role}/${row.name}/${row.pose} center`);
    closeVector(result.extents, row.expected.extents, `${row.role}/${row.name}/${row.pose} extents`);
    for (const key of ['center', 'extents']) result[key].toArray().forEach((value, axis) => {
      maximumError = Math.max(maximumError, Math.abs(value - row.expected[key][axis]));
    });
  }
  console.log(`meteor bounds:9 native cases maximum absolute error=${maximumError}; limit=${tolerance}`);
});

test('bind compensation composes node world * local binding * bindMatrix for root and bones', () => {
  const row = clone(fixture.cases.find(item => item.pose === 'root_rotation_nonuniform_scale'));
  const anchors = anchorsFor(row);
  const compensation = new THREE.Matrix4().compose(new THREE.Vector3(.37, -.19, .23),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(.21, -.33, .17)), new THREE.Vector3(.8, 1.2, .9));
  const inverse = compensation.clone().invert();
  const local = new THREE.Matrix4().makeRotationY(.43).setPosition(.17, -.09, .37);
  for (const anchor of anchors.values()) {
    anchor.node.matrixWorld.multiply(inverse).multiply(local.clone().invert());
    anchor.localMatrix.copy(local);
  }
  row.metadata.root.bindMatrix = compensation.toArray();
  for (const bone of row.metadata.bones) bone.bindMatrix = compensation.toArray();
  const result = createMeteorBounds(THREE, row.metadata, anchors).update();
  closeVector(result.center, row.expected.center, 'compensated center');
  closeVector(result.extents, row.expected.extents, 'compensated extents');
});

test('update reuses returned vectors and follows current pose without vertex access', () => {
  const { metadata, anchors } = simple();
  const provider = createMeteorBounds(THREE, metadata, anchors);
  const first = provider.update(), center = first.center, extents = first.extents;
  anchors.get('bone').node.matrixWorld.makeTranslation(.137, .021, -.053);
  const next = provider.update();
  assert.strictEqual(next, first); assert.strictEqual(next.center, center); assert.strictEqual(next.extents, extents);
  closeVector(next.center, [.337, .321, .347], 'moved bone');
  closeVector(next.extents, [.1, .2, .3], 'moved extents');
});

test('disabled update retains saved localBounds while its root transform still changes world bounds', () => {
  const { metadata, anchors } = simple(false);
  const provider = createMeteorBounds(THREE, metadata, anchors);
  const first = provider.update();
  closeVector(first.center, metadata.localBounds.center, 'saved center');
  anchors.get('bone').node.matrixWorld.makeTranslation(10, 20, 30);
  closeVector(provider.update().center, metadata.localBounds.center, 'bone ignored');
  anchors.get('root').node.matrixWorld.makeScale(2, 3, .5).setPosition(.5, -.2, .7);
  const moved = provider.update();
  closeVector(moved.center, [.74, -.89, .87], 'root transformed saved center');
  closeVector(moved.extents, [1.4, .6, .2], 'root transformed saved extents');
});

test('missing anchors, empty boxes and malformed source data fail explicitly', () => {
  {
    const { metadata, anchors } = simple(); anchors.delete('bone');
    assert.throws(() => createMeteorBounds(THREE, metadata, anchors), /missing bone 0 anchor/);
  }
  {
    const { metadata, anchors } = simple(); anchors.delete('root');
    assert.throws(() => createMeteorBounds(THREE, metadata, anchors), /missing root anchor/);
  }
  {
    const { metadata, anchors } = simple(); anchors.get('bone').localMatrix = undefined;
    assert.throws(() => createMeteorBounds(THREE, metadata, anchors), /invalid affine matrix/);
  }
  for (const mutate of [
    m => { m.bones = []; }, m => { m.bones[0].extents[0] = -1; },
    m => { m.root.bindMatrix[3] = .1; }, m => { m.root.bindMatrix[0] = 0; },
    m => { m.bones[0].bindMatrix[0] = NaN; }, m => { m.localBounds.center = [0, 0]; },
    m => { m.updateWhenOffscreen = 1; },
  ]) {
    const { metadata, anchors } = simple(); mutate(metadata);
    assert.throws(() => createMeteorBounds(THREE, metadata, anchors), /meteor bounds:/);
  }
});

test('current singular or nonfinite anchor matrices fail instead of returning a fallback center', () => {
  const { metadata, anchors } = simple(); const provider = createMeteorBounds(THREE, metadata, anchors);
  anchors.get('bone').node.matrixWorld.elements[12] = Infinity;
  assert.throws(() => provider.update(), /invalid affine matrix/);
  anchors.get('bone').node.matrixWorld.identity(); anchors.get('root').node.matrixWorld.makeScale(0, 1, 1);
  assert.throws(() => provider.update(), /invalid affine matrix/);
});


test('native infinity sentinel is explicit empty:true, keeps source indices, and contributes no zero box', () => {
  assert.equal(fixture.emptyBoxProvenance.nativeRows, 15);
  assert.equal(fixture.emptyBoxProvenance.graphicsDeviceType, 'Null');
  assert.deepEqual(fixture.emptyBoxProvenance.source.boxes[0].minBits, ['7f800000', '7f800000', '7f800000']);
  assert.deepEqual(fixture.emptyBoxProvenance.source.boxes[0].maxBits, ['ff800000', 'ff800000', 'ff800000']);
  let maximumError = 0;
  for (const row of fixture.emptyBoxCases) {
    const bones = row.metadata.bones;
    assert.equal(bones.length, 4); assert.equal(bones[0].empty, true);
    assert.ok(!('center' in bones[0]) && !('extents' in bones[0]));
    assert.deepEqual(bones.map(b => b.sourceIndex), [0, 1, 2, 3]);
    assert.deepEqual(bones.map(b => b.sourceBoneName), ['Neck', 'Head', 'UTeeth', 'LTeeth']);
    const anchors = anchorsFor(row);
    const result = createMeteorBounds(THREE, row.metadata, anchors).update();
    closeVector(result.center, row.expected.center, `${row.pose} empty center`);
    closeVector(result.extents, row.expected.extents, `${row.pose} empty extents`);
    for (const key of ['center', 'extents']) result[key].toArray().forEach((value, axis) => {
      maximumError = Math.max(maximumError, Math.abs(value - row.expected[key][axis]));
    });
    // An explicit empty entry never becomes a fabricated zero-size point.
    const before = result.center.clone();
    anchors.get(bones[0].node).node.matrixWorld.makeTranslation(100, 200, 300);
    const after = createMeteorBounds(THREE, row.metadata, anchors).update();
    closeVector(after.center, before.toArray(), 'empty-only anchor does not contribute');
  }
  const baseline = fixture.emptyBoxCases.find(r => r.pose === 'baseline');
  const held = fixture.emptyBoxCases.find(r => r.pose === 'empty_root_translation_weighted_world_fixed');
  closeVector(new THREE.Vector3().fromArray(held.expected.center), baseline.expected.center,
    'native empty-root translation with weighted world pose fixed');
  console.log(`meteor bounds:5 empty-sentinel native cases maximum absolute error=${maximumError}; limit=${tolerance}`);
});

test('firstN source boxes retain their original bone indices when renderer has additional trailing bones', () => {
  assert.equal(fixture.trailingBoneProvenance.nativeRows, 18);
  assert.equal(fixture.trailingBoneProvenance.graphicsDeviceType, 'Null');
  assert.equal(fixture.trailingBoneCases.length, 6);
  let maximumError = 0;
  for (const row of fixture.trailingBoneCases) {
    assert.ok(row.sourceBoneCount > row.sourceBoxCount);
    assert.equal(row.metadata.bones.length, row.sourceBoxCount);
    assert.deepEqual(row.metadata.bones.map(b => b.sourceIndex),
      Array.from({ length: row.sourceBoxCount }, (_, i) => i));
    const result = createMeteorBounds(THREE, row.metadata, anchorsFor(row)).update();
    closeVector(result.center, row.expected.center, `${row.name}/${row.pose} firstN center`);
    closeVector(result.extents, row.expected.extents, `${row.name}/${row.pose} firstN extents`);
    for (const key of ['center', 'extents']) result[key].toArray().forEach((value, axis) => {
      maximumError = Math.max(maximumError, Math.abs(value - row.expected[key][axis]));
    });
  }
  console.log(`meteor bounds:6 trailing-bone native cases maximum absolute error=${maximumError}; limit=${tolerance}`);
});

test('malformed empty flag or all-empty bounds cannot silently become a fallback zero box', () => {
  const { metadata, anchors } = simple();
  metadata.bones[0] = { node: 'bone', bindMatrix: identity(), empty: true };
  assert.throws(() => createMeteorBounds(THREE, metadata, anchors), /no nonempty source bone boxes/);
  metadata.bones[0].empty = 'true';
  assert.throws(() => createMeteorBounds(THREE, metadata, anchors), /invalid bone 0 empty flag/);
});


test('sourceObjectMatrix reuses the compensated native root frame, independent of bounds updates', () => {
  const row = clone(fixture.cases.find(item => item.pose === 'root_rotation_nonuniform_scale'));
  const anchors = anchorsFor(row);
  const expected = new THREE.Matrix4().fromArray(row.anchors[row.metadata.root.node]);
  const compensation = new THREE.Matrix4().makeRotationX(.31).setPosition(.21, -.13, .07);
  anchors.get(row.metadata.root.node).node.matrixWorld.multiply(compensation.clone().invert());
  anchors.get(row.metadata.root.node).localMatrix.copy(compensation);
  const provider = createMeteorBounds(THREE, row.metadata, anchors);
  const first = provider.update(), matrix = first.sourceObjectMatrix;
  assert.ok(matrix?.isMatrix4);
  matrix.elements.forEach((value, index) => assert.ok(Math.abs(value - expected.elements[index]) < 1e-12));
  const shift = new THREE.Matrix4().makeTranslation(.123, -.217, .043);
  anchors.get(row.metadata.root.node).node.matrixWorld.premultiply(shift);
  const second = provider.update();
  assert.strictEqual(second.sourceObjectMatrix, matrix);
  expected.premultiply(shift);
  matrix.elements.forEach((value, index) => assert.ok(Math.abs(value - expected.elements[index]) < 1e-12));
  const staticSource = simple(false);
  staticSource.anchors.get('root').node.matrixWorld.makeTranslation(.37, -.19, .23);
  const staticFrame = createMeteorBounds(THREE, staticSource.metadata, staticSource.anchors).update();
  assert.deepEqual(staticFrame.sourceObjectMatrix.elements, staticSource.anchors.get('root').node.matrixWorld.elements);
});


test('sourceObjectMatrix matches actual native root readbacks in the empty and trailing fixtures', () => {
  for (const row of [...fixture.emptyBoxCases, ...fixture.trailingBoneCases]) {
    const provider = createMeteorBounds(THREE, row.metadata, anchorsFor(row));
    const result = provider.update();
    const expectedNativeRoot = row.anchors[row.metadata.root.node];
    result.sourceObjectMatrix.elements.forEach((value, index) =>
      assert.ok(Math.abs(value - expectedNativeRoot[index]) < 1e-12,
        `${row.name}/${row.pose} native root element ${index}`));
    assert.strictEqual(provider.update().sourceObjectMatrix, result.sourceObjectMatrix);
  }
});
