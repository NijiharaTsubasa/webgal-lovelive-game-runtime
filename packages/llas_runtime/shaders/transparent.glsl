// AS/General/Transparent, GLES3 player program from
// input_llas/shader/asgeneraltransparent.shader.unity3d.
// Source variants: e000 (base), e004 (_SATURATE_ON), e008
// (_VERTEX_COLOR_ON), e012 (both). Their SOFTPARTICLES_ON partners are
// byte-identical. MainTexST is the material's _MainTex scale/offset.

// @section VERTEX_PRELUDE
#define USE_UV
attribute vec4 _shader_color;
uniform vec4 uMainTexST;
varying highp vec2 vLlasTransparentUv;
varying mediump vec4 vLlasTransparentColor;
// @end

// @section VERTEX_INJECT
// The GLB exporter changes Unity UV.y to 1.0 - UV.y. Apply the original
// material transform in Unity UV space, then return to glTF texture space.
vec2 llasUnityUv = vec2( uv.x, 1.0 - uv.y );
vec2 llasUnitySampleUv = llasUnityUv * uMainTexST.xy + uMainTexST.zw;
vLlasTransparentUv = vec2( llasUnitySampleUv.x, 1.0 - llasUnitySampleUv.y );
vLlasTransparentColor = _shader_color;
// @end

// @section FRAGMENT_PRELUDE
varying highp vec2 vLlasTransparentUv;
varying mediump vec4 vLlasTransparentColor;
uniform mediump sampler2D uMainTex;
uniform mediump vec4 uTintColor;
uniform float uVertexColor;
uniform float uSaturate;
// @end

// @section FRAGMENT_BODY
mediump vec4 llasTransparentSample = texture2D( uMainTex, vLlasTransparentUv );
mediump vec4 llasTransparentResult = llasTransparentSample * uTintColor;
if ( uVertexColor != 0.0 ) {
  llasTransparentResult *= vLlasTransparentColor;
}
if ( uSaturate != 0.0 ) {
  mediump vec3 llasTransparentSquare = llasTransparentSample.rgb * llasTransparentSample.rgb;
  llasTransparentResult.rgb = llasTransparentSquare * llasTransparentSquare + llasTransparentResult.rgb;
}
vec3 outgoingLight = llasTransparentResult.rgb;
diffuseColor.a = llasTransparentResult.a;
// @end
