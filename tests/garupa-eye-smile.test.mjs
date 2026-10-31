import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {calibrateOpenSmile} from '../packages/garupa_runtime/adapters/garupa-eye-smile.js';

function fixture(smileY) {
  const geometry = new THREE.BufferGeometry(), object = {};
  geometry.morphAttributes.position = [
    new THREE.Float32BufferAttribute([0, -1, 0], 3),
    new THREE.Float32BufferAttribute([0, smileY, 0], 3),
    new THREE.Float32BufferAttribute([0, -1, 0], 3),
  ];
  return {bindings: [0,1,2].map(index => ({object,geometry,index})),
    smile: Float64Array.from([0,1,0]), close: Float64Array.from([1,0,0]), wink: Float64Array.from([0,0,1])};
}

test('a saturated weak opening smile retains its native shape and gains a small closed-smile contribution', () => {
  const f=fixture(.02), result=calibrateOpenSmile(f.smile,f.close,f.wink,f.bindings);
  assert.equal(result[1],1);
  assert.ok(result[2]>.08 && result[2]<.09);
  const displacement=.02-result[2];
  assert.ok(displacement<0 && Math.abs(Math.abs(displacement)-.06624160640756349)<1e-8);
  assert.deepEqual([...f.smile],[0,1,0]);
  for(const open of [0,.2,.5,.92,1]) {
    const winkWeight=1-open+open*result[2];
    assert.ok(winkWeight>=0 && winkWeight<=1);
  }
});

test('strong, already-closing and unsaturated smiles keep their calibrated vectors', () => {
  for(const y of [.2,-.02]) {
    const f=fixture(y);
    assert.equal(calibrateOpenSmile(f.smile,f.close,f.wink,f.bindings),f.smile);
  }
  const f=fixture(.02);f.smile[1]=.5;
  assert.equal(calibrateOpenSmile(f.smile,f.close,f.wink,f.bindings),f.smile);
});

test('missing blink or closed-smile capability does not invent a facial control', () => {
  const f=fixture(.02), zero=new Float64Array(3);
  assert.equal(calibrateOpenSmile(f.smile,zero,f.wink,f.bindings),f.smile);
  assert.equal(calibrateOpenSmile(f.smile,f.close,zero,f.bindings),f.smile);
});
