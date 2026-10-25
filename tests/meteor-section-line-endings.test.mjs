import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {ShaderRegistry} from 'webgal-lovelive-gltf-renderer/parameterized-renderer.js';
import {prepareMeteorSections,selectMeteorSections} from '../packages/garupa_runtime/shaders/meteor-sections.js';

test('real package sections load and select identical programs from LF and Windows CRLF files',async()=>{
 const config=JSON.parse(await readFile(new URL('../packages/garupa_runtime/config.json',import.meta.url),'utf8'));
 const source=await readFile(new URL('../packages/garupa_runtime/shaders/meteor.glsl',import.meta.url),'utf8');
 const normalized=source.replaceAll('\r\n','\n');
 const results=[];
 for(const text of [normalized,normalized.replaceAll('\n','\r\n')]){
  const registry=new ShaderRegistry();
  registry.registerPackage(config,{source:'https://assets.invalid/runtime/config.json',loadText:async()=>text,loadModule:async()=>({})});
  const shader=await registry.loadShader('garupa-meteor');
  const prepared=prepareMeteorSections(shader.passes[0].sections);
  const vertex=[...prepared.vertexPrelude.programs][0],fragment=[...prepared.fragmentPrelude.programs][0];
  const selected=selectMeteorSections(prepared,vertex,fragment);
  assert.ok(selected.vertexPrelude.includes(vertex));assert.ok(selected.fragmentPrelude.includes(fragment));
  results.push(selected);
 }
 assert.deepEqual(results[1],results[0]);
});
