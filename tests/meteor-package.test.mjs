import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { ShaderRegistry } from '../../webgal-lovelive-gltf-renderer/src/parameterized-renderer.js';
import { RenderProfileRegistry } from '../../webgal-lovelive-gltf-renderer/src/render-profiles.js';
import { meteorVariantRows } from '../packages/garupa_runtime/shaders/meteor-variant-data.js';
import { meteorProgramData } from '../packages/garupa_runtime/shaders/meteor-program-data.js';

const source = new URL('../packages/garupa_runtime/config.json', import.meta.url);
const config = JSON.parse(await readFile(source, 'utf8'));
const families = {
  'garupa-meteor': 'Meteor/MeteorShader',
  'garupa-meteor-offset': 'Meteor/MeteorShaderOffset',
  'garupa-meteor-transparent': 'Meteor/MeteorShaderTransparent',
};
function expectedSections(passId) {
  const defines = stage => [...new Set(meteorVariantRows.filter(row => row.stable_key === passId && row.stage === stage)
    .flatMap(row => row.matching_programs.map(program => meteorProgramData[program.source_sha256].define)))].sort();
  const vertex=defines('vertex'),fragment=defines('fragment');
  return { vertexPrelude:['METEOR_VERTEX_COMMON',...vertex.map(define=>`${define}_PRELUDE`)],
    vertexProject:vertex.map(define=>`${define}_BODY`),
    fragmentPrelude:['METEOR_FRAGMENT_COMMON',...fragment.map(define=>`${define}_PRELUDE`)],
    fragmentBody:['METEOR_FRAGMENT_BEGIN',...fragment.map(define=>`${define}_BODY`),'METEOR_FRAGMENT_END'] };
}
const expectedSamplers = {
  'garupa-meteor': ['_MainTex_with_sampler_MainTex', '_MatCapMap_with_sampler_MatCapMap', '_NormalMap_with_sampler_NormalMap',
    '_OutlineZOffsetMask_with_sampler_OutlineZOffsetMask', '_ShadingControlMap_with_sampler_ShadingControlMap', '_ShadowMap_with_sampler_ShadowMap'],
  'garupa-meteor-offset': ['_MainTex_with_sampler_MainTex', '_ShadowMap_with_sampler_ShadowMap'],
  'garupa-meteor-transparent': ['_MainTex_with_sampler_MainTex', '_MatCapMap_with_sampler_MatCapMap', '_NormalMap_with_sampler_NormalMap',
    '_ShadingControlMap_with_sampler_ShadingControlMap', '_ShadowMap_with_sampler_ShadowMap'],
};

test('Garupa package retains AvatarScaler and registers three source families, 11 stable passes and actual sampler names', () => {
  assert.deepEqual(config.components.find(component => component.type === 'behavior'
    && component.namespace === 'Garupa' && component.name === 'AvatarScaler'), {
    type: 'behavior', namespace: 'Garupa', name: 'AvatarScaler', script: 'behaviors/avatar-scaler.js', executionOrder: 0,
  });
  const shaders = config.components.filter(component => component.type === 'shader');
  assert.deepEqual(shaders.map(component => component.name), Object.keys(families));
  assert.equal(shaders.reduce((count, shader) => count + shader.passes.length, 0), 11);
  for (const shader of shaders) {
    assert.equal(shader.src, 'shaders/meteor.glsl');
    assert.equal(shader.script, 'shaders/meteor-runtime.js');
    const sourcePasses = [...new Set(meteorVariantRows.filter(row => row.shader === families[shader.name]).map(row => row.stable_key))].sort();
    assert.deepEqual(shader.passes.map(pass => pass.id).sort(), sourcePasses);
    for (const pass of shader.passes) assert.deepEqual(pass.sections, expectedSections(pass.id));
    assert.deepEqual(shader.samplers.map(sampler => sampler.name).sort(), expectedSamplers[shader.name].sort());
    for (const sampler of shader.samplers) {
      assert.equal(sampler.type, 'sampler2D');
      assert.deepEqual(sampler.missing, { behavior: 'constant', value: [1, 1, 1, 1] });
    }
  }
});

test('renderer standard ShaderRegistry resolves every configured section and imports the shared runtime', async () => {
  const registry = new ShaderRegistry();
  const texts = new Map();
  registry.registerPackage(config, {
    source: source.href,
    loadText: url => {
      if (!texts.has(url)) texts.set(url, readFile(new URL(url), 'utf8'));
      return texts.get(url);
    },
    loadModule: url => import(url),
  });
  for (const name of Object.keys(families)) {
    const prepared = await registry.loadShader(name);
    assert.equal(typeof prepared.scriptModule.default, 'function');
    assert.equal(prepared.scriptModule.default.name, 'MeteorRuntime');
    for (const pass of prepared.passes) {
      assert.deepEqual(Object.keys(pass.sections), Object.keys(expectedSections(pass.id)));
      for (const section of Object.values(pass.sections)) assert.ok(section.trim().length > 0);
      assert.match(pass.sections.vertexProject, /uMeteorMeshToSource \* vec4\(transformed, 1\.0\)/);
      assert.match(pass.sections.fragmentBody, /vec3 outgoingLight = meteor_sourceRGBA\.rgb/);
    }
  }
  assert.equal(texts.size, 1, 'all three families use the same generated GLSL resource');
  await assert.rejects(registry.loadShader('unknown-shader'), /Shader not found: unknown-shader/);
});

test('renderer standard RenderProfileRegistry resolves garupa-menu with all three required shaders', async () => {
  const profile = config.components.find(component => component.type === 'render-profile');
  assert.deepEqual(profile, {
    type: 'render-profile', name: 'garupa-menu', script: 'render-profiles/garupa-menu.js', requiredShaders: Object.keys(families),
  });
  const registry = new RenderProfileRegistry();
  const loaded = [];
  const createRenderProfile = () => { throw new Error('CPU registry test must not construct or render a profile'); };
  registry.registerPackage(config, { source: source.href, loadModule: url => {
    assert.equal(url, new URL('render-profiles/garupa-menu.js', source).href);
    return { createRenderProfile };
  } });
  const result = await registry.load('garupa-menu', { loadShader: async name => { loaded.push(name); } });
  assert.equal(result, createRenderProfile);
  assert.deepEqual(loaded, Object.keys(families));
});
