import {performance} from 'node:perf_hooks';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import os from 'node:os';
import * as THREE from 'three';
import {meteorVariantRows} from '../packages/garupa_runtime/shaders/meteor-variant-data.js';

const shaders=new URL('../packages/garupa_runtime/shaders/',import.meta.url);
const snapshot=new URL('../../.tmp/variant-selection-performance/baseline.json',import.meta.url);
if(process.argv.includes('--snapshot'))await writeFile(snapshot,JSON.stringify(Object.fromEntries(await Promise.all(['meteor-variants.js','meteor-runtime.js'].map(async name=>[name,await readFile(new URL(name,shaders),'utf8')])))),{flag:'wx'});
const originals=JSON.parse(await readFile(snapshot,'utf8'));
const dataURL=source=>'data:text/javascript;base64,'+Buffer.from(source).toString('base64');
const absoluteImports=source=>source.replace(/from '(\.\/[^']+)'/g,(_,relative)=>`from '${new URL(relative,shaders).href}'`);
const legacyVariantsURL=dataURL(absoluteImports(originals['meteor-variants.js']));
const legacyVariant=await import(legacyVariantsURL);
const legacyRuntime=await import(dataURL(absoluteImports(originals['meteor-runtime.js']).replace(new URL('meteor-variants.js',shaders).href,legacyVariantsURL)));
const currentVariant=await import(new URL('meteor-variants.js',shaders));
const currentRuntime=await import(new URL('meteor-runtime.js',shaders));
const vertices=meteorVariantRows.filter(r=>r.stage==='vertex');
const rows=vertices.map(row=>({row,globals:[...row.matching_programs].sort((a,b)=>a.non_material_keywords.length-b.non_material_keywords.length)[0].non_material_keywords}));
const family={'Meteor/MeteorShader':'garupa-meteor','Meteor/MeteorShaderOffset':'garupa-meteor-offset','Meteor/MeteorShaderTransparent':'garupa-meteor-transparent'};
const materialCount=new Set(rows.map(({row:r})=>JSON.stringify([r.shader,r.observed_material_keywords]))).size;
const frame=g=>({targetHeight:1080,globalKeywords:g,ambientRGB:[.137,.239,.371],mainLightPosition:[1.371,-.239,3.719,0],mainLightColor:[.731,.317,.193,1],specCubeHDR:[1,1,0,0],globalMipBias:[0,0]});
function fixtures(Runtime) {
 const groups=new Map();
 for(const {row} of rows){
  const key=JSON.stringify([row.shader,row.observed_material_keywords]);
  let item=groups.get(key);
  if(!item){
   const material=new THREE.MeshStandardMaterial();material.userData.shader=family[row.shader];
   const geometry=new THREE.BufferGeometry();for(const [name,width]of [['position',3],['normal',3],['tangent',4],['_source_uv0',2],['_source_uv1',2]])geometry.setAttribute(name,new THREE.Float32BufferAttribute(new Float32Array(width*3),width));
   const mesh=new THREE.Mesh(geometry,material),runtime=new Runtime(THREE,null,material,mesh);
   item={runtime,globals:['EVALUATE_SH_VERTEX'],bindings:[],frame:frame(['EVALUATE_SH_VERTEX']),materials:[material],geometry,mesh};groups.set(key,item);
  }
  const passMaterial=item.bindings.length?item.materials[0].clone():item.materials[0];
  if(item.bindings.length)item.materials.push(passMaterial);
  item.runtime.configurePass(row.stable_key,passMaterial,item.mesh,{extras:{materialKeywords:[...row.observed_material_keywords]},renderState:{colorMask:row.pass_name==='DepthOnly'?0:15}});
  item.bindings.push(item.runtime.passes.get(row.stable_key));
 }
 return [...groups.values()];
}
function stats(values) {const a=values.slice().sort((a,b)=>a-b);return{medianMs:a[Math.floor(a.length*.5)],p95Ms:a[Math.floor(a.length*.95)],minMs:a[0],maxMs:a.at(-1),samples:a.length};}
let sink=0;
function measure(callback,{warmup=25,samples=100}={}) {for(let i=0;i<warmup;i++)callback();const out=[];for(let i=0;i<samples;i++){const start=performance.now();callback();out.push(performance.now()-start);}return stats(out);}
const stageRequest=({row,globals},stage)=>({shader:row.shader,pass:row.stable_key,stage,materialKeywords:row.observed_material_keywords,globalKeywords:globals});
const result={scope:`CPU-only microbenchmark, ${materialCount} material runtime instances / ${rows.length} material-pass metadata; not a 1/5 actor frame prediction`,environment:{node:process.version,cpu:os.cpus()[0].model,platform:process.platform},dataset:{variantRows:meteorVariantRows.length,materials:materialCount,passes:rows.length,sha256:createHash('sha256').update(JSON.stringify(rows)).digest('hex')},method:{warmupSweeps:25,sampleSweeps:100,unit:`ms per full ${rows.length}-pass sweep`,selectionCallsPerSweep:rows.length*2,runtimeInstances:materialCount,globalKeywords:['EVALUATE_SH_VERTEX'],scene:'No renderer/GPU, fixed fixture frame inputs; lighting/uniform updates included only in fullSetFrame'},results:{},sourceHashes:{baseline:{},current:{}}};
for(const [label,variant,Runtime]of [['baseline',legacyVariant,legacyRuntime.default],['current',currentVariant,currentRuntime.default]]) {
 const items=fixtures(Runtime);
 try {
 result.results[label]={selectStages:measure(()=>{for(const item of rows)for(const stage of ['vertex','fragment'])sink+=variant.selectMeteorVariant(stageRequest(item,stage)).program_slot;}),programSelection:measure(()=>{for(const item of items)for(const binding of item.bindings)sink+=item.runtime.programSelection(binding,item.globals).vertex.sha.length;}),fullSetFrame:measure(()=>{for(const item of items)item.runtime.setFrame(item.frame);})};
 // Exact split reference: keep all frame/uniform work but reuse the already
 // verified selection object. This is measurement instrumentation, not a
 // proposed production bypass of validation/keyword changes.
 const saved=new Map(items.flatMap(item=>item.bindings.map(binding=>[binding,item.runtime.programSelection(binding,item.globals)])));
 items.forEach(item=>{item.runtime.programSelection=binding=>saved.get(binding);});
 result.results[label].uniformFrameWorkWithFixedSelection=measure(()=>{for(const item of items)item.runtime.setFrame(item.frame);});
 }finally{for(const item of items){item.runtime.destroy?.();item.materials.forEach(material=>material.dispose());item.geometry.dispose();}}
 for(const name of ['meteor-variants.js','meteor-runtime.js'])result.sourceHashes[label][name]=createHash('sha256').update(label==='baseline'?originals[name]:await readFile(new URL(name,shaders),'utf8')).digest('hex');
}
result.sink=sink;
const output=new URL('../../validation/variant-selection-performance.json',import.meta.url);
await writeFile(output,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({dataset:result.dataset,results:result.results},null,2));
