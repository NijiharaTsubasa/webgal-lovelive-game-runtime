// AS/Member GLES3 translation. Evidence: input_llas/shader/asmembermain.shader.unity3d
// entries e000-e007 and asmemberoutline.shader.unity3d entry e000.
// Optional code is selected by the serialized Unity shader keywords.

// @section VERTEX_PRELUDE
#define USE_UV
attribute vec4 _shader_color;
varying vec4 vLlasColor;
varying vec3 vLlasViewNormal;
varying vec3 vLlasViewDirection;
uniform vec4 uRimlightDirection;
// @end

// @section VERTEX_SKINNORMAL
// Unity's Main VS uses MatrixV * ObjectToWorld * skinned normal without
// normalization. The objectNormal value includes Three's skin/morph stage.
vLlasViewNormal = mat3( viewMatrix * modelMatrix ) * objectNormal;
// @end

// @section VERTEX_SKINNING
vLlasColor = _shader_color;
vec3 llasWorldPosition = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;
vec3 llasViewToCamera = ( viewMatrix * vec4( cameraPosition - llasWorldPosition, 0.0 ) ).xyz;
vLlasViewDirection = normalize( llasViewToCamera - uRimlightDirection.xyz );
// @end

// @section FRAGMENT_PRELUDE
#define USE_UV
varying vec4 vLlasColor;
varying vec3 vLlasViewNormal;
varying vec3 vLlasViewDirection;
uniform sampler2D uMainTex;
uniform sampler2D uRimlightTex;
uniform vec4 uTintColor;
uniform vec4 uAmbientColor;
uniform vec4 uRimlightColor;
uniform float uRimglightIntensity;
uniform float uRimglightPower;
uniform float uMainTexMipmapBias;
#ifdef LLAS_CHEEK_ON
uniform sampler2DArray uCheekTex;
uniform float uCheekIntensity;
uniform float uCheekTexArrayIndex;
#endif
#ifdef LLAS_EMISSIVE_ON
uniform sampler2D uEmissiveScrollTex;
uniform sampler2D uEmissiveTex;
uniform vec4 uEmissiveIntensity;
uniform vec4 uEmissiveFlicker;
uniform float uBeat;
#endif
#ifdef LLAS_MATCAP_ON
uniform sampler2D uMatcapTex;
uniform sampler2D uMatcapMaskTex;
uniform vec4 uMatcapIntensity;
uniform float uMatcapTexDarkenR;
uniform float uMatcapTexAdd;
uniform float uMatcapBrightR;
uniform float uMatcapBrightG;
uniform vec4 uMatcapSpanCol;
uniform float uMatcapSpanColTexAdd;
#endif
// @end

// @section FRAGMENT_BODY
vec4 llasMain = texture( uMainTex, vUv, uMainTexMipmapBias );
vec4 llasVertexShade = vLlasColor.z < 0.100000001
    ? vec4( 0.349999994, 0.349999994, 0.349999994, 1.0 )
    : vec4( 1.0 );
vec3 llasBase;
#ifdef LLAS_MATCAP_ON
    vec2 llasMatcapUv = vLlasViewNormal.xy * vec2( 0.5 ) + vec2( 0.5 );
    llasMatcapUv.y = 1.0 - llasMatcapUv.y;
    vec4 llasMatcap = texture( uMatcapTex, llasMatcapUv );
    vec3 llasMask = texture( uMatcapMaskTex, vUv ).xyz;
    float llasLuma = dot( llasMatcap.xyz, vec3( 0.298999995, 0.587000012, 0.114 ) );
    vec3 llasSpan = llasLuma * uMatcapSpanCol.xyz;
    vec3 llasSpanMix = llasMain.xyz * vec3( uMatcapSpanColTexAdd )
        + vec3( 1.0 - uMatcapSpanColTexAdd );
    llasSpan = llasSpan * llasSpanMix - llasMatcap.xyz;
    llasSpan = llasMask.zzz * llasSpan + llasMatcap.xyz;

    vec3 llasGreen = llasSpan * vec3( uMatcapBrightG ) + llasMain.xyz;
    llasGreen = llasGreen * vec3( uMatcapTexAdd );
    llasGreen = llasSpan * vec3( 1.0 - uMatcapTexAdd ) + llasGreen;
    llasGreen = llasGreen - llasMain.xyz;
    llasGreen = ( llasMask.yyy * uMatcapIntensity.xyz ) * llasGreen + llasMain.xyz;

    float llasOneMinusAlpha = 1.0 - llasMatcap.w;
    vec3 llasDark = llasMain.xyz * vec3( uMatcapTexDarkenR );
    vec3 llasBright = ( vec3( 1.0 ) - llasDark ) * vec3( 2.0 );
    vec3 llasRed = vec3( 1.0 ) - llasBright * vec3( llasOneMinusAlpha );
    bvec3 llasUnderHalf = lessThan( llasDark, vec3( 0.5 ) );
    vec3 llasDarkened = llasMatcap.www * ( llasDark + llasDark );
    llasRed = vec3(
        llasUnderHalf.x ? llasDarkened.x : llasRed.x,
        llasUnderHalf.y ? llasDarkened.y : llasRed.y,
        llasUnderHalf.z ? llasDarkened.z : llasRed.z
    );
    llasRed = llasRed * vec3( uMatcapTexAdd );
    llasRed = llasMatcap.www * vec3( 1.0 - uMatcapTexAdd ) + llasRed;
    llasRed = llasRed * vec3( uMatcapBrightR ) - llasMain.xyz;
    llasRed = ( llasMask.xxx * uMatcapIntensity.xyz ) * llasRed + llasMain.xyz;
    vec3 llasMatcapResult = llasMask.yyy * ( llasGreen - llasRed ) + llasRed;

    llasBase = llasMatcapResult;
#else
    llasBase = llasMain.xyz;
#endif

#ifdef LLAS_CHEEK_ON
    vec2 llasUnityUv = vec2( vUv.x, 1.0 - vUv.y );
    vec2 llasUnityCheekUv = llasUnityUv * vec2( 2.22000003 ) + vec2( 0.0, -1.22100008 );
    vec3 llasCheekUv = vec3( llasUnityCheekUv.x, 1.0 - llasUnityCheekUv.y, uCheekTexArrayIndex );
    vec3 llasCheek = texture( uCheekTex, llasCheekUv ).xyz;
    llasCheek = vec3( uCheekIntensity ) * ( llasCheek - vec3( 1.0 ) ) + vec3( 1.0 );
#endif
#ifdef LLAS_CHEEK_ON
    vec3 llasShadedBase = llasVertexShade.xyz * llasMain.xyz * llasCheek;
#else
    vec3 llasShadedBase = llasVertexShade.xyz * llasMain.xyz;
#endif
#ifdef LLAS_MATCAP_ON
    llasBase = uMatcapIntensity.www * ( llasBase - llasShadedBase ) + llasShadedBase;
#else
    llasBase = llasShadedBase;
#endif
llasBase = uAmbientColor.www * ( uAmbientColor.xyz - llasBase ) + llasBase;
llasBase = uTintColor.www * ( llasBase * uTintColor.xyz - llasBase ) + llasBase;

#ifdef LLAS_EMISSIVE_ON
    vec2 llasEmissiveUv = vec2( vUv.x, 1.0 - vUv.y ) + uEmissiveFlicker.xy * vec2( uBeat );
    llasEmissiveUv.y = 1.0 - llasEmissiveUv.y;
    vec4 llasEmissive = texture( uEmissiveScrollTex, llasEmissiveUv );
    llasEmissive = llasEmissive * texture( uEmissiveTex, vUv );
    llasEmissive = llasEmissive * uEmissiveIntensity;
    llasBase = llasEmissive.xyz * llasEmissive.www + llasBase;
#endif

float llasRimDot = clamp( dot( vLlasViewDirection, vLlasViewNormal ), 0.0, 1.0 );
float llasRim = exp2( log2( 1.0 - llasRimDot ) * uRimglightPower );
float llasRimMask = texture( uRimlightTex, vUv ).x;
llasRim = llasRim * ( llasRimMask * ( uRimlightColor.w * uRimglightIntensity ) );
vec4 llasResult = vec4( llasBase + vec3( llasRim ) * uRimlightColor.xyz, llasMain.w );
vec3 outgoingLight = max( llasResult.xyz, vec3( 0.0 ) );
diffuseColor.a = max( llasResult.w, 0.0 );
// @end

// @section OUTLINE_VERTEX_UNIFORMS
attribute vec4 _shader_color;
uniform vec4 uTintColor;
uniform vec4 uAmbientColor;
uniform vec4 uScreenParams;
uniform vec4 uRenderTextureResolution;
uniform sampler2D uMainTex;
varying vec4 vLlasOutlineColor;
// @end

// @section OUTLINE_VERTEX_INJECT
// Compiled Outline VS: view-space inverse-transpose normal, projected XY
// normal, perspective-only distance ramp and clip-space depth offset.
vec3 llasOutlineNormal = normalize( transpose( inverse( mat3( viewMatrix * modelMatrix ) ) ) * objectNormal );
vec2 llasOutlineXY = projectionMatrix[ 0 ].xy * llasOutlineNormal.x
    + projectionMatrix[ 1 ].xy * llasOutlineNormal.y;
llasOutlineXY *= _shader_color.x;
float llasViewDepth = max( -mvPosition.z, 0.0 );
float llasResolutionRatio = clamp( uRenderTextureResolution.y / uScreenParams.y, 0.0, 1.0 );
float llasDistance = llasResolutionRatio * llasViewDepth
    / ( abs( projectionMatrix[ 1 ].y ) * 0.267949194 );
float llasRamp = llasDistance < 0.899999976
    ? llasDistance * 1.11111116
    : llasDistance * 0.555555582 + 0.5;
llasRamp = projectionMatrix[ 3 ].w == 0.0 ? llasRamp : 0.0;
gl_Position.xy += llasOutlineXY * llasRamp * vec2( 0.00100000005 );
gl_Position.z += ( 1.0 - _shader_color.y ) * 0.000699999975;
vec4 llasOutlineTexel = textureLod( uMainTex, uv, 0.0 );
vec3 llasOutlineRgb = ( uAmbientColor.w * ( uAmbientColor.xyz - llasOutlineTexel.xyz * vec3( 0.349999994 ) )
    + llasOutlineTexel.xyz * vec3( 0.349999994 ) );
llasOutlineRgb = uTintColor.w * ( llasOutlineRgb * uTintColor.xyz - llasOutlineRgb ) + llasOutlineRgb;
vLlasOutlineColor = vec4( llasOutlineRgb, llasOutlineTexel.w );
// @end

// @section OUTLINE_FRAGMENT_UNIFORMS
varying vec4 vLlasOutlineColor;
// @end

// @section OUTLINE_FRAGMENT_BODY
vec3 outgoingLight = vLlasOutlineColor.xyz;
diffuseColor.a = vLlasOutlineColor.w;
// @end
