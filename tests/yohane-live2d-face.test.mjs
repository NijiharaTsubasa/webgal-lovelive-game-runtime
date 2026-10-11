import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createExpressionAdapter,yohaneFaceControls} from '../packages/yohane_runtime/adapters/yohane-live2d-face.js';

function fixture(shared) {
  // Independent facial islands in the source model's X/Z facial plane.
  const points=[[-.04,0,.10],[-.03,0,.11],[-.02,0,.10],[.02,0,.10],[.03,0,.11],[.04,0,.10],
    [-.04,0,.13],[-.03,0,.135],[-.02,0,.13],[.02,0,.13],[.03,0,.135],[.04,0,.13],
    [-.02,0,.04],[0,0,.045],[.02,0,.04]];
  const geometry=shared??new THREE.BufferGeometry();
  if(!shared) {
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(points.flat(),3));
    geometry.setAttribute('normal',new THREE.Float32BufferAttribute(points.flatMap(()=>[0,-1,0]),3));
    geometry.setIndex(points.map((_,i)=>i));geometry.morphTargetsRelative=true;
    const delta=(name,fn)=>{const attribute=new THREE.Float32BufferAttribute(points.flatMap(fn),3);attribute.name=name;return attribute;};
    geometry.morphAttributes.position=[
      delta('normal',()=>[0,0,0]),delta('eye_close',(_,i)=>[0,0,i<6?-.006:0]),
      delta('mouth_open',(_,i)=>[0,0,i>=12?-.007:0]),
      delta('smile',([x],i)=>[0,0,i<6?-.002:i>=12?Math.abs(x)*.1:0]),
      delta('sad',([x],i)=>[0,0,i>=12?-Math.abs(x)*.1:i>=6?.002:0]),
      delta('eyebrow_up',(_,i)=>[0,0,i>=6&&i<12?.002:0]),
      delta('eye_close_smile',(_,i)=>[0,0,i<6?-.005:0]),
      delta('ApplicationDecoration',()=>[0,.003,0]),
    ];
  }
  const root=new THREE.Group(), mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial());root.add(mesh);
  const part={root,role:'integrated',component:{motionGroup:'yohane'}};
  return {root,mesh,geometry,context:{THREE,root,parts:[part]}};
}
const vertex=(mesh,i)=>new THREE.Vector3().fromBufferAttribute(mesh.geometry.attributes.position,i).toArray();

test('Yohane adapter is selected by motionGroup and accepts missing optional source parameters',()=>{
  const f=fixture();f.context.parts[0].component.motionGroup='other';assert.equal(createExpressionAdapter(f.context),null);
  const controls=yohaneFaceControls({PARAM_EYE_L_OPEN:2,PARAM_MOUTH_OPEN_Y:-.2,PARAM_TEAR:1});
  assert.equal(controls.eyes.L.open,1.5);assert.equal(controls.eyes.R.open,1);assert.equal(controls.mouth.open,0);
  assert.throws(()=>yohaneFaceControls({PARAM_BROW_L_Y:NaN}),/Non-finite/);
});

test('left/right blink, mouth and brows are independently controlled at non-endpoints',()=>{
  const f=fixture(), adapter=createExpressionAdapter(f.context);
  adapter.apply({PARAM_EYE_L_OPEN:.35,PARAM_EYE_R_OPEN:1,PARAM_MOUTH_OPEN_Y:.6,PARAM_BROW_R_Y:.5});
  assert.ok(vertex(f.mesh,3)[2]<.10);assert.equal(vertex(f.mesh,0)[2],f.geometry.attributes.position.getZ(0));
  assert.ok(vertex(f.mesh,12)[2]<.04);assert.ok(vertex(f.mesh,6)[2]>.13);
  assert.equal(vertex(f.mesh,9)[2],f.geometry.attributes.position.getZ(9));
  adapter.dispose();
});

test('direct facial driving restores native weights and preserves unrelated Morphs and shared geometry',()=>{
  const f=fixture(), other=fixture(f.geometry), baseline=Array.from(f.geometry.attributes.position.array);
  f.mesh.morphTargetInfluences[3]=.7;f.mesh.morphTargetInfluences[7]=.4;
  const weights=[...f.mesh.morphTargetInfluences], adapter=createExpressionAdapter(f.context);
  adapter.apply({PARAM_MOUTH_FORM_01:-.8,PARAM_MOUTH_OPEN_Y:.5});
  assert.equal(f.mesh.morphTargetInfluences[3],0);assert.equal(f.mesh.morphTargetInfluences[7],.4);
  assert.equal(other.mesh.geometry,f.geometry);assert.deepEqual(Array.from(f.geometry.attributes.position.array),baseline);
  adapter.restore();assert.equal(f.mesh.geometry,f.geometry);assert.deepEqual(f.mesh.morphTargetInfluences,weights);
  adapter.apply({PARAM_MOUTH_FORM_01:.5});adapter.dispose();
  assert.equal(f.mesh.geometry,f.geometry);assert.deepEqual(f.mesh.morphTargetInfluences,weights);
});

test('unchanged parameter frames reuse derived geometry without another upload',()=>{
  const f=fixture(), adapter=createExpressionAdapter(f.context), parameters={PARAM_EYE_L_OPEN:.7,PARAM_BROW_L_FORM:-.5};
  adapter.apply(parameters);const privateGeometry=f.mesh.geometry, version=privateGeometry.attributes.position.version;
  const positions=Array.from(privateGeometry.attributes.position.array);
  adapter.restore();adapter.apply(parameters);
  assert.equal(f.mesh.geometry,privateGeometry);assert.equal(privateGeometry.attributes.position.version,version);
  assert.deepEqual(Array.from(privateGeometry.attributes.position.array),positions);
  adapter.dispose();
});

test('parameter face works over nonzero native underlays without accumulating deformation',()=>{
  const f=fixture(), adapter=createExpressionAdapter(f.context);
  const parameters={PARAM_EYE_L_OPEN:0,PARAM_EYE_L_SMILE:1,PARAM_EYE_R_OPEN:.25,
    PARAM_MOUTH_FORM_01:1,PARAM_MOUTH_SCALE:-1,PARAM_BROW_L_ANGLE:1};
  adapter.apply(parameters);const first=Array.from(f.mesh.geometry.attributes.position.array);
  for(let i=0;i<60;i++) {adapter.restore();f.mesh.morphTargetInfluences[4]=i/60;adapter.apply(parameters);}
  assert.deepEqual(Array.from(f.mesh.geometry.attributes.position.array),first);assert.ok(first.every(Number.isFinite));
  adapter.dispose();assert.equal(f.mesh.morphTargetInfluences[4],59/60);
});

test('coarse heads bind separate eyebrow islands without dedicated eyebrow Morphs',()=>{
  const f=fixture();delete f.mesh.morphTargetDictionary.eyebrow_up;
  // Include the surrounding face surface so each brow is a small island,
  // as it is in the exported head rather than a fifth of this tiny fixture.
  for (const name of ['position','normal']) {
    const source=f.geometry.attributes[name];
    f.geometry.setAttribute(name,new THREE.Float32BufferAttribute([...source.array,...new Float32Array(60)],3));
  }
  f.geometry.morphAttributes.position=f.geometry.morphAttributes.position.map(source=>
    new THREE.Float32BufferAttribute([...source.array,...new Float32Array(60)],3));
  const adapter=createExpressionAdapter(f.context);
  adapter.apply({PARAM_BROW_L_Y:.7,PARAM_BROW_R_Y:-.5});
  assert.ok(vertex(f.mesh,9)[2]>.13);assert.ok(vertex(f.mesh,6)[2]<.13);
  assert.equal(vertex(f.mesh,0)[2],f.geometry.attributes.position.getZ(0));
  adapter.dispose();
});

test('static armor has no adapter and pupil gaze never modifies the source geometry',()=>{
  const f=fixture();f.mesh.morphTargetDictionary={};assert.equal(createExpressionAdapter(f.context),null);
  const head=fixture();const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute([.03,0,.09,.04,0,.10,.05,0,.09],3));
  geometry.morphTargetsRelative=true;geometry.morphAttributes.position=[new THREE.Float32BufferAttribute(new Float32Array(9),3)];
  geometry.morphAttributes.position[0].name='normal';
  const eye=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial());eye.name='eye_L';head.root.add(eye);
  const adapter=createExpressionAdapter(head.context);
  adapter.apply({PARAM_EYE_BALL_X:.7,PARAM_EYE_BALL_Y:-.6,PARAM_EYE_SCALE:.5});
  assert.ok(vertex(eye,1)[0]>.04);assert.ok(vertex(eye,1)[2]<.10);
  assert.equal(geometry.attributes.position.getX(1),Math.fround(.04));
  adapter.dispose();assert.equal(eye.geometry,geometry);
});

test('a closed eye retains its covered pupil position and resumes gaze when opened',()=>{
  const f=fixture(), geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute([.02,0,.09,.03,0,.10,.04,0,.09],3));
  geometry.morphTargetsRelative=true;
  geometry.morphAttributes.position=[new THREE.Float32BufferAttribute(new Float32Array(9),3)];
  geometry.morphAttributes.position[0].name='normal';
  const eye=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial());eye.name='eye_L';f.root.add(eye);
  const adapter=createExpressionAdapter(f.context);
  const gaze={PARAM_EYE_BALL_X:1,PARAM_EYE_BALL_Y:1,PARAM_EYE_SCALE:1};
  adapter.apply({...gaze,PARAM_EYE_L_OPEN:0});
  assert.deepEqual(Array.from(eye.geometry.attributes.position.array),Array.from(geometry.attributes.position.array));
  adapter.apply({...gaze,PARAM_EYE_L_OPEN:1});
  assert.ok(vertex(eye,1)[0]>geometry.attributes.position.getX(1));
  adapter.dispose();
});

test('detached expressive eyelashes with zero blink deltas are not moved by eyebrow parameters',()=>{
  const f=fixture();delete f.mesh.morphTargetDictionary.eyebrow_up;
  const lashes=[[-.04,0,.12],[-.03,0,.122],[-.02,0,.12],[.02,0,.12],[.03,0,.122],[.04,0,.12]];
  const padding=new Float32Array(60);
  f.geometry.setAttribute('position',new THREE.Float32BufferAttribute([
    ...f.geometry.attributes.position.array,...lashes.flat(),...padding],3));
  f.geometry.setAttribute('normal',new THREE.Float32BufferAttribute([
    ...f.geometry.attributes.normal.array,...lashes.flatMap(()=>[0,-1,0]),...padding],3));
  f.geometry.setIndex([...f.geometry.index.array,15,16,17,18,19,20]);
  f.geometry.morphAttributes.position=f.geometry.morphAttributes.position.map((source,index)=>{
    const array=[...source.array,...lashes.flatMap(()=>[0,0,index===4?.002:0]),...padding];
    // A real eyebrow can also move in the original closed-eye pose.
    if(index===1)for(let vertex=6;vertex<12;vertex++)array[vertex*3+2]=.002;
    return new THREE.Float32BufferAttribute(array,3);
  });
  const adapter=createExpressionAdapter(f.context);
  adapter.apply({PARAM_BROW_L_Y:1,PARAM_BROW_R_Y:-1,PARAM_BROW_L_FORM:.5});
  for(let i=15;i<21;i++)assert.deepEqual(vertex(f.mesh,i),vertex({geometry:f.geometry},i));
  assert.ok(vertex(f.mesh,9)[2]>.13);assert.ok(vertex(f.mesh,6)[2]<.13);
  adapter.dispose();
});

test('eye openness follows the full closure channel even for low eyelash vertices',()=>{
  const f=fixture();f.geometry.attributes.position.setZ(0,.03);
  const adapter=createExpressionAdapter(f.context);
  adapter.apply({PARAM_EYE_R_OPEN:0});
  assert.ok(Math.abs(vertex(f.mesh,0)[2]-(Math.fround(.03)-.006))<1e-7);
  adapter.dispose();
});

test('mouth form preserves coincident closed lip vertices when the source smile opens them',()=>{
  const f=fixture();
  f.geometry.attributes.position.setXYZ(12,-.02,0,.04);
  f.geometry.attributes.position.setXYZ(14,-.02,0,.04);
  f.geometry.morphAttributes.position[3].setZ(14,.008);
  const adapter=createExpressionAdapter(f.context);
  for(const form of [-1,-.3,.25,.8,1]){
    adapter.apply({PARAM_MOUTH_FORM_01:form,PARAM_MOUTH_OPEN_Y:0});
    assert.deepEqual(vertex(f.mesh,12),vertex(f.mesh,14));
  }
  adapter.dispose();
});

test('brow deformation keeps the face-side duplicate of an island seam attached',()=>{
  const f=fixture();
  // The face-side seam has no eyebrow delta, but shares the island boundary.
  f.geometry.attributes.position.setXYZ(0,-.04,0,.13);
  const adapter=createExpressionAdapter(f.context);
  adapter.apply({PARAM_BROW_R_Y:-.4,PARAM_BROW_R_X:-.34,PARAM_BROW_R_ANGLE:.66});
  assert.deepEqual(vertex(f.mesh,0),vertex(f.mesh,6));
  adapter.dispose();
});

test('wide-eye morph preserves the coincident skin and eyebrow seam',()=>{
  const f=fixture();
  f.geometry.attributes.position.setXYZ(0,-.04,0,.13);
  const surprise=new THREE.Float32BufferAttribute(new Float32Array(f.geometry.attributes.position.array.length),3);
  surprise.name='surprise';surprise.setY(0,.004);surprise.setY(6,.004);
  f.geometry.morphAttributes.position.push(surprise);f.mesh.updateMorphTargets();
  const adapter=createExpressionAdapter(f.context);
  for(const open of [1.1,1.25,1.5]){
    adapter.apply({PARAM_EYE_R_OPEN:open,PARAM_BROW_R_Y:-.4});
    assert.deepEqual(vertex(f.mesh,0),vertex(f.mesh,6));
  }
  adapter.dispose();
});

test('mouth form does not widen outer cheeks included in the source opening channel',()=>{
  const f=fixture();
  f.geometry.attributes.position.setXYZ(6,-.08,0,.04);
  f.geometry.morphAttributes.position[2].setZ(6,-.001);
  // Lip islands occupy a small fraction of a complete head surface.
  for(const name of ['position','normal'])f.geometry.setAttribute(name,new THREE.Float32BufferAttribute(
    [...f.geometry.attributes[name].array,...new Float32Array(60)],3));
  f.geometry.morphAttributes.position=f.geometry.morphAttributes.position.map(source=>
    new THREE.Float32BufferAttribute([...source.array,...new Float32Array(60)],3));
  const adapter=createExpressionAdapter(f.context);
  adapter.apply({PARAM_MOUTH_FORM_01:1,PARAM_MOUTH_SCALE:1});
  assert.deepEqual(vertex(f.mesh,6),vertex({geometry:f.geometry},6));
  assert.notEqual(vertex(f.mesh,12)[0],f.geometry.attributes.position.getX(12));
  adapter.dispose();
});
