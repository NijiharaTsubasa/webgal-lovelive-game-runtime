import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { assertFrozenTimes, boundsCoverage, patchLodFragment }
  from './helpers/meteor-lod-reference.mjs';

function camera() {
  const value = new THREE.PerspectiveCamera(35, 1920 / 1080, .01, 100);
  value.position.set(0, 0, 5); value.lookAt(0, 0, 0);
  value.updateProjectionMatrix(); value.updateMatrixWorld(true);
  return value;
}

test('fixed native time allows accumulated60step rounding but rejects an advancing or missing pose', () => {
  assert.doesNotThrow(() => assertFrozenTimes([{ elapsedTime: 1.0000000000000013 }], 1));
  assert.throws(() => assertFrozenTimes([{ elapsedTime: 1.01 }], 1), /fixed native motion time/);
  assert.throws(() => assertFrozenTimes([], 1), /fixed native motion time/);
  assert.throws(() => assertFrozenTimes([{ elapsedTime: NaN }], 1), /fixed native motion time/);
  assert.throws(() => assertFrozenTimes([{ elapsedTime: 1 }], NaN), /fixed native motion time/);
});

test('source bounds distinguish full fit, partial horizontal crop, outside and camera-plane crossing', () => {
  const view = camera();
  const full = boundsCoverage([-.5, -.5, -.5], [.5, .5, .5], view);
  assert.equal(full.intersectsFrustum, true); assert.equal(full.allCornersInside, true);
  const partial = boundsCoverage([-10, -.2, 0], [10, .2, 0], view);
  assert.equal(partial.intersectsFrustum, true); assert.equal(partial.allCornersInside, false);
  const outside = boundsCoverage([100, -.1, 0], [101, .1, .2], view);
  assert.equal(outside.intersectsFrustum, false); assert.equal(outside.allCornersInside, false);
  const crossing = boundsCoverage([-1, -1, 4], [1, 1, 6], view);
  assert.equal(crossing.crossesCameraPlane, true); assert.equal(crossing.allCornersInside, false);
  assert.ok(!JSON.stringify(crossing).includes('Infinity'));
  const behind = boundsCoverage([-1, -1, 6], [1, 1, 7], view);
  assert.equal(behind.intersectsFrustum, false);
  assert.equal(behind.crossesCameraPlane, true);
  assert.equal(behind.ndcMin, null); assert.equal(behind.ndcMax, null);
});

test('fragment instrumentation keeps the actual ST-and-flip sampler argument and original discard', () => {
  const fragment = 'void main(){vec4 v=texture(u_MainTex_with_sampler_MainTex,meteor_materialUv(meteor_input.TEXCOORD0.xy));if(v.a<.2)discard;gl_FragColor=v;}';
  const patched = patchLodFragment(fragment);
  assert.equal(patched.wrappedCalls, 1);
  assert.ok(patched.source.includes('meteorProbeSample(u_MainTex_with_sampler_MainTex,meteor_materialUv(meteor_input.TEXCOORD0.xy))'));
  assert.ok(patched.source.includes('if(v.a<.2)discard;'));
  assert.throws(() => patchLodFragment('void main(){}'), /no original.*sampling call/);
  assert.throws(() => patchLodFragment('texture(u_MainTex_with_sampler_MainTex,uv);'), /main missing/);
  const biased = patchLodFragment('void main(){vec4 v=texture(u_MainTex_with_sampler_MainTex,meteor_materialUv(uv),-.371);gl_FragColor=v;}');
  assert.ok(biased.source.includes('meteorProbeSample(u_MainTex_with_sampler_MainTex,meteor_materialUv(uv),-.371)'));
  assert.ok(biased.source.includes('return texture(source, uv, bias)'));
});
