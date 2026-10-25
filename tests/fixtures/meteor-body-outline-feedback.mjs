// Test-only instrumentation of one actual body Outline program. No production imports or math replacement.
export const feedbackFields=['mDiagPosition','mDiagNormal','mDiagSourceClip','mDiagGLClip','mDiagMeta'];
const marker='METEOR_BODY_OUTLINE_FEEDBACK_DIAGNOSTIC';
export function instrumentBodyVertex(source){
 const end=source.lastIndexOf('}');if(end<0||source.slice(end+1).trim())throw new Error('Unexpected standard vertex shader ending');
 const declarations=`// ${marker}\n`+feedbackFields.map(name=>`out highp vec4 ${name};`).join('\n')+'\n';
 const assignments=`
 mDiagPosition=vec4(meteor_sourceInput.POSITION0.xyz,1.0);
 mDiagNormal=vec4(meteor_sourceInput.NORMAL0.xyz,0.0);
 mDiagSourceClip=meteor_sourceOutput.mtl_Position;
 mDiagGLClip=gl_Position;
 mDiagMeta=vec4(float(gl_VertexID),float(meteor_half(textureLod(u_OutlineZOffsetMask_with_sampler_OutlineZOffsetMask,meteor_materialUv(meteor_sourceInput.TEXCOORD0.xy),0.0)).w),meteor_sourceInput.TEXCOORD0.xy);
`;
 return declarations+source.slice(0,end)+assignments+source.slice(end);
}
