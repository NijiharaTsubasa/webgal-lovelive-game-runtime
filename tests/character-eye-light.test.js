import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import * as THREE from "three";
import CharacterEyeRuntime from "../packages/hasunosora_runtime/shaders/character-eye.js";

const shader = await readFile(
  new URL("../packages/hasunosora_runtime/shaders/character-eye.glsl", import.meta.url),
  "utf8",
);

test("CharacterEye Forward sums the compiled per-object light attenuation before its ambient floor", () => {
  assert.match(shader, /uAdditionalLightPosition\[ i \]\.xyz -\s*vMelpotEyeWorldPos \* uAdditionalLightPosition\[ i \]\.w/);
  assert.match(shader, /max\( dot\( lightVector, lightVector \), 6\.10351562e-05 \)/);
  assert.match(shader, /max\( 1\.0 - rangeTerm \* rangeTerm, 0\.0 \)/);
  assert.match(shader, /rangeAttenuation \* rangeAttenuation \/ distanceSquared/);
  assert.match(shader, /spotAttenuation \*= spotAttenuation/);
  assert.match(shader, /melpotEyeLight \+= melpotEyeAdditionalLights\(\)/);
});

test("CharacterEye binds current-scene point and spot lights into the compiled Unity inputs", () => {
  const scene = new THREE.Scene();
  const key = new THREE.DirectionalLight(0xffffff, 2);
  const ambient = new THREE.AmbientLight(0x202020, 0.5);
  const point = new THREE.PointLight(0x8080ff, 3, 10);
  point.position.set(1, 2, 3);
  const spot = new THREE.SpotLight(0xff8080, 1, 20, Math.PI / 6, 0.2);
  spot.position.set(3, 4, 5);
  spot.target.position.set(0, 1, 0);
  scene.add(key, key.target, ambient, point, spot, spot.target);
  scene.updateMatrixWorld(true);

  const pass = new CharacterEyeRuntime(THREE, null, null, new THREE.Mesh());
  pass.onBeforeRender(null, scene);
  const inputs = pass.getUniforms();
  assert.equal(inputs.uSceneLightColor.value.r, 2);
  assert.equal(inputs.uAdditionalLightCount.value, 2);
  assert.deepEqual(inputs.uAdditionalLightPosition.value[0].toArray(), [1, 2, 3, 1]);
  assert.equal(inputs.uAdditionalLightAttenuation.value[0].x, 0.01);
  assert.deepEqual(inputs.uAdditionalLightAttenuation.value[0].toArray().slice(2), [0, 1]);
  assert.deepEqual(inputs.uAdditionalLightPosition.value[1].toArray(), [3, 4, 5, 1]);
  assert.ok(inputs.uAdditionalLightAttenuation.value[1].z > 0);
  assert.ok(inputs.uAdditionalLightSpotDir.value[1].length() > 0);
  point.distance = 0;
  pass.onBeforeRender(null, scene);
  assert.equal(inputs.uAdditionalLightAttenuation.value[0].x, 0);
});

test("CharacterEye keeps the compiled eight selected-light indices and owns alpha clipping", () => {
  assert.match(shader, /for \( int i = 0; i < 8; \+\+i \)/);
  const mesh = new THREE.Mesh(new THREE.BoxGeometry());
  const pass = new CharacterEyeRuntime(THREE, null, null, mesh);
  const material = new THREE.MeshStandardMaterial({ alphaTest: 0.5 });
  pass.createPass("Forward", material, mesh, { shaderParams: {
    MainTex_ST: [1, 1, 0, 0], MainColor: [1, 1, 1, 1], AlphaClipThreshold: 0.5,
  } }, { MainTex: new THREE.Texture() });
  assert.equal(material.alphaTest, 0);
  const scene = new THREE.Scene();
  scene.add(new THREE.DirectionalLight());
  for (let i = 0; i < 9; i++) scene.add(new THREE.PointLight(0xffffff, 1, 5));
  pass.onBeforeRender(null, scene);
  assert.equal(pass.getUniforms().uAdditionalLightCount.value, 8);
  pass.destroy();
  material.dispose();
});

