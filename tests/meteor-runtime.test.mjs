import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import test from 'node:test';
import * as THREE from 'three';
import MeteorRuntime from '../packages/garupa_runtime/shaders/meteor-runtime.js';
import { meteorProgramData } from '../packages/garupa_runtime/shaders/meteor-program-data.js';
import { meteorVariantRows } from '../packages/garupa_runtime/shaders/meteor-variant-data.js';
import { ShaderRegistry, createShaderRuntimeScope } from '../../webgal-lovelive-gltf-renderer/src/parameterized-renderer.js';

const familyNames = {
  'Meteor/MeteorShader': 'garupa-meteor', 'Meteor/MeteorShaderOffset': 'garupa-meteor-offset',
  'Meteor/MeteorShaderTransparent': 'garupa-meteor-transparent',
};

const packageURL = new URL('../packages/garupa_runtime/config.json', import.meta.url);
const packageConfig = JSON.parse(await readFile(packageURL, 'utf8'));
const shaderRegistry = new ShaderRegistry(), shaderTexts = new Map();
shaderRegistry.registerPackage(packageConfig, { source: packageURL.href,
  loadText: url => { if (!shaderTexts.has(url)) shaderTexts.set(url, readFile(new URL(url), 'utf8')); return shaderTexts.get(url); },
  loadModule: url => import(url),
});
const preparedShaders = new Map(await Promise.all(Object.values(familyNames).map(async name => [name, await shaderRegistry.loadShader(name)])));
const glslSource = (await shaderTexts.get(new URL('shaders/meteor.glsl', packageURL).href)).replaceAll('\r\n', '\n');
const sectionCatalog = Object.fromEntries([...glslSource.matchAll(/\/\/ @section (\S+)\r?\n([\s\S]*?)\r?\n\/\/ @end/g)].map(([, name, body]) => [name, body]));
function loadedSections(row) {
  const prepared = preparedShaders.get(familyNames[row.shader]);
  const pass = prepared.passes.find(pass => pass.id === row.stable_key);
  assert.ok(pass, `actual registry pass ${row.stable_key}`);
  return Object.fromEntries(Object.entries(pass.sections).map(([name, source]) => [name, source.replaceAll('\r\n', '\n')]));
}
function geometryFixture() {
  const geometry = new THREE.BufferGeometry();
  for (const [name, size] of [['position', 3], ['normal', 3], ['tangent', 4], ['_source_uv0', 2], ['_source_uv1', 2]]) geometry.setAttribute(name, new THREE.BufferAttribute(new Float32Array(size * 3), size));
  return geometry;
}
function unwrapProgram(define, kind) {
  const source = sectionCatalog[`${define}_${kind}`];
  assert.ok(source, `named source ${define}_${kind}`);
  const prefix = `// @meteor-program ${define}\n`, suffix = `\n// @meteor-end ${define}`;
  assert.ok(source.startsWith(prefix) && source.endsWith(suffix));
  return source.slice(prefix.length, -suffix.length);
}
function assertCompiledPair(shader, binding) {
  for (const [stage, key, sha] of [['vertex', 'vertexShader', binding.vertexSha], ['fragment', 'fragmentShader', binding.fragmentSha]]) {
    const source = shader[key], program = meteorProgramData[sha];
    assert.deepEqual([...source.matchAll(/\/\/ Retained source ([a-f0-9]{64})/g)].map(([, value]) => value), [sha]);
    assert.deepEqual([...source.matchAll(/\bmeteor_([a-f0-9]{12})\s*\(/g)].map(([, value]) => value), [sha.slice(0,12), sha.slice(0,12)], `${stage}: exactly one original function and one call`);
    assert.ok(source.includes(unwrapProgram(program.define, 'PRELUDE')), `${stage} prelude bytes retained`);
    assert.ok(source.includes(unwrapProgram(program.define, 'BODY')), `${stage} body bytes retained`);
    assert.ok(source.includes(sectionCatalog[`METEOR_${stage.toUpperCase()}_COMMON`]), `${stage} common bytes retained`);
  }
  assert.equal(shader.fragmentShader.split('vec4 meteor_sourceRGBA = vec4(0.0);').length - 1, 1);
  assert.equal(shader.fragmentShader.split('vec3 outgoingLight = meteor_sourceRGBA.rgb;').length - 1, 1);
}
async function standardBoundFixture(row) {
  const geometry = geometryFixture(), original = new THREE.MeshStandardMaterial();
  original.name = 'section-selection-fixture'; original.userData = { shader: familyNames[row.shader], renderState: { renderQueue: 2000 },
    passes: [{ id: row.stable_key, extras: { materialKeywords: [...row.observed_material_keywords] }, renderState: { colorMask: row.pass_name === 'DepthOnly' ? 0 : 15 } }] };
  const mesh = new THREE.Mesh(geometry, original);
  const renderer = { state: { setMaterial() {} }, getContext: () => ({ colorMask() {} }) };
  const scope = createShaderRuntimeScope(renderer, shaderRegistry);
  await scope.applyCustomShaders({ parser: { json: { textures: [] }, getDependency() { throw new Error('Fixture must use declared constant fallback samplers'); } } }, mesh);
  const material = mesh.material, runtime = material.userData.__parameterizedShaderRuntimes[0];
  return { mesh, material, runtime, binding: runtime.passes.get(row.stable_key), compile() {
    const shader = { uniforms: {}, vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader };
    material.onBeforeCompile(shader); return shader;
  }, dispose() { scope.dispose(); geometry.dispose(); original.dispose(); } };
}

function fixture(row = meteorVariantRows[0], overrides = {}) {
  const material = new THREE.MeshStandardMaterial();
  material.userData.shader = familyNames[row.shader];
  const geometry = geometryFixture();
  const mesh = new THREE.Mesh(geometry, material);
  const runtime = new MeteorRuntime(THREE, null, material, mesh);
  const pass = { sections: loadedSections(row), extras: { materialKeywords: row.observed_material_keywords }, renderState: { colorMask: row.pass_name === 'DepthOnly' ? 0 : 15 }, ...overrides };
  return { runtime, material, mesh, pass, id: row.stable_key };
}

function frame(overrides = {}) {
  return { targetHeight: 1080, mainLightPosition: [1.371, -.239, 3.719, 0], mainLightColor: [.731, .317, .193, 1],
    ambientRGB: [.137, .239, .371], ...overrides };
}

test('zero light inputs reset after explicit overrides while preserving per-instance uniform storage', () => {
  const a = fixture(), b = fixture();
  const names = ['u_UnityPerDraw_unity_LightIndices', ...new Set(Object.values(meteorProgramData)
    .flatMap(program => program.globals.filter(global => global.scope === 'AdditionalLights').map(global => global.name)))];
  const values = value => Array.isArray(value) ? value.map(values)
    : value?.toArray ? value.toArray() : ArrayBuffer.isView(value) ? Array.from(value) : value;
  const nonzero = value => Array.isArray(value) ? value.map(nonzero) : .371;
  const zeros = value => Array.isArray(value) ? value.map(zeros) : 0;
  const overrides = Object.fromEntries(names.map(name => [name, nonzero(values(a.runtime.uniforms[name].value))]));
  const snapshot = structuredClone(overrides);
  const storage = names.map(name => a.runtime.uniforms[name].value);
  try {
    a.runtime.setFrame(frame({ uniforms: overrides }));
    b.runtime.setFrame(frame({ uniforms: overrides }));
    a.runtime.setFrame(frame());
    names.forEach((name, index) => {
      assert.equal(a.runtime.uniforms[name].value, storage[index], `${name}: storage identity`);
      assert.deepEqual(values(a.runtime.uniforms[name].value), zeros(overrides[name]), `${name}: default restored`);
      assert.deepEqual(values(b.runtime.uniforms[name].value), overrides[name], `${name}: other instance unchanged`);
      assert.ok(a.runtime.available.has(name), `${name}: still provided`);
    });
    assert.deepEqual(overrides, snapshot, 'source frame arrays are untouched');
    a.runtime.setFrame(frame({ uniforms: overrides }));
    for (const name of names) assert.deepEqual(values(a.runtime.uniforms[name].value), overrides[name]);
    assert.throws(() => a.runtime.setFrame(frame({ additionalLights: [{}] })), /Additional light rigs require explicit/);
  } finally {
    for (const f of [a, b]) { f.runtime.destroy(); f.mesh.geometry.dispose(); f.material.dispose(); }
  }
});

test('generated package exposes all56 programs as named preludes/bodies with unchanged common sections', async () => {
  const source = await readFile(new URL('../packages/garupa_runtime/shaders/meteor.glsl', import.meta.url), 'utf8');
  const sections = Object.fromEntries([...source.matchAll(/\/\/ @section (\S+)\r?\n([\s\S]*?)\r?\n\/\/ @end/g)].map(([, name, body]) => [name, body]));
  const expectedNames = ['METEOR_VERTEX_COMMON', 'METEOR_FRAGMENT_COMMON', 'METEOR_FRAGMENT_BEGIN', 'METEOR_FRAGMENT_END', ...Object.values(meteorProgramData).flatMap(program => [`${program.define}_PRELUDE`, `${program.define}_BODY`])];
  assert.equal(Object.keys(sections).length, 116);
  assert.deepEqual(Object.keys(sections).sort(), expectedNames.sort());
  assert.equal(Object.keys(meteorProgramData).length, 56);
  assert.equal(Object.values(meteorProgramData).filter(program => program.stage === 'vertex').length, 9);
  assert.equal(Object.values(meteorProgramData).filter(program => program.stage === 'fragment').length, 47);
  // Independent fingerprint of every reachable stage:source identity in
  // the original full projection table, filtered to the three Meteor families.
  // The emitted set must equal all candidates, rather than one preview state.
  const retainedSources = Object.entries(meteorProgramData).map(([sha, program]) => `${program.stage}:${sha}`).sort().join('\n');
  assert.equal(createHash('sha256').update(retainedSources).digest('hex'), '2f3fafaf846bc8e0e10691377e38266c8736ad0b4272d419ff75a23c6cdc5d92');
  const referenced = new Map();
  for (const row of meteorVariantRows) for (const candidate of row.matching_programs) {
    if (referenced.has(candidate.source_sha256)) assert.equal(referenced.get(candidate.source_sha256), row.stage);
    referenced.set(candidate.source_sha256, row.stage);
  }
  assert.deepEqual(Object.keys(meteorProgramData).sort(), [...referenced.keys()].sort());
  for (const [sha, stage] of referenced) assert.equal(meteorProgramData[sha].stage, stage);
  const sourceMarkers = [...source.matchAll(/\/\/ Retained source ([a-f0-9]{64})/g)].map(([, sha]) => sha);
  assert.deepEqual(sourceMarkers.sort(), Object.keys(meteorProgramData).sort());
  for (const [sha, program] of Object.entries(meteorProgramData)) {
    const prelude = unwrapProgram(program.define, 'PRELUDE'), body = unwrapProgram(program.define, 'BODY');
    assert.ok(prelude.includes(`// Retained source ${sha}`));
    assert.ok(prelude.includes(`#if defined(${program.define})`));
    assert.ok(body.includes(`#if defined(${program.define})`));
  }
  const vertexBodies = Object.values(meteorProgramData).filter(p => p.stage === 'vertex').map(p => unwrapProgram(p.define, 'BODY')).join('\n');
  const fragmentBodies = Object.values(meteorProgramData).filter(p => p.stage === 'fragment').map(p => unwrapProgram(p.define, 'BODY')).join('\n');
  const fragmentPreludes = Object.values(meteorProgramData).filter(p => p.stage === 'fragment').map(p => unwrapProgram(p.define, 'PRELUDE')).join('\n');
  assert.match(vertexBodies, /uMeteorMeshToSource \* vec4\(transformed, 1\.0\)/);
  assert.match(vertexBodies, /gl_Position = meteor_metalClipToGL\(meteor_sourceOutput\.mtl_Position\)/);
  assert.match(fragmentBodies, /meteor_metalFragCoord\(gl_FragCoord, uMeteorTargetHeight\)/);
  assert.match(fragmentBodies, /gl_FrontFacing/);
  assert.match(fragmentPreludes, /layout\(location = 1\) out highp vec4 meteor_mrt1/);
  assert.match(fragmentBodies, /meteor_mrt1 = meteor_sourceOutput\.SV_TARGET1/);
  assert.doesNotMatch(vertexBodies, /meteor_materialUv/);
  assert.match(vertexBodies, /meteor_sourceInput.TEXCOORD1 = _source_uv1;/);
  assert.doesNotMatch(vertexBodies, /uMeteorMeshToSource[^;]*_source_uv/);
  assert.match(source, /float\(meteor_half\(u_MatCapBlurLevel\)\)\s*-\s*u_MatCapSourceMip/);
});

test('all236 observed stage pairs compile through standard binder with only their selected original programs', async () => {
  const rows = meteorVariantRows.filter(row => row.stage === 'vertex'), seen = new Set(), samples = [];
  for (const row of rows) {
    const f = await standardBoundFixture(row);
    try {
      const originalSections = loadedSections(row);
      const globals = [...row.matching_programs].sort((a,b) => a.non_material_keywords.length - b.non_material_keywords.length)[0].non_material_keywords;
      f.runtime.setFrame(frame({ globalKeywords: globals }));
      f.runtime.onBeforeRender(null, null, new THREE.PerspectiveCamera(43, 1.7, .13, 173));
      const shader = f.compile(); assertCompiledPair(shader, f.binding);
      assert.match(shader.vertexShader, /#include <skinning_vertex>/);
      samples.push({ shader: row.shader, pass: row.stable_key, vertexSha: f.binding.vertexSha, fragmentSha: f.binding.fragmentSha,
        loadedPassBytes: Object.values(originalSections).reduce((sum,s) => sum + Buffer.byteLength(s),0),
        selectedPassBytes: Object.values(f.binding.pass.sections).reduce((sum,s) => sum + Buffer.byteLength(s),0),
        beforeCompileVertexBytes: Buffer.byteLength(shader.vertexShader), beforeCompileFragmentBytes: Buffer.byteLength(shader.fragmentShader) });
      seen.add(f.material.userData.shader);
    } finally { f.dispose(); }
  }
  assert.equal(rows.length, 236); assert.deepEqual([...seen].sort(), Object.values(familyNames).sort());
  const selectedPrograms=[...new Set(samples.flatMap(sample=>[sample.vertexSha,sample.fragmentSha]))].sort();
  assert.deepEqual(selectedPrograms,Object.keys(meteorProgramData).sort(),'all56 retained programs reached across actual stage-pair fixtures');
  if (process.env.METEOR_WRITE_NAMED_SECTION_STATS === '1') {
    const summary = key => { const values=samples.map(s=>s[key]).sort((a,b)=>a-b);return {min:values[0],median:(values[117]+values[118])/2,p95:values[Math.ceil(values.length*.95)-1],max:values.at(-1)}; };
    await writeFile(new URL('../../validation/meteor-named-sections-assembly-summary.json',import.meta.url),JSON.stringify({
      scope:'CPU standard ShaderRegistry + actual binder onBeforeCompile source assembly only; includes remain unexpanded; not GPU compile/link timing',
      rows:472,stagePairs:samples.length,uniqueStagePairs:new Set(samples.map(sample=>`${sample.vertexSha}:${sample.fragmentSha}`)).size,retainedPrograms:Object.keys(meteorProgramData).length,selectedPrograms:selectedPrograms.length,namedSections:Object.keys(sectionCatalog).length,libraryBytes:Buffer.byteLength(glslSource),librarySHA256:createHash('sha256').update(glslSource).digest('hex'),
      allPairsContainExactlyOneOriginalVSAndFS:true,rendererChanged:false,unit:'UTF8 bytes',
      distribution:Object.fromEntries(['loadedPassBytes','selectedPassBytes','beforeCompileVertexBytes','beforeCompileFragmentBytes'].map(key=>[key,summary(key)])),samples},null,2)+'\n','utf8');
  }
});

test('frame and matrix updates reuse compiled uniform objects and preserve source coordinate conventions', () => {
  const f = fixture();
  f.runtime.configurePass(f.id, f.material, f.mesh, f.pass);
  f.runtime.setFrame(frame());
  const uniforms = f.runtime.getUniforms(f.id);
  const light = uniforms.u_FGlobals_MainLightPosition;
  const lightValue = light.value;
  const columns = uniforms.u_UnityPerDraw_hlslcc_mtx4x4unity_ObjectToWorld.value;
  const column = columns[3];
  const coordinateBuffers = f.runtime.coordinateMatrices;
  const objectToWorld = coordinateBuffers.objectToWorld;
  const camera = new THREE.PerspectiveCamera(43, 1.7, .13, 173);
  camera.position.set(1.93, 2.71, 5.37);
  f.mesh.position.set(.371, -.239, 1.193);
  f.runtime.setFrame(frame());
  f.runtime.onBeforeRender(null, null, camera);
  assert.deepEqual(lightValue.toArray(), [-1.371, -.239, 3.719, 0]);
  assert.deepEqual(column.toArray(), [-.371, -.239, 1.193, 1]);
  f.mesh.position.x += .137;
  f.runtime.setFrame(frame({ mainLightPosition: [.17, .31, -.73, 0], targetHeight: 719 }));
  f.runtime.onBeforeRender(null, null, camera);
  assert.equal(f.runtime.getUniforms(f.id), uniforms);
  assert.equal(uniforms.u_FGlobals_MainLightPosition, light);
  assert.equal(light.value, lightValue);
  assert.equal(uniforms.u_UnityPerDraw_hlslcc_mtx4x4unity_ObjectToWorld.value, columns);
  assert.equal(columns[3], column);
  assert.equal(f.runtime.coordinateMatrices, coordinateBuffers);
  assert.equal(coordinateBuffers.objectToWorld, objectToWorld);
  assert.equal(objectToWorld.elements[12], -f.mesh.position.x);
  assert.deepEqual(column.toArray(), [-f.mesh.position.x, -.239, 1.193, 1]);
  assert.deepEqual(lightValue.toArray(), [-.17, .31, -.73, 0]);
  assert.equal(uniforms.uMeteorTargetHeight.value, 719);
  assert.equal(uniforms.u_UnityPerDraw_unity_LightData, undefined, 'removed URP-only global is not allocated');
  assert.deepEqual(uniforms.u_UnityPerDraw_unity_LightIndices.value.map(vector => vector.toArray()), [[0, 0, 0, 0], [0, 0, 0, 0]]);
});

test('unrelated global keyword changes preserve retained Meteor source identities and cache keys', () => {
  const f = fixture();
  f.runtime.setFrame(frame({ globalKeywords: [] }));
  f.runtime.configurePass(f.id, f.material, f.mesh, f.pass);
  const firstKey = f.material.customProgramCacheKey(), version = f.material.version;
  const originalDefines = { ...f.material.defines };
  const globals = ['EVALUATE_SH_VERTEX', 'UNRELATED_SCENE_KEYWORD', '_LIGHT_COOKIES'];
  f.runtime.setFrame(frame({ globalKeywords: globals }));
  assert.deepEqual(f.runtime.globalKeywords, [...globals].sort());
  assert.equal(f.material.customProgramCacheKey(), firstKey);
  assert.equal(f.material.version, version);
  assert.deepEqual(f.material.defines, originalDefines);
  f.runtime.setFrame(frame({ globalKeywords: [...globals].reverse() }));
  assert.equal(f.material.customProgramCacheKey(), firstKey);
  assert.equal(f.material.version, version);
  assert.doesNotThrow(() => f.runtime.onBeforeRender(null, null, new THREE.PerspectiveCamera()));
  assert.throws(() => f.runtime.setFrame(frame({ globalKeywords: [null] })), /explicit string array/);
});

test('removed URP/Lit family is explicitly rejected by the runtime', () => {
  for (const shader of ['garupa-urp-lit', 'Universal Render Pipeline/Lit']) {
    const material = new THREE.MeshStandardMaterial(); material.userData.shader = shader;
    const mesh = new THREE.Mesh(new THREE.BufferGeometry(), material);
    assert.throws(() => new MeteorRuntime(THREE, null, material, mesh), /Unsupported Meteor shader family/);
    mesh.geometry.dispose(); material.dispose();
  }
});

test('retained Meteor compilation still requires an explicit frame before uniforms are available', () => {
  const f = fixture();
  f.runtime.configurePass(f.id, f.material, f.mesh, f.pass);
  assert.throws(() => f.runtime.getUniforms(f.id), /explicit matching frame/);
  f.runtime.setFrame(frame());
  assert.ok(f.runtime.getUniforms(f.id).u_FGlobals_MainLightColor);
});

test('standard compile patch retains source alpha after opaque_fragment without replacing the standard shader', () => {
  const f = fixture();
  f.material.map = new THREE.Texture();
  f.material.normalMap = new THREE.Texture();
  f.material.alphaTest = .7;
  f.runtime.setFrame(frame());
  f.runtime.configurePass(f.id, f.material, f.mesh, f.pass);
  assert.equal(f.material.forceSinglePass, true);
  assert.equal(f.material.map, null);
  assert.equal(f.material.normalMap, null);
  assert.equal(f.material.alphaTest, 0);
  assert.equal(f.material.toneMapped, false);
  assert.equal(f.material.fog, false);
  const shader = { vertexShader: '#include <skinning_vertex>\n#include <project_vertex>', fragmentShader: '#include <opaque_fragment>\n#include <colorspace_fragment>' };
  f.material.onBeforeCompile(shader);
  assert.match(shader.fragmentShader, /#include <opaque_fragment>\ngl_FragColor\.a = meteor_sourceRGBA\.a;/);
  assert.match(shader.fragmentShader, /#include <colorspace_fragment>/);
  assert.match(shader.vertexShader, /#include <skinning_vertex>/);
  assert.equal(f.runtime.frontFacingStatus, 'UNVERIFIED');
});

test('face override is explicit per pass, reuses uniforms, and absent native Head restores saved values', () => {
  const row = meteorVariantRows.find(row => row.stage === 'vertex' && row.observed_material_keywords.includes('_USE_FACE_SHADOW'));
  // The override contract is pass metadata rather than inference from its
  // keyword spelling; any observed pass can exercise the binding policy.
  const f = fixture(row ?? meteorVariantRows[0], { shaderParams: { _FaceFrontX: .13, _FaceFrontZ: .97, _FaceRightX: .91, _FaceRightZ: -.29 },
    extras: { materialKeywords: (row ?? meteorVariantRows[0]).observed_material_keywords, faceLighting: true } });
  f.runtime.configurePass(f.id, f.material, f.mesh, f.pass);
  f.runtime.setFrame(frame());
  const uniforms = f.runtime.getUniforms(f.id), front = uniforms.u_FaceFrontX;
  assert.equal(front.value, .13);
  f.runtime.setFrame(frame({ faceDirections: { frontXZ: [.37, .83], rightXZ: [.91, -.17] } }));
  assert.equal(front.value, .37);
  assert.equal(uniforms.u_FaceRightZ.value, -.17);
  f.runtime.setFrame(frame());
  assert.equal(uniforms.u_FaceFrontX, front);
  assert.equal(front.value, .13);
});

test('only actually read vertex channels are required, and absent source UV1 has its native zero default', () => {
  const row = meteorVariantRows.find(row => row.stage === 'vertex' && row.pass_name === 'Outline' && row.matching_programs.some(p => meteorProgramData[p.source_sha256].activeInputs.includes('TEXCOORD1')));
  const f = fixture(row);
  f.mesh.geometry.deleteAttribute('_source_uv1');
  f.runtime.setFrame(frame());
  f.runtime.configurePass(f.id, f.material, f.mesh, f.pass);
  assert.deepEqual(f.material.defaultAttributeValues._source_uv1, [0, 0]);
  const missing = fixture();
  missing.mesh.geometry.deleteAttribute('_source_uv0');
  missing.runtime.setFrame(frame());
  assert.throws(() => missing.runtime.configurePass(missing.id, missing.material, missing.mesh, missing.pass), /reads missing _source_uv0/);
  assert.throws(() => new MeteorRuntime(THREE, null, new THREE.MeshStandardMaterial(), f.mesh), /Unsupported Meteor shader family/);
});


test('RootBone frame drives source matrices and reuses the post-skin bridge uniform', () => {
  const f = fixture(), root = new THREE.Object3D(), camera = new THREE.PerspectiveCamera();
  root.position.set(.371,-.239,1.193); root.rotation.set(.317,-.571,.193); root.scale.set(.83,1.91,.63); root.updateMatrixWorld();
  f.mesh.position.set(-.719,1.137,.431); f.mesh.rotation.set(-.239,.731,-.371); f.mesh.scale.set(1.37,.71,2.19);
  f.runtime.setFrame(frame({objectMatrix: root.matrixWorld}));
  f.runtime.configurePass(f.id,f.material,f.mesh,f.pass);
  const uniforms=f.runtime.getUniforms(f.id), bridge=uniforms.uMeteorMeshToSource.value;
  f.runtime.onBeforeRender(null,null,camera);
  const source=new THREE.Matrix4().fromArray(uniforms.u_UnityPerDraw_hlslcc_mtx4x4unity_ObjectToWorld.value.flatMap(c=>c.toArray()));
  const reflection=new THREE.Matrix4().makeScale(-1,1,1);
  for (const w of [0,1]) {
    const input=new THREE.Vector4(.137,-.719,.371,w);
    const actual=input.clone().applyMatrix4(bridge).applyMatrix4(source), expected=input.clone().applyMatrix4(f.mesh.matrixWorld).applyMatrix4(reflection);
    actual.toArray().forEach((v,i)=>assert.ok(Math.abs(v-expected.toArray()[i])<1e-10));
  }
  const prior=bridge.clone(); root.position.x+=.193; root.updateMatrixWorld();
  f.runtime.setFrame(frame({objectMatrix: root.matrixWorld})); f.runtime.onBeforeRender(null,null,camera);
  assert.equal(uniforms.uMeteorMeshToSource.value,bridge); assert.ok(!bridge.equals(prior));
});

test('native absent tangent is a source input default after skinning, with cache invalidation for channel changes', async () => {
  const row=meteorVariantRows.find(row=>row.stage==='vertex' && row.matching_programs.some(p=>meteorProgramData[p.source_sha256].activeInputs.includes('TANGENT0')));
  const f=fixture(row), original=f.mesh.geometry.getAttribute('tangent');
  f.mesh.geometry.deleteAttribute('tangent'); f.runtime.setFrame(frame()); f.runtime.configurePass(f.id,f.material,f.mesh,f.pass);
  assert.equal(f.mesh.geometry.getAttribute('tangent'),undefined);
  assert.equal(f.material.defines.METEOR_DEFAULT_TANGENT,1); assert.equal(f.material.defines.USE_TANGENT,undefined);
  const key=f.material.customProgramCacheKey(), version=f.material.version,selectedSections=f.pass.sections;
  f.mesh.geometry.setAttribute('tangent',original); f.runtime.setFrame(frame());
  assert.equal(f.material.defines.METEOR_DEFAULT_TANGENT,undefined); assert.equal(f.material.defines.USE_TANGENT,'');
  assert.notEqual(f.material.customProgramCacheKey(),key); assert.ok(f.material.version>version);
  assert.equal(f.pass.sections,selectedSections,'default tangent define changes do not rebuild unchanged source pair');
  f.mesh.geometry.deleteAttribute('tangent'); f.runtime.setFrame(frame()); assert.equal(f.material.customProgramCacheKey(),key);
  const source=(await readFile(new URL('../packages/garupa_runtime/shaders/meteor.glsl',import.meta.url),'utf8')).replaceAll('\r\n','\n');
  assert.match(source,/#ifdef METEOR_DEFAULT_TANGENT\nmeteor_sourceInput.TANGENT0 = vec4\(1.0, 0.0, 0.0, 1.0\);\n#else\nmeteor_sourceInput.TANGENT0 = vec4\(\(uMeteorMeshToSource \* vec4\(objectTangent, 0.0\)\).xyz, -tangent.w\);/);
});


test('validated selections reuse contents while in-place material metadata changes and new passes revalidate', () => {
  const row=meteorVariantRows.find(r=>r.stage==='vertex'&&r.shader==='Meteor/MeteorShader'&&r.pass_name==='ForwardLit');
  const f=fixture(row);f.pass.extras.materialKeywords=[...row.observed_material_keywords];f.runtime.setFrame(frame());f.runtime.configurePass(f.id,f.material,f.mesh,f.pass);
  const binding=f.runtime.passes.get(f.id),original=binding.selection,originalSections=f.pass.sections;
  f.runtime.setFrame(frame());assert.equal(binding.selection,original,'stable frame uses fully validated stage pair');assert.equal(f.pass.sections,originalSections,'same frame retains selected sections object');
  f.pass.extras.materialKeywords.push('_UNOBSERVED');
  assert.throws(()=>f.runtime.setFrame(frame()),/Unobserved/,'in-place material mutation must not reuse old selection');
  f.pass.extras.materialKeywords.pop();f.runtime.setFrame(frame());assert.equal(binding.selection,original);
  const other=meteorVariantRows.find(r=>r.stage==='vertex'&&r.shader===row.shader&&r.pass_name==='ForwardLit'&&JSON.stringify(r.observed_material_keywords)!==JSON.stringify(row.observed_material_keywords));
  f.pass.extras.materialKeywords.splice(0,f.pass.extras.materialKeywords.length,...other.observed_material_keywords);
  f.runtime.setFrame(frame());assert.notEqual(binding.selection,original,'different observed contents select and validate anew');
  const outline=meteorVariantRows.find(r=>r.stage==='vertex'&&r.shader===row.shader&&r.pass_name==='Outline'&&JSON.stringify(r.observed_material_keywords)===JSON.stringify(other.observed_material_keywords));
  assert.ok(outline);const material=new THREE.MeshStandardMaterial();material.userData.shader='garupa-meteor';
  f.runtime.configurePass(outline.stable_key,material,f.mesh,{sections:loadedSections(outline),extras:{materialKeywords:[...outline.observed_material_keywords]}});
  assert.ok(f.runtime.passes.get(outline.stable_key).selection,'pass added after first frame selects immediately');
});

test('cached void fragment selection still enforces modified ColorMask and explicit globals', () => {
  const row=meteorVariantRows.find(r=>r.stage==='vertex'&&r.pass_name==='DepthOnly');
  const f=fixture(row);f.runtime.setFrame(frame());f.runtime.configurePass(f.id,f.material,f.mesh,f.pass);
  const binding=f.runtime.passes.get(f.id);
  assert.equal(Object.keys(binding.programs[1].outputs).length,0);
  f.pass.renderState.colorMask=15;assert.throws(()=>f.runtime.setFrame(frame()),/Void source fragment/);
  f.pass.renderState.colorMask=0;f.runtime.setFrame(frame());
  assert.throws(()=>f.runtime.programSelection(binding,undefined),/explicit array/);
  assert.throws(()=>f.runtime.setFrame(frame({globalKeywords:[null]})),/explicit string array/);
});


test('unused legacy frame hints are harmless while unknown explicit source globals remain errors', () => {
  const f = fixture(), cube = new THREE.CubeTexture();
  f.runtime.configurePass(f.id, f.material, f.mesh, f.pass);
  assert.doesNotThrow(() => f.runtime.setFrame(frame({ specCube: cube, specCubeHDR: [1, 1, 0, 0],
    globalMipBias: [0, 0], lodFade: [.137, .371, .731, 1] })));
  assert.doesNotThrow(() => f.runtime.onBeforeRender(null, null, new THREE.PerspectiveCamera()));
  const uniforms = f.runtime.getUniforms(f.id);
  for (const name of ['uunity_SpecCube0_with_samplerunity_SpecCube0', 'u_UnityPerDraw_unity_SpecCube0_HDR',
    'u_FGlobals_GlobalMipBias', 'u_UnityPerDraw_unity_LODFade', 'u_FGlobals_AdditionalLightsCount']) {
    assert.equal(uniforms[name], undefined, `${name} is not retained by these source families`);
  }
  assert.throws(() => f.runtime.setFrame(frame({ uniforms: { u_FGlobals_AdditionalLightsCount: [0, 0, 0, 0] } })),
    /Unknown source global u_FGlobals_AdditionalLightsCount/);
  assert.throws(() => f.runtime.setFrame(frame({ uniforms: { u_UnknownSourceOverride: .371 } })),
    /Unknown source global u_UnknownSourceOverride/);
  cube.dispose();
});


test('real loaded section marker corruption, duplicate and missing selected program fail closed', () => {
  const row=meteorVariantRows.find(r=>r.stage==='vertex'&&r.shader==='Meteor/MeteorShader'&&r.pass_name==='ForwardLit');
  function actualProgramBlock(source) {
    const match=source.match(/^\/\/ @meteor-program (METEOR_(?:VERTEX|FRAGMENT)_[a-f0-9]{12})\n[\s\S]*?\n\/\/ @meteor-end \1(?=\n|$)/m);
    assert.ok(match);return match[0];
  }
  const malformed=fixture(row);
  malformed.pass.sections.vertexPrelude=malformed.pass.sections.vertexPrelude.replace(/\/\/ @meteor-end METEOR_VERTEX_[a-f0-9]{12}/,'// @meteor-end METEOR_VERTEX_deadbeefdead');
  assert.throws(()=>malformed.runtime.configurePass(malformed.id,malformed.material,malformed.mesh,malformed.pass),/Malformed|missing.*markers/);
  const badGuard=fixture(row);
  badGuard.pass.sections.vertexPrelude=badGuard.pass.sections.vertexPrelude.replace(/#if defined\(METEOR_VERTEX_[a-f0-9]{12}\)/,'#if defined(METEOR_VERTEX_deadbeefdead)');
  assert.throws(()=>badGuard.runtime.configurePass(badGuard.id,badGuard.material,badGuard.mesh,badGuard.pass),/Malformed Meteor section program/);
  const nested=fixture(row);
  nested.pass.sections.vertexPrelude=nested.pass.sections.vertexPrelude.replace(/(\/\/ @meteor-program METEOR_VERTEX_[a-f0-9]{12}\n)/,'$1// @meteor-program METEOR_VERTEX_deadbeefdead\n');
  assert.throws(()=>nested.runtime.configurePass(nested.id,nested.material,nested.mesh,nested.pass),/Malformed Meteor section program/);
  const duplicate=fixture(row);
  duplicate.pass.sections.vertexPrelude+='\n'+actualProgramBlock(duplicate.pass.sections.vertexPrelude);
  assert.throws(()=>duplicate.runtime.configurePass(duplicate.id,duplicate.material,duplicate.mesh,duplicate.pass),/Duplicate Meteor section program/);
  const missing=fixture(row);missing.runtime.setFrame(frame());
  const selected=missing.runtime.programSelection({pass:missing.pass,passId:missing.id},[]);
  const block=sectionCatalog[`${selected.fragment.program.define}_PRELUDE`];
  assert.ok(missing.pass.sections.fragmentPrelude.includes(block));missing.pass.sections.fragmentPrelude=missing.pass.sections.fragmentPrelude.replace(block,'');
  assert.throws(()=>missing.runtime.configurePass(missing.id,missing.material,missing.mesh,missing.pass),/fragmentPrelude has no named program/);
});

test('two standard-bound instances of one pass select different originals without changing registry sections', async () => {
  const rows=meteorVariantRows.filter(r=>r.stage==='fragment'&&r.shader==='Meteor/MeteorShader'&&r.pass_name==='ForwardLit');
  const first=rows[0],second=rows.find(row=>row.matching_programs[0].source_sha256!==first.matching_programs[0].source_sha256);
  assert.ok(second);const original=preparedShaders.get(familyNames[first.shader]).passes.find(pass=>pass.id===first.stable_key).sections,snapshot={...original};
  const a=await standardBoundFixture(first),b=await standardBoundFixture(second);
  try {
    a.runtime.setFrame(frame());b.runtime.setFrame(frame());
    assert.notEqual(a.binding.fragmentSha,b.binding.fragmentSha);
    assertCompiledPair(a.compile(),a.binding);assertCompiledPair(b.compile(),b.binding);
    const savedA=a.binding.pass.sections,savedB=b.binding.pass.sections,oldKey=a.material.customProgramCacheKey(),oldVersion=a.material.version;
    b.runtime.setFrame(frame());assert.equal(b.binding.pass.sections,savedB);
    a.binding.pass.extras.materialKeywords.splice(0,a.binding.pass.extras.materialKeywords.length,...second.observed_material_keywords);
    a.runtime.setFrame(frame());
    assert.notEqual(a.binding.pass.sections,savedA);assert.notEqual(a.material.customProgramCacheKey(),oldKey);assert.ok(a.material.version>oldVersion);
    assertCompiledPair(a.compile(),a.binding);assert.equal(b.binding.pass.sections,savedB);
    assertCompiledPair(b.compile(),b.binding);assert.equal(original,preparedShaders.get(familyNames[first.shader]).passes.find(pass=>pass.id===first.stable_key).sections);
    assert.deepEqual(original,snapshot,'prepared registry shared strings stay unchanged');
  }finally{a.dispose();b.dispose();}
});
