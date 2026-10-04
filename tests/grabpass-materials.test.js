import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { GrabPass } from "../packages/hasunosora_runtime/shaders/highlight-distortion.js";

function fixture() {
  let width = 100, height = 50;
  const renderer = {
    info: { render: { frame: 1 } },
    outputColorSpace: THREE.SRGBColorSpace,
    target: null,
    copies: [],
    getRenderTarget() { return this.target; },
    getDrawingBufferSize(vector) { return vector.set(width, height); },
    copyFramebufferToTexture(texture) { this.copies.push(texture); },
  };
  const mesh = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial());
  const originalHook = () => { renderer.previousHooks = (renderer.previousHooks ?? 0) + 1; };
  mesh.onBeforeRender = originalHook;
  const pass = new GrabPass(THREE, renderer, mesh.material, mesh);
  pass.init(renderer);
  const draw = (material = mesh.material) => mesh.onBeforeRender(renderer, null, null, null, material);
  return { renderer, mesh, pass, draw, originalHook, resize(w, h) { width = w; height = h; } };
}

test("GrabPass copies once before a matching draw and keeps existing mesh hooks", () => {
  const { renderer, mesh, pass, draw, originalHook } = fixture();
  draw(new THREE.MeshBasicMaterial());
  assert.equal(renderer.copies.length, 0);
  const bound = new THREE.MeshBasicMaterial();
  bound.userData.__parameterizedShaderRuntimes = [pass];
  draw(bound); draw(mesh.material);
  assert.equal(renderer.copies.length, 1);
  assert.equal(renderer.previousHooks, 3);
  assert.equal(pass.getUniforms().uOpaqueTex.value, renderer.copies[0]);
  assert.equal(pass.getUniforms().uOpaqueTexSRGB.value, 1);
  renderer.info.render.frame++;
  draw(bound);
  assert.equal(renderer.copies.length, 2);
  pass.destroy();
  assert.equal(mesh.onBeforeRender, originalHook);
});

test("resize replaces immutable GPU storage and updates every shared sampler", () => {
  const { renderer, pass, draw, resize } = fixture();
  const meshB = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial());
  const passB = new GrabPass(THREE, renderer, meshB.material, meshB);
  passB.init(renderer);
  draw();
  meshB.onBeforeRender(renderer, null, null, null, meshB.material);
  assert.equal(renderer.copies.length, 1);
  const oldTexture = pass.shared.texture;
  let oldDisposals = 0, newDisposals = 0;
  oldTexture.addEventListener("dispose", () => { oldDisposals++; });
  resize(200, 80);
  renderer.info.render.frame++;
  meshB.onBeforeRender(renderer, null, null, null, meshB.material);
  const newTexture = pass.shared.texture;
  newTexture.addEventListener("dispose", () => { newDisposals++; });
  assert.notEqual(newTexture, oldTexture);
  assert.equal(oldDisposals, 1);
  assert.deepEqual([newTexture.image.width, newTexture.image.height], [200, 80]);
  assert.equal(pass.getUniforms().uOpaqueTex.value, newTexture);
  assert.equal(passB.getUniforms().uOpaqueTex.value, newTexture);
  assert.equal(renderer.copies[1], newTexture);
  renderer.target = new THREE.WebGLRenderTarget(160, 90);
  renderer.target.texture.colorSpace = THREE.NoColorSpace;
  renderer.info.render.frame++;
  draw();
  assert.equal(pass.getUniforms().uOpaqueTexSRGB.value, 0);
  assert.equal(passB.getUniforms().uOpaqueTexSRGB.value, 0);
  pass.destroy();
  assert.equal(newDisposals, 1);
  passB.destroy();
});

test("failed copy leaves the frame eligible for retry", () => {
  const { renderer, pass, draw } = fixture();
  renderer.copyFramebufferToTexture = () => { throw new Error("copy failed"); };
  assert.throws(draw, /copy failed/);
  assert.equal(pass.shared.capturedFrame, -1);
  renderer.copyFramebufferToTexture = texture => renderer.copies.push(texture);
  draw();
  assert.equal(renderer.copies.length, 1);
  pass.destroy();
});
