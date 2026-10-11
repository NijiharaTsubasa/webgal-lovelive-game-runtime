// Fragment bodies are the original APK GLES programs, with Unity binding macros removed.
// The fullscreen vertex stage is a host adapter: UV and clip position remain identical.
export const bloomVertexShader = `
precision highp float;
in vec3 position;
in vec2 uv;
out vec2 vs_TEXCOORD0;
void main() {
  vs_TEXCOORD0 = uv;
  gl_Position = vec4(position, 1.0);
}
`;

export const bloomPrograms = {
  // Bloom pass prefilter: program 9-0004, no HQ or RGBM keywords.
  prefilter: `
precision highp float;
precision highp int;
uniform 	vec2 _GlobalMipBias;
uniform 	vec4 _Params;
uniform mediump sampler2D _SourceTex;
in highp vec2 vs_TEXCOORD0;
layout(location = 0) out mediump vec4 SV_Target0;
float u_xlat0;
mediump vec3 u_xlat16_1;
float u_xlat2;
vec3 u_xlat3;
mediump vec3 u_xlat10_3;
mediump float u_xlat16_4;
float u_xlat5;
void main()
{
    u_xlat0 = _Params.w + _Params.w;
    u_xlat10_3.xyz = texture(_SourceTex, vs_TEXCOORD0.xy, _GlobalMipBias.x).xyz;
    u_xlat3.xyz = min(u_xlat10_3.xyz, _Params.yyy);
    u_xlat16_1.x = max(u_xlat3.y, u_xlat3.x);
    u_xlat16_1.x = max(u_xlat3.z, u_xlat16_1.x);
    u_xlat2 = u_xlat16_1.x + (-_Params.z);
    u_xlat16_1.x = max(u_xlat16_1.x, 9.99999975e-05);
    u_xlat5 = u_xlat2 + _Params.w;
    u_xlat5 = max(u_xlat5, 0.0);
    u_xlat0 = min(u_xlat0, u_xlat5);
    u_xlat16_4 = u_xlat0 * u_xlat0;
    u_xlat0 = _Params.w * 4.0 + 9.99999975e-05;
    u_xlat0 = u_xlat16_4 / u_xlat0;
    u_xlat0 = max(u_xlat0, u_xlat2);
    u_xlat0 = u_xlat0 / u_xlat16_1.x;
    u_xlat16_1.xyz = vec3(u_xlat0) * u_xlat3.xyz;
    SV_Target0.xyz = max(u_xlat16_1.xyz, vec3(0.0, 0.0, 0.0));
    SV_Target0.w = 1.0;
    return;
}
`,
  // Bloom pass horizontal: program 9-0014, no HQ or RGBM keywords.
  horizontal: `
precision highp float;
precision highp int;
uniform 	vec2 _GlobalMipBias;
uniform 	vec4 _SourceTex_TexelSize;
uniform mediump sampler2D _SourceTex;
in highp vec2 vs_TEXCOORD0;
layout(location = 0) out mediump vec4 SV_Target0;
vec4 u_xlat0;
mediump vec3 u_xlat10_0;
vec4 u_xlat1;
mediump vec3 u_xlat10_1;
vec4 u_xlat2;
mediump vec3 u_xlat10_2;
mediump vec3 u_xlat16_3;
mediump vec3 u_xlat10_4;
void main()
{
    u_xlat0.xz = _SourceTex_TexelSize.xx * vec2(8.0, 6.0);
    u_xlat0.y = float(0.0);
    u_xlat0.w = float(0.0);
    u_xlat1 = (-u_xlat0) + vs_TEXCOORD0.xyxy;
    u_xlat0 = u_xlat0.zwxw + vs_TEXCOORD0.xyxy;
    u_xlat10_2.xyz = texture(_SourceTex, u_xlat1.zw, _GlobalMipBias.x).xyz;
    u_xlat10_1.xyz = texture(_SourceTex, u_xlat1.xy, _GlobalMipBias.x).xyz;
    u_xlat16_3.xyz = u_xlat10_2.xyz * vec3(0.0540540516, 0.0540540516, 0.0540540516);
    u_xlat16_3.xyz = u_xlat10_1.xyz * vec3(0.0162162203, 0.0162162203, 0.0162162203) + u_xlat16_3.xyz;
    u_xlat1.xz = _SourceTex_TexelSize.xx * vec2(4.0, 2.0);
    u_xlat1.y = float(0.0);
    u_xlat1.w = float(0.0);
    u_xlat2 = (-u_xlat1) + vs_TEXCOORD0.xyxy;
    u_xlat1 = u_xlat1.zwxy + vs_TEXCOORD0.xyxy;
    u_xlat10_4.xyz = texture(_SourceTex, u_xlat2.xy, _GlobalMipBias.x).xyz;
    u_xlat10_2.xyz = texture(_SourceTex, u_xlat2.zw, _GlobalMipBias.x).xyz;
    u_xlat16_3.xyz = u_xlat10_4.xyz * vec3(0.121621624, 0.121621624, 0.121621624) + u_xlat16_3.xyz;
    u_xlat16_3.xyz = u_xlat10_2.xyz * vec3(0.194594592, 0.194594592, 0.194594592) + u_xlat16_3.xyz;
    u_xlat10_2.xyz = texture(_SourceTex, vs_TEXCOORD0.xy, _GlobalMipBias.x).xyz;
    u_xlat16_3.xyz = u_xlat10_2.xyz * vec3(0.227027029, 0.227027029, 0.227027029) + u_xlat16_3.xyz;
    u_xlat10_2.xyz = texture(_SourceTex, u_xlat1.xy, _GlobalMipBias.x).xyz;
    u_xlat10_1.xyz = texture(_SourceTex, u_xlat1.zw, _GlobalMipBias.x).xyz;
    u_xlat16_3.xyz = u_xlat10_2.xyz * vec3(0.194594592, 0.194594592, 0.194594592) + u_xlat16_3.xyz;
    u_xlat16_3.xyz = u_xlat10_1.xyz * vec3(0.121621624, 0.121621624, 0.121621624) + u_xlat16_3.xyz;
    u_xlat10_1.xyz = texture(_SourceTex, u_xlat0.xy, _GlobalMipBias.x).xyz;
    u_xlat10_0.xyz = texture(_SourceTex, u_xlat0.zw, _GlobalMipBias.x).xyz;
    u_xlat16_3.xyz = u_xlat10_1.xyz * vec3(0.0540540516, 0.0540540516, 0.0540540516) + u_xlat16_3.xyz;
    SV_Target0.xyz = u_xlat10_0.xyz * vec3(0.0162162203, 0.0162162203, 0.0162162203) + u_xlat16_3.xyz;
    SV_Target0.w = 1.0;
    return;
}
`,
  // Bloom pass vertical: program 9-0018, no HQ or RGBM keywords.
  vertical: `
precision highp float;
precision highp int;
uniform 	vec2 _GlobalMipBias;
uniform 	vec4 _SourceTex_TexelSize;
uniform mediump sampler2D _SourceTex;
in highp vec2 vs_TEXCOORD0;
layout(location = 0) out mediump vec4 SV_Target0;
vec4 u_xlat0;
mediump vec3 u_xlat10_0;
vec4 u_xlat1;
mediump vec3 u_xlat10_1;
mediump vec3 u_xlat10_2;
mediump vec3 u_xlat16_3;
void main()
{
    u_xlat0.x = 0.0;
    u_xlat0.yw = _SourceTex_TexelSize.yy * vec2(3.23076916, 1.38461542);
    u_xlat1 = (-u_xlat0.xyxw) + vs_TEXCOORD0.xyxy;
    u_xlat0 = u_xlat0.xwxy + vs_TEXCOORD0.xyxy;
    u_xlat10_2.xyz = texture(_SourceTex, u_xlat1.zw, _GlobalMipBias.x).xyz;
    u_xlat10_1.xyz = texture(_SourceTex, u_xlat1.xy, _GlobalMipBias.x).xyz;
    u_xlat16_3.xyz = u_xlat10_2.xyz * vec3(0.31621623, 0.31621623, 0.31621623);
    u_xlat16_3.xyz = u_xlat10_1.xyz * vec3(0.0702702701, 0.0702702701, 0.0702702701) + u_xlat16_3.xyz;
    u_xlat10_1.xyz = texture(_SourceTex, vs_TEXCOORD0.xy, _GlobalMipBias.x).xyz;
    u_xlat16_3.xyz = u_xlat10_1.xyz * vec3(0.227027029, 0.227027029, 0.227027029) + u_xlat16_3.xyz;
    u_xlat10_1.xyz = texture(_SourceTex, u_xlat0.xy, _GlobalMipBias.x).xyz;
    u_xlat10_0.xyz = texture(_SourceTex, u_xlat0.zw, _GlobalMipBias.x).xyz;
    u_xlat16_3.xyz = u_xlat10_1.xyz * vec3(0.31621623, 0.31621623, 0.31621623) + u_xlat16_3.xyz;
    SV_Target0.xyz = u_xlat10_0.xyz * vec3(0.0702702701, 0.0702702701, 0.0702702701) + u_xlat16_3.xyz;
    SV_Target0.w = 1.0;
    return;
}
`,
  // Bloom pass upsample: program 9-0024, no HQ or RGBM keywords.
  upsample: `
precision highp float;
precision highp int;
uniform 	vec2 _GlobalMipBias;
uniform 	vec4 _Params;
uniform mediump sampler2D _SourceTex;
uniform mediump sampler2D _SourceTexLowMip;
in highp vec2 vs_TEXCOORD0;
layout(location = 0) out mediump vec4 SV_Target0;
vec3 u_xlat0;
mediump vec3 u_xlat10_0;
mediump vec3 u_xlat10_1;
void main()
{
    u_xlat10_0.xyz = texture(_SourceTexLowMip, vs_TEXCOORD0.xy, _GlobalMipBias.x).xyz;
    u_xlat10_1.xyz = texture(_SourceTex, vs_TEXCOORD0.xy, _GlobalMipBias.x).xyz;
    u_xlat0.xyz = u_xlat10_0.xyz + (-u_xlat10_1.xyz);
    u_xlat0.xyz = _Params.xxx * u_xlat0.xyz + u_xlat10_1.xyz;
    SV_Target0.xyz = u_xlat0.xyz;
    SV_Target0.w = 1.0;
    return;
}
`,
};
