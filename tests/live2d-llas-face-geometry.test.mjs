import test from 'node:test';
import assert from 'node:assert/strict';
import { BufferGeometry, Float32BufferAttribute, Group, Mesh, MeshBasicMaterial } from 'three';
import { FaceMorphWorkspace, maskedDifference, connectedVertices, browCurvature, planarChannels, mouthSupportWeights, mouthChannels, triangleDepthGap } from '../packages/llas_runtime/adapters/llas-face-geometry.js';

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
  const delta = Float32Array.from(mesh.geometry.morphAttributes.position[0].array);
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
  const values = Float32Array.from(mesh.geometry.morphAttributes.position[0].array,v=>v*-.5);
  const left = maskedDifference(values,new Float32Array(18),[1,1,1,0,0,0]);
  assert.equal(left[1],-.5);assert.equal(left[4],-1);assert.equal(left[7],-1.5);
  assert.ok(left.subarray(9).every(v=>v===0));
});

const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
test('brow depth uses interior face peaks and edge crossings, independently of winding and scale',()=>{
  const brow=[{x:0,y:0,z:0},{x:2,y:0,z:0},{x:0,y:2,z:0}];
  const skin=[{x:-1,y:1,z:-1},{x:1,y:1,z:.4},{x:1,y:3,z:-1}];
  near(triangleDepthGap(brow,skin),.4);
  near(triangleDepthGap([...brow].reverse(),skin),.4);
  const crossing=[{x:-1,y:1,z:-1},{x:1,y:-1,z:1},{x:3,y:3,z:1}];
  assert.ok(triangleDepthGap(brow,crossing)>0);
  const moved=skin.map(p=>({...p,x:p.x+10}));
  assert.equal(triangleDepthGap(brow,moved),-Infinity);
  const scale=points=>points.map(p=>({x:p.x*.01,y:p.y*.01,z:p.z*.01}));
  near(triangleDepthGap(scale(brow),scale(skin)),.004);
});
test('brow curvature separates bend from offset and linear slant with nonuniform samples',()=>{
  const geometry=new BufferGeometry(),xs=[-1,-.7,-.1,.3,1],curve=.17;
  const points=xs.map(x=>[x,3+.43*x+2*curve*(1-x*x),.04*x]);
  geometry.setAttribute('position',new Float32BufferAttribute(points.flat(),3));
  const mask=new Uint8Array(xs.length).fill(1),offset=new Float32Array(xs.length*3);
  near(browCurvature(geometry,mask,offset),curve);
  for(let i=0;i<xs.length;i++)offset[i*3+1]=7-.29*xs[i];
  near(browCurvature(geometry,mask,offset),curve);
  geometry.dispose();
});

test('derived negative brow bend preserves matching upper/lower thickness and local depth',()=>{
  const geometry=new BufferGeometry(),points=[];
  for(const y of [0,.06])for(const x of [-1,0,1])points.push([x,y+.2*(1-x*x),.03*x]);
  geometry.setAttribute('position',new Float32BufferAttribute(points.flat(),3));
  geometry.setAttribute('normal',new Float32BufferAttribute(points.flatMap(()=>[0,0,1]),3));
  const mask=new Uint8Array(points.length).fill(1),delta=planarChannels(geometry,mask,[0,.13,0],new Float32Array(points.length*3)).curve;
  const changed=points.map((p,i)=>p.map((v,k)=>v-.3*delta[i*3+k]));
  assert.ok(changed[1][1]<(changed[0][1]+changed[2][1])/2);
  for(let i=0;i<3;i++)near(changed[i+3][1]-changed[i][1],.06);
  for(let i=0;i<points.length;i++){near(changed[i][0],points[i][0]);near(changed[i][2],points[i][2]);}
  geometry.dispose();
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
  // A detached mouth interior has no fixed boundary; it must follow the lip warp.
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
  assert.deepEqual([...weights.slice(9)],[1,1,1]);
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

test('detached inner-mouth components follow deformation and UV-split skin does not become detached',()=>{
  const {geometry,opening,lip}=mouthFixture(),p=geometry.attributes.position,uv=geometry.attributes.uv;
  // One UV island shares the flexible skin and fixed outer edge, so its
  // entire welded component still has a boundary. The detached triangle is
  // duplicated in another UV island and must receive the same full warp.
  const originals=[4,0,3,9,10,11],positions=[...p.array],uvs=[...uv.array],deltas=[...opening],mask=[...lip];
  for(const i of originals){positions.push(p.getX(i),p.getY(i),p.getZ(i));uvs.push(.01,.02);deltas.push(...opening.slice(i*3,i*3+3));mask.push(0);}
  geometry.setAttribute('position',new Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new Float32BufferAttribute(uvs,2));
  geometry.setIndex([...geometry.index.array,12,13,14,15,16,17]);
  const support=mouthSupportWeights(geometry,deltas,mask),{channels}=mouthChannels(geometry,deltas);
  assert.ok(support[12]>0&&support[12]<1);assert.equal(support[13],0);
  for(const i of [9,10,11,15,16,17]){assert.equal(support[i],1);near(channels.moveY[i*3+1],1);}
  for(const [j,i]of originals.entries())for(const values of Object.values(channels))for(let axis=0;axis<3;axis++)near(values[(12+j)*3+axis],values[i*3+axis]);
  for(const values of Object.values(channels))assert.ok(values.slice(0,9).every(v=>v===0),'the real fixed outer seam must stay fixed');
  geometry.dispose();
});

test('each mouth phoneme retains its own stationary support without changing shared lip or outer seam constraints',()=>{
  const {geometry,opening,lip}=mouthFixture(),rounded=opening.slice();
  // Actual ch0210 has O-stationary skin/cavity points that move under A.
  // A branch's harmonic support must not be reused for those O boundaries.
  rounded.fill(0,4*3,4*3+3);
  const a=mouthSupportWeights(geometry,opening,lip),o=mouthSupportWeights(geometry,rounded,lip);
  const ac=mouthChannels(geometry,opening).channels,oc=mouthChannels(geometry,rounded).channels;
  assert.ok(a[4]>0&&a[4]<1);assert.equal(o[4],0);
  assert.ok(ac.moveY[4*3+1]>0);assert.equal(oc.moveY[4*3+1],0);
  for(const i of [0,1,2]){assert.equal(a[i],0);assert.equal(o[i],0);}
  for(const i of [6,7,8]){assert.equal(a[i],1);assert.equal(o[i],1);}
  for(const i of [9,10,11]){assert.equal(a.internal[i],1);assert.equal(o.internal[i],1);}
  geometry.dispose();
});
