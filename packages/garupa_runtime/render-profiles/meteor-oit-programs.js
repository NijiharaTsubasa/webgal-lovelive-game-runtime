// Original GLES3 fragment programs from APKS Shader PathID 68.
// Uniform-location qualifiers are removed for WebGL2; formulas remain unchanged.

export const normalFragment = `
#version 300 es

precision highp float;
precision highp int;
#define UNITY_SUPPORTS_UNIFORM_LOCATION 0
#if UNITY_SUPPORTS_UNIFORM_LOCATION
#define UNITY_LOCATION(x) layout(location = x)
#define UNITY_BINDING(x) layout(binding = x, std140)
#else
#define UNITY_LOCATION(x)
#define UNITY_BINDING(x) layout(std140)
#endif
UNITY_LOCATION(0) uniform mediump sampler2D _MainTex;
UNITY_LOCATION(1) uniform highp sampler2D _AccumTex;
UNITY_LOCATION(2) uniform highp sampler2D _RevealageTex;
in highp vec2 vs_TEXCOORD1;
layout(location = 0) out mediump vec4 SV_Target0;
vec3 u_xlat0;
mediump vec4 u_xlat16_0;
vec4 u_xlat1;
mediump vec3 u_xlat16_2;
void main()
{
    u_xlat0.xyz = texture(_AccumTex, vs_TEXCOORD1.xy).xyz;
    u_xlat1.xy = texture(_RevealageTex, vs_TEXCOORD1.xy).yw;
    u_xlat16_2.x = max(u_xlat1.x, 0.00100000005);
    u_xlat16_2.xyz = u_xlat0.xyz / u_xlat16_2.xxx;
    u_xlat16_0 = texture(_MainTex, vs_TEXCOORD1.xy);
    u_xlat1.xzw = (-u_xlat16_2.xyz) + u_xlat16_0.xyz;
    u_xlat16_0.xyz = u_xlat1.yyy * u_xlat1.xzw + u_xlat16_2.xyz;
    SV_Target0 = u_xlat16_0;
    return;
}
`;

export const blendBufferFragment = `
#version 300 es

precision highp float;
precision highp int;
#define UNITY_SUPPORTS_UNIFORM_LOCATION 0
#if UNITY_SUPPORTS_UNIFORM_LOCATION
#define UNITY_LOCATION(x) layout(location = x)
#define UNITY_BINDING(x) layout(binding = x, std140)
#else
#define UNITY_LOCATION(x)
#define UNITY_BINDING(x) layout(std140)
#endif
UNITY_LOCATION(0) uniform mediump sampler2D _MainTex;
UNITY_LOCATION(1) uniform highp sampler2D _AccumTex;
UNITY_LOCATION(2) uniform highp sampler2D _RevealageTex;
in highp vec2 vs_TEXCOORD1;
layout(location = 0) out mediump vec4 SV_Target0;
vec3 u_xlat0;
vec2 u_xlat1;
mediump vec3 u_xlat16_2;
mediump vec4 u_xlat16_3;
mediump vec3 u_xlat16_4;
mediump float u_xlat16_17;
void main()
{
    u_xlat0.xyz = texture(_AccumTex, vs_TEXCOORD1.xy).xyz;
    u_xlat1.xy = texture(_RevealageTex, vs_TEXCOORD1.xy).wy;
    u_xlat16_2.x = max(u_xlat1.y, 0.00100000005);
    u_xlat1.x = u_xlat1.x;
    u_xlat1.x = clamp(u_xlat1.x, 0.0, 1.0);
    u_xlat16_2.xyz = u_xlat0.xyz / u_xlat16_2.xxx;
    u_xlat0.x = (-u_xlat1.x) + 1.0;
    u_xlat16_3 = texture(_MainTex, vs_TEXCOORD1.xy);
    u_xlat16_4.xyz = u_xlat1.xxx * u_xlat16_3.xyz;
    u_xlat16_17 = u_xlat16_3.w;
    u_xlat16_17 = clamp(u_xlat16_17, 0.0, 1.0);
    u_xlat16_17 = (-u_xlat16_17) + 1.0;
    SV_Target0.w = u_xlat1.x * u_xlat16_17;
    u_xlat0.xyz = u_xlat16_2.xyz * u_xlat0.xxx + u_xlat16_4.xyz;
    SV_Target0.xyz = u_xlat0.xyz;
    return;
}
`;

export const clearFragment = `
#version 300 es

precision highp float;
precision highp int;
layout(location = 0) out highp vec4 SV_TARGET0;
layout(location = 1) out highp vec4 SV_TARGET1;
void main()
{
    SV_TARGET0 = vec4(0.0, 0.0, 0.0, 0.0);
    SV_TARGET1 = vec4(1.0, 0.0, 0.0, 1.0);
    return;
}
`;
