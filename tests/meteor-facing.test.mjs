import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import test from 'node:test';
import {Euler,Matrix4,OrthographicCamera,PerspectiveCamera,Quaternion,Vector3,Vector4} from 'three';
import {meteorCoordinateMatrices,meteorMetalClipToGL} from '../packages/garupa_runtime/shaders/meteor-coordinates.js';

const S=new Matrix4().makeScale(-1,1,1);
const area2=points=>{const [a,b,c]=points;return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);};
function example(orthographic,negativeScale) {
 const camera=orthographic?new OrthographicCamera(-2.9,4.3,3.1,-1.7,.093,176.2):new PerspectiveCamera(47.3,1.731,.137,231.5);
 camera.position.set(1.193,.731,5.371);camera.lookAt(.137,-.239,.371);camera.updateMatrixWorld(true);
 const mesh=new Matrix4().compose(new Vector3(.371,-.239,.193),new Quaternion().setFromEuler(new Euler(.137,-.317,.193)),new Vector3(negativeScale?-1.37:1.37,.71,1.19));
 const root=new Matrix4().compose(new Vector3(-.719,1.137,.431),new Quaternion().setFromEuler(new Euler(-.239,.731,-.371)),new Vector3(.83,1.91,.63));
 const matrices=meteorCoordinateMatrices({modelMatrix:mesh,objectMatrix:root,viewMatrix:camera.matrixWorldInverse,projectionMatrix:camera.projectionMatrix});
 // Same geometric source vertices, original Unity index order [0,1,2]. The
 // stored glTF vertex positions have X reflected; only index order is reversed.
 const unityVertices=[[-.713,-.371,.137],[.193,.731,.239],[.891,-.239,-.137]];
 const clips=unityVertices.map(v=>new Vector4(-v[0],v[1],v[2],1).applyMatrix4(matrices.meshToSource).applyMatrix4(matrices.objectToWorld).applyMatrix4(matrices.viewProjection));
 const sourceNdc=clips.map(v=>[v.x/v.w,v.y/v.w,v.z/v.w]);
 const targetNdc=clips.map(meteorMetalClipToGL).map(v=>[v.x/v.w,v.y/v.w,v.z/v.w]);
 const width=947,height=613;
 const metalPixels=sourceNdc.map(([x,y])=>[(x+1)*width/2,(1-y)*height/2]);
 const glPixels=[0,2,1].map(i=>[(targetNdc[i][0]+1)*width/2,(targetNdc[i][1]+1)*height/2]);
 return {orthographic,negativeScale,meshDeterminant:mesh.determinant(),rootDeterminant:root.determinant(),unityVertices,sourceNdc,targetNdc,metalPixels,glPixels,metalNumericArea2:area2(metalPixels),glNumericArea2:area2(glPixels),nativeDefaultCW:area2(metalPixels)>0,targetDefaultCCW:area2(glPixels)>0};
}
export const facingExamples=[false,true].flatMap(o=>[false,true].map(n=>example(o,n)));

test('original index order + Metal y-down equals converted reversed indices + GL y-up signed area',()=>{
 for(const row of facingExamples){
  assert.ok(Math.abs(row.metalNumericArea2)>1000,'nondegenerate nonendpoint triangle');
  assert.ok(Math.abs(row.metalNumericArea2-row.glNumericArea2)<1e-8);
  assert.equal(row.nativeDefaultCW,row.targetDefaultCCW);
  row.sourceNdc.forEach((v,i)=>{assert.equal(v[0],row.targetNdc[i][0]);assert.equal(v[1],row.targetNdc[i][1]);});
 }
 // Turning the example over changes both classifiers; not just one all-front fixture.
 assert.notEqual(facingExamples[0].nativeDefaultCW,facingExamples[1].nativeDefaultCW);
});
test('visual CW has opposite area signs in up/down coordinate descriptions',()=>{
 const visuallyCW=[[.137,.731],[.891,.193],[-.371,-.239]];
 assert.ok(area2(visuallyCW)<0);
 assert.ok(area2(visuallyCW.map(([x,y])=>[x,-y]))>0);
});
test('Three BackSide and determinant flips require conditional facing parity, not a universal negation',async()=>{
 const state=await readFile(new URL('../node_modules/three/src/renderers/webgl/WebGLState.js',import.meta.url),'utf8');
 const renderer=await readFile(new URL('../node_modules/three/src/renderers/WebGLRenderer.js',import.meta.url),'utf8');
 assert.match(state,/let flipSided = \( material.side === BackSide \);\s*if \( frontFaceCW \) flipSided = ! flipSided;/);
 assert.match(renderer,/frontFaceCW = \( object.isMesh && object.matrixWorld.determinantAffine\(\) < 0 \)/);
 for(const baseFacing of [false,true])for(const backside of [false,true])for(const negative of [false,true])for(const nativeFlip of [false,true]) {
  const glFacing=baseFacing!== (backside!==negative);
  const restored=glFacing!==((backside!==negative)!==nativeFlip);
  assert.equal(restored,baseFacing!==nativeFlip);
 }
});

if(process.env.METEOR_WRITE_FACING_EVIDENCE==='1'){
 const references=[
 '../../webgal-lovelive-model-converter/converter/common/normalized_model.py',
 '../packages/garupa_runtime/shaders/meteor-coordinates.js',
 '../packages/garupa_runtime/shaders/meteor-runtime.js',
 '../node_modules/three/src/renderers/webgl/WebGLState.js',
 '../node_modules/three/src/renderers/WebGLRenderer.js',
 '../../webgal-lovelive-gltf-renderer/src/unity-render-state.js'];
 const sourceHashes=[];for(const relative of references){const url=new URL(relative,import.meta.url);const bytes=await readFile(url);sourceHashes.push({path:url.pathname,sha256:createHash('sha256').update(bytes).digest('hex')});}
 await writeFile(new URL('../../validation/front-facing-adapter-evidence.json',import.meta.url),JSON.stringify({status:'CONDITIONAL_MATH_PROVED_NATIVE_DRAW_STATE_UNRESOLVED',gpuRun:false,productionChanged:false,formula:'sourceFrontFacing = gl_FrontFacing XOR (BackSide XOR det(meshWorld)<0) XOR nativeMetalFlipRelativeToDefaultCW',conditions:['matching per-vertex source clip XY','converted indices reverse original triangle order','Metal upper-left positive-size viewport','GL lower-left positive-size viewport'],examples:facingExamples,sourceHashes,missingEvidence:['original menu Metal draw setFrontFacing winding including camera/target inversion','native SMR negative determinant winding flag and whether it follows renderer/root/skinning frame','original menu GL.invertCulling / CommandBuffer.SetInvertCulling effective state, not just method presence']},null,2)+'\n');
}
