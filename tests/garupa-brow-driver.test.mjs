import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createBrowDriver } from '../packages/garupa_runtime/adapters/garupa-brow-driver.js';
import {
  FACE_PARAMETERS,
  PARAMETER_INDEX,
} from '../packages/garupa_runtime/adapters/garupa-face-controls.js';
function fixture(source) {
  const geometry = source ?? new THREE.BufferGeometry();
  if (!source) {
    const p = [],
      indices = [];
    for (const sign of [1, -1]) {
      const start = p.length / 3;
      for (const [x, y] of [
        [0.02, 0.1],
        [0.02, 0.102],
        [0.05, 0.11],
        [0.05, 0.112],
        [0.08, 0.1],
        [0.08, 0.102],
      ])
        p.push(x * sign, y, 0.001);
      for (const i of [0, 2, 1, 1, 2, 3, 2, 4, 3, 3, 4, 5]) indices.push(start + i);
    }
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    geometry.morphTargetsRelative = true;
    geometry.morphAttributes.position = [new THREE.Float32BufferAttribute(new Float32Array(p.length), 3)];
  }
  const root = new THREE.Group(),
    mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
  root.add(mesh);
  mesh.morphTargetDictionary = { eyebrow_sad_L: 0 };
  mesh.morphTargetInfluences = [0.2];
  const pass = mesh.clone();
  root.add(pass);
  root.updateMatrixWorld(true);
  const bindings = [{ object: mesh, geometry, index: 0, name: 'eyebrow_sad_L', channel: { region: 'brow' } }];
  const driver = createBrowDriver({ THREE, root }, { root }, bindings);
  return { root, mesh, pass, source: geometry, driver };
}
const controls = (angle = 0, form = 0) =>
  Object.fromEntries(
    ['L', 'R'].flatMap((side) => [
      [`PARAM_BROW_${side}_ANGLE`, angle],
      [`PARAM_BROW_${side}_FORM`, form],
    ])
  );
function slope(f, side) {
  const p = f.mesh.geometry.attributes.position,
    ids = f.driver.targets[0].sides[side].indices;
  const left = ids.filter((i) => p.getX(i) < (side === 'L' ? 0.035 : -0.065)),
    right = ids.filter((i) => p.getX(i) > (side === 'L' ? 0.065 : -0.035));
  const mean = (list, axis) =>
    list.reduce((n, i) => n + (axis === 'x' ? p.getX(i) : p.getY(i)), 0) / list.length;
  return (mean(right, 'y') - mean(left, 'y')) / (mean(right, 'x') - mean(left, 'x'));
}
test('direct brow geometry is instance-private and every registered shader pass shares it', () => {
  const a = fixture(),
    b = fixture(a.source),
    before = [...a.source.attributes.position.array];
  a.driver.apply(controls(1, -1));
  assert.notEqual(a.mesh.geometry, a.source);
  assert.equal(a.mesh.geometry, a.pass.geometry);
  assert.equal(b.mesh.geometry, b.source);
  assert.deepEqual([...a.source.attributes.position.array], before);
  assert.deepEqual(a.mesh.morphTargetInfluences, [0.2]);
  const posed = [...a.mesh.geometry.attributes.position.array];
  a.driver.restore();
  assert.equal(a.mesh.geometry, a.source);
  a.driver.apply(controls(1, -1));
  assert.deepEqual([...a.mesh.geometry.attributes.position.array], posed);
  a.driver.dispose();
  assert.equal(a.mesh.geometry, a.source);
  assert.equal(a.pass.geometry, a.source);
  b.driver.dispose();
});
test('neutral returns exactly and negative FORM removes the native positive arch', () => {
  const f = fixture(),
    neutral = [...f.source.attributes.position.array];
  f.driver.apply(controls(0, -0.5));
  const work = f.driver.targets[0],
    p = work.position;
  for (const side of ['L', 'R']) {
    const ids = work.sides[side].indices;
    const ys = ids.map((i) => p.getY(i));
    assert.ok(ys.every(Number.isFinite));
  }
  // Both center points start above their ends; negative FORM must reverse that.
  assert.ok((p.getY(2) + p.getY(3)) / 2 < (p.getY(0) + p.getY(1) + p.getY(4) + p.getY(5)) / 4);
  f.driver.apply(controls());
  assert.deepEqual([...p.array], neutral);
  f.driver.dispose();
});
test('ANGLE has mirrored physical angry and worried directions', () => {
  const f = fixture();
  f.driver.apply(controls(-1));
  assert.ok(slope(f, 'L') > 0);
  assert.ok(slope(f, 'R') < 0);
  f.driver.apply(controls(1));
  assert.ok(slope(f, 'L') < 0);
  assert.ok(slope(f, 'R') > 0);
  f.driver.dispose();
});
test('typed controls, cached restores and non-finite updates preserve lifecycle boundaries', () => {
  const f = fixture(),
    values = Float64Array.from(FACE_PARAMETERS, (entry) => entry[1]);
  values[PARAMETER_INDEX.PARAM_BROW_L_FORM] = -1;
  f.driver.apply(values);
  const before = [...f.mesh.geometry.attributes.position.array];
  const updates = f.driver.stats.updates;
  f.driver.restore();
  f.driver.apply(values);
  assert.equal(f.driver.stats.updates, updates);
  assert.deepEqual([...f.mesh.geometry.attributes.position.array], before);
  assert.throws(() => f.driver.apply({ PARAM_BROW_R_FORM: NaN }), /Non-finite/);
  assert.deepEqual([...f.mesh.geometry.attributes.position.array], before);
  f.driver.dispose();
});
test('static heads without brow bindings use a harmless empty driver', () => {
  const root = new THREE.Group(),
    driver = createBrowDriver({ THREE, root }, { root }, []);
  driver.apply({});
  driver.restore();
  driver.dispose();
  assert.equal(driver.targets.length, 0);
});

test('single-sided zero-width legal geometry remains finite without requiring a second eyebrow', () => {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3));
  geometry.setIndex([0, 0, 0]);
  geometry.morphTargetsRelative = true;
  geometry.morphAttributes.position = [new THREE.Float32BufferAttribute([0, 0.001, 0], 3)];
  const root = new THREE.Group(),
    mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
  mesh.morphTargetInfluences = [0];
  root.add(mesh);
  root.updateMatrixWorld(true);
  const driver = createBrowDriver({ THREE, root }, { root }, [
    { object: mesh, geometry, index: 0, name: 'eyebrow_sad_L', channel: { region: 'brow' } },
  ]);
  driver.apply({ PARAM_BROW_L_X: 1, PARAM_BROW_L_Y: -1, PARAM_BROW_L_ANGLE: 1, PARAM_BROW_L_FORM: -3 });
  assert.ok([...mesh.geometry.attributes.position.array].every(Number.isFinite));
  driver.dispose();
  assert.equal(mesh.geometry, geometry);
});
test('skin depth refresh follows a changing skin Morph while preserving eye and mouth ownership', () => {
  const f = fixture();
  f.driver.dispose();
  const geometry = new THREE.PlaneGeometry(0.5, 0.5);
  geometry.morphTargetsRelative = true;
  geometry.morphAttributes.position = [
    new THREE.Float32BufferAttribute(
      Array.from({ length: geometry.attributes.position.count }, () => [0, 0, 0.002]).flat(),
      3
    ),
  ];
  const skin = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
  skin.position.y = 0.1;
  skin.morphTargetInfluences = [0];
  f.root.add(skin);
  f.root.updateMatrixWorld(true);
  const driver = createBrowDriver({ THREE, root: f.root }, { root: f.root }, [
    { object: f.mesh, geometry: f.source, index: 0, name: 'eyebrow_sad_L', channel: { region: 'brow' } },
    { object: skin, geometry, index: 0, name: 'face_main_eye_close_L', channel: { region: 'eye' } },
  ]);
  const parameters = controls(0, -1);
  driver.apply(parameters);
  const before = driver.targets[0].position.getZ(2);
  skin.morphTargetInfluences[0] = 1;
  driver.apply(parameters);
  assert.ok(driver.targets[0].position.getZ(2) > before + 0.0019);
  assert.equal(skin.geometry, geometry);
  assert.deepEqual(skin.morphTargetInfluences, [1]);
  driver.dispose();
});
