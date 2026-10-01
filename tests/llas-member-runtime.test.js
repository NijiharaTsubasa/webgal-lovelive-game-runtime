import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";

import LlasMemberRuntime from "../packages/llas_runtime/shaders/member.js";
import { LlasTransparentRuntime } from "../packages/llas_runtime/shaders/transparent.js";

test("Navi outline captures screen resolution at initialization", () => {
  let width = 800;
  let height = 600;
  const renderer = {
    getDrawingBufferSize(target) { return target.set(width, height); },
  };
  const runtime = new LlasMemberRuntime(THREE, renderer, null, {});
  runtime.hasOutline = true;

  width = 1200;
  height = 900;
  runtime.onBeforeRender(renderer);

  assert.deepEqual(runtime.uniforms.uRenderTextureResolution.value.toArray(), [800, 600, 0, 0]);
  assert.deepEqual(runtime.uniforms.uScreenParams.value.toArray(),
    [1200, 900, 1 + 1 / 1200, 1 + 1 / 900]);
});

test("portrait runtime rejects live-only Emissive instead of supplying a guessed Beat", () => {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("_shader_color", new THREE.Float32BufferAttribute([1, 1, 1, 1], 4));
  const mesh = new THREE.Mesh(geometry);
  const material = new THREE.MeshStandardMaterial();
  const runtime = new LlasMemberRuntime(THREE, null, material, mesh);

  assert.throws(() => runtime.createPass("Main", material, mesh, {
    extras: { keywords: ["_EMISSIVE_ON"] },
  }), /_EMISSIVE_ON.*does not implement/);
  assert.equal(runtime.getUniforms().uBeat, undefined);
});

test("transparent vertex-color variant reads the shader-only color attribute", () => {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("_shader_color", new THREE.Float32BufferAttribute([1, 1, 1, 1], 4));
  const mesh = new THREE.Mesh(geometry);
  const material = new THREE.MeshStandardMaterial();
  material.userData.shaderParams = { VertexColor: 1 };

  new LlasTransparentRuntime(THREE, null, material, mesh).init();
  assert.equal(material.vertexColors, false);

  geometry.deleteAttribute("_shader_color");
  assert.throws(() => new LlasTransparentRuntime(THREE, null, material, mesh).init(), /_SHADER_COLOR/);
});
