// Fullscreen outline and output-copy programs owned by the render profile.
export const profilePrograms = {
  outline: {
    vertexShader: `
uniform 	vec4 _ProjectionParams;
uniform 	vec4 hlslcc_mtx4x4unity_MatrixVP[4];
	uniform vec4 hlslcc_mtx4x4unity_ObjectToWorld[4];
	uniform vec4 hlslcc_mtx4x4unity_WorldToObject[4];
	uniform vec4 unity_LODFade;
	uniform mediump vec4 unity_WorldTransformParams;
	uniform vec4 unity_RenderingLayer;
	uniform mediump vec4 unity_LightData;
	uniform mediump vec4 unity_LightIndices[2];
	uniform vec4 unity_ProbesOcclusion;
	uniform mediump vec4 unity_SpecCube0_HDR;
	uniform mediump vec4 unity_SpecCube1_HDR;
	uniform vec4 unity_SpecCube0_BoxMax;
	uniform vec4 unity_SpecCube0_BoxMin;
	uniform vec4 unity_SpecCube0_ProbePosition;
	uniform vec4 unity_SpecCube1_BoxMax;
	uniform vec4 unity_SpecCube1_BoxMin;
	uniform vec4 unity_SpecCube1_ProbePosition;
	uniform vec4 unity_LightmapST;
	uniform vec4 unity_DynamicLightmapST;
	uniform mediump vec4 unity_SHAr;
	uniform mediump vec4 unity_SHAg;
	uniform mediump vec4 unity_SHAb;
	uniform mediump vec4 unity_SHBr;
	uniform mediump vec4 unity_SHBg;
	uniform mediump vec4 unity_SHBb;
	uniform mediump vec4 unity_SHC;
	uniform vec4 hlslcc_mtx4x4unity_MatrixPreviousM[4];
	uniform vec4 hlslcc_mtx4x4unity_MatrixPreviousMI[4];
	uniform vec4 unity_MotionVectorsParams;
in highp vec4 in_POSITION0;
in highp vec2 in_TEXCOORD0;
out highp vec2 vs_TEXCOORD0;
out highp vec2 vs_TEXCOORD1;
vec4 u_xlat0;
vec4 u_xlat1;
float u_xlat2;
void main()
{
    u_xlat0 = in_POSITION0.yyyy * hlslcc_mtx4x4unity_ObjectToWorld[1];
    u_xlat0 = hlslcc_mtx4x4unity_ObjectToWorld[0] * in_POSITION0.xxxx + u_xlat0;
    u_xlat0 = hlslcc_mtx4x4unity_ObjectToWorld[2] * in_POSITION0.zzzz + u_xlat0;
    u_xlat0 = u_xlat0 + hlslcc_mtx4x4unity_ObjectToWorld[3];
    u_xlat1 = u_xlat0.yyyy * hlslcc_mtx4x4unity_MatrixVP[1];
    u_xlat1 = hlslcc_mtx4x4unity_MatrixVP[0] * u_xlat0.xxxx + u_xlat1;
    u_xlat1 = hlslcc_mtx4x4unity_MatrixVP[2] * u_xlat0.zzzz + u_xlat1;
    u_xlat0 = hlslcc_mtx4x4unity_MatrixVP[3] * u_xlat0.wwww + u_xlat1;
    gl_Position = u_xlat0;
    u_xlat2 = u_xlat0.y * _ProjectionParams.x;
    u_xlat0.xz = u_xlat0.xw * vec2(0.5, 0.5);
    u_xlat0.w = u_xlat2 * 0.5;
    vs_TEXCOORD1.xy = u_xlat0.zz + u_xlat0.xw;
    vs_TEXCOORD0.xy = in_TEXCOORD0.xy;
    return;
}
`,
    fragmentShader: `precision highp float;
precision highp int;

uniform 	vec4 _ScreenParams;
uniform 	vec2 _GlobalMipBias;
uniform 	vec4 _ZBufferParams;
uniform 	mediump vec4 _OutlineColor;
uniform 	mediump float _OutlineWidth;
uniform 	mediump float _DepthScale;
uniform 	mediump float _Threshold;
uniform highp sampler2D _CameraDepthTexture;
uniform highp sampler2D _CameraNormalsTexture;
uniform mediump sampler2D _MainTex;
in highp vec2 vs_TEXCOORD0;
out mediump vec4 SV_Target0;
vec4 u_xlat0;
mediump float u_xlat10_0;
bool u_xlatb0;
vec4 u_xlat1;
mediump float u_xlat10_1;
mediump vec4 u_xlat16_2;
vec4 u_xlat3;
mediump vec4 u_xlat10_4;
mediump vec4 u_xlat10_5;
vec2 u_xlat6;
mediump vec4 u_xlat10_7;
vec4 u_xlat8;
mediump vec4 u_xlat10_9;
mediump vec4 u_xlat10_10;
mediump vec4 u_xlat10_11;
mediump vec4 u_xlat10_12;
mediump vec4 u_xlat10_13;
vec3 u_xlat14;
float u_xlat42;
void main()
{
    u_xlat0 = _ScreenParams.zwzw + vec4(-1.0, -1.0, -1.0, -1.0);
    u_xlat1 = u_xlat0 * vec4(_OutlineWidth);
    u_xlat16_2 = texture(_MainTex, vs_TEXCOORD0.xy, _GlobalMipBias.x);
    u_xlat3 = u_xlat1.zwzw * vec4(-1.0, 1.0, 0.0, 1.0) + vs_TEXCOORD0.xyxy;
    u_xlat10_4.xyz = texture(_CameraNormalsTexture, u_xlat3.xy, _GlobalMipBias.x).xyz;
    u_xlat0.x = dot(u_xlat10_4.xyz, u_xlat10_4.xyz);
    u_xlat10_5.xyz = texture(_CameraNormalsTexture, u_xlat3.zw, _GlobalMipBias.x).xyz;
    u_xlat14.x = dot(u_xlat10_5.xyz, u_xlat10_5.xyz);
    u_xlat0.x = u_xlat14.x + u_xlat0.x;
    u_xlat6.xy = u_xlat0.zw * vec2(_OutlineWidth) + vs_TEXCOORD0.xy;
    u_xlat10_7.xyz = texture(_CameraNormalsTexture, u_xlat6.xy, _GlobalMipBias.x).xyz;
    u_xlat14.x = dot(u_xlat10_7.xyz, u_xlat10_7.xyz);
    u_xlat0.x = u_xlat14.x + u_xlat0.x;
    u_xlat8 = u_xlat1.zwzw * vec4(-1.0, 0.0, 1.0, 0.0) + vs_TEXCOORD0.xyxy;
    u_xlat10_9.xyz = texture(_CameraNormalsTexture, u_xlat8.xy, _GlobalMipBias.x).xyz;
    u_xlat14.x = dot(u_xlat10_9.xyz, u_xlat10_9.xyz);
    u_xlat0.x = u_xlat14.x + u_xlat0.x;
    u_xlat10_10.xyz = texture(_CameraNormalsTexture, u_xlat8.zw, _GlobalMipBias.x).xyz;
    u_xlat14.x = dot(u_xlat10_10.xyz, u_xlat10_10.xyz);
    u_xlat0.x = u_xlat14.x + u_xlat0.x;
    u_xlat14.xy = (-u_xlat0.zw) * vec2(_OutlineWidth) + vs_TEXCOORD0.xy;
    u_xlat10_11.xyz = texture(_CameraNormalsTexture, u_xlat14.xy, _GlobalMipBias.x).xyz;
    u_xlat42 = dot(u_xlat10_11.xyz, u_xlat10_11.xyz);
    u_xlat0.x = u_xlat42 + u_xlat0.x;
    u_xlat1 = u_xlat1 * vec4(0.0, -1.0, 1.0, -1.0) + vs_TEXCOORD0.xyxy;
    u_xlat10_12.xyz = texture(_CameraNormalsTexture, u_xlat1.xy, _GlobalMipBias.x).xyz;
    u_xlat42 = dot(u_xlat10_12.xyz, u_xlat10_12.xyz);
    u_xlat0.x = u_xlat42 + u_xlat0.x;
    u_xlat10_13.xyz = texture(_CameraNormalsTexture, u_xlat1.zw, _GlobalMipBias.x).xyz;
    u_xlat42 = dot(u_xlat10_13.xyz, u_xlat10_13.xyz);
    u_xlat0.x = u_xlat42 + u_xlat0.x;
    u_xlatb0 = 0.100000001>=u_xlat0.x;
    if(u_xlatb0){
        SV_Target0 = u_xlat16_2;
        return;
    }
    u_xlat10_0 = texture(_CameraDepthTexture, u_xlat3.xy, _GlobalMipBias.x).x;
    u_xlat0.x = _ZBufferParams.z * u_xlat10_0 + _ZBufferParams.w;
    u_xlat0.x = float(1.0) / u_xlat0.x;
    u_xlat10_4.w = u_xlat0.x * _DepthScale;
    u_xlat10_0 = texture(_CameraDepthTexture, u_xlat3.zw, _GlobalMipBias.x).x;
    u_xlat0.x = _ZBufferParams.z * u_xlat10_0 + _ZBufferParams.w;
    u_xlat0.x = float(1.0) / u_xlat0.x;
    u_xlat10_5.w = u_xlat0.x * _DepthScale;
    u_xlat3 = u_xlat10_4 + u_xlat10_5;
    u_xlat10_0 = texture(_CameraDepthTexture, u_xlat6.xy, _GlobalMipBias.x).x;
    u_xlat0.x = _ZBufferParams.z * u_xlat10_0 + _ZBufferParams.w;
    u_xlat0.x = float(1.0) / u_xlat0.x;
    u_xlat10_7.w = u_xlat0.x * _DepthScale;
    u_xlat3 = u_xlat3 + u_xlat10_7;
    u_xlat10_0 = texture(_CameraDepthTexture, u_xlat8.xy, _GlobalMipBias.x).x;
    u_xlat0.x = _ZBufferParams.z * u_xlat10_0 + _ZBufferParams.w;
    u_xlat0.x = float(1.0) / u_xlat0.x;
    u_xlat10_9.w = u_xlat0.x * _DepthScale;
    u_xlat3 = u_xlat3 + u_xlat10_9;
    u_xlat10_4.xyz = texture(_CameraNormalsTexture, vs_TEXCOORD0.xy, _GlobalMipBias.x).xyz;
    u_xlat10_0 = texture(_CameraDepthTexture, vs_TEXCOORD0.xy, _GlobalMipBias.x).x;
    u_xlat0.x = _ZBufferParams.z * u_xlat10_0 + _ZBufferParams.w;
    u_xlat0.x = float(1.0) / u_xlat0.x;
    u_xlat10_4.w = u_xlat0.x * _DepthScale;
    u_xlat3 = u_xlat10_4 * vec4(-8.0, -8.0, -8.0, -8.0) + u_xlat3;
    u_xlat10_0 = texture(_CameraDepthTexture, u_xlat8.zw, _GlobalMipBias.x).x;
    u_xlat0.x = _ZBufferParams.z * u_xlat10_0 + _ZBufferParams.w;
    u_xlat0.x = float(1.0) / u_xlat0.x;
    u_xlat10_10.w = u_xlat0.x * _DepthScale;
    u_xlat3 = u_xlat3 + u_xlat10_10;
    u_xlat10_0 = texture(_CameraDepthTexture, u_xlat14.xy, _GlobalMipBias.x).x;
    u_xlat0.x = _ZBufferParams.z * u_xlat10_0 + _ZBufferParams.w;
    u_xlat0.x = float(1.0) / u_xlat0.x;
    u_xlat10_11.w = u_xlat0.x * _DepthScale;
    u_xlat0 = u_xlat3 + u_xlat10_11;
    u_xlat10_1 = texture(_CameraDepthTexture, u_xlat1.xy, _GlobalMipBias.x).x;
    u_xlat1.x = _ZBufferParams.z * u_xlat10_1 + _ZBufferParams.w;
    u_xlat1.x = float(1.0) / u_xlat1.x;
    u_xlat10_12.w = u_xlat1.x * _DepthScale;
    u_xlat0 = u_xlat0 + u_xlat10_12;
    u_xlat10_1 = texture(_CameraDepthTexture, u_xlat1.zw, _GlobalMipBias.x).x;
    u_xlat1.x = _ZBufferParams.z * u_xlat10_1 + _ZBufferParams.w;
    u_xlat1.x = float(1.0) / u_xlat1.x;
    u_xlat10_13.w = u_xlat1.x * _DepthScale;
    u_xlat0 = u_xlat0 + u_xlat10_13;
    u_xlat0.xy = max(u_xlat0.yw, u_xlat0.xz);
    u_xlat0.x = max(u_xlat0.y, u_xlat0.x);
    u_xlatb0 = u_xlat0.x>=_Threshold;
    u_xlat0.x = u_xlatb0 ? 1.0 : float(0.0);
    u_xlat14.xyz = _OutlineColor.xyz + vec3(-1.0, -1.0, -1.0);
    u_xlat0.xyz = u_xlat0.xxx * u_xlat14.xyz + vec3(1.0, 1.0, 1.0);
    u_xlat0.xyz = u_xlat0.xyz * u_xlat16_2.xyz;
    SV_Target0.xyz = u_xlat0.xyz;
    SV_Target0.w = 1.0;
    return;
}
`,
  },
  copy: {
    vertexShader: `varying vec2 copyUv;
void main() {
  copyUv = uv;
  gl_Position = vec4(position, 1.0);
}
`,
    fragmentShader: `uniform sampler2D uSource;
varying vec2 copyUv;
void main() {
  gl_FragColor = texture2D(uSource, copyUv);
  #include <colorspace_fragment>
}
`,
  },
};
