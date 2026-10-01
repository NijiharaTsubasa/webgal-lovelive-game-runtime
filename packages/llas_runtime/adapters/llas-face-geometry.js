
// Runtime-authored channels are local to this instance. Neither the published
// geometry nor another character sharing it is edited.
export class FaceMorphWorkspace {
  constructor(root, mesh, THREE) {
    this.Float32BufferAttribute = THREE.Float32BufferAttribute;
    if (!mesh.geometry?.morphTargetsRelative) throw new Error('LLAS face requires relative Morph geometry');
    this.originalGeometry = mesh.geometry;
    this.geometry = mesh.geometry.clone();
    this.mesh = mesh;
    this.originalCount = mesh.morphTargetInfluences.length;
    this.channels = new Map();
    this.objects = [];
    root.traverse(object => {
      if (object.geometry !== this.originalGeometry) return;
      this.objects.push({object, geometry:object.geometry,
        dictionary:object.morphTargetDictionary, influences:object.morphTargetInfluences});
      object.geometry = this.geometry;
      object.morphTargetDictionary = {...object.morphTargetDictionary};
      object.morphTargetInfluences = [...object.morphTargetInfluences];
    });
  }

  add(name, positions, normals) {
    if (this.channels.has(name)) throw new Error(`Duplicate derived face channel: ${name}`);
    const count = this.geometry.attributes.position.count;
    if (positions.length !== count * 3 || !positions.every(Number.isFinite)) throw new Error(`Invalid face channel: ${name}`);
    const attributes = this.geometry.morphAttributes;
    const index = attributes.position.length;
    const position = new this.Float32BufferAttribute(positions, 3);
    position.name = name;
    attributes.position.push(position);
    // Keep all enabled Morph attributes at the same target count. Zero means
    // this derived position-only channel retains the original surface normal.
    for (const [kind, targets] of Object.entries(attributes)) {
      if (kind === 'position') continue;
      const size = targets[0].itemSize;
      const values = kind === 'normal' && normals ? normals : new Float32Array(count * size);
      if (values.length !== count * size || !values.every(Number.isFinite)) throw new Error(`Invalid ${kind} face channel: ${name}`);
      const attribute = new this.Float32BufferAttribute(values, size);
      attribute.name = name;
      targets.push(attribute);
    }
    for (const {object} of this.objects) {
      object.morphTargetDictionary[name] = index;
      object.morphTargetInfluences.push(0);
      for (const material of [object.material].flat()) if (material) material.needsUpdate = true;
    }
    this.channels.set(name, index);
    return index;
  }

  write(values) {
    for (const {object} of this.objects) {
      for (const [name,index] of this.channels) object.morphTargetInfluences[index] = values[name] ?? 0;
    }
  }

  dispose() {
    if (!this.geometry) return;
    for (const saved of this.objects) {
      for (let index=0;index<saved.influences.length;index++) saved.influences[index]=saved.object.morphTargetInfluences[index];
      saved.object.geometry = saved.geometry;
      saved.object.morphTargetDictionary = saved.dictionary;
      saved.object.morphTargetInfluences = saved.influences;
      for (const material of [saved.object.material].flat()) if (material) material.needsUpdate = true;
    }
    this.geometry.dispose();
    this.geometry = null;
    this.objects = [];
  }
}

// A recipe is used only to locate source Morph coefficients. Geometry is
// evaluated once at binding, then split into independent regional channels.
export function morphVector(mesh, weights, kind = 'position') {
  const count = mesh.geometry.attributes.position.count;
  const result = new Float32Array(count * 3);
  for (const [name, weight] of Object.entries(weights ?? {})) {
    if (!weight) continue;
    const index = mesh.morphTargetDictionary[name];
    if (index === undefined) throw new Error(`Missing face Morph: ${name}`);
    const attribute = mesh.geometry.morphAttributes[kind]?.[index];
    if (!attribute) continue;
    for (let i = 0; i < count; i++) {
      result[i*3] += attribute.getX(i) * weight;
      result[i*3+1] += attribute.getY(i) * weight;
      result[i*3+2] += attribute.getZ(i) * weight;
    }
  }
  return result;
}

export function maskedDifference(to, from, mask) {
  const result = new Float32Array(to.length);
  for (let i = 0; i < mask.length; i++) if (mask[i]) {
    for (let axis = 0; axis < 3; axis++) result[i*3+axis] = to[i*3+axis]-from[i*3+axis];
  }
  return result;
}

export function connectedVertices(geometry) {
  const count = geometry.attributes.position.count;
  const parents = Int32Array.from({length:count}, (_,i)=>i);
  const find = i => {
    while (parents[i] !== i) { parents[i] = parents[parents[i]]; i = parents[i]; }
    return i;
  };
  const join = (a,b) => { parents[find(a)] = find(b); };
  const index = geometry.index;
  const length = index?.count ?? count;
  const get = i => index ? index.getX(i) : i;
  for (let i = 0; i < length; i+=3) { join(get(i),get(i+1)); join(get(i),get(i+2)); }
  const groups = new Map();
  for (let i = 0; i < count; i++) {
    const key = find(i);
    if (!groups.has(key)) groups.set(key,[]);
    groups.get(key).push(i);
  }
  return [...groups.values()];
}

// LLAS face atlas, measured on all 30 ordinary faces: brow V is
// [0.396522, 0.406101], disjoint from eyelids, with no split triangles.
// This is a source-asset convention, not a generic humanoid assumption.
export function classifyEyeRegions(geometry) {
  const position = geometry.attributes.position, uv = geometry.attributes.uv;
  if (!uv || uv.count !== position.count) throw new Error('LLAS eye atlas is missing');
  const regions = {};
  for (const [side,sign] of [['L',1],['R',-1]]) {
    const brow = new Uint8Array(position.count), eye = new Uint8Array(position.count);
    for (let i=0;i<position.count;i++) {
      if (position.getX(i)*sign <= 0) continue;
      if (uv.getY(i)>.39 && uv.getY(i)<.41) brow[i]=1;
      else eye[i]=1;
    }
    if (!brow.some(Boolean)) throw new Error(`LLAS ${side} brow region not found`);
    regions[side]={brow,eye,lid:new Uint8Array(position.count)};
  }
  for (const vertices of connectedVertices(geometry)) {
    const masks = Object.values(regions).flatMap(region=>[region.brow,region.eye]);
    if (masks.filter(mask=>vertices.some(i=>mask[i])).length>1) throw new Error('LLAS face region would cut connected geometry');
    // Use whole islands: unrelated skin UVs can cross the same V band.
    if(vertices.every(i=>uv.getX(i)>.34&&uv.getX(i)<.45&&uv.getY(i)>.414&&uv.getY(i)<.43)){
      for(const i of vertices)regions[position.getX(i)>0?'L':'R'].lid[i]=1;
    }
  }
  return regions;
}

export function regionBounds(geometry, mask, offset) {
  const p=geometry.attributes.position;
  const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  for(let i=0;i<p.count;i++) if(mask[i]) for(let axis=0;axis<3;axis++){
    const value=p.getComponent(i,axis)+(offset?.[i*3+axis]??0);
    min[axis]=Math.min(min[axis],value);max[axis]=Math.max(max[axis],value);
  }
  return {min,max,center:min.map((v,i)=>(v+max[i])/2),size:min.map((v,i)=>max[i]-v)};
}

// General planar affine channels for an isolated part. sin/cos coefficients
// express a real rotation without a per-frame vertex loop or endpoint lerp.
export function planarChannels(geometry,mask,center,offset) {
  const p=geometry.attributes.position, n=geometry.attributes.normal;
  const make=()=>new Float32Array(p.count*3);
  const result={x:make(),y:make(),sin:make(),cos:make(),scale:make(),curve:make(),normalSin:make(),normalCos:make()};
  const bounds=regionBounds(geometry,mask,offset),width=bounds.size[0];
  for(let i=0;i<p.count;i++)if(mask[i]){
    const x=p.getX(i)+(offset?.[i*3]??0)-center[0], y=p.getY(i)+(offset?.[i*3+1]??0)-center[1];
    result.x[i*3]=1;result.y[i*3+1]=1;
    result.sin[i*3]=-y;result.sin[i*3+1]=x;
    result.cos[i*3]=x;result.cos[i*3+1]=y;
    result.scale[i*3]=x;result.scale[i*3+1]=y;
    result.curve[i*3+1]=width*(1-(2*x/width)**2);
    if(n){result.normalSin[i*3]=-n.getY(i);result.normalSin[i*3+1]=n.getX(i);result.normalCos[i*3]=n.getX(i);result.normalCos[i*3+1]=n.getY(i);}
  }
  return result;
}

// Keep a native regional shape's bend/depth while removing the expression's
// overall translation and planar angle. Thus brow FORM does not also select
// Sad's brow position, angle, eyelids, or the other side of the face.
export function alignedShapeDifference(geometry,mask,from,to,fromNormals,toNormals) {
  const p=geometry.attributes.position,n=geometry.attributes.normal;
  const a=[0,0,0],b=[0,0,0];let count=0;
  for(let i=0;i<p.count;i++)if(mask[i]){
    count++;for(let k=0;k<3;k++){a[k]+=p.getComponent(i,k)+from[i*3+k];b[k]+=p.getComponent(i,k)+to[i*3+k];}
  }
  for(let k=0;k<3;k++){a[k]/=count;b[k]/=count;}
  let dot=0,cross=0;
  for(let i=0;i<p.count;i++)if(mask[i]){
    const ax=p.getX(i)+from[i*3]-a[0],ay=p.getY(i)+from[i*3+1]-a[1];
    const bx=p.getX(i)+to[i*3]-b[0],by=p.getY(i)+to[i*3+1]-b[1];
    dot+=ax*bx+ay*by;cross+=bx*ay-by*ax;
  }
  const angle=Math.atan2(cross,dot),c=Math.cos(angle),s=Math.sin(angle);
  const positions=new Float32Array(p.count*3),normals=new Float32Array(p.count*3);
  for(let i=0;i<p.count;i++)if(mask[i]){
    const x=p.getX(i)+to[i*3]-b[0],y=p.getY(i)+to[i*3+1]-b[1];
    positions[i*3]=c*x-s*y+a[0]-p.getX(i)-from[i*3];
    positions[i*3+1]=s*x+c*y+a[1]-p.getY(i)-from[i*3+1];
    positions[i*3+2]=to[i*3+2]-from[i*3+2]+a[2]-b[2];
    if(n){
      const nx=n.getX(i)+(toNormals?.[i*3]??0),ny=n.getY(i)+(toNormals?.[i*3+1]??0);
      normals[i*3]=c*nx-s*ny-n.getX(i)-(fromNormals?.[i*3]??0);
      normals[i*3+1]=s*nx+c*ny-n.getY(i)-(fromNormals?.[i*3+1]??0);
      normals[i*3+2]=(toNormals?.[i*3+2]??0)-(fromNormals?.[i*3+2]??0);
    }
  }
  return {positions,normals};
}

// Solve the mouth's support once at binding. Native A's stationary vertices
// remain fixed; the lip contour receives the full authored deformation. A's
// movement magnitude is not a blend weight: using it creates sharp gradients
// at small-moving interior vertices and can reverse the surrounding triangles.
export function mouthSupportWeights(geometry,opening,lip) {
  const p=geometry.attributes.position,count=p.count,groups=[],byPosition=new Map(),vertexGroup=new Uint32Array(count);
  // UV seams split the outer lip from the inner lip/cavity into separate
  // index islands. They are still one surface: solve coincident vertices
  // together so a closed mouth cannot split along those texture seams.
  for(let i=0;i<count;i++){
    const key=`${p.getX(i)},${p.getY(i)},${p.getZ(i)}`;
    if(!byPosition.has(key)){byPosition.set(key,groups.length);groups.push([]);}
    vertexGroup[i]=byPosition.get(key);groups[vertexGroup[i]].push(i);
  }
  const neighbors=groups.map(()=>new Map()),fixed=new Uint8Array(groups.length),weights=new Float64Array(groups.length);
  for(const [group,vertices]of groups.entries())for(const i of vertices){
    const stationary=Math.hypot(opening[i*3],opening[i*3+1],opening[i*3+2])<=1e-8;
    if(stationary){fixed[group]=2;weights[group]=0;}
    else if(lip[i]&&fixed[group]!==2){fixed[group]=1;weights[group]=1;}
  }
  const edge=(a,b)=>{
    const ga=vertexGroup[a],gb=vertexGroup[b];if(ga===gb)return;
    const distance=Math.hypot(p.getX(a)-p.getX(b),p.getY(a)-p.getY(b),p.getZ(a)-p.getZ(b));
    const weight=1/Math.max(distance,1e-8);
    neighbors[ga].set(gb,weight);neighbors[gb].set(ga,weight);
  };
  const index=geometry.index,total=index?.count??count,get=i=>index?index.getX(i):i;
  for(let i=0;i<total;i+=3){const a=get(i),b=get(i+1),c=get(i+2);edge(a,b);edge(b,c);edge(c,a);}
  for(let iteration=0;iteration<512;iteration++){
    let change=0;
    for(let i=0;i<groups.length;i++)if(!fixed[i]&&neighbors[i].size){
      let value=0,total=0;for(const [j,weight]of neighbors[i]){value+=weights[j]*weight;total+=weight;}
      value/=total;change=Math.max(change,Math.abs(value-weights[i]));weights[i]=value;
    }
    if(change<1e-7)break;
  }
  return Float64Array.from(vertexGroup,group=>weights[group]);
}

export function mouthChannels(geometry,opening,sad,sadNormals) {
  const p=geometry.attributes.position,uv=geometry.attributes.uv;
  const lip=new Uint8Array(p.count);
  for(let i=0;i<p.count;i++)lip[i]=uv.getX(i)>.22&&uv.getX(i)<.285&&uv.getY(i)>.2625&&uv.getY(i)<.2642?1:0;
  if(!lip.some(Boolean))throw new Error('LLAS mouth atlas region not found');
  const bounds=regionBounds(geometry,lip),center=bounds.center,w=bounds.size[0]/2;
  // Fit the actual closed lip midline, including both upper/lower samples.
  // Different LLAS faces start with different smiles; a fixed additive bend
  // can merely flatten one face while turning another into a frown.
  let samples=0,sumQ=0,sumY=0,sumQQ=0,sumQY=0;
  for(let i=0;i<p.count;i++)if(lip[i]){
    const q=((p.getX(i)-center[0])/w)**2,y=(p.getY(i)-center[1])/(2*w);
    samples++;sumQ+=q;sumY+=y;sumQQ+=q*q;sumQY+=q*y;
  }
  const curvature=-(sumQY-sumQ*sumY/samples)/(sumQQ-sumQ*sumQ/samples);
  const names=['baseX','openX','baseY','openY','moveY','curve0','curve1','curve2'];
  const channels=Object.fromEntries(names.map(name=>[name,new Float32Array(p.count*3)]));
  const support=mouthSupportWeights(geometry,opening,lip);
  const falloff=(v,inner,outer)=>{const t=Math.max(0,Math.min(1,(v-inner)/(outer-inner)));return 1-t*t*(3-2*t);};
  for(let i=0;i<p.count;i++){
    const x=p.getX(i)-center[0],y=p.getY(i)-center[1],dx=opening[i*3],dy=opening[i*3+1];
    // Mouth shares stationary seams with Face/Body. Native A keeps these
    // vertices fixed; a purely spatial warp would tear the two meshes apart.
    const mask=falloff(Math.abs(x)/w,1,1.8)*falloff(Math.abs(y)/w,.6,1.5)*support[i];
    channels.baseX[i*3]=mask*x;channels.openX[i*3]=mask*dx;
    channels.baseY[i*3+1]=mask*y;channels.openY[i*3+1]=mask*dy;
    channels.moveY[i*3+1]=mask;
    // A common continuous warp moves upper/lower lips and interior together.
    // q(x+a*dx) is expanded so runtime remains scalar Morph blending.
    channels.curve0[i*3+1]=mask*2*w*(1-(x/w)**2);
    channels.curve1[i*3+1]=mask*(-4*x*dx/w);
    channels.curve2[i*3+1]=mask*(-2*dx*dx/w);
  }
  let negativeNormals;
  if(sad){
    // Keep the source's authored frown (including its local depth and lip
    // thickness), instead of inferring a visible mouth from one fitted line.
    // Its placement is part of that authored shape too: independently removing
    // it from the outer skin can expose the inner cavity through the chin.
    channels.negative=new Float32Array(sad);
    negativeNormals=new Float32Array(sadNormals??sad.length);
  }
  return {channels,bounds,curvature,negativeNormals};
}
