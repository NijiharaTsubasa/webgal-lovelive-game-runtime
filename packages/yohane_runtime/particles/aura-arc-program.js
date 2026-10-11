// Original AuraArc output programs 9-0002/3/4; SSBO-to-integer-texture adaptation.
export const auraArcPrograms = {
  none: {
    vertexShader: `precision highp float;
precision highp int;
precision highp usampler2D;
in uint auraVertexId;
uniform usampler2D auraAttributes;
uniform usampler2D auraHeaders;
uniform usampler2D auraSlots;
int bitfieldInsert(int base,int insert,int offset,int bits) {
 uint mask=(0xffffffffu >> uint(32-bits)) << uint(offset);
 return int((uint(base)&~mask)|((uint(insert)<<uint(offset))&mask));
}
uint auraAttribute(int word) {
 int region=word/256000; int localWord=word-region*256000;
 int strip=localWord/256; int point=(localWord/4)%64;
 int slot=int(texelFetch(auraSlots,ivec2(strip,0),0).r);
 uvec4 value=texelFetch(auraAttributes,ivec2(point,slot*3+region),0);
 return value[localWord%4];
}
uint auraHeader(int word){int strip=word/5;int slot=int(texelFetch(auraSlots,ivec2(strip,0),0).r);return texelFetch(auraHeaders,ivec2(word%5,slot),0).r;}
vec4 ImmCB_1[4];
uniform 	vec3 _WorldSpaceCameraPos;
uniform 	vec4 unity_OrthoParams;
uniform 	vec4 hlslcc_mtx4x4unity_MatrixV[4];
uniform 	vec4 hlslcc_mtx4x4unity_MatrixVP[4];
uniform vec4 Alpha_c;
uniform vec4 uniform_c;
uniform vec4 uniform_d;
uniform float uniform_a;
uniform float uniform_b;
uniform uvec2 PADDING_0;
uniform float nbMax;
uniform float systemSeed;
uniform vec3 cameraXRSettings;




uniform mediump sampler2D bakedTexture;
out highp vec2 vs_TEXCOORD0;
out highp vec4 vs_COLOR0;
out highp vec4 vs_TEXCOORD1;
out highp vec3 vs_TEXCOORD6;
float u_xlat0;
int u_xlati0;
uint u_xlatu0;
bool u_xlatb0;
vec4 u_xlat1;
ivec4 u_xlati1;
uint u_xlatu1;
bool u_xlatb1;
vec4 u_xlat2;
uint u_xlatu2;
vec4 u_xlat3;
vec3 u_xlat4;
ivec3 u_xlati4;
vec4 u_xlat5;
uvec2 u_xlatu5;
float u_xlat6;
int u_xlati6;
uint u_xlatu6;
ivec3 u_xlati7;
uint u_xlatu7;
bool u_xlatb7;
float u_xlat8;
float u_xlat12;
int u_xlati12;
uint u_xlatu12;
bool u_xlatb12;
float u_xlat13;
int u_xlati13;
float u_xlat14;
ivec2 u_xlati14;
bool u_xlatb14;
float u_xlat18;
uint u_xlatu18;
float u_xlat19;
float u_xlat20;
bool u_xlatb20;
float u_xlat22;
void main()
{
ImmCB_1[0] = vec4(1.0,0.0,0.0,0.0);
ImmCB_1[1] = vec4(0.0,1.0,0.0,0.0);
ImmCB_1[2] = vec4(0.0,0.0,1.0,0.0);
ImmCB_1[3] = vec4(0.0,0.0,0.0,1.0);
    u_xlati0 = 0;
    u_xlatu0 = auraVertexId;
    {
        uint quo = u_xlatu0 / 252u;
        uint rem = u_xlatu0 % 252u;
        u_xlatu1 = quo;
        u_xlatu2 = rem;
    }
    u_xlati6 = int(u_xlatu1) * 5;
    u_xlati12 = int(u_xlatu1) * 5 + 1;
    u_xlatu12 = auraHeader(u_xlati12);
    u_xlatu18 = u_xlatu2 >> 2u;
    u_xlati7.x = int(u_xlatu0 & 1u);
    u_xlatu18 = u_xlatu18 + uint(u_xlati7.x);
    u_xlati7.x = (-u_xlati7.x) + int(u_xlatu18);
    u_xlatu7 = uint(u_xlati7.x) + 1u;
    u_xlatb7 = u_xlatu7>=u_xlatu12;
    if(u_xlatb7){
        gl_Position = vec4(0.0, 0.0, 0.0, 0.0);
        vs_COLOR0 = vec4(0.0, 0.0, 0.0, 0.0);
        vs_TEXCOORD1 = vec4(0.0, 0.0, 0.0, 0.0);
        vs_TEXCOORD6.xyz = vec3(0.0, 0.0, 0.0);
        vs_TEXCOORD0.xy = vec2(0.0, 0.0);
        return;
    }
    u_xlati6 = int(auraHeader(u_xlati6));
    u_xlati6 = u_xlati6 + int(u_xlatu18);
    u_xlatu7 =  uint(int(bitfieldInsert(u_xlati6, int(u_xlatu1), 6 & 0x1F, 26)));
    u_xlatb7 = u_xlatu7>=uint(floatBitsToUint(nbMax));
    if(u_xlatb7){
        gl_Position = vec4(intBitsToFloat(int(0xFFFFFFFFu)), 0.0, 0.0, 0.0);
        vs_COLOR0 = vec4(0.0, 0.0, 0.0, 0.0);
        vs_TEXCOORD1 = vec4(0.0, 0.0, 0.0, 0.0);
        vs_TEXCOORD6.xyz = vec3(0.0, 0.0, 0.0);
        vs_TEXCOORD0.xy = vec2(0.0, 0.0);
        return;
    }
    u_xlati7.x = u_xlati6 << 4;
    u_xlati7.x = int(bitfieldInsert(u_xlati7.x, int(u_xlatu1), 10 & 0x1F, 26));
    u_xlati7.xyz = u_xlati7.xxx + ivec3(1024000, 2048000, 2048012);
    u_xlat2.xy = vec2(uintBitsToFloat(auraAttribute((u_xlati7.y >> 2) + 0)), uintBitsToFloat(auraAttribute((u_xlati7.y >> 2) + 1)));
    u_xlat13 = uintBitsToFloat(auraAttribute((u_xlati7.z >> 2) + 0));
    u_xlat3 = vec4(uintBitsToFloat(auraAttribute((u_xlati7.x >> 2) + 0)), uintBitsToFloat(auraAttribute((u_xlati7.x >> 2) + 1)), uintBitsToFloat(auraAttribute((u_xlati7.x >> 2) + 3)), uintBitsToFloat(auraAttribute((u_xlati7.x >> 2) + 2)));
    u_xlatb7 = 0u<u_xlatu18;
    u_xlati14.xy = ivec2(u_xlati6) + ivec2(int(0xFFFFFFFFu), 1);
    u_xlati6 = int(u_xlatu1) << 10;
    u_xlati1.xw = ivec2(bitfieldInsert(int(u_xlati6), u_xlati14.x, int(4) & 0x1F, int(6)), bitfieldInsert(int(u_xlati6), u_xlati14.y, int(4) & 0x1F, int(6)));
    u_xlati1.xw = u_xlati1.xw + ivec2(1024000, 1024000);
    u_xlat4.xyz = vec3(uintBitsToFloat(auraAttribute((u_xlati1.x >> 2) + 0)), uintBitsToFloat(auraAttribute((u_xlati1.x >> 2) + 1)), uintBitsToFloat(auraAttribute((u_xlati1.x >> 2) + 2)));
    u_xlat4.xyz = u_xlat3.wxy + (-u_xlat4.zxy);
    u_xlat6 = dot(u_xlat4.xyz, u_xlat4.xyz);
    u_xlatb1 = 9.99999975e-06<u_xlat6;
    u_xlat6 = inversesqrt(u_xlat6);
    u_xlat4.xyz = vec3(u_xlat6) * u_xlat4.xyz;
    u_xlati4.xyz = ivec3((uvec3(bvec3(u_xlatb1)) * 0xFFFFFFFFu) & uvec3(floatBitsToUint(u_xlat4.xyz)));
    u_xlat4.xyz = bool(u_xlatb7) ? intBitsToFloat(u_xlati4.xyz) : vec3(0.0, 0.0, 0.0);
    u_xlatu6 = u_xlatu12 + 4294967295u;
    u_xlatb12 = u_xlatu18<u_xlatu6;
    u_xlat1.xyw = vec3(uintBitsToFloat(auraAttribute((u_xlati1.w >> 2) + 0)), uintBitsToFloat(auraAttribute((u_xlati1.w >> 2) + 1)), uintBitsToFloat(auraAttribute((u_xlati1.w >> 2) + 2)));
    u_xlat1.xyw = (-u_xlat3.wxy) + u_xlat1.wxy;
    u_xlat14 = dot(u_xlat1.xyw, u_xlat1.xyw);
    u_xlatb20 = 9.99999975e-06<u_xlat14;
    u_xlat14 = inversesqrt(u_xlat14);
    u_xlat1.xyw = u_xlat1.xyw * vec3(u_xlat14);
    u_xlati1.xyw = ivec3((uvec3(bvec3(u_xlatb20)) * 0xFFFFFFFFu) & uvec3(floatBitsToUint(u_xlat1.xyw)));
    u_xlat1.xyw = bool(u_xlatb12) ? intBitsToFloat(u_xlati1.xyw) : vec3(0.0, 0.0, 0.0);
    u_xlat1.xyw = u_xlat1.xyw + u_xlat4.xyz;
    u_xlat12 = dot(u_xlat1.xyw, u_xlat1.xyw);
    u_xlat12 = inversesqrt(u_xlat12);
    u_xlat1.xyw = vec3(u_xlat12) * u_xlat1.xyw;
    u_xlatb12 = unity_OrthoParams.w==0.0;
    u_xlat4.xyz = u_xlat3.wxy + (-_WorldSpaceCameraPos.zxy);
    u_xlat5.y = (-hlslcc_mtx4x4unity_MatrixV[0].z);
    u_xlat5.z = (-hlslcc_mtx4x4unity_MatrixV[1].z);
    u_xlat5.x = (-hlslcc_mtx4x4unity_MatrixV[2].z);
    u_xlat4.xyz = (bool(u_xlatb12)) ? u_xlat4.xyz : u_xlat5.xyz;
    u_xlat5.xyz = u_xlat1.wxy * u_xlat4.xyz;
    u_xlat4.xyz = u_xlat4.zxy * u_xlat1.xyw + (-u_xlat5.xyz);
    u_xlat12 = dot(u_xlat4.xyz, u_xlat4.xyz);
    u_xlatb14 = u_xlat12<9.99999975e-06;
    u_xlat12 = inversesqrt(u_xlat12);
    u_xlat4.xyz = vec3(u_xlat12) * u_xlat4.xyz;
    u_xlat4.xyz = (bool(u_xlatb14)) ? vec3(0.0, 1.0, 0.0) : u_xlat4.xyz;
    u_xlat5.xyz = u_xlat1.xyw * u_xlat4.yzx;
    u_xlat1.xyw = u_xlat1.wxy * u_xlat4.zxy + (-u_xlat5.xyz);
    u_xlat12 = u_xlat2.y * uniform_b + uniform_a;
    u_xlat13 = u_xlat3.z / u_xlat13;
    u_xlat8 = (-u_xlat13) + 1.5;
    u_xlat14 = u_xlat12 * u_xlat8;
    u_xlat20 = unpackHalf2x16(uint(floatBitsToUint(Alpha_c.x))).x;
    u_xlatu5.xy = uvec2(floatBitsToUint(Alpha_c.xw)) >> uvec2(16u, 2u);
    u_xlat22 = unpackHalf2x16(u_xlatu5.x).x;
    u_xlat5.x = u_xlat13 * u_xlat20 + u_xlat22;
    switch(int(u_xlatu5.y)){
        case 1:
            u_xlat13 = min(u_xlat5.x, 1.0);
            u_xlat13 = fract(u_xlat13);
            u_xlat5.x = u_xlat13 * 0.9921875 + 0.00390625;
            break;
        case 2:
            u_xlat13 = max(u_xlat5.x, 0.0);
            u_xlat13 = fract(u_xlat13);
            u_xlat5.x = u_xlat13 * 0.9921875 + 0.00390625;
            break;
        case 3:
            u_xlat5.x = u_xlat5.x;
            u_xlat5.x = clamp(u_xlat5.x, 0.0, 1.0);
            u_xlat5.x = u_xlat5.x * 0.9921875 + 0.00390625;
            break;
        default:
            break;
    }
    u_xlati13 = int(uint(floatBitsToUint(Alpha_c.w)) & 3u);
    u_xlat5.z = Alpha_c.z;
    u_xlat5 = textureLod(bakedTexture, u_xlat5.xz, 0.0);
    u_xlat13 = dot(u_xlat5, ImmCB_1[u_xlati13]);
    u_xlat13 = u_xlat13 * Alpha_c.y;
    u_xlat2.x = u_xlat2.x * 2.0 + -1.0;
    u_xlat2.x = u_xlat2.x * u_xlat2.x;
    u_xlat2.x = (-u_xlat2.x) * 1.10000002 + 1.0;
    u_xlat2.x = max(u_xlat2.x, 0.0);
    u_xlat20 = u_xlat2.x * uniform_d.w + uniform_c.w;
    vs_COLOR0.w = u_xlat13 * u_xlat20;
    vs_COLOR0.xyz = u_xlat2.xxx * uniform_d.xyz + uniform_c.xyz;
    u_xlat18 = float(u_xlatu18);
    u_xlat6 = float(u_xlatu6);
    vs_TEXCOORD0.x = u_xlat18 / u_xlat6;
    u_xlatu0 = u_xlatu0 & 2u;
    u_xlat0 = float(u_xlatu0);
    u_xlat6 = u_xlat0 * 0.5;
    u_xlat5.x = u_xlat0 * 0.5 + -0.5;
    u_xlatb0 = u_xlat14<0.0;
    u_xlat0 = (u_xlatb0) ? -9.99999975e-06 : 9.99999975e-06;
    u_xlat0 = u_xlat12 * u_xlat8 + u_xlat0;
    u_xlat2.xyz = vec3(u_xlat0) * u_xlat4.xyz;
    u_xlat1.xyz = vec3(u_xlat0) * u_xlat1.xyw;
    u_xlat2.w = u_xlat3.x;
    u_xlat5.y = 1.0;
    u_xlat12 = dot(u_xlat2.xw, u_xlat5.xy);
    u_xlat3.xz = u_xlat2.yz;
    u_xlat18 = dot(u_xlat3.xy, u_xlat5.xy);
    u_xlat19 = dot(u_xlat3.zw, u_xlat5.xy);
    u_xlat2 = vec4(u_xlat18) * hlslcc_mtx4x4unity_MatrixVP[1];
    u_xlat2 = hlslcc_mtx4x4unity_MatrixVP[0] * vec4(u_xlat12) + u_xlat2;
    u_xlat2 = hlslcc_mtx4x4unity_MatrixVP[2] * vec4(u_xlat19) + u_xlat2;
    gl_Position = u_xlat2 + hlslcc_mtx4x4unity_MatrixVP[3];
    u_xlat12 = dot((-u_xlat1.xyz), (-u_xlat1.xyz));
    u_xlat12 = inversesqrt(u_xlat12);
    u_xlat1.xyz = vec3(u_xlat12) * (-u_xlat1.xyz);
    u_xlat12 = u_xlat0 * u_xlat0;
    u_xlat0 = u_xlat0 * u_xlat12;
    u_xlatb0 = u_xlat0<0.0;
    u_xlat0 = (u_xlatb0) ? -1.0 : 1.0;
    vs_TEXCOORD6.xyz = u_xlat1.xyz * vec3(u_xlat0);
    vs_TEXCOORD1 = vec4(1.0, 0.0, 0.0, 0.0);
    vs_TEXCOORD0.y = u_xlat6;
    return;
}
`,
    fragmentShader: `precision highp float;
precision highp int;


uniform 	vec4 _ScaledScreenParams;
uniform 	vec4 _ProjectionParams;
uniform 	vec2 _GlobalMipBias;
uniform 	vec4 _ZBufferParams;
uniform 	vec4 unity_OrthoParams;
uniform mediump sampler2D mainTexture;
uniform highp sampler2D _CameraDepthTexture;
in highp vec2 vs_TEXCOORD0;
in highp vec4 vs_COLOR0;
in highp vec4 vs_TEXCOORD1;
out highp vec4 SV_Target0;
vec4 u_xlat0;
bool u_xlatb0;
mediump vec4 u_xlat16_1;
float u_xlat2;
vec2 u_xlat4;
float u_xlat6;
void main()
{
vec4 hlslcc_FragCoord = vec4(gl_FragCoord.xyz, 1.0/gl_FragCoord.w);
    u_xlatb0 = unity_OrthoParams.w==0.0;
    if(u_xlatb0){
        u_xlat0.xy = vec2(1.0) / vec2(_ScaledScreenParams.xy);
        u_xlat0.xy = u_xlat0.xy * hlslcc_FragCoord.xy;
        u_xlat0.x = texture(_CameraDepthTexture, u_xlat0.xy, _GlobalMipBias.x).x;
        u_xlat0.x = _ZBufferParams.z * u_xlat0.x + _ZBufferParams.w;
        u_xlat0.x = float(1.0) / u_xlat0.x;
        u_xlat2 = hlslcc_FragCoord.w;
    } else {
        u_xlat4.xy = vec2(1.0) / vec2(_ScaledScreenParams.xy);
        u_xlat4.xy = u_xlat4.xy * hlslcc_FragCoord.xy;
        u_xlat4.x = texture(_CameraDepthTexture, u_xlat4.xy, _GlobalMipBias.x).x;
        u_xlat6 = (-_ProjectionParams.y) + _ProjectionParams.z;
        u_xlat0.x = u_xlat6 * u_xlat4.x + _ProjectionParams.y;
        u_xlat2 = u_xlat6 * hlslcc_FragCoord.z + _ProjectionParams.y;
    }
    u_xlat0.x = (-u_xlat2) + u_xlat0.x;
    u_xlat0.x = u_xlat0.x * vs_TEXCOORD1.x;
    u_xlat0.x = clamp(u_xlat0.x, 0.0, 1.0);
    u_xlat2 = u_xlat0.x * u_xlat0.x;
    u_xlat0.x = (-u_xlat0.x) * 2.0 + 3.0;
    u_xlat0.x = u_xlat0.x * u_xlat2;
    u_xlat0.w = u_xlat0.x * vs_COLOR0.w;
    u_xlat16_1 = texture(mainTexture, vs_TEXCOORD0.xy, _GlobalMipBias.x);
    u_xlat0.xyz = vs_COLOR0.xyz;
    u_xlat0 = u_xlat0 * u_xlat16_1;
    SV_Target0.w = u_xlat0.w;
    SV_Target0.w = clamp(SV_Target0.w, 0.0, 1.0);
    SV_Target0.xyz = u_xlat0.xyz;
    return;
}
`,
  },
  exp2: {
    vertexShader: `precision highp float;
precision highp int;
precision highp usampler2D;
in uint auraVertexId;
uniform usampler2D auraAttributes;
uniform usampler2D auraHeaders;
uniform usampler2D auraSlots;
int bitfieldInsert(int base,int insert,int offset,int bits) {
 uint mask=(0xffffffffu >> uint(32-bits)) << uint(offset);
 return int((uint(base)&~mask)|((uint(insert)<<uint(offset))&mask));
}
uint auraAttribute(int word) {
 int region=word/256000; int localWord=word-region*256000;
 int strip=localWord/256; int point=(localWord/4)%64;
 int slot=int(texelFetch(auraSlots,ivec2(strip,0),0).r);
 uvec4 value=texelFetch(auraAttributes,ivec2(point,slot*3+region),0);
 return value[localWord%4];
}
uint auraHeader(int word){int strip=word/5;int slot=int(texelFetch(auraSlots,ivec2(strip,0),0).r);return texelFetch(auraHeaders,ivec2(word%5,slot),0).r;}
vec4 ImmCB_1[4];
uniform 	vec3 _WorldSpaceCameraPos;
uniform 	vec4 unity_OrthoParams;
uniform 	vec4 hlslcc_mtx4x4unity_MatrixV[4];
uniform 	vec4 hlslcc_mtx4x4unity_MatrixVP[4];
uniform vec4 Alpha_c;
uniform vec4 uniform_c;
uniform vec4 uniform_d;
uniform float uniform_a;
uniform float uniform_b;
uniform uvec2 PADDING_0;
uniform float nbMax;
uniform float systemSeed;
uniform vec3 cameraXRSettings;




uniform mediump sampler2D bakedTexture;
out highp vec2 vs_TEXCOORD0;
out highp vec4 vs_COLOR0;
out highp vec4 vs_TEXCOORD1;
out highp vec3 vs_TEXCOORD6;
float u_xlat0;
int u_xlati0;
uint u_xlatu0;
bool u_xlatb0;
vec4 u_xlat1;
ivec4 u_xlati1;
uint u_xlatu1;
bool u_xlatb1;
vec4 u_xlat2;
uint u_xlatu2;
vec4 u_xlat3;
vec3 u_xlat4;
ivec3 u_xlati4;
vec4 u_xlat5;
uvec2 u_xlatu5;
float u_xlat6;
int u_xlati6;
uint u_xlatu6;
ivec3 u_xlati7;
uint u_xlatu7;
bool u_xlatb7;
float u_xlat8;
float u_xlat12;
int u_xlati12;
uint u_xlatu12;
bool u_xlatb12;
float u_xlat13;
int u_xlati13;
float u_xlat14;
ivec2 u_xlati14;
bool u_xlatb14;
float u_xlat18;
uint u_xlatu18;
float u_xlat19;
float u_xlat20;
bool u_xlatb20;
float u_xlat22;
void main()
{
ImmCB_1[0] = vec4(1.0,0.0,0.0,0.0);
ImmCB_1[1] = vec4(0.0,1.0,0.0,0.0);
ImmCB_1[2] = vec4(0.0,0.0,1.0,0.0);
ImmCB_1[3] = vec4(0.0,0.0,0.0,1.0);
    u_xlati0 = 0;
    u_xlatu0 = auraVertexId;
    {
        uint quo = u_xlatu0 / 252u;
        uint rem = u_xlatu0 % 252u;
        u_xlatu1 = quo;
        u_xlatu2 = rem;
    }
    u_xlati6 = int(u_xlatu1) * 5;
    u_xlati12 = int(u_xlatu1) * 5 + 1;
    u_xlatu12 = auraHeader(u_xlati12);
    u_xlatu18 = u_xlatu2 >> 2u;
    u_xlati7.x = int(u_xlatu0 & 1u);
    u_xlatu18 = u_xlatu18 + uint(u_xlati7.x);
    u_xlati7.x = (-u_xlati7.x) + int(u_xlatu18);
    u_xlatu7 = uint(u_xlati7.x) + 1u;
    u_xlatb7 = u_xlatu7>=u_xlatu12;
    if(u_xlatb7){
        gl_Position = vec4(0.0, 0.0, 0.0, 0.0);
        vs_COLOR0 = vec4(0.0, 0.0, 0.0, 0.0);
        vs_TEXCOORD1 = vec4(0.0, 0.0, 0.0, 0.0);
        vs_TEXCOORD6.xyz = vec3(0.0, 0.0, 0.0);
        vs_TEXCOORD0.xy = vec2(0.0, 0.0);
        return;
    }
    u_xlati6 = int(auraHeader(u_xlati6));
    u_xlati6 = u_xlati6 + int(u_xlatu18);
    u_xlatu7 =  uint(int(bitfieldInsert(u_xlati6, int(u_xlatu1), 6 & 0x1F, 26)));
    u_xlatb7 = u_xlatu7>=uint(floatBitsToUint(nbMax));
    if(u_xlatb7){
        gl_Position = vec4(intBitsToFloat(int(0xFFFFFFFFu)), 0.0, 0.0, 0.0);
        vs_COLOR0 = vec4(0.0, 0.0, 0.0, 0.0);
        vs_TEXCOORD1 = vec4(0.0, 0.0, 0.0, 0.0);
        vs_TEXCOORD6.xyz = vec3(0.0, 0.0, 0.0);
        vs_TEXCOORD0.xy = vec2(0.0, 0.0);
        return;
    }
    u_xlati7.x = u_xlati6 << 4;
    u_xlati7.x = int(bitfieldInsert(u_xlati7.x, int(u_xlatu1), 10 & 0x1F, 26));
    u_xlati7.xyz = u_xlati7.xxx + ivec3(1024000, 2048000, 2048012);
    u_xlat2.xy = vec2(uintBitsToFloat(auraAttribute((u_xlati7.y >> 2) + 0)), uintBitsToFloat(auraAttribute((u_xlati7.y >> 2) + 1)));
    u_xlat13 = uintBitsToFloat(auraAttribute((u_xlati7.z >> 2) + 0));
    u_xlat3 = vec4(uintBitsToFloat(auraAttribute((u_xlati7.x >> 2) + 0)), uintBitsToFloat(auraAttribute((u_xlati7.x >> 2) + 1)), uintBitsToFloat(auraAttribute((u_xlati7.x >> 2) + 3)), uintBitsToFloat(auraAttribute((u_xlati7.x >> 2) + 2)));
    u_xlatb7 = 0u<u_xlatu18;
    u_xlati14.xy = ivec2(u_xlati6) + ivec2(int(0xFFFFFFFFu), 1);
    u_xlati6 = int(u_xlatu1) << 10;
    u_xlati1.xw = ivec2(bitfieldInsert(int(u_xlati6), u_xlati14.x, int(4) & 0x1F, int(6)), bitfieldInsert(int(u_xlati6), u_xlati14.y, int(4) & 0x1F, int(6)));
    u_xlati1.xw = u_xlati1.xw + ivec2(1024000, 1024000);
    u_xlat4.xyz = vec3(uintBitsToFloat(auraAttribute((u_xlati1.x >> 2) + 0)), uintBitsToFloat(auraAttribute((u_xlati1.x >> 2) + 1)), uintBitsToFloat(auraAttribute((u_xlati1.x >> 2) + 2)));
    u_xlat4.xyz = u_xlat3.wxy + (-u_xlat4.zxy);
    u_xlat6 = dot(u_xlat4.xyz, u_xlat4.xyz);
    u_xlatb1 = 9.99999975e-06<u_xlat6;
    u_xlat6 = inversesqrt(u_xlat6);
    u_xlat4.xyz = vec3(u_xlat6) * u_xlat4.xyz;
    u_xlati4.xyz = ivec3((uvec3(bvec3(u_xlatb1)) * 0xFFFFFFFFu) & uvec3(floatBitsToUint(u_xlat4.xyz)));
    u_xlat4.xyz = bool(u_xlatb7) ? intBitsToFloat(u_xlati4.xyz) : vec3(0.0, 0.0, 0.0);
    u_xlatu6 = u_xlatu12 + 4294967295u;
    u_xlatb12 = u_xlatu18<u_xlatu6;
    u_xlat1.xyw = vec3(uintBitsToFloat(auraAttribute((u_xlati1.w >> 2) + 0)), uintBitsToFloat(auraAttribute((u_xlati1.w >> 2) + 1)), uintBitsToFloat(auraAttribute((u_xlati1.w >> 2) + 2)));
    u_xlat1.xyw = (-u_xlat3.wxy) + u_xlat1.wxy;
    u_xlat14 = dot(u_xlat1.xyw, u_xlat1.xyw);
    u_xlatb20 = 9.99999975e-06<u_xlat14;
    u_xlat14 = inversesqrt(u_xlat14);
    u_xlat1.xyw = u_xlat1.xyw * vec3(u_xlat14);
    u_xlati1.xyw = ivec3((uvec3(bvec3(u_xlatb20)) * 0xFFFFFFFFu) & uvec3(floatBitsToUint(u_xlat1.xyw)));
    u_xlat1.xyw = bool(u_xlatb12) ? intBitsToFloat(u_xlati1.xyw) : vec3(0.0, 0.0, 0.0);
    u_xlat1.xyw = u_xlat1.xyw + u_xlat4.xyz;
    u_xlat12 = dot(u_xlat1.xyw, u_xlat1.xyw);
    u_xlat12 = inversesqrt(u_xlat12);
    u_xlat1.xyw = vec3(u_xlat12) * u_xlat1.xyw;
    u_xlatb12 = unity_OrthoParams.w==0.0;
    u_xlat4.xyz = u_xlat3.wxy + (-_WorldSpaceCameraPos.zxy);
    u_xlat5.y = (-hlslcc_mtx4x4unity_MatrixV[0].z);
    u_xlat5.z = (-hlslcc_mtx4x4unity_MatrixV[1].z);
    u_xlat5.x = (-hlslcc_mtx4x4unity_MatrixV[2].z);
    u_xlat4.xyz = (bool(u_xlatb12)) ? u_xlat4.xyz : u_xlat5.xyz;
    u_xlat5.xyz = u_xlat1.wxy * u_xlat4.xyz;
    u_xlat4.xyz = u_xlat4.zxy * u_xlat1.xyw + (-u_xlat5.xyz);
    u_xlat12 = dot(u_xlat4.xyz, u_xlat4.xyz);
    u_xlatb14 = u_xlat12<9.99999975e-06;
    u_xlat12 = inversesqrt(u_xlat12);
    u_xlat4.xyz = vec3(u_xlat12) * u_xlat4.xyz;
    u_xlat4.xyz = (bool(u_xlatb14)) ? vec3(0.0, 1.0, 0.0) : u_xlat4.xyz;
    u_xlat5.xyz = u_xlat1.xyw * u_xlat4.yzx;
    u_xlat1.xyw = u_xlat1.wxy * u_xlat4.zxy + (-u_xlat5.xyz);
    u_xlat12 = u_xlat2.y * uniform_b + uniform_a;
    u_xlat13 = u_xlat3.z / u_xlat13;
    u_xlat8 = (-u_xlat13) + 1.5;
    u_xlat14 = u_xlat12 * u_xlat8;
    u_xlat20 = unpackHalf2x16(uint(floatBitsToUint(Alpha_c.x))).x;
    u_xlatu5.xy = uvec2(floatBitsToUint(Alpha_c.xw)) >> uvec2(16u, 2u);
    u_xlat22 = unpackHalf2x16(u_xlatu5.x).x;
    u_xlat5.x = u_xlat13 * u_xlat20 + u_xlat22;
    switch(int(u_xlatu5.y)){
        case 1:
            u_xlat13 = min(u_xlat5.x, 1.0);
            u_xlat13 = fract(u_xlat13);
            u_xlat5.x = u_xlat13 * 0.9921875 + 0.00390625;
            break;
        case 2:
            u_xlat13 = max(u_xlat5.x, 0.0);
            u_xlat13 = fract(u_xlat13);
            u_xlat5.x = u_xlat13 * 0.9921875 + 0.00390625;
            break;
        case 3:
            u_xlat5.x = u_xlat5.x;
            u_xlat5.x = clamp(u_xlat5.x, 0.0, 1.0);
            u_xlat5.x = u_xlat5.x * 0.9921875 + 0.00390625;
            break;
        default:
            break;
    }
    u_xlati13 = int(uint(floatBitsToUint(Alpha_c.w)) & 3u);
    u_xlat5.z = Alpha_c.z;
    u_xlat5 = textureLod(bakedTexture, u_xlat5.xz, 0.0);
    u_xlat13 = dot(u_xlat5, ImmCB_1[u_xlati13]);
    u_xlat13 = u_xlat13 * Alpha_c.y;
    u_xlat2.x = u_xlat2.x * 2.0 + -1.0;
    u_xlat2.x = u_xlat2.x * u_xlat2.x;
    u_xlat2.x = (-u_xlat2.x) * 1.10000002 + 1.0;
    u_xlat2.x = max(u_xlat2.x, 0.0);
    u_xlat20 = u_xlat2.x * uniform_d.w + uniform_c.w;
    vs_COLOR0.w = u_xlat13 * u_xlat20;
    vs_COLOR0.xyz = u_xlat2.xxx * uniform_d.xyz + uniform_c.xyz;
    u_xlat18 = float(u_xlatu18);
    u_xlat6 = float(u_xlatu6);
    vs_TEXCOORD0.x = u_xlat18 / u_xlat6;
    u_xlatu0 = u_xlatu0 & 2u;
    u_xlat0 = float(u_xlatu0);
    u_xlat6 = u_xlat0 * 0.5;
    u_xlat5.x = u_xlat0 * 0.5 + -0.5;
    u_xlatb0 = u_xlat14<0.0;
    u_xlat0 = (u_xlatb0) ? -9.99999975e-06 : 9.99999975e-06;
    u_xlat0 = u_xlat12 * u_xlat8 + u_xlat0;
    u_xlat2.xyz = vec3(u_xlat0) * u_xlat4.xyz;
    u_xlat1.xyz = vec3(u_xlat0) * u_xlat1.xyw;
    u_xlat2.w = u_xlat3.x;
    u_xlat5.y = 1.0;
    u_xlat12 = dot(u_xlat2.xw, u_xlat5.xy);
    u_xlat3.xz = u_xlat2.yz;
    u_xlat18 = dot(u_xlat3.xy, u_xlat5.xy);
    u_xlat19 = dot(u_xlat3.zw, u_xlat5.xy);
    u_xlat2 = vec4(u_xlat18) * hlslcc_mtx4x4unity_MatrixVP[1];
    u_xlat2 = hlslcc_mtx4x4unity_MatrixVP[0] * vec4(u_xlat12) + u_xlat2;
    u_xlat2 = hlslcc_mtx4x4unity_MatrixVP[2] * vec4(u_xlat19) + u_xlat2;
    gl_Position = u_xlat2 + hlslcc_mtx4x4unity_MatrixVP[3];
    u_xlat12 = dot((-u_xlat1.xyz), (-u_xlat1.xyz));
    u_xlat12 = inversesqrt(u_xlat12);
    u_xlat1.xyz = vec3(u_xlat12) * (-u_xlat1.xyz);
    u_xlat12 = u_xlat0 * u_xlat0;
    u_xlat0 = u_xlat0 * u_xlat12;
    u_xlatb0 = u_xlat0<0.0;
    u_xlat0 = (u_xlatb0) ? -1.0 : 1.0;
    vs_TEXCOORD6.xyz = u_xlat1.xyz * vec3(u_xlat0);
    vs_TEXCOORD1 = vec4(1.0, 0.0, 0.0, 0.0);
    vs_TEXCOORD0.y = u_xlat6;
    return;
}
`,
    fragmentShader: `precision highp float;
precision highp int;


uniform 	vec4 _ScaledScreenParams;
uniform 	vec4 _ProjectionParams;
uniform 	vec2 _GlobalMipBias;
uniform 	vec4 _ZBufferParams;
uniform 	vec4 unity_OrthoParams;
uniform 	vec4 unity_FogParams;
uniform 	mediump vec4 unity_FogColor;
uniform mediump sampler2D mainTexture;
uniform highp sampler2D _CameraDepthTexture;
in highp vec2 vs_TEXCOORD0;
in highp vec4 vs_COLOR0;
in highp vec4 vs_TEXCOORD1;
out highp vec4 SV_Target0;
vec2 u_xlat0;
bool u_xlatb0;
mediump vec4 u_xlat16_1;
float u_xlat2;
vec3 u_xlat3;
vec2 u_xlat6;
float u_xlat9;
float u_xlat10;
void main()
{
vec4 hlslcc_FragCoord = vec4(gl_FragCoord.xyz, 1.0/gl_FragCoord.w);
    u_xlatb0 = unity_OrthoParams.w==0.0;
    if(u_xlatb0){
        u_xlat0.xy = vec2(1.0) / vec2(_ScaledScreenParams.xy);
        u_xlat0.xy = u_xlat0.xy * hlslcc_FragCoord.xy;
        u_xlat0.x = texture(_CameraDepthTexture, u_xlat0.xy, _GlobalMipBias.x).x;
        u_xlat0.x = _ZBufferParams.z * u_xlat0.x + _ZBufferParams.w;
        u_xlat0.x = float(1.0) / u_xlat0.x;
        u_xlat3.x = hlslcc_FragCoord.w;
    } else {
        u_xlat6.xy = vec2(1.0) / vec2(_ScaledScreenParams.xy);
        u_xlat6.xy = u_xlat6.xy * hlslcc_FragCoord.xy;
        u_xlat6.x = texture(_CameraDepthTexture, u_xlat6.xy, _GlobalMipBias.x).x;
        u_xlat9 = (-_ProjectionParams.y) + _ProjectionParams.z;
        u_xlat0.x = u_xlat9 * u_xlat6.x + _ProjectionParams.y;
        u_xlat3.x = u_xlat9 * hlslcc_FragCoord.z + _ProjectionParams.y;
    }
    u_xlat0.x = (-u_xlat3.x) + u_xlat0.x;
    u_xlat0.x = u_xlat0.x * vs_TEXCOORD1.x;
    u_xlat0.x = clamp(u_xlat0.x, 0.0, 1.0);
    u_xlat3.x = u_xlat0.x * u_xlat0.x;
    u_xlat0.x = (-u_xlat0.x) * 2.0 + 3.0;
    u_xlat0.x = u_xlat0.x * u_xlat3.x;
    u_xlat0.x = u_xlat0.x * vs_COLOR0.w;
    u_xlat16_1 = texture(mainTexture, vs_TEXCOORD0.xy, _GlobalMipBias.x);
    u_xlat3.xyz = vs_COLOR0.xyz;
    u_xlat0.x = u_xlat0.x * u_xlat16_1.w;
    u_xlat10 = hlslcc_FragCoord.z * hlslcc_FragCoord.w + _ProjectionParams.y;
    u_xlat2 = _ProjectionParams.y + _ProjectionParams.z;
    u_xlat10 = u_xlat10 / u_xlat2;
    u_xlat10 = u_xlat10 * _ProjectionParams.z;
    u_xlat10 = max(u_xlat10, 0.0);
    u_xlat10 = u_xlat10 * unity_FogParams.x;
    u_xlat10 = u_xlat10 * (-u_xlat10);
    u_xlat10 = exp2(u_xlat10);
    u_xlat3.xyz = u_xlat3.xyz * u_xlat16_1.xyz + (-unity_FogColor.xyz);
    SV_Target0.xyz = vec3(u_xlat10) * u_xlat3.xyz + unity_FogColor.xyz;
    SV_Target0.w = u_xlat0.x;
    SV_Target0.w = clamp(SV_Target0.w, 0.0, 1.0);
    return;
}
`,
  },
  linear: {
    vertexShader: `precision highp float;
precision highp int;
precision highp usampler2D;
in uint auraVertexId;
uniform usampler2D auraAttributes;
uniform usampler2D auraHeaders;
uniform usampler2D auraSlots;
int bitfieldInsert(int base,int insert,int offset,int bits) {
 uint mask=(0xffffffffu >> uint(32-bits)) << uint(offset);
 return int((uint(base)&~mask)|((uint(insert)<<uint(offset))&mask));
}
uint auraAttribute(int word) {
 int region=word/256000; int localWord=word-region*256000;
 int strip=localWord/256; int point=(localWord/4)%64;
 int slot=int(texelFetch(auraSlots,ivec2(strip,0),0).r);
 uvec4 value=texelFetch(auraAttributes,ivec2(point,slot*3+region),0);
 return value[localWord%4];
}
uint auraHeader(int word){int strip=word/5;int slot=int(texelFetch(auraSlots,ivec2(strip,0),0).r);return texelFetch(auraHeaders,ivec2(word%5,slot),0).r;}
vec4 ImmCB_1[4];
uniform 	vec3 _WorldSpaceCameraPos;
uniform 	vec4 unity_OrthoParams;
uniform 	vec4 hlslcc_mtx4x4unity_MatrixV[4];
uniform 	vec4 hlslcc_mtx4x4unity_MatrixVP[4];
uniform vec4 Alpha_c;
uniform vec4 uniform_c;
uniform vec4 uniform_d;
uniform float uniform_a;
uniform float uniform_b;
uniform uvec2 PADDING_0;
uniform float nbMax;
uniform float systemSeed;
uniform vec3 cameraXRSettings;




uniform mediump sampler2D bakedTexture;
out highp vec2 vs_TEXCOORD0;
out highp vec4 vs_COLOR0;
out highp vec4 vs_TEXCOORD1;
out highp vec3 vs_TEXCOORD6;
float u_xlat0;
int u_xlati0;
uint u_xlatu0;
bool u_xlatb0;
vec4 u_xlat1;
ivec4 u_xlati1;
uint u_xlatu1;
bool u_xlatb1;
vec4 u_xlat2;
uint u_xlatu2;
vec4 u_xlat3;
vec3 u_xlat4;
ivec3 u_xlati4;
vec4 u_xlat5;
uvec2 u_xlatu5;
float u_xlat6;
int u_xlati6;
uint u_xlatu6;
ivec3 u_xlati7;
uint u_xlatu7;
bool u_xlatb7;
float u_xlat8;
float u_xlat12;
int u_xlati12;
uint u_xlatu12;
bool u_xlatb12;
float u_xlat13;
int u_xlati13;
float u_xlat14;
ivec2 u_xlati14;
bool u_xlatb14;
float u_xlat18;
uint u_xlatu18;
float u_xlat19;
float u_xlat20;
bool u_xlatb20;
float u_xlat22;
void main()
{
ImmCB_1[0] = vec4(1.0,0.0,0.0,0.0);
ImmCB_1[1] = vec4(0.0,1.0,0.0,0.0);
ImmCB_1[2] = vec4(0.0,0.0,1.0,0.0);
ImmCB_1[3] = vec4(0.0,0.0,0.0,1.0);
    u_xlati0 = 0;
    u_xlatu0 = auraVertexId;
    {
        uint quo = u_xlatu0 / 252u;
        uint rem = u_xlatu0 % 252u;
        u_xlatu1 = quo;
        u_xlatu2 = rem;
    }
    u_xlati6 = int(u_xlatu1) * 5;
    u_xlati12 = int(u_xlatu1) * 5 + 1;
    u_xlatu12 = auraHeader(u_xlati12);
    u_xlatu18 = u_xlatu2 >> 2u;
    u_xlati7.x = int(u_xlatu0 & 1u);
    u_xlatu18 = u_xlatu18 + uint(u_xlati7.x);
    u_xlati7.x = (-u_xlati7.x) + int(u_xlatu18);
    u_xlatu7 = uint(u_xlati7.x) + 1u;
    u_xlatb7 = u_xlatu7>=u_xlatu12;
    if(u_xlatb7){
        gl_Position = vec4(0.0, 0.0, 0.0, 0.0);
        vs_COLOR0 = vec4(0.0, 0.0, 0.0, 0.0);
        vs_TEXCOORD1 = vec4(0.0, 0.0, 0.0, 0.0);
        vs_TEXCOORD6.xyz = vec3(0.0, 0.0, 0.0);
        vs_TEXCOORD0.xy = vec2(0.0, 0.0);
        return;
    }
    u_xlati6 = int(auraHeader(u_xlati6));
    u_xlati6 = u_xlati6 + int(u_xlatu18);
    u_xlatu7 =  uint(int(bitfieldInsert(u_xlati6, int(u_xlatu1), 6 & 0x1F, 26)));
    u_xlatb7 = u_xlatu7>=uint(floatBitsToUint(nbMax));
    if(u_xlatb7){
        gl_Position = vec4(intBitsToFloat(int(0xFFFFFFFFu)), 0.0, 0.0, 0.0);
        vs_COLOR0 = vec4(0.0, 0.0, 0.0, 0.0);
        vs_TEXCOORD1 = vec4(0.0, 0.0, 0.0, 0.0);
        vs_TEXCOORD6.xyz = vec3(0.0, 0.0, 0.0);
        vs_TEXCOORD0.xy = vec2(0.0, 0.0);
        return;
    }
    u_xlati7.x = u_xlati6 << 4;
    u_xlati7.x = int(bitfieldInsert(u_xlati7.x, int(u_xlatu1), 10 & 0x1F, 26));
    u_xlati7.xyz = u_xlati7.xxx + ivec3(1024000, 2048000, 2048012);
    u_xlat2.xy = vec2(uintBitsToFloat(auraAttribute((u_xlati7.y >> 2) + 0)), uintBitsToFloat(auraAttribute((u_xlati7.y >> 2) + 1)));
    u_xlat13 = uintBitsToFloat(auraAttribute((u_xlati7.z >> 2) + 0));
    u_xlat3 = vec4(uintBitsToFloat(auraAttribute((u_xlati7.x >> 2) + 0)), uintBitsToFloat(auraAttribute((u_xlati7.x >> 2) + 1)), uintBitsToFloat(auraAttribute((u_xlati7.x >> 2) + 3)), uintBitsToFloat(auraAttribute((u_xlati7.x >> 2) + 2)));
    u_xlatb7 = 0u<u_xlatu18;
    u_xlati14.xy = ivec2(u_xlati6) + ivec2(int(0xFFFFFFFFu), 1);
    u_xlati6 = int(u_xlatu1) << 10;
    u_xlati1.xw = ivec2(bitfieldInsert(int(u_xlati6), u_xlati14.x, int(4) & 0x1F, int(6)), bitfieldInsert(int(u_xlati6), u_xlati14.y, int(4) & 0x1F, int(6)));
    u_xlati1.xw = u_xlati1.xw + ivec2(1024000, 1024000);
    u_xlat4.xyz = vec3(uintBitsToFloat(auraAttribute((u_xlati1.x >> 2) + 0)), uintBitsToFloat(auraAttribute((u_xlati1.x >> 2) + 1)), uintBitsToFloat(auraAttribute((u_xlati1.x >> 2) + 2)));
    u_xlat4.xyz = u_xlat3.wxy + (-u_xlat4.zxy);
    u_xlat6 = dot(u_xlat4.xyz, u_xlat4.xyz);
    u_xlatb1 = 9.99999975e-06<u_xlat6;
    u_xlat6 = inversesqrt(u_xlat6);
    u_xlat4.xyz = vec3(u_xlat6) * u_xlat4.xyz;
    u_xlati4.xyz = ivec3((uvec3(bvec3(u_xlatb1)) * 0xFFFFFFFFu) & uvec3(floatBitsToUint(u_xlat4.xyz)));
    u_xlat4.xyz = bool(u_xlatb7) ? intBitsToFloat(u_xlati4.xyz) : vec3(0.0, 0.0, 0.0);
    u_xlatu6 = u_xlatu12 + 4294967295u;
    u_xlatb12 = u_xlatu18<u_xlatu6;
    u_xlat1.xyw = vec3(uintBitsToFloat(auraAttribute((u_xlati1.w >> 2) + 0)), uintBitsToFloat(auraAttribute((u_xlati1.w >> 2) + 1)), uintBitsToFloat(auraAttribute((u_xlati1.w >> 2) + 2)));
    u_xlat1.xyw = (-u_xlat3.wxy) + u_xlat1.wxy;
    u_xlat14 = dot(u_xlat1.xyw, u_xlat1.xyw);
    u_xlatb20 = 9.99999975e-06<u_xlat14;
    u_xlat14 = inversesqrt(u_xlat14);
    u_xlat1.xyw = u_xlat1.xyw * vec3(u_xlat14);
    u_xlati1.xyw = ivec3((uvec3(bvec3(u_xlatb20)) * 0xFFFFFFFFu) & uvec3(floatBitsToUint(u_xlat1.xyw)));
    u_xlat1.xyw = bool(u_xlatb12) ? intBitsToFloat(u_xlati1.xyw) : vec3(0.0, 0.0, 0.0);
    u_xlat1.xyw = u_xlat1.xyw + u_xlat4.xyz;
    u_xlat12 = dot(u_xlat1.xyw, u_xlat1.xyw);
    u_xlat12 = inversesqrt(u_xlat12);
    u_xlat1.xyw = vec3(u_xlat12) * u_xlat1.xyw;
    u_xlatb12 = unity_OrthoParams.w==0.0;
    u_xlat4.xyz = u_xlat3.wxy + (-_WorldSpaceCameraPos.zxy);
    u_xlat5.y = (-hlslcc_mtx4x4unity_MatrixV[0].z);
    u_xlat5.z = (-hlslcc_mtx4x4unity_MatrixV[1].z);
    u_xlat5.x = (-hlslcc_mtx4x4unity_MatrixV[2].z);
    u_xlat4.xyz = (bool(u_xlatb12)) ? u_xlat4.xyz : u_xlat5.xyz;
    u_xlat5.xyz = u_xlat1.wxy * u_xlat4.xyz;
    u_xlat4.xyz = u_xlat4.zxy * u_xlat1.xyw + (-u_xlat5.xyz);
    u_xlat12 = dot(u_xlat4.xyz, u_xlat4.xyz);
    u_xlatb14 = u_xlat12<9.99999975e-06;
    u_xlat12 = inversesqrt(u_xlat12);
    u_xlat4.xyz = vec3(u_xlat12) * u_xlat4.xyz;
    u_xlat4.xyz = (bool(u_xlatb14)) ? vec3(0.0, 1.0, 0.0) : u_xlat4.xyz;
    u_xlat5.xyz = u_xlat1.xyw * u_xlat4.yzx;
    u_xlat1.xyw = u_xlat1.wxy * u_xlat4.zxy + (-u_xlat5.xyz);
    u_xlat12 = u_xlat2.y * uniform_b + uniform_a;
    u_xlat13 = u_xlat3.z / u_xlat13;
    u_xlat8 = (-u_xlat13) + 1.5;
    u_xlat14 = u_xlat12 * u_xlat8;
    u_xlat20 = unpackHalf2x16(uint(floatBitsToUint(Alpha_c.x))).x;
    u_xlatu5.xy = uvec2(floatBitsToUint(Alpha_c.xw)) >> uvec2(16u, 2u);
    u_xlat22 = unpackHalf2x16(u_xlatu5.x).x;
    u_xlat5.x = u_xlat13 * u_xlat20 + u_xlat22;
    switch(int(u_xlatu5.y)){
        case 1:
            u_xlat13 = min(u_xlat5.x, 1.0);
            u_xlat13 = fract(u_xlat13);
            u_xlat5.x = u_xlat13 * 0.9921875 + 0.00390625;
            break;
        case 2:
            u_xlat13 = max(u_xlat5.x, 0.0);
            u_xlat13 = fract(u_xlat13);
            u_xlat5.x = u_xlat13 * 0.9921875 + 0.00390625;
            break;
        case 3:
            u_xlat5.x = u_xlat5.x;
            u_xlat5.x = clamp(u_xlat5.x, 0.0, 1.0);
            u_xlat5.x = u_xlat5.x * 0.9921875 + 0.00390625;
            break;
        default:
            break;
    }
    u_xlati13 = int(uint(floatBitsToUint(Alpha_c.w)) & 3u);
    u_xlat5.z = Alpha_c.z;
    u_xlat5 = textureLod(bakedTexture, u_xlat5.xz, 0.0);
    u_xlat13 = dot(u_xlat5, ImmCB_1[u_xlati13]);
    u_xlat13 = u_xlat13 * Alpha_c.y;
    u_xlat2.x = u_xlat2.x * 2.0 + -1.0;
    u_xlat2.x = u_xlat2.x * u_xlat2.x;
    u_xlat2.x = (-u_xlat2.x) * 1.10000002 + 1.0;
    u_xlat2.x = max(u_xlat2.x, 0.0);
    u_xlat20 = u_xlat2.x * uniform_d.w + uniform_c.w;
    vs_COLOR0.w = u_xlat13 * u_xlat20;
    vs_COLOR0.xyz = u_xlat2.xxx * uniform_d.xyz + uniform_c.xyz;
    u_xlat18 = float(u_xlatu18);
    u_xlat6 = float(u_xlatu6);
    vs_TEXCOORD0.x = u_xlat18 / u_xlat6;
    u_xlatu0 = u_xlatu0 & 2u;
    u_xlat0 = float(u_xlatu0);
    u_xlat6 = u_xlat0 * 0.5;
    u_xlat5.x = u_xlat0 * 0.5 + -0.5;
    u_xlatb0 = u_xlat14<0.0;
    u_xlat0 = (u_xlatb0) ? -9.99999975e-06 : 9.99999975e-06;
    u_xlat0 = u_xlat12 * u_xlat8 + u_xlat0;
    u_xlat2.xyz = vec3(u_xlat0) * u_xlat4.xyz;
    u_xlat1.xyz = vec3(u_xlat0) * u_xlat1.xyw;
    u_xlat2.w = u_xlat3.x;
    u_xlat5.y = 1.0;
    u_xlat12 = dot(u_xlat2.xw, u_xlat5.xy);
    u_xlat3.xz = u_xlat2.yz;
    u_xlat18 = dot(u_xlat3.xy, u_xlat5.xy);
    u_xlat19 = dot(u_xlat3.zw, u_xlat5.xy);
    u_xlat2 = vec4(u_xlat18) * hlslcc_mtx4x4unity_MatrixVP[1];
    u_xlat2 = hlslcc_mtx4x4unity_MatrixVP[0] * vec4(u_xlat12) + u_xlat2;
    u_xlat2 = hlslcc_mtx4x4unity_MatrixVP[2] * vec4(u_xlat19) + u_xlat2;
    gl_Position = u_xlat2 + hlslcc_mtx4x4unity_MatrixVP[3];
    u_xlat12 = dot((-u_xlat1.xyz), (-u_xlat1.xyz));
    u_xlat12 = inversesqrt(u_xlat12);
    u_xlat1.xyz = vec3(u_xlat12) * (-u_xlat1.xyz);
    u_xlat12 = u_xlat0 * u_xlat0;
    u_xlat0 = u_xlat0 * u_xlat12;
    u_xlatb0 = u_xlat0<0.0;
    u_xlat0 = (u_xlatb0) ? -1.0 : 1.0;
    vs_TEXCOORD6.xyz = u_xlat1.xyz * vec3(u_xlat0);
    vs_TEXCOORD1 = vec4(1.0, 0.0, 0.0, 0.0);
    vs_TEXCOORD0.y = u_xlat6;
    return;
}
`,
    fragmentShader: `precision highp float;
precision highp int;


uniform 	vec4 _ScaledScreenParams;
uniform 	vec4 _ProjectionParams;
uniform 	vec2 _GlobalMipBias;
uniform 	vec4 _ZBufferParams;
uniform 	vec4 unity_OrthoParams;
uniform 	vec4 unity_FogParams;
uniform 	mediump vec4 unity_FogColor;
uniform mediump sampler2D mainTexture;
uniform highp sampler2D _CameraDepthTexture;
in highp vec2 vs_TEXCOORD0;
in highp vec4 vs_COLOR0;
in highp vec4 vs_TEXCOORD1;
out highp vec4 SV_Target0;
vec2 u_xlat0;
bool u_xlatb0;
mediump vec4 u_xlat16_1;
float u_xlat2;
vec3 u_xlat3;
vec2 u_xlat6;
float u_xlat9;
float u_xlat10;
void main()
{
vec4 hlslcc_FragCoord = vec4(gl_FragCoord.xyz, 1.0/gl_FragCoord.w);
    u_xlatb0 = unity_OrthoParams.w==0.0;
    if(u_xlatb0){
        u_xlat0.xy = vec2(1.0) / vec2(_ScaledScreenParams.xy);
        u_xlat0.xy = u_xlat0.xy * hlslcc_FragCoord.xy;
        u_xlat0.x = texture(_CameraDepthTexture, u_xlat0.xy, _GlobalMipBias.x).x;
        u_xlat0.x = _ZBufferParams.z * u_xlat0.x + _ZBufferParams.w;
        u_xlat0.x = float(1.0) / u_xlat0.x;
        u_xlat3.x = hlslcc_FragCoord.w;
    } else {
        u_xlat6.xy = vec2(1.0) / vec2(_ScaledScreenParams.xy);
        u_xlat6.xy = u_xlat6.xy * hlslcc_FragCoord.xy;
        u_xlat6.x = texture(_CameraDepthTexture, u_xlat6.xy, _GlobalMipBias.x).x;
        u_xlat9 = (-_ProjectionParams.y) + _ProjectionParams.z;
        u_xlat0.x = u_xlat9 * u_xlat6.x + _ProjectionParams.y;
        u_xlat3.x = u_xlat9 * hlslcc_FragCoord.z + _ProjectionParams.y;
    }
    u_xlat0.x = (-u_xlat3.x) + u_xlat0.x;
    u_xlat0.x = u_xlat0.x * vs_TEXCOORD1.x;
    u_xlat0.x = clamp(u_xlat0.x, 0.0, 1.0);
    u_xlat3.x = u_xlat0.x * u_xlat0.x;
    u_xlat0.x = (-u_xlat0.x) * 2.0 + 3.0;
    u_xlat0.x = u_xlat0.x * u_xlat3.x;
    u_xlat0.x = u_xlat0.x * vs_COLOR0.w;
    u_xlat16_1 = texture(mainTexture, vs_TEXCOORD0.xy, _GlobalMipBias.x);
    u_xlat3.xyz = vs_COLOR0.xyz;
    u_xlat0.x = u_xlat0.x * u_xlat16_1.w;
    u_xlat10 = hlslcc_FragCoord.z * hlslcc_FragCoord.w + _ProjectionParams.y;
    u_xlat2 = _ProjectionParams.y + _ProjectionParams.z;
    u_xlat10 = u_xlat10 / u_xlat2;
    u_xlat10 = u_xlat10 * _ProjectionParams.z;
    u_xlat10 = max(u_xlat10, 0.0);
    u_xlat10 = u_xlat10 * unity_FogParams.z + unity_FogParams.w;
    u_xlat10 = clamp(u_xlat10, 0.0, 1.0);
    u_xlat3.xyz = u_xlat3.xyz * u_xlat16_1.xyz + (-unity_FogColor.xyz);
    SV_Target0.xyz = vec3(u_xlat10) * u_xlat3.xyz + unity_FogColor.xyz;
    SV_Target0.w = u_xlat0.x;
    SV_Target0.w = clamp(SV_Target0.w, 0.0, 1.0);
    return;
}
`,
  },
};
