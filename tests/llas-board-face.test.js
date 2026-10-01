import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import BoardFace from '../packages/llas_runtime/behaviors/board-face.js';
import {MotionPlayer} from 'webgal-lovelive-gltf-renderer/motion-player.js';
import {ExpressionController,registerExpressionNodes} from 'webgal-lovelive-gltf-renderer/expression-controller.js';

function setup() {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([0,0,0,.001,0,0,0,.001,0],3));
  geometry.morphAttributes.position = Array.from({length:3}, () => new THREE.Float32BufferAttribute(new Float32Array(9),3));
  geometry.morphTargetsRelative = true;
  const input = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
  input.morphTargetDictionary = {open:0, close:1, mouth:2};
  const nodes = Object.fromEntries(['open','close','mouth'].map(name => [name,new THREE.Object3D()]));
  nodes.signal = input;
  const parameters = {inputNode:'signal', minRateToActive:Math.fround(.51), domains:[
    {name:'eye',defaults:{open:true,close:false},entries:[
      {morph:'open',visibility:{open:true,close:false}},
      {morph:'close',visibility:{open:false,close:true}},
    ]},
    {name:'mouth',defaults:{mouth:false},entries:[{morph:'mouth',visibility:{mouth:true}}]},
  ]};
  const behavior = new BoardFace({resolveNode:(role,name)=>{assert.equal(role,'integrated');return nodes[name];}},
    [{role:'integrated',parameters}]);
  behavior.Awake();
  return {behavior,input,nodes,parameters};
}

test('zero-delta signals do not deform geometry; threshold includes equality',()=>{
  const {behavior,input,nodes,parameters} = setup();
  assert.equal(input.visible,false);
  for(const weight of [0,.25,.5,parameters.minRateToActive-1e-6,parameters.minRateToActive,.75,1]) {
    input.morphTargetInfluences[1]=weight;
    behavior.LateUpdate();
    assert.equal(nodes.close.visible,weight>=parameters.minRateToActive);
    const vertex=new THREE.Vector3();input.getVertexPosition(1,vertex);
    assert.ok(Math.abs(vertex.x-.001)<1e-9);assert.equal(vertex.y,0);assert.equal(vertex.z,0);
  }
});
test('ordered requests use last passing entry, not greatest weight; domains independent',()=>{
  const {behavior,input,nodes}=setup();
  input.morphTargetInfluences.splice(0,3,1,.6,.8);behavior.LateUpdate();
  assert.equal(nodes.open.visible,false);assert.equal(nodes.close.visible,true);assert.equal(nodes.mouth.visible,true);
  input.morphTargetInfluences[1]=.4;behavior.LateUpdate();
  assert.equal(nodes.open.visible,true);assert.equal(nodes.close.visible,false);
  input.morphTargetInfluences.fill(0);behavior.LateUpdate();
  assert.equal(nodes.open.visible,true);assert.equal(nodes.mouth.visible,false);
});
test('disable restores baked empty-mixer defaults and never modifies inputs',()=>{
  const {behavior,input,nodes}=setup();input.morphTargetInfluences[1]=1;behavior.LateUpdate();
  behavior.OnDisable();assert.equal(nodes.open.visible,true);assert.equal(nodes.close.visible,false);
  assert.equal(input.morphTargetInfluences[1],1);
  behavior.OnDestroy();
});

test('group motion drives dummy signals through the unchanged expression/Behavior frame order',()=>{
  for(const motionGroup of ['llas-rina-board','llas']){
    const {behavior,input,nodes}=setup();input.name='signal';
    const root=new THREE.Group();root.add(input,...Object.values(nodes).filter(n=>n!==input));
    registerExpressionNodes({scene:root,parser:{associations:new Map([[input,{nodes:0,meshes:0,primitives:0}]]),json:{nodes:[{name:'signal'}]}}});
    const definition={morphPoses:[{name:'close',targets:{signal:{close:1}}}],
      expressionGroups:[{name:'eye',states:[{name:'Close',poses:{close:1}}]}],
      expressions:[{name:'Close',selections:{eye:'Close'}}],defaultExpression:'Close'};
    const expression=new ExpressionController(root,definition);
    const data={clips:[{id:'board',duration:1,sampleRate:1,frames:2,tracks:[],
      groupTracks:[{kind:'morph',node:'signal',property:'close',values:[1,1]}]}],
      auxiliaryClips:[],leftHandPoses:[],rightHandPoses:[],program:{parameters:[],commands:{},baseLayer:'Base',
        layers:[{id:'Base',blend:'override',weight:1,initialState:'board',states:[{id:'board',clip:'board',speed:1,loop:true,transitions:[]}]}],poseSlots:[]}};
    const player=new MotionPlayer(root,1,data,'llas-rina-board',motionGroup);
    expression.setActive(false);expression.beginFrame();player.update(0);expression.update();behavior.LateUpdate();
    assert.equal(nodes.close.visible,motionGroup==='llas-rina-board');
    assert.equal(player.groupTrackResolvedCount,motionGroup==='llas-rina-board'?1:0);
    player.dispose();behavior.LateUpdate();assert.equal(nodes.close.visible,false);
    expression.setActive(true);expression.update();behavior.LateUpdate();assert.equal(nodes.close.visible,true);
  }
});
