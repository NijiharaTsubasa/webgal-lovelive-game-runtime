// Pure CPU test reference extracted from the diagnostic tool; arithmetic preserved.
import * as THREE from 'three';

export function patchLodFragment(fragment) {
  const calls = /\btexture\(\s*(u_(?:MainTex_with_sampler_MainTex|BaseMap_with_sampler_BaseMap))\s*,/g;
  let count = 0;
  let output = fragment.replace(calls, (_, sampler) => { count++; return `meteorProbeSample(${sampler},`; });
  if (!count) throw new Error('LOD probe: no original MainTex/BaseMap implicit sampling call');
  const helper = `
uniform float meteorProbeTextureId;
float meteorProbeLambda;
float meteorProbeBias;
bool meteorProbeSampled;
void meteorProbeRecord(sampler2D source, vec2 uv, float bias) {
  vec2 size = vec2(textureSize(source, 0));
  float rho = max(length(dFdx(uv) * size), length(dFdy(uv) * size));
  meteorProbeLambda = log2(max(rho, 1e-20)) + bias;
  meteorProbeBias = bias;
  meteorProbeSampled = true;
}
vec4 meteorProbeSample(sampler2D source, vec2 uv) {
  meteorProbeRecord(source, uv, 0.0); return texture(source, uv);
}
vec4 meteorProbeSample(sampler2D source, vec2 uv, float bias) {
  meteorProbeRecord(source, uv, bias); return texture(source, uv, bias);
}
`;
  output = helper + output;
  const main = /void\s+main\s*\(\s*\)\s*\{/;
  if (!main.test(output)) throw new Error('LOD probe: fragment main missing');
  output = output.replace(main, match => `${match}\nmeteorProbeSampled=false; meteorProbeLambda=0.0; meteorProbeBias=0.0;`);
  const end = output.lastIndexOf('}');
  output = output.slice(0, end) + `
if (!meteorProbeSampled) discard;
gl_FragColor=vec4(meteorProbeLambda, meteorProbeTextureId, 1.0, meteorProbeBias);
` + output.slice(end);
  return { source: output, wrappedCalls: count };
}

/** CPU geometry coverage check; separate from visible fragment/readback counts. */
export function boundsCoverage(minimum, maximum, camera) {
  const box = new THREE.Box3(new THREE.Vector3().fromArray(minimum), new THREE.Vector3().fromArray(maximum));
  const matrix = new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  const frustum = new THREE.Frustum().setFromProjectionMatrix(matrix, camera.coordinateSystem);
  let allCornersInside = true, crossesCameraPlane = false;
  const ndcMin = [Infinity, Infinity, Infinity], ndcMax = [-Infinity, -Infinity, -Infinity];
  for (let index = 0; index < 8; index++) {
    const point = new THREE.Vector4(index & 1 ? box.max.x : box.min.x,
      index & 2 ? box.max.y : box.min.y, index & 4 ? box.max.z : box.min.z, 1).applyMatrix4(matrix);
    const inside = point.w > 0 && Math.abs(point.x) <= point.w && Math.abs(point.y) <= point.w && Math.abs(point.z) <= point.w;
    allCornersInside &&= inside;
    if (point.w <= 0) { crossesCameraPlane = true; continue; }
    [point.x, point.y, point.z].forEach((value, axis) => {
      const projected = value / point.w;
      ndcMin[axis] = Math.min(ndcMin[axis], projected); ndcMax[axis] = Math.max(ndcMax[axis], projected);
    });
  }
  return { intersectsFrustum: frustum.intersectsBox(box), allCornersInside, crossesCameraPlane,
    ndcMin: ndcMin.every(Number.isFinite) ? ndcMin : null,
    ndcMax: ndcMax.every(Number.isFinite) ? ndcMax : null };
}

export function assertFrozenTimes(actors, seconds) {
  if (!Number.isFinite(seconds) || !actors.length || actors.some(actor => !Number.isFinite(actor.elapsedTime)
      || Math.abs(actor.elapsedTime - seconds) > 1e-8)) throw new Error('LOD probe requires fixed native motion time from awaited freezeAt');
}

