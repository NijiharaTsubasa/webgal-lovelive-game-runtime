import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { browDepthConstraint } from '../packages/llas_runtime/adapters/llas-face-geometry.js';
import { LlasLive2dFace } from '../packages/llas_runtime/adapters/llas-live2d-face.js';
import { browDepthConstraint as originalDepth, applyCompanionsAndGaze as originalGaze } from './fixtures/llas-face-before-cache.mjs';

function fixture() {
  const geometry = new THREE.BufferGeometry();
  const points = [.3,.2,.3, .9,.2,.3, .3,.8,.3, -.3,.2,.3, -.9,.2,.3, -.3,.8,.3];
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  geometry.setIndex([0,1,2,3,4,5]); geometry.morphTargetsRelative = true;
  geometry.morphAttributes.position = Array.from({length:4}, (_, channel) => new THREE.Float32BufferAttribute(
    points.map((_, i) => channel === 3 ? Math.sin(i * 2.1) * .2 : i % 3 === channel ? .3 + Math.floor(i / 3) * .02 : 0), 3));
  const eye = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
  const faceGeometry = new THREE.BufferGeometry();
  faceGeometry.setAttribute('position', new THREE.Float32BufferAttribute([-2,-2,0, 2,-2,.1, -2,2,.12, 2,2,-.1],3));
  faceGeometry.setIndex([0,1,2,1,3,2]);
  const face = new THREE.Mesh(faceGeometry, new THREE.MeshBasicMaterial());
  const regions = {L:{brow:[1,1,1,0,0,0]},R:{brow:[0,0,0,1,1,1]}};
  const args = [eye, face, regions, new Float32Array(points.length), THREE];
  return {eye, fast:browDepthConstraint(...args), original:originalDepth(...args)};
}
function randomGenerator() {
  let seed = 0x68202;
  return () => { seed = (Math.imul(seed,1664525) + 1013904223) >>> 0; return seed / 2**32; };
}
function floorsDuring(fn) {
  let count = 0;
  const original = Math.floor;
  try { Math.floor = value => { count++; return original(value); }; fn(); }
  finally { Math.floor = original; }
  return count;
}

test('brow cache matches frozen original exactly across random native and derived Morph mixtures', () => {
  const f = fixture(), random = randomGenerator();
  for (let frame = 0; frame < 250; frame++) {
    if (frame % 3 !== 0) f.eye.morphTargetInfluences = Array.from({length:4}, () => random() * 2 - 1);
    for (const side of frame % 2 ? ['L','R'] : ['R','L']) {
      assert.equal(f.fast(side), f.original(side), `frame ${frame}/${side}`);
      assert.equal(f.fast(side), f.original(side), `cached frame ${frame}/${side}`);
    }
  }
});

test('brow query skips identical vertices but invalidates direct base and target edits without version updates', () => {
  const f = fixture();
  assert.ok(floorsDuring(() => f.fast('L')) > 0);
  assert.equal(floorsDuring(() => assert.equal(f.fast('L'), 0)), 0);
  assert.ok(floorsDuring(() => f.fast('R')) > 0, 'right side has its own cache');
  f.eye.morphTargetInfluences[2] = -1;
  assert.ok(floorsDuring(() => f.fast('L')) > 0);
  assert.equal(f.fast('L'), f.original('L'));
  const base = f.eye.geometry.attributes.position;
  base.setZ(0, base.getZ(0) - .1);
  assert.ok(floorsDuring(() => f.fast('L')) > 0);
  assert.equal(f.fast('L'), f.original('L'));
  const target = f.eye.geometry.morphAttributes.position[2];
  target.setZ(0, target.getZ(0) + .13);
  assert.ok(floorsDuring(() => f.fast('L')) > 0);
  assert.equal(f.fast('L'), f.original('L'));
  f.eye.geometry.morphAttributes.position[2] = target.clone();
  f.eye.geometry.morphAttributes.position[2].setZ(1, -.17);
  assert.ok(floorsDuring(() => f.fast('L')) > 0);
  assert.equal(f.fast('L'), f.original('L'));
});

test('brow cache stays instance-local and follows return to an earlier pose', () => {
  const a = fixture(), b = fixture();
  a.eye.morphTargetInfluences[2] = -1;
  const aShift = a.fast('L');
  assert.ok(aShift > 0);
  assert.ok(floorsDuring(() => b.fast('L')) > 0);
  assert.equal(b.fast('L'), b.original('L'));
  a.eye.morphTargetInfluences.fill(0);
  assert.equal(a.fast('L'), a.original('L'));
  a.eye.morphTargetInfluences[2] = -1;
  assert.equal(a.fast('L'), aShift);
  assert.equal(a.fast('R'), a.original('R'));
});

function gazeFixture() {
  const root = new THREE.Group(); root.position.set(.2,-.1,.3); root.rotation.set(.2,.3,-.1); root.scale.set(1.2,.8,1.1);
  const eyeBones = {L:new THREE.Group(),R:new THREE.Group()}; root.add(...Object.values(eyeBones));
  const mesh = new THREE.SkinnedMesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial()); root.add(mesh);
  const bindings = Object.entries(eyeBones).map(([side,object]) => ({object, node:side === 'L' ? 'LeftEye2' : 'RightEye2',
    property:'position', default:[.02,0,.03], poses:[{name:'eye/Open',value:[.02,0,.03]},
      {name:'eye/Close',value:[.02,.1,.03]}, {name:'eye/CloseSmile',value:[.02,.15,.03]}, {name:'eye/WideOpen',value:[.02,-.1,.03]}]}));
  const driver = {root,bindings,eyeBones,eyeDistance:.8,
    gazeBasis:{L:new THREE.Matrix4().makeRotationZ(.12),R:new THREE.Matrix4().makeRotationZ(-.13)},
    irisPivots:{L:new THREE.Vector3(.01,.02,.03),R:new THREE.Vector3(-.01,.02,.03)},
    eyeSpace:new THREE.Matrix4(),localShift:new THREE.Vector3(),origin:new THREE.Vector3()};
  return {driver,mesh};
}
test('gaze local calculations need only their final world refresh and match the frozen method exactly', () => {
  const random = randomGenerator();
  for (let i = 0; i < 100; i++) {
    const a = gazeFixture(), b = gazeFixture();
    const controls = {eyes:{L:{open:random()*1.5,smile:random()},R:{open:random()*1.5,smile:random()}},
      gaze:{x:random()-.5,y:random()-.5,scale:.5+random()}};
    let refreshes = 0;
    const update = a.driver.root.updateMatrixWorld;
    a.driver.root.updateMatrixWorld = function(...args) { refreshes++; return update.apply(this,args); };
    LlasLive2dFace.prototype.applyCompanionsAndGaze.call(a.driver,controls);
    originalGaze.call(b.driver,controls);
    for (const side of ['L','R']) {
      const first = a.driver.eyeBones[side], second = b.driver.eyeBones[side];
      assert.deepEqual(first.position.toArray(),second.position.toArray());
      assert.deepEqual(first.scale.toArray(),second.scale.toArray());
      assert.deepEqual(first.matrixWorld.toArray(),second.matrixWorld.toArray());
    }
    assert.deepEqual(a.mesh.bindMatrixInverse.toArray(),b.mesh.bindMatrixInverse.toArray());
    assert.equal(refreshes,1);
  }
});
