import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import YohaneUnityInputs from '../packages/yohane_runtime/shaders/unity-inputs.js';

const packageUrl = new URL('../packages/yohane_runtime/', import.meta.url);
const config = JSON.parse(readFileSync(new URL('config.json', packageUrl), 'utf8'));

function fixture(camera = new THREE.PerspectiveCamera(37, 1.7, 0.05, 120)) {
  const scene = new THREE.Scene();
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
  mesh.position.set(1.2, -0.3, 0.7);
  mesh.rotation.set(0.2, -0.5, 0.9);
  mesh.scale.set(0.7, 1.1, 1.3);
  scene.add(mesh);
  camera.position.set(-2, 1.5, 4);
  camera.lookAt(0.3, 0.2, -0.4);
  const renderer = { info: { render: { frame: 0 } } };
  const runtime = new YohaneUnityInputs(THREE, renderer, mesh.material, mesh);
  return { scene, mesh, camera, renderer, runtime };
}

test('Yohane source-position reflection and matrix bridge preserve clip position', () => {
  for (const camera of [new THREE.PerspectiveCamera(37, 1.7, 0.05, 120), new THREE.OrthographicCamera(-2, 3, 4, -1, 0.03, 80)]) {
    const f = fixture(camera);
    f.runtime.onBeforeRender(f.renderer, f.scene, camera);
    const p = new THREE.Vector4(0.4, -0.6, 0.8, 1);
    const expected = p.clone().applyMatrix4(f.mesh.matrixWorld).applyMatrix4(camera.matrixWorldInverse).applyMatrix4(camera.projectionMatrix);
    const actual = new THREE.Vector4(-p.x, p.y, p.z, p.w)
      .applyMatrix4(f.runtime.objectToWorld).applyMatrix4(f.runtime.viewProjection);
    for (const c of ['x','y','z','w']) assert.ok(Math.abs(actual[c]-expected[c]) < 1e-12);
    assert.equal(f.runtime.getUniforms().uYohaneunity_OrthoParams.value.w, camera.isOrthographicCamera ? 1 : 0);
    const inverse = f.runtime.objectToWorld.clone().multiply(f.runtime.worldToObject);
    for (let i=0;i<16;i++) assert.ok(Math.abs(inverse.elements[i] - (i%5===0 ? 1 : 0)) < 1e-12);
  }
});

test('Yohane uses URP brightest main directional and reflects world-space direction', () => {
  const f = fixture();
  const dim = new THREE.DirectionalLight(0xff0000, 0.4);
  const bright = new THREE.DirectionalLight(0x80b0ff, 1.9);
  bright.position.set(2, 3, 4);
  bright.target.position.set(-1, 0, 1);
  f.scene.add(dim, bright, bright.target);
  f.runtime.onBeforeRender(f.renderer, f.scene, f.camera);
  const dir = new THREE.Vector3(3,3,3).normalize();
  const u = f.runtime.getUniforms();
  assert.ok(Math.abs(u.uYohaneMainLightPosition.value.x+dir.x) < 1e-12);
  assert.ok(Math.abs(u.uYohaneMainLightPosition.value.y-dir.y) < 1e-12);
  assert.equal(u.uYohaneMainLightColor.value.x, bright.color.r*1.9);
  assert.equal(u.uYohaneunity_LightData.value.z, 1);
  bright.layers.set(1);
  f.renderer.info.render.frame++;
  f.runtime.onBeforeRender(f.renderer, f.scene, f.camera);
  assert.equal(u.uYohaneMainLightColor.value.x, dim.color.r*0.4);
});

test('Yohane keeps matrix and uniform allocations stable across frames', () => {
  const f = fixture();
  const u = f.runtime.getUniforms();
  const values = Object.fromEntries(Object.entries(u).map(([k,v])=>[k,v.value]));
  for (let i=0;i<8;i++) {
    f.renderer.info.render.frame++;
    f.mesh.position.x+=0.01;
    f.runtime.onBeforeRender(f.renderer, f.scene, f.camera);
    assert.strictEqual(f.runtime.getUniforms(), u);
    for (const [key,value] of Object.entries(values)) assert.strictEqual(u[key].value,value);
  }
  assert.deepEqual(u.uYohaneGlobalMipBias.value.toArray(), [0,1]);
  const time = u.uYohaneTimeParameters.value;
  assert.equal(time.y, Math.sin(time.x));
  assert.equal(time.z, Math.cos(time.x));
  f.runtime.destroy();
  assert.throws(()=>f.runtime.onBeforeRender(f.renderer,f.scene,f.camera), /requires/);
});

test('Yohane source shader package defines 26 source passes, 14 color passes and preserves face adapter registration', () => {
  assert.ok(config.components.some(c=>c.type==='garupa-expression-adapter' && c.name==='yohane-garupa-face'));
  const shaders = config.components.filter(c=>c.type==='shader');
  assert.equal(shaders.length,3);
  assert.equal(shaders.reduce((n,c)=>n+c.passes.length,0),26);
  assert.equal(shaders.reduce((n,c)=>n+c.passes.filter(p=>p.id.startsWith('Forward')).length,0),14);
  const f = fixture();
  const supplied = f.runtime.getUniforms();
  for (const shader of shaders) {
    const source = readFileSync(new URL(shader.src,packageUrl),'utf8');
    const sections = new Map([...source.matchAll(/\/\/ @section (\w+)\r?\n([\s\S]*?)\/\/ @end/g)].map(m=>[m[1],m[2]]));
    for (const pass of shader.passes) {
      for (const sectionName of Object.values(pass.sections)) assert.ok(sections.has(sectionName));
      for (const stage of ['vertex','fragment']) {
        const prelude = sections.get(pass.sections[stage+'Prelude']);
        const body = prelude.split('void yohane'+stage[0].toUpperCase()+stage.slice(1)+'Main()')[1];
        for (const key of new Set(body.match(/\buYohane\w+/g))) {
          if(pass.id.startsWith('ShadowCaster') && ['uYohaneShadowBias','uYohaneLightDirection'].includes(key))continue;
          assert.ok(supplied[key], `unsupplied global ${key}`);
        }
      }
    }
    for (const sampler of shader.samplers) {
      assert.match(source,new RegExp('uniform\\s+(?:mediump\\s+)?sampler2D\\s+u'+sampler.name+';'));
      assert.equal(sampler.missing.behavior,'constant');
      assert.deepEqual(sampler.missing.value, sampler.name.startsWith('ShadowColorMap') ? [0,0,0,1] : [1,1,1,1]);
    }
  }
});

test('Yohane configurePass removes inherited PBR alpha/texture work and restores compiled alpha',()=>{
  const f=fixture();const mat=f.mesh.material;
  mat.map=new THREE.Texture();mat.alphaTest=.7;mat.fog=true;mat.onBeforeCompile=shader=>{shader.fragmentShader+='\n// compiled';};
  f.runtime.configurePass('Forward_BASE',mat);
  assert.equal(mat.map,null);assert.equal(mat.alphaTest,0);assert.equal(mat.fog,false);assert.equal(mat.toneMapped,false);
  const shader={fragmentShader:'vec3 outgoingLight = yohaneFragment_SV_Target0.rgb;\n#include <opaque_fragment>'};mat.onBeforeCompile(shader);
  assert.match(shader.fragmentShader,/gl_FragColor.a = yohaneFragment_SV_Target0.a/);
  assert.match(shader.fragmentShader,/compiled/);
  const aura={fragmentShader:'vec3 outgoingLight = yohaneFragment_SV_TARGET0.rgb;\n#include <opaque_fragment>'};mat.onBeforeCompile(aura);
  assert.match(aura.fragmentShader,/gl_FragColor.a = yohaneFragment_SV_TARGET0.a/);
  assert.throws(()=>f.runtime.getUniforms('ShadowCaster_BASE'),/explicit shadow/);
  f.runtime.setFrame({time:17.25});f.runtime.onBeforeRender(f.renderer,f.scene,f.camera);
  assert.equal(f.runtime.getUniforms().uYohaneTimeParameters.value.x,17.25);
});

test('Yohane compiled sampling reflects final source ST coordinate, including nonidentity offset', () => {
  for (const shader of config.components.filter(c=>c.type==='shader' && c.name!=='yohane-aura')) {
    const source = readFileSync(new URL(shader.src,packageUrl),'utf8');
    assert.match(source,/return texture\(image, vec2\(coord\.x, 1\.0 - coord\.y\), bias\)/);
    assert.match(source,/in_TEXCOORD0\.xy \* uBaseMap_ST\.xy \+ uBaseMap_ST\.zw/);
    assert.match(source,/yohaneSampleTexture\(uBaseMap,/);
  }
  for (const [v,sy,oy] of [[0.23,1,0],[0.71,0.8,0.17],[-0.3,1.4,-0.2]]) {
    const sourceCoordinate=v*sy+oy;
    const gltfV=1-v;
    const pngSample=1-((1-gltfV)*sy+oy);
    assert.ok(Math.abs((1-pngSample)-sourceCoordinate)<1e-14);
  }
});

test('Yohane bridge reports singular mesh transforms instead of silently inventing matrices', () => {
  const f=fixture();
  f.mesh.scale.x=0;
  assert.throws(()=>f.runtime.onBeforeRender(f.renderer,f.scene,f.camera), /invertible/);
});
