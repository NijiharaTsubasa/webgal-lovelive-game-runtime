// Pure CPU test reference extracted from the diagnostic tool; arithmetic preserved.
const dot=(a,b)=>a.reduce((sum,v,i)=>sum+v*b[i],0);
const scale=(a,s)=>a.map(v=>v*s);
const add=(a,b)=>a.map((v,i)=>v+b[i]);
const mul=(m,v)=>[0,1,2,3].map(r=>v.reduce((sum,x,c)=>sum+m[c*4+r]*x,0));
const colsMul=(m,v)=>[0,1,2,3].map(r=>v.reduce((sum,x,c)=>sum+(m[c]?.[r]??0)*x,0));
const normalize=v=>scale(v,1/Math.sqrt(Math.max(dot(v,v),1.17549435e-38)));
export function compareVector(actual,expected,absolute=2e-5,relative=2e-5){const errors=actual.map((v,i)=>Math.abs(v-expected[i]));return {passed:actual.length===expected.length&&actual.every(Number.isFinite)&&expected.every(Number.isFinite)&&errors.every((e,i)=>e<=absolute+relative*Math.max(Math.abs(actual[i]),Math.abs(expected[i]))),maxAbsError:Math.max(...errors),absoluteTolerance:absolute,relativeTolerance:relative};}
function morphed(sample,input,kind){const entries=sample[kind==='position'?'morphPosition':'morphNormal'];if(!input[kind==='position'?'morphPositionEnabled':'morphNormalEnabled'])return [...sample[kind]];let value=scale(sample[kind],input.morphTargetsRelative?1:1-input.influences.reduce((s,v)=>s+v,0));for(const entry of entries)if(entry.value)value=add(value,scale(entry.value,entry.weight));return value;}
export function expectedSourceInput(sample,input,uniforms){
 const skin=(value,w)=>{const bind=mul(uniforms.bindMatrix??input.bindMatrix,[...value,w]);let blended=[0,0,0,0];sample.joints.forEach((joint,i)=>{blended=add(blended,scale(mul(input.bones[joint],bind),sample.weights[i]));});return mul(uniforms.bindMatrixInverse??input.bindMatrixInverse,blended).slice(0,3);};
 const postPosition=skin(morphed(sample,input,'position'),1),postNormal=skin(morphed(sample,input,'normal'),0);
 return {position:mul(uniforms.uMeteorMeshToSource,[...postPosition,1]),normal:mul(uniforms.uMeteorMeshToSource,[...postNormal,0]),postPosition,postNormal};
}
// Literal scalar/vector operations of retained VS7daed, normal target floating
// arithmetic. This is not an IEEE emulator and does not resimulate other programs.
export function bodyOutlineReference(position,normal,maskAlpha,u){
 const U=u.u_UnityPerDraw_hlslcc_mtx4x4unity_ObjectToWorld,W=u.u_UnityPerDraw_hlslcc_mtx4x4unity_WorldToObject,V=u.u_VGlobals_hlslcc_mtx4x4unity_MatrixV,VP=u.u_VGlobals_hlslcc_mtx4x4unity_MatrixVP,P=u.u_VGlobals_hlslcc_mtx4x4glstate_matrix_projection,CP=u.u_VGlobals_hlslcc_mtx4x4unity_CameraProjection;
 const reciprocal=1/CP[1][1],ratio=Math.min(Math.abs(reciprocal),1)/Math.max(Math.abs(reciprocal),1),square=ratio*ratio;
 let poly=square*.0208350997-.0851330012;poly=square*poly+.180141002;poly=square*poly-.330299497;poly=square*poly+.999866009;
 const small=ratio*poly,angle=(Math.min(reciprocal,1)<-Math.min(reciprocal,1)?-1:1)*(small+(Math.abs(reciprocal)>1?small*-2+1.57079637:0));
 const world=colsMul(U,position),view=colsMul(V,[...world.slice(0,3),1]),ortho=u.u_VGlobals_unity_OrthoParams;
 const factor=ortho[3]===0?angle*Math.min(Math.abs(view[2]),1)*114.59494:Math.min(Math.abs(ortho[1]),1)*50;
 const width=factor*1.49999996e-5*u.u_OutlineWidth;
 const worldNormal=normalize([0,1,2].map(c=>dot(normal.slice(0,3),W[c].slice(0,3))));
 const expanded=add(world.slice(0,3),scale(worldNormal,width)),clip=colsMul(VP,[...expanded,1]);
 const bias=maskAlpha*u.u_OutlineZOffset*.100000001+9.99999975e-5,shiftedViewZ=-bias-clip[3];
 const sourceClip=[clip[0],clip[1],clip[3]*(shiftedViewZ*P[2][2]+P[3][2])/(-shiftedViewZ),clip[3]];
 return {sourceClip,glClip:[sourceClip[0],sourceClip[1],sourceClip[3]-2*sourceClip[2],sourceClip[3]],worldNormal,worldPosition:world.slice(0,3),expandedWorldPosition:expanded,width,bias,shiftedViewZ};
}
