import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createBloom } from '../packages/yohane_runtime/render-profiles/bloom.js';
import { bloomPrograms } from '../packages/yohane_runtime/render-profiles/bloom-program.js';
import { bloomCompositeProgram } from '../packages/yohane_runtime/render-profiles/bloom-composite.js';

function fixture(pixelRatio = 1) {
  const calls = [];
  const viewport = new THREE.Vector4(3, 4, 300, 200);
  const scissor = new THREE.Vector4(5, 6, 200, 100);
  const external = new THREE.WebGLRenderTarget(500, 400);
  let target = external;
  let scissorTest = true;
  const renderer = {
    getPixelRatio: () => pixelRatio,
    getRenderTarget: () => target,
    setRenderTarget(next) {
      target = next;
      if (next) viewport.copy(next.viewport);
    },
    getViewport: (out) => out.copy(viewport),
    setViewport: (next) => viewport.copy(next),
    getScissor: (out) => out.copy(scissor),
    setScissor: (next) => scissor.copy(next),
    getScissorTest: () => scissorTest,
    setScissorTest: (next) => { scissorTest = next; },
    compileAsync: async (scene) => {
      calls.push({ compile: scene.children[0].material });
    },
    render(scene) {
      const material = scene.children[0].material;
      const uniforms = material.uniforms;
      calls.push({
        target,
        shader: material.fragmentShader,
        material,
        source: uniforms._SourceTex.value,
        low: uniforms._SourceTexLowMip.value,
        texel: uniforms._SourceTex_TexelSize.value.clone(),
        viewport: viewport.clone(),
        scissorTest,
      });
      assert.notEqual(uniforms._SourceTex.value, target.texture, 'source and destination must differ');
      if (material.fragmentShader === bloomPrograms.upsample) {
        assert.notEqual(uniforms._SourceTexLowMip.value, target.texture, 'low mip must not alias destination');
      }
    },
  };
  const bloom = createBloom({ THREE, renderer });
  return { bloom, renderer, calls, viewport, scissor, external };
}

test('Bloom runs original half-size prefilter, horizontal/vertical pyramid and low-to-high upsample', () => {
  const f = fixture();
  const source = new THREE.Texture();
  f.bloom.setSize(1080, 1440);
  const result = f.bloom.render(source);
  const draws = f.calls;
  assert.deepEqual(draws.map((c) => c.shader), [
    bloomPrograms.prefilter,
    bloomPrograms.horizontal, bloomPrograms.vertical,
    bloomPrograms.horizontal, bloomPrograms.vertical,
    bloomPrograms.upsample, bloomPrograms.upsample,
  ]);
  assert.deepEqual(draws.map((c) => [c.target.width, c.target.height]), [
    [540, 720], [270, 360], [270, 360], [135, 180], [135, 180], [270, 360], [540, 720],
  ]);
  assert.equal(draws[0].source, source);
  assert.equal(draws[1].source, draws[0].target.texture);
  assert.equal(draws[2].source, draws[1].target.texture);
  assert.equal(draws[3].source, draws[2].target.texture);
  assert.equal(draws[5].source, draws[2].target.texture);
  assert.equal(draws[5].low, draws[4].target.texture);
  assert.equal(draws[6].low, draws[5].target.texture);
  assert.equal(result, draws[6].target.texture);
  assert.deepEqual(draws[0].texel.toArray(), [1 / 1080, 1 / 1440, 1080, 1440]);
  assert.deepEqual(draws[2].texel.toArray(), [1 / 270, 1 / 360, 270, 360]);
  assert.ok(draws.every((c) => c.scissorTest === false));
  for (const { target } of draws) {
    assert.equal(target.texture.type, THREE.HalfFloatType);
    assert.equal(target.texture.colorSpace, THREE.NoColorSpace);
    assert.equal(target.texture.minFilter, THREE.LinearFilter);
    assert.equal(target.texture.generateMipmaps, false);
    assert.equal(target.depthBuffer, false);
  }
  f.bloom.destroy();
  source.dispose();
  f.external.dispose();
});

test('single-mip Bloom returns the prefilter rather than an unwritten upsample texture', () => {
  const f = fixture();
  f.bloom.setSize(200, 100);
  const result = f.bloom.render(new THREE.Texture());
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].shader, bloomPrograms.prefilter);
  assert.equal(result, f.calls[0].target.texture);
  assert.deepEqual([f.calls[0].target.width, f.calls[0].target.height], [100, 50]);
  f.bloom.destroy();
});

test('Bloom reuses same-size targets and releases old targets and kernels exactly once', async () => {
  const f = fixture();
  await Promise.all([f.bloom.prepare(), f.bloom.prepare()]);
  const materials = f.calls.filter((c) => c.compile).map((c) => c.compile);
  assert.equal(materials.length, 4);
  f.calls.length = 0;
  f.bloom.setSize(1080, 1440);
  const source = new THREE.Texture();
  const first = f.bloom.render(source);
  const targets = [...new Set(f.calls.map((c) => c.target))];
  const disposals = new Map(targets.map((target) => [target, 0]));
  for (const target of targets) {
    target.addEventListener('dispose', () => disposals.set(target, disposals.get(target) + 1));
  }
  f.bloom.setSize(1080, 1440);
  assert.equal(f.bloom.render(source), first);
  assert.ok([...disposals.values()].every((value) => value === 0));
  f.bloom.setSize(200, 100);
  assert.ok([...disposals.values()].every((value) => value === 1));
  let materialDisposals = 0;
  for (const material of materials) material.addEventListener('dispose', () => materialDisposals++);
  f.bloom.destroy();
  f.bloom.destroy();
  assert.equal(materialDisposals, 4);
  assert.ok([...disposals.values()].every((value) => value === 1));
  assert.throws(() => f.bloom.setSize(200, 100), /destroyed/);
  await assert.rejects(f.bloom.prepare(), /destroyed/);
});

test('Bloom uses physical pixels at DPR 2 and restores target, viewport and scissor after a driver error', () => {
  const f = fixture(2);
  f.bloom.setSize(1080, 1440);
  f.bloom.render(new THREE.Texture());
  assert.deepEqual(f.calls[0].viewport.toArray(), [0, 0, 540, 720]);
  assert.equal(f.renderer.getRenderTarget(), f.external);
  assert.deepEqual(f.viewport.toArray(), [3, 4, 300, 200]);
  assert.deepEqual(f.scissor.toArray(), [5, 6, 200, 100]);
  assert.equal(f.renderer.getScissorTest(), true);
  const render = f.renderer.render;
  f.renderer.render = (scene) => {
    render(scene);
    throw new Error('Bloom driver failure');
  };
  assert.throws(() => f.bloom.render(new THREE.Texture()), /Bloom driver failure/);
  assert.equal(f.renderer.getRenderTarget(), f.external);
  assert.deepEqual(f.viewport.toArray(), [3, 4, 300, 200]);
  assert.deepEqual(f.scissor.toArray(), [5, 6, 200, 100]);
  assert.equal(f.renderer.getScissorTest(), true);
  f.bloom.destroy();
});

test('Bloom LQ compiled programs retain 1/9/5/2 samples and original soft-knee and weighted filters', () => {
  const samples = (shader) => (shader.match(/\btexture\(/g) ?? []).length;
  assert.equal(samples(bloomPrograms.prefilter), 1);
  assert.equal(samples(bloomPrograms.horizontal), 9);
  assert.equal(samples(bloomPrograms.vertical), 5);
  assert.equal(samples(bloomPrograms.upsample), 2);
  assert.match(bloomPrograms.prefilter, /_Params.w \* 4.0 \+ 9.99999975e-05/);
  assert.match(bloomPrograms.prefilter, /SV_Target0.xyz = max\(/);
  assert.match(bloomPrograms.horizontal, /vec2\(8.0, 6.0\)/);
  assert.match(bloomPrograms.horizontal, /0.0162162203/);
  assert.match(bloomPrograms.horizontal, /0.227027029/);
  assert.match(bloomPrograms.vertical, /vec2\(3.23076916, 1.38461542\)/);
  assert.match(bloomPrograms.vertical, /0.31621623/);
  assert.match(bloomPrograms.upsample, /_Params.xxx \* u_xlat0.xyz \+ u_xlat10_1.xyz/);
});

test('Bloom event parameters use non-overridden defaults and gamma threshold conversion', async () => {
  const f = fixture();
  await f.bloom.prepare();
  const params = f.calls[0].compile.uniforms._Params.value;
  assert.ok(Math.abs(params.x - 0.68) < 1e-7);
  assert.equal(params.y, 65472);
  // Threshold is gamma-space in the Volume; 1.3 must not be used directly in HDR thresholding.
  assert.ok(Math.abs(params.z - 1.781047) < 1e-5);
  assert.equal(params.w, params.z * 0.5);
  f.bloom.destroy();
});

test('isolated-character composite adds HDR light and retains its transparent tail', () => {
  const shader = bloomCompositeProgram.fragmentShader;
  assert.match(shader, /source.rgb \+ bloom/);
  assert.match(shader, /#include <colorspace_fragment>/);
  assert.match(shader, /gl_FragColor.a = max\(source.a, clamp\(/);
  assert.match(shader, /if \(!uPremultipliedAlpha && gl_FragColor.a > 0.0\)/);
  assert.match(shader, /gl_FragColor.rgb \/= gl_FragColor.a/);
  assert.doesNotMatch(shader, /discard/);
});
