// Source: __ubertoonshader_eye.shader.assetbundle,
// MELPOT/Toon/UberToonShader_Eye GLES3 Forward e001,
// keywords _ADDITIONAL_LIGHTS _ALPHATEST_ON
// _HIGHLIGHTBLENDMODE_ADDITIVE _MAINLIGHTOFFSETMODE_OFFSET.
// Unity material parameters retain their source spelling after the `u` prefix.
// Runtime enables the source's additional-light loop when the current scene
// supplies selected lights. Real-time shadow mapping is not published.
// Unity globals below MUST be provided by the runtime; substituting a guessed
// lighting environment would not reproduce the source program.

// @section VERTEX_PRELUDE
#define USE_UV
varying vec3 vMelpotEyeWorldPos;
// @end

// @section VERTEX_SKINNING
vMelpotEyeWorldPos = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;
// @end

// @section FRAGMENT_PRELUDE
#define USE_UV
varying vec3 vMelpotEyeWorldPos;
uniform sampler2D uMainTex;
uniform sampler2D uHighlightMainTex;
uniform sampler2D uHighlightSubTex;
uniform vec4 uMainTex_ST;
uniform vec4 uMainColor;
uniform vec4 uHighlightMainColor;
uniform vec4 uHighlightSubColor;
uniform vec4 uKeyLightColor;
uniform vec4 uAmbientColor;
uniform vec4 uUVOffsetNoiseRange;
uniform vec4 uUVScaleNoiseRange;
uniform vec4 uUVRotationNoiseRange;
uniform vec4 uExpNoiseRange;
uniform float uSeparateHighlightRandom;
uniform float uOverrideMainLightColor;
uniform float uMainLightIntensity;
uniform float uAmbientMode;
uniform float uAddIntensity;
uniform float uAlphaClipThreshold;
// Unity/URP globals, not material metadata.
uniform vec4 uUnityTimeParameters;
uniform vec4 uUnityMainLightColor;
uniform vec3 uUnitySHAmbient;
uniform float uUnityGlobalMipBias;
uniform float uUnityAlphaToMaskAvailable;
#ifdef MELPOT_EYE_ADDITIONAL_LIGHTS
uniform float uUnityAdditionalLightsCount;
uniform float uUnityLightDataY;
uniform vec4 uUnityLightIndices[2];
uniform vec4 uUnityAdditionalLightsPosition[16];
uniform vec4 uUnityAdditionalLightsColor[16];
uniform vec4 uUnityAdditionalLightsAttenuation[16];
uniform vec4 uUnityAdditionalLightsSpotDir[16];
#endif
// @end

// @section FRAGMENT_FUNCTIONS
// Exact four-corner gradient-noise arithmetic from e001 lines 276-326.
float melpotEyeNoise( vec2 p ) {
  vec2 cell = floor( p );
  vec2 f = fract( p );
  vec2 smoothF = f * f * ( -2.0 * f + 3.0 );
  float r00 = fract( sin( dot( cell, vec2( 127.099998, 311.700012 ) ) ) * 43758.5469 ) * 2.0 - 1.0;
  float r10 = fract( sin( dot( cell + vec2( 1.0, 0.0 ), vec2( 127.099998, 311.700012 ) ) ) * 43758.5469 ) * 2.0 - 1.0;
  float r01 = fract( sin( dot( cell + vec2( 0.0, 1.0 ), vec2( 127.099998, 311.700012 ) ) ) * 43758.5469 ) * 2.0 - 1.0;
  float r11 = fract( sin( dot( cell + vec2( 1.0, 1.0 ), vec2( 127.099998, 311.700012 ) ) ) * 43758.5469 ) * 2.0 - 1.0;
  float lo = dot( vec2( r00 ), f );
  float hi = dot( vec2( r10 ), f + vec2( -1.0, -0.0 ) );
  lo += smoothF.x * ( hi - lo );
  hi = dot( vec2( r01 ), f + vec2( -0.0, -1.0 ) );
  float farCorner = dot( vec2( r11 ), f + vec2( -1.0, -1.0 ) );
  hi += smoothF.x * ( farCorner - hi );
  lo += smoothF.y * ( hi - lo );
  return lo + 0.5;
}

// The first noise expression is one-dimensional only in its input, but the
// compiled program uses these exact two-component dot products (not a
// conventional 1-D interpolation).
float melpotEyeTemporalNoise( float p ) {
  float cell = floor( p );
  float f = fract( p );
  float smoothF = f * f * ( -2.0 * f + 3.0 );
  vec2 hashAxis = vec2( 127.099998, 311.700012 );
  float r00 = fract( sin( dot( vec2( cell ), hashAxis ) ) * 43758.5469 ) * 2.0 - 1.0;
  float r10 = fract( sin( dot( vec2( cell + 1.0, cell ), hashAxis ) ) * 43758.5469 ) * 2.0 - 1.0;
  float r01 = fract( sin( dot( vec2( cell, cell + 1.0 ), hashAxis ) ) * 43758.5469 ) * 2.0 - 1.0;
  float r11 = fract( sin( dot( vec2( cell + 1.0 ), hashAxis ) ) * 43758.5469 ) * 2.0 - 1.0;
  float lo = dot( vec2( r00 ), vec2( f ) );
  float hi = dot( vec2( r10 ), vec2( f, f - 1.0 ) );
  lo += smoothF * ( hi - lo );
  hi = dot( vec2( r01 ), vec2( f, f - 1.0 ) );
  float farCorner = dot( vec2( r11 ), vec2( f - 1.0 ) );
  hi += smoothF * ( farCorner - hi );
  lo += smoothF * ( hi - lo );
  return lo + 0.5;
}

float melpotEyeLinearToGamma( float v ) {
  if ( 0.00313080009 >= v ) return v * 12.9232101;
  return exp2( log2( abs( v ) ) * 0.416666657 ) * 1.05499995 - 0.0549999997;
}

vec2 melpotEyeRotate( vec2 uv, float angle ) {
  float s = sin( angle );
  float c = cos( angle );
  vec2 centered = uv - 0.5;
  return vec2( dot( centered, vec2( c, s ) ), dot( centered, vec2( -s, c ) ) ) + 0.5;
}
// @end

// @section FRAGMENT_BODY
// e001 lines 274-530, with source arithmetic retained and HLSLCC temporaries
// renamed only where their meaning is unambiguous.
vec2 melpotEyeMainUv = vUv * uMainTex_ST.xy + uMainTex_ST.zw;
vec4 melpotEyeBase = texture2D( uMainTex, melpotEyeMainUv, uUnityGlobalMipBias ) * uMainColor;

float melpotEyeOffsetNoise = melpotEyeTemporalNoise( uUnityTimeParameters.z );
vec4 melpotEyeUvOffset = melpotEyeOffsetNoise *
  ( -uUVOffsetNoiseRange.xxzz + uUVOffsetNoiseRange.yyww ) + uUVOffsetNoiseRange.xxzz;
vec4 melpotEyeUvScale = melpotEyeOffsetNoise *
  ( -uUVScaleNoiseRange.xxzz + uUVScaleNoiseRange.yyww ) + uUVScaleNoiseRange.xxzz;
vec4 melpotEyeHighlightUv = ( vUv.xyxy + melpotEyeUvOffset ) * melpotEyeUvScale
  + ( vec4( 1.0 ) - melpotEyeUvScale ) * 0.5;

float melpotEyeRotationNoise = melpotEyeNoise( uUnityTimeParameters.yz * vec2( 5.0, 10.0 ) );
vec2 melpotEyeRotation = melpotEyeRotationNoise *
  ( -uUVRotationNoiseRange.xz + uUVRotationNoiseRange.yw ) + uUVRotationNoiseRange.xz;
vec2 melpotEyeMainHighlightUv = melpotEyeRotate( melpotEyeHighlightUv.xy, melpotEyeRotation.x );
vec3 melpotEyeMainHighlight = texture2D( uHighlightMainTex, melpotEyeMainHighlightUv,
  uUnityGlobalMipBias ).rgb;
vec2 melpotEyeExponent = melpotEyeRotationNoise *
  ( -uExpNoiseRange.xz + uExpNoiseRange.yw ) + uExpNoiseRange.xz;
melpotEyeMainHighlight = exp2( log2( abs( melpotEyeMainHighlight ) ) * melpotEyeExponent.x );
vec2 melpotEyeSubHighlightUv = melpotEyeRotate( melpotEyeHighlightUv.zw, melpotEyeRotation.y );
bool melpotEyeSeparate = uSeparateHighlightRandom != 0.0;
vec3 melpotEyeSubHighlight = texture2D( uHighlightSubTex,
  melpotEyeSeparate ? melpotEyeSubHighlightUv : melpotEyeMainHighlightUv,
  uUnityGlobalMipBias ).rgb;
melpotEyeSubHighlight = exp2( log2( abs( melpotEyeSubHighlight ) ) *
  ( melpotEyeSeparate ? melpotEyeExponent.y : melpotEyeExponent.x ) );
melpotEyeSubHighlight *= uHighlightSubColor.rgb;

vec3 melpotEyeAmbient = vec3(
  melpotEyeLinearToGamma( uUnitySHAmbient.r ),
  melpotEyeLinearToGamma( uUnitySHAmbient.g ),
  melpotEyeLinearToGamma( uUnitySHAmbient.b ) );
melpotEyeAmbient = max( max( melpotEyeAmbient, vec3( 0.0 ) ), vec3( 0.100000001 ) );

float melpotEyeMainLightMaximum = max( max( uUnityMainLightColor.y,
  uUnityMainLightColor.x ), uUnityMainLightColor.z ) + 1.00000001e-07;
vec3 melpotEyeLightColor = uUnityMainLightColor.rgb / melpotEyeMainLightMaximum;
if ( uOverrideMainLightColor != 0.0 ) {
  melpotEyeLightColor = uKeyLightColor.rgb * uMainLightIntensity;
}

vec3 melpotEyeAdditionalColor = vec3( 0.0 );
#ifdef MELPOT_EYE_ADDITIONAL_LIGHTS
int melpotEyeAdditionalCount = int( min( uUnityAdditionalLightsCount, uUnityLightDataY ) );
for ( int melpotEyeLoop = 0; melpotEyeLoop < 16; melpotEyeLoop++ ) {
  if ( melpotEyeLoop >= melpotEyeAdditionalCount ) break;
  int melpotEyeVectorIndex = melpotEyeLoop >> 2;
  int melpotEyeComponentIndex = melpotEyeLoop & 3;
  int melpotEyeLightIndex = int( uUnityLightIndices[ melpotEyeVectorIndex ][ melpotEyeComponentIndex ] );
  vec3 melpotEyeToLight = -vMelpotEyeWorldPos.zxy *
    uUnityAdditionalLightsPosition[ melpotEyeLightIndex ].www +
    uUnityAdditionalLightsPosition[ melpotEyeLightIndex ].zxy;
  float melpotEyeDistance2 = max( dot( melpotEyeToLight, melpotEyeToLight ), 6.10351562e-05 );
  melpotEyeToLight *= inversesqrt( melpotEyeDistance2 );
  float melpotEyeAttenuation = 1.0 / melpotEyeDistance2;
  float melpotEyeRange = melpotEyeDistance2 *
    uUnityAdditionalLightsAttenuation[ melpotEyeLightIndex ].x;
  float melpotEyeRangeFade = max( 1.0 - melpotEyeRange * melpotEyeRange, 0.0 );
  melpotEyeAttenuation *= melpotEyeRangeFade * melpotEyeRangeFade;
  float melpotEyeSpot = dot( uUnityAdditionalLightsSpotDir[ melpotEyeLightIndex ].zxy,
    melpotEyeToLight );
  melpotEyeSpot = clamp( melpotEyeSpot *
    uUnityAdditionalLightsAttenuation[ melpotEyeLightIndex ].z +
    uUnityAdditionalLightsAttenuation[ melpotEyeLightIndex ].w, 0.0, 1.0 );
  melpotEyeAttenuation *= melpotEyeSpot * melpotEyeSpot;

  melpotEyeAdditionalColor += uUnityAdditionalLightsColor[ melpotEyeLightIndex ].rgb *
    melpotEyeAttenuation;
}
#endif

melpotEyeLightColor += melpotEyeAdditionalColor;
melpotEyeLightColor = max( melpotEyeAmbient, melpotEyeLightColor );
vec3 melpotEyeLit = melpotEyeBase.rgb * melpotEyeLightColor;
vec3 melpotEyeHighlights = uHighlightMainColor.rgb * melpotEyeMainHighlight +
  melpotEyeSubHighlight;
float melpotEyeHighlightLuminance = dot( melpotEyeHighlights,
  vec3( 0.212672904, 0.715152204, 0.0721750036 ) );
vec3 melpotEyeColor = uAmbientMode != 0.0 ?
  melpotEyeLit + uAmbientColor.rgb : melpotEyeLit * uAmbientColor.rgb;
melpotEyeColor += melpotEyeHighlights * uAddIntensity;
float melpotEyeAlpha = max( melpotEyeBase.a, melpotEyeHighlightLuminance );
float melpotEyeAlphaWidth = abs( dFdx( melpotEyeAlpha ) ) +
  abs( dFdy( melpotEyeAlpha ) );
float melpotEyeAlphaOffset = melpotEyeAlpha - uAlphaClipThreshold;
float melpotEyeCoverage = clamp(
  ( melpotEyeAlphaOffset - 0.5 * melpotEyeAlphaWidth ) /
  max( melpotEyeAlphaWidth, 9.99999975e-05 ) + 1.0, 0.0, 1.0 );
float melpotEyeClip = uUnityAlphaToMaskAvailable != 0.0 &&
  uAlphaClipThreshold > 0.0 ?
  melpotEyeCoverage - 9.99999975e-05 : melpotEyeAlphaOffset;
if ( melpotEyeClip < 0.0 ) discard;
diffuseColor.a = uUnityAlphaToMaskAvailable != 0.0 ? melpotEyeAlpha : 1.0;
vec3 outgoingLight = melpotEyeColor;
// @end
