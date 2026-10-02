import { evaluateBinding } from '../behaviors/face.js';
import { FaceMorphWorkspace, morphVector, maskedDifference, classifyEyeRegions, regionBounds, planarChannels, mouthChannels, alignedShapeDifference, browDepthConstraint } from './llas-face-geometry.js';
import { llasFaceControls } from './llas-live2d-parameters.js';

// LLAS-specific authored rig. Native LLAS.Face remains unchanged; the host
// relinquishes its original expression writer while this driver is installed.
export class LlasLive2dFace {
  constructor(context) {
    const { Matrix4, Vector3 } = context.THREE;
    this.root=context.root;
    this.parameters={};this.defaults={};this.underlay=null;this.workspaces=[];
    const runtimes=new Set();
    this.root.traverse(object=>{for(const material of [object.material].flat())
      for(const runtime of material ? context.getShaderRuntimes(material) : [])
        if(typeof runtime.setExternalCheek==='function')runtimes.add(runtime);
    });
    this.cheekRuntimes=[...runtimes];
    const part=context.parts.find(part=>part.component.behaviors?.some(b=>b.name==='LLAS.Face'));
    if(!part)throw new Error('LLAS direct face requires ordinary face bindings; board faces use their own rig');
    this.resolve=name=>context.resolveNode(part.role,name);
    const definition=part.component;
    const declaration=definition.behaviors?.find(b=>b.name==='LLAS.Face');
    if(!declaration)throw new Error('LLAS direct face requires ordinary face bindings; board faces use their own rig');
    this.bindings=declaration.parameters.bindings.map(binding=>({...binding,object:this.resolve(binding.node)}));
    this.poses=new Map(definition.morphPoses.map(p=>[p.name,p.targets]));
    // Resolve references once through the loader's original-name index. Runtime
    // display names may have been cleaned by the GLB loader.
    this.poseWrites=new Map([...this.poses].map(([name,targets])=>[name,Object.entries(targets).flatMap(([node,morphs])=>{
      const object=this.resolve(node);
      return Object.entries(morphs).map(([morph,weight])=>({object,index:object.morphTargetDictionary[morph],weight}));
    })]));
    this.morphs=[...new Map([...this.poseWrites.values()].flat().map(binding=>[`${binding.object.uuid}:${binding.index}`,binding])).values()];
    try {
    const mesh=name=>{
      const node=this.resolve(name);
      if(node.isMesh)return node;
      const found=[];node.traverse(o=>{if(o.isMesh&&!o.userData?.__parameterizedPassObject)found.push(o);});
      if(found.length!==1)throw new Error(`LLAS ${name}: expected a single source primitive`);
      return found[0];
    };
    this.eyeMesh=mesh('Eye_Around');
    this.eyeWork=new FaceMorphWorkspace(this.root,this.eyeMesh,context.THREE);this.workspaces.push(this.eyeWork);
    const regions=classifyEyeRegions(this.eyeMesh.geometry);
    const vector=(pose,kind)=>morphVector(this.eyeMesh,this.poses.get(`eye/${pose}`).Eye_Around,kind);
    const open=vector('Open'),openNormal=vector('Open','normal');
    const bounds=Object.fromEntries(['L','R'].map(side=>[side,regionBounds(this.eyeMesh.geometry,regions[side].brow,open)]));
    // Some LLAS faces skin the iris to Eye1, not Eye2. The common parent
    // carries both and keeps the original child companion deformation intact.
    this.eyeBones=Object.fromEntries(['L','R'].map(side=>[side,this.resolve(side==='L'?'LeftEye_Root':'RightEye_Root')]));
    const bindProperties=this.bindings.filter(b=>b.property!=='visible').map(b=>({...b,value:b.object[b.property].toArray()}));
    try {
      // Measure the neutral companion rig, not whichever native expression
      // happened to be selected before installing this driver.
      for(const binding of bindProperties)binding.object[binding.property].fromArray(evaluateBinding(binding,{'eye/Open':1}));
      this.root.updateMatrixWorld(true);
      const centers=Object.fromEntries(['L','R'].map(side=>[side,this.resolve(side==='L'?'LeftEye2':'RightEye2').getWorldPosition(new Vector3())]));
      this.irisPivots=Object.fromEntries(['L','R'].map(side=>[side,this.eyeBones[side].worldToLocal(centers[side].clone())]));
      this.eyeDistance=this.eyeMesh.worldToLocal(centers.L.clone()).distanceTo(this.eyeMesh.worldToLocal(centers.R.clone()));
    } finally {
      for(const binding of bindProperties)binding.object[binding.property].fromArray(binding.value);
      this.root.updateMatrixWorld(true);
    }
    this.gazeBasis=Object.fromEntries(Object.entries(this.eyeBones).map(([side,bone])=>{
      // Eye_Around and Eye_Root share the rigid Head_All ancestor. Its
      // animated transform cancels, leaving a fixed face-local basis.
      const matrix=new Matrix4().copy(bone.parent.matrixWorld).invert().multiply(this.eyeMesh.matrixWorld);
      return [side,matrix];
    }));
    for(const side of ['L','R']){
      for(const shape of ['Close','CloseSmile','WideOpen'])this.eyeWork.add(`eye:${side}:${shape}`,
        maskedDifference(vector(shape),open,regions[side].eye),maskedDifference(vector(shape,'normal'),openNormal,regions[side].eye));
      const channels=planarChannels(this.eyeMesh.geometry,regions[side].brow,bounds[side].center,open);
      for(const name of ['x','y','sin','cos','curve'])this.eyeWork.add(`brow:${side}:${name}`,channels[name],
        name==='sin'?channels.normalSin:name==='cos'?channels.normalCos:undefined);
      const negative=alignedShapeDifference(this.eyeMesh.geometry,regions[side].brow,open,vector('Sad'),openNormal,vector('Sad','normal'));
      this.eyeWork.add(`brow:${side}:negative`,negative.positions,negative.normals);
      const depth=new Float32Array(open.length);
      for(let i=0;i<regions[side].brow.length;i++)if(regions[side].brow[i])depth[i*3+2]=1;
      this.eyeWork.add(`brow:${side}:depth`,depth);
      const lid=new Float32Array(open.length);
      for(let i=0;i<regions[side].lid.length;i++)if(regions[side].lid[i])lid[i*3+1]=1;
      this.eyeWork.add(`eye:${side}:lid`,lid);
    }
    this.browDepth=browDepthConstraint(this.eyeMesh,mesh('Face'),regions,open,context.THREE);
    this.mouthMesh=mesh('Mouth');
    this.mouthWork=new FaceMorphWorkspace(this.root,this.mouthMesh,context.THREE);this.workspaces.push(this.mouthWork);
    const mouth=mouthChannels(this.mouthMesh.geometry,morphVector(this.mouthMesh,this.poses.get('mouth/A').Mouth),
      morphVector(this.mouthMesh,this.poses.get('mouth/Sad').Mouth),
      morphVector(this.mouthMesh,this.poses.get('mouth/Sad').Mouth,'normal'));
    this.closedMouthCurvature=mouth.curvature;
    for(const [name,delta] of Object.entries(mouth.channels))this.mouthWork.add(`mouth:${name}`,delta,
      name==='negative'?mouth.negativeNormals:undefined);
    this.eyeSpace=new Matrix4();this.localShift=new Vector3();this.origin=new Vector3();
    const ownedMorphs=new Map(this.morphs.map(b=>[`${b.object.uuid}:${b.index}`,b]));
    for(const work of this.workspaces)for(const {object} of work.objects)for(const index of work.channels.values())ownedMorphs.set(`${object.uuid}:${index}`,{object,index});
    this.ownedMorphs=[...ownedMorphs.values()];
    const owned=new Map();
    const own=(object,property)=>owned.set(`${object.uuid}:${property}`,{object,property});
    for(const binding of this.bindings)own(binding.object,binding.property);
    for(const object of Object.values(this.eyeBones)){own(object,'position');own(object,'scale');}
    this.ownedProperties=[...owned.values()];
    } catch(error) {
      for(const work of this.workspaces)work.dispose();
      throw error;
    }
  }

  setParameters(parameters,defaults={}) {
    this.parameters={...parameters};this.defaults={...defaults};
    const controls=llasFaceControls(parameters,defaults);
    if(controls.cheek>0&&!this.cheekRuntimes.some(runtime=>runtime.cheekSupport?.supported))
      controls.limitations.push('当前模型或渲染模式未提供可用脸红纹理');
    return controls;
  }

  beginFrame() {
    if(!this.underlay)return;
    for(const {object,index,value} of this.underlay.morphs)object.morphTargetInfluences[index]=value;
    for(const {object,property,value} of this.underlay.properties){
      if(property==='visible')object.visible=value;else object[property].fromArray(value);
    }
    this.underlay=null;
    for(const runtime of this.cheekRuntimes)runtime.setExternalCheek(null);
  }

  update() {
    this.beginFrame();
    const controls=llasFaceControls(this.parameters,this.defaults);
    this.underlay={morphs:this.ownedMorphs.map(b=>({...b,value:b.object.morphTargetInfluences[b.index]})),properties:this.ownedProperties.map(b=>({...b,
      value:b.property==='visible'?b.object.visible:b.object[b.property].toArray()}))};
    for(const b of this.morphs)b.object.morphTargetInfluences[b.index]=0;
    const writePose=(name,weight=1)=>{
      for(const binding of this.poseWrites.get(name))binding.object.morphTargetInfluences[binding.index]+=binding.weight*weight;
    };
    writePose('eye/Open');
    const weights={};
    for(const side of ['L','R']){
      const eye=controls.eyes[side],closed=1-Math.min(1,eye.open),brow=controls.brows[side];
      weights[`eye:${side}:Close`]=closed*(1-eye.smile);
      weights[`eye:${side}:CloseSmile`]=closed*eye.smile;
      weights[`eye:${side}:WideOpen`]=Math.max(0,eye.open-1)*2;
      weights[`eye:${side}:lid`]=eye.lid*this.eyeDistance;
      weights[`brow:${side}:x`]=brow.x*this.eyeDistance;
      weights[`brow:${side}:y`]=brow.y*this.eyeDistance;
      weights[`brow:${side}:sin`]=Math.sin(brow.angle);
      weights[`brow:${side}:cos`]=Math.cos(brow.angle)-1;
      weights[`brow:${side}:curve`]=Math.max(0,brow.curve);
      weights[`brow:${side}:negative`]=Math.max(0,-brow.curve/.09);
      const lineName=side==='L'?'LeftEyeWhiteLine':'RightEyeWhiteLine';
      for(const [shape,amount] of [['Close',closed*(1-eye.smile)],['CloseSmile',closed*eye.smile]]){
        const targets=this.poses.get(`eye/${shape}`)[lineName];
        const object=this.resolve(lineName);
        for(const [name,value] of Object.entries(targets))object.morphTargetInfluences[object.morphTargetDictionary[name]]+=amount*value;
      }
    }
    this.eyeWork.write(weights);
    for(const side of ['L','R'])weights[`brow:${side}:depth`]=this.browDepth(side);
    this.eyeWork.write(weights);
    writePose('mouth/Smile',1-controls.mouth.open);writePose('mouth/A',controls.mouth.open);
    const mouth=controls.mouth,open=mouth.open,scale=mouth.scale;
    const width=1+mouth.form*(.25+.40*open),openingHeight=1+.45*Math.min(0,mouth.form);
    // The separate face surface surrounds Mouth. Expanding beyond native A
    // buries corners in it even before Mouth triangles reverse. Keep A as the
    // widest aperture; negative forms still narrow it. Clamp the combined
    // width/scale rather than allowing size to reintroduce that expansion.
    const widthScale=Math.max(.6,Math.min(1,width*scale)),verticalScale=Math.min(1,scale);
    // Source .5 is smiling, around zero is neutral and negative forms frown.
    // The native Sad delta carries both the lip line and textured lower lip;
    // bending only the line can leave the visible mouth looking like a smile.
    const f=mouth.form;
    const negative=Math.min(1,Math.max(0,.5-f)),closedCurve=-.02-.12*Math.min(.5,Math.max(0,f));
    const curve=(closedCurve-this.closedMouthCurvature)*(1-open)*(1-negative)+(f<0?-.045*f:-.025*f)*open;
    // Sad already narrows and reshapes the lip. Fade the extra geometric warp
    // out as that native shape takes over instead of compressing it twice.
    const negativeWeight=negative*(1-open),warp=1-negativeWeight;
    this.mouthWork.write({'mouth:baseX':(widthScale-1)*warp,'mouth:openX':open*(widthScale-1)*warp,
      'mouth:baseY':(verticalScale-1)*warp,'mouth:openY':open*(verticalScale*openingHeight-1)*warp,'mouth:moveY':mouth.y*this.eyeDistance*warp,
      'mouth:curve0':curve*verticalScale*warp,'mouth:curve1':curve*verticalScale*open*warp,'mouth:curve2':curve*verticalScale*open*open*warp,
      'mouth:negative':negativeWeight});
    for(const binding of this.bindings){
      const side=binding.node.startsWith('Right')?'R':'L',eye=controls.eyes[side];
      if(binding.property==='visible'){
        // External closure has no native recipe timing. WhiteLine is a closed
        // eyelash decoration; a mixed arc must not disappear at smile=.5.
        binding.object.visible=/EyeWhiteLine$/.test(binding.node)&&eye.open<=1e-5;
        continue;
      }
      const closed=1-Math.min(1,eye.open),wide=Math.max(0,eye.open-1)*2;
      const value=evaluateBinding(binding,{'eye/Open':Math.max(0,1-closed-wide),
        'eye/Close':closed*(1-eye.smile),'eye/CloseSmile':closed*eye.smile,'eye/WideOpen':wide});
      binding.object[binding.property].fromArray(value);
    }
    this.root.updateMatrixWorld(true);
    for(const [side,bone] of Object.entries(this.eyeBones)){
      // Reuse the face-local basis measured at binding.
      this.eyeSpace.copy(this.gazeBasis[side]);
      this.origin.set(0,0,0).applyMatrix4(this.eyeSpace);
      this.localShift.set(controls.gaze.x*this.eyeDistance,controls.gaze.y*this.eyeDistance,0).applyMatrix4(this.eyeSpace).sub(this.origin);
      bone.position.add(this.localShift);
      this.localShift.copy(this.irisPivots[side]).multiply(bone.scale).applyQuaternion(bone.quaternion).multiplyScalar(1-controls.gaze.scale);
      bone.position.add(this.localShift);bone.scale.multiplyScalar(controls.gaze.scale);
    }
    this.root.updateMatrixWorld(true);
    let cheekSupported=false;
    for(const runtime of this.cheekRuntimes){
      const result=runtime.setExternalCheek({intensity:controls.cheek,layer:0});
      cheekSupported ||= result.supported;
    }
    if(controls.cheek>0&&!cheekSupported)controls.limitations.push('当前模型或渲染模式未提供可用脸红纹理');
    return controls;
  }

  dispose(){this.beginFrame();for(const runtime of this.cheekRuntimes)runtime.setExternalCheek(null);
    this.cheekRuntimes=[];for(const work of this.workspaces)work.dispose();this.workspaces=[];}
}

// Published package entry: the adapter only receives component metadata and
// the shared context contract, never the host's expression-controller internals.
export function createExpressionAdapter(context) {
  if(!context.parts.some(part=>part.component.behaviors?.some(b=>b.name==='LLAS.Face')))return null;
  const driver=new LlasLive2dFace(context);
  return {
    restore(){driver.beginFrame();},
    apply(parameters){driver.setParameters(parameters);return driver.update();},
    dispose(){driver.dispose();},
  };
}
