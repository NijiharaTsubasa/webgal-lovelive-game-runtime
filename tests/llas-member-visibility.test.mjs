import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { setParameterizedRenderingEnabled } from 'webgal-lovelive-gltf-renderer/parameterized-renderer.js';
import LlasMemberRuntime from '../packages/llas_runtime/shaders/member.js';

function fixture({ array = false, name = 'eye_neutral', visible = true } = {}) {
  const root = new THREE.Group();
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('_shader_color', new THREE.Float32BufferAttribute([1, 1, 1, 1], 4));
  const base = new THREE.MeshStandardMaterial();
  const unrelated = new THREE.MeshStandardMaterial();
  const mesh = new THREE.Mesh(geometry, array ? [unrelated, base] : base);
  mesh.name = name;
  mesh.visible = visible;
  mesh.morphTargetInfluences = [.2, .8];
  root.add(mesh);
  const renderer = { getDrawingBufferSize(target) { return target.set(800, 600); } };
  const main = base.clone();
  const runtime = new LlasMemberRuntime(THREE, renderer, main, mesh);
  main.userData.__parameterizedShaderRuntimes = [runtime];
  runtime.createPass('Main', main, mesh, { extras: { keywords: [] } });
  const outline = runtime.createPass('Outline', base.clone(), mesh, {});
  // Match the renderer's realized pass metadata and material replacement.
  outline.userData.__parameterizedPassObject = true;
  outline.userData.__parameterizedBaseVisible = mesh.visible;
  mesh.userData.__baseMaterials = mesh.material;
  mesh.userData.__parameterizedMaterials = array ? [unrelated, main] : main;
  mesh.material = mesh.userData.__parameterizedMaterials;
  const tick = () => runtime.onBeforeRender(renderer);
  const enable = value => setParameterizedRenderingEnabled(root, value);
  return { root, mesh, main, outline, runtime, tick, enable };
}

test('member sibling outline follows source hiding and redisplaying for single and array materials', () => {
  for (const array of [false, true]) {
    const f = fixture({ array });
    assert.equal(f.outline.parent, f.mesh.parent);
    f.tick();
    assert.equal(f.outline.visible, true);
    f.mesh.visible = false;
    f.tick();
    assert.equal(f.outline.visible, false);
    f.mesh.visible = true;
    f.tick();
    assert.equal(f.outline.visible, true);
    f.runtime.destroy();
    assert.equal(f.root.children.length, 1);
  }
});

test('shader disabled callback never reopens outline and reenabling follows the current board pattern', () => {
  const neutral = fixture();
  const smile = fixture({ name: 'eye_smile', visible: false });
  for (const f of [neutral, smile]) { f.tick(); f.enable(false); f.tick(); }
  assert.equal(neutral.outline.visible, false);
  assert.equal(smile.outline.visible, false);
  // Switch patterns while the host uses the original PBR materials.
  neutral.mesh.visible = false;
  smile.mesh.visible = true;
  for (const f of [neutral, smile]) { f.tick(); f.tick(); }
  assert.equal(neutral.outline.visible, false);
  assert.equal(smile.outline.visible, false);
  for (const f of [neutral, smile]) { f.enable(true); f.tick(); }
  assert.equal(neutral.outline.visible, false);
  assert.equal(smile.outline.visible, true, 'initially hidden patterns must become visible');
});

test('ordinary member face preserves outline morph sync and shader toggle behavior', () => {
  const f = fixture({ name: 'face' });
  f.tick();
  assert.equal(f.outline.visible, true);
  f.mesh.morphTargetInfluences[0] = .73;
  f.enable(false);
  f.tick();
  assert.equal(f.outline.visible, false);
  assert.deepEqual(f.outline.morphTargetInfluences, [.73, .8]);
  f.enable(true);
  f.tick();
  assert.equal(f.outline.visible, true);
  assert.deepEqual(f.outline.morphTargetInfluences, [.73, .8]);
});

test('an active material belonging to another member runtime cannot enable this outline', () => {
  const a = fixture({ array: true });
  const b = fixture();
  a.mesh.material = [b.main];
  a.tick();
  assert.equal(a.outline.visible, false);
  a.mesh.material = a.mesh.userData.__parameterizedMaterials;
  a.tick();
  assert.equal(a.outline.visible, true);
});
