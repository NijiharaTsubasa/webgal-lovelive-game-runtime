import {YohaneFaceRig} from './yohane-face-rig.js';

const clamp = (value, lo, hi) => Math.max(lo, Math.min(hi, value));
export function yohaneFaceControls(parameters) {
  const value = (name, fallback = 0, lo = -1, hi = 1) => {
    const number = parameters[name] ?? fallback;
    if (!Number.isFinite(number)) throw Error(`Non-finite face parameter: ${name}`);
    return clamp(number,lo,hi);
  };
  return {
    eyes: Object.fromEntries(['L','R'].map(side => [side,{
      open:value(`PARAM_EYE_${side}_OPEN`,1,0,1.5),smile:value(`PARAM_EYE_${side}_SMILE`,0,0,1),
    }])),
    brows: Object.fromEntries(['L','R'].map(side => [side,{
      x:value(`PARAM_BROW_${side}_X`),y:value(`PARAM_BROW_${side}_Y`),
      angle:value(`PARAM_BROW_${side}_ANGLE`),form:value(`PARAM_BROW_${side}_FORM`),
    }])),
    mouth:{open:value('PARAM_MOUTH_OPEN_Y',0,0,1),form:value('PARAM_MOUTH_FORM_01'),
      scale:value('PARAM_MOUTH_SCALE'),y:value('PARAM_MOUTH_FORM_Y')},
    gaze:{x:value('PARAM_EYE_BALL_X'),y:value('PARAM_EYE_BALL_Y'),scale:value('PARAM_EYE_SCALE')},
    highlight:value('PARAM_EYE_HIGHLIGHT',0,0,1),
  };
}

export function createExpressionAdapter(context) {
  const part=context.parts.find(part=>part.component.motionGroup==='yohane');
  if(!part)return null;
  const heads=[], eyes=[];
  part.root.traverse(object=>{
    if(!object.isMesh || object.userData?.__parameterizedPassObject || !object.morphTargetDictionary)return;
    const dictionary=object.morphTargetDictionary;
    if(['normal','eye_close','mouth_open'].every(name=>dictionary[name]!==undefined))heads.push(object);
    else if (/(?:^|_)eye_[lr]$/i.test(object.name))eyes.push(object);
  });
  if(!heads.length)return null;
  const works=[];
  try {
    for(const [meshes,kind] of [[heads,'head'],[eyes,'eye']]) {
      const groups=new Map();
      for(const mesh of meshes) {
        const key=mesh.geometry.attributes.position;
        const group=groups.get(key)??[];group.push(mesh);groups.set(key,group);
      }
      for(const group of groups.values())works.push(new YohaneFaceRig(group,context.THREE,kind));
    }
  } catch(error) {for(const work of works)work.dispose();throw error;}
  const eyeDistance=Math.max(...works.filter(work=>work.kind==='head').map(work=>work.eyeDistance));
  let underlay=null, signature;
  const restore=()=>{
    if(!underlay)return;
    for(const {object,index,value} of underlay)object.morphTargetInfluences[index]=value;
    for(const work of works)work.restore();underlay=null;
  };
  return {
    restore,
    apply(parameters) {
      restore();
      const controls=yohaneFaceControls(parameters), next=JSON.stringify(controls), changed=next!==signature;
      underlay=[];
      for(const work of works) {
        for(const {object} of work.objects)for(const index of work.owned) {
          underlay.push({object,index,value:object.morphTargetInfluences[index]});
          object.morphTargetInfluences[index]=0;
        }
        if(changed) {
          if(work.kind==='head')work.head(controls);else work.eye(controls,eyeDistance);
        }
        work.activate(changed);
      }
      signature=next;
    },
    dispose() {restore();for(const work of works)work.dispose();},
  };
}
