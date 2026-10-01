// Authored cross-medium rig controls, measured from this BanG Dream series.
// No Live2D deformer, expression queue, or MTN sampling implementation here.
const clamp=(v,min,max)=>Math.min(max,Math.max(min,v));
const supported = new Set(['PARAM_EYE_L_OPEN','PARAM_EYE_R_OPEN','PARAM_EYE_L_SMILE','PARAM_EYE_R_SMILE','PARAM_EYELID_L','PARAM_EYELID_R',
  'PARAM_EYE_BALL_X','PARAM_EYE_BALL_Y','PARAM_EYE_SCALE','PARAM_MOUTH_OPEN_Y','PARAM_MOUTH_FORM_01',
  'PARAM_MOUTH_FORM_Y','PARAM_MOUTH_SCALE','PARAM_CHEEK','PARAM_CHEEK2',...['L','R'].flatMap(side=>['X','Y','ANGLE','FORM'].map(kind=>`PARAM_BROW_${side}_${kind}`))]);

export function llasFaceControls(parameters, defaults = {}) {
  const value=(id,fallback=0)=>{
    const v=parameters[id]??defaults[id]??fallback;
    if(!Number.isFinite(v))throw new Error(`Non-finite face parameter: ${id}`);
    return v;
  };
  const eyes={},brows={};
  for(const [side,sign] of [['L',1],['R',-1]]){
    eyes[side]={open:clamp(value(`PARAM_EYE_${side}_OPEN`,1),0,1.5),smile:clamp(value(`PARAM_EYE_${side}_SMILE`),0,1),
      lid:.07*clamp(value(`PARAM_EYELID_${side}`),-1,1)};
    brows[side]={x:sign*.21*clamp(value(`PARAM_BROW_${side}_X`),-1,1),
      y:.145*clamp(value(`PARAM_BROW_${side}_Y`),-1,1),
      angle:-sign*.46*clamp(value(`PARAM_BROW_${side}_ANGLE`),-1,1),
      curve:.09*clamp(value(`PARAM_BROW_${side}_FORM`),-1,1)};
  }
  return {eyes,brows,
    // Both source overlays express blushing. Use the LLAS cheek-spot artwork
    // as one shared approximation, so overlapping/crossfading source styles
    // never cause an abrupt texture-layer switch.
    cheek:Math.max(clamp(value('PARAM_CHEEK'),0,1),clamp(value('PARAM_CHEEK2'),0,1)),
    gaze:{x:.038*clamp(value('PARAM_EYE_BALL_X'),-1,1),y:.038*clamp(value('PARAM_EYE_BALL_Y'),-1,1),
      scale:1+.075*clamp(value('PARAM_EYE_SCALE'),-1,1)},
    mouth:{open:clamp(value('PARAM_MOUTH_OPEN_Y'),0,1),form:clamp(value('PARAM_MOUTH_FORM_01'),-1,1),
      y:.01*clamp(value('PARAM_MOUTH_FORM_Y'),-1,1),scale:1+.115*clamp(value('PARAM_MOUTH_SCALE'),-1,1)},
    unsupported:Object.entries(parameters).filter(([id,v])=>/^PARAM_(EYE|EYELID|BROW|MOUTH|CHEEK|TEAR)/.test(id)
      &&!supported.has(id)&&Math.abs(v-(defaults[id]??0))>1e-6).map(([id])=>id),
    limitations:['脸红合并为 LLAS 双颊图案；额外眼型、独立高光与眼泪尚未映射；超出共享标定范围的控制量暂饱和']};
}
