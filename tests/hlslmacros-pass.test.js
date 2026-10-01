import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import HlslMacrosRuntime from "../packages/hasunosora_runtime/shaders/melpot-toon-hlslmacros.js";

function fixture(sampleCount = 4) {
  const gl = { SAMPLES: 0x80a9, getParameter: () => sampleCount };
  const renderer = {
    capabilities: { isWebGL2: true },
    getRenderTarget: () => null,
    getContext: () => gl,
  };
  const scene = new THREE.Scene();
  const directional = new THREE.DirectionalLight(0xffffff, 2);
  directional.position.set(3, 5, 4);
  scene.add(directional);
  const ambient = new THREE.AmbientLight(0x202030, 0.5);
  scene.add(ambient);
  const camera = new THREE.PerspectiveCamera();
  const material = new THREE.MeshStandardMaterial();
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(), material);
  const runtime = new HlslMacrosRuntime(THREE, renderer, material, mesh);
  return { renderer, scene, directional, ambient, camera, material, mesh, runtime };
}

test("HLSLMacros current-scene uniforms use one directional plus ambient light", () => {
  const { renderer, scene, directional, ambient, camera, runtime } = fixture();
  runtime.init(renderer);
  runtime.onBeforeRender(renderer, scene, camera);
  const u = runtime.getUniforms();
  assert.deepEqual(u.uMainLightDirection.value.toArray(), new THREE.Vector3(3, 5, 4).normalize().toArray());
  assert.deepEqual(u.uMainLightColor.value.toArray(), directional.color.clone().multiplyScalar(2).toArray());
  assert.deepEqual(u.uUnitySHAmbientW.value.toArray(), ambient.color.clone().multiplyScalar(0.5).toArray());
  assert.equal(u.uGlobalMipBias.value, 0);
  assert.equal(u.uAlphaToMaskAvailable.value, 1);
});

test("HLSLMacros accepts an ambient-only scene", () => {
  const { renderer, scene, directional, camera, runtime } = fixture();
  scene.remove(directional);
  runtime.onBeforeRender(renderer, scene, camera);
  assert.deepEqual(runtime.getUniforms().uMainLightColor.value.toArray(), [0, 0, 0]);
});

test("HLSLMacros handles supported light and camera states", () => {
  const { renderer, scene, directional, camera, mesh, runtime } = fixture(0);
  runtime.init(renderer);
  runtime.onBeforeRender(renderer, scene, camera);
  assert.equal(runtime.getUniforms().uAlphaToMaskAvailable.value, 0);
  const point = new THREE.PointLight();
  scene.add(point);
  runtime.onBeforeRender(renderer, scene, camera);
  assert.equal(runtime.getUniforms().uAdditionalLightAttenuation.value[0].x, 0);
  point.distance = 4;
  runtime.onBeforeRender(renderer, scene, new THREE.OrthographicCamera());
  assert.equal(runtime.getUniforms().uOrthographicView.value, true);
  runtime.onBeforeRender(renderer, scene, camera);
  assert.equal(runtime.getUniforms().uOrthographicView.value, false);
  for (let i = 0; i < 8; i++) scene.add(new THREE.PointLight(0xffffff, 1, 5));
  runtime.onBeforeRender(renderer, scene, camera);
  assert.equal(runtime.getUniforms().uAdditionalLightCount.value, 8);
});

test("HLSLMacros maps source additional-light attenuation inputs for point and spot lights", () => {
  const { renderer, scene, camera, runtime } = fixture();
  const point = new THREE.PointLight(0xff8000, 2, 8);
  point.position.set(1, 2, 3);
  const spot = new THREE.SpotLight(0x00ff80, 3, 10, Math.PI / 4, 0.4);
  spot.position.set(-2, 5, 1);
  scene.add(point, spot);
  scene.updateMatrixWorld(true);
  runtime.init(renderer);
  runtime.onBeforeRender(renderer, scene, camera);
  const u = runtime.getUniforms();
  assert.equal(u.uAdditionalLightCount.value, 2);
  assert.deepEqual(u.uAdditionalLightPosition.value[0].toArray(), [1, 2, 3, 1]);
  assert.equal(u.uAdditionalLightAttenuation.value[0].x, 1 / 64);
  assert.deepEqual(u.uAdditionalLightColor.value[0].toArray(), [2 * point.color.r, 2 * point.color.g, 0, 1]);
  assert.deepEqual(u.uAdditionalLightPosition.value[1].toArray(), [-2, 5, 1, 1]);
  assert.equal(u.uAdditionalLightAttenuation.value[1].x, 1 / 100);
  assert.ok(u.uAdditionalLightAttenuation.value[1].z > 0);
  spot.penumbra = 0.0001;
  runtime.onBeforeRender(renderer, scene, camera);
  const outer = Math.cos(spot.angle);
  const inner = Math.cos(spot.angle * (1 - spot.penumbra));
  assert.ok(inner - outer < 0.001);
  assert.ok(Math.abs(u.uAdditionalLightAttenuation.value[1].z * (inner - outer) - 1) < 1e-12);
  spot.penumbra = 0;
  runtime.onBeforeRender(renderer, scene, camera);
  assert.equal(u.uAdditionalLightAttenuation.value[1].z, 1 / Number.EPSILON);
});

test("HLSLMacros A2C availability requires more than one framebuffer sample", () => {
  const { renderer, scene, camera, runtime } = fixture(1);
  runtime.init(renderer);
  runtime.onBeforeRender(renderer, scene, camera);
  assert.equal(runtime.getUniforms().uAlphaToMaskAvailable.value, 0);
});

test("HLSLMacros requires the source program's GLSL3 vertex texture fetch", () => {
  const { renderer, material, mesh } = fixture();
  renderer.capabilities.isWebGL2 = false;
  const runtime = new HlslMacrosRuntime(THREE, renderer, material, mesh);
  assert.throws(() => runtime.init(renderer), /WebGL2/);
});

test("HLSLMacros source ControlMap clip is not preceded by glTF MainTex alphaTest", () => {
  const { runtime, material, mesh } = fixture();
  const pass = { shaderParams: {
    MainTex_ST: [1, 1, 0, 0], Transparency: 1, AlphaClipThreshold: 0.5,
  } };
  const textures = { ControlMap1: new THREE.Texture() };
  material.alphaTest = 0.5;
  runtime.createPass("Forward", material, mesh, pass, textures);
  assert.equal(material.alphaTest, 0);
  const outline = material.clone();
  outline.alphaTest = 0.5;
  const outlineMesh = runtime.createPass("Outline", outline, mesh, pass, textures);
  assert.equal(outline.alphaTest, 0);
  assert.equal(outlineMesh.material, outline);
  runtime.destroy();
});

