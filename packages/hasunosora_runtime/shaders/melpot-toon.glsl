// melpot-toon — MELPOT Toon UberToon shader (main + outline pass)

// @section VERTEX_PRELUDE
#define USE_UV
varying vec3 vMelpotWorldNormal;
varying vec3 vMelpotWorldPos;
varying vec3 vMelpotWorldTangent;
varying vec3 vMelpotWorldBitangent;
varying vec3 vMelpotSphericalNormal;
uniform vec3 uSphericalNormalCorrectOrigin;
uniform float uSphericalNormalCorrect;
uniform vec4 uMainTex_ST;
// @end

// @section VERTEX_SKINNORMAL
mat3 melpotModel3 = mat3( modelMatrix );
mat3 melpotWorldToObjectNormal = transpose( inverse( melpotModel3 ) );
vMelpotWorldNormal = normalize( melpotWorldToObjectNormal * objectNormal );
#ifdef USE_TANGENT
	vMelpotWorldTangent = normalize( melpotModel3 * objectTangent );
	float melpotTangentSign = ( determinant( melpotModel3 ) >= 0.0 ? 1.0 : -1.0 ) * tangent.w;
	vMelpotWorldBitangent = normalize( cross( vMelpotWorldNormal, vMelpotWorldTangent ) ) * melpotTangentSign;
#else
	vMelpotWorldTangent = normalize( abs( vMelpotWorldNormal.y ) < 0.999
		? cross( vec3( 0.0, 1.0, 0.0 ), vMelpotWorldNormal )
		: vec3( 1.0, 0.0, 0.0 ) );
	vMelpotWorldBitangent = normalize( cross( vMelpotWorldNormal, vMelpotWorldTangent ) );
#endif
{
	// spherical-corrected normal (MELPOT_VertexNormal): tilt the normal toward
	// the radial from _SphericalNormalCorrectOrigin (object-space), in world.
	vec2 melpotRadialDelta = position.xz - uSphericalNormalCorrectOrigin.xz;
	float melpotRadialLengthSquared = max( dot( melpotRadialDelta, melpotRadialDelta ), 1.17549435e-38 );
	vec2 melpotRadial = melpotRadialDelta * inversesqrt( melpotRadialLengthSquared );
	vec3 melpotRwDelta = melpotWorldToObjectNormal * vec3( melpotRadial.x, 0.0, melpotRadial.y );
	float melpotRwLengthSquared = max( dot( melpotRwDelta, melpotRwDelta ), 1.17549435e-38 );
	vec3 melpotRw = melpotRwDelta * inversesqrt( melpotRwLengthSquared );
	vMelpotSphericalNormal = vMelpotWorldNormal + uSphericalNormalCorrect * ( melpotRw - vMelpotWorldNormal );
}
// @end

// @section VERTEX_SKINNING
vMelpotWorldPos = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;
// @end

// @section FRAGMENT_PRELUDE
#define USE_UV
uniform mat4 modelMatrix;
varying vec3 vMelpotWorldNormal;
varying vec3 vMelpotWorldPos;
varying vec3 vMelpotWorldTangent;
varying vec3 vMelpotWorldBitangent;
varying vec3 vMelpotSphericalNormal;
uniform sampler2D u1stShadowTex;
uniform sampler2D u2ndShadowTex;
uniform sampler2D uControlMap1;
uniform sampler2D uControlMap2;
uniform sampler2D uNormalTex;
uniform sampler2D uDetailMask;
uniform sampler2D uMatcapTex;
uniform sampler2D uGlossMap;
uniform sampler2D uUVTexMask;
uniform vec4 uMainTex_ST;
uniform vec4 uDetailMask_ST;
uniform vec4 uGlossMap_ST;
uniform vec4 uUVTexMask_ST;
uniform vec3 uKeyLightDir;
uniform vec3 uSceneLightColor;
uniform vec3 uKeyLightColor;
uniform vec3 uSceneAmbientColor;
uniform vec4 uAmbientColor;
uniform vec3 uMainLightOffset;
uniform float uOverrideMainLightColor;
uniform float uMainLightIntensity;
uniform float uAmbientMode;
uniform vec4 u1stShadowColor;
uniform vec4 u2ndShadowColor;
uniform vec4 uShadowBorderColor;
uniform vec4 uRimColor;
uniform vec4 uSpecularColor;
uniform vec4 uMatcapColor;
uniform vec4 uUVColor;
uniform vec4 uAnisotropicColor;
uniform vec2 uSpecularXScaleYOffset;
uniform vec2 uAnisotropicIntensity;
uniform float u1stShadowStep;
uniform float u1stShadowFather;
uniform float u2ndShadowStep;
uniform float u2ndShadowFather;
uniform float uShadowBorderRange;
uniform float uRimPower;
uniform float uRimSmoothness;
uniform float uSpecularPower;
uniform float uSpecularSmoothness;
uniform float uMatcapBlendLevel;
uniform float uAddIntensity;
uniform float uUVintensity;
uniform float uAffectedRimByShadowStep;
uniform float uAffectedMatcapByShadowStep;
uniform float uAffectedSpecularByShadowStep;
uniform float uAffectedAnisotropicByShadowStep;
uniform float uNormalScale;
uniform vec3 uInverseNormal;
uniform float uSphericalNormalCorrect;
uniform float uJitterIntensity;
uniform float uAnisotropicSmoothness;
uniform float uTransparency;
uniform float uAlphaClipThreshold;
uniform float uAlphaToMaskAvailable;
uniform int uAdditionalLightCount;
uniform vec4 uAdditionalLightPosition[16];
uniform vec4 uAdditionalLightColor[16];
uniform vec4 uAdditionalLightAttenuation[16];
uniform vec4 uAdditionalLightSpotDir[16];
// @end

// @section FRAGMENT_FUNCTIONS
float melpotLinearToGamma( float value ) {
	if ( value <= 0.00313080009 ) return value * 12.9232101;
	return exp2( log2( abs( value ) ) * 0.416666657 ) * 1.05499995 - 0.0549999997;
}

// GLES3 ForwardLit e007 and Outline e001 use the same alpha-to-coverage
// derivative clip. The non-MSAA branch clips alpha directly against threshold.
float melpotAlphaClipValue( float alpha ) {
	float threshold = uAlphaClipThreshold;
	if ( uAlphaToMaskAvailable == 0.0 ) return alpha - threshold;
	if ( threshold <= 0.0 ) return alpha - threshold;
	float width = abs( dFdx( alpha ) ) + abs( dFdy( alpha ) );
	return clamp( ( alpha - threshold - width * 0.5 ) / max( width, 9.99999975e-05 ) + 1.0, 0.0, 1.0 ) - 9.99999975e-05;
}

// GLES3 ForwardLit e007: URP's per-object additional lights contribute to
// the light colour, not another toon-ramp evaluation. The optional atlas
// path retains e007's point-face selection, depth compare and distance fade.
vec3 melpotAdditionalLightsColor() {
	vec3 total = vec3( 0.0 );
	for ( int i = 0; i < 16; ++i ) {
		if ( i >= uAdditionalLightCount ) break;
		vec3 melpotLightVector = uAdditionalLightPosition[ i ].xyz - vMelpotWorldPos * uAdditionalLightPosition[ i ].w;
		float distanceSqr = max( dot( melpotLightVector, melpotLightVector ), 6.10351562e-05 );
		vec3 direction = melpotLightVector * inversesqrt( distanceSqr );
		float melpotRangeTerm = distanceSqr * uAdditionalLightAttenuation[ i ].x;
		float smoothRange = max( 1.0 - melpotRangeTerm * melpotRangeTerm, 0.0 );
		smoothRange *= smoothRange;
		float spot = clamp( dot( uAdditionalLightSpotDir[ i ].xyz, direction ) *
			uAdditionalLightAttenuation[ i ].z + uAdditionalLightAttenuation[ i ].w, 0.0, 1.0 );
		float melpotAttenuation = smoothRange * ( 1.0 / distanceSqr ) * spot * spot;
		total += uAdditionalLightColor[ i ].rgb * melpotAttenuation;
	}
	return total;
}

// Full MELPOT surface for a single light: returns the ramp baseColor
// (shadowed), plus the highlight sum and the alpha via out params.
// Inserted before void main(), so every uniform/varying above is in scope.
vec3 melpotShade( vec3 L, vec3 mainC, inout vec3 highlightsOut, inout float alphaOut ) {
	vec2 melpotMainUv = vUv * uMainTex_ST.xy + uMainTex_ST.zw;
	vec2 melpotDetailUv = vUv * uDetailMask_ST.xy + uDetailMask_ST.zw;
	vec2 melpotGlossUv = vUv * uGlossMap_ST.xy + uGlossMap_ST.zw;
	vec3 melpotNbase = normalize( vMelpotWorldNormal );
	vec3 melpotV = normalize( cameraPosition - vMelpotWorldPos );
	vec3 melpotSpherical = vMelpotSphericalNormal;

	// normal mapping: TBN with spherical-corrected 3rd basis (Ntbn)
	vec4 melpotNtex = texture2D( uNormalTex, melpotMainUv );
	vec2 melpotNmXY = ( melpotNtex.xy * 2.0 - 1.0 ) * uNormalScale;
	float melpotNs = clamp( uNormalScale, 0.0, 1.0 );
	float melpotNmZ = melpotNs * ( melpotNtex.z * 2.0 - 2.0 ) + 1.0;
	vec3 melpotNm = vec3( melpotNmXY, melpotNmZ );
	vec3 melpotNtbn = vMelpotWorldTangent * melpotNm.x + vMelpotWorldBitangent * melpotNm.y + melpotSpherical * melpotNm.z;

	// detail-mask normal correction
	vec2 melpotDetail = texture2D( uDetailMask, melpotDetailUv ).xy;
	mat3 melpotModel3 = mat3( modelMatrix );
	vec3 melpotObjectN = transpose( inverse( melpotModel3 ) ) * melpotNtbn;
	vec3 melpotNDet = transpose( melpotModel3 ) * ( melpotObjectN * ( melpotDetail.x * uInverseNormal ) );
	vec3 melpotNdetail = mix( melpotNtbn, melpotNDet, melpotDetail.x );
	float melpotDetailY = melpotDetail.y;

	vec4 melpotC1 = texture2D( uControlMap1, melpotMainUv );
	vec4 melpotC2 = texture2D( uControlMap2, melpotMainUv );

	float melpotNdl = max( dot( L, melpotNdetail ), dot( L, melpotNtbn ) );
	float melpotInput = melpotNdl * melpotC1.r;

	float melpotLow1 = u1stShadowStep - u1stShadowFather;
	float melpotHigh1 = u1stShadowStep + u1stShadowFather;
	float melpotInverse1 = 1.0 / ( melpotHigh1 - melpotLow1 );
	float melpotT1 = clamp( melpotInverse1 * ( melpotInput - melpotLow1 ), 0.0, 1.0 );
	float melpotStep1 = melpotT1 * melpotT1 * ( 3.0 - 2.0 * melpotT1 );

	float melpotCenter = ( u2ndShadowStep + 1.0 ) * ( u1stShadowStep + 1.0 ) * 0.5 - 1.0;
	float melpotLow2 = melpotCenter - u2ndShadowFather;
	float melpotHigh2 = melpotCenter + u2ndShadowFather;
	float melpotInverse2 = 1.0 / ( melpotHigh2 - melpotLow2 );
	float melpotT2 = clamp( melpotInverse2 * ( melpotInput - melpotLow2 ), 0.0, 1.0 );
	float melpotStep2 = melpotT2 * melpotT2 * ( 3.0 - 2.0 * melpotT2 );

	float melpotLowB = melpotLow1 - uShadowBorderRange;
	float melpotInverseB = 1.0 / ( melpotHigh1 - melpotLowB );
	float melpotTB = clamp( melpotInverseB * ( melpotInput - melpotLowB ), 0.0, 1.0 );
	float melpotBorder = melpotTB * melpotTB * ( 3.0 - 2.0 * melpotTB );

	float melpotStep1Final = melpotStep1;
	float melpotBorderFinal = melpotBorder;

	float melpotBorderBlend = clamp( abs( melpotStep1Final - melpotBorderFinal ), 0.0, 1.0 );

	vec3 melpotRamp1 = texture2D( u1stShadowTex, melpotMainUv ).rgb * u1stShadowColor.rgb;
	vec3 melpotRamp2 = texture2D( u2ndShadowTex, melpotMainUv ).rgb * u2ndShadowColor.rgb;
	vec3 melpotShadowed = mix( melpotRamp1, melpotRamp2, 1.0 - melpotStep2 );
	melpotShadowed += melpotBorderBlend * uShadowBorderColor.rgb * ( mainC - melpotShadowed );
	melpotShadowed = mix( melpotShadowed, mainC, melpotStep1Final );

	float melpotShadowStepMin = min( melpotStep1Final, melpotStep2 );

	// matcap (view-space Ntbn -> planar UV)
	vec3 melpotNv = mat3( viewMatrix ) * melpotNtbn;
	vec2 melpotMcUV = melpotNv.xy * 0.5 + 0.5;
	vec3 melpotMatcap = texture2D( uMatcapTex, melpotMcUV ).rgb * uMatcapColor.rgb;
	melpotMatcap *= melpotC2.a * uMatcapColor.a;
	melpotMatcap *= uMatcapBlendLevel;
	melpotMatcap *= mix( 1.0, melpotShadowStepMin, uAffectedMatcapByShadowStep );

	vec3 melpotViewDelta = cameraPosition - vMelpotWorldPos;
	vec3 melpotViewTS = normalize( vec3(
		dot( melpotViewDelta, vMelpotWorldTangent ),
		dot( melpotViewDelta, vMelpotWorldBitangent ),
		dot( melpotViewDelta, melpotNbase )
	) );
	float melpotNdv = clamp( dot( melpotViewTS, melpotNm ), 0.0, 1.0 );
	float melpotRim = pow( 1.0 - melpotNdv, uRimPower );
	melpotRim = smoothstep( 0.499 - 0.499 * uRimSmoothness, 0.501 + 0.499 * uRimSmoothness, melpotRim );
	vec3 melpotRimCol = melpotRim * uRimColor.rgb * melpotC2.b;
	melpotRimCol *= uAffectedRimByShadowStep != 0.0 ? melpotShadowStepMin : 1.0;

	// soft specular (half-vector, GlossMap)
	vec3 melpotH = normalize( L + melpotV );
	float melpotHdot = abs( dot( melpotH, melpotNtbn ) * 0.5 + 0.5 );
	float melpotSpec = pow( melpotHdot, exp2( 11.0 - 10.0 * uSpecularPower ) );
	melpotSpec = melpotSpec * uSpecularXScaleYOffset.x + uSpecularXScaleYOffset.y;
	melpotSpec = smoothstep( 0.499 - 0.499 * uSpecularSmoothness, 0.501 + 0.499 * uSpecularSmoothness, melpotSpec );
	vec3 melpotGloss = texture2D( uGlossMap, melpotGlossUv ).rgb;
	vec3 melpotSpecCol = melpotSpec * uSpecularColor.rgb * melpotC1.g * melpotGloss;
	melpotSpecCol *= uAffectedSpecularByShadowStep != 0.0 ? melpotShadowStepMin : 1.0;

	// Kajiya-Kay anisotropic highlight
	float melpotNdotH = dot( melpotH, melpotNbase );
	float melpotHdotT = dot( melpotH, vMelpotWorldTangent );
	float melpotJitter = melpotDetailY * uJitterIntensity;
	vec3 melpotBdir = normalize( vMelpotWorldBitangent + melpotNbase * melpotJitter );
	float melpotHdotB = dot( melpotH, melpotBdir );
	vec2 melpotAi = vec2( melpotHdotT, melpotHdotB ) / uAnisotropicIntensity.xy;
	float melpotAnisoExp = -2.0 * ( melpotAi.x * melpotAi.x + melpotAi.y * melpotAi.y ) / ( melpotNdotH + 1.0 );
	float melpotAniso = sqrt( max( melpotNdl / dot( melpotNbase, melpotV ), 0.0 ) ) * exp( melpotAnisoExp );
	melpotAniso = smoothstep( 0.499 - 0.499 * uAnisotropicSmoothness, 0.501 + 0.499 * uAnisotropicSmoothness, melpotAniso );
	vec3 melpotAnisoCol = melpotAniso * uAnisotropicColor.rgb * melpotC1.g;
	melpotAnisoCol *= mix( 1.0, melpotShadowStepMin, uAffectedAnisotropicByShadowStep );

	// highlights combine with max() like the original
	highlightsOut = max( max( melpotMatcap, melpotRimCol ), max( melpotAnisoCol, melpotSpecCol ) );

	// alpha = c1.a * _Transparency, dithered by c1.b
	float melpotDt = clamp( ( melpotC1.b - 9.99999975e-06 ) * 1.00392532, 0.0, 1.0 );
	float melpotDither = melpotDt * melpotDt * ( 3.0 - 2.0 * melpotDt );
	alphaOut = melpotC1.a * uTransparency * melpotDither;

	return melpotShadowed;
}
// @end

// @section FRAGMENT_BODY
vec3 melpotMainC = diffuseColor.rgb;
float melpotAlpha = 1.0;
vec3 melpotHigh = vec3( 0.0 );

vec3 L = uKeyLightDir;
vec3 melpotShadowed = melpotShade( L + uMainLightOffset, melpotMainC, melpotHigh, melpotAlpha );
if ( melpotAlphaClipValue( melpotAlpha ) < 0.0 ) discard;

vec3 melpotLightColor = uOverrideMainLightColor != 0.0
	? uKeyLightColor * uMainLightIntensity
	: uSceneLightColor;
melpotLightColor += melpotAdditionalLightsColor();
vec3 melpotAmbient = vec3(
	melpotLinearToGamma( uSceneAmbientColor.r ),
	melpotLinearToGamma( uSceneAmbientColor.g ),
	melpotLinearToGamma( uSceneAmbientColor.b )
);
melpotLightColor = max( melpotLightColor, max( melpotAmbient, vec3( 0.1 ) ) );

vec3 melpotCol;
if ( uAmbientMode != 0.0 ) {
	melpotCol = melpotShadowed * melpotLightColor + uAmbientColor.rgb;
} else {
	melpotCol = melpotShadowed * melpotLightColor * uAmbientColor.rgb;
}

melpotCol += melpotHigh * uAddIntensity;

vec2 melpotUvMaskUv = vUv * uUVTexMask_ST.xy + uUVTexMask_ST.zw;
melpotCol += texture2D( uUVTexMask, melpotUvMaskUv ).rgb * uUVColor.rgb * uUVintensity;
diffuseColor.a = uAlphaToMaskAvailable != 0.0 ? melpotAlpha : 1.0;

vec3 outgoingLight = melpotCol;
// @end

// @section OUTLINE_VERTEX_UNIFORMS
varying vec2 vMelpotOutlineUv;
uniform sampler2D uControlMap2;
uniform float uOutlineWidth;
uniform float uOutlineDistance;
uniform float uOutlineMaskScale;
// @end

// @section OUTLINE_VERTEX_INJECT
vMelpotOutlineUv = uv;
float melpotOutlineDepth = - ( modelViewMatrix * vec4( transformed, 1.0 ) ).z;
vec2 melpotOutlineUv = uv * uMainTex_ST.xy + uMainTex_ST.zw;
float melpotOutlineMask = texture2D( uControlMap2, melpotOutlineUv ).r * uOutlineMaskScale;
float melpotOutlineW = uOutlineWidth * min( melpotOutlineDepth, uOutlineDistance ) * melpotOutlineMask;
transformed += objectNormal * melpotOutlineW;
// @end

// @section OUTLINE_FRAGMENT_UNIFORMS
varying vec2 vMelpotOutlineUv;
uniform float uOutlineClipThreshold;
uniform vec4 uOutlineColor;
uniform float uOutlineBlendFinalColor;
// @end

// @section OUTLINE_FRAGMENT_DISCARD
if ( texture2D( uControlMap2, vMelpotOutlineUv * uMainTex_ST.xy + uMainTex_ST.zw ).r < uOutlineClipThreshold ) discard;
// @end

// @section OUTLINE_FRAGMENT_BODY
float melpotOutAlpha = 1.0;
vec3 melpotOutHigh = vec3( 0.0 );
vec3 melpotOutShadowed = melpotShade( uKeyLightDir + uMainLightOffset, diffuseColor.rgb, melpotOutHigh, melpotOutAlpha );
if ( melpotAlphaClipValue( melpotOutAlpha ) < 0.0 ) discard;

vec3 melpotOutLightColor = uOverrideMainLightColor != 0.0
	? uKeyLightColor * uMainLightIntensity
	: uSceneLightColor;
vec3 melpotOutAmbient = vec3(
	melpotLinearToGamma( uSceneAmbientColor.r ),
	melpotLinearToGamma( uSceneAmbientColor.g ),
	melpotLinearToGamma( uSceneAmbientColor.b )
);
melpotOutLightColor = max( melpotOutLightColor, max( melpotOutAmbient, vec3( 0.1 ) ) );

vec3 melpotOutCol;
if ( uAmbientMode != 0.0 ) {
	melpotOutCol = melpotOutShadowed * melpotOutLightColor + uAmbientColor.rgb;
} else {
	melpotOutCol = melpotOutShadowed * melpotOutLightColor * uAmbientColor.rgb;
}

melpotOutCol += melpotOutHigh * uAddIntensity;
vec2 melpotUvMaskUv = vUv * uUVTexMask_ST.xy + uUVTexMask_ST.zw;
melpotOutCol += texture2D( uUVTexMask, melpotUvMaskUv ).rgb * uUVColor.rgb * uUVintensity;
diffuseColor.a = uAlphaToMaskAvailable != 0.0 ? melpotOutAlpha : 1.0;

vec3 outgoingLight = mix( uOutlineColor.rgb, uOutlineColor.rgb * melpotOutCol, uOutlineBlendFinalColor );
// @end
