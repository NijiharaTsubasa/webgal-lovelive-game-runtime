import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as THREE from "three";
import MelpotToonEyeRuntime from "../packages/hasunosora_runtime/shaders/melpot-toon-eye.js";

const shaderPath = new URL("../packages/hasunosora_runtime/shaders/melpot-toon-eye.glsl", import.meta.url);

test("Eye Forward keeps source highlight and alpha branches and a zero-light specialization", async () => {
  const source = await readFile(shaderPath, "utf8");
  assert.match(source, /texture2D\( uMainTex, melpotEyeMainUv, uUnityGlobalMipBias \)/);
  assert.match(source, /melpotEyeTemporalNoise\( uUnityTimeParameters\.z \)/);
  assert.match(source, /melpotEyeNoise\( uUnityTimeParameters\.yz \* vec2\( 5\.0, 10\.0 \) \)/);
  assert.match(source, /melpotEyeHighlights = uHighlightMainColor\.rgb \* melpotEyeMainHighlight \+/);
  assert.match(source, /max\( melpotEyeBase\.a, melpotEyeHighlightLuminance \)/);
  assert.match(source, /#ifdef MELPOT_EYE_ADDITIONAL_LIGHTS/);
  assert.match(source, /melpotEyeLightColor \+= melpotEyeAdditionalColor/);
});

test("Eye runtime maps current scene lights into the source Forward uniforms", () => {
  const scene = new THREE.Scene();
  const ambient = new THREE.AmbientLight(new THREE.Color(0.02, 0.025, 0.03), 1);
  const key = new THREE.DirectionalLight(0xffffff, 2);
  scene.add(ambient, key);
  const gl = { SAMPLES: 0x80A9, getParameter: () => 4 };
  const renderer = { getContext: () => gl, getRenderTarget: () => null };
  const runtime = new MelpotToonEyeRuntime(THREE, null, null);
  runtime.onBeforeRender(renderer, scene);
  assert.deepEqual(runtime.getUniforms().uUnityMainLightColor.value.toArray(), [2, 2, 2, 1]);
  assert.equal(runtime.getUniforms().uUnitySHAmbient.value.r, ambient.color.r);
  const time = runtime.getUniforms().uUnityTimeParameters.value;
  assert.ok(Math.abs(time.y - Math.sin(time.x)) < 1e-6);
  assert.ok(Math.abs(time.z - Math.cos(time.x)) < 1e-6);
  assert.equal(runtime.getUniforms().uUnityAlphaToMaskAvailable.value, 1);
  const queuedOpaque = new THREE.MeshStandardMaterial();
  queuedOpaque.transparent = true;
  queuedOpaque.blending = THREE.NoBlending;
  const queuedRuntime = new MelpotToonEyeRuntime(THREE, renderer, queuedOpaque);
  queuedRuntime.onBeforeRender(renderer, scene);
  assert.equal(queuedRuntime.getUniforms().uUnityAlphaToMaskAvailable.value, 1);
  queuedRuntime.destroy();
  queuedOpaque.dispose();
  renderer.getRenderTarget = () => ({ samples: 1 });
  runtime.onBeforeRender(renderer, scene);
  assert.equal(runtime.getUniforms().uUnityAlphaToMaskAvailable.value, 0);

  const point = new THREE.PointLight(0x804020, 3, 10);
  point.position.set(1, 2, 3);
  scene.add(point);
  runtime.onBeforeRender(renderer, scene);
  assert.equal(runtime.getUniforms().uUnityAdditionalLightsCount.value, 1);
  assert.deepEqual(runtime.getUniforms().uUnityAdditionalLightsPosition.value[0].toArray(), [1, 2, 3, 1]);
  assert.equal(runtime.getUniforms().uUnityAdditionalLightsAttenuation.value[0].x, 0.01);
  assert.equal(runtime.getUniforms().uUnityAdditionalLightsColor.value[0].x, point.color.r * 3);
  const spot = new THREE.SpotLight(0xffffff, 2, 12, Math.PI / 4, 0.25);
  spot.position.set(0, 4, 0);
  scene.add(spot);
  runtime.onBeforeRender(renderer, scene);
  assert.equal(runtime.getUniforms().uUnityAdditionalLightsCount.value, 2);
  assert.ok(runtime.getUniforms().uUnityAdditionalLightsAttenuation.value[1].z > 0);
  point.distance = 0;
  runtime.onBeforeRender(renderer, scene);
  assert.equal(runtime.getUniforms().uUnityAdditionalLightsAttenuation.value[0].x, 0);
  scene.remove(key);
  runtime.onBeforeRender(renderer, scene);
  assert.deepEqual(runtime.getUniforms().uUnityMainLightColor.value.toArray(), [0, 0, 0, 1]);
  runtime.destroy();
});
