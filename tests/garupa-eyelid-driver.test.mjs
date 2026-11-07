import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createEyelidDriver } from '../packages/garupa_runtime/adapters/garupa-eyelid-driver.js';

const profile = [[.1, .05], [.2, .08]];
function fixture() {
  const geometry = new THREE.BufferGeometry();
  // Two crease pieces, one-sided backing vertices and an unrelated eyelash.
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    .1, 1, .2, .3, 1.01, .2, .2, 1.02, .2,
    -.4, 1, .2, -.1, 1.01, .2, -.2, 1.02, .2, 0, .8, .1,
  ], 3));
  geometry.userData.garupaEyelid = { left: [0, 1, 2], right: [3, 4, 5] };
  const close = new THREE.Float32BufferAttribute(new Float32Array(21), 3);
  close.setY(0, -.01);
  geometry.morphAttributes.position = [close];
  geometry.morphTargetsRelative = true;
  const root = new THREE.Group();
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
  const pass = mesh.clone();
  pass.userData.__parameterizedPassObject = true;
  root.add(mesh, pass);
  for (const [side, x] of [['L', .1], ['R', -.1]]) {
    const eye = new THREE.Bone();
    eye.name = `${side}Eye_0_0`;
    eye.position.x = x;
    root.add(eye);
  }
  const context = { THREE, root, resolveNode: (_, name) => root.getObjectByName(name) };
  return { root, geometry, mesh, pass, context }; 
}
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);

test('crease translation is side-specific and leaves the eyelash and native close Morph intact', () => {
  const f = fixture();
  const driver = createEyelidDriver(f.context, { role: 'head', root: f.root }, [], profile);
  driver.apply(-.5, .75);
  const moved = f.mesh.geometry.attributes.position;
  near(moved.getY(0), 1 - .5 * .2 * .1);
  near(moved.getY(3), 1 + .75 * .2 * .08);
  near(moved.getY(6), .8);
  near(f.geometry.attributes.position.getY(0), 1);
  near(f.mesh.geometry.morphAttributes.position[0].getY(0), -.01);
  assert.equal(f.pass.geometry, f.mesh.geometry);
  const version = moved.version;
  driver.restore();
  driver.apply(-.5, .75);
  assert.equal(moved.version, version, 'unchanged crease parameters reuse the computed positions');
  driver.apply(0, 0);
  near(moved.getY(0), 1);
  near(moved.getY(3), 1);
  driver.dispose();
});

test('restoring, reactivating and disposing affect only the owning instance', () => {
  const f = fixture();
  const other = new THREE.Mesh(f.geometry, new THREE.MeshBasicMaterial());
  const driver = createEyelidDriver(f.context, { role: 'head', root: f.root }, [], profile);
  driver.apply(-1, 1);
  const copy = f.mesh.geometry;
  let disposed = 0;
  copy.addEventListener('dispose', () => disposed++);
  assert.equal(other.geometry, f.geometry);
  driver.restore();
  assert.equal(f.mesh.geometry, f.geometry);
  assert.equal(f.pass.geometry, f.geometry);
  assert.equal(f.mesh.frustumCulled, true);
  driver.apply(-1, 1);
  assert.equal(f.mesh.geometry, copy);
  driver.dispose();
  assert.equal(f.mesh.geometry, f.geometry);
  assert.equal(disposed, 1);
  driver.dispose();
  assert.equal(disposed, 1);
});

test('a legal single-sided piece and a mesh with no crease annotation are supported', () => {
  const f = fixture();
  delete f.geometry.userData.garupaEyelid.right;
  const unmarked = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
  f.root.add(unmarked);
  const original = unmarked.geometry;
  const driver = createEyelidDriver(f.context, { role: 'head', root: f.root }, [], profile);
  driver.apply(-1, -1);
  near(f.mesh.geometry.attributes.position.getY(0), .98);
  near(f.mesh.geometry.attributes.position.getY(3), 1);
  assert.equal(unmarked.geometry, original);
  driver.dispose();
});

test('eye spacing stays in mesh coordinates when the actor root is transformed', () => {
  const f = fixture();
  f.root.scale.set(2, 3, 4);
  f.root.rotation.set(.2, .4, -.3);
  const driver = createEyelidDriver(f.context, { role: 'head', root: f.root }, [], profile);
  driver.apply(-1, 0);
  near(f.mesh.geometry.attributes.position.getY(0), .98);
  driver.dispose();
});

test('crease annotations cannot address a vertex outside their primitive position buffer', () => {
  for (const indices of [[-1], [.5], [7]]) {
    const f = fixture();
    f.geometry.userData.garupaEyelid.left = indices;
    assert.throws(() => createEyelidDriver(f.context, { role: 'head', root: f.root }, [], profile), /vertex indices/);
  }
});
