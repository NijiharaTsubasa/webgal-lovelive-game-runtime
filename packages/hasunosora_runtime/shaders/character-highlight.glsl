// character-highlight — Eye highlight (sparkle + tear) shader
//
// The compiled Forward vertex program uses ordinary projection, without an
// additional clip-space depth offset.
// Fragment sampling and clipping come from the retained Vulkan program.
// Lighting still needs a separate source-program audit.

// @section VERTEX_PRELUDE
#define USE_UV
varying vec3 vMelpotEyeWorldPos;
// @end

// @section VERTEX_INJECT
vMelpotEyeWorldPos = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;
// @end

// @section FRAGMENT_PRELUDE
#define USE_UV
varying vec3 vMelpotEyeWorldPos;
uniform float uOverrideMainLightColor;
uniform vec4 uKeyLightColor;
uniform float uMainLightIntensity;
uniform float uAmbientMode;
uniform vec4 uAmbientColor;
uniform vec3 uSceneLightColor;
uniform vec3 uSceneAmbientColor;
uniform int uAdditionalLightCount;
uniform vec4 uAdditionalLightPosition[8];
uniform vec4 uAdditionalLightColor[8];
uniform vec4 uAdditionalLightAttenuation[8];
uniform vec4 uAdditionalLightSpotDir[8];
// @end

// @section COMPILED_PATTERN
// CharacterHighlight Vulkan blob4/5/7 fragment modules share this sample
// path. It also appears in blob1 Forward before the lighting calculation.
// The temporary register order below deliberately follows the compiled code.
uniform sampler2D uCryTexture;
uniform sampler2D uMainTexture;
uniform vec4 uHighlightMainColor;
uniform float uUseCryParameters;
uniform float uNormal_TilingNoiseWidth;
uniform float uNormal_RotateNoiseWidth;
uniform float uNormal_TilingFrequency;
uniform float uNormal_RotateFrequency;
uniform float uCry_TilingNoiseWidth;
uniform float uCry_RotateNoiseWidth;
uniform float uCry_TilingFrequency;
uniform float uCry_RotateFrequency;
uniform float uTime;

vec3 chCompiledPattern( vec2 sourceUv ) {
  // Vulkan Forward blob1 fragment, from the noise-parameter selection
  // through the two value-noise interpolations and UV rotation.
  const vec2 hashBasis = vec2( 127.0999984741211, 311.70001220703125 );
  vec4 cry = vec4( uCry_TilingNoiseWidth * 100.0 + 0.009999999776482582,
    uCry_RotateFrequency * 100.0, uCry_RotateNoiseWidth * 100.0,
    uCry_TilingFrequency * 100.0 );
  vec4 normal = vec4( uNormal_TilingNoiseWidth, uNormal_RotateNoiseWidth,
    uNormal_TilingFrequency, uNormal_RotateFrequency ) * 100.0;
  bool useCry = uUseCryParameters != 0.0;
  vec4 parameters = floor( mix( normal, cry, bvec4( useCry ) ) );
  vec3 frequency = parameters.yzw * vec3( 0.009999999776482582, uTime, uTime );
  vec4 oscillation = cos( frequency.yyzz * 0.009999999776482582 );
  vec4 corner = floor( oscillation.yyww );
  vec4 fraction = fract( oscillation );
  vec2 smoothFactor = fraction.yw * fraction.yw * ( 3.0 - 2.0 * fraction.yw );
  vec4 nextCorner = corner + vec4( 1.0, 0.0, 1.0, 0.0 );
  vec4 negativeFraction = fraction + vec4( -1.0, -0.0, -1.0, -0.0 );

  float h00 = fract( sin( dot( corner.yy, hashBasis ) ) * 43758.546875 ) * 2.0 - 1.0;
  float h10 = fract( sin( dot( nextCorner.xy, hashBasis ) ) * 43758.546875 ) * 2.0 - 1.0;
  float h01 = fract( sin( dot( nextCorner.yx, hashBasis ) ) * 43758.546875 ) * 2.0 - 1.0;
  float h11 = fract( sin( dot( nextCorner.xx, hashBasis ) ) * 43758.546875 ) * 2.0 - 1.0;
  float noiseA = dot( vec2( h00 ), fraction.yy );
  float upperA = dot( vec2( h10 ), negativeFraction.xy );
  noiseA += smoothFactor.x * ( upperA - noiseA );
  float lowerA = dot( vec2( h01 ), negativeFraction.xy );
  float lowerB = dot( vec2( h11 ), negativeFraction.xx );
  lowerA += smoothFactor.x * ( lowerB - lowerA );
  noiseA += smoothFactor.x * ( lowerA - noiseA );
  noiseA += 0.5;
  float baseScale = 1.0 - parameters.x * 0.009999999776482582;
  float uvScale = noiseA * ( 1.0 - baseScale ) + baseScale;

  float g00 = fract( sin( dot( corner.ww, hashBasis ) ) * 43758.546875 ) * 2.0 - 1.0;
  float g01 = fract( sin( dot( nextCorner.zw, hashBasis ) ) * 43758.546875 ) * 2.0 - 1.0;
  float g10 = fract( sin( dot( nextCorner.wz, hashBasis ) ) * 43758.546875 ) * 2.0 - 1.0;
  float g11 = fract( sin( dot( nextCorner.zz, hashBasis ) ) * 43758.546875 ) * 2.0 - 1.0;
  float noiseB = dot( vec2( g00 ), fraction.ww );
  float upperB = dot( vec2( g01 ), negativeFraction.zw );
  noiseB += smoothFactor.y * ( upperB - noiseB );
  float lowerC = dot( vec2( g10 ), negativeFraction.zw );
  float lowerD = dot( vec2( g11 ), negativeFraction.zz );
  lowerC += smoothFactor.y * ( lowerD - lowerC );
  noiseB += smoothFactor.y * ( lowerC - noiseB );
  noiseB += 0.5;

  float angle = frequency.x * noiseB;
  float sine = sin( angle );
  float cosine = cos( angle );
  vec2 centeredUv = sourceUv * uvScale - vec2( 0.5 );
  vec2 sampledUv = vec2( dot( centeredUv, vec2( cosine, sine ) ),
    dot( centeredUv, vec2( -sine, cosine ) ) ) + vec2( 0.5 );
  vec3 crySample = texture2D( uCryTexture, sampledUv ).rgb;
  vec3 mainSample = texture2D( uMainTexture, sampledUv ).rgb;
  return ( mainSample + float( useCry ) * ( crySample - mainSample ) ) * uHighlightMainColor.rgb;
}
// @end

// @section COMPILED_CLIP
uniform float uAlphaClipThreshold;
uniform float uUnityAlphaToMaskAvailable;

float chCompiledClip( vec3 baseColor ) {
  float luminance = dot( baseColor,
    vec3( 0.2126729041337967, 0.7151522040367126, 0.07217500358819962 ) );
  float rawClip = luminance - uAlphaClipThreshold;
  // Vulkan's dFdxCoarse/dFdyCoarse has no WebGL2 equivalent; ordinary
  // derivatives are the closest available GLSL ES operation here.
  if ( uUnityAlphaToMaskAvailable == 0.0 || uAlphaClipThreshold <= 0.0 ) return rawClip;
  float width = abs( dFdx( luminance ) ) + abs( dFdy( luminance ) );
  return clamp( ( rawClip - width * 0.5 ) / max( width, 9.999999747378752e-05 ) + 1.0,
    0.0, 1.0 ) - 9.999999747378752e-05;
}
// @end

// @section COMPILED_LIGHT
float chLinearToGamma( float value ) {
  if ( value <= 0.00313080009073019 ) return value * 12.923210144042969;
  return exp2( log2( abs( value ) ) * 0.4166666567325592 )
    * 1.0549999475479126 - 0.054999999701976776;
}

vec3 chCompiledLight() {
  // Forward blob1: normalize the current scene main-light color, then add
  // the selected per-object lights before applying the SH ambient floor.
  float maximum = max( max( uSceneLightColor.r, uSceneLightColor.g ),
    uSceneLightColor.b ) + 1.0000000116860974e-07;
  vec3 mainLight = uSceneLightColor / maximum;
  if ( uOverrideMainLightColor != 0.0 ) {
    mainLight = uKeyLightColor.rgb * uMainLightIntensity;
  }
  vec3 additionalLight = vec3( 0.0 );
  for ( int i = 0; i < 8; ++i ) {
    if ( i >= uAdditionalLightCount ) break;
    vec3 lightVector = uAdditionalLightPosition[ i ].xyz
      - vMelpotEyeWorldPos * uAdditionalLightPosition[ i ].w;
    float distanceSquared = max( dot( lightVector, lightVector ), 6.103515625e-05 );
    vec3 lightDirection = lightVector * inversesqrt( distanceSquared );
    float rangeTerm = distanceSquared * uAdditionalLightAttenuation[ i ].x;
    float range = max( 1.0 - rangeTerm * rangeTerm, 0.0 );
    float distanceAttenuation = range * range / distanceSquared;
    float spot = clamp( dot( uAdditionalLightSpotDir[ i ].xyz, lightDirection )
      * uAdditionalLightAttenuation[ i ].z + uAdditionalLightAttenuation[ i ].w,
      0.0, 1.0 );
    additionalLight += uAdditionalLightColor[ i ].rgb
      * distanceAttenuation * spot * spot;
  }
  vec3 ambientFloor = vec3(
    chLinearToGamma( uSceneAmbientColor.r ),
    chLinearToGamma( uSceneAmbientColor.g ),
    chLinearToGamma( uSceneAmbientColor.b )
  );
  return max( mainLight + additionalLight,
    max( ambientFloor, vec3( 0.10000000149011612 ) ) );
}
// @end

// @section FRAGMENT_BODY
vec3 melpotHLBase = chCompiledPattern( vUv );
vec3 melpotHLLight = chCompiledLight();
vec3 melpotHLLit = melpotHLBase * melpotHLLight;
vec3 outgoingLight = uAmbientMode != 0.0
	? melpotHLLit + uAmbientColor.rgb
	: melpotHLLit * uAmbientColor.rgb;

// luminance-based alpha clip, edge smoothed with screen-space derivatives
float melpotHLLum = dot( melpotHLBase, vec3( 0.2126729, 0.7151522, 0.0721750 ) );
if ( chCompiledClip( melpotHLBase ) < 0.0 ) discard;
diffuseColor.a = uUnityAlphaToMaskAvailable != 0.0 ? melpotHLLum : 1.0;
// @end
