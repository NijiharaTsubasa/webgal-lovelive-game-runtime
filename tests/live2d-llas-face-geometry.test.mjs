import test from 'node:test';
import assert from 'node:assert/strict';
import { BufferGeometry, Float32BufferAttribute, Group, Mesh, MeshBasicMaterial } from 'three';
import { FaceMorphWorkspace, morphVector, maskedDifference, connectedVertices, alignedShapeDifference, mouthSupportWeights, mouthChannels } from '../packages/llas_runtime/adapters/llas-face-geometry.js';

function fixture() {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute([1,1,0, 2,1,0, 1,2,0, -1,1,0, -2,1,0, -1,2,0],3));
  geometry.setIndex([0,1,2,3,4,5]);
  const delta = new Float32BufferAttribute([0,1,0, 0,2,0, 0,3,0, 0,4,0, 0,5,0, 0,6,0],3);
  delta.name = 'original';
  geometry.morphAttributes.position = [delta];
  geometry.morphAttributes.normal = [new Float32BufferAttribute(new Float32Array(18),3)];
  geometry.morphTargetsRelative = true;
  const mesh = new Mesh(geometry,new MeshBasicMaterial()), root = new Group();
  const pass = mesh.clone(); root.add(mesh,pass);
  return {root,mesh,pass,geometry};
}

test('derived face channels share passes but not another instance, then restore',()=>{
  const {root,mesh,pass,geometry} = fixture();
  const other = mesh.clone(), originalWeights = mesh.morphTargetInfluences;
  const work = new FaceMorphWorkspace(root,mesh,{ Float32BufferAttribute });
  const delta = morphVector(mesh,{original:1});
  work.add('left',maskedDifference(delta,new Float32Array(18),[1,1,1,0,0,0]));
  assert.equal(geometry.morphAttributes.position.length,1);
  assert.equal(mesh.geometry.morphAttributes.position.length,2);
  assert.equal(mesh.geometry.morphAttributes.normal.length,2);
  assert.equal(mesh.geometry,pass.geometry);
  assert.equal(other.geometry,geometry);
  work.write({left:.7});
  assert.equal(mesh.morphTargetInfluences[1],.7);
  assert.equal(pass.morphTargetInfluences[1],.7);
  work.write({});
  assert.equal(pass.morphTargetInfluences[1],0);
  assert.equal(other.morphTargetInfluences.length,1);
  work.dispose(); work.dispose();
  assert.equal(mesh.geometry,geometry);
  assert.equal(pass.geometry,geometry);
  assert.equal(mesh.morphTargetInfluences,originalWeights);
  assert.equal(mesh.morphTargetDictionary.left,undefined);
});

test('topology and regional difference preserve independent left/right support',()=>{
  const {mesh,geometry} = fixture();
  assert.deepEqual(connectedVertices(geometry),[[0,1,2],[3,4,5]]);
  const values = morphVector(mesh,{original:-.5});
  const left = maskedDifference(values,new Float32Array(18),[1,1,1,0,0,0]);
  assert.equal(left[1],-.5);assert.equal(left[4],-1);assert.equal(left[7],-1.5);
  assert.ok(left.subarray(9).every(v=>v===0));
});

const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
function alignedFixture({reverse=false}={}){
  const points=[[-1,0,0],[0,.4,0],[1,0,0],[3,1,0],[4,1,0],[3,2,0]];
  const geometry=new BufferGeometry();
  geometry.setAttribute('position',new Float32BufferAttribute(points.flat(),3));
  geometry.setAttribute('normal',new Float32BufferAttribute(points.flatMap(()=>[0,0,1]),3));
  const from=new Float32Array(18),to=new Float32Array(18),fromNormals=new Float32Array(18),toNormals=new Float32Array(18);
  const mask=new Uint8Array([1,1,1,0,0,0]),angle=.31,c=Math.cos(angle),s=Math.sin(angle),cy=.4/3;
  for(let i=0;i<6;i++){
    const [x,y]=points[i],localY=reverse&&i<3?cy-y:y-cy;
    to[i*3]=c*x-s*localY+2-x;
    to[i*3+1]=s*x+c*localY+cy-3-y;
    to[i*3+2]=.7+(reverse&&i<3?(i===1?.02:-.01):0);
    if(reverse&&i<3){toNormals[i*3]=-s*.1;toNormals[i*3+1]=c*.1;toNormals[i*3+2]=-.005;}
  }
  return {geometry,mask,from,to,fromNormals,toNormals,points};
}

test('aligned native shape difference removes rigid translation and screen rotation',()=>{
  const f=alignedFixture(),result=alignedShapeDifference(f.geometry,f.mask,f.from,f.to,f.fromNormals,f.toNormals);
  for(const value of result.positions)near(value,0);
  for(const value of result.normals)near(value,0);
});

test('aligned native shape difference preserves reverse bend, local depth and normals only inside its mask',()=>{
  const f=alignedFixture({reverse:true}),result=alignedShapeDifference(f.geometry,f.mask,f.from,f.to,f.fromNormals,f.toNormals);
  const changed=f.points.map((p,i)=>p.map((v,k)=>v+result.positions[i*3+k]));
  for(let axis=0;axis<3;axis++){
    near(changed.slice(0,3).reduce((sum,p)=>sum+p[axis],0),f.points.slice(0,3).reduce((sum,p)=>sum+p[axis],0));
  }
  assert.ok(changed[1][1]<(changed[0][1]+changed[2][1])/2);
  near(changed[0][1],changed[2][1]);
  near(changed[0][2],-.01);near(changed[1][2],.02);near(changed[2][2],-.01);
  for(let i=0;i<3;i++){near(result.normals[i*3],0);near(result.normals[i*3+1],.1);near(result.normals[i*3+2],-.005);}
  assert.ok(result.positions.subarray(9).every(value=>value===0));
  assert.ok(result.normals.subarray(9).every(value=>value===0));
});

function mouthFixture(){
  const geometry=new BufferGeometry(),points=[],uv=[],opening=[],lip=[];
  // Three connected strips: stationary face seam, flexible skin, lip contour.
  for(let row=0;row<3;row++)for(let column=0;column<3;column++){
    points.push(column-1,row*.3+(column===1?-.1:0),0);
    uv.push(.23+column*.02,row===2?.263:.2);
    opening.push(0,row===0?0:row===2?.000001:.2,0);
    lip.push(row===2?1:0);
  }
  // A disconnected moving island has no contour anchor and must not deform.
  points.push(4,0,0,5,0,0,4,1,0);uv.push(0,0,0,0,0,0);
  opening.push(0,.1,0,0,.1,0,0,.1,0);lip.push(0,0,0);
  const indices=[];
  for(let row=0;row<2;row++)for(let column=0;column<2;column++){
    const a=row*3+column;indices.push(a,a+1,a+3,a+1,a+4,a+3);
  }
  indices.push(9,10,11);
  geometry.setAttribute('position',new Float32BufferAttribute(points,3));
  geometry.setAttribute('uv',new Float32BufferAttribute(uv,2));
  geometry.setIndex(indices);
  return {geometry,opening:new Float32Array(opening),lip:new Uint8Array(lip)};
}

test('mouth topology support fixes the seam, reaches tiny-moving lip anchors and interpolates skin',()=>{
  const {geometry,opening,lip}=mouthFixture(),weights=mouthSupportWeights(geometry,opening,lip);
  assert.deepEqual([...weights.slice(0,3)],[0,0,0]);
  assert.deepEqual([...weights.slice(6,9)],[1,1,1]);
  assert.ok(weights.slice(3,6).every(value=>value>0&&value<1));
  assert.ok(weights.every(value=>Number.isFinite(value)&&value>=0&&value<=1));
  assert.deepEqual([...weights.slice(9)],[0,0,0]);
  // Support depends on topology and fixed endpoints, not the A delta magnitude.
  const larger=opening.map(value=>value*100);
  assert.deepEqual(mouthSupportWeights(geometry,larger,lip),weights);
  opening[7*3+1]=0;
  assert.equal(mouthSupportWeights(geometry,opening,lip)[7],0);
  geometry.dispose();
});

test('mouth curvature retains full lip bend while every derived channel keeps the face seam fixed',()=>{
  const {geometry,opening}=mouthFixture(),{channels,curvature,bounds}=mouthChannels(geometry,opening);
  for(const channel of Object.values(channels))assert.ok(channel.slice(0,9).every(value=>value===0));
  const target=.04,delta=target-curvature,p=geometry.attributes.position;
  const y=[6,7,8].map(i=>p.getY(i)+channels.curve0[i*3+1]*delta);
  const resultingCurve=(y[1]-(y[0]+y[2])/2)/bounds.size[0];
  near(resultingCurve,target);
  assert.ok(y[1]>(y[0]+y[2])/2,'negative FORM must reverse a smiling lip, not merely weaken its smile');
  geometry.dispose();
});

test('disconnected UV islands sharing closed lip positions receive identical derived displacement',()=>{
  const {geometry,opening,lip}=mouthFixture(),p=geometry.attributes.position,uv=geometry.attributes.uv;
  // The cavity uses different UVs and indices, but these vertices are the
  // same physical seam as the outer lip and must remain coincident.
  const originals=[7,4,0],positions=[...p.array],uvs=[...uv.array],deltas=[...opening],mask=[...lip];
  for(const i of originals){
    positions.push(p.getX(i),p.getY(i),p.getZ(i));uvs.push(.05,.08);
    deltas.push(...opening.slice(i*3,i*3+3));mask.push(0);
  }
  geometry.setAttribute('position',new Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new Float32BufferAttribute(uvs,2));
  geometry.setIndex([...geometry.index.array,12,13,14]);
  const weights=mouthSupportWeights(geometry,deltas,mask),{channels}=mouthChannels(geometry,deltas);
  for(const [index,i]of originals.entries()){
    const duplicate=12+index;
    assert.equal(weights[duplicate],weights[i]);
    for(const channel of Object.values(channels))for(let axis=0;axis<3;axis++){
      assert.equal(channel[duplicate*3+axis],channel[i*3+axis]);
    }
  }
  assert.equal(weights[12],1);assert.ok(weights[13]>0&&weights[13]<1);assert.equal(weights[14],0);
  geometry.dispose();
});

test('negative mouth channel preserves authored placement and depth of the lip and cavity together',()=>{
  const {geometry,opening}=mouthFixture(),sad=new Float32Array(opening.length),normals=new Float32Array(opening.length);
  // An authored inner cavity can move differently from the lip. Stripping
  // rigid placement from only one surface makes an otherwise valid blend tear.
  for(let i=3;i<12;i++){
    sad[i*3]=.01*(i%3-1);sad[i*3+1]=i<9?-.03:-.05;sad[i*3+2]=i<9?.02:.01;
    normals[i*3+1]=.15;normals[i*3+2]=-.01;
  }
  const {channels,negativeNormals}=mouthChannels(geometry,opening,sad,normals);
  assert.deepEqual(channels.negative,sad);assert.notEqual(channels.negative,sad);
  assert.deepEqual(negativeNormals,normals);assert.notEqual(negativeNormals,normals);
  assert.ok(channels.negative.slice(0,9).every(value=>value===0));
  const noNormals=mouthChannels(geometry,opening,sad);
  assert.ok(noNormals.negativeNormals.every(value=>value===0));
  assert.equal(mouthChannels(geometry,opening).channels.negative,undefined);
  geometry.dispose();
});
