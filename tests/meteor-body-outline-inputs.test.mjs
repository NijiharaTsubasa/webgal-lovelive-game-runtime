import test from 'node:test';
import assert from 'node:assert/strict';
import {Matrix4,Vector4,Vector3,PerspectiveCamera} from 'three';
import {instrumentBodyVertex,feedbackFields} from './fixtures/meteor-body-outline-feedback.mjs';
import {expectedSourceInput,bodyOutlineReference,compareVector} from './helpers/meteor-outline-reference.mjs';
import {meteorMetalProjection} from '../packages/garupa_runtime/shaders/meteor-coordinates.js';

test('single-program instrumentation retains original vertex body and adds only five feedback outputs',()=>{
 const body='void main() {\n gl_Position=vec4(1.0);\n}\n';const result=instrumentBodyVertex(body);
 assert.ok(result.includes(body.slice(0,body.lastIndexOf('}'))));
 assert.equal(feedbackFields.length,5);for(const field of feedbackFields)assert.match(result,new RegExp(`out highp vec4 ${field};`));
 assert.match(result,/mDiagNormal=vec4\(meteor_sourceInput.NORMAL0.xyz,0.0\)/);
 assert.match(result,/mDiagSourceClip=meteor_sourceOutput.mtl_Position/);
 assert.doesNotMatch(result,/Math\.fround|uintBits|Recalculate/);
 assert.throws(()=>instrumentBodyVertex('void main(){} bad ending'),/ending/);
});

test('CPU input relation follows weighted Three skin matrices and direction w0 at non-endpoints',()=>{
 const identity=new Matrix4(),bone=new Matrix4().makeRotationZ(.371).setPosition(.137,-.239,.731),bridge=new Matrix4().makeRotationY(-.317).setPosition(-.193,.371,.239);
 const sample={position:[.137,-.719,.371],normal:[.239,.731,-.371],joints:[0,1,0,0],weights:[.371,.629,0,0]};
 const input={bones:{0:identity.toArray(),1:bone.toArray()},bindMatrix:identity.toArray(),bindMatrixInverse:identity.toArray(),influences:[],morphPositionEnabled:false,morphNormalEnabled:false};
 const actual=expectedSourceInput(sample,input,{uMeteorMeshToSource:bridge.toArray()});
 const weighted=new Matrix4();weighted.elements=identity.elements.map((v,i)=>v*.371+bone.elements[i]*.629);
 const normal=new Vector4(...sample.normal,0).applyMatrix4(weighted);normal.w=0;normal.applyMatrix4(bridge);
 const position=new Vector4(...sample.position,1).applyMatrix4(weighted);position.w=1;position.applyMatrix4(bridge);
 assert.equal(compareVector(actual.position,position.toArray(),1e-12,1e-12).passed,true);
 assert.equal(compareVector(actual.normal,normal.toArray(),1e-12,1e-12).passed,true);
 assert.equal(actual.normal[3],0);assert.equal(compareVector([NaN],[0]).passed,false);
 assert.equal(compareVector([.137],[.137,.371]).passed,false);
 assert.equal(compareVector([.137],[Infinity]).passed,false);
});

test('literal Outline depth override keeps XYW, shifts depth farther, and extrudes along source normal',()=>{
 const identity=new Matrix4(),camera=new PerspectiveCamera(35,1.731,.3,1000),p=meteorMetalProjection(camera.projectionMatrix);
 const cols=m=>[0,1,2,3].map(i=>m.elements.slice(i*4,i*4+4));
 const u={u_UnityPerDraw_hlslcc_mtx4x4unity_ObjectToWorld:cols(identity),u_UnityPerDraw_hlslcc_mtx4x4unity_WorldToObject:cols(identity),u_VGlobals_hlslcc_mtx4x4unity_MatrixV:cols(identity),u_VGlobals_hlslcc_mtx4x4unity_MatrixVP:cols(p),u_VGlobals_hlslcc_mtx4x4glstate_matrix_projection:cols(p),u_VGlobals_hlslcc_mtx4x4unity_CameraProjection:cols(camera.projectionMatrix),u_VGlobals_unity_OrthoParams:[0,0,0,0],u_OutlineWidth:0,u_OutlineZOffset:.3};
 const position=[.137,-.239,-3.719,1],normal=[.371,.731,.137,0],raw=new Vector4(...position).applyMatrix4(camera.projectionMatrix);
 const baseline=bodyOutlineReference(position,normal,0,u),shifted=bodyOutlineReference(position,normal,.731,u);
 for(const i of [0,1,3])assert.ok(Math.abs(baseline.glClip[i]-raw.toArray()[i])<1e-12);
 assert.ok(shifted.glClip[2]/shifted.glClip[3]>baseline.glClip[2]/baseline.glClip[3]);
 const outline=bodyOutlineReference(position,normal,.731,{...u,u_OutlineWidth:1});
 const delta=new Vector3(...outline.expandedWorldPosition).sub(new Vector3(...position.slice(0,3)));
 assert.ok(delta.dot(new Vector3(...normal.slice(0,3)))>0);
 assert.ok(Math.abs(delta.length()-outline.width)<1e-12);
});
