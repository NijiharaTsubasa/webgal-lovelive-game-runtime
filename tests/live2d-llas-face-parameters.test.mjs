import test from 'node:test';
import assert from 'node:assert/strict';
import { llasFaceControls } from '../packages/llas_runtime/adapters/llas-live2d-parameters.js';

const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-12,`${a} != ${b}`);
const coordinate=(controls,path)=>path.reduce((value,key)=>value[key],controls);
const channels=[
  ...['L','R'].flatMap(side=>[
    {id:`PARAM_EYE_${side}_OPEN`,path:['eyes',side,'open'],min:0,max:1.5,scale:1,offset:0},
    {id:`PARAM_EYE_${side}_SMILE`,path:['eyes',side,'smile'],min:0,max:1,scale:1,offset:0},
    ...['X','Y','ANGLE','FORM'].map(kind=>({
      id:`PARAM_BROW_${side}_${kind}`,path:['brows',side,{X:'x',Y:'y',ANGLE:'angle',FORM:'curve'}[kind]],
      min:-1,max:1,offset:0,
      scale:{X:(side==='L'?1:-1)*.21,Y:.145,ANGLE:(side==='L'?-1:1)*.46,FORM:.09}[kind],
    })),
  ]),
  {id:'PARAM_EYE_BALL_X',path:['gaze','x'],min:-1,max:1,scale:.038,offset:0},
  {id:'PARAM_EYE_BALL_Y',path:['gaze','y'],min:-1,max:1,scale:.038,offset:0},
  {id:'PARAM_EYE_SCALE',path:['gaze','scale'],min:-1,max:1,scale:.075,offset:1},
  {id:'PARAM_MOUTH_OPEN_Y',path:['mouth','open'],min:0,max:1,scale:1,offset:0},
  {id:'PARAM_MOUTH_FORM_01',path:['mouth','form'],min:-1,max:1,scale:1,offset:0},
  {id:'PARAM_MOUTH_FORM_Y',path:['mouth','y'],min:-1,max:1,scale:.01,offset:0},
  {id:'PARAM_MOUTH_SCALE',path:['mouth','scale'],min:-1,max:1,scale:.115,offset:1},
];

test('LLAS direct face controls have independent neutral eyes, brows, gaze and mouth',()=>{
  const value=llasFaceControls({});
  assert.deepEqual(value.eyes,{L:{open:1,smile:0},R:{open:1,smile:0}});
  for(const side of ['L','R'])for(const n of Object.values(value.brows[side]))near(n,0);
  assert.deepEqual(value.gaze,{x:0,y:0,scale:1});
  assert.deepEqual(value.mouth,{open:0,form:0,y:0,scale:1});
});

test('every mapped facial channel responds at endpoints and intermediate values',()=>{
  for(const channel of channels)for(const input of [channel.min,(channel.min+channel.max)/2,channel.max]){
    const controls=llasFaceControls({[channel.id]:input});
    near(coordinate(controls,channel.path),channel.offset+channel.scale*input);
  }
});

test('left and right eye opening and smile remain independent, including over-open eyes',()=>{
  const value=llasFaceControls({PARAM_EYE_L_OPEN:.25,PARAM_EYE_R_OPEN:1.4,
    PARAM_EYE_L_SMILE:.7,PARAM_EYE_R_SMILE:.1});
  assert.deepEqual(value.eyes,{L:{open:.25,smile:.7},R:{open:1.4,smile:.1}});
  const changed=llasFaceControls({PARAM_EYE_L_OPEN:.25,PARAM_EYE_R_OPEN:1.4,
    PARAM_EYE_L_SMILE:0,PARAM_EYE_R_SMILE:.1});
  assert.deepEqual(changed.eyes.R,value.eyes.R);
  assert.equal(changed.eyes.L.open,value.eyes.L.open);
});

test('brow control signs follow measured screen directions, without changing the opposite brow',()=>{
  for(const side of ['L','R']){
    const controls=llasFaceControls(Object.fromEntries(['X','Y','ANGLE','FORM'].map(kind=>[`PARAM_BROW_${side}_${kind}`,.5])));
    const brow=controls.brows[side];
    // Source L is screen-right: positive X moves outward, positive angle raises the inner end.
    near(brow.x,(side==='L'?1:-1)*.105);
    near(brow.y,.0725);
    near(brow.angle,(side==='L'?-1:1)*.23);
    near(brow.curve,.045);
    for(const n of Object.values(controls.brows[side==='L'?'R':'L']))near(n,0);
    assert.deepEqual(controls.eyes,llasFaceControls({}).eyes);
  }
});

test('gaze directions and iris size do not alter aperture or smile controls',()=>{
  const value=llasFaceControls({PARAM_EYE_BALL_X:.7,PARAM_EYE_BALL_Y:-.4,PARAM_EYE_SCALE:.6});
  near(value.gaze.x,.038*.7);near(value.gaze.y,-.038*.4);near(value.gaze.scale,1+.075*.6);
  assert.deepEqual(value.eyes,llasFaceControls({}).eyes);
});

test('unmapped eyelid parameters preserve aperture and smile controls',()=>{
  const params={PARAM_EYE_L_OPEN:.3,PARAM_EYE_R_SMILE:.7};
  const expected=llasFaceControls(params);
  for(const value of [-1,-.4,.6,1]){
    const eyelids={PARAM_EYELID_L:value,PARAM_EYELID_R:-value};
    assert.deepEqual(llasFaceControls({...params,...eyelids}),expected);
    assert.deepEqual(llasFaceControls(params,eyelids),expected);
  }
});

test('mouth form, opening, position and size survive as separate controls',()=>{
  for(const form of [-1,-.35,0,.6,1])for(const open of [0,.3,1]){
    const value=llasFaceControls({PARAM_MOUTH_FORM_01:form,PARAM_MOUTH_OPEN_Y:open,
      PARAM_MOUTH_FORM_Y:-.2,PARAM_MOUTH_SCALE:.4});
    near(value.mouth.form,form);near(value.mouth.open,open);
    near(value.mouth.y,-.002);near(value.mouth.scale,1.046);
  }
});

test('source defaults fill absent channels but never replace an explicit zero',()=>{
  const defaults={PARAM_EYE_L_OPEN:.6,PARAM_BROW_R_Y:.4,PARAM_MOUTH_FORM_01:-.7,PARAM_MOUTH_OPEN_Y:.5};
  const fromDefaults=llasFaceControls({},defaults);
  near(fromDefaults.eyes.L.open,.6);near(fromDefaults.brows.R.y,.058);
  near(fromDefaults.mouth.form,-.7);near(fromDefaults.mouth.open,.5);
  const explicit=llasFaceControls({PARAM_EYE_L_OPEN:0,PARAM_MOUTH_OPEN_Y:0},defaults);
  assert.equal(explicit.eyes.L.open,0);assert.equal(explicit.mouth.open,0);
  assert.equal(explicit.mouth.form,-.7);
});

test('finite out-of-calibration values saturate for every channel instead of rejecting real source values',()=>{
  for(const channel of channels)for(const [input,boundary] of [[-100,channel.min],[100,channel.max]]){
    const value=llasFaceControls({[channel.id]:input});
    near(coordinate(value,channel.path),channel.offset+channel.scale*boundary);
  }
  const extreme=llasFaceControls({PARAM_BROW_L_FORM:-3,PARAM_BROW_R_FORM:2,
    PARAM_MOUTH_FORM_01:-3.5,PARAM_EYE_L_OPEN:2});
  near(extreme.brows.L.curve,-.09);near(extreme.brows.R.curve,.09);
  assert.equal(extreme.mouth.form,-1);assert.equal(extreme.eyes.L.open,1.5);
});

test('non-finite supported values fail with the parameter ID, including values supplied by defaults',()=>{
  for(const {id} of channels)for(const input of [NaN,Infinity,-Infinity]){
    assert.throws(()=>llasFaceControls({[id]:input}),{message:`Non-finite face parameter: ${id}`});
    assert.throws(()=>llasFaceControls({},{[id]:input}),{message:`Non-finite face parameter: ${id}`});
  }
  // A bad unused default must not invalidate a valid explicitly supplied value.
  assert.equal(llasFaceControls({PARAM_MOUTH_OPEN_Y:.5},{PARAM_MOUTH_OPEN_Y:NaN}).mouth.open,.5);
});

test('unmapped facial and body fields do not alter mapped controls',()=>{
  const input={PARAM_EYE_L_OPEN:.4,PARAM_MOUTH_OPEN_Y:.6};
  assert.deepEqual(llasFaceControls({...input,PARAM_EYE_FORM:-.6,PARAM_TEAR:1,
    PARAM_EYE_HIGHLIGHT:.5,PARAM_MOUTH_OPEN_Y_MANUAL:.3,PARAM_BROW_UNKNOWN:.7,
    PARAM_ARM_L_01_001:25}),llasFaceControls(input));
});

test('mapping is pure and each character receives independent mutable result objects',()=>{
  const input=Object.freeze({PARAM_BROW_L_FORM:.5,PARAM_MOUTH_OPEN_Y:.4,PARAM_CHEEK:.3});
  const defaults=Object.freeze({PARAM_EYE_L_OPEN:.8});
  const a=llasFaceControls(input,defaults),b=llasFaceControls(input,defaults);
  assert.deepEqual(a,b);
  a.eyes.L.open=0;a.brows.L.curve=100;a.gaze.x=100;a.mouth.open=0;
  assert.equal(b.eyes.L.open,.8);near(b.brows.L.curve,.045);assert.equal(b.gaze.x,0);
  assert.equal(b.mouth.open,.4);assert.equal(b.cheek,.3);
  assert.deepEqual(input,{PARAM_BROW_L_FORM:.5,PARAM_MOUTH_OPEN_Y:.4,PARAM_CHEEK:.3});
});

test('cheek styles combine continuously without erasing either input or switching texture layers',()=>{
  for(const input of [0,.2,.5,1]){
    near(llasFaceControls({PARAM_CHEEK:input}).cheek,input);
    near(llasFaceControls({PARAM_CHEEK2:input}).cheek,input);
    near(llasFaceControls({PARAM_CHEEK:input,PARAM_CHEEK2:.4}).cheek,Math.max(input,.4));
  }
  assert.equal(llasFaceControls({PARAM_CHEEK:2,PARAM_CHEEK2:-1}).cheek,1);
  assert.throws(()=>llasFaceControls({PARAM_CHEEK2:NaN}),/PARAM_CHEEK2/);
});
