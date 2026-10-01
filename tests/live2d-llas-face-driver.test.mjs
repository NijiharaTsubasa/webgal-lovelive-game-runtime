import test from 'node:test';
import assert from 'node:assert/strict';
import { BufferGeometry, Float32BufferAttribute, Group, Mesh, MeshBasicMaterial, Vector3 } from 'three';
import * as THREE from 'three';
import { LlasLive2dFace, createExpressionAdapter } from '../packages/llas_runtime/adapters/llas-live2d-face.js';

const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
const nearArray=(a,b)=>{assert.equal(a.length,b.length);a.forEach((v,i)=>near(v,b[i]));};
function geometry(points,uv,targets){
  const g=new BufferGeometry();
  g.setAttribute('position',new Float32BufferAttribute(points.flat(),3));
  g.setAttribute('normal',new Float32BufferAttribute(points.flatMap(()=>[0,0,1]),3));
  g.setAttribute('uv',new Float32BufferAttribute(uv.flat(),2));
  g.morphTargetsRelative=true;
  g.morphAttributes.position=Object.entries(targets).map(([name,deltas])=>{
    const a=new Float32BufferAttribute(deltas.flat(),3);a.name=name;return a;
  });
  return g;
}
function geometries(){
  const eyePoints=[],eyeUv=[];
  for(const sign of [1,-1]){
    // Each disconnected triangle stays entirely within a verified LLAS atlas region.
    eyePoints.push([sign*.8,2.3,0],[sign,2.4,0],[sign*1.2,2.3,0]);
    eyeUv.push([.1,.4],[.15,.4],[.2,.4]);
    eyePoints.push([sign*.8,2,0],[sign,2.1,0],[sign*1.2,2,0]);
    eyeUv.push([.1,.2],[.15,.2],[.2,.2]);
  }
  const eyeTargets={
    open:eyePoints.map(()=>[0,0,0]),
    close:eyePoints.map((_,i)=>[0,i%6<3?.6:-.1,0]),
    smile:eyePoints.map((_,i)=>[0,i%6<3?.8:.1,0]),
    wide:eyePoints.map((_,i)=>[0,i%6<3?.4:.2,0]),
    sad:eyePoints.map(([px,py,pz],i)=>{
      if(i%6>=3)return [0,.35,.03]; // Native Sad also moves eyes: the driver must exclude these vertices.
      const sign=px>0?1:-1,cx=sign,cy=2.3+.1/3,angle=sign*.25;
      const x=px-cx,y=cy-py;
      const tx=Math.cos(angle)*x-Math.sin(angle)*y+cx+sign*.07;
      const ty=Math.sin(angle)*x+Math.cos(angle)*y+cy-.2;
      return [tx-px,ty-py,.04+(i%6===1?.02:-.01)-pz];
    }),
    unrelated:eyePoints.map(()=>[0,0,.3]),
  };
  const mouthPoints=[[-.3,1,0],[0,1.03,0],[.3,1,0],[-.3,1,0],[.3,1,0],[0,.97,0]];
  const mouthUv=mouthPoints.map(()=>[.25,.263]);
  const mouthTargets={
    smile:mouthPoints.map(()=>[0,0,0]),
    a:mouthPoints.map((_,i)=>[0,i<3?.12:-.12,0]),
    sad:mouthPoints.map(([x])=>[0,.08*(1-(x/.3)**2),.01]),
    unrelated:mouthPoints.map(()=>[0,0,.2]),
  };
  const linePoints=[[-.1,0,0],[0,.02,0],[.1,0,0]];
  return {
    eye:geometry(eyePoints,eyeUv,eyeTargets),
    mouth:geometry(mouthPoints,mouthUv,mouthTargets),
    line:geometry(linePoints,linePoints.map(()=>[0,0]),{
      close:linePoints.map(()=>[0,.1,0]),smile:linePoints.map(()=>[0,.2,0]),
    }),
  };
}
function fixture(shared=geometries()){
  const root=new Group(),nodes=new Map();
  const add=(name,object,parent=root)=>{object.name=name;nodes.set(name,object);parent.add(object);return object;};
  const eye=add('Eye_Around',new Mesh(shared.eye,new MeshBasicMaterial()));
  const mouth=add('Mouth',new Mesh(shared.mouth,new MeshBasicMaterial()));
  const lineL=add('LeftEyeWhiteLine',new Mesh(shared.line,new MeshBasicMaterial()));
  const lineR=add('RightEyeWhiteLine',new Mesh(shared.line,new MeshBasicMaterial()));
  lineL.visible=false;lineR.visible=false;
  for(const [side,x] of [['Left',1],['Right',-1]]){
    const parent=add(`${side}Eye_Root`,new Group());parent.position.set(x,2,.1);
    const child=add(`${side}Eye2`,new Group(),parent);child.position.set(.02,0,.03);
  }
  const morphPoses=['Open','Close','CloseSmile','WideOpen','Sad'].map((name,i)=>({name:`eye/${name}`,targets:{
    Eye_Around:{[['open','close','smile','wide','sad'][i]]:1},
    LeftEyeWhiteLine:name==='Close'?{close:1}:name==='CloseSmile'?{smile:1}:{},
    RightEyeWhiteLine:name==='Close'?{close:1}:name==='CloseSmile'?{smile:1}:{},
  }}));
  morphPoses.push({name:'mouth/Smile',targets:{Mouth:{smile:1}}},{name:'mouth/A',targets:{Mouth:{a:1}}},
    {name:'mouth/Sad',targets:{Mouth:{sad:1}}});
  const bindings=[];
  for(const side of ['Left','Right']){
    bindings.push({node:`${side}Eye2`,property:'position',default:[.02,0,.03],poses:[
      {name:'eye/Open',value:[.02,0,.03]},{name:'eye/Close',value:[.02,.1,.03]},
      {name:'eye/CloseSmile',value:[.02,.15,.03]},{name:'eye/WideOpen',value:[.02,-.1,.03]},
    ]});
    bindings.push({node:`${side}EyeWhiteLine`,property:'visible',default:false,
      poses:[{name:'eye/Close',length:1,curve:[[0,0,0,0,0],[1,0,0,0,1]]}]});
  }
  const character={THREE,root,parts:[{role:'integrated',root,gltf:{},
    component:{morphPoses,behaviors:[{name:'LLAS.Face',parameters:{bindings}}]}}],
    getShaderRuntimes(material){return material.userData.__parameterizedShaderRuntimes??[];},
    resolveNode(role,name){assert.equal(role,'integrated');const n=nodes.get(name);assert.ok(n,name);return n;}};
  const weight=(object,name,value)=>{const i=object.morphTargetDictionary[name];if(value!==undefined)object.morphTargetInfluences[i]=value;return object.morphTargetInfluences[i];};
  return {character,root,nodes,eye,mouth,lineL,lineR,shared,weight};
}
function point(mesh,index){
  const p=new Vector3().fromBufferAttribute(mesh.geometry.attributes.position,index);
  for(let j=0;j<mesh.morphTargetInfluences.length;j++){
    const w=mesh.morphTargetInfluences[j];if(!w)continue;
    p.addScaledVector(new Vector3().fromBufferAttribute(mesh.geometry.morphAttributes.position[j],index),w);
  }
  return p.toArray();
}
function state(f){return {
  eye:[...f.eye.morphTargetInfluences],mouth:[...f.mouth.morphTargetInfluences],
  nodes:[...f.nodes].map(([name,o])=>[name,o.position.toArray(),o.scale.toArray(),o.visible]),
};}

test('published adapter needs only the standard context and returns null for board faces',()=>{
  const f=fixture(),originalGeometry=f.eye.geometry;
  const board={...f.character,parts:[{role:'integrated',component:{behaviors:[{name:'LLAS.BoardFace'}]}}]};
  assert.equal(createExpressionAdapter(board),null);
  assert.equal(f.eye.geometry,originalGeometry);
  const adapter=createExpressionAdapter(f.character);
  assert.deepEqual(Object.keys(adapter).sort(),['apply','dispose','restore']);
  f.weight(f.eye,'close',.3);
  const parameters=Object.freeze({PARAM_EYE_L_OPEN:0,PARAM_MOUTH_OPEN_Y:.6,PARAM_TEAR:.4});
  const status=adapter.apply(parameters,{time:1,delta:0});
  assert.ok(status.unsupported.includes('PARAM_TEAR'));
  near(f.weight(f.mouth,'a'),.6);assert.equal(f.lineL.visible,true);
  adapter.restore();near(f.weight(f.eye,'close'),.3);
  f.weight(f.eye,'close',.7);
  adapter.apply(parameters,{time:0,delta:0});adapter.restore();
  near(f.weight(f.eye,'close'),.7);
  adapter.dispose();assert.equal(f.eye.geometry,originalGeometry);
});

test('restore releases the material override before the underlying next frame',()=>{
  const f=fixture(),calls=[];
  const runtime={setExternalCheek(value){calls.push(value);return {supported:true};}};
  f.character.getShaderRuntimes=()=>[runtime];
  const adapter=createExpressionAdapter(f.character);
  adapter.restore();assert.equal(calls.length,0);
  adapter.apply({PARAM_CHEEK:.5},{time:0,delta:0});
  assert.deepEqual(calls,[{intensity:.5,layer:0}]);
  adapter.restore();assert.equal(calls.at(-1),null);
  const count=calls.length;adapter.restore();assert.equal(calls.length,count);
  adapter.dispose();
});

test('cheek runtime ownership is deduplicated, receives both source styles and restores on release',()=>{
  const f=fixture(),calls=[],runtime={cheekSupport:{supported:true},setExternalCheek(value){calls.push(value);return this.cheekSupport;}};
  f.eye.material.userData.__parameterizedShaderRuntimes=[runtime];
  f.mouth.material.userData.__parameterizedShaderRuntimes=[runtime];
  const driver=new LlasLive2dFace(f.character);
  driver.setParameters({PARAM_CHEEK:.3,PARAM_CHEEK2:.7});driver.update();
  assert.deepEqual(calls,[{intensity:.7,layer:0}]);
  driver.setParameters({});driver.update();assert.deepEqual(calls.at(-1),{intensity:0,layer:0});
  driver.dispose();assert.equal(calls.at(-1),null);
  const count=calls.length;driver.dispose();assert.equal(calls.length,count);
});

test('absent cheek resources remain a visible limitation without rejecting the rest of the face',()=>{
  const f=fixture(),driver=new LlasLive2dFace(f.character);
  const status=driver.setParameters({PARAM_CHEEK:.5,PARAM_EYE_L_OPEN:0});
  assert.ok(status.limitations.some(text=>text.includes('脸红纹理')));
  driver.update();assert.equal(f.lineL.visible,true);driver.dispose();
});

test('negative closed mouth uses native lip shape without selecting the rest of Sad, and releases it when opening',()=>{
  const f=fixture(),driver=new LlasLive2dFace(f.character);
  driver.setParameters({PARAM_MOUTH_FORM_01:-1});driver.update();
  assert.equal(f.weight(f.mouth,'mouth:negative'),1);
  assert.equal(f.weight(f.mouth,'mouth:curve0'),0);
  assert.equal(f.weight(f.eye,'brow:L:negative'),0);
  assert.equal(f.weight(f.eye,'eye:L:Close'),0);
  driver.setParameters({PARAM_MOUTH_FORM_01:-.6,PARAM_MOUTH_OPEN_Y:.5});driver.update();
  near(f.weight(f.mouth,'mouth:negative'),.5);
  driver.setParameters({PARAM_MOUTH_FORM_01:-1,PARAM_MOUTH_OPEN_Y:1});driver.update();
  assert.equal(f.weight(f.mouth,'mouth:negative'),0);
  driver.setParameters({PARAM_MOUTH_FORM_01:.5});driver.update();
  assert.equal(f.weight(f.mouth,'mouth:negative'),0);
  driver.dispose();
});

test('combined positive mouth form and scale cannot over-expand the stationary seam transition',()=>{
  const f=fixture(),driver=new LlasLive2dFace(f.character);
  for(const open of [0,.5,1])for(const scale of [-1,0,1]){
    driver.setParameters({PARAM_MOUTH_OPEN_Y:open,PARAM_MOUTH_FORM_01:1,PARAM_MOUTH_SCALE:scale});driver.update();
    assert.ok(f.weight(f.mouth,'mouth:baseX')<=0);
    assert.ok(f.weight(f.mouth,'mouth:baseX')>=-.4);
    assert.ok(f.weight(f.mouth,'mouth:openX')<=0);
    assert.ok(f.weight(f.mouth,'mouth:baseY')<=0);
    assert.ok(f.weight(f.mouth,'mouth:openY')<=0);
  }
  driver.dispose();
});

test('binding uses neutral eye companions without consuming an existing native expression',()=>{
  const a=fixture(),b=fixture();b.nodes.get('LeftEye2').position.y=.8;
  const previous=b.nodes.get('LeftEye2').position.clone();
  const da=new LlasLive2dFace(a.character),db=new LlasLive2dFace(b.character);
  assert.ok(b.nodes.get('LeftEye2').position.equals(previous));
  near(da.eyeDistance,db.eyeDistance);nearArray(da.irisPivots.L.toArray(),db.irisPivots.L.toArray());
  const values={PARAM_EYE_BALL_X:.5,PARAM_EYE_SCALE:.8};da.setParameters(values);db.setParameters(values);da.update();db.update();
  nearArray(a.nodes.get('LeftEye_Root').position.toArray(),b.nodes.get('LeftEye_Root').position.toArray());
  da.dispose();db.dispose();assert.ok(b.nodes.get('LeftEye2').position.equals(previous));
});

test('direct driver repeats a frame without accumulating gaze, companion TRS or derived Morph weights',()=>{
  const f=fixture(),driver=new LlasLive2dFace(f.character);
  driver.setParameters({PARAM_EYE_L_OPEN:.3,PARAM_EYE_R_OPEN:0,PARAM_EYE_R_SMILE:.6,
    PARAM_BROW_L_X:.4,PARAM_BROW_R_ANGLE:-.5,PARAM_MOUTH_OPEN_Y:.4,PARAM_MOUTH_FORM_01:-.7,
    PARAM_EYE_BALL_X:.7,PARAM_EYE_BALL_Y:-.4,PARAM_EYE_SCALE:.5});
  driver.update();const once=state(f);
  for(let i=0;i<20;i++)driver.update();
  assert.deepEqual(state(f),once);
  driver.dispose();
});

test('external Morph ownership replaces old face values and preserves an unbound channel changed during rendering',()=>{
  const f=fixture();f.weight(f.eye,'close',.8);f.weight(f.mouth,'a',.9);f.weight(f.eye,'unrelated',.25);
  const driver=new LlasLive2dFace(f.character);driver.setParameters({PARAM_MOUTH_OPEN_Y:.3});driver.update();
  assert.equal(f.weight(f.eye,'close'),0);near(f.weight(f.mouth,'a'),.3);
  near(f.weight(f.eye,'unrelated'),.25);
  f.weight(f.eye,'unrelated',.7);driver.beginFrame();
  near(f.weight(f.eye,'unrelated'),.7);near(f.weight(f.eye,'close'),.8);near(f.weight(f.mouth,'a'),.9);
  driver.dispose();
});

test('beginFrame restores animation underlay before the next source frame and is idempotent',()=>{
  const f=fixture();f.weight(f.eye,'close',.2);f.nodes.get('LeftEye2').position.y=.07;
  const driver=new LlasLive2dFace(f.character);driver.setParameters({PARAM_EYE_L_OPEN:0});driver.update();
  driver.beginFrame();near(f.weight(f.eye,'close'),.2);near(f.nodes.get('LeftEye2').position.y,.07);
  const restored=state(f);driver.beginFrame();assert.deepEqual(state(f),restored);
  // Simulate the ordinary animator writing the next frame after beginFrame.
  f.weight(f.eye,'close',.6);f.nodes.get('LeftEye2').position.y=.09;
  driver.update();driver.beginFrame();
  near(f.weight(f.eye,'close'),.6);near(f.nodes.get('LeftEye2').position.y,.09);
  driver.dispose();
});

test('dispose restores original geometry and dictionaries, latest underlying weights, iris TRS and visibility',()=>{
  const f=fixture(),original={eyeGeometry:f.eye.geometry,mouthGeometry:f.mouth.geometry,
    eyeDictionary:f.eye.morphTargetDictionary,mouthDictionary:f.mouth.morphTargetDictionary};
  const driver=new LlasLive2dFace(f.character);
  assert.notEqual(f.eye.geometry,original.eyeGeometry);assert.notEqual(f.mouth.geometry,original.mouthGeometry);
  f.weight(f.eye,'close',.4);f.weight(f.mouth,'a',.6);f.weight(f.eye,'unrelated',.7);
  const iris=f.nodes.get('LeftEye_Root'),companion=f.nodes.get('LeftEye2');
  iris.position.set(1.1,2.2,.3);iris.scale.set(1.2,.9,1.1);companion.position.set(.04,.08,.02);
  f.lineL.visible=true;f.lineR.visible=false;
  const expected={iris:iris.position.toArray(),scale:iris.scale.toArray(),companion:companion.position.toArray()};
  driver.setParameters({PARAM_EYE_L_OPEN:0,PARAM_EYE_R_OPEN:0,PARAM_MOUTH_OPEN_Y:1,
    PARAM_EYE_BALL_X:.8,PARAM_EYE_SCALE:1});driver.update();driver.dispose();
  assert.equal(f.eye.geometry,original.eyeGeometry);assert.equal(f.mouth.geometry,original.mouthGeometry);
  assert.equal(f.eye.morphTargetDictionary,original.eyeDictionary);assert.equal(f.mouth.morphTargetDictionary,original.mouthDictionary);
  near(f.weight(f.eye,'close'),.4);near(f.weight(f.mouth,'a'),.6);near(f.weight(f.eye,'unrelated'),.7);
  nearArray(iris.position.toArray(),expected.iris);nearArray(iris.scale.toArray(),expected.scale);
  nearArray(companion.position.toArray(),expected.companion);assert.equal(f.lineL.visible,true);assert.equal(f.lineR.visible,false);
  const once=state(f);driver.dispose();assert.deepEqual(state(f),once);
});

test('left/right eyes and brows deform only their own region and white line follows full closure',()=>{
  const f=fixture(),driver=new LlasLive2dFace(f.character);driver.setParameters({});driver.update();
  const neutral=Array.from({length:12},(_,i)=>point(f.eye,i));
  driver.setParameters({PARAM_EYE_L_OPEN:0,PARAM_BROW_R_Y:.5});driver.update();
  for(const i of [0,1,2])nearArray(point(f.eye,i),neutral[i]);
  for(const i of [3,4,5]){near(point(f.eye,i)[0],neutral[i][0]);near(point(f.eye,i)[1],neutral[i][1]-.1);}
  for(const i of [6,7,8])assert.ok(point(f.eye,i)[1]>neutral[i][1]);
  for(const i of [9,10,11])nearArray(point(f.eye,i),neutral[i]);
  assert.equal(f.lineL.visible,true);assert.equal(f.lineR.visible,false);
  driver.setParameters({PARAM_EYE_L_OPEN:.5,PARAM_EYE_R_OPEN:0,PARAM_EYE_R_SMILE:.5});driver.update();
  assert.equal(f.lineL.visible,false);assert.equal(f.lineR.visible,true);
  driver.dispose();
});

test('two drivers sharing published geometries keep derived geometry, weights and lifecycle isolated',()=>{
  const shared=geometries(),a=fixture(shared),b=fixture(shared);
  const originalTargets=shared.eye.morphAttributes.position.length;
  const da=new LlasLive2dFace(a.character),db=new LlasLive2dFace(b.character);
  assert.notEqual(a.eye.geometry,b.eye.geometry);assert.notEqual(a.eye.geometry,shared.eye);
  da.setParameters({PARAM_EYE_L_OPEN:0,PARAM_BROW_R_Y:1,PARAM_MOUTH_OPEN_Y:1});da.update();
  db.setParameters({PARAM_EYE_R_OPEN:.4,PARAM_MOUTH_FORM_01:-.8});db.update();
  const bState=state(b),bPoint=point(b.eye,9);
  da.setParameters({PARAM_EYE_R_OPEN:0,PARAM_MOUTH_OPEN_Y:0});da.update();da.dispose();
  assert.deepEqual(state(b),bState);nearArray(point(b.eye,9),bPoint);
  assert.equal(a.eye.geometry,shared.eye);assert.equal(shared.eye.morphAttributes.position.length,originalTargets);
  db.dispose();assert.equal(b.eye.geometry,shared.eye);
});

test('negative brow form keeps native reverse curvature and depth but not native whole-region motion or eye changes',()=>{
  const f=fixture(),driver=new LlasLive2dFace(f.character);driver.setParameters({});driver.update();
  const neutral=Array.from({length:12},(_,i)=>point(f.eye,i));
  driver.setParameters({PARAM_BROW_L_FORM:-1});driver.update();
  const changed=Array.from({length:12},(_,i)=>point(f.eye,i));
  const mean=(points,axis)=>points.reduce((sum,p)=>sum+p[axis],0)/points.length;
  for(let axis=0;axis<3;axis++)near(mean(changed.slice(0,3),axis),mean(neutral.slice(0,3),axis));
  assert.ok(neutral[1][1]>(neutral[0][1]+neutral[2][1])/2);
  assert.ok(changed[1][1]<(changed[0][1]+changed[2][1])/2);
  near(changed[0][1],changed[2][1]); // Native Sad's added screen rotation is removed.
  near(changed[1][2],.02);near(changed[0][2],-.01);near(changed[2][2],-.01);
  for(let i=3;i<12;i++)nearArray(changed[i],neutral[i]);
  const once=state(f);driver.update();assert.deepEqual(state(f),once);
  driver.setParameters({PARAM_BROW_R_FORM:-1});driver.update();
  for(let i=0;i<6;i++)nearArray(point(f.eye,i),neutral[i]);
  assert.ok(point(f.eye,7)[1]<(point(f.eye,6)[1]+point(f.eye,8)[1])/2);
  for(let i=9;i<12;i++)nearArray(point(f.eye,i),neutral[i]);
  driver.dispose();
});
