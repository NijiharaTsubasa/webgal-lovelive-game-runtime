import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import LlasMemberRuntime from '../packages/llas_runtime/shaders/member.js';

function fixture({native = false, declared = true, texture = new THREE.DataArrayTexture(new Uint8Array(12), 1, 1, 3)} = {}) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('_shader_color', new THREE.Float32BufferAttribute([1, 1, 1, 1], 4));
  const material = new THREE.MeshStandardMaterial(), mesh = new THREE.Mesh(geometry, material);
  const metadata = {
    extras: {keywords: native ? ['_CHEEK_ON'] : []},
    textures: declared ? {CheekTex: [0, 1, 2]} : {},
    shaderParams: {CheekIntensity: .23, CheekTexArrayIndex: 2},
  };
  material.userData.shaderParams = metadata.shaderParams;
  material.customProgramCacheKey = () => 'llas-member:Main';
  const runtime = new LlasMemberRuntime(THREE, null, material, mesh);
  // Same merge order as makePatcher: resolved samplers and material parameters,
  // followed by runtime inputs. createPass wraps, rather than replaces, it.
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, {
      uCheekTex: {value: texture},
      uCheekIntensity: {value: metadata.shaderParams.CheekIntensity},
      uCheekTexArrayIndex: {value: metadata.shaderParams.CheekTexArrayIndex},
    }, runtime.getUniforms('Main', metadata));
  };
  runtime.createPass('Main', material, mesh, metadata, {CheekTex: texture});
  const compile = () => {
    const shader = {uniforms: {}, fragmentShader: '#include <opaque_fragment>'};
    material.onBeforeCompile(shader);
    return shader;
  };
  return {runtime, material, metadata, texture, compile};
}

test('external cheek borrows the original variant and uniform binding without editing native metadata', () => {
  const f = fixture(), before = JSON.stringify(f.metadata), native = f.compile();
  assert.equal(f.material.defines.LLAS_CHEEK_ON, undefined);
  assert.equal(native.uniforms.uCheekIntensity.value, .23);
  assert.equal(f.runtime.getUniforms().uCheekIntensity, undefined);

  assert.deepEqual(f.runtime.setExternalCheek({intensity: .7, layer: 1}), {supported: true, layerCount: 3});
  const shader = f.compile(), activeVersion = f.material.version;
  assert.equal(f.material.defines.LLAS_CHEEK_ON, 1);
  assert.equal(shader.uniforms.uCheekTex.value, f.texture);
  assert.equal(shader.uniforms.uCheekIntensity.value, .7);
  assert.equal(shader.uniforms.uCheekTexArrayIndex.value, 1);
  assert.equal(f.material.customProgramCacheKey(), 'llas-member:Main:external-cheek');
  assert.equal(f.runtime.getUniforms('Outline').uCheekIntensity, undefined);

  f.runtime.setExternalCheek({intensity: .4, layer: 2});
  assert.equal(shader.uniforms.uCheekIntensity.value, .4);
  assert.equal(shader.uniforms.uCheekTexArrayIndex.value, 2);
  assert.equal(f.material.version, activeVersion, 'per-frame updates must not recompile');
  assert.equal(JSON.stringify(f.metadata), before);

  f.runtime.setExternalCheek(null);
  const released = f.compile();
  assert.equal(f.material.defines.LLAS_CHEEK_ON, undefined);
  assert.equal(f.material.customProgramCacheKey(), 'llas-member:Main');
  assert.equal(released.uniforms.uCheekIntensity.value, .23);
  assert.equal(released.uniforms.uCheekTexArrayIndex.value, 2);
  assert.equal(released.uniforms.uCheekTex.value, f.texture);
  const releasedVersion = f.material.version;
  f.runtime.setExternalCheek(null);
  assert.equal(f.material.version, releasedVersion);

  f.runtime.setExternalCheek({intensity: .8});
  assert.equal(f.compile().uniforms.uCheekIntensity, shader.uniforms.uCheekIntensity,
    'cached external variants must keep their original live uniform objects');
});

test('native CHEEK keyword and unusual define value survive takeover, release and destroy', () => {
  const f = fixture({native: true});
  f.material.defines.LLAS_CHEEK_ON = 7;
  f.runtime.setExternalCheek({intensity: 0, layer: 0});
  assert.equal(f.material.defines.LLAS_CHEEK_ON, 1);
  f.runtime.destroy();
  assert.equal(f.material.defines.LLAS_CHEEK_ON, 7);
  assert.equal(f.compile().uniforms.uCheekIntensity.value, .23);
  assert.deepEqual(f.runtime.setExternalCheek({intensity: 1}), {supported: false, reason: 'runtime-destroyed'});
});

test('missing, fallback-only and invalid array textures never activate a broken cheek variant', () => {
  for (const options of [{declared: false}, {texture: null}, {texture: new THREE.Texture()},
    {texture: new THREE.DataArrayTexture(new Uint8Array(), 1, 1, 0)}]) {
    const f = fixture(options);
    const version = f.material.version, key = f.material.customProgramCacheKey();
    const first = f.runtime.setExternalCheek({intensity: 1});
    assert.deepEqual(first, {supported: false, reason: 'missing-cheek-array-texture'});
    assert.equal(f.runtime.setExternalCheek({intensity: 1}), first);
    assert.equal(f.material.defines.LLAS_CHEEK_ON, undefined);
    assert.equal(f.material.version, version);
    assert.equal(f.material.customProgramCacheKey(), key);
    assert.equal(f.runtime.getUniforms().uCheekIntensity, undefined);
  }
  const native = fixture({native: true, declared: false});
  assert.equal(native.runtime.setExternalCheek({intensity: 1}).supported, false);
  assert.equal(native.material.defines.LLAS_CHEEK_ON, 1, 'unsupported external input must not reject or change native CHEEK');
  assert.equal(native.compile().uniforms.uCheekIntensity.value, .23);
});

test('external cheek range saturation and instance ownership do not modify native values', () => {
  const a = fixture(), b = fixture();
  a.runtime.setExternalCheek({intensity: 4, layer: 100});
  assert.equal(a.compile().uniforms.uCheekIntensity.value, 1);
  assert.equal(a.compile().uniforms.uCheekTexArrayIndex.value, 2);
  a.runtime.setExternalCheek({intensity: -2, layer: -3});
  assert.equal(a.compile().uniforms.uCheekIntensity.value, 0);
  assert.equal(a.compile().uniforms.uCheekTexArrayIndex.value, 0);
  assert.equal(b.compile().uniforms.uCheekIntensity.value, .23);
  assert.equal(b.material.defines.LLAS_CHEEK_ON, undefined);
  assert.throws(() => a.runtime.setExternalCheek({intensity: NaN}), /finite/);
  assert.throws(() => a.runtime.setExternalCheek({intensity: .5, layer: Infinity}), /finite/);
  assert.equal(a.compile().uniforms.uCheekIntensity.value, 0);
});
