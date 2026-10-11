// @section ForwardFront_BASE_vertexPrelude
uniform vec4 uYohanehlslcc_mtx4x4unity_MatrixVP[4];
uniform vec4 uYohanehlslcc_mtx4x4unity_ObjectToWorld[4];
uniform vec4 uYohanehlslcc_mtx4x4unity_WorldToObject[4];
uniform vec4 uYohaneunity_LODFade;
uniform mediump vec4 uYohaneunity_WorldTransformParams;
uniform vec4 uYohaneunity_RenderingLayer;
uniform mediump vec4 uYohaneunity_LightData;
uniform mediump vec4 uYohaneunity_LightIndices[2];
uniform vec4 uYohaneunity_ProbesOcclusion;
uniform mediump vec4 uYohaneunity_SpecCube0_HDR;
uniform mediump vec4 uYohaneunity_SpecCube1_HDR;
uniform vec4 uYohaneunity_SpecCube0_BoxMax;
uniform vec4 uYohaneunity_SpecCube0_BoxMin;
uniform vec4 uYohaneunity_SpecCube0_ProbePosition;
uniform vec4 uYohaneunity_SpecCube1_BoxMax;
uniform vec4 uYohaneunity_SpecCube1_BoxMin;
uniform vec4 uYohaneunity_SpecCube1_ProbePosition;
uniform vec4 uYohaneunity_LightmapST;
uniform vec4 uYohaneunity_DynamicLightmapST;
uniform mediump vec4 uYohaneunity_SHAr;
uniform mediump vec4 uYohaneunity_SHAg;
uniform mediump vec4 uYohaneunity_SHAb;
uniform mediump vec4 uYohaneunity_SHBr;
uniform mediump vec4 uYohaneunity_SHBg;
uniform mediump vec4 uYohaneunity_SHBb;
uniform mediump vec4 uYohaneunity_SHC;
uniform vec4 uYohanehlslcc_mtx4x4unity_MatrixPreviousM[4];
uniform vec4 uYohanehlslcc_mtx4x4unity_MatrixPreviousMI[4];
uniform vec4 uYohaneunity_MotionVectorsParams;
uniform vec4 uBaseMap_TexelSize;
uniform vec4 uBaseMap_MipInfo;
uniform vec4 uBaseMap_ST;
uniform mediump vec4 uBaseColor;
uniform mediump vec4 uSpecColor;
uniform mediump vec4 uEmissionColor;
uniform mediump float uCutoff;
uniform mediump float uSurface;
uniform mediump float uSmoothness;
uniform mediump float uSpecularHighlights;
uniform float uAlphaClip;
uniform vec4 uSpecGlossMap_ST;
uniform float uSmoothnessSource;
uniform float uBumpScale;
uniform mediump vec4 uRimLightColor;
uniform mediump float uShadowThreshold;
uniform mediump float uRimShadow;
uniform mediump float uRimPower;
uniform vec4 uBaseMap2_TexelSize;
uniform vec4 uBaseMap2_MipInfo;
uniform vec4 uBaseMap2_ST;
uniform mediump vec4 uBaseColor2;
uniform mediump vec4 uSpecColor2;
uniform mediump vec4 uEmissionColor2;
uniform mediump float uSmoothness2;
uniform mediump float uSpecularHighlights2;
uniform vec4 uSpecGlossMap2_ST;
uniform float uSmoothnessSource2;
uniform float uBumpScale2;
uniform mediump vec4 uRimLightColor2;
uniform mediump float uShadowThreshold2;
uniform mediump float uRimPower2;
uniform mediump float uRimShadow2;
uniform mediump float uMaskThreshold;
uniform mediump vec4 uMaskHeightRange;
uniform mediump vec4 uBackFaceColor;
uniform uint uskinned_tex_height;
uniform uint uskinned_tex_width;
highp vec3 yohaneVertex_in_POSITION0;
highp vec3 yohaneVertex_in_NORMAL0;
highp vec2 yohaneVertex_in_TEXCOORD0;
varying highp vec2 yohaneVarying_vs_TEXCOORD0;
varying highp vec3 yohaneVarying_vs_TEXCOORD1;
varying mediump vec3 yohaneVarying_vs_TEXCOORD2;
vec3 yohaneVertex_u_xlat0;
vec4 yohaneVertex_u_xlat1;
float yohaneVertex_u_xlat6;
void yohaneVertexMain()
{
    yohaneVertex_u_xlat0.xyz = yohaneVertex_in_POSITION0.yyy * uYohanehlslcc_mtx4x4unity_ObjectToWorld[1].xyz;
    yohaneVertex_u_xlat0.xyz = uYohanehlslcc_mtx4x4unity_ObjectToWorld[0].xyz * yohaneVertex_in_POSITION0.xxx + yohaneVertex_u_xlat0.xyz;
    yohaneVertex_u_xlat0.xyz = uYohanehlslcc_mtx4x4unity_ObjectToWorld[2].xyz * yohaneVertex_in_POSITION0.zzz + yohaneVertex_u_xlat0.xyz;
    yohaneVertex_u_xlat0.xyz = yohaneVertex_u_xlat0.xyz + uYohanehlslcc_mtx4x4unity_ObjectToWorld[3].xyz;
    yohaneVertex_u_xlat1 = yohaneVertex_u_xlat0.yyyy * uYohanehlslcc_mtx4x4unity_MatrixVP[1];
    yohaneVertex_u_xlat1 = uYohanehlslcc_mtx4x4unity_MatrixVP[0] * yohaneVertex_u_xlat0.xxxx + yohaneVertex_u_xlat1;
    yohaneVertex_u_xlat1 = uYohanehlslcc_mtx4x4unity_MatrixVP[2] * yohaneVertex_u_xlat0.zzzz + yohaneVertex_u_xlat1;
    yohaneVarying_vs_TEXCOORD1.xyz = yohaneVertex_u_xlat0.xyz;
    gl_Position = yohaneVertex_u_xlat1 + uYohanehlslcc_mtx4x4unity_MatrixVP[3];
    yohaneVarying_vs_TEXCOORD0.xy = yohaneVertex_in_TEXCOORD0.xy * uBaseMap_ST.xy + uBaseMap_ST.zw;
    yohaneVertex_u_xlat0.x = dot(yohaneVertex_in_NORMAL0.xyz, uYohanehlslcc_mtx4x4unity_WorldToObject[0].xyz);
    yohaneVertex_u_xlat0.y = dot(yohaneVertex_in_NORMAL0.xyz, uYohanehlslcc_mtx4x4unity_WorldToObject[1].xyz);
    yohaneVertex_u_xlat0.z = dot(yohaneVertex_in_NORMAL0.xyz, uYohanehlslcc_mtx4x4unity_WorldToObject[2].xyz);
    yohaneVertex_u_xlat6 = dot(yohaneVertex_u_xlat0.xyz, yohaneVertex_u_xlat0.xyz);
    yohaneVertex_u_xlat6 = max(yohaneVertex_u_xlat6, 1.17549435e-38);
    yohaneVertex_u_xlat6 = inversesqrt(yohaneVertex_u_xlat6);
    yohaneVertex_u_xlat0.xyz = vec3(yohaneVertex_u_xlat6) * yohaneVertex_u_xlat0.xyz;
    yohaneVertex_u_xlat6 = dot(yohaneVertex_u_xlat0.xyz, yohaneVertex_u_xlat0.xyz);
    yohaneVertex_u_xlat6 = inversesqrt(yohaneVertex_u_xlat6);
    yohaneVertex_u_xlat0.xyz = vec3(yohaneVertex_u_xlat6) * yohaneVertex_u_xlat0.xyz;
    yohaneVarying_vs_TEXCOORD2.xyz = yohaneVertex_u_xlat0.xyz;
    return;
}

// @end

// @section ForwardFront_BASE_vertexProject
yohaneVertex_in_POSITION0 = vec3(-transformed.x, transformed.yz);
yohaneVertex_in_NORMAL0 = vec3(-objectNormal.x, objectNormal.yz);
yohaneVertex_in_TEXCOORD0 = vec2(uv.x, 1.0 - uv.y);
yohaneVertexMain();
// @end

// @section ForwardFront_BASE_fragmentPrelude
uniform vec4 uYohaneMainLightPosition;
uniform mediump vec4 uYohaneMainLightColor;
uniform vec3 uYohaneWorldSpaceCameraPos;
uniform vec2 uYohaneGlobalMipBias;
uniform vec4 uYohaneunity_OrthoParams;
uniform vec4 uYohanehlslcc_mtx4x4unity_MatrixV[4];
uniform vec4 uYohanehlslcc_mtx4x4unity_ObjectToWorld[4];
uniform vec4 uYohanehlslcc_mtx4x4unity_WorldToObject[4];
uniform vec4 uYohaneunity_LODFade;
uniform mediump vec4 uYohaneunity_WorldTransformParams;
uniform vec4 uYohaneunity_RenderingLayer;
uniform mediump vec4 uYohaneunity_LightData;
uniform mediump vec4 uYohaneunity_LightIndices[2];
uniform vec4 uYohaneunity_ProbesOcclusion;
uniform mediump vec4 uYohaneunity_SpecCube0_HDR;
uniform mediump vec4 uYohaneunity_SpecCube1_HDR;
uniform vec4 uYohaneunity_SpecCube0_BoxMax;
uniform vec4 uYohaneunity_SpecCube0_BoxMin;
uniform vec4 uYohaneunity_SpecCube0_ProbePosition;
uniform vec4 uYohaneunity_SpecCube1_BoxMax;
uniform vec4 uYohaneunity_SpecCube1_BoxMin;
uniform vec4 uYohaneunity_SpecCube1_ProbePosition;
uniform vec4 uYohaneunity_LightmapST;
uniform vec4 uYohaneunity_DynamicLightmapST;
uniform mediump vec4 uYohaneunity_SHAr;
uniform mediump vec4 uYohaneunity_SHAg;
uniform mediump vec4 uYohaneunity_SHAb;
uniform mediump vec4 uYohaneunity_SHBr;
uniform mediump vec4 uYohaneunity_SHBg;
uniform mediump vec4 uYohaneunity_SHBb;
uniform mediump vec4 uYohaneunity_SHC;
uniform vec4 uYohanehlslcc_mtx4x4unity_MatrixPreviousM[4];
uniform vec4 uYohanehlslcc_mtx4x4unity_MatrixPreviousMI[4];
uniform vec4 uYohaneunity_MotionVectorsParams;
uniform vec4 uBaseMap_TexelSize;
uniform vec4 uBaseMap_MipInfo;
uniform vec4 uBaseMap_ST;
uniform mediump vec4 uBaseColor;
uniform mediump vec4 uSpecColor;
uniform mediump vec4 uEmissionColor;
uniform mediump float uCutoff;
uniform mediump float uSurface;
uniform mediump float uSmoothness;
uniform mediump float uSpecularHighlights;
uniform float uAlphaClip;
uniform vec4 uSpecGlossMap_ST;
uniform float uSmoothnessSource;
uniform float uBumpScale;
uniform mediump vec4 uRimLightColor;
uniform mediump float uShadowThreshold;
uniform mediump float uRimShadow;
uniform mediump float uRimPower;
uniform vec4 uBaseMap2_TexelSize;
uniform vec4 uBaseMap2_MipInfo;
uniform vec4 uBaseMap2_ST;
uniform mediump vec4 uBaseColor2;
uniform mediump vec4 uSpecColor2;
uniform mediump vec4 uEmissionColor2;
uniform mediump float uSmoothness2;
uniform mediump float uSpecularHighlights2;
uniform vec4 uSpecGlossMap2_ST;
uniform float uSmoothnessSource2;
uniform float uBumpScale2;
uniform mediump vec4 uRimLightColor2;
uniform mediump float uShadowThreshold2;
uniform mediump float uRimPower2;
uniform mediump float uRimShadow2;
uniform mediump float uMaskThreshold;
uniform mediump vec4 uMaskHeightRange;
uniform mediump vec4 uBackFaceColor;
uniform uint uskinned_tex_height;
uniform uint uskinned_tex_width;
uniform mediump sampler2D uBaseMap;
uniform mediump sampler2D uSpecGlossMap;
uniform mediump sampler2D uShadowColorMap;
varying highp vec2 yohaneVarying_vs_TEXCOORD0;
varying highp vec3 yohaneVarying_vs_TEXCOORD1;
varying mediump vec3 yohaneVarying_vs_TEXCOORD2;
mediump vec4 yohaneFragment_SV_Target0;
vec3 yohaneFragment_u_xlat0;
mediump vec4 yohaneFragment_u_xlat16_0;
bool yohaneFragment_u_xlatb0;
vec4 yohaneFragment_u_xlat1;
mediump vec3 yohaneFragment_u_xlat16_2;
vec3 yohaneFragment_u_xlat3;
mediump vec3 yohaneFragment_u_xlat16_4;
mediump vec3 yohaneFragment_u_xlat16_5;
mediump vec3 yohaneFragment_u_xlat16_6;
float yohaneFragment_u_xlat21;
bool yohaneFragment_u_xlatb21;
float yohaneFragment_u_xlat23;
mediump float yohaneFragment_u_xlat16_25;
mediump float yohaneFragment_u_xlat16_26;
vec4 yohaneSampleTexture(sampler2D image, vec2 coord) { return texture(image, vec2(coord.x, 1.0 - coord.y)); }
vec4 yohaneSampleTexture(sampler2D image, vec2 coord, float bias) { return texture(image, vec2(coord.x, 1.0 - coord.y), bias); }

void yohaneFragmentMain()
{
    yohaneFragment_u_xlat16_0 = yohaneSampleTexture(uBaseMap, yohaneVarying_vs_TEXCOORD0.xy, uYohaneGlobalMipBias.x);
    yohaneFragment_u_xlat1 = yohaneFragment_u_xlat16_0 * uBaseColor;
    yohaneFragment_u_xlat16_2.xyz = yohaneSampleTexture(uShadowColorMap, yohaneVarying_vs_TEXCOORD0.xy, uYohaneGlobalMipBias.x).xyz;
    yohaneFragment_u_xlatb21 = uYohaneunity_OrthoParams.w==0.0;
    yohaneFragment_u_xlat3.xyz = (-yohaneVarying_vs_TEXCOORD1.xyz) + uYohaneWorldSpaceCameraPos.xyz;
    yohaneFragment_u_xlat23 = dot(yohaneFragment_u_xlat3.xyz, yohaneFragment_u_xlat3.xyz);
    yohaneFragment_u_xlat23 = inversesqrt(yohaneFragment_u_xlat23);
    yohaneFragment_u_xlat3.xyz = vec3(yohaneFragment_u_xlat23) * yohaneFragment_u_xlat3.xyz;
    yohaneFragment_u_xlat16_4.x = (yohaneFragment_u_xlatb21) ? yohaneFragment_u_xlat3.x : uYohanehlslcc_mtx4x4unity_MatrixV[0].z;
    yohaneFragment_u_xlat16_4.y = (yohaneFragment_u_xlatb21) ? yohaneFragment_u_xlat3.y : uYohanehlslcc_mtx4x4unity_MatrixV[1].z;
    yohaneFragment_u_xlat16_4.z = (yohaneFragment_u_xlatb21) ? yohaneFragment_u_xlat3.z : uYohanehlslcc_mtx4x4unity_MatrixV[2].z;
    yohaneFragment_u_xlat16_25 = dot(yohaneVarying_vs_TEXCOORD2.xyz, yohaneVarying_vs_TEXCOORD2.xyz);
    yohaneFragment_u_xlat16_25 = inversesqrt(yohaneFragment_u_xlat16_25);
    yohaneFragment_u_xlat16_5.xyz = vec3(yohaneFragment_u_xlat16_25) * yohaneVarying_vs_TEXCOORD2.xyz;
    yohaneFragment_u_xlat16_25 = dot(yohaneFragment_u_xlat16_5.xyz, uYohaneMainLightPosition.xyz);
    yohaneFragment_u_xlat16_25 = yohaneFragment_u_xlat16_25 + 1.0;
    yohaneFragment_u_xlat16_25 = yohaneFragment_u_xlat16_25 * 0.5;
    yohaneFragment_u_xlat21 = min(uYohaneunity_LightData.z, 1.0);
    yohaneFragment_u_xlat21 = yohaneFragment_u_xlat21 * yohaneFragment_u_xlat16_25;
    yohaneFragment_u_xlat16_6.xyz = (-yohaneFragment_u_xlat16_4.xyz) + (-uYohaneMainLightPosition.xyz);
    yohaneFragment_u_xlat16_6.xyz = vec3(vec3(uRimShadow, uRimShadow, uRimShadow)) * yohaneFragment_u_xlat16_6.xyz + uYohaneMainLightPosition.xyz;
    yohaneFragment_u_xlat23 = dot(yohaneFragment_u_xlat16_5.xyz, yohaneFragment_u_xlat16_6.xyz);
    yohaneFragment_u_xlat23 = yohaneFragment_u_xlat23 + 1.0;
    yohaneFragment_u_xlat16_25 = yohaneFragment_u_xlat23 * 0.5 + (-yohaneFragment_u_xlat21);
    yohaneFragment_u_xlat16_25 = uRimShadow * yohaneFragment_u_xlat16_25 + yohaneFragment_u_xlat21;
    yohaneFragment_u_xlat16_26 = dFdx(yohaneFragment_u_xlat16_25);
    yohaneFragment_u_xlat16_6.x = dFdy(yohaneFragment_u_xlat16_25);
    yohaneFragment_u_xlat16_26 = abs(yohaneFragment_u_xlat16_26) + abs(yohaneFragment_u_xlat16_6.x);
    yohaneFragment_u_xlat16_25 = yohaneFragment_u_xlat16_25 + (-uShadowThreshold);
    yohaneFragment_u_xlat16_26 = float(1.0) / yohaneFragment_u_xlat16_26;
    yohaneFragment_u_xlat16_25 = yohaneFragment_u_xlat16_25 * yohaneFragment_u_xlat16_26;
    yohaneFragment_u_xlat16_25 = clamp(yohaneFragment_u_xlat16_25, 0.0, 1.0);
    yohaneFragment_u_xlat16_26 = yohaneFragment_u_xlat16_25 * -2.0 + 3.0;
    yohaneFragment_u_xlat16_25 = yohaneFragment_u_xlat16_25 * yohaneFragment_u_xlat16_25;
    yohaneFragment_u_xlat16_25 = (-yohaneFragment_u_xlat16_26) * yohaneFragment_u_xlat16_25 + 1.0;
    yohaneFragment_u_xlat16_6.xyz = (-yohaneFragment_u_xlat16_0.xyz) * uBaseColor.xyz + yohaneFragment_u_xlat16_2.xyz;
    yohaneFragment_u_xlat16_6.xyz = vec3(yohaneFragment_u_xlat16_25) * yohaneFragment_u_xlat16_6.xyz + yohaneFragment_u_xlat1.xyz;
    yohaneFragment_u_xlat16_6.xyz = yohaneFragment_u_xlat16_6.xyz * uYohaneMainLightColor.xyz;
    yohaneFragment_u_xlatb0 = uSpecularHighlights==0.0;
    if(yohaneFragment_u_xlatb0){
        yohaneFragment_u_xlat16_0.xyz = yohaneSampleTexture(uSpecGlossMap, yohaneVarying_vs_TEXCOORD0.xy, uYohaneGlobalMipBias.x).xyz;
        yohaneFragment_u_xlat16_25 = uSmoothness * 10.0 + 1.0;
        yohaneFragment_u_xlat16_25 = exp2(yohaneFragment_u_xlat16_25);
        yohaneFragment_u_xlat1.xyz = yohaneFragment_u_xlat16_4.xyz + uYohaneMainLightPosition.xyz;
        yohaneFragment_u_xlat21 = dot(yohaneFragment_u_xlat1.xyz, yohaneFragment_u_xlat1.xyz);
        yohaneFragment_u_xlat21 = max(yohaneFragment_u_xlat21, 1.17549435e-38);
        yohaneFragment_u_xlat21 = inversesqrt(yohaneFragment_u_xlat21);
        yohaneFragment_u_xlat1.xyz = vec3(yohaneFragment_u_xlat21) * yohaneFragment_u_xlat1.xyz;
        yohaneFragment_u_xlat21 = dot(yohaneFragment_u_xlat16_5.xyz, yohaneFragment_u_xlat1.xyz);
        yohaneFragment_u_xlat21 = clamp(yohaneFragment_u_xlat21, 0.0, 1.0);
        yohaneFragment_u_xlat16_4.x = log2(yohaneFragment_u_xlat21);
        yohaneFragment_u_xlat16_4.x = yohaneFragment_u_xlat16_4.x * yohaneFragment_u_xlat16_25;
        yohaneFragment_u_xlat16_4.x = exp2(yohaneFragment_u_xlat16_4.x);
        yohaneFragment_u_xlat16_4.xyz = yohaneFragment_u_xlat16_0.xyz * yohaneFragment_u_xlat16_4.xxx;
        yohaneFragment_u_xlat0.xyz = yohaneFragment_u_xlat16_4.xyz * uYohaneMainLightColor.xyz;
        yohaneFragment_u_xlat16_6.xyz = yohaneFragment_u_xlat0.xyz * uSpecColor.xyz + yohaneFragment_u_xlat16_6.xyz;
    }
    yohaneFragment_SV_Target0.xyz = yohaneFragment_u_xlat16_6.xyz;
    yohaneFragment_SV_Target0.w = yohaneFragment_u_xlat1.w;
    return;
}

// @end

// @section ForwardFront_BASE_fragmentBody
yohaneFragmentMain();
vec3 outgoingLight = yohaneFragment_SV_Target0.rgb;
diffuseColor.a = yohaneFragment_SV_Target0.a;
// @end

// @section ForwardFront_HAIRHIGHLIGHT_ON_vertexPrelude
uniform vec4 uYohanehlslcc_mtx4x4unity_MatrixVP[4];
uniform vec4 uYohanehlslcc_mtx4x4unity_ObjectToWorld[4];
uniform vec4 uYohanehlslcc_mtx4x4unity_WorldToObject[4];
uniform vec4 uYohaneunity_LODFade;
uniform mediump vec4 uYohaneunity_WorldTransformParams;
uniform vec4 uYohaneunity_RenderingLayer;
uniform mediump vec4 uYohaneunity_LightData;
uniform mediump vec4 uYohaneunity_LightIndices[2];
uniform vec4 uYohaneunity_ProbesOcclusion;
uniform mediump vec4 uYohaneunity_SpecCube0_HDR;
uniform mediump vec4 uYohaneunity_SpecCube1_HDR;
uniform vec4 uYohaneunity_SpecCube0_BoxMax;
uniform vec4 uYohaneunity_SpecCube0_BoxMin;
uniform vec4 uYohaneunity_SpecCube0_ProbePosition;
uniform vec4 uYohaneunity_SpecCube1_BoxMax;
uniform vec4 uYohaneunity_SpecCube1_BoxMin;
uniform vec4 uYohaneunity_SpecCube1_ProbePosition;
uniform vec4 uYohaneunity_LightmapST;
uniform vec4 uYohaneunity_DynamicLightmapST;
uniform mediump vec4 uYohaneunity_SHAr;
uniform mediump vec4 uYohaneunity_SHAg;
uniform mediump vec4 uYohaneunity_SHAb;
uniform mediump vec4 uYohaneunity_SHBr;
uniform mediump vec4 uYohaneunity_SHBg;
uniform mediump vec4 uYohaneunity_SHBb;
uniform mediump vec4 uYohaneunity_SHC;
uniform vec4 uYohanehlslcc_mtx4x4unity_MatrixPreviousM[4];
uniform vec4 uYohanehlslcc_mtx4x4unity_MatrixPreviousMI[4];
uniform vec4 uYohaneunity_MotionVectorsParams;
uniform vec4 uBaseMap_TexelSize;
uniform vec4 uBaseMap_MipInfo;
uniform vec4 uBaseMap_ST;
uniform mediump vec4 uBaseColor;
uniform mediump vec4 uSpecColor;
uniform mediump vec4 uEmissionColor;
uniform mediump float uCutoff;
uniform mediump float uSurface;
uniform mediump float uSmoothness;
uniform mediump float uSpecularHighlights;
uniform float uAlphaClip;
uniform vec4 uSpecGlossMap_ST;
uniform float uSmoothnessSource;
uniform float uBumpScale;
uniform mediump vec4 uRimLightColor;
uniform mediump float uShadowThreshold;
uniform mediump float uRimShadow;
uniform mediump float uRimPower;
uniform vec4 uBaseMap2_TexelSize;
uniform vec4 uBaseMap2_MipInfo;
uniform vec4 uBaseMap2_ST;
uniform mediump vec4 uBaseColor2;
uniform mediump vec4 uSpecColor2;
uniform mediump vec4 uEmissionColor2;
uniform mediump float uSmoothness2;
uniform mediump float uSpecularHighlights2;
uniform vec4 uSpecGlossMap2_ST;
uniform float uSmoothnessSource2;
uniform float uBumpScale2;
uniform mediump vec4 uRimLightColor2;
uniform mediump float uShadowThreshold2;
uniform mediump float uRimPower2;
uniform mediump float uRimShadow2;
uniform mediump float uMaskThreshold;
uniform mediump vec4 uMaskHeightRange;
uniform mediump vec4 uBackFaceColor;
uniform uint uskinned_tex_height;
uniform uint uskinned_tex_width;
highp vec3 yohaneVertex_in_POSITION0;
highp vec3 yohaneVertex_in_NORMAL0;
highp vec2 yohaneVertex_in_TEXCOORD0;
varying highp vec2 yohaneVarying_vs_TEXCOORD0;
varying highp vec3 yohaneVarying_vs_TEXCOORD1;
varying mediump vec3 yohaneVarying_vs_TEXCOORD2;
vec3 yohaneVertex_u_xlat0;
vec4 yohaneVertex_u_xlat1;
float yohaneVertex_u_xlat6;
void yohaneVertexMain()
{
    yohaneVertex_u_xlat0.xyz = yohaneVertex_in_POSITION0.yyy * uYohanehlslcc_mtx4x4unity_ObjectToWorld[1].xyz;
    yohaneVertex_u_xlat0.xyz = uYohanehlslcc_mtx4x4unity_ObjectToWorld[0].xyz * yohaneVertex_in_POSITION0.xxx + yohaneVertex_u_xlat0.xyz;
    yohaneVertex_u_xlat0.xyz = uYohanehlslcc_mtx4x4unity_ObjectToWorld[2].xyz * yohaneVertex_in_POSITION0.zzz + yohaneVertex_u_xlat0.xyz;
    yohaneVertex_u_xlat0.xyz = yohaneVertex_u_xlat0.xyz + uYohanehlslcc_mtx4x4unity_ObjectToWorld[3].xyz;
    yohaneVertex_u_xlat1 = yohaneVertex_u_xlat0.yyyy * uYohanehlslcc_mtx4x4unity_MatrixVP[1];
    yohaneVertex_u_xlat1 = uYohanehlslcc_mtx4x4unity_MatrixVP[0] * yohaneVertex_u_xlat0.xxxx + yohaneVertex_u_xlat1;
    yohaneVertex_u_xlat1 = uYohanehlslcc_mtx4x4unity_MatrixVP[2] * yohaneVertex_u_xlat0.zzzz + yohaneVertex_u_xlat1;
    yohaneVarying_vs_TEXCOORD1.xyz = yohaneVertex_u_xlat0.xyz;
    gl_Position = yohaneVertex_u_xlat1 + uYohanehlslcc_mtx4x4unity_MatrixVP[3];
    yohaneVarying_vs_TEXCOORD0.xy = yohaneVertex_in_TEXCOORD0.xy * uBaseMap_ST.xy + uBaseMap_ST.zw;
    yohaneVertex_u_xlat0.x = dot(yohaneVertex_in_NORMAL0.xyz, uYohanehlslcc_mtx4x4unity_WorldToObject[0].xyz);
    yohaneVertex_u_xlat0.y = dot(yohaneVertex_in_NORMAL0.xyz, uYohanehlslcc_mtx4x4unity_WorldToObject[1].xyz);
    yohaneVertex_u_xlat0.z = dot(yohaneVertex_in_NORMAL0.xyz, uYohanehlslcc_mtx4x4unity_WorldToObject[2].xyz);
    yohaneVertex_u_xlat6 = dot(yohaneVertex_u_xlat0.xyz, yohaneVertex_u_xlat0.xyz);
    yohaneVertex_u_xlat6 = max(yohaneVertex_u_xlat6, 1.17549435e-38);
    yohaneVertex_u_xlat6 = inversesqrt(yohaneVertex_u_xlat6);
    yohaneVertex_u_xlat0.xyz = vec3(yohaneVertex_u_xlat6) * yohaneVertex_u_xlat0.xyz;
    yohaneVertex_u_xlat6 = dot(yohaneVertex_u_xlat0.xyz, yohaneVertex_u_xlat0.xyz);
    yohaneVertex_u_xlat6 = inversesqrt(yohaneVertex_u_xlat6);
    yohaneVertex_u_xlat0.xyz = vec3(yohaneVertex_u_xlat6) * yohaneVertex_u_xlat0.xyz;
    yohaneVarying_vs_TEXCOORD2.xyz = yohaneVertex_u_xlat0.xyz;
    return;
}

// @end

// @section ForwardFront_HAIRHIGHLIGHT_ON_vertexProject
yohaneVertex_in_POSITION0 = vec3(-transformed.x, transformed.yz);
yohaneVertex_in_NORMAL0 = vec3(-objectNormal.x, objectNormal.yz);
yohaneVertex_in_TEXCOORD0 = vec2(uv.x, 1.0 - uv.y);
yohaneVertexMain();
// @end

// @section ForwardFront_HAIRHIGHLIGHT_ON_fragmentPrelude
uniform vec4 uYohaneMainLightPosition;
uniform mediump vec4 uYohaneMainLightColor;
uniform vec3 uYohaneWorldSpaceCameraPos;
uniform vec2 uYohaneGlobalMipBias;
uniform vec4 uYohaneunity_OrthoParams;
uniform vec4 uYohanehlslcc_mtx4x4unity_MatrixV[4];
uniform vec4 uYohanehlslcc_mtx4x4unity_ObjectToWorld[4];
uniform vec4 uYohanehlslcc_mtx4x4unity_WorldToObject[4];
uniform vec4 uYohaneunity_LODFade;
uniform mediump vec4 uYohaneunity_WorldTransformParams;
uniform vec4 uYohaneunity_RenderingLayer;
uniform mediump vec4 uYohaneunity_LightData;
uniform mediump vec4 uYohaneunity_LightIndices[2];
uniform vec4 uYohaneunity_ProbesOcclusion;
uniform mediump vec4 uYohaneunity_SpecCube0_HDR;
uniform mediump vec4 uYohaneunity_SpecCube1_HDR;
uniform vec4 uYohaneunity_SpecCube0_BoxMax;
uniform vec4 uYohaneunity_SpecCube0_BoxMin;
uniform vec4 uYohaneunity_SpecCube0_ProbePosition;
uniform vec4 uYohaneunity_SpecCube1_BoxMax;
uniform vec4 uYohaneunity_SpecCube1_BoxMin;
uniform vec4 uYohaneunity_SpecCube1_ProbePosition;
uniform vec4 uYohaneunity_LightmapST;
uniform vec4 uYohaneunity_DynamicLightmapST;
uniform mediump vec4 uYohaneunity_SHAr;
uniform mediump vec4 uYohaneunity_SHAg;
uniform mediump vec4 uYohaneunity_SHAb;
uniform mediump vec4 uYohaneunity_SHBr;
uniform mediump vec4 uYohaneunity_SHBg;
uniform mediump vec4 uYohaneunity_SHBb;
uniform mediump vec4 uYohaneunity_SHC;
uniform vec4 uYohanehlslcc_mtx4x4unity_MatrixPreviousM[4];
uniform vec4 uYohanehlslcc_mtx4x4unity_MatrixPreviousMI[4];
uniform vec4 uYohaneunity_MotionVectorsParams;
uniform vec4 uBaseMap_TexelSize;
uniform vec4 uBaseMap_MipInfo;
uniform vec4 uBaseMap_ST;
uniform mediump vec4 uBaseColor;
uniform mediump vec4 uSpecColor;
uniform mediump vec4 uEmissionColor;
uniform mediump float uCutoff;
uniform mediump float uSurface;
uniform mediump float uSmoothness;
uniform mediump float uSpecularHighlights;
uniform float uAlphaClip;
uniform vec4 uSpecGlossMap_ST;
uniform float uSmoothnessSource;
uniform float uBumpScale;
uniform mediump vec4 uRimLightColor;
uniform mediump float uShadowThreshold;
uniform mediump float uRimShadow;
uniform mediump float uRimPower;
uniform vec4 uBaseMap2_TexelSize;
uniform vec4 uBaseMap2_MipInfo;
uniform vec4 uBaseMap2_ST;
uniform mediump vec4 uBaseColor2;
uniform mediump vec4 uSpecColor2;
uniform mediump vec4 uEmissionColor2;
uniform mediump float uSmoothness2;
uniform mediump float uSpecularHighlights2;
uniform vec4 uSpecGlossMap2_ST;
uniform float uSmoothnessSource2;
uniform float uBumpScale2;
uniform mediump vec4 uRimLightColor2;
uniform mediump float uShadowThreshold2;
uniform mediump float uRimPower2;
uniform mediump float uRimShadow2;
uniform mediump float uMaskThreshold;
uniform mediump vec4 uMaskHeightRange;
uniform mediump vec4 uBackFaceColor;
uniform uint uskinned_tex_height;
uniform uint uskinned_tex_width;
uniform mediump sampler2D uBaseMap;
uniform mediump sampler2D uSpecGlossMap;
uniform mediump sampler2D uShadowColorMap;
varying highp vec2 yohaneVarying_vs_TEXCOORD0;
varying highp vec3 yohaneVarying_vs_TEXCOORD1;
varying mediump vec3 yohaneVarying_vs_TEXCOORD2;
mediump vec4 yohaneFragment_SV_Target0;
mediump vec4 yohaneFragment_u_xlat16_0;
bool yohaneFragment_u_xlatb0;
vec4 yohaneFragment_u_xlat1;
mediump vec3 yohaneFragment_u_xlat16_2;
vec3 yohaneFragment_u_xlat3;
mediump vec3 yohaneFragment_u_xlat16_4;
mediump vec3 yohaneFragment_u_xlat16_5;
mediump vec3 yohaneFragment_u_xlat16_6;
mediump float yohaneFragment_u_xlat16_11;
float yohaneFragment_u_xlat21;
bool yohaneFragment_u_xlatb21;
float yohaneFragment_u_xlat23;
mediump float yohaneFragment_u_xlat16_25;
mediump float yohaneFragment_u_xlat16_26;
vec4 yohaneSampleTexture(sampler2D image, vec2 coord) { return texture(image, vec2(coord.x, 1.0 - coord.y)); }
vec4 yohaneSampleTexture(sampler2D image, vec2 coord, float bias) { return texture(image, vec2(coord.x, 1.0 - coord.y), bias); }

void yohaneFragmentMain()
{
    yohaneFragment_u_xlat16_0 = yohaneSampleTexture(uBaseMap, yohaneVarying_vs_TEXCOORD0.xy, uYohaneGlobalMipBias.x);
    yohaneFragment_u_xlat1 = yohaneFragment_u_xlat16_0 * uBaseColor;
    yohaneFragment_u_xlat16_2.xyz = yohaneSampleTexture(uShadowColorMap, yohaneVarying_vs_TEXCOORD0.xy, uYohaneGlobalMipBias.x).xyz;
    yohaneFragment_u_xlatb21 = uYohaneunity_OrthoParams.w==0.0;
    yohaneFragment_u_xlat3.xyz = (-yohaneVarying_vs_TEXCOORD1.xyz) + uYohaneWorldSpaceCameraPos.xyz;
    yohaneFragment_u_xlat23 = dot(yohaneFragment_u_xlat3.xyz, yohaneFragment_u_xlat3.xyz);
    yohaneFragment_u_xlat23 = inversesqrt(yohaneFragment_u_xlat23);
    yohaneFragment_u_xlat3.xyz = vec3(yohaneFragment_u_xlat23) * yohaneFragment_u_xlat3.xyz;
    yohaneFragment_u_xlat16_4.x = (yohaneFragment_u_xlatb21) ? yohaneFragment_u_xlat3.x : uYohanehlslcc_mtx4x4unity_MatrixV[0].z;
    yohaneFragment_u_xlat16_4.y = (yohaneFragment_u_xlatb21) ? yohaneFragment_u_xlat3.y : uYohanehlslcc_mtx4x4unity_MatrixV[1].z;
    yohaneFragment_u_xlat16_4.z = (yohaneFragment_u_xlatb21) ? yohaneFragment_u_xlat3.z : uYohanehlslcc_mtx4x4unity_MatrixV[2].z;
    yohaneFragment_u_xlat16_25 = dot(yohaneVarying_vs_TEXCOORD2.xyz, yohaneVarying_vs_TEXCOORD2.xyz);
    yohaneFragment_u_xlat16_25 = inversesqrt(yohaneFragment_u_xlat16_25);
    yohaneFragment_u_xlat16_5.xyz = vec3(yohaneFragment_u_xlat16_25) * yohaneVarying_vs_TEXCOORD2.xyz;
    yohaneFragment_u_xlat16_25 = dot(yohaneFragment_u_xlat16_5.xyz, uYohaneMainLightPosition.xyz);
    yohaneFragment_u_xlat16_25 = yohaneFragment_u_xlat16_25 + 1.0;
    yohaneFragment_u_xlat16_25 = yohaneFragment_u_xlat16_25 * 0.5;
    yohaneFragment_u_xlat21 = min(uYohaneunity_LightData.z, 1.0);
    yohaneFragment_u_xlat21 = yohaneFragment_u_xlat21 * yohaneFragment_u_xlat16_25;
    yohaneFragment_u_xlat16_6.xyz = (-yohaneFragment_u_xlat16_4.xyz) + (-uYohaneMainLightPosition.xyz);
    yohaneFragment_u_xlat16_6.xyz = vec3(vec3(uRimShadow, uRimShadow, uRimShadow)) * yohaneFragment_u_xlat16_6.xyz + uYohaneMainLightPosition.xyz;
    yohaneFragment_u_xlat23 = dot(yohaneFragment_u_xlat16_5.xyz, yohaneFragment_u_xlat16_6.xyz);
    yohaneFragment_u_xlat23 = yohaneFragment_u_xlat23 + 1.0;
    yohaneFragment_u_xlat16_25 = yohaneFragment_u_xlat23 * 0.5 + (-yohaneFragment_u_xlat21);
    yohaneFragment_u_xlat16_25 = uRimShadow * yohaneFragment_u_xlat16_25 + yohaneFragment_u_xlat21;
    yohaneFragment_u_xlat16_26 = dFdx(yohaneFragment_u_xlat16_25);
    yohaneFragment_u_xlat16_6.x = dFdy(yohaneFragment_u_xlat16_25);
    yohaneFragment_u_xlat16_26 = abs(yohaneFragment_u_xlat16_26) + abs(yohaneFragment_u_xlat16_6.x);
    yohaneFragment_u_xlat16_25 = yohaneFragment_u_xlat16_25 + (-uShadowThreshold);
    yohaneFragment_u_xlat16_26 = float(1.0) / yohaneFragment_u_xlat16_26;
    yohaneFragment_u_xlat16_25 = yohaneFragment_u_xlat16_25 * yohaneFragment_u_xlat16_26;
    yohaneFragment_u_xlat16_25 = clamp(yohaneFragment_u_xlat16_25, 0.0, 1.0);
    yohaneFragment_u_xlat16_26 = yohaneFragment_u_xlat16_25 * -2.0 + 3.0;
    yohaneFragment_u_xlat16_25 = yohaneFragment_u_xlat16_25 * yohaneFragment_u_xlat16_25;
    yohaneFragment_u_xlat16_25 = (-yohaneFragment_u_xlat16_26) * yohaneFragment_u_xlat16_25 + 1.0;
    yohaneFragment_u_xlat16_4.x = dot(yohaneFragment_u_xlat16_5.xyz, yohaneFragment_u_xlat16_4.xyz);
    yohaneFragment_u_xlat16_4.x = (-yohaneFragment_u_xlat16_4.x) + 1.0;
    yohaneFragment_u_xlat16_4.x = log2(abs(yohaneFragment_u_xlat16_4.x));
    yohaneFragment_u_xlat16_4.x = yohaneFragment_u_xlat16_4.x * uRimPower;
    yohaneFragment_u_xlat16_4.x = exp2(yohaneFragment_u_xlat16_4.x);
    yohaneFragment_u_xlat16_4.x = yohaneFragment_u_xlat16_4.x * yohaneFragment_u_xlat21 + -0.5;
    yohaneFragment_u_xlat16_4.x = yohaneFragment_u_xlat16_4.x * 50.0000496;
    yohaneFragment_u_xlat16_4.x = clamp(yohaneFragment_u_xlat16_4.x, 0.0, 1.0);
    yohaneFragment_u_xlat16_11 = yohaneFragment_u_xlat16_4.x * -2.0 + 3.0;
    yohaneFragment_u_xlat16_4.x = yohaneFragment_u_xlat16_4.x * yohaneFragment_u_xlat16_4.x;
    yohaneFragment_u_xlat16_4.x = yohaneFragment_u_xlat16_4.x * yohaneFragment_u_xlat16_11;
    yohaneFragment_u_xlat16_5.xyz = uYohaneMainLightColor.xyz * uRimLightColor.xyz;
    yohaneFragment_u_xlat16_4.xyz = yohaneFragment_u_xlat16_5.xyz * yohaneFragment_u_xlat16_4.xxx + uYohaneMainLightColor.xyz;
    yohaneFragment_u_xlat16_5.xyz = (-yohaneFragment_u_xlat16_0.xyz) * uBaseColor.xyz + yohaneFragment_u_xlat16_2.xyz;
    yohaneFragment_u_xlat16_5.xyz = vec3(yohaneFragment_u_xlat16_25) * yohaneFragment_u_xlat16_5.xyz + yohaneFragment_u_xlat1.xyz;
    yohaneFragment_u_xlat16_4.xyz = yohaneFragment_u_xlat16_4.xyz * yohaneFragment_u_xlat16_5.xyz;
    yohaneFragment_u_xlatb0 = uSpecularHighlights==0.0;
    if(yohaneFragment_u_xlatb0){
        yohaneFragment_u_xlat16_0.xyz = yohaneSampleTexture(uSpecGlossMap, yohaneVarying_vs_TEXCOORD0.xy, uYohaneGlobalMipBias.x).xyz;
        yohaneFragment_u_xlat16_5.xyz = yohaneFragment_u_xlat16_0.xyz * vec3(yohaneFragment_u_xlat21);
        yohaneFragment_u_xlat16_4.xyz = yohaneFragment_u_xlat16_5.xyz * uSpecColor.xyz + yohaneFragment_u_xlat16_4.xyz;
    }
    yohaneFragment_SV_Target0.xyz = yohaneFragment_u_xlat16_4.xyz;
    yohaneFragment_SV_Target0.w = yohaneFragment_u_xlat1.w;
    return;
}

// @end

// @section ForwardFront_HAIRHIGHLIGHT_ON_fragmentBody
yohaneFragmentMain();
vec3 outgoingLight = yohaneFragment_SV_Target0.rgb;
diffuseColor.a = yohaneFragment_SV_Target0.a;
// @end

// @section ForwardFront_ALPHATEST_ON_vertexPrelude
uniform vec4 uYohanehlslcc_mtx4x4unity_MatrixVP[4];
uniform vec4 uYohanehlslcc_mtx4x4unity_ObjectToWorld[4];
uniform vec4 uYohanehlslcc_mtx4x4unity_WorldToObject[4];
uniform vec4 uYohaneunity_LODFade;
uniform mediump vec4 uYohaneunity_WorldTransformParams;
uniform vec4 uYohaneunity_RenderingLayer;
uniform mediump vec4 uYohaneunity_LightData;
uniform mediump vec4 uYohaneunity_LightIndices[2];
uniform vec4 uYohaneunity_ProbesOcclusion;
uniform mediump vec4 uYohaneunity_SpecCube0_HDR;
uniform mediump vec4 uYohaneunity_SpecCube1_HDR;
uniform vec4 uYohaneunity_SpecCube0_BoxMax;
uniform vec4 uYohaneunity_SpecCube0_BoxMin;
uniform vec4 uYohaneunity_SpecCube0_ProbePosition;
uniform vec4 uYohaneunity_SpecCube1_BoxMax;
uniform vec4 uYohaneunity_SpecCube1_BoxMin;
uniform vec4 uYohaneunity_SpecCube1_ProbePosition;
uniform vec4 uYohaneunity_LightmapST;
uniform vec4 uYohaneunity_DynamicLightmapST;
uniform mediump vec4 uYohaneunity_SHAr;
uniform mediump vec4 uYohaneunity_SHAg;
uniform mediump vec4 uYohaneunity_SHAb;
uniform mediump vec4 uYohaneunity_SHBr;
uniform mediump vec4 uYohaneunity_SHBg;
uniform mediump vec4 uYohaneunity_SHBb;
uniform mediump vec4 uYohaneunity_SHC;
uniform vec4 uYohanehlslcc_mtx4x4unity_MatrixPreviousM[4];
uniform vec4 uYohanehlslcc_mtx4x4unity_MatrixPreviousMI[4];
uniform vec4 uYohaneunity_MotionVectorsParams;
uniform vec4 uBaseMap_TexelSize;
uniform vec4 uBaseMap_MipInfo;
uniform vec4 uBaseMap_ST;
uniform mediump vec4 uBaseColor;
uniform mediump vec4 uSpecColor;
uniform mediump vec4 uEmissionColor;
uniform mediump float uCutoff;
uniform mediump float uSurface;
uniform mediump float uSmoothness;
uniform mediump float uSpecularHighlights;
uniform float uAlphaClip;
uniform vec4 uSpecGlossMap_ST;
uniform float uSmoothnessSource;
uniform float uBumpScale;
uniform mediump vec4 uRimLightColor;
uniform mediump float uShadowThreshold;
uniform mediump float uRimShadow;
uniform mediump float uRimPower;
uniform vec4 uBaseMap2_TexelSize;
uniform vec4 uBaseMap2_MipInfo;
uniform vec4 uBaseMap2_ST;
uniform mediump vec4 uBaseColor2;
uniform mediump vec4 uSpecColor2;
uniform mediump vec4 uEmissionColor2;
uniform mediump float uSmoothness2;
uniform mediump float uSpecularHighlights2;
uniform vec4 uSpecGlossMap2_ST;
uniform float uSmoothnessSource2;
uniform float uBumpScale2;
uniform mediump vec4 uRimLightColor2;
uniform mediump float uShadowThreshold2;
uniform mediump float uRimPower2;
uniform mediump float uRimShadow2;
uniform mediump float uMaskThreshold;
uniform mediump vec4 uMaskHeightRange;
uniform mediump vec4 uBackFaceColor;
uniform uint uskinned_tex_height;
uniform uint uskinned_tex_width;
highp vec3 yohaneVertex_in_POSITION0;
highp vec3 yohaneVertex_in_NORMAL0;
highp vec2 yohaneVertex_in_TEXCOORD0;
varying highp vec2 yohaneVarying_vs_TEXCOORD0;
varying highp vec3 yohaneVarying_vs_TEXCOORD1;
varying mediump vec3 yohaneVarying_vs_TEXCOORD2;
vec3 yohaneVertex_u_xlat0;
vec4 yohaneVertex_u_xlat1;
float yohaneVertex_u_xlat6;
void yohaneVertexMain()
{
    yohaneVertex_u_xlat0.xyz = yohaneVertex_in_POSITION0.yyy * uYohanehlslcc_mtx4x4unity_ObjectToWorld[1].xyz;
    yohaneVertex_u_xlat0.xyz = uYohanehlslcc_mtx4x4unity_ObjectToWorld[0].xyz * yohaneVertex_in_POSITION0.xxx + yohaneVertex_u_xlat0.xyz;
    yohaneVertex_u_xlat0.xyz = uYohanehlslcc_mtx4x4unity_ObjectToWorld[2].xyz * yohaneVertex_in_POSITION0.zzz + yohaneVertex_u_xlat0.xyz;
    yohaneVertex_u_xlat0.xyz = yohaneVertex_u_xlat0.xyz + uYohanehlslcc_mtx4x4unity_ObjectToWorld[3].xyz;
    yohaneVertex_u_xlat1 = yohaneVertex_u_xlat0.yyyy * uYohanehlslcc_mtx4x4unity_MatrixVP[1];
    yohaneVertex_u_xlat1 = uYohanehlslcc_mtx4x4unity_MatrixVP[0] * yohaneVertex_u_xlat0.xxxx + yohaneVertex_u_xlat1;
    yohaneVertex_u_xlat1 = uYohanehlslcc_mtx4x4unity_MatrixVP[2] * yohaneVertex_u_xlat0.zzzz + yohaneVertex_u_xlat1;
    yohaneVarying_vs_TEXCOORD1.xyz = yohaneVertex_u_xlat0.xyz;
    gl_Position = yohaneVertex_u_xlat1 + uYohanehlslcc_mtx4x4unity_MatrixVP[3];
    yohaneVarying_vs_TEXCOORD0.xy = yohaneVertex_in_TEXCOORD0.xy * uBaseMap_ST.xy + uBaseMap_ST.zw;
    yohaneVertex_u_xlat0.x = dot(yohaneVertex_in_NORMAL0.xyz, uYohanehlslcc_mtx4x4unity_WorldToObject[0].xyz);
    yohaneVertex_u_xlat0.y = dot(yohaneVertex_in_NORMAL0.xyz, uYohanehlslcc_mtx4x4unity_WorldToObject[1].xyz);
    yohaneVertex_u_xlat0.z = dot(yohaneVertex_in_NORMAL0.xyz, uYohanehlslcc_mtx4x4unity_WorldToObject[2].xyz);
    yohaneVertex_u_xlat6 = dot(yohaneVertex_u_xlat0.xyz, yohaneVertex_u_xlat0.xyz);
    yohaneVertex_u_xlat6 = max(yohaneVertex_u_xlat6, 1.17549435e-38);
    yohaneVertex_u_xlat6 = inversesqrt(yohaneVertex_u_xlat6);
    yohaneVertex_u_xlat0.xyz = vec3(yohaneVertex_u_xlat6) * yohaneVertex_u_xlat0.xyz;
    yohaneVertex_u_xlat6 = dot(yohaneVertex_u_xlat0.xyz, yohaneVertex_u_xlat0.xyz);
    yohaneVertex_u_xlat6 = inversesqrt(yohaneVertex_u_xlat6);
    yohaneVertex_u_xlat0.xyz = vec3(yohaneVertex_u_xlat6) * yohaneVertex_u_xlat0.xyz;
    yohaneVarying_vs_TEXCOORD2.xyz = yohaneVertex_u_xlat0.xyz;
    return;
}

// @end

// @section ForwardFront_ALPHATEST_ON_vertexProject
yohaneVertex_in_POSITION0 = vec3(-transformed.x, transformed.yz);
yohaneVertex_in_NORMAL0 = vec3(-objectNormal.x, objectNormal.yz);
yohaneVertex_in_TEXCOORD0 = vec2(uv.x, 1.0 - uv.y);
yohaneVertexMain();
// @end

// @section ForwardFront_ALPHATEST_ON_fragmentPrelude
uniform vec4 uYohaneMainLightPosition;
uniform mediump vec4 uYohaneMainLightColor;
uniform vec3 uYohaneWorldSpaceCameraPos;
uniform vec2 uYohaneGlobalMipBias;
uniform vec4 uYohaneunity_OrthoParams;
uniform vec4 uYohanehlslcc_mtx4x4unity_MatrixV[4];
uniform vec4 uYohanehlslcc_mtx4x4unity_ObjectToWorld[4];
uniform vec4 uYohanehlslcc_mtx4x4unity_WorldToObject[4];
uniform vec4 uYohaneunity_LODFade;
uniform mediump vec4 uYohaneunity_WorldTransformParams;
uniform vec4 uYohaneunity_RenderingLayer;
uniform mediump vec4 uYohaneunity_LightData;
uniform mediump vec4 uYohaneunity_LightIndices[2];
uniform vec4 uYohaneunity_ProbesOcclusion;
uniform mediump vec4 uYohaneunity_SpecCube0_HDR;
uniform mediump vec4 uYohaneunity_SpecCube1_HDR;
uniform vec4 uYohaneunity_SpecCube0_BoxMax;
uniform vec4 uYohaneunity_SpecCube0_BoxMin;
uniform vec4 uYohaneunity_SpecCube0_ProbePosition;
uniform vec4 uYohaneunity_SpecCube1_BoxMax;
uniform vec4 uYohaneunity_SpecCube1_BoxMin;
uniform vec4 uYohaneunity_SpecCube1_ProbePosition;
uniform vec4 uYohaneunity_LightmapST;
uniform vec4 uYohaneunity_DynamicLightmapST;
uniform mediump vec4 uYohaneunity_SHAr;
uniform mediump vec4 uYohaneunity_SHAg;
uniform mediump vec4 uYohaneunity_SHAb;
uniform mediump vec4 uYohaneunity_SHBr;
uniform mediump vec4 uYohaneunity_SHBg;
uniform mediump vec4 uYohaneunity_SHBb;
uniform mediump vec4 uYohaneunity_SHC;
uniform vec4 uYohanehlslcc_mtx4x4unity_MatrixPreviousM[4];
uniform vec4 uYohanehlslcc_mtx4x4unity_MatrixPreviousMI[4];
uniform vec4 uYohaneunity_MotionVectorsParams;
uniform vec4 uBaseMap_TexelSize;
uniform vec4 uBaseMap_MipInfo;
uniform vec4 uBaseMap_ST;
uniform mediump vec4 uBaseColor;
uniform mediump vec4 uSpecColor;
uniform mediump vec4 uEmissionColor;
uniform mediump float uCutoff;
uniform mediump float uSurface;
uniform mediump float uSmoothness;
uniform mediump float uSpecularHighlights;
uniform float uAlphaClip;
uniform vec4 uSpecGlossMap_ST;
uniform float uSmoothnessSource;
uniform float uBumpScale;
uniform mediump vec4 uRimLightColor;
uniform mediump float uShadowThreshold;
uniform mediump float uRimShadow;
uniform mediump float uRimPower;
uniform vec4 uBaseMap2_TexelSize;
uniform vec4 uBaseMap2_MipInfo;
uniform vec4 uBaseMap2_ST;
uniform mediump vec4 uBaseColor2;
uniform mediump vec4 uSpecColor2;
uniform mediump vec4 uEmissionColor2;
uniform mediump float uSmoothness2;
uniform mediump float uSpecularHighlights2;
uniform vec4 uSpecGlossMap2_ST;
uniform float uSmoothnessSource2;
uniform float uBumpScale2;
uniform mediump vec4 uRimLightColor2;
uniform mediump float uShadowThreshold2;
uniform mediump float uRimPower2;
uniform mediump float uRimShadow2;
uniform mediump float uMaskThreshold;
uniform mediump vec4 uMaskHeightRange;
uniform mediump vec4 uBackFaceColor;
uniform uint uskinned_tex_height;
uniform uint uskinned_tex_width;
uniform mediump sampler2D uBaseMap;
uniform mediump sampler2D uSpecGlossMap;
uniform mediump sampler2D uShadowColorMap;
varying highp vec2 yohaneVarying_vs_TEXCOORD0;
varying highp vec3 yohaneVarying_vs_TEXCOORD1;
varying mediump vec3 yohaneVarying_vs_TEXCOORD2;
mediump vec4 yohaneFragment_SV_Target0;
vec3 yohaneFragment_u_xlat0;
mediump vec4 yohaneFragment_u_xlat16_0;
bool yohaneFragment_u_xlatb0;
vec4 yohaneFragment_u_xlat1;
mediump vec3 yohaneFragment_u_xlat16_2;
mediump vec3 yohaneFragment_u_xlat16_3;
vec3 yohaneFragment_u_xlat4;
mediump vec3 yohaneFragment_u_xlat16_5;
mediump vec3 yohaneFragment_u_xlat16_6;
float yohaneFragment_u_xlat21;
bool yohaneFragment_u_xlatb21;
mediump float yohaneFragment_u_xlat16_23;
float yohaneFragment_u_xlat24;
mediump float yohaneFragment_u_xlat16_26;
vec4 yohaneSampleTexture(sampler2D image, vec2 coord) { return texture(image, vec2(coord.x, 1.0 - coord.y)); }
vec4 yohaneSampleTexture(sampler2D image, vec2 coord, float bias) { return texture(image, vec2(coord.x, 1.0 - coord.y), bias); }

void yohaneFragmentMain()
{
    yohaneFragment_u_xlat16_0 = yohaneSampleTexture(uBaseMap, yohaneVarying_vs_TEXCOORD0.xy, uYohaneGlobalMipBias.x);
    yohaneFragment_u_xlat1 = yohaneFragment_u_xlat16_0 * uBaseColor;
    yohaneFragment_u_xlat16_2.x = yohaneFragment_u_xlat16_0.w * uBaseColor.w + (-uCutoff);
    yohaneFragment_u_xlatb21 = yohaneFragment_u_xlat16_2.x<0.0;
    if(yohaneFragment_u_xlatb21){discard;}
    yohaneFragment_u_xlat16_3.xyz = yohaneSampleTexture(uShadowColorMap, yohaneVarying_vs_TEXCOORD0.xy, uYohaneGlobalMipBias.x).xyz;
    yohaneFragment_u_xlatb21 = uYohaneunity_OrthoParams.w==0.0;
    yohaneFragment_u_xlat4.xyz = (-yohaneVarying_vs_TEXCOORD1.xyz) + uYohaneWorldSpaceCameraPos.xyz;
    yohaneFragment_u_xlat24 = dot(yohaneFragment_u_xlat4.xyz, yohaneFragment_u_xlat4.xyz);
    yohaneFragment_u_xlat24 = inversesqrt(yohaneFragment_u_xlat24);
    yohaneFragment_u_xlat4.xyz = vec3(yohaneFragment_u_xlat24) * yohaneFragment_u_xlat4.xyz;
    yohaneFragment_u_xlat16_2.x = (yohaneFragment_u_xlatb21) ? yohaneFragment_u_xlat4.x : uYohanehlslcc_mtx4x4unity_MatrixV[0].z;
    yohaneFragment_u_xlat16_2.y = (yohaneFragment_u_xlatb21) ? yohaneFragment_u_xlat4.y : uYohanehlslcc_mtx4x4unity_MatrixV[1].z;
    yohaneFragment_u_xlat16_2.z = (yohaneFragment_u_xlatb21) ? yohaneFragment_u_xlat4.z : uYohanehlslcc_mtx4x4unity_MatrixV[2].z;
    yohaneFragment_u_xlat16_23 = dot(yohaneVarying_vs_TEXCOORD2.xyz, yohaneVarying_vs_TEXCOORD2.xyz);
    yohaneFragment_u_xlat16_23 = inversesqrt(yohaneFragment_u_xlat16_23);
    yohaneFragment_u_xlat16_5.xyz = vec3(yohaneFragment_u_xlat16_23) * yohaneVarying_vs_TEXCOORD2.xyz;
    yohaneFragment_u_xlat16_23 = dot(yohaneFragment_u_xlat16_5.xyz, uYohaneMainLightPosition.xyz);
    yohaneFragment_u_xlat16_23 = yohaneFragment_u_xlat16_23 + 1.0;
    yohaneFragment_u_xlat16_23 = yohaneFragment_u_xlat16_23 * 0.5;
    yohaneFragment_u_xlat21 = min(uYohaneunity_LightData.z, 1.0);
    yohaneFragment_u_xlat21 = yohaneFragment_u_xlat21 * yohaneFragment_u_xlat16_23;
    yohaneFragment_u_xlat16_6.xyz = (-yohaneFragment_u_xlat16_2.xyz) + (-uYohaneMainLightPosition.xyz);
    yohaneFragment_u_xlat16_6.xyz = vec3(vec3(uRimShadow, uRimShadow, uRimShadow)) * yohaneFragment_u_xlat16_6.xyz + uYohaneMainLightPosition.xyz;
    yohaneFragment_u_xlat24 = dot(yohaneFragment_u_xlat16_5.xyz, yohaneFragment_u_xlat16_6.xyz);
    yohaneFragment_u_xlat24 = yohaneFragment_u_xlat24 + 1.0;
    yohaneFragment_u_xlat16_23 = yohaneFragment_u_xlat24 * 0.5 + (-yohaneFragment_u_xlat21);
    yohaneFragment_u_xlat16_23 = uRimShadow * yohaneFragment_u_xlat16_23 + yohaneFragment_u_xlat21;
    yohaneFragment_u_xlat16_26 = dFdx(yohaneFragment_u_xlat16_23);
    yohaneFragment_u_xlat16_6.x = dFdy(yohaneFragment_u_xlat16_23);
    yohaneFragment_u_xlat16_26 = abs(yohaneFragment_u_xlat16_26) + abs(yohaneFragment_u_xlat16_6.x);
    yohaneFragment_u_xlat16_23 = yohaneFragment_u_xlat16_23 + (-uShadowThreshold);
    yohaneFragment_u_xlat16_26 = float(1.0) / yohaneFragment_u_xlat16_26;
    yohaneFragment_u_xlat16_23 = yohaneFragment_u_xlat16_23 * yohaneFragment_u_xlat16_26;
    yohaneFragment_u_xlat16_23 = clamp(yohaneFragment_u_xlat16_23, 0.0, 1.0);
    yohaneFragment_u_xlat16_26 = yohaneFragment_u_xlat16_23 * -2.0 + 3.0;
    yohaneFragment_u_xlat16_23 = yohaneFragment_u_xlat16_23 * yohaneFragment_u_xlat16_23;
    yohaneFragment_u_xlat16_23 = (-yohaneFragment_u_xlat16_26) * yohaneFragment_u_xlat16_23 + 1.0;
    yohaneFragment_u_xlat16_6.xyz = (-yohaneFragment_u_xlat16_0.xyz) * uBaseColor.xyz + yohaneFragment_u_xlat16_3.xyz;
    yohaneFragment_u_xlat16_6.xyz = vec3(yohaneFragment_u_xlat16_23) * yohaneFragment_u_xlat16_6.xyz + yohaneFragment_u_xlat1.xyz;
    yohaneFragment_u_xlat16_6.xyz = yohaneFragment_u_xlat16_6.xyz * uYohaneMainLightColor.xyz;
    yohaneFragment_u_xlatb0 = uSpecularHighlights==0.0;
    if(yohaneFragment_u_xlatb0){
        yohaneFragment_u_xlat16_0.xyz = yohaneSampleTexture(uSpecGlossMap, yohaneVarying_vs_TEXCOORD0.xy, uYohaneGlobalMipBias.x).xyz;
        yohaneFragment_u_xlat16_23 = uSmoothness * 10.0 + 1.0;
        yohaneFragment_u_xlat16_23 = exp2(yohaneFragment_u_xlat16_23);
        yohaneFragment_u_xlat1.xyz = yohaneFragment_u_xlat16_2.xyz + uYohaneMainLightPosition.xyz;
        yohaneFragment_u_xlat21 = dot(yohaneFragment_u_xlat1.xyz, yohaneFragment_u_xlat1.xyz);
        yohaneFragment_u_xlat21 = max(yohaneFragment_u_xlat21, 1.17549435e-38);
        yohaneFragment_u_xlat21 = inversesqrt(yohaneFragment_u_xlat21);
        yohaneFragment_u_xlat1.xyz = vec3(yohaneFragment_u_xlat21) * yohaneFragment_u_xlat1.xyz;
        yohaneFragment_u_xlat21 = dot(yohaneFragment_u_xlat16_5.xyz, yohaneFragment_u_xlat1.xyz);
        yohaneFragment_u_xlat21 = clamp(yohaneFragment_u_xlat21, 0.0, 1.0);
        yohaneFragment_u_xlat16_2.x = log2(yohaneFragment_u_xlat21);
        yohaneFragment_u_xlat16_2.x = yohaneFragment_u_xlat16_2.x * yohaneFragment_u_xlat16_23;
        yohaneFragment_u_xlat16_2.x = exp2(yohaneFragment_u_xlat16_2.x);
        yohaneFragment_u_xlat16_2.xyz = yohaneFragment_u_xlat16_0.xyz * yohaneFragment_u_xlat16_2.xxx;
        yohaneFragment_u_xlat0.xyz = yohaneFragment_u_xlat16_2.xyz * uYohaneMainLightColor.xyz;
        yohaneFragment_u_xlat16_6.xyz = yohaneFragment_u_xlat0.xyz * uSpecColor.xyz + yohaneFragment_u_xlat16_6.xyz;
    }
    yohaneFragment_SV_Target0.xyz = yohaneFragment_u_xlat16_6.xyz;
    yohaneFragment_SV_Target0.w = yohaneFragment_u_xlat1.w;
    return;
}

// @end

// @section ForwardFront_ALPHATEST_ON_fragmentBody
yohaneFragmentMain();
vec3 outgoingLight = yohaneFragment_SV_Target0.rgb;
diffuseColor.a = yohaneFragment_SV_Target0.a;
// @end

// @section ForwardFront_ALPHATEST_ON_HAIRHIGHLIGHT_ON_vertexPrelude
uniform vec4 uYohanehlslcc_mtx4x4unity_MatrixVP[4];
uniform vec4 uYohanehlslcc_mtx4x4unity_ObjectToWorld[4];
uniform vec4 uYohanehlslcc_mtx4x4unity_WorldToObject[4];
uniform vec4 uYohaneunity_LODFade;
uniform mediump vec4 uYohaneunity_WorldTransformParams;
uniform vec4 uYohaneunity_RenderingLayer;
uniform mediump vec4 uYohaneunity_LightData;
uniform mediump vec4 uYohaneunity_LightIndices[2];
uniform vec4 uYohaneunity_ProbesOcclusion;
uniform mediump vec4 uYohaneunity_SpecCube0_HDR;
uniform mediump vec4 uYohaneunity_SpecCube1_HDR;
uniform vec4 uYohaneunity_SpecCube0_BoxMax;
uniform vec4 uYohaneunity_SpecCube0_BoxMin;
uniform vec4 uYohaneunity_SpecCube0_ProbePosition;
uniform vec4 uYohaneunity_SpecCube1_BoxMax;
uniform vec4 uYohaneunity_SpecCube1_BoxMin;
uniform vec4 uYohaneunity_SpecCube1_ProbePosition;
uniform vec4 uYohaneunity_LightmapST;
uniform vec4 uYohaneunity_DynamicLightmapST;
uniform mediump vec4 uYohaneunity_SHAr;
uniform mediump vec4 uYohaneunity_SHAg;
uniform mediump vec4 uYohaneunity_SHAb;
uniform mediump vec4 uYohaneunity_SHBr;
uniform mediump vec4 uYohaneunity_SHBg;
uniform mediump vec4 uYohaneunity_SHBb;
uniform mediump vec4 uYohaneunity_SHC;
uniform vec4 uYohanehlslcc_mtx4x4unity_MatrixPreviousM[4];
uniform vec4 uYohanehlslcc_mtx4x4unity_MatrixPreviousMI[4];
uniform vec4 uYohaneunity_MotionVectorsParams;
uniform vec4 uBaseMap_TexelSize;
uniform vec4 uBaseMap_MipInfo;
uniform vec4 uBaseMap_ST;
uniform mediump vec4 uBaseColor;
uniform mediump vec4 uSpecColor;
uniform mediump vec4 uEmissionColor;
uniform mediump float uCutoff;
uniform mediump float uSurface;
uniform mediump float uSmoothness;
uniform mediump float uSpecularHighlights;
uniform float uAlphaClip;
uniform vec4 uSpecGlossMap_ST;
uniform float uSmoothnessSource;
uniform float uBumpScale;
uniform mediump vec4 uRimLightColor;
uniform mediump float uShadowThreshold;
uniform mediump float uRimShadow;
uniform mediump float uRimPower;
uniform vec4 uBaseMap2_TexelSize;
uniform vec4 uBaseMap2_MipInfo;
uniform vec4 uBaseMap2_ST;
uniform mediump vec4 uBaseColor2;
uniform mediump vec4 uSpecColor2;
uniform mediump vec4 uEmissionColor2;
uniform mediump float uSmoothness2;
uniform mediump float uSpecularHighlights2;
uniform vec4 uSpecGlossMap2_ST;
uniform float uSmoothnessSource2;
uniform float uBumpScale2;
uniform mediump vec4 uRimLightColor2;
uniform mediump float uShadowThreshold2;
uniform mediump float uRimPower2;
uniform mediump float uRimShadow2;
uniform mediump float uMaskThreshold;
uniform mediump vec4 uMaskHeightRange;
uniform mediump vec4 uBackFaceColor;
uniform uint uskinned_tex_height;
uniform uint uskinned_tex_width;
highp vec3 yohaneVertex_in_POSITION0;
highp vec3 yohaneVertex_in_NORMAL0;
highp vec2 yohaneVertex_in_TEXCOORD0;
varying highp vec2 yohaneVarying_vs_TEXCOORD0;
varying highp vec3 yohaneVarying_vs_TEXCOORD1;
varying mediump vec3 yohaneVarying_vs_TEXCOORD2;
vec3 yohaneVertex_u_xlat0;
vec4 yohaneVertex_u_xlat1;
float yohaneVertex_u_xlat6;
void yohaneVertexMain()
{
    yohaneVertex_u_xlat0.xyz = yohaneVertex_in_POSITION0.yyy * uYohanehlslcc_mtx4x4unity_ObjectToWorld[1].xyz;
    yohaneVertex_u_xlat0.xyz = uYohanehlslcc_mtx4x4unity_ObjectToWorld[0].xyz * yohaneVertex_in_POSITION0.xxx + yohaneVertex_u_xlat0.xyz;
    yohaneVertex_u_xlat0.xyz = uYohanehlslcc_mtx4x4unity_ObjectToWorld[2].xyz * yohaneVertex_in_POSITION0.zzz + yohaneVertex_u_xlat0.xyz;
    yohaneVertex_u_xlat0.xyz = yohaneVertex_u_xlat0.xyz + uYohanehlslcc_mtx4x4unity_ObjectToWorld[3].xyz;
    yohaneVertex_u_xlat1 = yohaneVertex_u_xlat0.yyyy * uYohanehlslcc_mtx4x4unity_MatrixVP[1];
    yohaneVertex_u_xlat1 = uYohanehlslcc_mtx4x4unity_MatrixVP[0] * yohaneVertex_u_xlat0.xxxx + yohaneVertex_u_xlat1;
    yohaneVertex_u_xlat1 = uYohanehlslcc_mtx4x4unity_MatrixVP[2] * yohaneVertex_u_xlat0.zzzz + yohaneVertex_u_xlat1;
    yohaneVarying_vs_TEXCOORD1.xyz = yohaneVertex_u_xlat0.xyz;
    gl_Position = yohaneVertex_u_xlat1 + uYohanehlslcc_mtx4x4unity_MatrixVP[3];
    yohaneVarying_vs_TEXCOORD0.xy = yohaneVertex_in_TEXCOORD0.xy * uBaseMap_ST.xy + uBaseMap_ST.zw;
    yohaneVertex_u_xlat0.x = dot(yohaneVertex_in_NORMAL0.xyz, uYohanehlslcc_mtx4x4unity_WorldToObject[0].xyz);
    yohaneVertex_u_xlat0.y = dot(yohaneVertex_in_NORMAL0.xyz, uYohanehlslcc_mtx4x4unity_WorldToObject[1].xyz);
    yohaneVertex_u_xlat0.z = dot(yohaneVertex_in_NORMAL0.xyz, uYohanehlslcc_mtx4x4unity_WorldToObject[2].xyz);
    yohaneVertex_u_xlat6 = dot(yohaneVertex_u_xlat0.xyz, yohaneVertex_u_xlat0.xyz);
    yohaneVertex_u_xlat6 = max(yohaneVertex_u_xlat6, 1.17549435e-38);
    yohaneVertex_u_xlat6 = inversesqrt(yohaneVertex_u_xlat6);
    yohaneVertex_u_xlat0.xyz = vec3(yohaneVertex_u_xlat6) * yohaneVertex_u_xlat0.xyz;
    yohaneVertex_u_xlat6 = dot(yohaneVertex_u_xlat0.xyz, yohaneVertex_u_xlat0.xyz);
    yohaneVertex_u_xlat6 = inversesqrt(yohaneVertex_u_xlat6);
    yohaneVertex_u_xlat0.xyz = vec3(yohaneVertex_u_xlat6) * yohaneVertex_u_xlat0.xyz;
    yohaneVarying_vs_TEXCOORD2.xyz = yohaneVertex_u_xlat0.xyz;
    return;
}

// @end

// @section ForwardFront_ALPHATEST_ON_HAIRHIGHLIGHT_ON_vertexProject
yohaneVertex_in_POSITION0 = vec3(-transformed.x, transformed.yz);
yohaneVertex_in_NORMAL0 = vec3(-objectNormal.x, objectNormal.yz);
yohaneVertex_in_TEXCOORD0 = vec2(uv.x, 1.0 - uv.y);
yohaneVertexMain();
// @end

// @section ForwardFront_ALPHATEST_ON_HAIRHIGHLIGHT_ON_fragmentPrelude
uniform vec4 uYohaneMainLightPosition;
uniform mediump vec4 uYohaneMainLightColor;
uniform vec3 uYohaneWorldSpaceCameraPos;
uniform vec2 uYohaneGlobalMipBias;
uniform vec4 uYohaneunity_OrthoParams;
uniform vec4 uYohanehlslcc_mtx4x4unity_MatrixV[4];
uniform vec4 uYohanehlslcc_mtx4x4unity_ObjectToWorld[4];
uniform vec4 uYohanehlslcc_mtx4x4unity_WorldToObject[4];
uniform vec4 uYohaneunity_LODFade;
uniform mediump vec4 uYohaneunity_WorldTransformParams;
uniform vec4 uYohaneunity_RenderingLayer;
uniform mediump vec4 uYohaneunity_LightData;
uniform mediump vec4 uYohaneunity_LightIndices[2];
uniform vec4 uYohaneunity_ProbesOcclusion;
uniform mediump vec4 uYohaneunity_SpecCube0_HDR;
uniform mediump vec4 uYohaneunity_SpecCube1_HDR;
uniform vec4 uYohaneunity_SpecCube0_BoxMax;
uniform vec4 uYohaneunity_SpecCube0_BoxMin;
uniform vec4 uYohaneunity_SpecCube0_ProbePosition;
uniform vec4 uYohaneunity_SpecCube1_BoxMax;
uniform vec4 uYohaneunity_SpecCube1_BoxMin;
uniform vec4 uYohaneunity_SpecCube1_ProbePosition;
uniform vec4 uYohaneunity_LightmapST;
uniform vec4 uYohaneunity_DynamicLightmapST;
uniform mediump vec4 uYohaneunity_SHAr;
uniform mediump vec4 uYohaneunity_SHAg;
uniform mediump vec4 uYohaneunity_SHAb;
uniform mediump vec4 uYohaneunity_SHBr;
uniform mediump vec4 uYohaneunity_SHBg;
uniform mediump vec4 uYohaneunity_SHBb;
uniform mediump vec4 uYohaneunity_SHC;
uniform vec4 uYohanehlslcc_mtx4x4unity_MatrixPreviousM[4];
uniform vec4 uYohanehlslcc_mtx4x4unity_MatrixPreviousMI[4];
uniform vec4 uYohaneunity_MotionVectorsParams;
uniform vec4 uBaseMap_TexelSize;
uniform vec4 uBaseMap_MipInfo;
uniform vec4 uBaseMap_ST;
uniform mediump vec4 uBaseColor;
uniform mediump vec4 uSpecColor;
uniform mediump vec4 uEmissionColor;
uniform mediump float uCutoff;
uniform mediump float uSurface;
uniform mediump float uSmoothness;
uniform mediump float uSpecularHighlights;
uniform float uAlphaClip;
uniform vec4 uSpecGlossMap_ST;
uniform float uSmoothnessSource;
uniform float uBumpScale;
uniform mediump vec4 uRimLightColor;
uniform mediump float uShadowThreshold;
uniform mediump float uRimShadow;
uniform mediump float uRimPower;
uniform vec4 uBaseMap2_TexelSize;
uniform vec4 uBaseMap2_MipInfo;
uniform vec4 uBaseMap2_ST;
uniform mediump vec4 uBaseColor2;
uniform mediump vec4 uSpecColor2;
uniform mediump vec4 uEmissionColor2;
uniform mediump float uSmoothness2;
uniform mediump float uSpecularHighlights2;
uniform vec4 uSpecGlossMap2_ST;
uniform float uSmoothnessSource2;
uniform float uBumpScale2;
uniform mediump vec4 uRimLightColor2;
uniform mediump float uShadowThreshold2;
uniform mediump float uRimPower2;
uniform mediump float uRimShadow2;
uniform mediump float uMaskThreshold;
uniform mediump vec4 uMaskHeightRange;
uniform mediump vec4 uBackFaceColor;
uniform uint uskinned_tex_height;
uniform uint uskinned_tex_width;
uniform mediump sampler2D uBaseMap;
uniform mediump sampler2D uSpecGlossMap;
uniform mediump sampler2D uShadowColorMap;
varying highp vec2 yohaneVarying_vs_TEXCOORD0;
varying highp vec3 yohaneVarying_vs_TEXCOORD1;
varying mediump vec3 yohaneVarying_vs_TEXCOORD2;
mediump vec4 yohaneFragment_SV_Target0;
mediump vec4 yohaneFragment_u_xlat16_0;
bool yohaneFragment_u_xlatb0;
vec4 yohaneFragment_u_xlat1;
mediump vec3 yohaneFragment_u_xlat16_2;
mediump vec3 yohaneFragment_u_xlat16_3;
vec3 yohaneFragment_u_xlat4;
mediump vec3 yohaneFragment_u_xlat16_5;
mediump vec3 yohaneFragment_u_xlat16_6;
mediump float yohaneFragment_u_xlat16_9;
float yohaneFragment_u_xlat21;
bool yohaneFragment_u_xlatb21;
mediump float yohaneFragment_u_xlat16_23;
float yohaneFragment_u_xlat24;
mediump float yohaneFragment_u_xlat16_26;
vec4 yohaneSampleTexture(sampler2D image, vec2 coord) { return texture(image, vec2(coord.x, 1.0 - coord.y)); }
vec4 yohaneSampleTexture(sampler2D image, vec2 coord, float bias) { return texture(image, vec2(coord.x, 1.0 - coord.y), bias); }

void yohaneFragmentMain()
{
    yohaneFragment_u_xlat16_0 = yohaneSampleTexture(uBaseMap, yohaneVarying_vs_TEXCOORD0.xy, uYohaneGlobalMipBias.x);
    yohaneFragment_u_xlat1 = yohaneFragment_u_xlat16_0 * uBaseColor;
    yohaneFragment_u_xlat16_2.x = yohaneFragment_u_xlat16_0.w * uBaseColor.w + (-uCutoff);
    yohaneFragment_u_xlatb21 = yohaneFragment_u_xlat16_2.x<0.0;
    if(yohaneFragment_u_xlatb21){discard;}
    yohaneFragment_u_xlat16_3.xyz = yohaneSampleTexture(uShadowColorMap, yohaneVarying_vs_TEXCOORD0.xy, uYohaneGlobalMipBias.x).xyz;
    yohaneFragment_u_xlatb21 = uYohaneunity_OrthoParams.w==0.0;
    yohaneFragment_u_xlat4.xyz = (-yohaneVarying_vs_TEXCOORD1.xyz) + uYohaneWorldSpaceCameraPos.xyz;
    yohaneFragment_u_xlat24 = dot(yohaneFragment_u_xlat4.xyz, yohaneFragment_u_xlat4.xyz);
    yohaneFragment_u_xlat24 = inversesqrt(yohaneFragment_u_xlat24);
    yohaneFragment_u_xlat4.xyz = vec3(yohaneFragment_u_xlat24) * yohaneFragment_u_xlat4.xyz;
    yohaneFragment_u_xlat16_2.x = (yohaneFragment_u_xlatb21) ? yohaneFragment_u_xlat4.x : uYohanehlslcc_mtx4x4unity_MatrixV[0].z;
    yohaneFragment_u_xlat16_2.y = (yohaneFragment_u_xlatb21) ? yohaneFragment_u_xlat4.y : uYohanehlslcc_mtx4x4unity_MatrixV[1].z;
    yohaneFragment_u_xlat16_2.z = (yohaneFragment_u_xlatb21) ? yohaneFragment_u_xlat4.z : uYohanehlslcc_mtx4x4unity_MatrixV[2].z;
    yohaneFragment_u_xlat16_23 = dot(yohaneVarying_vs_TEXCOORD2.xyz, yohaneVarying_vs_TEXCOORD2.xyz);
    yohaneFragment_u_xlat16_23 = inversesqrt(yohaneFragment_u_xlat16_23);
    yohaneFragment_u_xlat16_5.xyz = vec3(yohaneFragment_u_xlat16_23) * yohaneVarying_vs_TEXCOORD2.xyz;
    yohaneFragment_u_xlat16_23 = dot(yohaneFragment_u_xlat16_5.xyz, uYohaneMainLightPosition.xyz);
    yohaneFragment_u_xlat16_23 = yohaneFragment_u_xlat16_23 + 1.0;
    yohaneFragment_u_xlat16_23 = yohaneFragment_u_xlat16_23 * 0.5;
    yohaneFragment_u_xlat21 = min(uYohaneunity_LightData.z, 1.0);
    yohaneFragment_u_xlat21 = yohaneFragment_u_xlat21 * yohaneFragment_u_xlat16_23;
    yohaneFragment_u_xlat16_6.xyz = (-yohaneFragment_u_xlat16_2.xyz) + (-uYohaneMainLightPosition.xyz);
    yohaneFragment_u_xlat16_6.xyz = vec3(vec3(uRimShadow, uRimShadow, uRimShadow)) * yohaneFragment_u_xlat16_6.xyz + uYohaneMainLightPosition.xyz;
    yohaneFragment_u_xlat24 = dot(yohaneFragment_u_xlat16_5.xyz, yohaneFragment_u_xlat16_6.xyz);
    yohaneFragment_u_xlat24 = yohaneFragment_u_xlat24 + 1.0;
    yohaneFragment_u_xlat16_23 = yohaneFragment_u_xlat24 * 0.5 + (-yohaneFragment_u_xlat21);
    yohaneFragment_u_xlat16_23 = uRimShadow * yohaneFragment_u_xlat16_23 + yohaneFragment_u_xlat21;
    yohaneFragment_u_xlat16_26 = dFdx(yohaneFragment_u_xlat16_23);
    yohaneFragment_u_xlat16_6.x = dFdy(yohaneFragment_u_xlat16_23);
    yohaneFragment_u_xlat16_26 = abs(yohaneFragment_u_xlat16_26) + abs(yohaneFragment_u_xlat16_6.x);
    yohaneFragment_u_xlat16_23 = yohaneFragment_u_xlat16_23 + (-uShadowThreshold);
    yohaneFragment_u_xlat16_26 = float(1.0) / yohaneFragment_u_xlat16_26;
    yohaneFragment_u_xlat16_23 = yohaneFragment_u_xlat16_23 * yohaneFragment_u_xlat16_26;
    yohaneFragment_u_xlat16_23 = clamp(yohaneFragment_u_xlat16_23, 0.0, 1.0);
    yohaneFragment_u_xlat16_26 = yohaneFragment_u_xlat16_23 * -2.0 + 3.0;
    yohaneFragment_u_xlat16_23 = yohaneFragment_u_xlat16_23 * yohaneFragment_u_xlat16_23;
    yohaneFragment_u_xlat16_23 = (-yohaneFragment_u_xlat16_26) * yohaneFragment_u_xlat16_23 + 1.0;
    yohaneFragment_u_xlat16_2.x = dot(yohaneFragment_u_xlat16_5.xyz, yohaneFragment_u_xlat16_2.xyz);
    yohaneFragment_u_xlat16_2.x = (-yohaneFragment_u_xlat16_2.x) + 1.0;
    yohaneFragment_u_xlat16_2.x = log2(abs(yohaneFragment_u_xlat16_2.x));
    yohaneFragment_u_xlat16_2.x = yohaneFragment_u_xlat16_2.x * uRimPower;
    yohaneFragment_u_xlat16_2.x = exp2(yohaneFragment_u_xlat16_2.x);
    yohaneFragment_u_xlat16_2.x = yohaneFragment_u_xlat16_2.x * yohaneFragment_u_xlat21 + -0.5;
    yohaneFragment_u_xlat16_2.x = yohaneFragment_u_xlat16_2.x * 50.0000496;
    yohaneFragment_u_xlat16_2.x = clamp(yohaneFragment_u_xlat16_2.x, 0.0, 1.0);
    yohaneFragment_u_xlat16_9 = yohaneFragment_u_xlat16_2.x * -2.0 + 3.0;
    yohaneFragment_u_xlat16_2.x = yohaneFragment_u_xlat16_2.x * yohaneFragment_u_xlat16_2.x;
    yohaneFragment_u_xlat16_2.x = yohaneFragment_u_xlat16_2.x * yohaneFragment_u_xlat16_9;
    yohaneFragment_u_xlat16_5.xyz = uYohaneMainLightColor.xyz * uRimLightColor.xyz;
    yohaneFragment_u_xlat16_2.xyz = yohaneFragment_u_xlat16_5.xyz * yohaneFragment_u_xlat16_2.xxx + uYohaneMainLightColor.xyz;
    yohaneFragment_u_xlat16_5.xyz = (-yohaneFragment_u_xlat16_0.xyz) * uBaseColor.xyz + yohaneFragment_u_xlat16_3.xyz;
    yohaneFragment_u_xlat16_5.xyz = vec3(yohaneFragment_u_xlat16_23) * yohaneFragment_u_xlat16_5.xyz + yohaneFragment_u_xlat1.xyz;
    yohaneFragment_u_xlat16_2.xyz = yohaneFragment_u_xlat16_2.xyz * yohaneFragment_u_xlat16_5.xyz;
    yohaneFragment_u_xlatb0 = uSpecularHighlights==0.0;
    if(yohaneFragment_u_xlatb0){
        yohaneFragment_u_xlat16_0.xyz = yohaneSampleTexture(uSpecGlossMap, yohaneVarying_vs_TEXCOORD0.xy, uYohaneGlobalMipBias.x).xyz;
        yohaneFragment_u_xlat16_5.xyz = yohaneFragment_u_xlat16_0.xyz * vec3(yohaneFragment_u_xlat21);
        yohaneFragment_u_xlat16_2.xyz = yohaneFragment_u_xlat16_5.xyz * uSpecColor.xyz + yohaneFragment_u_xlat16_2.xyz;
    }
    yohaneFragment_SV_Target0.xyz = yohaneFragment_u_xlat16_2.xyz;
    yohaneFragment_SV_Target0.w = yohaneFragment_u_xlat1.w;
    return;
}

// @end

// @section ForwardFront_ALPHATEST_ON_HAIRHIGHLIGHT_ON_fragmentBody
yohaneFragmentMain();
vec3 outgoingLight = yohaneFragment_SV_Target0.rgb;
diffuseColor.a = yohaneFragment_SV_Target0.a;
// @end

// @section ForwardBack_BASE_vertexPrelude
uniform vec4 uYohanehlslcc_mtx4x4unity_MatrixVP[4];
uniform vec4 uYohanehlslcc_mtx4x4unity_ObjectToWorld[4];
uniform vec4 uYohanehlslcc_mtx4x4unity_WorldToObject[4];
uniform vec4 uYohaneunity_LODFade;
uniform mediump vec4 uYohaneunity_WorldTransformParams;
uniform vec4 uYohaneunity_RenderingLayer;
uniform mediump vec4 uYohaneunity_LightData;
uniform mediump vec4 uYohaneunity_LightIndices[2];
uniform vec4 uYohaneunity_ProbesOcclusion;
uniform mediump vec4 uYohaneunity_SpecCube0_HDR;
uniform mediump vec4 uYohaneunity_SpecCube1_HDR;
uniform vec4 uYohaneunity_SpecCube0_BoxMax;
uniform vec4 uYohaneunity_SpecCube0_BoxMin;
uniform vec4 uYohaneunity_SpecCube0_ProbePosition;
uniform vec4 uYohaneunity_SpecCube1_BoxMax;
uniform vec4 uYohaneunity_SpecCube1_BoxMin;
uniform vec4 uYohaneunity_SpecCube1_ProbePosition;
uniform vec4 uYohaneunity_LightmapST;
uniform vec4 uYohaneunity_DynamicLightmapST;
uniform mediump vec4 uYohaneunity_SHAr;
uniform mediump vec4 uYohaneunity_SHAg;
uniform mediump vec4 uYohaneunity_SHAb;
uniform mediump vec4 uYohaneunity_SHBr;
uniform mediump vec4 uYohaneunity_SHBg;
uniform mediump vec4 uYohaneunity_SHBb;
uniform mediump vec4 uYohaneunity_SHC;
uniform vec4 uYohanehlslcc_mtx4x4unity_MatrixPreviousM[4];
uniform vec4 uYohanehlslcc_mtx4x4unity_MatrixPreviousMI[4];
uniform vec4 uYohaneunity_MotionVectorsParams;
uniform vec4 uBaseMap_TexelSize;
uniform vec4 uBaseMap_MipInfo;
uniform vec4 uBaseMap_ST;
uniform mediump vec4 uBaseColor;
uniform mediump vec4 uSpecColor;
uniform mediump vec4 uEmissionColor;
uniform mediump float uCutoff;
uniform mediump float uSurface;
uniform mediump float uSmoothness;
uniform mediump float uSpecularHighlights;
uniform float uAlphaClip;
uniform vec4 uSpecGlossMap_ST;
uniform float uSmoothnessSource;
uniform float uBumpScale;
uniform mediump vec4 uRimLightColor;
uniform mediump float uShadowThreshold;
uniform mediump float uRimShadow;
uniform mediump float uRimPower;
uniform vec4 uBaseMap2_TexelSize;
uniform vec4 uBaseMap2_MipInfo;
uniform vec4 uBaseMap2_ST;
uniform mediump vec4 uBaseColor2;
uniform mediump vec4 uSpecColor2;
uniform mediump vec4 uEmissionColor2;
uniform mediump float uSmoothness2;
uniform mediump float uSpecularHighlights2;
uniform vec4 uSpecGlossMap2_ST;
uniform float uSmoothnessSource2;
uniform float uBumpScale2;
uniform mediump vec4 uRimLightColor2;
uniform mediump float uShadowThreshold2;
uniform mediump float uRimPower2;
uniform mediump float uRimShadow2;
uniform mediump float uMaskThreshold;
uniform mediump vec4 uMaskHeightRange;
uniform mediump vec4 uBackFaceColor;
uniform uint uskinned_tex_height;
uniform uint uskinned_tex_width;
highp vec3 yohaneVertex_in_POSITION0;
highp vec3 yohaneVertex_in_NORMAL0;
highp vec2 yohaneVertex_in_TEXCOORD0;
varying highp vec2 yohaneVarying_vs_TEXCOORD0;
varying highp vec3 yohaneVarying_vs_TEXCOORD1;
varying mediump vec3 yohaneVarying_vs_TEXCOORD2;
vec3 yohaneVertex_u_xlat0;
vec4 yohaneVertex_u_xlat1;
float yohaneVertex_u_xlat6;
void yohaneVertexMain()
{
    yohaneVertex_u_xlat0.xyz = yohaneVertex_in_POSITION0.yyy * uYohanehlslcc_mtx4x4unity_ObjectToWorld[1].xyz;
    yohaneVertex_u_xlat0.xyz = uYohanehlslcc_mtx4x4unity_ObjectToWorld[0].xyz * yohaneVertex_in_POSITION0.xxx + yohaneVertex_u_xlat0.xyz;
    yohaneVertex_u_xlat0.xyz = uYohanehlslcc_mtx4x4unity_ObjectToWorld[2].xyz * yohaneVertex_in_POSITION0.zzz + yohaneVertex_u_xlat0.xyz;
    yohaneVertex_u_xlat0.xyz = yohaneVertex_u_xlat0.xyz + uYohanehlslcc_mtx4x4unity_ObjectToWorld[3].xyz;
    yohaneVertex_u_xlat1 = yohaneVertex_u_xlat0.yyyy * uYohanehlslcc_mtx4x4unity_MatrixVP[1];
    yohaneVertex_u_xlat1 = uYohanehlslcc_mtx4x4unity_MatrixVP[0] * yohaneVertex_u_xlat0.xxxx + yohaneVertex_u_xlat1;
    yohaneVertex_u_xlat1 = uYohanehlslcc_mtx4x4unity_MatrixVP[2] * yohaneVertex_u_xlat0.zzzz + yohaneVertex_u_xlat1;
    yohaneVarying_vs_TEXCOORD1.xyz = yohaneVertex_u_xlat0.xyz;
    gl_Position = yohaneVertex_u_xlat1 + uYohanehlslcc_mtx4x4unity_MatrixVP[3];
    yohaneVarying_vs_TEXCOORD0.xy = yohaneVertex_in_TEXCOORD0.xy * uBaseMap2_ST.xy + uBaseMap2_ST.zw;
    yohaneVertex_u_xlat0.x = dot(yohaneVertex_in_NORMAL0.xyz, uYohanehlslcc_mtx4x4unity_WorldToObject[0].xyz);
    yohaneVertex_u_xlat0.y = dot(yohaneVertex_in_NORMAL0.xyz, uYohanehlslcc_mtx4x4unity_WorldToObject[1].xyz);
    yohaneVertex_u_xlat0.z = dot(yohaneVertex_in_NORMAL0.xyz, uYohanehlslcc_mtx4x4unity_WorldToObject[2].xyz);
    yohaneVertex_u_xlat6 = dot(yohaneVertex_u_xlat0.xyz, yohaneVertex_u_xlat0.xyz);
    yohaneVertex_u_xlat6 = max(yohaneVertex_u_xlat6, 1.17549435e-38);
    yohaneVertex_u_xlat6 = inversesqrt(yohaneVertex_u_xlat6);
    yohaneVertex_u_xlat0.xyz = vec3(yohaneVertex_u_xlat6) * yohaneVertex_u_xlat0.xyz;
    yohaneVertex_u_xlat6 = dot(yohaneVertex_u_xlat0.xyz, yohaneVertex_u_xlat0.xyz);
    yohaneVertex_u_xlat6 = inversesqrt(yohaneVertex_u_xlat6);
    yohaneVertex_u_xlat0.xyz = vec3(yohaneVertex_u_xlat6) * yohaneVertex_u_xlat0.xyz;
    yohaneVarying_vs_TEXCOORD2.xyz = yohaneVertex_u_xlat0.xyz;
    return;
}

// @end

// @section ForwardBack_BASE_vertexProject
yohaneVertex_in_POSITION0 = vec3(-transformed.x, transformed.yz);
yohaneVertex_in_NORMAL0 = vec3(-objectNormal.x, objectNormal.yz);
yohaneVertex_in_TEXCOORD0 = vec2(uv.x, 1.0 - uv.y);
yohaneVertexMain();
// @end

// @section ForwardBack_BASE_fragmentPrelude
uniform vec4 uYohaneMainLightPosition;
uniform mediump vec4 uYohaneMainLightColor;
uniform vec3 uYohaneWorldSpaceCameraPos;
uniform vec2 uYohaneGlobalMipBias;
uniform vec4 uYohaneunity_OrthoParams;
uniform vec4 uYohanehlslcc_mtx4x4unity_MatrixV[4];
uniform vec4 uYohanehlslcc_mtx4x4unity_ObjectToWorld[4];
uniform vec4 uYohanehlslcc_mtx4x4unity_WorldToObject[4];
uniform vec4 uYohaneunity_LODFade;
uniform mediump vec4 uYohaneunity_WorldTransformParams;
uniform vec4 uYohaneunity_RenderingLayer;
uniform mediump vec4 uYohaneunity_LightData;
uniform mediump vec4 uYohaneunity_LightIndices[2];
uniform vec4 uYohaneunity_ProbesOcclusion;
uniform mediump vec4 uYohaneunity_SpecCube0_HDR;
uniform mediump vec4 uYohaneunity_SpecCube1_HDR;
uniform vec4 uYohaneunity_SpecCube0_BoxMax;
uniform vec4 uYohaneunity_SpecCube0_BoxMin;
uniform vec4 uYohaneunity_SpecCube0_ProbePosition;
uniform vec4 uYohaneunity_SpecCube1_BoxMax;
uniform vec4 uYohaneunity_SpecCube1_BoxMin;
uniform vec4 uYohaneunity_SpecCube1_ProbePosition;
uniform vec4 uYohaneunity_LightmapST;
uniform vec4 uYohaneunity_DynamicLightmapST;
uniform mediump vec4 uYohaneunity_SHAr;
uniform mediump vec4 uYohaneunity_SHAg;
uniform mediump vec4 uYohaneunity_SHAb;
uniform mediump vec4 uYohaneunity_SHBr;
uniform mediump vec4 uYohaneunity_SHBg;
uniform mediump vec4 uYohaneunity_SHBb;
uniform mediump vec4 uYohaneunity_SHC;
uniform vec4 uYohanehlslcc_mtx4x4unity_MatrixPreviousM[4];
uniform vec4 uYohanehlslcc_mtx4x4unity_MatrixPreviousMI[4];
uniform vec4 uYohaneunity_MotionVectorsParams;
uniform vec4 uBaseMap_TexelSize;
uniform vec4 uBaseMap_MipInfo;
uniform vec4 uBaseMap_ST;
uniform mediump vec4 uBaseColor;
uniform mediump vec4 uSpecColor;
uniform mediump vec4 uEmissionColor;
uniform mediump float uCutoff;
uniform mediump float uSurface;
uniform mediump float uSmoothness;
uniform mediump float uSpecularHighlights;
uniform float uAlphaClip;
uniform vec4 uSpecGlossMap_ST;
uniform float uSmoothnessSource;
uniform float uBumpScale;
uniform mediump vec4 uRimLightColor;
uniform mediump float uShadowThreshold;
uniform mediump float uRimShadow;
uniform mediump float uRimPower;
uniform vec4 uBaseMap2_TexelSize;
uniform vec4 uBaseMap2_MipInfo;
uniform vec4 uBaseMap2_ST;
uniform mediump vec4 uBaseColor2;
uniform mediump vec4 uSpecColor2;
uniform mediump vec4 uEmissionColor2;
uniform mediump float uSmoothness2;
uniform mediump float uSpecularHighlights2;
uniform vec4 uSpecGlossMap2_ST;
uniform float uSmoothnessSource2;
uniform float uBumpScale2;
uniform mediump vec4 uRimLightColor2;
uniform mediump float uShadowThreshold2;
uniform mediump float uRimPower2;
uniform mediump float uRimShadow2;
uniform mediump float uMaskThreshold;
uniform mediump vec4 uMaskHeightRange;
uniform mediump vec4 uBackFaceColor;
uniform uint uskinned_tex_height;
uniform uint uskinned_tex_width;
uniform mediump sampler2D uBaseMap2;
uniform mediump sampler2D uSpecGlossMap2;
uniform mediump sampler2D uShadowColorMap2;
varying highp vec2 yohaneVarying_vs_TEXCOORD0;
varying highp vec3 yohaneVarying_vs_TEXCOORD1;
varying mediump vec3 yohaneVarying_vs_TEXCOORD2;
mediump vec4 yohaneFragment_SV_Target0;
vec3 yohaneFragment_u_xlat0;
mediump vec4 yohaneFragment_u_xlat16_0;
bool yohaneFragment_u_xlatb0;
vec4 yohaneFragment_u_xlat1;
mediump vec3 yohaneFragment_u_xlat16_2;
vec3 yohaneFragment_u_xlat3;
mediump vec3 yohaneFragment_u_xlat16_4;
mediump vec3 yohaneFragment_u_xlat16_5;
mediump vec3 yohaneFragment_u_xlat16_6;
float yohaneFragment_u_xlat21;
bool yohaneFragment_u_xlatb21;
float yohaneFragment_u_xlat23;
mediump float yohaneFragment_u_xlat16_25;
mediump float yohaneFragment_u_xlat16_26;
vec4 yohaneSampleTexture(sampler2D image, vec2 coord) { return texture(image, vec2(coord.x, 1.0 - coord.y)); }
vec4 yohaneSampleTexture(sampler2D image, vec2 coord, float bias) { return texture(image, vec2(coord.x, 1.0 - coord.y), bias); }

void yohaneFragmentMain()
{
    yohaneFragment_u_xlat16_0 = yohaneSampleTexture(uBaseMap2, yohaneVarying_vs_TEXCOORD0.xy, uYohaneGlobalMipBias.x);
    yohaneFragment_u_xlat1 = yohaneFragment_u_xlat16_0 * uBaseColor2;
    yohaneFragment_u_xlat16_2.xyz = yohaneSampleTexture(uShadowColorMap2, yohaneVarying_vs_TEXCOORD0.xy, uYohaneGlobalMipBias.x).xyz;
    yohaneFragment_u_xlatb21 = uYohaneunity_OrthoParams.w==0.0;
    yohaneFragment_u_xlat3.xyz = (-yohaneVarying_vs_TEXCOORD1.xyz) + uYohaneWorldSpaceCameraPos.xyz;
    yohaneFragment_u_xlat23 = dot(yohaneFragment_u_xlat3.xyz, yohaneFragment_u_xlat3.xyz);
    yohaneFragment_u_xlat23 = inversesqrt(yohaneFragment_u_xlat23);
    yohaneFragment_u_xlat3.xyz = vec3(yohaneFragment_u_xlat23) * yohaneFragment_u_xlat3.xyz;
    yohaneFragment_u_xlat16_4.x = (yohaneFragment_u_xlatb21) ? yohaneFragment_u_xlat3.x : uYohanehlslcc_mtx4x4unity_MatrixV[0].z;
    yohaneFragment_u_xlat16_4.y = (yohaneFragment_u_xlatb21) ? yohaneFragment_u_xlat3.y : uYohanehlslcc_mtx4x4unity_MatrixV[1].z;
    yohaneFragment_u_xlat16_4.z = (yohaneFragment_u_xlatb21) ? yohaneFragment_u_xlat3.z : uYohanehlslcc_mtx4x4unity_MatrixV[2].z;
    yohaneFragment_u_xlat16_25 = dot(yohaneVarying_vs_TEXCOORD2.xyz, yohaneVarying_vs_TEXCOORD2.xyz);
    yohaneFragment_u_xlat16_25 = inversesqrt(yohaneFragment_u_xlat16_25);
    yohaneFragment_u_xlat16_5.xyz = vec3(yohaneFragment_u_xlat16_25) * yohaneVarying_vs_TEXCOORD2.xyz;
    yohaneFragment_u_xlat16_25 = dot(yohaneFragment_u_xlat16_5.xyz, uYohaneMainLightPosition.xyz);
    yohaneFragment_u_xlat16_25 = yohaneFragment_u_xlat16_25 + 1.0;
    yohaneFragment_u_xlat16_25 = yohaneFragment_u_xlat16_25 * 0.5;
    yohaneFragment_u_xlat21 = min(uYohaneunity_LightData.z, 1.0);
    yohaneFragment_u_xlat21 = yohaneFragment_u_xlat21 * yohaneFragment_u_xlat16_25;
    yohaneFragment_u_xlat16_6.xyz = (-yohaneFragment_u_xlat16_4.xyz) + (-uYohaneMainLightPosition.xyz);
    yohaneFragment_u_xlat16_6.xyz = vec3(vec3(uRimShadow2, uRimShadow2, uRimShadow2)) * yohaneFragment_u_xlat16_6.xyz + uYohaneMainLightPosition.xyz;
    yohaneFragment_u_xlat23 = dot(yohaneFragment_u_xlat16_5.xyz, yohaneFragment_u_xlat16_6.xyz);
    yohaneFragment_u_xlat23 = yohaneFragment_u_xlat23 + 1.0;
    yohaneFragment_u_xlat16_25 = yohaneFragment_u_xlat23 * 0.5 + (-yohaneFragment_u_xlat21);
    yohaneFragment_u_xlat16_25 = uRimShadow2 * yohaneFragment_u_xlat16_25 + yohaneFragment_u_xlat21;
    yohaneFragment_u_xlat16_26 = dFdx(yohaneFragment_u_xlat16_25);
    yohaneFragment_u_xlat16_6.x = dFdy(yohaneFragment_u_xlat16_25);
    yohaneFragment_u_xlat16_26 = abs(yohaneFragment_u_xlat16_26) + abs(yohaneFragment_u_xlat16_6.x);
    yohaneFragment_u_xlat16_25 = yohaneFragment_u_xlat16_25 + (-uShadowThreshold2);
    yohaneFragment_u_xlat16_26 = float(1.0) / yohaneFragment_u_xlat16_26;
    yohaneFragment_u_xlat16_25 = yohaneFragment_u_xlat16_25 * yohaneFragment_u_xlat16_26;
    yohaneFragment_u_xlat16_25 = clamp(yohaneFragment_u_xlat16_25, 0.0, 1.0);
    yohaneFragment_u_xlat16_26 = yohaneFragment_u_xlat16_25 * -2.0 + 3.0;
    yohaneFragment_u_xlat16_25 = yohaneFragment_u_xlat16_25 * yohaneFragment_u_xlat16_25;
    yohaneFragment_u_xlat16_25 = (-yohaneFragment_u_xlat16_26) * yohaneFragment_u_xlat16_25 + 1.0;
    yohaneFragment_u_xlat16_6.xyz = (-yohaneFragment_u_xlat16_0.xyz) * uBaseColor2.xyz + yohaneFragment_u_xlat16_2.xyz;
    yohaneFragment_u_xlat16_6.xyz = vec3(yohaneFragment_u_xlat16_25) * yohaneFragment_u_xlat16_6.xyz + yohaneFragment_u_xlat1.xyz;
    yohaneFragment_u_xlat16_6.xyz = yohaneFragment_u_xlat16_6.xyz * uYohaneMainLightColor.xyz;
    yohaneFragment_u_xlatb0 = uSpecularHighlights2==0.0;
    if(yohaneFragment_u_xlatb0){
        yohaneFragment_u_xlat16_0.xyz = yohaneSampleTexture(uSpecGlossMap2, yohaneVarying_vs_TEXCOORD0.xy, uYohaneGlobalMipBias.x).xyz;
        yohaneFragment_u_xlat16_25 = uSmoothness * 10.0 + 1.0;
        yohaneFragment_u_xlat16_25 = exp2(yohaneFragment_u_xlat16_25);
        yohaneFragment_u_xlat1.xyz = yohaneFragment_u_xlat16_4.xyz + uYohaneMainLightPosition.xyz;
        yohaneFragment_u_xlat21 = dot(yohaneFragment_u_xlat1.xyz, yohaneFragment_u_xlat1.xyz);
        yohaneFragment_u_xlat21 = max(yohaneFragment_u_xlat21, 1.17549435e-38);
        yohaneFragment_u_xlat21 = inversesqrt(yohaneFragment_u_xlat21);
        yohaneFragment_u_xlat1.xyz = vec3(yohaneFragment_u_xlat21) * yohaneFragment_u_xlat1.xyz;
        yohaneFragment_u_xlat21 = dot(yohaneFragment_u_xlat16_5.xyz, yohaneFragment_u_xlat1.xyz);
        yohaneFragment_u_xlat21 = clamp(yohaneFragment_u_xlat21, 0.0, 1.0);
        yohaneFragment_u_xlat16_4.x = log2(yohaneFragment_u_xlat21);
        yohaneFragment_u_xlat16_4.x = yohaneFragment_u_xlat16_4.x * yohaneFragment_u_xlat16_25;
        yohaneFragment_u_xlat16_4.x = exp2(yohaneFragment_u_xlat16_4.x);
        yohaneFragment_u_xlat16_4.xyz = yohaneFragment_u_xlat16_0.xyz * yohaneFragment_u_xlat16_4.xxx;
        yohaneFragment_u_xlat0.xyz = yohaneFragment_u_xlat16_4.xyz * uYohaneMainLightColor.xyz;
        yohaneFragment_u_xlat16_6.xyz = yohaneFragment_u_xlat0.xyz * uSpecColor.xyz + yohaneFragment_u_xlat16_6.xyz;
    }
    yohaneFragment_SV_Target0.xyz = yohaneFragment_u_xlat16_6.xyz;
    yohaneFragment_SV_Target0.w = yohaneFragment_u_xlat1.w;
    return;
}

// @end

// @section ForwardBack_BASE_fragmentBody
yohaneFragmentMain();
vec3 outgoingLight = yohaneFragment_SV_Target0.rgb;
diffuseColor.a = yohaneFragment_SV_Target0.a;
// @end

// @section ForwardBack_HAIRHIGHLIGHT_ON_vertexPrelude
uniform vec4 uYohanehlslcc_mtx4x4unity_MatrixVP[4];
uniform vec4 uYohanehlslcc_mtx4x4unity_ObjectToWorld[4];
uniform vec4 uYohanehlslcc_mtx4x4unity_WorldToObject[4];
uniform vec4 uYohaneunity_LODFade;
uniform mediump vec4 uYohaneunity_WorldTransformParams;
uniform vec4 uYohaneunity_RenderingLayer;
uniform mediump vec4 uYohaneunity_LightData;
uniform mediump vec4 uYohaneunity_LightIndices[2];
uniform vec4 uYohaneunity_ProbesOcclusion;
uniform mediump vec4 uYohaneunity_SpecCube0_HDR;
uniform mediump vec4 uYohaneunity_SpecCube1_HDR;
uniform vec4 uYohaneunity_SpecCube0_BoxMax;
uniform vec4 uYohaneunity_SpecCube0_BoxMin;
uniform vec4 uYohaneunity_SpecCube0_ProbePosition;
uniform vec4 uYohaneunity_SpecCube1_BoxMax;
uniform vec4 uYohaneunity_SpecCube1_BoxMin;
uniform vec4 uYohaneunity_SpecCube1_ProbePosition;
uniform vec4 uYohaneunity_LightmapST;
uniform vec4 uYohaneunity_DynamicLightmapST;
uniform mediump vec4 uYohaneunity_SHAr;
uniform mediump vec4 uYohaneunity_SHAg;
uniform mediump vec4 uYohaneunity_SHAb;
uniform mediump vec4 uYohaneunity_SHBr;
uniform mediump vec4 uYohaneunity_SHBg;
uniform mediump vec4 uYohaneunity_SHBb;
uniform mediump vec4 uYohaneunity_SHC;
uniform vec4 uYohanehlslcc_mtx4x4unity_MatrixPreviousM[4];
uniform vec4 uYohanehlslcc_mtx4x4unity_MatrixPreviousMI[4];
uniform vec4 uYohaneunity_MotionVectorsParams;
uniform vec4 uBaseMap_TexelSize;
uniform vec4 uBaseMap_MipInfo;
uniform vec4 uBaseMap_ST;
uniform mediump vec4 uBaseColor;
uniform mediump vec4 uSpecColor;
uniform mediump vec4 uEmissionColor;
uniform mediump float uCutoff;
uniform mediump float uSurface;
uniform mediump float uSmoothness;
uniform mediump float uSpecularHighlights;
uniform float uAlphaClip;
uniform vec4 uSpecGlossMap_ST;
uniform float uSmoothnessSource;
uniform float uBumpScale;
uniform mediump vec4 uRimLightColor;
uniform mediump float uShadowThreshold;
uniform mediump float uRimShadow;
uniform mediump float uRimPower;
uniform vec4 uBaseMap2_TexelSize;
uniform vec4 uBaseMap2_MipInfo;
uniform vec4 uBaseMap2_ST;
uniform mediump vec4 uBaseColor2;
uniform mediump vec4 uSpecColor2;
uniform mediump vec4 uEmissionColor2;
uniform mediump float uSmoothness2;
uniform mediump float uSpecularHighlights2;
uniform vec4 uSpecGlossMap2_ST;
uniform float uSmoothnessSource2;
uniform float uBumpScale2;
uniform mediump vec4 uRimLightColor2;
uniform mediump float uShadowThreshold2;
uniform mediump float uRimPower2;
uniform mediump float uRimShadow2;
uniform mediump float uMaskThreshold;
uniform mediump vec4 uMaskHeightRange;
uniform mediump vec4 uBackFaceColor;
uniform uint uskinned_tex_height;
uniform uint uskinned_tex_width;
highp vec3 yohaneVertex_in_POSITION0;
highp vec3 yohaneVertex_in_NORMAL0;
highp vec2 yohaneVertex_in_TEXCOORD0;
varying highp vec2 yohaneVarying_vs_TEXCOORD0;
varying highp vec3 yohaneVarying_vs_TEXCOORD1;
varying mediump vec3 yohaneVarying_vs_TEXCOORD2;
vec3 yohaneVertex_u_xlat0;
vec4 yohaneVertex_u_xlat1;
float yohaneVertex_u_xlat6;
void yohaneVertexMain()
{
    yohaneVertex_u_xlat0.xyz = yohaneVertex_in_POSITION0.yyy * uYohanehlslcc_mtx4x4unity_ObjectToWorld[1].xyz;
    yohaneVertex_u_xlat0.xyz = uYohanehlslcc_mtx4x4unity_ObjectToWorld[0].xyz * yohaneVertex_in_POSITION0.xxx + yohaneVertex_u_xlat0.xyz;
    yohaneVertex_u_xlat0.xyz = uYohanehlslcc_mtx4x4unity_ObjectToWorld[2].xyz * yohaneVertex_in_POSITION0.zzz + yohaneVertex_u_xlat0.xyz;
    yohaneVertex_u_xlat0.xyz = yohaneVertex_u_xlat0.xyz + uYohanehlslcc_mtx4x4unity_ObjectToWorld[3].xyz;
    yohaneVertex_u_xlat1 = yohaneVertex_u_xlat0.yyyy * uYohanehlslcc_mtx4x4unity_MatrixVP[1];
    yohaneVertex_u_xlat1 = uYohanehlslcc_mtx4x4unity_MatrixVP[0] * yohaneVertex_u_xlat0.xxxx + yohaneVertex_u_xlat1;
    yohaneVertex_u_xlat1 = uYohanehlslcc_mtx4x4unity_MatrixVP[2] * yohaneVertex_u_xlat0.zzzz + yohaneVertex_u_xlat1;
    yohaneVarying_vs_TEXCOORD1.xyz = yohaneVertex_u_xlat0.xyz;
    gl_Position = yohaneVertex_u_xlat1 + uYohanehlslcc_mtx4x4unity_MatrixVP[3];
    yohaneVarying_vs_TEXCOORD0.xy = yohaneVertex_in_TEXCOORD0.xy * uBaseMap2_ST.xy + uBaseMap2_ST.zw;
    yohaneVertex_u_xlat0.x = dot(yohaneVertex_in_NORMAL0.xyz, uYohanehlslcc_mtx4x4unity_WorldToObject[0].xyz);
    yohaneVertex_u_xlat0.y = dot(yohaneVertex_in_NORMAL0.xyz, uYohanehlslcc_mtx4x4unity_WorldToObject[1].xyz);
    yohaneVertex_u_xlat0.z = dot(yohaneVertex_in_NORMAL0.xyz, uYohanehlslcc_mtx4x4unity_WorldToObject[2].xyz);
    yohaneVertex_u_xlat6 = dot(yohaneVertex_u_xlat0.xyz, yohaneVertex_u_xlat0.xyz);
    yohaneVertex_u_xlat6 = max(yohaneVertex_u_xlat6, 1.17549435e-38);
    yohaneVertex_u_xlat6 = inversesqrt(yohaneVertex_u_xlat6);
    yohaneVertex_u_xlat0.xyz = vec3(yohaneVertex_u_xlat6) * yohaneVertex_u_xlat0.xyz;
    yohaneVertex_u_xlat6 = dot(yohaneVertex_u_xlat0.xyz, yohaneVertex_u_xlat0.xyz);
    yohaneVertex_u_xlat6 = inversesqrt(yohaneVertex_u_xlat6);
    yohaneVertex_u_xlat0.xyz = vec3(yohaneVertex_u_xlat6) * yohaneVertex_u_xlat0.xyz;
    yohaneVarying_vs_TEXCOORD2.xyz = yohaneVertex_u_xlat0.xyz;
    return;
}

// @end

// @section ForwardBack_HAIRHIGHLIGHT_ON_vertexProject
yohaneVertex_in_POSITION0 = vec3(-transformed.x, transformed.yz);
yohaneVertex_in_NORMAL0 = vec3(-objectNormal.x, objectNormal.yz);
yohaneVertex_in_TEXCOORD0 = vec2(uv.x, 1.0 - uv.y);
yohaneVertexMain();
// @end

// @section ForwardBack_HAIRHIGHLIGHT_ON_fragmentPrelude
uniform vec4 uYohaneMainLightPosition;
uniform mediump vec4 uYohaneMainLightColor;
uniform vec3 uYohaneWorldSpaceCameraPos;
uniform vec2 uYohaneGlobalMipBias;
uniform vec4 uYohaneunity_OrthoParams;
uniform vec4 uYohanehlslcc_mtx4x4unity_MatrixV[4];
uniform vec4 uYohanehlslcc_mtx4x4unity_ObjectToWorld[4];
uniform vec4 uYohanehlslcc_mtx4x4unity_WorldToObject[4];
uniform vec4 uYohaneunity_LODFade;
uniform mediump vec4 uYohaneunity_WorldTransformParams;
uniform vec4 uYohaneunity_RenderingLayer;
uniform mediump vec4 uYohaneunity_LightData;
uniform mediump vec4 uYohaneunity_LightIndices[2];
uniform vec4 uYohaneunity_ProbesOcclusion;
uniform mediump vec4 uYohaneunity_SpecCube0_HDR;
uniform mediump vec4 uYohaneunity_SpecCube1_HDR;
uniform vec4 uYohaneunity_SpecCube0_BoxMax;
uniform vec4 uYohaneunity_SpecCube0_BoxMin;
uniform vec4 uYohaneunity_SpecCube0_ProbePosition;
uniform vec4 uYohaneunity_SpecCube1_BoxMax;
uniform vec4 uYohaneunity_SpecCube1_BoxMin;
uniform vec4 uYohaneunity_SpecCube1_ProbePosition;
uniform vec4 uYohaneunity_LightmapST;
uniform vec4 uYohaneunity_DynamicLightmapST;
uniform mediump vec4 uYohaneunity_SHAr;
uniform mediump vec4 uYohaneunity_SHAg;
uniform mediump vec4 uYohaneunity_SHAb;
uniform mediump vec4 uYohaneunity_SHBr;
uniform mediump vec4 uYohaneunity_SHBg;
uniform mediump vec4 uYohaneunity_SHBb;
uniform mediump vec4 uYohaneunity_SHC;
uniform vec4 uYohanehlslcc_mtx4x4unity_MatrixPreviousM[4];
uniform vec4 uYohanehlslcc_mtx4x4unity_MatrixPreviousMI[4];
uniform vec4 uYohaneunity_MotionVectorsParams;
uniform vec4 uBaseMap_TexelSize;
uniform vec4 uBaseMap_MipInfo;
uniform vec4 uBaseMap_ST;
uniform mediump vec4 uBaseColor;
uniform mediump vec4 uSpecColor;
uniform mediump vec4 uEmissionColor;
uniform mediump float uCutoff;
uniform mediump float uSurface;
uniform mediump float uSmoothness;
uniform mediump float uSpecularHighlights;
uniform float uAlphaClip;
uniform vec4 uSpecGlossMap_ST;
uniform float uSmoothnessSource;
uniform float uBumpScale;
uniform mediump vec4 uRimLightColor;
uniform mediump float uShadowThreshold;
uniform mediump float uRimShadow;
uniform mediump float uRimPower;
uniform vec4 uBaseMap2_TexelSize;
uniform vec4 uBaseMap2_MipInfo;
uniform vec4 uBaseMap2_ST;
uniform mediump vec4 uBaseColor2;
uniform mediump vec4 uSpecColor2;
uniform mediump vec4 uEmissionColor2;
uniform mediump float uSmoothness2;
uniform mediump float uSpecularHighlights2;
uniform vec4 uSpecGlossMap2_ST;
uniform float uSmoothnessSource2;
uniform float uBumpScale2;
uniform mediump vec4 uRimLightColor2;
uniform mediump float uShadowThreshold2;
uniform mediump float uRimPower2;
uniform mediump float uRimShadow2;
uniform mediump float uMaskThreshold;
uniform mediump vec4 uMaskHeightRange;
uniform mediump vec4 uBackFaceColor;
uniform uint uskinned_tex_height;
uniform uint uskinned_tex_width;
uniform mediump sampler2D uBaseMap2;
uniform mediump sampler2D uSpecGlossMap2;
uniform mediump sampler2D uShadowColorMap2;
varying highp vec2 yohaneVarying_vs_TEXCOORD0;
varying highp vec3 yohaneVarying_vs_TEXCOORD1;
varying mediump vec3 yohaneVarying_vs_TEXCOORD2;
mediump vec4 yohaneFragment_SV_Target0;
mediump vec4 yohaneFragment_u_xlat16_0;
bool yohaneFragment_u_xlatb0;
vec4 yohaneFragment_u_xlat1;
mediump vec3 yohaneFragment_u_xlat16_2;
vec3 yohaneFragment_u_xlat3;
mediump vec3 yohaneFragment_u_xlat16_4;
mediump vec3 yohaneFragment_u_xlat16_5;
mediump vec3 yohaneFragment_u_xlat16_6;
mediump float yohaneFragment_u_xlat16_11;
float yohaneFragment_u_xlat21;
bool yohaneFragment_u_xlatb21;
float yohaneFragment_u_xlat23;
mediump float yohaneFragment_u_xlat16_25;
mediump float yohaneFragment_u_xlat16_26;
vec4 yohaneSampleTexture(sampler2D image, vec2 coord) { return texture(image, vec2(coord.x, 1.0 - coord.y)); }
vec4 yohaneSampleTexture(sampler2D image, vec2 coord, float bias) { return texture(image, vec2(coord.x, 1.0 - coord.y), bias); }

void yohaneFragmentMain()
{
    yohaneFragment_u_xlat16_0 = yohaneSampleTexture(uBaseMap2, yohaneVarying_vs_TEXCOORD0.xy, uYohaneGlobalMipBias.x);
    yohaneFragment_u_xlat1 = yohaneFragment_u_xlat16_0 * uBaseColor2;
    yohaneFragment_u_xlat16_2.xyz = yohaneSampleTexture(uShadowColorMap2, yohaneVarying_vs_TEXCOORD0.xy, uYohaneGlobalMipBias.x).xyz;
    yohaneFragment_u_xlatb21 = uYohaneunity_OrthoParams.w==0.0;
    yohaneFragment_u_xlat3.xyz = (-yohaneVarying_vs_TEXCOORD1.xyz) + uYohaneWorldSpaceCameraPos.xyz;
    yohaneFragment_u_xlat23 = dot(yohaneFragment_u_xlat3.xyz, yohaneFragment_u_xlat3.xyz);
    yohaneFragment_u_xlat23 = inversesqrt(yohaneFragment_u_xlat23);
    yohaneFragment_u_xlat3.xyz = vec3(yohaneFragment_u_xlat23) * yohaneFragment_u_xlat3.xyz;
    yohaneFragment_u_xlat16_4.x = (yohaneFragment_u_xlatb21) ? yohaneFragment_u_xlat3.x : uYohanehlslcc_mtx4x4unity_MatrixV[0].z;
    yohaneFragment_u_xlat16_4.y = (yohaneFragment_u_xlatb21) ? yohaneFragment_u_xlat3.y : uYohanehlslcc_mtx4x4unity_MatrixV[1].z;
    yohaneFragment_u_xlat16_4.z = (yohaneFragment_u_xlatb21) ? yohaneFragment_u_xlat3.z : uYohanehlslcc_mtx4x4unity_MatrixV[2].z;
    yohaneFragment_u_xlat16_25 = dot(yohaneVarying_vs_TEXCOORD2.xyz, yohaneVarying_vs_TEXCOORD2.xyz);
    yohaneFragment_u_xlat16_25 = inversesqrt(yohaneFragment_u_xlat16_25);
    yohaneFragment_u_xlat16_5.xyz = vec3(yohaneFragment_u_xlat16_25) * yohaneVarying_vs_TEXCOORD2.xyz;
    yohaneFragment_u_xlat16_25 = dot(yohaneFragment_u_xlat16_5.xyz, uYohaneMainLightPosition.xyz);
    yohaneFragment_u_xlat16_25 = yohaneFragment_u_xlat16_25 + 1.0;
    yohaneFragment_u_xlat16_25 = yohaneFragment_u_xlat16_25 * 0.5;
    yohaneFragment_u_xlat21 = min(uYohaneunity_LightData.z, 1.0);
    yohaneFragment_u_xlat21 = yohaneFragment_u_xlat21 * yohaneFragment_u_xlat16_25;
    yohaneFragment_u_xlat16_6.xyz = (-yohaneFragment_u_xlat16_4.xyz) + (-uYohaneMainLightPosition.xyz);
    yohaneFragment_u_xlat16_6.xyz = vec3(vec3(uRimShadow2, uRimShadow2, uRimShadow2)) * yohaneFragment_u_xlat16_6.xyz + uYohaneMainLightPosition.xyz;
    yohaneFragment_u_xlat23 = dot(yohaneFragment_u_xlat16_5.xyz, yohaneFragment_u_xlat16_6.xyz);
    yohaneFragment_u_xlat23 = yohaneFragment_u_xlat23 + 1.0;
    yohaneFragment_u_xlat16_25 = yohaneFragment_u_xlat23 * 0.5 + (-yohaneFragment_u_xlat21);
    yohaneFragment_u_xlat16_25 = uRimShadow2 * yohaneFragment_u_xlat16_25 + yohaneFragment_u_xlat21;
    yohaneFragment_u_xlat16_26 = dFdx(yohaneFragment_u_xlat16_25);
    yohaneFragment_u_xlat16_6.x = dFdy(yohaneFragment_u_xlat16_25);
    yohaneFragment_u_xlat16_26 = abs(yohaneFragment_u_xlat16_26) + abs(yohaneFragment_u_xlat16_6.x);
    yohaneFragment_u_xlat16_25 = yohaneFragment_u_xlat16_25 + (-uShadowThreshold2);
    yohaneFragment_u_xlat16_26 = float(1.0) / yohaneFragment_u_xlat16_26;
    yohaneFragment_u_xlat16_25 = yohaneFragment_u_xlat16_25 * yohaneFragment_u_xlat16_26;
    yohaneFragment_u_xlat16_25 = clamp(yohaneFragment_u_xlat16_25, 0.0, 1.0);
    yohaneFragment_u_xlat16_26 = yohaneFragment_u_xlat16_25 * -2.0 + 3.0;
    yohaneFragment_u_xlat16_25 = yohaneFragment_u_xlat16_25 * yohaneFragment_u_xlat16_25;
    yohaneFragment_u_xlat16_25 = (-yohaneFragment_u_xlat16_26) * yohaneFragment_u_xlat16_25 + 1.0;
    yohaneFragment_u_xlat16_4.x = dot(yohaneFragment_u_xlat16_5.xyz, yohaneFragment_u_xlat16_4.xyz);
    yohaneFragment_u_xlat16_4.x = (-yohaneFragment_u_xlat16_4.x) + 1.0;
    yohaneFragment_u_xlat16_4.x = log2(abs(yohaneFragment_u_xlat16_4.x));
    yohaneFragment_u_xlat16_4.x = yohaneFragment_u_xlat16_4.x * uRimPower2;
    yohaneFragment_u_xlat16_4.x = exp2(yohaneFragment_u_xlat16_4.x);
    yohaneFragment_u_xlat16_4.x = yohaneFragment_u_xlat16_4.x * yohaneFragment_u_xlat21 + -0.5;
    yohaneFragment_u_xlat16_4.x = yohaneFragment_u_xlat16_4.x * 50.0000496;
    yohaneFragment_u_xlat16_4.x = clamp(yohaneFragment_u_xlat16_4.x, 0.0, 1.0);
    yohaneFragment_u_xlat16_11 = yohaneFragment_u_xlat16_4.x * -2.0 + 3.0;
    yohaneFragment_u_xlat16_4.x = yohaneFragment_u_xlat16_4.x * yohaneFragment_u_xlat16_4.x;
    yohaneFragment_u_xlat16_4.x = yohaneFragment_u_xlat16_4.x * yohaneFragment_u_xlat16_11;
    yohaneFragment_u_xlat16_5.xyz = uYohaneMainLightColor.xyz * uRimLightColor2.xyz;
    yohaneFragment_u_xlat16_4.xyz = yohaneFragment_u_xlat16_5.xyz * yohaneFragment_u_xlat16_4.xxx + uYohaneMainLightColor.xyz;
    yohaneFragment_u_xlat16_5.xyz = (-yohaneFragment_u_xlat16_0.xyz) * uBaseColor2.xyz + yohaneFragment_u_xlat16_2.xyz;
    yohaneFragment_u_xlat16_5.xyz = vec3(yohaneFragment_u_xlat16_25) * yohaneFragment_u_xlat16_5.xyz + yohaneFragment_u_xlat1.xyz;
    yohaneFragment_u_xlat16_4.xyz = yohaneFragment_u_xlat16_4.xyz * yohaneFragment_u_xlat16_5.xyz;
    yohaneFragment_u_xlatb0 = uSpecularHighlights2==0.0;
    if(yohaneFragment_u_xlatb0){
        yohaneFragment_u_xlat16_0.xyz = yohaneSampleTexture(uSpecGlossMap2, yohaneVarying_vs_TEXCOORD0.xy, uYohaneGlobalMipBias.x).xyz;
        yohaneFragment_u_xlat16_5.xyz = yohaneFragment_u_xlat16_0.xyz * vec3(yohaneFragment_u_xlat21);
        yohaneFragment_u_xlat16_4.xyz = yohaneFragment_u_xlat16_5.xyz * uSpecColor.xyz + yohaneFragment_u_xlat16_4.xyz;
    }
    yohaneFragment_SV_Target0.xyz = yohaneFragment_u_xlat16_4.xyz;
    yohaneFragment_SV_Target0.w = yohaneFragment_u_xlat1.w;
    return;
}

// @end

// @section ForwardBack_HAIRHIGHLIGHT_ON_fragmentBody
yohaneFragmentMain();
vec3 outgoingLight = yohaneFragment_SV_Target0.rgb;
diffuseColor.a = yohaneFragment_SV_Target0.a;
// @end

// @section ForwardBack_ALPHATEST_ON_vertexPrelude
uniform vec4 uYohanehlslcc_mtx4x4unity_MatrixVP[4];
uniform vec4 uYohanehlslcc_mtx4x4unity_ObjectToWorld[4];
uniform vec4 uYohanehlslcc_mtx4x4unity_WorldToObject[4];
uniform vec4 uYohaneunity_LODFade;
uniform mediump vec4 uYohaneunity_WorldTransformParams;
uniform vec4 uYohaneunity_RenderingLayer;
uniform mediump vec4 uYohaneunity_LightData;
uniform mediump vec4 uYohaneunity_LightIndices[2];
uniform vec4 uYohaneunity_ProbesOcclusion;
uniform mediump vec4 uYohaneunity_SpecCube0_HDR;
uniform mediump vec4 uYohaneunity_SpecCube1_HDR;
uniform vec4 uYohaneunity_SpecCube0_BoxMax;
uniform vec4 uYohaneunity_SpecCube0_BoxMin;
uniform vec4 uYohaneunity_SpecCube0_ProbePosition;
uniform vec4 uYohaneunity_SpecCube1_BoxMax;
uniform vec4 uYohaneunity_SpecCube1_BoxMin;
uniform vec4 uYohaneunity_SpecCube1_ProbePosition;
uniform vec4 uYohaneunity_LightmapST;
uniform vec4 uYohaneunity_DynamicLightmapST;
uniform mediump vec4 uYohaneunity_SHAr;
uniform mediump vec4 uYohaneunity_SHAg;
uniform mediump vec4 uYohaneunity_SHAb;
uniform mediump vec4 uYohaneunity_SHBr;
uniform mediump vec4 uYohaneunity_SHBg;
uniform mediump vec4 uYohaneunity_SHBb;
uniform mediump vec4 uYohaneunity_SHC;
uniform vec4 uYohanehlslcc_mtx4x4unity_MatrixPreviousM[4];
uniform vec4 uYohanehlslcc_mtx4x4unity_MatrixPreviousMI[4];
uniform vec4 uYohaneunity_MotionVectorsParams;
uniform vec4 uBaseMap_TexelSize;
uniform vec4 uBaseMap_MipInfo;
uniform vec4 uBaseMap_ST;
uniform mediump vec4 uBaseColor;
uniform mediump vec4 uSpecColor;
uniform mediump vec4 uEmissionColor;
uniform mediump float uCutoff;
uniform mediump float uSurface;
uniform mediump float uSmoothness;
uniform mediump float uSpecularHighlights;
uniform float uAlphaClip;
uniform vec4 uSpecGlossMap_ST;
uniform float uSmoothnessSource;
uniform float uBumpScale;
uniform mediump vec4 uRimLightColor;
uniform mediump float uShadowThreshold;
uniform mediump float uRimShadow;
uniform mediump float uRimPower;
uniform vec4 uBaseMap2_TexelSize;
uniform vec4 uBaseMap2_MipInfo;
uniform vec4 uBaseMap2_ST;
uniform mediump vec4 uBaseColor2;
uniform mediump vec4 uSpecColor2;
uniform mediump vec4 uEmissionColor2;
uniform mediump float uSmoothness2;
uniform mediump float uSpecularHighlights2;
uniform vec4 uSpecGlossMap2_ST;
uniform float uSmoothnessSource2;
uniform float uBumpScale2;
uniform mediump vec4 uRimLightColor2;
uniform mediump float uShadowThreshold2;
uniform mediump float uRimPower2;
uniform mediump float uRimShadow2;
uniform mediump float uMaskThreshold;
uniform mediump vec4 uMaskHeightRange;
uniform mediump vec4 uBackFaceColor;
uniform uint uskinned_tex_height;
uniform uint uskinned_tex_width;
highp vec3 yohaneVertex_in_POSITION0;
highp vec3 yohaneVertex_in_NORMAL0;
highp vec2 yohaneVertex_in_TEXCOORD0;
varying highp vec2 yohaneVarying_vs_TEXCOORD0;
varying highp vec3 yohaneVarying_vs_TEXCOORD1;
varying mediump vec3 yohaneVarying_vs_TEXCOORD2;
vec3 yohaneVertex_u_xlat0;
vec4 yohaneVertex_u_xlat1;
float yohaneVertex_u_xlat6;
void yohaneVertexMain()
{
    yohaneVertex_u_xlat0.xyz = yohaneVertex_in_POSITION0.yyy * uYohanehlslcc_mtx4x4unity_ObjectToWorld[1].xyz;
    yohaneVertex_u_xlat0.xyz = uYohanehlslcc_mtx4x4unity_ObjectToWorld[0].xyz * yohaneVertex_in_POSITION0.xxx + yohaneVertex_u_xlat0.xyz;
    yohaneVertex_u_xlat0.xyz = uYohanehlslcc_mtx4x4unity_ObjectToWorld[2].xyz * yohaneVertex_in_POSITION0.zzz + yohaneVertex_u_xlat0.xyz;
    yohaneVertex_u_xlat0.xyz = yohaneVertex_u_xlat0.xyz + uYohanehlslcc_mtx4x4unity_ObjectToWorld[3].xyz;
    yohaneVertex_u_xlat1 = yohaneVertex_u_xlat0.yyyy * uYohanehlslcc_mtx4x4unity_MatrixVP[1];
    yohaneVertex_u_xlat1 = uYohanehlslcc_mtx4x4unity_MatrixVP[0] * yohaneVertex_u_xlat0.xxxx + yohaneVertex_u_xlat1;
    yohaneVertex_u_xlat1 = uYohanehlslcc_mtx4x4unity_MatrixVP[2] * yohaneVertex_u_xlat0.zzzz + yohaneVertex_u_xlat1;
    yohaneVarying_vs_TEXCOORD1.xyz = yohaneVertex_u_xlat0.xyz;
    gl_Position = yohaneVertex_u_xlat1 + uYohanehlslcc_mtx4x4unity_MatrixVP[3];
    yohaneVarying_vs_TEXCOORD0.xy = yohaneVertex_in_TEXCOORD0.xy * uBaseMap2_ST.xy + uBaseMap2_ST.zw;
    yohaneVertex_u_xlat0.x = dot(yohaneVertex_in_NORMAL0.xyz, uYohanehlslcc_mtx4x4unity_WorldToObject[0].xyz);
    yohaneVertex_u_xlat0.y = dot(yohaneVertex_in_NORMAL0.xyz, uYohanehlslcc_mtx4x4unity_WorldToObject[1].xyz);
    yohaneVertex_u_xlat0.z = dot(yohaneVertex_in_NORMAL0.xyz, uYohanehlslcc_mtx4x4unity_WorldToObject[2].xyz);
    yohaneVertex_u_xlat6 = dot(yohaneVertex_u_xlat0.xyz, yohaneVertex_u_xlat0.xyz);
    yohaneVertex_u_xlat6 = max(yohaneVertex_u_xlat6, 1.17549435e-38);
    yohaneVertex_u_xlat6 = inversesqrt(yohaneVertex_u_xlat6);
    yohaneVertex_u_xlat0.xyz = vec3(yohaneVertex_u_xlat6) * yohaneVertex_u_xlat0.xyz;
    yohaneVertex_u_xlat6 = dot(yohaneVertex_u_xlat0.xyz, yohaneVertex_u_xlat0.xyz);
    yohaneVertex_u_xlat6 = inversesqrt(yohaneVertex_u_xlat6);
    yohaneVertex_u_xlat0.xyz = vec3(yohaneVertex_u_xlat6) * yohaneVertex_u_xlat0.xyz;
    yohaneVarying_vs_TEXCOORD2.xyz = yohaneVertex_u_xlat0.xyz;
    return;
}

// @end

// @section ForwardBack_ALPHATEST_ON_vertexProject
yohaneVertex_in_POSITION0 = vec3(-transformed.x, transformed.yz);
yohaneVertex_in_NORMAL0 = vec3(-objectNormal.x, objectNormal.yz);
yohaneVertex_in_TEXCOORD0 = vec2(uv.x, 1.0 - uv.y);
yohaneVertexMain();
// @end

// @section ForwardBack_ALPHATEST_ON_fragmentPrelude
uniform vec4 uYohaneMainLightPosition;
uniform mediump vec4 uYohaneMainLightColor;
uniform vec3 uYohaneWorldSpaceCameraPos;
uniform vec2 uYohaneGlobalMipBias;
uniform vec4 uYohaneunity_OrthoParams;
uniform vec4 uYohanehlslcc_mtx4x4unity_MatrixV[4];
uniform vec4 uYohanehlslcc_mtx4x4unity_ObjectToWorld[4];
uniform vec4 uYohanehlslcc_mtx4x4unity_WorldToObject[4];
uniform vec4 uYohaneunity_LODFade;
uniform mediump vec4 uYohaneunity_WorldTransformParams;
uniform vec4 uYohaneunity_RenderingLayer;
uniform mediump vec4 uYohaneunity_LightData;
uniform mediump vec4 uYohaneunity_LightIndices[2];
uniform vec4 uYohaneunity_ProbesOcclusion;
uniform mediump vec4 uYohaneunity_SpecCube0_HDR;
uniform mediump vec4 uYohaneunity_SpecCube1_HDR;
uniform vec4 uYohaneunity_SpecCube0_BoxMax;
uniform vec4 uYohaneunity_SpecCube0_BoxMin;
uniform vec4 uYohaneunity_SpecCube0_ProbePosition;
uniform vec4 uYohaneunity_SpecCube1_BoxMax;
uniform vec4 uYohaneunity_SpecCube1_BoxMin;
uniform vec4 uYohaneunity_SpecCube1_ProbePosition;
uniform vec4 uYohaneunity_LightmapST;
uniform vec4 uYohaneunity_DynamicLightmapST;
uniform mediump vec4 uYohaneunity_SHAr;
uniform mediump vec4 uYohaneunity_SHAg;
uniform mediump vec4 uYohaneunity_SHAb;
uniform mediump vec4 uYohaneunity_SHBr;
uniform mediump vec4 uYohaneunity_SHBg;
uniform mediump vec4 uYohaneunity_SHBb;
uniform mediump vec4 uYohaneunity_SHC;
uniform vec4 uYohanehlslcc_mtx4x4unity_MatrixPreviousM[4];
uniform vec4 uYohanehlslcc_mtx4x4unity_MatrixPreviousMI[4];
uniform vec4 uYohaneunity_MotionVectorsParams;
uniform vec4 uBaseMap_TexelSize;
uniform vec4 uBaseMap_MipInfo;
uniform vec4 uBaseMap_ST;
uniform mediump vec4 uBaseColor;
uniform mediump vec4 uSpecColor;
uniform mediump vec4 uEmissionColor;
uniform mediump float uCutoff;
uniform mediump float uSurface;
uniform mediump float uSmoothness;
uniform mediump float uSpecularHighlights;
uniform float uAlphaClip;
uniform vec4 uSpecGlossMap_ST;
uniform float uSmoothnessSource;
uniform float uBumpScale;
uniform mediump vec4 uRimLightColor;
uniform mediump float uShadowThreshold;
uniform mediump float uRimShadow;
uniform mediump float uRimPower;
uniform vec4 uBaseMap2_TexelSize;
uniform vec4 uBaseMap2_MipInfo;
uniform vec4 uBaseMap2_ST;
uniform mediump vec4 uBaseColor2;
uniform mediump vec4 uSpecColor2;
uniform mediump vec4 uEmissionColor2;
uniform mediump float uSmoothness2;
uniform mediump float uSpecularHighlights2;
uniform vec4 uSpecGlossMap2_ST;
uniform float uSmoothnessSource2;
uniform float uBumpScale2;
uniform mediump vec4 uRimLightColor2;
uniform mediump float uShadowThreshold2;
uniform mediump float uRimPower2;
uniform mediump float uRimShadow2;
uniform mediump float uMaskThreshold;
uniform mediump vec4 uMaskHeightRange;
uniform mediump vec4 uBackFaceColor;
uniform uint uskinned_tex_height;
uniform uint uskinned_tex_width;
uniform mediump sampler2D uBaseMap2;
uniform mediump sampler2D uSpecGlossMap2;
uniform mediump sampler2D uShadowColorMap2;
varying highp vec2 yohaneVarying_vs_TEXCOORD0;
varying highp vec3 yohaneVarying_vs_TEXCOORD1;
varying mediump vec3 yohaneVarying_vs_TEXCOORD2;
mediump vec4 yohaneFragment_SV_Target0;
vec3 yohaneFragment_u_xlat0;
mediump vec4 yohaneFragment_u_xlat16_0;
bool yohaneFragment_u_xlatb0;
vec4 yohaneFragment_u_xlat1;
mediump vec3 yohaneFragment_u_xlat16_2;
mediump vec3 yohaneFragment_u_xlat16_3;
vec3 yohaneFragment_u_xlat4;
mediump vec3 yohaneFragment_u_xlat16_5;
mediump vec3 yohaneFragment_u_xlat16_6;
float yohaneFragment_u_xlat21;
bool yohaneFragment_u_xlatb21;
mediump float yohaneFragment_u_xlat16_23;
float yohaneFragment_u_xlat24;
mediump float yohaneFragment_u_xlat16_26;
vec4 yohaneSampleTexture(sampler2D image, vec2 coord) { return texture(image, vec2(coord.x, 1.0 - coord.y)); }
vec4 yohaneSampleTexture(sampler2D image, vec2 coord, float bias) { return texture(image, vec2(coord.x, 1.0 - coord.y), bias); }

void yohaneFragmentMain()
{
    yohaneFragment_u_xlat16_0 = yohaneSampleTexture(uBaseMap2, yohaneVarying_vs_TEXCOORD0.xy, uYohaneGlobalMipBias.x);
    yohaneFragment_u_xlat1 = yohaneFragment_u_xlat16_0 * uBaseColor2;
    yohaneFragment_u_xlat16_2.x = yohaneFragment_u_xlat16_0.w * uBaseColor2.w + (-uCutoff);
    yohaneFragment_u_xlatb21 = yohaneFragment_u_xlat16_2.x<0.0;
    if(yohaneFragment_u_xlatb21){discard;}
    yohaneFragment_u_xlat16_3.xyz = yohaneSampleTexture(uShadowColorMap2, yohaneVarying_vs_TEXCOORD0.xy, uYohaneGlobalMipBias.x).xyz;
    yohaneFragment_u_xlatb21 = uYohaneunity_OrthoParams.w==0.0;
    yohaneFragment_u_xlat4.xyz = (-yohaneVarying_vs_TEXCOORD1.xyz) + uYohaneWorldSpaceCameraPos.xyz;
    yohaneFragment_u_xlat24 = dot(yohaneFragment_u_xlat4.xyz, yohaneFragment_u_xlat4.xyz);
    yohaneFragment_u_xlat24 = inversesqrt(yohaneFragment_u_xlat24);
    yohaneFragment_u_xlat4.xyz = vec3(yohaneFragment_u_xlat24) * yohaneFragment_u_xlat4.xyz;
    yohaneFragment_u_xlat16_2.x = (yohaneFragment_u_xlatb21) ? yohaneFragment_u_xlat4.x : uYohanehlslcc_mtx4x4unity_MatrixV[0].z;
    yohaneFragment_u_xlat16_2.y = (yohaneFragment_u_xlatb21) ? yohaneFragment_u_xlat4.y : uYohanehlslcc_mtx4x4unity_MatrixV[1].z;
    yohaneFragment_u_xlat16_2.z = (yohaneFragment_u_xlatb21) ? yohaneFragment_u_xlat4.z : uYohanehlslcc_mtx4x4unity_MatrixV[2].z;
    yohaneFragment_u_xlat16_23 = dot(yohaneVarying_vs_TEXCOORD2.xyz, yohaneVarying_vs_TEXCOORD2.xyz);
    yohaneFragment_u_xlat16_23 = inversesqrt(yohaneFragment_u_xlat16_23);
    yohaneFragment_u_xlat16_5.xyz = vec3(yohaneFragment_u_xlat16_23) * yohaneVarying_vs_TEXCOORD2.xyz;
    yohaneFragment_u_xlat16_23 = dot(yohaneFragment_u_xlat16_5.xyz, uYohaneMainLightPosition.xyz);
    yohaneFragment_u_xlat16_23 = yohaneFragment_u_xlat16_23 + 1.0;
    yohaneFragment_u_xlat16_23 = yohaneFragment_u_xlat16_23 * 0.5;
    yohaneFragment_u_xlat21 = min(uYohaneunity_LightData.z, 1.0);
    yohaneFragment_u_xlat21 = yohaneFragment_u_xlat21 * yohaneFragment_u_xlat16_23;
    yohaneFragment_u_xlat16_6.xyz = (-yohaneFragment_u_xlat16_2.xyz) + (-uYohaneMainLightPosition.xyz);
    yohaneFragment_u_xlat16_6.xyz = vec3(vec3(uRimShadow2, uRimShadow2, uRimShadow2)) * yohaneFragment_u_xlat16_6.xyz + uYohaneMainLightPosition.xyz;
    yohaneFragment_u_xlat24 = dot(yohaneFragment_u_xlat16_5.xyz, yohaneFragment_u_xlat16_6.xyz);
    yohaneFragment_u_xlat24 = yohaneFragment_u_xlat24 + 1.0;
    yohaneFragment_u_xlat16_23 = yohaneFragment_u_xlat24 * 0.5 + (-yohaneFragment_u_xlat21);
    yohaneFragment_u_xlat16_23 = uRimShadow2 * yohaneFragment_u_xlat16_23 + yohaneFragment_u_xlat21;
    yohaneFragment_u_xlat16_26 = dFdx(yohaneFragment_u_xlat16_23);
    yohaneFragment_u_xlat16_6.x = dFdy(yohaneFragment_u_xlat16_23);
    yohaneFragment_u_xlat16_26 = abs(yohaneFragment_u_xlat16_26) + abs(yohaneFragment_u_xlat16_6.x);
    yohaneFragment_u_xlat16_23 = yohaneFragment_u_xlat16_23 + (-uShadowThreshold2);
    yohaneFragment_u_xlat16_26 = float(1.0) / yohaneFragment_u_xlat16_26;
    yohaneFragment_u_xlat16_23 = yohaneFragment_u_xlat16_23 * yohaneFragment_u_xlat16_26;
    yohaneFragment_u_xlat16_23 = clamp(yohaneFragment_u_xlat16_23, 0.0, 1.0);
    yohaneFragment_u_xlat16_26 = yohaneFragment_u_xlat16_23 * -2.0 + 3.0;
    yohaneFragment_u_xlat16_23 = yohaneFragment_u_xlat16_23 * yohaneFragment_u_xlat16_23;
    yohaneFragment_u_xlat16_23 = (-yohaneFragment_u_xlat16_26) * yohaneFragment_u_xlat16_23 + 1.0;
    yohaneFragment_u_xlat16_6.xyz = (-yohaneFragment_u_xlat16_0.xyz) * uBaseColor2.xyz + yohaneFragment_u_xlat16_3.xyz;
    yohaneFragment_u_xlat16_6.xyz = vec3(yohaneFragment_u_xlat16_23) * yohaneFragment_u_xlat16_6.xyz + yohaneFragment_u_xlat1.xyz;
    yohaneFragment_u_xlat16_6.xyz = yohaneFragment_u_xlat16_6.xyz * uYohaneMainLightColor.xyz;
    yohaneFragment_u_xlatb0 = uSpecularHighlights2==0.0;
    if(yohaneFragment_u_xlatb0){
        yohaneFragment_u_xlat16_0.xyz = yohaneSampleTexture(uSpecGlossMap2, yohaneVarying_vs_TEXCOORD0.xy, uYohaneGlobalMipBias.x).xyz;
        yohaneFragment_u_xlat16_23 = uSmoothness * 10.0 + 1.0;
        yohaneFragment_u_xlat16_23 = exp2(yohaneFragment_u_xlat16_23);
        yohaneFragment_u_xlat1.xyz = yohaneFragment_u_xlat16_2.xyz + uYohaneMainLightPosition.xyz;
        yohaneFragment_u_xlat21 = dot(yohaneFragment_u_xlat1.xyz, yohaneFragment_u_xlat1.xyz);
        yohaneFragment_u_xlat21 = max(yohaneFragment_u_xlat21, 1.17549435e-38);
        yohaneFragment_u_xlat21 = inversesqrt(yohaneFragment_u_xlat21);
        yohaneFragment_u_xlat1.xyz = vec3(yohaneFragment_u_xlat21) * yohaneFragment_u_xlat1.xyz;
        yohaneFragment_u_xlat21 = dot(yohaneFragment_u_xlat16_5.xyz, yohaneFragment_u_xlat1.xyz);
        yohaneFragment_u_xlat21 = clamp(yohaneFragment_u_xlat21, 0.0, 1.0);
        yohaneFragment_u_xlat16_2.x = log2(yohaneFragment_u_xlat21);
        yohaneFragment_u_xlat16_2.x = yohaneFragment_u_xlat16_2.x * yohaneFragment_u_xlat16_23;
        yohaneFragment_u_xlat16_2.x = exp2(yohaneFragment_u_xlat16_2.x);
        yohaneFragment_u_xlat16_2.xyz = yohaneFragment_u_xlat16_0.xyz * yohaneFragment_u_xlat16_2.xxx;
        yohaneFragment_u_xlat0.xyz = yohaneFragment_u_xlat16_2.xyz * uYohaneMainLightColor.xyz;
        yohaneFragment_u_xlat16_6.xyz = yohaneFragment_u_xlat0.xyz * uSpecColor.xyz + yohaneFragment_u_xlat16_6.xyz;
    }
    yohaneFragment_SV_Target0.xyz = yohaneFragment_u_xlat16_6.xyz;
    yohaneFragment_SV_Target0.w = yohaneFragment_u_xlat1.w;
    return;
}

// @end

// @section ForwardBack_ALPHATEST_ON_fragmentBody
yohaneFragmentMain();
vec3 outgoingLight = yohaneFragment_SV_Target0.rgb;
diffuseColor.a = yohaneFragment_SV_Target0.a;
// @end

// @section ForwardBack_ALPHATEST_ON_HAIRHIGHLIGHT_ON_vertexPrelude
uniform vec4 uYohanehlslcc_mtx4x4unity_MatrixVP[4];
uniform vec4 uYohanehlslcc_mtx4x4unity_ObjectToWorld[4];
uniform vec4 uYohanehlslcc_mtx4x4unity_WorldToObject[4];
uniform vec4 uYohaneunity_LODFade;
uniform mediump vec4 uYohaneunity_WorldTransformParams;
uniform vec4 uYohaneunity_RenderingLayer;
uniform mediump vec4 uYohaneunity_LightData;
uniform mediump vec4 uYohaneunity_LightIndices[2];
uniform vec4 uYohaneunity_ProbesOcclusion;
uniform mediump vec4 uYohaneunity_SpecCube0_HDR;
uniform mediump vec4 uYohaneunity_SpecCube1_HDR;
uniform vec4 uYohaneunity_SpecCube0_BoxMax;
uniform vec4 uYohaneunity_SpecCube0_BoxMin;
uniform vec4 uYohaneunity_SpecCube0_ProbePosition;
uniform vec4 uYohaneunity_SpecCube1_BoxMax;
uniform vec4 uYohaneunity_SpecCube1_BoxMin;
uniform vec4 uYohaneunity_SpecCube1_ProbePosition;
uniform vec4 uYohaneunity_LightmapST;
uniform vec4 uYohaneunity_DynamicLightmapST;
uniform mediump vec4 uYohaneunity_SHAr;
uniform mediump vec4 uYohaneunity_SHAg;
uniform mediump vec4 uYohaneunity_SHAb;
uniform mediump vec4 uYohaneunity_SHBr;
uniform mediump vec4 uYohaneunity_SHBg;
uniform mediump vec4 uYohaneunity_SHBb;
uniform mediump vec4 uYohaneunity_SHC;
uniform vec4 uYohanehlslcc_mtx4x4unity_MatrixPreviousM[4];
uniform vec4 uYohanehlslcc_mtx4x4unity_MatrixPreviousMI[4];
uniform vec4 uYohaneunity_MotionVectorsParams;
uniform vec4 uBaseMap_TexelSize;
uniform vec4 uBaseMap_MipInfo;
uniform vec4 uBaseMap_ST;
uniform mediump vec4 uBaseColor;
uniform mediump vec4 uSpecColor;
uniform mediump vec4 uEmissionColor;
uniform mediump float uCutoff;
uniform mediump float uSurface;
uniform mediump float uSmoothness;
uniform mediump float uSpecularHighlights;
uniform float uAlphaClip;
uniform vec4 uSpecGlossMap_ST;
uniform float uSmoothnessSource;
uniform float uBumpScale;
uniform mediump vec4 uRimLightColor;
uniform mediump float uShadowThreshold;
uniform mediump float uRimShadow;
uniform mediump float uRimPower;
uniform vec4 uBaseMap2_TexelSize;
uniform vec4 uBaseMap2_MipInfo;
uniform vec4 uBaseMap2_ST;
uniform mediump vec4 uBaseColor2;
uniform mediump vec4 uSpecColor2;
uniform mediump vec4 uEmissionColor2;
uniform mediump float uSmoothness2;
uniform mediump float uSpecularHighlights2;
uniform vec4 uSpecGlossMap2_ST;
uniform float uSmoothnessSource2;
uniform float uBumpScale2;
uniform mediump vec4 uRimLightColor2;
uniform mediump float uShadowThreshold2;
uniform mediump float uRimPower2;
uniform mediump float uRimShadow2;
uniform mediump float uMaskThreshold;
uniform mediump vec4 uMaskHeightRange;
uniform mediump vec4 uBackFaceColor;
uniform uint uskinned_tex_height;
uniform uint uskinned_tex_width;
highp vec3 yohaneVertex_in_POSITION0;
highp vec3 yohaneVertex_in_NORMAL0;
highp vec2 yohaneVertex_in_TEXCOORD0;
varying highp vec2 yohaneVarying_vs_TEXCOORD0;
varying highp vec3 yohaneVarying_vs_TEXCOORD1;
varying mediump vec3 yohaneVarying_vs_TEXCOORD2;
vec3 yohaneVertex_u_xlat0;
vec4 yohaneVertex_u_xlat1;
float yohaneVertex_u_xlat6;
void yohaneVertexMain()
{
    yohaneVertex_u_xlat0.xyz = yohaneVertex_in_POSITION0.yyy * uYohanehlslcc_mtx4x4unity_ObjectToWorld[1].xyz;
    yohaneVertex_u_xlat0.xyz = uYohanehlslcc_mtx4x4unity_ObjectToWorld[0].xyz * yohaneVertex_in_POSITION0.xxx + yohaneVertex_u_xlat0.xyz;
    yohaneVertex_u_xlat0.xyz = uYohanehlslcc_mtx4x4unity_ObjectToWorld[2].xyz * yohaneVertex_in_POSITION0.zzz + yohaneVertex_u_xlat0.xyz;
    yohaneVertex_u_xlat0.xyz = yohaneVertex_u_xlat0.xyz + uYohanehlslcc_mtx4x4unity_ObjectToWorld[3].xyz;
    yohaneVertex_u_xlat1 = yohaneVertex_u_xlat0.yyyy * uYohanehlslcc_mtx4x4unity_MatrixVP[1];
    yohaneVertex_u_xlat1 = uYohanehlslcc_mtx4x4unity_MatrixVP[0] * yohaneVertex_u_xlat0.xxxx + yohaneVertex_u_xlat1;
    yohaneVertex_u_xlat1 = uYohanehlslcc_mtx4x4unity_MatrixVP[2] * yohaneVertex_u_xlat0.zzzz + yohaneVertex_u_xlat1;
    yohaneVarying_vs_TEXCOORD1.xyz = yohaneVertex_u_xlat0.xyz;
    gl_Position = yohaneVertex_u_xlat1 + uYohanehlslcc_mtx4x4unity_MatrixVP[3];
    yohaneVarying_vs_TEXCOORD0.xy = yohaneVertex_in_TEXCOORD0.xy * uBaseMap2_ST.xy + uBaseMap2_ST.zw;
    yohaneVertex_u_xlat0.x = dot(yohaneVertex_in_NORMAL0.xyz, uYohanehlslcc_mtx4x4unity_WorldToObject[0].xyz);
    yohaneVertex_u_xlat0.y = dot(yohaneVertex_in_NORMAL0.xyz, uYohanehlslcc_mtx4x4unity_WorldToObject[1].xyz);
    yohaneVertex_u_xlat0.z = dot(yohaneVertex_in_NORMAL0.xyz, uYohanehlslcc_mtx4x4unity_WorldToObject[2].xyz);
    yohaneVertex_u_xlat6 = dot(yohaneVertex_u_xlat0.xyz, yohaneVertex_u_xlat0.xyz);
    yohaneVertex_u_xlat6 = max(yohaneVertex_u_xlat6, 1.17549435e-38);
    yohaneVertex_u_xlat6 = inversesqrt(yohaneVertex_u_xlat6);
    yohaneVertex_u_xlat0.xyz = vec3(yohaneVertex_u_xlat6) * yohaneVertex_u_xlat0.xyz;
    yohaneVertex_u_xlat6 = dot(yohaneVertex_u_xlat0.xyz, yohaneVertex_u_xlat0.xyz);
    yohaneVertex_u_xlat6 = inversesqrt(yohaneVertex_u_xlat6);
    yohaneVertex_u_xlat0.xyz = vec3(yohaneVertex_u_xlat6) * yohaneVertex_u_xlat0.xyz;
    yohaneVarying_vs_TEXCOORD2.xyz = yohaneVertex_u_xlat0.xyz;
    return;
}

// @end

// @section ForwardBack_ALPHATEST_ON_HAIRHIGHLIGHT_ON_vertexProject
yohaneVertex_in_POSITION0 = vec3(-transformed.x, transformed.yz);
yohaneVertex_in_NORMAL0 = vec3(-objectNormal.x, objectNormal.yz);
yohaneVertex_in_TEXCOORD0 = vec2(uv.x, 1.0 - uv.y);
yohaneVertexMain();
// @end

// @section ForwardBack_ALPHATEST_ON_HAIRHIGHLIGHT_ON_fragmentPrelude
uniform vec4 uYohaneMainLightPosition;
uniform mediump vec4 uYohaneMainLightColor;
uniform vec3 uYohaneWorldSpaceCameraPos;
uniform vec2 uYohaneGlobalMipBias;
uniform vec4 uYohaneunity_OrthoParams;
uniform vec4 uYohanehlslcc_mtx4x4unity_MatrixV[4];
uniform vec4 uYohanehlslcc_mtx4x4unity_ObjectToWorld[4];
uniform vec4 uYohanehlslcc_mtx4x4unity_WorldToObject[4];
uniform vec4 uYohaneunity_LODFade;
uniform mediump vec4 uYohaneunity_WorldTransformParams;
uniform vec4 uYohaneunity_RenderingLayer;
uniform mediump vec4 uYohaneunity_LightData;
uniform mediump vec4 uYohaneunity_LightIndices[2];
uniform vec4 uYohaneunity_ProbesOcclusion;
uniform mediump vec4 uYohaneunity_SpecCube0_HDR;
uniform mediump vec4 uYohaneunity_SpecCube1_HDR;
uniform vec4 uYohaneunity_SpecCube0_BoxMax;
uniform vec4 uYohaneunity_SpecCube0_BoxMin;
uniform vec4 uYohaneunity_SpecCube0_ProbePosition;
uniform vec4 uYohaneunity_SpecCube1_BoxMax;
uniform vec4 uYohaneunity_SpecCube1_BoxMin;
uniform vec4 uYohaneunity_SpecCube1_ProbePosition;
uniform vec4 uYohaneunity_LightmapST;
uniform vec4 uYohaneunity_DynamicLightmapST;
uniform mediump vec4 uYohaneunity_SHAr;
uniform mediump vec4 uYohaneunity_SHAg;
uniform mediump vec4 uYohaneunity_SHAb;
uniform mediump vec4 uYohaneunity_SHBr;
uniform mediump vec4 uYohaneunity_SHBg;
uniform mediump vec4 uYohaneunity_SHBb;
uniform mediump vec4 uYohaneunity_SHC;
uniform vec4 uYohanehlslcc_mtx4x4unity_MatrixPreviousM[4];
uniform vec4 uYohanehlslcc_mtx4x4unity_MatrixPreviousMI[4];
uniform vec4 uYohaneunity_MotionVectorsParams;
uniform vec4 uBaseMap_TexelSize;
uniform vec4 uBaseMap_MipInfo;
uniform vec4 uBaseMap_ST;
uniform mediump vec4 uBaseColor;
uniform mediump vec4 uSpecColor;
uniform mediump vec4 uEmissionColor;
uniform mediump float uCutoff;
uniform mediump float uSurface;
uniform mediump float uSmoothness;
uniform mediump float uSpecularHighlights;
uniform float uAlphaClip;
uniform vec4 uSpecGlossMap_ST;
uniform float uSmoothnessSource;
uniform float uBumpScale;
uniform mediump vec4 uRimLightColor;
uniform mediump float uShadowThreshold;
uniform mediump float uRimShadow;
uniform mediump float uRimPower;
uniform vec4 uBaseMap2_TexelSize;
uniform vec4 uBaseMap2_MipInfo;
uniform vec4 uBaseMap2_ST;
uniform mediump vec4 uBaseColor2;
uniform mediump vec4 uSpecColor2;
uniform mediump vec4 uEmissionColor2;
uniform mediump float uSmoothness2;
uniform mediump float uSpecularHighlights2;
uniform vec4 uSpecGlossMap2_ST;
uniform float uSmoothnessSource2;
uniform float uBumpScale2;
uniform mediump vec4 uRimLightColor2;
uniform mediump float uShadowThreshold2;
uniform mediump float uRimPower2;
uniform mediump float uRimShadow2;
uniform mediump float uMaskThreshold;
uniform mediump vec4 uMaskHeightRange;
uniform mediump vec4 uBackFaceColor;
uniform uint uskinned_tex_height;
uniform uint uskinned_tex_width;
uniform mediump sampler2D uBaseMap2;
uniform mediump sampler2D uSpecGlossMap2;
uniform mediump sampler2D uShadowColorMap2;
varying highp vec2 yohaneVarying_vs_TEXCOORD0;
varying highp vec3 yohaneVarying_vs_TEXCOORD1;
varying mediump vec3 yohaneVarying_vs_TEXCOORD2;
mediump vec4 yohaneFragment_SV_Target0;
mediump vec4 yohaneFragment_u_xlat16_0;
bool yohaneFragment_u_xlatb0;
vec4 yohaneFragment_u_xlat1;
mediump vec3 yohaneFragment_u_xlat16_2;
mediump vec3 yohaneFragment_u_xlat16_3;
vec3 yohaneFragment_u_xlat4;
mediump vec3 yohaneFragment_u_xlat16_5;
mediump vec3 yohaneFragment_u_xlat16_6;
mediump float yohaneFragment_u_xlat16_9;
float yohaneFragment_u_xlat21;
bool yohaneFragment_u_xlatb21;
mediump float yohaneFragment_u_xlat16_23;
float yohaneFragment_u_xlat24;
mediump float yohaneFragment_u_xlat16_26;
vec4 yohaneSampleTexture(sampler2D image, vec2 coord) { return texture(image, vec2(coord.x, 1.0 - coord.y)); }
vec4 yohaneSampleTexture(sampler2D image, vec2 coord, float bias) { return texture(image, vec2(coord.x, 1.0 - coord.y), bias); }

void yohaneFragmentMain()
{
    yohaneFragment_u_xlat16_0 = yohaneSampleTexture(uBaseMap2, yohaneVarying_vs_TEXCOORD0.xy, uYohaneGlobalMipBias.x);
    yohaneFragment_u_xlat1 = yohaneFragment_u_xlat16_0 * uBaseColor2;
    yohaneFragment_u_xlat16_2.x = yohaneFragment_u_xlat16_0.w * uBaseColor2.w + (-uCutoff);
    yohaneFragment_u_xlatb21 = yohaneFragment_u_xlat16_2.x<0.0;
    if(yohaneFragment_u_xlatb21){discard;}
    yohaneFragment_u_xlat16_3.xyz = yohaneSampleTexture(uShadowColorMap2, yohaneVarying_vs_TEXCOORD0.xy, uYohaneGlobalMipBias.x).xyz;
    yohaneFragment_u_xlatb21 = uYohaneunity_OrthoParams.w==0.0;
    yohaneFragment_u_xlat4.xyz = (-yohaneVarying_vs_TEXCOORD1.xyz) + uYohaneWorldSpaceCameraPos.xyz;
    yohaneFragment_u_xlat24 = dot(yohaneFragment_u_xlat4.xyz, yohaneFragment_u_xlat4.xyz);
    yohaneFragment_u_xlat24 = inversesqrt(yohaneFragment_u_xlat24);
    yohaneFragment_u_xlat4.xyz = vec3(yohaneFragment_u_xlat24) * yohaneFragment_u_xlat4.xyz;
    yohaneFragment_u_xlat16_2.x = (yohaneFragment_u_xlatb21) ? yohaneFragment_u_xlat4.x : uYohanehlslcc_mtx4x4unity_MatrixV[0].z;
    yohaneFragment_u_xlat16_2.y = (yohaneFragment_u_xlatb21) ? yohaneFragment_u_xlat4.y : uYohanehlslcc_mtx4x4unity_MatrixV[1].z;
    yohaneFragment_u_xlat16_2.z = (yohaneFragment_u_xlatb21) ? yohaneFragment_u_xlat4.z : uYohanehlslcc_mtx4x4unity_MatrixV[2].z;
    yohaneFragment_u_xlat16_23 = dot(yohaneVarying_vs_TEXCOORD2.xyz, yohaneVarying_vs_TEXCOORD2.xyz);
    yohaneFragment_u_xlat16_23 = inversesqrt(yohaneFragment_u_xlat16_23);
    yohaneFragment_u_xlat16_5.xyz = vec3(yohaneFragment_u_xlat16_23) * yohaneVarying_vs_TEXCOORD2.xyz;
    yohaneFragment_u_xlat16_23 = dot(yohaneFragment_u_xlat16_5.xyz, uYohaneMainLightPosition.xyz);
    yohaneFragment_u_xlat16_23 = yohaneFragment_u_xlat16_23 + 1.0;
    yohaneFragment_u_xlat16_23 = yohaneFragment_u_xlat16_23 * 0.5;
    yohaneFragment_u_xlat21 = min(uYohaneunity_LightData.z, 1.0);
    yohaneFragment_u_xlat21 = yohaneFragment_u_xlat21 * yohaneFragment_u_xlat16_23;
    yohaneFragment_u_xlat16_6.xyz = (-yohaneFragment_u_xlat16_2.xyz) + (-uYohaneMainLightPosition.xyz);
    yohaneFragment_u_xlat16_6.xyz = vec3(vec3(uRimShadow2, uRimShadow2, uRimShadow2)) * yohaneFragment_u_xlat16_6.xyz + uYohaneMainLightPosition.xyz;
    yohaneFragment_u_xlat24 = dot(yohaneFragment_u_xlat16_5.xyz, yohaneFragment_u_xlat16_6.xyz);
    yohaneFragment_u_xlat24 = yohaneFragment_u_xlat24 + 1.0;
    yohaneFragment_u_xlat16_23 = yohaneFragment_u_xlat24 * 0.5 + (-yohaneFragment_u_xlat21);
    yohaneFragment_u_xlat16_23 = uRimShadow2 * yohaneFragment_u_xlat16_23 + yohaneFragment_u_xlat21;
    yohaneFragment_u_xlat16_26 = dFdx(yohaneFragment_u_xlat16_23);
    yohaneFragment_u_xlat16_6.x = dFdy(yohaneFragment_u_xlat16_23);
    yohaneFragment_u_xlat16_26 = abs(yohaneFragment_u_xlat16_26) + abs(yohaneFragment_u_xlat16_6.x);
    yohaneFragment_u_xlat16_23 = yohaneFragment_u_xlat16_23 + (-uShadowThreshold2);
    yohaneFragment_u_xlat16_26 = float(1.0) / yohaneFragment_u_xlat16_26;
    yohaneFragment_u_xlat16_23 = yohaneFragment_u_xlat16_23 * yohaneFragment_u_xlat16_26;
    yohaneFragment_u_xlat16_23 = clamp(yohaneFragment_u_xlat16_23, 0.0, 1.0);
    yohaneFragment_u_xlat16_26 = yohaneFragment_u_xlat16_23 * -2.0 + 3.0;
    yohaneFragment_u_xlat16_23 = yohaneFragment_u_xlat16_23 * yohaneFragment_u_xlat16_23;
    yohaneFragment_u_xlat16_23 = (-yohaneFragment_u_xlat16_26) * yohaneFragment_u_xlat16_23 + 1.0;
    yohaneFragment_u_xlat16_2.x = dot(yohaneFragment_u_xlat16_5.xyz, yohaneFragment_u_xlat16_2.xyz);
    yohaneFragment_u_xlat16_2.x = (-yohaneFragment_u_xlat16_2.x) + 1.0;
    yohaneFragment_u_xlat16_2.x = log2(abs(yohaneFragment_u_xlat16_2.x));
    yohaneFragment_u_xlat16_2.x = yohaneFragment_u_xlat16_2.x * uRimPower2;
    yohaneFragment_u_xlat16_2.x = exp2(yohaneFragment_u_xlat16_2.x);
    yohaneFragment_u_xlat16_2.x = yohaneFragment_u_xlat16_2.x * yohaneFragment_u_xlat21 + -0.5;
    yohaneFragment_u_xlat16_2.x = yohaneFragment_u_xlat16_2.x * 50.0000496;
    yohaneFragment_u_xlat16_2.x = clamp(yohaneFragment_u_xlat16_2.x, 0.0, 1.0);
    yohaneFragment_u_xlat16_9 = yohaneFragment_u_xlat16_2.x * -2.0 + 3.0;
    yohaneFragment_u_xlat16_2.x = yohaneFragment_u_xlat16_2.x * yohaneFragment_u_xlat16_2.x;
    yohaneFragment_u_xlat16_2.x = yohaneFragment_u_xlat16_2.x * yohaneFragment_u_xlat16_9;
    yohaneFragment_u_xlat16_5.xyz = uYohaneMainLightColor.xyz * uRimLightColor2.xyz;
    yohaneFragment_u_xlat16_2.xyz = yohaneFragment_u_xlat16_5.xyz * yohaneFragment_u_xlat16_2.xxx + uYohaneMainLightColor.xyz;
    yohaneFragment_u_xlat16_5.xyz = (-yohaneFragment_u_xlat16_0.xyz) * uBaseColor2.xyz + yohaneFragment_u_xlat16_3.xyz;
    yohaneFragment_u_xlat16_5.xyz = vec3(yohaneFragment_u_xlat16_23) * yohaneFragment_u_xlat16_5.xyz + yohaneFragment_u_xlat1.xyz;
    yohaneFragment_u_xlat16_2.xyz = yohaneFragment_u_xlat16_2.xyz * yohaneFragment_u_xlat16_5.xyz;
    yohaneFragment_u_xlatb0 = uSpecularHighlights2==0.0;
    if(yohaneFragment_u_xlatb0){
        yohaneFragment_u_xlat16_0.xyz = yohaneSampleTexture(uSpecGlossMap2, yohaneVarying_vs_TEXCOORD0.xy, uYohaneGlobalMipBias.x).xyz;
        yohaneFragment_u_xlat16_5.xyz = yohaneFragment_u_xlat16_0.xyz * vec3(yohaneFragment_u_xlat21);
        yohaneFragment_u_xlat16_2.xyz = yohaneFragment_u_xlat16_5.xyz * uSpecColor.xyz + yohaneFragment_u_xlat16_2.xyz;
    }
    yohaneFragment_SV_Target0.xyz = yohaneFragment_u_xlat16_2.xyz;
    yohaneFragment_SV_Target0.w = yohaneFragment_u_xlat1.w;
    return;
}

// @end

// @section ForwardBack_ALPHATEST_ON_HAIRHIGHLIGHT_ON_fragmentBody
yohaneFragmentMain();
vec3 outgoingLight = yohaneFragment_SV_Target0.rgb;
diffuseColor.a = yohaneFragment_SV_Target0.a;
// @end

// @section DepthNormals_BASE_vertexPrelude
uniform vec4 uYohanehlslcc_mtx4x4unity_MatrixVP[4];
uniform vec4 uYohanehlslcc_mtx4x4unity_ObjectToWorld[4];
uniform vec4 uYohanehlslcc_mtx4x4unity_WorldToObject[4];
uniform vec4 uYohaneunity_LODFade;
uniform mediump vec4 uYohaneunity_WorldTransformParams;
uniform vec4 uYohaneunity_RenderingLayer;
uniform mediump vec4 uYohaneunity_LightData;
uniform mediump vec4 uYohaneunity_LightIndices[2];
uniform vec4 uYohaneunity_ProbesOcclusion;
uniform mediump vec4 uYohaneunity_SpecCube0_HDR;
uniform mediump vec4 uYohaneunity_SpecCube1_HDR;
uniform vec4 uYohaneunity_SpecCube0_BoxMax;
uniform vec4 uYohaneunity_SpecCube0_BoxMin;
uniform vec4 uYohaneunity_SpecCube0_ProbePosition;
uniform vec4 uYohaneunity_SpecCube1_BoxMax;
uniform vec4 uYohaneunity_SpecCube1_BoxMin;
uniform vec4 uYohaneunity_SpecCube1_ProbePosition;
uniform vec4 uYohaneunity_LightmapST;
uniform vec4 uYohaneunity_DynamicLightmapST;
uniform mediump vec4 uYohaneunity_SHAr;
uniform mediump vec4 uYohaneunity_SHAg;
uniform mediump vec4 uYohaneunity_SHAb;
uniform mediump vec4 uYohaneunity_SHBr;
uniform mediump vec4 uYohaneunity_SHBg;
uniform mediump vec4 uYohaneunity_SHBb;
uniform mediump vec4 uYohaneunity_SHC;
uniform vec4 uYohanehlslcc_mtx4x4unity_MatrixPreviousM[4];
uniform vec4 uYohanehlslcc_mtx4x4unity_MatrixPreviousMI[4];
uniform vec4 uYohaneunity_MotionVectorsParams;
uniform vec4 uBaseMap_TexelSize;
uniform vec4 uBaseMap_MipInfo;
uniform vec4 uBaseMap_ST;
uniform mediump vec4 uBaseColor;
uniform mediump vec4 uSpecColor;
uniform mediump vec4 uEmissionColor;
uniform mediump float uCutoff;
uniform mediump float uSurface;
uniform mediump float uSmoothness;
uniform mediump float uSpecularHighlights;
uniform float uAlphaClip;
uniform vec4 uSpecGlossMap_ST;
uniform float uSmoothnessSource;
uniform float uBumpScale;
uniform mediump vec4 uRimLightColor;
uniform mediump float uShadowThreshold;
uniform mediump float uRimShadow;
uniform mediump float uRimPower;
uniform vec4 uBaseMap2_TexelSize;
uniform vec4 uBaseMap2_MipInfo;
uniform vec4 uBaseMap2_ST;
uniform mediump vec4 uBaseColor2;
uniform mediump vec4 uSpecColor2;
uniform mediump vec4 uEmissionColor2;
uniform mediump float uSmoothness2;
uniform mediump float uSpecularHighlights2;
uniform vec4 uSpecGlossMap2_ST;
uniform float uSmoothnessSource2;
uniform float uBumpScale2;
uniform mediump vec4 uRimLightColor2;
uniform mediump float uShadowThreshold2;
uniform mediump float uRimPower2;
uniform mediump float uRimShadow2;
uniform mediump float uMaskThreshold;
uniform mediump vec4 uMaskHeightRange;
uniform mediump vec4 uBackFaceColor;
uniform uint uskinned_tex_height;
uniform uint uskinned_tex_width;
highp vec3 yohaneVertex_in_POSITION0;
highp vec3 yohaneVertex_in_NORMAL0;
highp vec2 yohaneVertex_in_TEXCOORD0;
varying highp vec2 yohaneVarying_vs_TEXCOORD0;
varying highp vec3 yohaneVarying_vs_TEXCOORD1;
varying mediump vec3 yohaneVarying_vs_TEXCOORD2;
vec3 yohaneVertex_u_xlat0;
vec4 yohaneVertex_u_xlat1;
float yohaneVertex_u_xlat6;
void yohaneVertexMain()
{
    yohaneVertex_u_xlat0.xyz = yohaneVertex_in_POSITION0.yyy * uYohanehlslcc_mtx4x4unity_ObjectToWorld[1].xyz;
    yohaneVertex_u_xlat0.xyz = uYohanehlslcc_mtx4x4unity_ObjectToWorld[0].xyz * yohaneVertex_in_POSITION0.xxx + yohaneVertex_u_xlat0.xyz;
    yohaneVertex_u_xlat0.xyz = uYohanehlslcc_mtx4x4unity_ObjectToWorld[2].xyz * yohaneVertex_in_POSITION0.zzz + yohaneVertex_u_xlat0.xyz;
    yohaneVertex_u_xlat0.xyz = yohaneVertex_u_xlat0.xyz + uYohanehlslcc_mtx4x4unity_ObjectToWorld[3].xyz;
    yohaneVertex_u_xlat1 = yohaneVertex_u_xlat0.yyyy * uYohanehlslcc_mtx4x4unity_MatrixVP[1];
    yohaneVertex_u_xlat1 = uYohanehlslcc_mtx4x4unity_MatrixVP[0] * yohaneVertex_u_xlat0.xxxx + yohaneVertex_u_xlat1;
    yohaneVertex_u_xlat1 = uYohanehlslcc_mtx4x4unity_MatrixVP[2] * yohaneVertex_u_xlat0.zzzz + yohaneVertex_u_xlat1;
    yohaneVarying_vs_TEXCOORD1.xyz = yohaneVertex_u_xlat0.xyz;
    gl_Position = yohaneVertex_u_xlat1 + uYohanehlslcc_mtx4x4unity_MatrixVP[3];
    yohaneVarying_vs_TEXCOORD0.xy = yohaneVertex_in_TEXCOORD0.xy * uBaseMap_ST.xy + uBaseMap_ST.zw;
    yohaneVertex_u_xlat0.x = dot(yohaneVertex_in_NORMAL0.xyz, uYohanehlslcc_mtx4x4unity_WorldToObject[0].xyz);
    yohaneVertex_u_xlat0.y = dot(yohaneVertex_in_NORMAL0.xyz, uYohanehlslcc_mtx4x4unity_WorldToObject[1].xyz);
    yohaneVertex_u_xlat0.z = dot(yohaneVertex_in_NORMAL0.xyz, uYohanehlslcc_mtx4x4unity_WorldToObject[2].xyz);
    yohaneVertex_u_xlat6 = dot(yohaneVertex_u_xlat0.xyz, yohaneVertex_u_xlat0.xyz);
    yohaneVertex_u_xlat6 = max(yohaneVertex_u_xlat6, 1.17549435e-38);
    yohaneVertex_u_xlat6 = inversesqrt(yohaneVertex_u_xlat6);
    yohaneVertex_u_xlat0.xyz = vec3(yohaneVertex_u_xlat6) * yohaneVertex_u_xlat0.xyz;
    yohaneVertex_u_xlat6 = dot(yohaneVertex_u_xlat0.xyz, yohaneVertex_u_xlat0.xyz);
    yohaneVertex_u_xlat6 = inversesqrt(yohaneVertex_u_xlat6);
    yohaneVertex_u_xlat0.xyz = vec3(yohaneVertex_u_xlat6) * yohaneVertex_u_xlat0.xyz;
    yohaneVarying_vs_TEXCOORD2.xyz = yohaneVertex_u_xlat0.xyz;
    return;
}

// @end

// @section DepthNormals_BASE_vertexProject
yohaneVertex_in_POSITION0 = vec3(-transformed.x, transformed.yz);
yohaneVertex_in_NORMAL0 = vec3(-objectNormal.x, objectNormal.yz);
yohaneVertex_in_TEXCOORD0 = vec2(uv.x, 1.0 - uv.y);
yohaneVertexMain();
// @end

// @section DepthNormals_BASE_fragmentPrelude
varying mediump vec3 yohaneVarying_vs_TEXCOORD2;
mediump vec4 yohaneFragment_SV_TARGET0;
mediump float yohaneFragment_u_xlat16_0;
void yohaneFragmentMain()
{
    yohaneFragment_u_xlat16_0 = dot(yohaneVarying_vs_TEXCOORD2.xyz, yohaneVarying_vs_TEXCOORD2.xyz);
    yohaneFragment_u_xlat16_0 = inversesqrt(yohaneFragment_u_xlat16_0);
    yohaneFragment_SV_TARGET0.xyz = vec3(yohaneFragment_u_xlat16_0) * yohaneVarying_vs_TEXCOORD2.xyz;
    yohaneFragment_SV_TARGET0.w = 0.0;
    return;
}

// @end

// @section DepthNormals_BASE_fragmentBody
yohaneFragmentMain();
vec3 outgoingLight = yohaneFragment_SV_TARGET0.rgb;
diffuseColor.a = yohaneFragment_SV_TARGET0.a;
// @end

// @section DepthNormals_FLATNORMAL_ON_vertexPrelude
uniform vec4 uYohanehlslcc_mtx4x4unity_MatrixVP[4];
uniform vec4 uYohanehlslcc_mtx4x4unity_ObjectToWorld[4];
uniform vec4 uYohanehlslcc_mtx4x4unity_WorldToObject[4];
uniform vec4 uYohaneunity_LODFade;
uniform mediump vec4 uYohaneunity_WorldTransformParams;
uniform vec4 uYohaneunity_RenderingLayer;
uniform mediump vec4 uYohaneunity_LightData;
uniform mediump vec4 uYohaneunity_LightIndices[2];
uniform vec4 uYohaneunity_ProbesOcclusion;
uniform mediump vec4 uYohaneunity_SpecCube0_HDR;
uniform mediump vec4 uYohaneunity_SpecCube1_HDR;
uniform vec4 uYohaneunity_SpecCube0_BoxMax;
uniform vec4 uYohaneunity_SpecCube0_BoxMin;
uniform vec4 uYohaneunity_SpecCube0_ProbePosition;
uniform vec4 uYohaneunity_SpecCube1_BoxMax;
uniform vec4 uYohaneunity_SpecCube1_BoxMin;
uniform vec4 uYohaneunity_SpecCube1_ProbePosition;
uniform vec4 uYohaneunity_LightmapST;
uniform vec4 uYohaneunity_DynamicLightmapST;
uniform mediump vec4 uYohaneunity_SHAr;
uniform mediump vec4 uYohaneunity_SHAg;
uniform mediump vec4 uYohaneunity_SHAb;
uniform mediump vec4 uYohaneunity_SHBr;
uniform mediump vec4 uYohaneunity_SHBg;
uniform mediump vec4 uYohaneunity_SHBb;
uniform mediump vec4 uYohaneunity_SHC;
uniform vec4 uYohanehlslcc_mtx4x4unity_MatrixPreviousM[4];
uniform vec4 uYohanehlslcc_mtx4x4unity_MatrixPreviousMI[4];
uniform vec4 uYohaneunity_MotionVectorsParams;
uniform vec4 uBaseMap_TexelSize;
uniform vec4 uBaseMap_MipInfo;
uniform vec4 uBaseMap_ST;
uniform mediump vec4 uBaseColor;
uniform mediump vec4 uSpecColor;
uniform mediump vec4 uEmissionColor;
uniform mediump float uCutoff;
uniform mediump float uSurface;
uniform mediump float uSmoothness;
uniform mediump float uSpecularHighlights;
uniform float uAlphaClip;
uniform vec4 uSpecGlossMap_ST;
uniform float uSmoothnessSource;
uniform float uBumpScale;
uniform mediump vec4 uRimLightColor;
uniform mediump float uShadowThreshold;
uniform mediump float uRimShadow;
uniform mediump float uRimPower;
uniform vec4 uBaseMap2_TexelSize;
uniform vec4 uBaseMap2_MipInfo;
uniform vec4 uBaseMap2_ST;
uniform mediump vec4 uBaseColor2;
uniform mediump vec4 uSpecColor2;
uniform mediump vec4 uEmissionColor2;
uniform mediump float uSmoothness2;
uniform mediump float uSpecularHighlights2;
uniform vec4 uSpecGlossMap2_ST;
uniform float uSmoothnessSource2;
uniform float uBumpScale2;
uniform mediump vec4 uRimLightColor2;
uniform mediump float uShadowThreshold2;
uniform mediump float uRimPower2;
uniform mediump float uRimShadow2;
uniform mediump float uMaskThreshold;
uniform mediump vec4 uMaskHeightRange;
uniform mediump vec4 uBackFaceColor;
uniform uint uskinned_tex_height;
uniform uint uskinned_tex_width;
highp vec3 yohaneVertex_in_POSITION0;
highp vec3 yohaneVertex_in_NORMAL0;
highp vec2 yohaneVertex_in_TEXCOORD0;
varying highp vec2 yohaneVarying_vs_TEXCOORD0;
varying highp vec3 yohaneVarying_vs_TEXCOORD1;
varying mediump vec3 yohaneVarying_vs_TEXCOORD2;
vec3 yohaneVertex_u_xlat0;
vec4 yohaneVertex_u_xlat1;
float yohaneVertex_u_xlat6;
void yohaneVertexMain()
{
    yohaneVertex_u_xlat0.xyz = yohaneVertex_in_POSITION0.yyy * uYohanehlslcc_mtx4x4unity_ObjectToWorld[1].xyz;
    yohaneVertex_u_xlat0.xyz = uYohanehlslcc_mtx4x4unity_ObjectToWorld[0].xyz * yohaneVertex_in_POSITION0.xxx + yohaneVertex_u_xlat0.xyz;
    yohaneVertex_u_xlat0.xyz = uYohanehlslcc_mtx4x4unity_ObjectToWorld[2].xyz * yohaneVertex_in_POSITION0.zzz + yohaneVertex_u_xlat0.xyz;
    yohaneVertex_u_xlat0.xyz = yohaneVertex_u_xlat0.xyz + uYohanehlslcc_mtx4x4unity_ObjectToWorld[3].xyz;
    yohaneVertex_u_xlat1 = yohaneVertex_u_xlat0.yyyy * uYohanehlslcc_mtx4x4unity_MatrixVP[1];
    yohaneVertex_u_xlat1 = uYohanehlslcc_mtx4x4unity_MatrixVP[0] * yohaneVertex_u_xlat0.xxxx + yohaneVertex_u_xlat1;
    yohaneVertex_u_xlat1 = uYohanehlslcc_mtx4x4unity_MatrixVP[2] * yohaneVertex_u_xlat0.zzzz + yohaneVertex_u_xlat1;
    yohaneVarying_vs_TEXCOORD1.xyz = yohaneVertex_u_xlat0.xyz;
    gl_Position = yohaneVertex_u_xlat1 + uYohanehlslcc_mtx4x4unity_MatrixVP[3];
    yohaneVarying_vs_TEXCOORD0.xy = yohaneVertex_in_TEXCOORD0.xy * uBaseMap_ST.xy + uBaseMap_ST.zw;
    yohaneVertex_u_xlat0.x = dot(yohaneVertex_in_NORMAL0.xyz, uYohanehlslcc_mtx4x4unity_WorldToObject[0].xyz);
    yohaneVertex_u_xlat0.y = dot(yohaneVertex_in_NORMAL0.xyz, uYohanehlslcc_mtx4x4unity_WorldToObject[1].xyz);
    yohaneVertex_u_xlat0.z = dot(yohaneVertex_in_NORMAL0.xyz, uYohanehlslcc_mtx4x4unity_WorldToObject[2].xyz);
    yohaneVertex_u_xlat6 = dot(yohaneVertex_u_xlat0.xyz, yohaneVertex_u_xlat0.xyz);
    yohaneVertex_u_xlat6 = max(yohaneVertex_u_xlat6, 1.17549435e-38);
    yohaneVertex_u_xlat6 = inversesqrt(yohaneVertex_u_xlat6);
    yohaneVertex_u_xlat0.xyz = vec3(yohaneVertex_u_xlat6) * yohaneVertex_u_xlat0.xyz;
    yohaneVertex_u_xlat6 = dot(yohaneVertex_u_xlat0.xyz, yohaneVertex_u_xlat0.xyz);
    yohaneVertex_u_xlat6 = inversesqrt(yohaneVertex_u_xlat6);
    yohaneVertex_u_xlat0.xyz = vec3(yohaneVertex_u_xlat6) * yohaneVertex_u_xlat0.xyz;
    yohaneVarying_vs_TEXCOORD2.xyz = yohaneVertex_u_xlat0.xyz;
    return;
}

// @end

// @section DepthNormals_FLATNORMAL_ON_vertexProject
yohaneVertex_in_POSITION0 = vec3(-transformed.x, transformed.yz);
yohaneVertex_in_NORMAL0 = vec3(-objectNormal.x, objectNormal.yz);
yohaneVertex_in_TEXCOORD0 = vec2(uv.x, 1.0 - uv.y);
yohaneVertexMain();
// @end

// @section DepthNormals_FLATNORMAL_ON_fragmentPrelude
mediump vec4 yohaneFragment_SV_TARGET0;
void yohaneFragmentMain()
{
    yohaneFragment_SV_TARGET0 = vec4(0.0, 0.0, 1.0, 0.0);
    return;
}

// @end

// @section DepthNormals_FLATNORMAL_ON_fragmentBody
yohaneFragmentMain();
vec3 outgoingLight = yohaneFragment_SV_TARGET0.rgb;
diffuseColor.a = yohaneFragment_SV_TARGET0.a;
// @end

// @section DepthNormals_ALPHATEST_ON_vertexPrelude
uniform vec4 uYohanehlslcc_mtx4x4unity_MatrixVP[4];
uniform vec4 uYohanehlslcc_mtx4x4unity_ObjectToWorld[4];
uniform vec4 uYohanehlslcc_mtx4x4unity_WorldToObject[4];
uniform vec4 uYohaneunity_LODFade;
uniform mediump vec4 uYohaneunity_WorldTransformParams;
uniform vec4 uYohaneunity_RenderingLayer;
uniform mediump vec4 uYohaneunity_LightData;
uniform mediump vec4 uYohaneunity_LightIndices[2];
uniform vec4 uYohaneunity_ProbesOcclusion;
uniform mediump vec4 uYohaneunity_SpecCube0_HDR;
uniform mediump vec4 uYohaneunity_SpecCube1_HDR;
uniform vec4 uYohaneunity_SpecCube0_BoxMax;
uniform vec4 uYohaneunity_SpecCube0_BoxMin;
uniform vec4 uYohaneunity_SpecCube0_ProbePosition;
uniform vec4 uYohaneunity_SpecCube1_BoxMax;
uniform vec4 uYohaneunity_SpecCube1_BoxMin;
uniform vec4 uYohaneunity_SpecCube1_ProbePosition;
uniform vec4 uYohaneunity_LightmapST;
uniform vec4 uYohaneunity_DynamicLightmapST;
uniform mediump vec4 uYohaneunity_SHAr;
uniform mediump vec4 uYohaneunity_SHAg;
uniform mediump vec4 uYohaneunity_SHAb;
uniform mediump vec4 uYohaneunity_SHBr;
uniform mediump vec4 uYohaneunity_SHBg;
uniform mediump vec4 uYohaneunity_SHBb;
uniform mediump vec4 uYohaneunity_SHC;
uniform vec4 uYohanehlslcc_mtx4x4unity_MatrixPreviousM[4];
uniform vec4 uYohanehlslcc_mtx4x4unity_MatrixPreviousMI[4];
uniform vec4 uYohaneunity_MotionVectorsParams;
uniform vec4 uBaseMap_TexelSize;
uniform vec4 uBaseMap_MipInfo;
uniform vec4 uBaseMap_ST;
uniform mediump vec4 uBaseColor;
uniform mediump vec4 uSpecColor;
uniform mediump vec4 uEmissionColor;
uniform mediump float uCutoff;
uniform mediump float uSurface;
uniform mediump float uSmoothness;
uniform mediump float uSpecularHighlights;
uniform float uAlphaClip;
uniform vec4 uSpecGlossMap_ST;
uniform float uSmoothnessSource;
uniform float uBumpScale;
uniform mediump vec4 uRimLightColor;
uniform mediump float uShadowThreshold;
uniform mediump float uRimShadow;
uniform mediump float uRimPower;
uniform vec4 uBaseMap2_TexelSize;
uniform vec4 uBaseMap2_MipInfo;
uniform vec4 uBaseMap2_ST;
uniform mediump vec4 uBaseColor2;
uniform mediump vec4 uSpecColor2;
uniform mediump vec4 uEmissionColor2;
uniform mediump float uSmoothness2;
uniform mediump float uSpecularHighlights2;
uniform vec4 uSpecGlossMap2_ST;
uniform float uSmoothnessSource2;
uniform float uBumpScale2;
uniform mediump vec4 uRimLightColor2;
uniform mediump float uShadowThreshold2;
uniform mediump float uRimPower2;
uniform mediump float uRimShadow2;
uniform mediump float uMaskThreshold;
uniform mediump vec4 uMaskHeightRange;
uniform mediump vec4 uBackFaceColor;
uniform uint uskinned_tex_height;
uniform uint uskinned_tex_width;
highp vec3 yohaneVertex_in_POSITION0;
highp vec3 yohaneVertex_in_NORMAL0;
highp vec2 yohaneVertex_in_TEXCOORD0;
varying highp vec2 yohaneVarying_vs_TEXCOORD0;
varying highp vec3 yohaneVarying_vs_TEXCOORD1;
varying mediump vec3 yohaneVarying_vs_TEXCOORD2;
vec3 yohaneVertex_u_xlat0;
vec4 yohaneVertex_u_xlat1;
float yohaneVertex_u_xlat6;
void yohaneVertexMain()
{
    yohaneVertex_u_xlat0.xyz = yohaneVertex_in_POSITION0.yyy * uYohanehlslcc_mtx4x4unity_ObjectToWorld[1].xyz;
    yohaneVertex_u_xlat0.xyz = uYohanehlslcc_mtx4x4unity_ObjectToWorld[0].xyz * yohaneVertex_in_POSITION0.xxx + yohaneVertex_u_xlat0.xyz;
    yohaneVertex_u_xlat0.xyz = uYohanehlslcc_mtx4x4unity_ObjectToWorld[2].xyz * yohaneVertex_in_POSITION0.zzz + yohaneVertex_u_xlat0.xyz;
    yohaneVertex_u_xlat0.xyz = yohaneVertex_u_xlat0.xyz + uYohanehlslcc_mtx4x4unity_ObjectToWorld[3].xyz;
    yohaneVertex_u_xlat1 = yohaneVertex_u_xlat0.yyyy * uYohanehlslcc_mtx4x4unity_MatrixVP[1];
    yohaneVertex_u_xlat1 = uYohanehlslcc_mtx4x4unity_MatrixVP[0] * yohaneVertex_u_xlat0.xxxx + yohaneVertex_u_xlat1;
    yohaneVertex_u_xlat1 = uYohanehlslcc_mtx4x4unity_MatrixVP[2] * yohaneVertex_u_xlat0.zzzz + yohaneVertex_u_xlat1;
    yohaneVarying_vs_TEXCOORD1.xyz = yohaneVertex_u_xlat0.xyz;
    gl_Position = yohaneVertex_u_xlat1 + uYohanehlslcc_mtx4x4unity_MatrixVP[3];
    yohaneVarying_vs_TEXCOORD0.xy = yohaneVertex_in_TEXCOORD0.xy * uBaseMap_ST.xy + uBaseMap_ST.zw;
    yohaneVertex_u_xlat0.x = dot(yohaneVertex_in_NORMAL0.xyz, uYohanehlslcc_mtx4x4unity_WorldToObject[0].xyz);
    yohaneVertex_u_xlat0.y = dot(yohaneVertex_in_NORMAL0.xyz, uYohanehlslcc_mtx4x4unity_WorldToObject[1].xyz);
    yohaneVertex_u_xlat0.z = dot(yohaneVertex_in_NORMAL0.xyz, uYohanehlslcc_mtx4x4unity_WorldToObject[2].xyz);
    yohaneVertex_u_xlat6 = dot(yohaneVertex_u_xlat0.xyz, yohaneVertex_u_xlat0.xyz);
    yohaneVertex_u_xlat6 = max(yohaneVertex_u_xlat6, 1.17549435e-38);
    yohaneVertex_u_xlat6 = inversesqrt(yohaneVertex_u_xlat6);
    yohaneVertex_u_xlat0.xyz = vec3(yohaneVertex_u_xlat6) * yohaneVertex_u_xlat0.xyz;
    yohaneVertex_u_xlat6 = dot(yohaneVertex_u_xlat0.xyz, yohaneVertex_u_xlat0.xyz);
    yohaneVertex_u_xlat6 = inversesqrt(yohaneVertex_u_xlat6);
    yohaneVertex_u_xlat0.xyz = vec3(yohaneVertex_u_xlat6) * yohaneVertex_u_xlat0.xyz;
    yohaneVarying_vs_TEXCOORD2.xyz = yohaneVertex_u_xlat0.xyz;
    return;
}

// @end

// @section DepthNormals_ALPHATEST_ON_vertexProject
yohaneVertex_in_POSITION0 = vec3(-transformed.x, transformed.yz);
yohaneVertex_in_NORMAL0 = vec3(-objectNormal.x, objectNormal.yz);
yohaneVertex_in_TEXCOORD0 = vec2(uv.x, 1.0 - uv.y);
yohaneVertexMain();
// @end

// @section DepthNormals_ALPHATEST_ON_fragmentPrelude
uniform vec2 uYohaneGlobalMipBias;
uniform vec4 uBaseMap_TexelSize;
uniform vec4 uBaseMap_MipInfo;
uniform vec4 uBaseMap_ST;
uniform mediump vec4 uBaseColor;
uniform mediump vec4 uSpecColor;
uniform mediump vec4 uEmissionColor;
uniform mediump float uCutoff;
uniform mediump float uSurface;
uniform mediump float uSmoothness;
uniform mediump float uSpecularHighlights;
uniform float uAlphaClip;
uniform vec4 uSpecGlossMap_ST;
uniform float uSmoothnessSource;
uniform float uBumpScale;
uniform mediump vec4 uRimLightColor;
uniform mediump float uShadowThreshold;
uniform mediump float uRimShadow;
uniform mediump float uRimPower;
uniform vec4 uBaseMap2_TexelSize;
uniform vec4 uBaseMap2_MipInfo;
uniform vec4 uBaseMap2_ST;
uniform mediump vec4 uBaseColor2;
uniform mediump vec4 uSpecColor2;
uniform mediump vec4 uEmissionColor2;
uniform mediump float uSmoothness2;
uniform mediump float uSpecularHighlights2;
uniform vec4 uSpecGlossMap2_ST;
uniform float uSmoothnessSource2;
uniform float uBumpScale2;
uniform mediump vec4 uRimLightColor2;
uniform mediump float uShadowThreshold2;
uniform mediump float uRimPower2;
uniform mediump float uRimShadow2;
uniform mediump float uMaskThreshold;
uniform mediump vec4 uMaskHeightRange;
uniform mediump vec4 uBackFaceColor;
uniform uint uskinned_tex_height;
uniform uint uskinned_tex_width;
uniform mediump sampler2D uBaseMap;
varying highp vec2 yohaneVarying_vs_TEXCOORD0;
varying mediump vec3 yohaneVarying_vs_TEXCOORD2;
mediump vec4 yohaneFragment_SV_TARGET0;
mediump float yohaneFragment_u_xlat16_0;
bool yohaneFragment_u_xlatb0;
mediump float yohaneFragment_u_xlat16_1;
vec4 yohaneSampleTexture(sampler2D image, vec2 coord) { return texture(image, vec2(coord.x, 1.0 - coord.y)); }
vec4 yohaneSampleTexture(sampler2D image, vec2 coord, float bias) { return texture(image, vec2(coord.x, 1.0 - coord.y), bias); }

void yohaneFragmentMain()
{
    yohaneFragment_u_xlat16_0 = yohaneSampleTexture(uBaseMap, yohaneVarying_vs_TEXCOORD0.xy, uYohaneGlobalMipBias.x).w;
    yohaneFragment_u_xlat16_1 = yohaneFragment_u_xlat16_0 + (-uCutoff);
    yohaneFragment_u_xlatb0 = yohaneFragment_u_xlat16_1<0.0;
    if(yohaneFragment_u_xlatb0){discard;}
    yohaneFragment_u_xlat16_1 = dot(yohaneVarying_vs_TEXCOORD2.xyz, yohaneVarying_vs_TEXCOORD2.xyz);
    yohaneFragment_u_xlat16_1 = inversesqrt(yohaneFragment_u_xlat16_1);
    yohaneFragment_SV_TARGET0.xyz = vec3(yohaneFragment_u_xlat16_1) * yohaneVarying_vs_TEXCOORD2.xyz;
    yohaneFragment_SV_TARGET0.w = 0.0;
    return;
}

// @end

// @section DepthNormals_ALPHATEST_ON_fragmentBody
yohaneFragmentMain();
vec3 outgoingLight = yohaneFragment_SV_TARGET0.rgb;
diffuseColor.a = yohaneFragment_SV_TARGET0.a;
// @end

// @section DepthNormals_ALPHATEST_ON_FLATNORMAL_ON_vertexPrelude
uniform vec4 uYohanehlslcc_mtx4x4unity_MatrixVP[4];
uniform vec4 uYohanehlslcc_mtx4x4unity_ObjectToWorld[4];
uniform vec4 uYohanehlslcc_mtx4x4unity_WorldToObject[4];
uniform vec4 uYohaneunity_LODFade;
uniform mediump vec4 uYohaneunity_WorldTransformParams;
uniform vec4 uYohaneunity_RenderingLayer;
uniform mediump vec4 uYohaneunity_LightData;
uniform mediump vec4 uYohaneunity_LightIndices[2];
uniform vec4 uYohaneunity_ProbesOcclusion;
uniform mediump vec4 uYohaneunity_SpecCube0_HDR;
uniform mediump vec4 uYohaneunity_SpecCube1_HDR;
uniform vec4 uYohaneunity_SpecCube0_BoxMax;
uniform vec4 uYohaneunity_SpecCube0_BoxMin;
uniform vec4 uYohaneunity_SpecCube0_ProbePosition;
uniform vec4 uYohaneunity_SpecCube1_BoxMax;
uniform vec4 uYohaneunity_SpecCube1_BoxMin;
uniform vec4 uYohaneunity_SpecCube1_ProbePosition;
uniform vec4 uYohaneunity_LightmapST;
uniform vec4 uYohaneunity_DynamicLightmapST;
uniform mediump vec4 uYohaneunity_SHAr;
uniform mediump vec4 uYohaneunity_SHAg;
uniform mediump vec4 uYohaneunity_SHAb;
uniform mediump vec4 uYohaneunity_SHBr;
uniform mediump vec4 uYohaneunity_SHBg;
uniform mediump vec4 uYohaneunity_SHBb;
uniform mediump vec4 uYohaneunity_SHC;
uniform vec4 uYohanehlslcc_mtx4x4unity_MatrixPreviousM[4];
uniform vec4 uYohanehlslcc_mtx4x4unity_MatrixPreviousMI[4];
uniform vec4 uYohaneunity_MotionVectorsParams;
uniform vec4 uBaseMap_TexelSize;
uniform vec4 uBaseMap_MipInfo;
uniform vec4 uBaseMap_ST;
uniform mediump vec4 uBaseColor;
uniform mediump vec4 uSpecColor;
uniform mediump vec4 uEmissionColor;
uniform mediump float uCutoff;
uniform mediump float uSurface;
uniform mediump float uSmoothness;
uniform mediump float uSpecularHighlights;
uniform float uAlphaClip;
uniform vec4 uSpecGlossMap_ST;
uniform float uSmoothnessSource;
uniform float uBumpScale;
uniform mediump vec4 uRimLightColor;
uniform mediump float uShadowThreshold;
uniform mediump float uRimShadow;
uniform mediump float uRimPower;
uniform vec4 uBaseMap2_TexelSize;
uniform vec4 uBaseMap2_MipInfo;
uniform vec4 uBaseMap2_ST;
uniform mediump vec4 uBaseColor2;
uniform mediump vec4 uSpecColor2;
uniform mediump vec4 uEmissionColor2;
uniform mediump float uSmoothness2;
uniform mediump float uSpecularHighlights2;
uniform vec4 uSpecGlossMap2_ST;
uniform float uSmoothnessSource2;
uniform float uBumpScale2;
uniform mediump vec4 uRimLightColor2;
uniform mediump float uShadowThreshold2;
uniform mediump float uRimPower2;
uniform mediump float uRimShadow2;
uniform mediump float uMaskThreshold;
uniform mediump vec4 uMaskHeightRange;
uniform mediump vec4 uBackFaceColor;
uniform uint uskinned_tex_height;
uniform uint uskinned_tex_width;
highp vec3 yohaneVertex_in_POSITION0;
highp vec3 yohaneVertex_in_NORMAL0;
highp vec2 yohaneVertex_in_TEXCOORD0;
varying highp vec2 yohaneVarying_vs_TEXCOORD0;
varying highp vec3 yohaneVarying_vs_TEXCOORD1;
varying mediump vec3 yohaneVarying_vs_TEXCOORD2;
vec3 yohaneVertex_u_xlat0;
vec4 yohaneVertex_u_xlat1;
float yohaneVertex_u_xlat6;
void yohaneVertexMain()
{
    yohaneVertex_u_xlat0.xyz = yohaneVertex_in_POSITION0.yyy * uYohanehlslcc_mtx4x4unity_ObjectToWorld[1].xyz;
    yohaneVertex_u_xlat0.xyz = uYohanehlslcc_mtx4x4unity_ObjectToWorld[0].xyz * yohaneVertex_in_POSITION0.xxx + yohaneVertex_u_xlat0.xyz;
    yohaneVertex_u_xlat0.xyz = uYohanehlslcc_mtx4x4unity_ObjectToWorld[2].xyz * yohaneVertex_in_POSITION0.zzz + yohaneVertex_u_xlat0.xyz;
    yohaneVertex_u_xlat0.xyz = yohaneVertex_u_xlat0.xyz + uYohanehlslcc_mtx4x4unity_ObjectToWorld[3].xyz;
    yohaneVertex_u_xlat1 = yohaneVertex_u_xlat0.yyyy * uYohanehlslcc_mtx4x4unity_MatrixVP[1];
    yohaneVertex_u_xlat1 = uYohanehlslcc_mtx4x4unity_MatrixVP[0] * yohaneVertex_u_xlat0.xxxx + yohaneVertex_u_xlat1;
    yohaneVertex_u_xlat1 = uYohanehlslcc_mtx4x4unity_MatrixVP[2] * yohaneVertex_u_xlat0.zzzz + yohaneVertex_u_xlat1;
    yohaneVarying_vs_TEXCOORD1.xyz = yohaneVertex_u_xlat0.xyz;
    gl_Position = yohaneVertex_u_xlat1 + uYohanehlslcc_mtx4x4unity_MatrixVP[3];
    yohaneVarying_vs_TEXCOORD0.xy = yohaneVertex_in_TEXCOORD0.xy * uBaseMap_ST.xy + uBaseMap_ST.zw;
    yohaneVertex_u_xlat0.x = dot(yohaneVertex_in_NORMAL0.xyz, uYohanehlslcc_mtx4x4unity_WorldToObject[0].xyz);
    yohaneVertex_u_xlat0.y = dot(yohaneVertex_in_NORMAL0.xyz, uYohanehlslcc_mtx4x4unity_WorldToObject[1].xyz);
    yohaneVertex_u_xlat0.z = dot(yohaneVertex_in_NORMAL0.xyz, uYohanehlslcc_mtx4x4unity_WorldToObject[2].xyz);
    yohaneVertex_u_xlat6 = dot(yohaneVertex_u_xlat0.xyz, yohaneVertex_u_xlat0.xyz);
    yohaneVertex_u_xlat6 = max(yohaneVertex_u_xlat6, 1.17549435e-38);
    yohaneVertex_u_xlat6 = inversesqrt(yohaneVertex_u_xlat6);
    yohaneVertex_u_xlat0.xyz = vec3(yohaneVertex_u_xlat6) * yohaneVertex_u_xlat0.xyz;
    yohaneVertex_u_xlat6 = dot(yohaneVertex_u_xlat0.xyz, yohaneVertex_u_xlat0.xyz);
    yohaneVertex_u_xlat6 = inversesqrt(yohaneVertex_u_xlat6);
    yohaneVertex_u_xlat0.xyz = vec3(yohaneVertex_u_xlat6) * yohaneVertex_u_xlat0.xyz;
    yohaneVarying_vs_TEXCOORD2.xyz = yohaneVertex_u_xlat0.xyz;
    return;
}

// @end

// @section DepthNormals_ALPHATEST_ON_FLATNORMAL_ON_vertexProject
yohaneVertex_in_POSITION0 = vec3(-transformed.x, transformed.yz);
yohaneVertex_in_NORMAL0 = vec3(-objectNormal.x, objectNormal.yz);
yohaneVertex_in_TEXCOORD0 = vec2(uv.x, 1.0 - uv.y);
yohaneVertexMain();
// @end

// @section DepthNormals_ALPHATEST_ON_FLATNORMAL_ON_fragmentPrelude
uniform vec2 uYohaneGlobalMipBias;
uniform vec4 uBaseMap_TexelSize;
uniform vec4 uBaseMap_MipInfo;
uniform vec4 uBaseMap_ST;
uniform mediump vec4 uBaseColor;
uniform mediump vec4 uSpecColor;
uniform mediump vec4 uEmissionColor;
uniform mediump float uCutoff;
uniform mediump float uSurface;
uniform mediump float uSmoothness;
uniform mediump float uSpecularHighlights;
uniform float uAlphaClip;
uniform vec4 uSpecGlossMap_ST;
uniform float uSmoothnessSource;
uniform float uBumpScale;
uniform mediump vec4 uRimLightColor;
uniform mediump float uShadowThreshold;
uniform mediump float uRimShadow;
uniform mediump float uRimPower;
uniform vec4 uBaseMap2_TexelSize;
uniform vec4 uBaseMap2_MipInfo;
uniform vec4 uBaseMap2_ST;
uniform mediump vec4 uBaseColor2;
uniform mediump vec4 uSpecColor2;
uniform mediump vec4 uEmissionColor2;
uniform mediump float uSmoothness2;
uniform mediump float uSpecularHighlights2;
uniform vec4 uSpecGlossMap2_ST;
uniform float uSmoothnessSource2;
uniform float uBumpScale2;
uniform mediump vec4 uRimLightColor2;
uniform mediump float uShadowThreshold2;
uniform mediump float uRimPower2;
uniform mediump float uRimShadow2;
uniform mediump float uMaskThreshold;
uniform mediump vec4 uMaskHeightRange;
uniform mediump vec4 uBackFaceColor;
uniform uint uskinned_tex_height;
uniform uint uskinned_tex_width;
uniform mediump sampler2D uBaseMap;
varying highp vec2 yohaneVarying_vs_TEXCOORD0;
mediump vec4 yohaneFragment_SV_TARGET0;
mediump float yohaneFragment_u_xlat16_0;
bool yohaneFragment_u_xlatb0;
mediump float yohaneFragment_u_xlat16_1;
vec4 yohaneSampleTexture(sampler2D image, vec2 coord) { return texture(image, vec2(coord.x, 1.0 - coord.y)); }
vec4 yohaneSampleTexture(sampler2D image, vec2 coord, float bias) { return texture(image, vec2(coord.x, 1.0 - coord.y), bias); }

void yohaneFragmentMain()
{
    yohaneFragment_u_xlat16_0 = yohaneSampleTexture(uBaseMap, yohaneVarying_vs_TEXCOORD0.xy, uYohaneGlobalMipBias.x).w;
    yohaneFragment_u_xlat16_1 = yohaneFragment_u_xlat16_0 + (-uCutoff);
    yohaneFragment_u_xlatb0 = yohaneFragment_u_xlat16_1<0.0;
    if(yohaneFragment_u_xlatb0){discard;}
    yohaneFragment_SV_TARGET0 = vec4(0.0, 0.0, 1.0, 0.0);
    return;
}

// @end

// @section DepthNormals_ALPHATEST_ON_FLATNORMAL_ON_fragmentBody
yohaneFragmentMain();
vec3 outgoingLight = yohaneFragment_SV_TARGET0.rgb;
diffuseColor.a = yohaneFragment_SV_TARGET0.a;
// @end

// @section ShadowCaster_BASE_vertexPrelude
uniform vec4 uYohanehlslcc_mtx4x4unity_MatrixVP[4];
uniform vec4 uYohaneShadowBias;
uniform vec3 uYohaneLightDirection;
uniform vec4 uYohanehlslcc_mtx4x4unity_ObjectToWorld[4];
uniform vec4 uYohanehlslcc_mtx4x4unity_WorldToObject[4];
uniform vec4 uYohaneunity_LODFade;
uniform mediump vec4 uYohaneunity_WorldTransformParams;
uniform vec4 uYohaneunity_RenderingLayer;
uniform mediump vec4 uYohaneunity_LightData;
uniform mediump vec4 uYohaneunity_LightIndices[2];
uniform vec4 uYohaneunity_ProbesOcclusion;
uniform mediump vec4 uYohaneunity_SpecCube0_HDR;
uniform mediump vec4 uYohaneunity_SpecCube1_HDR;
uniform vec4 uYohaneunity_SpecCube0_BoxMax;
uniform vec4 uYohaneunity_SpecCube0_BoxMin;
uniform vec4 uYohaneunity_SpecCube0_ProbePosition;
uniform vec4 uYohaneunity_SpecCube1_BoxMax;
uniform vec4 uYohaneunity_SpecCube1_BoxMin;
uniform vec4 uYohaneunity_SpecCube1_ProbePosition;
uniform vec4 uYohaneunity_LightmapST;
uniform vec4 uYohaneunity_DynamicLightmapST;
uniform mediump vec4 uYohaneunity_SHAr;
uniform mediump vec4 uYohaneunity_SHAg;
uniform mediump vec4 uYohaneunity_SHAb;
uniform mediump vec4 uYohaneunity_SHBr;
uniform mediump vec4 uYohaneunity_SHBg;
uniform mediump vec4 uYohaneunity_SHBb;
uniform mediump vec4 uYohaneunity_SHC;
uniform vec4 uYohanehlslcc_mtx4x4unity_MatrixPreviousM[4];
uniform vec4 uYohanehlslcc_mtx4x4unity_MatrixPreviousMI[4];
uniform vec4 uYohaneunity_MotionVectorsParams;
uniform vec4 uBaseMap_TexelSize;
uniform vec4 uBaseMap_MipInfo;
uniform vec4 uBaseMap_ST;
uniform mediump vec4 uBaseColor;
uniform mediump vec4 uSpecColor;
uniform mediump vec4 uEmissionColor;
uniform mediump float uCutoff;
uniform mediump float uSurface;
uniform mediump float uSmoothness;
uniform mediump float uSpecularHighlights;
uniform float uAlphaClip;
uniform vec4 uSpecGlossMap_ST;
uniform float uSmoothnessSource;
uniform float uBumpScale;
uniform mediump vec4 uRimLightColor;
uniform mediump float uShadowThreshold;
uniform mediump float uRimShadow;
uniform mediump float uRimPower;
uniform vec4 uBaseMap2_TexelSize;
uniform vec4 uBaseMap2_MipInfo;
uniform vec4 uBaseMap2_ST;
uniform mediump vec4 uBaseColor2;
uniform mediump vec4 uSpecColor2;
uniform mediump vec4 uEmissionColor2;
uniform mediump float uSmoothness2;
uniform mediump float uSpecularHighlights2;
uniform vec4 uSpecGlossMap2_ST;
uniform float uSmoothnessSource2;
uniform float uBumpScale2;
uniform mediump vec4 uRimLightColor2;
uniform mediump float uShadowThreshold2;
uniform mediump float uRimPower2;
uniform mediump float uRimShadow2;
uniform mediump float uMaskThreshold;
uniform mediump vec4 uMaskHeightRange;
uniform mediump vec4 uBackFaceColor;
uniform uint uskinned_tex_height;
uniform uint uskinned_tex_width;
highp vec4 yohaneVertex_in_POSITION0;
highp vec3 yohaneVertex_in_NORMAL0;
highp vec2 yohaneVertex_in_TEXCOORD0;
varying highp vec2 yohaneVarying_vs_TEXCOORD0;
varying highp vec3 yohaneVarying_vs_TEXCOORD1;
vec4 yohaneVertex_u_xlat0;
vec4 yohaneVertex_u_xlat1;
vec3 yohaneVertex_u_xlat2;
float yohaneVertex_u_xlat9;
void yohaneVertexMain()
{
    yohaneVertex_u_xlat0.x = dot(yohaneVertex_in_NORMAL0.xyz, uYohanehlslcc_mtx4x4unity_WorldToObject[0].xyz);
    yohaneVertex_u_xlat0.y = dot(yohaneVertex_in_NORMAL0.xyz, uYohanehlslcc_mtx4x4unity_WorldToObject[1].xyz);
    yohaneVertex_u_xlat0.z = dot(yohaneVertex_in_NORMAL0.xyz, uYohanehlslcc_mtx4x4unity_WorldToObject[2].xyz);
    yohaneVertex_u_xlat9 = dot(yohaneVertex_u_xlat0.xyz, yohaneVertex_u_xlat0.xyz);
    yohaneVertex_u_xlat9 = max(yohaneVertex_u_xlat9, 1.17549435e-38);
    yohaneVertex_u_xlat9 = inversesqrt(yohaneVertex_u_xlat9);
    yohaneVertex_u_xlat0.xyz = vec3(yohaneVertex_u_xlat9) * yohaneVertex_u_xlat0.xyz;
    yohaneVertex_u_xlat9 = dot(uYohaneLightDirection.xyz, yohaneVertex_u_xlat0.xyz);
    yohaneVertex_u_xlat9 = clamp(yohaneVertex_u_xlat9, 0.0, 1.0);
    yohaneVertex_u_xlat9 = (-yohaneVertex_u_xlat9) + 1.0;
    yohaneVertex_u_xlat9 = yohaneVertex_u_xlat9 * uYohaneShadowBias.y;
    yohaneVertex_u_xlat1.xyz = yohaneVertex_in_POSITION0.yyy * uYohanehlslcc_mtx4x4unity_ObjectToWorld[1].xyz;
    yohaneVertex_u_xlat1.xyz = uYohanehlslcc_mtx4x4unity_ObjectToWorld[0].xyz * yohaneVertex_in_POSITION0.xxx + yohaneVertex_u_xlat1.xyz;
    yohaneVertex_u_xlat1.xyz = uYohanehlslcc_mtx4x4unity_ObjectToWorld[2].xyz * yohaneVertex_in_POSITION0.zzz + yohaneVertex_u_xlat1.xyz;
    yohaneVertex_u_xlat1.xyz = yohaneVertex_u_xlat1.xyz + uYohanehlslcc_mtx4x4unity_ObjectToWorld[3].xyz;
    yohaneVertex_u_xlat2.xyz = uYohaneLightDirection.xyz * uYohaneShadowBias.xxx + yohaneVertex_u_xlat1.xyz;
    yohaneVarying_vs_TEXCOORD1.xyz = yohaneVertex_u_xlat1.xyz;
    yohaneVertex_u_xlat0.xyz = yohaneVertex_u_xlat0.xyz * vec3(yohaneVertex_u_xlat9) + yohaneVertex_u_xlat2.xyz;
    yohaneVertex_u_xlat1 = yohaneVertex_u_xlat0.yyyy * uYohanehlslcc_mtx4x4unity_MatrixVP[1];
    yohaneVertex_u_xlat1 = uYohanehlslcc_mtx4x4unity_MatrixVP[0] * yohaneVertex_u_xlat0.xxxx + yohaneVertex_u_xlat1;
    yohaneVertex_u_xlat0 = uYohanehlslcc_mtx4x4unity_MatrixVP[2] * yohaneVertex_u_xlat0.zzzz + yohaneVertex_u_xlat1;
    yohaneVertex_u_xlat0 = yohaneVertex_u_xlat0 + uYohanehlslcc_mtx4x4unity_MatrixVP[3];
    gl_Position.z = max(yohaneVertex_u_xlat0.z, -1.0);
    gl_Position.xyw = yohaneVertex_u_xlat0.xyw;
    yohaneVarying_vs_TEXCOORD0.xy = yohaneVertex_in_TEXCOORD0.xy * uBaseMap_ST.xy + uBaseMap_ST.zw;
    return;
}

// @end

// @section ShadowCaster_BASE_vertexProject
yohaneVertex_in_POSITION0 = vec4(-transformed.x, transformed.yz, 1.0);
yohaneVertex_in_NORMAL0 = vec3(-objectNormal.x, objectNormal.yz);
yohaneVertex_in_TEXCOORD0 = vec2(uv.x, 1.0 - uv.y);
yohaneVertexMain();
// @end

// @section ShadowCaster_BASE_fragmentPrelude
mediump vec4 yohaneFragment_SV_TARGET0;
void yohaneFragmentMain()
{
    yohaneFragment_SV_TARGET0 = vec4(0.0, 0.0, 0.0, 0.0);
    return;
}

// @end

// @section ShadowCaster_BASE_fragmentBody
yohaneFragmentMain();
vec3 outgoingLight = yohaneFragment_SV_TARGET0.rgb;
diffuseColor.a = yohaneFragment_SV_TARGET0.a;
// @end

// @section ShadowCaster_ALPHATEST_ON_vertexPrelude
uniform vec4 uYohanehlslcc_mtx4x4unity_MatrixVP[4];
uniform vec4 uYohaneShadowBias;
uniform vec3 uYohaneLightDirection;
uniform vec4 uYohanehlslcc_mtx4x4unity_ObjectToWorld[4];
uniform vec4 uYohanehlslcc_mtx4x4unity_WorldToObject[4];
uniform vec4 uYohaneunity_LODFade;
uniform mediump vec4 uYohaneunity_WorldTransformParams;
uniform vec4 uYohaneunity_RenderingLayer;
uniform mediump vec4 uYohaneunity_LightData;
uniform mediump vec4 uYohaneunity_LightIndices[2];
uniform vec4 uYohaneunity_ProbesOcclusion;
uniform mediump vec4 uYohaneunity_SpecCube0_HDR;
uniform mediump vec4 uYohaneunity_SpecCube1_HDR;
uniform vec4 uYohaneunity_SpecCube0_BoxMax;
uniform vec4 uYohaneunity_SpecCube0_BoxMin;
uniform vec4 uYohaneunity_SpecCube0_ProbePosition;
uniform vec4 uYohaneunity_SpecCube1_BoxMax;
uniform vec4 uYohaneunity_SpecCube1_BoxMin;
uniform vec4 uYohaneunity_SpecCube1_ProbePosition;
uniform vec4 uYohaneunity_LightmapST;
uniform vec4 uYohaneunity_DynamicLightmapST;
uniform mediump vec4 uYohaneunity_SHAr;
uniform mediump vec4 uYohaneunity_SHAg;
uniform mediump vec4 uYohaneunity_SHAb;
uniform mediump vec4 uYohaneunity_SHBr;
uniform mediump vec4 uYohaneunity_SHBg;
uniform mediump vec4 uYohaneunity_SHBb;
uniform mediump vec4 uYohaneunity_SHC;
uniform vec4 uYohanehlslcc_mtx4x4unity_MatrixPreviousM[4];
uniform vec4 uYohanehlslcc_mtx4x4unity_MatrixPreviousMI[4];
uniform vec4 uYohaneunity_MotionVectorsParams;
uniform vec4 uBaseMap_TexelSize;
uniform vec4 uBaseMap_MipInfo;
uniform vec4 uBaseMap_ST;
uniform mediump vec4 uBaseColor;
uniform mediump vec4 uSpecColor;
uniform mediump vec4 uEmissionColor;
uniform mediump float uCutoff;
uniform mediump float uSurface;
uniform mediump float uSmoothness;
uniform mediump float uSpecularHighlights;
uniform float uAlphaClip;
uniform vec4 uSpecGlossMap_ST;
uniform float uSmoothnessSource;
uniform float uBumpScale;
uniform mediump vec4 uRimLightColor;
uniform mediump float uShadowThreshold;
uniform mediump float uRimShadow;
uniform mediump float uRimPower;
uniform vec4 uBaseMap2_TexelSize;
uniform vec4 uBaseMap2_MipInfo;
uniform vec4 uBaseMap2_ST;
uniform mediump vec4 uBaseColor2;
uniform mediump vec4 uSpecColor2;
uniform mediump vec4 uEmissionColor2;
uniform mediump float uSmoothness2;
uniform mediump float uSpecularHighlights2;
uniform vec4 uSpecGlossMap2_ST;
uniform float uSmoothnessSource2;
uniform float uBumpScale2;
uniform mediump vec4 uRimLightColor2;
uniform mediump float uShadowThreshold2;
uniform mediump float uRimPower2;
uniform mediump float uRimShadow2;
uniform mediump float uMaskThreshold;
uniform mediump vec4 uMaskHeightRange;
uniform mediump vec4 uBackFaceColor;
uniform uint uskinned_tex_height;
uniform uint uskinned_tex_width;
highp vec4 yohaneVertex_in_POSITION0;
highp vec3 yohaneVertex_in_NORMAL0;
highp vec2 yohaneVertex_in_TEXCOORD0;
varying highp vec2 yohaneVarying_vs_TEXCOORD0;
varying highp vec3 yohaneVarying_vs_TEXCOORD1;
vec4 yohaneVertex_u_xlat0;
vec4 yohaneVertex_u_xlat1;
vec3 yohaneVertex_u_xlat2;
float yohaneVertex_u_xlat9;
void yohaneVertexMain()
{
    yohaneVertex_u_xlat0.x = dot(yohaneVertex_in_NORMAL0.xyz, uYohanehlslcc_mtx4x4unity_WorldToObject[0].xyz);
    yohaneVertex_u_xlat0.y = dot(yohaneVertex_in_NORMAL0.xyz, uYohanehlslcc_mtx4x4unity_WorldToObject[1].xyz);
    yohaneVertex_u_xlat0.z = dot(yohaneVertex_in_NORMAL0.xyz, uYohanehlslcc_mtx4x4unity_WorldToObject[2].xyz);
    yohaneVertex_u_xlat9 = dot(yohaneVertex_u_xlat0.xyz, yohaneVertex_u_xlat0.xyz);
    yohaneVertex_u_xlat9 = max(yohaneVertex_u_xlat9, 1.17549435e-38);
    yohaneVertex_u_xlat9 = inversesqrt(yohaneVertex_u_xlat9);
    yohaneVertex_u_xlat0.xyz = vec3(yohaneVertex_u_xlat9) * yohaneVertex_u_xlat0.xyz;
    yohaneVertex_u_xlat9 = dot(uYohaneLightDirection.xyz, yohaneVertex_u_xlat0.xyz);
    yohaneVertex_u_xlat9 = clamp(yohaneVertex_u_xlat9, 0.0, 1.0);
    yohaneVertex_u_xlat9 = (-yohaneVertex_u_xlat9) + 1.0;
    yohaneVertex_u_xlat9 = yohaneVertex_u_xlat9 * uYohaneShadowBias.y;
    yohaneVertex_u_xlat1.xyz = yohaneVertex_in_POSITION0.yyy * uYohanehlslcc_mtx4x4unity_ObjectToWorld[1].xyz;
    yohaneVertex_u_xlat1.xyz = uYohanehlslcc_mtx4x4unity_ObjectToWorld[0].xyz * yohaneVertex_in_POSITION0.xxx + yohaneVertex_u_xlat1.xyz;
    yohaneVertex_u_xlat1.xyz = uYohanehlslcc_mtx4x4unity_ObjectToWorld[2].xyz * yohaneVertex_in_POSITION0.zzz + yohaneVertex_u_xlat1.xyz;
    yohaneVertex_u_xlat1.xyz = yohaneVertex_u_xlat1.xyz + uYohanehlslcc_mtx4x4unity_ObjectToWorld[3].xyz;
    yohaneVertex_u_xlat2.xyz = uYohaneLightDirection.xyz * uYohaneShadowBias.xxx + yohaneVertex_u_xlat1.xyz;
    yohaneVarying_vs_TEXCOORD1.xyz = yohaneVertex_u_xlat1.xyz;
    yohaneVertex_u_xlat0.xyz = yohaneVertex_u_xlat0.xyz * vec3(yohaneVertex_u_xlat9) + yohaneVertex_u_xlat2.xyz;
    yohaneVertex_u_xlat1 = yohaneVertex_u_xlat0.yyyy * uYohanehlslcc_mtx4x4unity_MatrixVP[1];
    yohaneVertex_u_xlat1 = uYohanehlslcc_mtx4x4unity_MatrixVP[0] * yohaneVertex_u_xlat0.xxxx + yohaneVertex_u_xlat1;
    yohaneVertex_u_xlat0 = uYohanehlslcc_mtx4x4unity_MatrixVP[2] * yohaneVertex_u_xlat0.zzzz + yohaneVertex_u_xlat1;
    yohaneVertex_u_xlat0 = yohaneVertex_u_xlat0 + uYohanehlslcc_mtx4x4unity_MatrixVP[3];
    gl_Position.z = max(yohaneVertex_u_xlat0.z, -1.0);
    gl_Position.xyw = yohaneVertex_u_xlat0.xyw;
    yohaneVarying_vs_TEXCOORD0.xy = yohaneVertex_in_TEXCOORD0.xy * uBaseMap_ST.xy + uBaseMap_ST.zw;
    return;
}

// @end

// @section ShadowCaster_ALPHATEST_ON_vertexProject
yohaneVertex_in_POSITION0 = vec4(-transformed.x, transformed.yz, 1.0);
yohaneVertex_in_NORMAL0 = vec3(-objectNormal.x, objectNormal.yz);
yohaneVertex_in_TEXCOORD0 = vec2(uv.x, 1.0 - uv.y);
yohaneVertexMain();
// @end

// @section ShadowCaster_ALPHATEST_ON_fragmentPrelude
uniform vec2 uYohaneGlobalMipBias;
uniform vec4 uBaseMap_TexelSize;
uniform vec4 uBaseMap_MipInfo;
uniform vec4 uBaseMap_ST;
uniform mediump vec4 uBaseColor;
uniform mediump vec4 uSpecColor;
uniform mediump vec4 uEmissionColor;
uniform mediump float uCutoff;
uniform mediump float uSurface;
uniform mediump float uSmoothness;
uniform mediump float uSpecularHighlights;
uniform float uAlphaClip;
uniform vec4 uSpecGlossMap_ST;
uniform float uSmoothnessSource;
uniform float uBumpScale;
uniform mediump vec4 uRimLightColor;
uniform mediump float uShadowThreshold;
uniform mediump float uRimShadow;
uniform mediump float uRimPower;
uniform vec4 uBaseMap2_TexelSize;
uniform vec4 uBaseMap2_MipInfo;
uniform vec4 uBaseMap2_ST;
uniform mediump vec4 uBaseColor2;
uniform mediump vec4 uSpecColor2;
uniform mediump vec4 uEmissionColor2;
uniform mediump float uSmoothness2;
uniform mediump float uSpecularHighlights2;
uniform vec4 uSpecGlossMap2_ST;
uniform float uSmoothnessSource2;
uniform float uBumpScale2;
uniform mediump vec4 uRimLightColor2;
uniform mediump float uShadowThreshold2;
uniform mediump float uRimPower2;
uniform mediump float uRimShadow2;
uniform mediump float uMaskThreshold;
uniform mediump vec4 uMaskHeightRange;
uniform mediump vec4 uBackFaceColor;
uniform uint uskinned_tex_height;
uniform uint uskinned_tex_width;
uniform mediump sampler2D uBaseMap;
varying highp vec2 yohaneVarying_vs_TEXCOORD0;
mediump vec4 yohaneFragment_SV_TARGET0;
mediump float yohaneFragment_u_xlat16_0;
bool yohaneFragment_u_xlatb0;
mediump float yohaneFragment_u_xlat16_1;
vec4 yohaneSampleTexture(sampler2D image, vec2 coord) { return texture(image, vec2(coord.x, 1.0 - coord.y)); }
vec4 yohaneSampleTexture(sampler2D image, vec2 coord, float bias) { return texture(image, vec2(coord.x, 1.0 - coord.y), bias); }

void yohaneFragmentMain()
{
    yohaneFragment_u_xlat16_0 = yohaneSampleTexture(uBaseMap, yohaneVarying_vs_TEXCOORD0.xy, uYohaneGlobalMipBias.x).w;
    yohaneFragment_u_xlat16_1 = yohaneFragment_u_xlat16_0 * uBaseColor.w + (-uCutoff);
    yohaneFragment_u_xlatb0 = yohaneFragment_u_xlat16_1<0.0;
    if(yohaneFragment_u_xlatb0){discard;}
    yohaneFragment_SV_TARGET0 = vec4(0.0, 0.0, 0.0, 0.0);
    return;
}

// @end

// @section ShadowCaster_ALPHATEST_ON_fragmentBody
yohaneFragmentMain();
vec3 outgoingLight = yohaneFragment_SV_TARGET0.rgb;
diffuseColor.a = yohaneFragment_SV_TARGET0.a;
// @end
