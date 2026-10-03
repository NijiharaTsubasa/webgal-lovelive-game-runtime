import test from 'node:test';
import assert from 'node:assert/strict';
import { BufferGeometry, Float32BufferAttribute, Group, Mesh, MeshBasicMaterial, Vector3 } from 'three';
import * as THREE from 'three';
import { LlasLive2dFace, createExpressionAdapter } from '../packages/llas_runtime/adapters/llas-live2d-face.js';

const sourceName=(kind,name)=>({eye:{open:'EyeBlendShape.eye_facial_003',close:'EyeBlendShape.eye_facial_001',smile:'EyeBlendShape.eye_facial_005',wide:'EyeBlendShape.eye_facial_004',sad:'EyeBlendShape.eye_facial_015'},mouth:{smile:'MouthBlendShape.mouth_facial_007',a:'MouthBlendShape.mouth_facial_001',o:'MouthBlendShape.mouth_facial_005',sad:'MouthBlendShape.mouth_facial_010'},Left:{close:'LeftEyeWhiteLineBlendShape.LeftEye_LineWhite_001',smile:'LeftEyeWhiteLineBlendShape.LeftEye_LineWhite_002'},Right:{close:'RightEyeWhiteLineBlendShape.RightEye_LineWhite_001',smile:'RightEyeWhiteLineBlendShape.RightEye_LineWhite_002'}}[kind]?.[name]??name);
const named=(kind,targets)=>Object.fromEntries(Object.entries(targets).map(([name,value])=>[sourceName(kind,name),value]));
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
    o:mouthPoints.map(([x],i)=>[-.5*x,(i<3?1:-1)*(i===1||i===5?.13:.04),i<3?.015:-.01]),
    sad:mouthPoints.map(([x])=>[0,.08*(1-(x/.3)**2),.01]),
    unrelated:mouthPoints.map(()=>[0,0,.2]),
  };
  const linePoints=[[-.1,0,0],[0,.02,0],[.1,0,0]];
  return {
    eye:geometry(eyePoints,eyeUv,named('eye',eyeTargets)),
    mouth:geometry(mouthPoints,mouthUv,named('mouth',mouthTargets)),
    ...Object.fromEntries(['Left','Right'].map(side=>[side+'Line',geometry(linePoints,linePoints.map(()=>[0,0]),named(side,{
      close:linePoints.map(()=>[0,.1,0]),smile:linePoints.map(()=>[0,.2,0]),
    }))])),
  };
}
function fixture(shared=geometries()){
  const root=new Group(),nodes=new Map();
  const add=(name,object,parent=root)=>{object.name=name;nodes.set(name,object);parent.add(object);return object;};
  const eye=add('Eye_Around',new Mesh(shared.eye,new MeshBasicMaterial()));
  const skin=geometry([[-3,0,-1],[3,0,-1],[-3,4,-1],[3,0,-1],[3,4,-1],[-3,4,-1]],Array.from({length:6},()=>[0,0]),{});
  add('Face',new Mesh(skin,new MeshBasicMaterial()));
  const mouth=add('Mouth',new Mesh(shared.mouth,new MeshBasicMaterial()));
  const lineL=add('LeftEyeWhiteLine',new Mesh(shared.LeftLine,new MeshBasicMaterial()));
  const lineR=add('RightEyeWhiteLine',new Mesh(shared.RightLine,new MeshBasicMaterial()));
  lineL.visible=false;lineR.visible=false;
  for(const [side,x] of [['Left',1],['Right',-1]]){
    const parent=add(`${side}Eye_Root`,new Group());parent.position.set(x,2,.1);
    const child=add(`${side}Eye2`,new Group(),parent);child.position.set(.02,0,.03);
  }
  const morphPoses=['Open','Close','CloseSmile','WideOpen','Sad'].map((name,i)=>({name:`eye/${name}`,targets:{
    Eye_Around:{[sourceName('eye',['open','close','smile','wide','sad'][i])]:1},
    LeftEyeWhiteLine:named('Left',name==='Close'?{close:1}:name==='CloseSmile'?{smile:1}:{}),
    RightEyeWhiteLine:named('Right',name==='Close'?{close:1}:name==='CloseSmile'?{smile:1}:{}),
  }}));
  morphPoses.push({name:'mouth/Smile',targets:{Mouth:named('mouth',{smile:1})}},{name:'mouth/A',targets:{Mouth:named('mouth',{a:1})}},
    {name:'mouth/O',targets:{Mouth:named('mouth',{o:1})}},
    {name:'mouth/Sad',targets:{Mouth:named('mouth',{sad:1})}});
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
  const weight=(object,name,value)=>{const kind=object===eye?'eye':object===mouth?'mouth':object.name.startsWith('Left')?'Left':'Right';const i=object.morphTargetDictionary[sourceName(kind,name)];assert.notEqual(i,undefined,`Missing test channel ${name}`);if(value!==undefined)object.morphTargetInfluences[i]=value;return object.morphTargetInfluences[i];};
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

function eyelidFixture(withSkin=false){
  const shared=geometries(),g=shared.eye;
  for(const i of [3,4,5,9,10,11])g.attributes.uv.setXY(i,.3,.37);
  const extra=[],uv=[];
  for(const sign of [1,-1])for(const shadow of [false,true]){
    const y=shadow?2.13:2.15;
    extra.push([sign*.85,y,.01],[sign, y+.015,.01],[sign*1.15,y,.01]);
    uv.push(...Array.from({length:3},()=>[.38,shadow?.44:.42]));
  }
  if(withSkin)for(const sign of [1,-1]){
    extra.push([sign*.7,2.18,.04],[sign*1.3,2.18,.04],[sign,2.5,.04]);
    uv.push(...Array.from({length:3},()=>[.2,.1]));
  }
  for(const [name,values,size]of [['position',extra.flat(),3],['uv',uv.flat(),2],
    ['normal',extra.flatMap(()=>[0,0,1]),3]]){
    g.setAttribute(name,new Float32BufferAttribute([...g.attributes[name].array,...values],size));
  }
  for(const target of g.morphAttributes.position){
    const values=extra.flatMap((_,i)=>target.name===sourceName('eye','close')?[0,-.1,i>=12?.02:0]:
      target.name===sourceName('eye','smile')?[0,.1,0]:target.name===sourceName('eye','wide')?[0,.2,0]:[0,0,0]);
    const next=new Float32BufferAttribute([...target.array,...values],3);next.name=target.name;
    g.morphAttributes.position[g.morphAttributes.position.indexOf(target)]=next;
  }
  return fixture(shared);
}

test('eyelid line and painted shadow move together without entering the eyelash',()=>{
  const f=eyelidFixture(),driver=new LlasLive2dFace(f.character);
  for(const open of [0,.3,.73,1,1.5])for(const smile of [0,.6,1]){
    const params={PARAM_EYE_L_OPEN:open,PARAM_EYE_L_SMILE:smile,PARAM_EYE_R_OPEN:open,PARAM_EYE_R_SMILE:smile};
    driver.setParameters(params);driver.update();
    const before=Array.from({length:24},(_,i)=>point(f.eye,i));
    for(const lid of [-1,-.83,.45,1]){
      driver.setParameters({...params,PARAM_EYELID_L:lid});driver.update();
      const dy=point(f.eye,12)[1]-before[12][1];
      if(open<=1||lid<0)assert.ok(lid*dy>0,'available clearance must allow the complete overlay to move');
      else near(dy,0); // This fixture's wide-open fold already reaches its eyebrow.
      for(let i=12;i<18;i++)nearArray(point(f.eye,i).map((v,k)=>v-before[i][k]),[0,dy,0]);
      for(const i of [...Array(12).keys(),18,19,20,21,22,23])nearArray(point(f.eye,i),before[i]);
      const lash=Math.max(...[3,4,5].map(i=>point(f.eye,i)[1]));
      const shadow=Math.min(...[15,16,17].map(i=>point(f.eye,i)[1]));
      assert.ok(shadow>lash,'the shadow must stay above the upper eyelash');
    }
    driver.setParameters(params);driver.update();
    for(let i=0;i<24;i++)nearArray(point(f.eye,i),before[i]);
  }
  driver.dispose();assert.equal(f.eye.geometry,f.shared.eye);
});

test('eyelid clears the morphed skin in Eye_Around without moving that skin',()=>{
  const f=eyelidFixture(true),driver=new LlasLive2dFace(f.character);
  for(const open of [1,0,.6,1]){
    const params={PARAM_EYE_L_OPEN:open};
    driver.setParameters(params);driver.update();
    const before=Array.from({length:30},(_,i)=>point(f.eye,i));
    driver.setParameters({...params,PARAM_EYELID_L:1});driver.update();
    for(let i=12;i<18;i++){
      assert.ok(point(f.eye,i)[2]>point(f.eye,24)[2],'the entire crease and shadow must clear the local skin');
    }
    for(let i=24;i<30;i++)nearArray(point(f.eye,i),before[i]);
    driver.setParameters(params);driver.update();
    for(let i=0;i<30;i++)nearArray(point(f.eye,i),before[i]);
  }
  driver.dispose();
});

test('eyelid depth follows a sloping face in both passes and returns continuously to its native placement',()=>{
  const f=eyelidFixture(),p=f.eye.geometry.attributes.position;
  for(const i of [0,1,2,6,7,8])p.setZ(i,1.5);
  const skin=f.nodes.get('Face').geometry.attributes.position;
  for(let i=0;i<skin.count;i++)skin.setZ(i,5*(skin.getY(i)-2.175));
  const pass=f.eye.clone();pass.userData.__parameterizedPassObject=true;f.root.add(pass);
  const driver=new LlasLive2dFace(f.character);driver.update();
  const before=Array.from({length:24},(_,i)=>point(f.eye,i));
  driver.setParameters({PARAM_EYELID_L:1});driver.update();
  assert.ok(f.eye.morphTargetInfluences[driver.eyeWork.channels.get('eye:L:lidDepth')]>0);
  assert.deepEqual(pass.morphTargetInfluences,f.eye.morphTargetInfluences);
  const delta=point(f.eye,12).map((v,k)=>v-before[12][k]);
  for(let i=12;i<18;i++)nearArray(point(f.eye,i).map((v,k)=>v-before[i][k]),delta);
  driver.setParameters({PARAM_EYELID_L:1e-7});driver.update();
  for(let i=0;i<24;i++)nearArray(point(f.eye,i),before[i]);
  driver.setParameters({});driver.update();
  for(let i=0;i<24;i++)nearArray(point(f.eye,i),before[i]);
  assert.deepEqual(pass.morphTargetInfluences,f.eye.morphTargetInfluences);
  driver.dispose();assert.equal(f.eye.geometry,f.shared.eye);assert.equal(pass.geometry,f.shared.eye);
});

test('published adapter needs only the standard context and returns null for board faces',()=>{
  const f=fixture(),originalGeometry=f.eye.geometry;
  const board={...f.character,parts:[{role:'integrated',component:{behaviors:[{name:'LLAS.BoardFace'}]}}]};
  assert.equal(createExpressionAdapter(board),null);
  assert.equal(f.eye.geometry,originalGeometry);
  const adapter=createExpressionAdapter(f.character);
  assert.deepEqual(Object.keys(adapter).sort(),['apply','dispose','restore']);
  f.weight(f.eye,'close',.3);
  const parameters=Object.freeze({PARAM_EYE_L_OPEN:0,PARAM_MOUTH_OPEN_Y:.6,PARAM_TEAR:.4});
  adapter.apply(parameters,{time:1,delta:0});
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

test('absent cheek resources preserve the rest of the face',()=>{
  const f=fixture(),driver=new LlasLive2dFace(f.character);
  driver.setParameters({PARAM_CHEEK:.5,PARAM_EYE_L_OPEN:0});
  driver.update();assert.equal(f.lineL.visible,true);driver.dispose();
});

test('closed frown retains closure and opens continuously without moving the eyes',()=>{
  const f=fixture(),driver=new LlasLive2dFace(f.character);driver.update();
  const eyes=Array.from({length:12},(_,i)=>point(f.eye,i));
  for(const form of [-1,-.5,0,.5,1]){
    driver.setParameters({PARAM_MOUTH_FORM_01:form,PARAM_MOUTH_OPEN_Y:0});driver.update();
    near(f.weight(f.mouth,'a'),0);near(f.weight(f.mouth,'o'),0);
    nearArray(point(f.mouth,0),point(f.mouth,3));nearArray(point(f.mouth,2),point(f.mouth,4));
    assert.ok(point(f.mouth,1)[1]>point(f.mouth,5)[1],'upper and lower surface must not swap');
    const middle=(point(f.mouth,1)[1]+point(f.mouth,5)[1])/2,ends=(point(f.mouth,0)[1]+point(f.mouth,2)[1])/2;
    if(form===-1)assert.ok(middle>ends,'negative FORM must produce downturned corners');
    if(form===1)assert.ok(middle<ends,'positive FORM must produce upturned corners');
    for(let i=0;i<12;i++)nearArray(point(f.eye,i),eyes[i]);
    let previous=Array.from({length:6},(_,i)=>point(f.mouth,i));
    for(let step=1;step<=100;step++){
      driver.setParameters({PARAM_MOUTH_FORM_01:form,PARAM_MOUTH_OPEN_Y:step/100});driver.update();
      const current=Array.from({length:6},(_,i)=>point(f.mouth,i));
      for(let i=0;i<6;i++)assert.ok(Math.hypot(...current[i].map((v,k)=>v-previous[i][k]))<.01,'opening must stay continuous');
      assert.ok(current.flat().every(Number.isFinite));previous=current;
    }
    assert.ok(point(f.mouth,0)[1]>point(f.mouth,3)[1]);
  }
  driver.dispose();
});

test('negative opening blends authored A and O while preserving O upper/lower arcs and depth',()=>{
  const f=fixture(),driver=new LlasLive2dFace(f.character);
  for(const open of [0,.1,.5,.8,1])for(const form of [-1,-.4,0,.6,1]){
    driver.setParameters({PARAM_MOUTH_OPEN_Y:open,PARAM_MOUTH_FORM_01:form});driver.update();
    const roundness=open*Math.max(0,-form);
    near(f.weight(f.mouth,'a'),open*(1-roundness));near(f.weight(f.mouth,'o'),open*roundness);
    near(f.weight(f.mouth,'a')+f.weight(f.mouth,'o'),open);
    if(!roundness)for(const [name,i]of Object.entries(f.mouth.morphTargetDictionary))if(name.startsWith('roundMouth:'))near(f.mouth.morphTargetInfluences[i],0);
  }
  driver.setParameters({PARAM_MOUTH_OPEN_Y:1,PARAM_MOUTH_FORM_01:-1});driver.update();
  const original=f.shared.mouth.attributes.position,rounded=f.shared.mouth.morphAttributes.position.find(a=>a.name===sourceName('mouth','o'));
  for(let i=0;i<6;i++){
    const p=new Vector3().fromBufferAttribute(original,i).add(new Vector3().fromBufferAttribute(rounded,i));
    nearArray(point(f.mouth,i),[p.x*.5,1+(p.y-1)*.5,p.z]);
  }
  assert.ok(point(f.mouth,1)[1]>point(f.mouth,0)[1],'rounded upper lip arches upward');
  assert.ok(point(f.mouth,5)[1]<point(f.mouth,3)[1],'rounded lower lip arches downward');
  // A poisoned O geometry must be unreachable when closed or at nonnegative FORM.
  const other=fixture(),o=other.shared.mouth.morphAttributes.position.find(a=>a.name===sourceName('mouth','o'));o.array.fill(100);
  const second=new LlasLive2dFace(other.character);
  for(const [open,form]of [[0,-1],[0,-.4],[.4,0],[1,.8]]){
    for(const d of [driver,second]){d.setParameters({PARAM_MOUTH_OPEN_Y:open,PARAM_MOUTH_FORM_01:form});d.update();}
    for(let i=0;i<6;i++)nearArray(point(f.mouth,i),point(other.mouth,i));
  }
  driver.dispose();second.dispose();
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
  const f=fixture();f.weight(f.eye,'close',.8);f.weight(f.mouth,'a',.9);f.weight(f.mouth,'o',.45);f.weight(f.eye,'unrelated',.25);
  const driver=new LlasLive2dFace(f.character);driver.setParameters({PARAM_MOUTH_OPEN_Y:.3});driver.update();
  assert.equal(f.weight(f.eye,'close'),0);near(f.weight(f.mouth,'a'),.3);near(f.weight(f.mouth,'o'),0);
  near(f.weight(f.eye,'unrelated'),.25);
  f.weight(f.eye,'unrelated',.7);driver.beginFrame();
  near(f.weight(f.eye,'unrelated'),.7);near(f.weight(f.eye,'close'),.8);near(f.weight(f.mouth,'a'),.9);near(f.weight(f.mouth,'o'),.45);
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
  f.weight(f.eye,'close',.4);f.weight(f.mouth,'a',.6);f.weight(f.mouth,'o',.35);f.weight(f.eye,'unrelated',.7);
  const iris=f.nodes.get('LeftEye_Root'),companion=f.nodes.get('LeftEye2');
  iris.position.set(1.1,2.2,.3);iris.scale.set(1.2,.9,1.1);companion.position.set(.04,.08,.02);
  f.lineL.visible=true;f.lineR.visible=false;
  const expected={iris:iris.position.toArray(),scale:iris.scale.toArray(),companion:companion.position.toArray()};
  driver.setParameters({PARAM_EYE_L_OPEN:0,PARAM_EYE_R_OPEN:0,PARAM_MOUTH_OPEN_Y:1,
    PARAM_EYE_BALL_X:.8,PARAM_EYE_SCALE:1});driver.update();driver.dispose();
  assert.equal(f.eye.geometry,original.eyeGeometry);assert.equal(f.mouth.geometry,original.mouthGeometry);
  assert.equal(f.eye.morphTargetDictionary,original.eyeDictionary);assert.equal(f.mouth.morphTargetDictionary,original.mouthDictionary);
  near(f.weight(f.eye,'close'),.4);near(f.weight(f.mouth,'a'),.6);near(f.weight(f.mouth,'o'),.35);near(f.weight(f.eye,'unrelated'),.7);
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

test('negative brow form reverses curvature while preserving width, depth and the other face regions',()=>{
  const f=fixture(),driver=new LlasLive2dFace(f.character);driver.update();
  const neutral=Array.from({length:12},(_,i)=>point(f.eye,i));
  for(const [side,ids,other] of [['L',[0,1,2],[3,4,5,6,7,8,9,10,11]],['R',[6,7,8],[0,1,2,3,4,5,9,10,11]]]){
    driver.setParameters({[`PARAM_BROW_${side}_FORM`]:-1});driver.update();
    const changed=ids.map(i=>point(f.eye,i));
    assert.ok(changed[1][1]<(changed[0][1]+changed[2][1])/2);
    near(Math.abs(changed[0][0]-changed[2][0]),Math.abs(neutral[ids[0]][0]-neutral[ids[2]][0]));
    for(const i of ids){near(point(f.eye,i)[0],neutral[i][0]);near(point(f.eye,i)[2],neutral[i][2]);}
    for(const i of other)nearArray(point(f.eye,i),neutral[i]);
    const once=state(f);driver.update();assert.deepEqual(state(f),once);
  }
  driver.dispose();
});

test('missing or poisoned emotional Morph recipes cannot change parameter geometry or companions',()=>{
  const a=fixture(),b=fixture(),c=fixture();
  b.character.parts[0].component.morphPoses=[];
  for(const pose of c.character.parts[0].component.morphPoses)pose.targets={Eye_Around:{unrelated:123},Mouth:{unrelated:-99}};
  const drivers=[a,b,c].map(f=>new LlasLive2dFace(f.character));
  for(const parameters of [{},{PARAM_BROW_L_FORM:-1,PARAM_MOUTH_FORM_01:-1},{PARAM_EYE_L_OPEN:.3,PARAM_EYE_R_SMILE:.7,PARAM_EYE_R_OPEN:.2,PARAM_MOUTH_OPEN_Y:.4,PARAM_MOUTH_FORM_01:-.6}]){
    for(const d of drivers){d.setParameters(parameters);d.update();}
    for(const f of [b,c]){assert.deepEqual(state(f),state(a));for(const [ma,mb]of [[a.eye,f.eye],[a.mouth,f.mouth]])for(let i=0;i<ma.geometry.attributes.position.count;i++)nearArray(point(ma,i),point(mb,i));}
  }
  for(const d of drivers)d.dispose();
});

test('Main and Outline receive identical source and derived Morph values and restore their own underlays',()=>{
  const f=fixture(),pairs=[f.eye,f.mouth,f.lineL,f.lineR].map(source=>{const pass=source.clone();pass.morphTargetInfluences=[...source.morphTargetInfluences];pass.userData.__parameterizedPassObject=true;f.root.add(pass);source.morphTargetInfluences.fill(.2);pass.morphTargetInfluences.fill(.6);return [source,pass];});
  const driver=new LlasLive2dFace(f.character);driver.setParameters({PARAM_EYE_L_OPEN:0,PARAM_EYE_R_OPEN:.2,PARAM_EYE_R_SMILE:.6,PARAM_BROW_L_FORM:-.8,PARAM_MOUTH_OPEN_Y:.3,PARAM_MOUTH_FORM_01:-.7});driver.update();
  for(const [source,pass]of pairs)for(const [name,index]of Object.entries(source.morphTargetDictionary))if(name!=='unrelated')near(source.morphTargetInfluences[index],pass.morphTargetInfluences[index]);
  driver.dispose();for(const [source,pass]of pairs){assert.ok(source.morphTargetInfluences.every(v=>v===.2));assert.ok(pass.morphTargetInfluences.every(v=>v===.6));}
});

test('brows remain in front of a sloping face through continuous angle/form/position input and native switching',()=>{
  const f=fixture(),face=f.nodes.get('Face'),p=face.geometry.attributes.position;
  // A sloping forehead intersects an otherwise unchanged planar brow when it rises.
  for(let i=0;i<p.count;i++)p.setZ(i,.5*(p.getY(i)-2.4)-.02);
  const driver=new LlasLive2dFace(f.character),original=f.eye.geometry.attributes.position.array.slice();
  f.weight(f.eye,'sad',.4);
  for(const side of ['L','R'])for(let step=0;step<=20;step++){
    const t=step/20,indices=side==='L'?[0,1,2]:[6,7,8];
    driver.setParameters({[`PARAM_BROW_${side}_Y`]:t,[`PARAM_BROW_${side}_ANGLE`]:2*t-1,[`PARAM_BROW_${side}_FORM`]:-t});driver.update();
    for(const i of indices){const [x,y,z]=point(f.eye,i);assert.ok(z>.5*(y-2.4)-.02,`${side} step ${step} brow vertex ${i} buried in face`);}
    const untouched=side==='L'?[6,7,8]:[0,1,2];
    for(const i of untouched)near(point(f.eye,i)[2],0);
    driver.beginFrame();near(f.weight(f.eye,'sad'),.4);
    assert.equal(f.weight(f.eye,`brow:${side}:depth`)??0,0);
  }
  assert.deepEqual(f.eye.geometry.attributes.position.array,original);
  driver.dispose();near(f.weight(f.eye,'sad'),.4);
});

test('brow surface support respects separate mesh frames and whole-character scale',()=>{
  const a=fixture(),b=fixture();
  for(const f of [a,b]){
    const p=f.nodes.get('Face').geometry.attributes.position;
    for(let i=0;i<p.count;i++)p.setZ(i,.5*(p.getY(i)-2.4)-.02);
  }
  const face=b.nodes.get('Face');face.position.set(.4,.2,-.3);face.rotation.set(.1,.2,.3);face.scale.set(1.2,.8,1.1);face.updateMatrix();
  face.geometry.applyMatrix4(face.matrix.clone().invert());
  b.root.rotation.set(.2,.4,.1);b.root.scale.setScalar(.25);
  a.root.updateMatrixWorld(true);b.root.updateMatrixWorld(true);
  const da=new LlasLive2dFace(a.character),db=new LlasLive2dFace(b.character);
  const parameters={PARAM_BROW_L_Y:1,PARAM_BROW_L_FORM:-.7,PARAM_BROW_L_ANGLE:.3};
  da.setParameters(parameters);db.setParameters(parameters);da.update();db.update();
  assert.ok(a.weight(a.eye,'brow:L:depth')>0);
  near(a.weight(a.eye,'brow:L:depth'),b.weight(b.eye,'brow:L:depth'));
  for(let i=0;i<12;i++)nearArray(point(a.eye,i),point(b.eye,i));
  da.dispose();db.dispose();
});

test('brow contact starts continuously and keeps a fixed form rigid while crossing it',()=>{
  const f=fixture(),p=f.nodes.get('Face').geometry.attributes.position;
  for(let i=0;i<p.count;i++)p.setZ(i,.5*(p.getY(i)-2.4)-.02);
  const driver=new LlasLive2dFace(f.character);let previous=0,reference;
  for(let step=0;step<=200;step++){
    driver.setParameters({PARAM_BROW_L_Y:step/200,PARAM_BROW_L_FORM:-.7,PARAM_BROW_L_ANGLE:.2});driver.update();
    const shift=f.weight(f.eye,'brow:L:depth');assert.ok(Math.abs(shift-previous)<.002);previous=shift;
    const a=point(f.eye,0),b=point(f.eye,1),distance=Math.hypot(...a.map((v,k)=>v-b[k]));
    if(reference===undefined)reference=distance;else near(distance,reference);
  }
  assert.ok(previous>0);driver.dispose();
});
