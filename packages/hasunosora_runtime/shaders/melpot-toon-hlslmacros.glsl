// Source-grounded arithmetic recovered from the shipped GLES3 programs in
// __ubertoonfacialexpressionshader.shader.assetbundle.
// e007 = Forward, e001 = Outline. The package implements these registered
// passes with current-scene inputs. Original-game light probes and shadow
// atlas values are not present in the character ABs.

// @section HLSL_MACROS_SOURCE_FUNCTIONS

// e007 lines 468-510, e001 lines 449-452: the three UV transforms are separate.
vec2 hlslMacrosMainUv( vec2 uv, vec4 mainTexST ) {
	return uv * mainTexST.xy + mainTexST.zw;
}
vec2 hlslMacrosDetailUv( vec2 uv, vec4 detailMaskST ) {
	return uv * detailMaskST.xy + detailMaskST.zw;
}
vec2 hlslMacrosGlossUv( vec2 uv, vec4 glossMapST ) {
	return uv * glossMapST.xy + glossMapST.zw;
}

// e007 lines 594-605 and 788-793; e001 lines 655-664. Main-light colour is
// normalized by its largest RGB component before modulating the combined
// specular/rim/matcap/anisotropic highlight, not the diffuse ramp.
vec3 hlslMacrosShadeEmission(
	vec3 combinedHighlight,
	vec3 mainLightColor,
	float isShadeEmissionLightColorContribution
) {
	if ( isShadeEmissionLightColorContribution != 0.0 ) {
		float denominator = max( max( mainLightColor.r, mainLightColor.g ), mainLightColor.b ) + 1.00000001e-7;
		return combinedHighlight * ( mainLightColor / denominator );
	}
	return combinedHighlight;
}

// e007 lines 583-605, e001 lines 686-710. This takes the actual accumulated
// URP additional-light result as an argument, rather than inventing it.
float hlslMacrosLinearToGamma( float linearValue ) {
	if ( linearValue <= 0.00313080009 ) return linearValue * 12.9232101;
	return exp2( log2( abs( linearValue ) ) * 0.416666657 ) * 1.05499995 - 0.0549999997;
}

vec3 hlslMacrosFinalColor(
	vec3 shadowedDiffuse,
	vec3 combinedHighlight,
	vec3 mainLightColor,
	vec3 additionalLightsColor,
	vec3 keyLightColor,
	vec3 ambientColor,
	vec3 sphericalHarmonicsArAgAbW,
	float overrideMainLightColor,
	float mainLightIntensity,
	float ambientMode,
	float addIntensity
) {
	float mainLightMax = max( max( mainLightColor.r, mainLightColor.g ), mainLightColor.b ) + 1.00000001e-7;
	vec3 main = overrideMainLightColor != 0.0
		? keyLightColor * mainLightIntensity
		: mainLightColor / mainLightMax;
	vec3 sh = vec3(
		hlslMacrosLinearToGamma( sphericalHarmonicsArAgAbW.r ),
		hlslMacrosLinearToGamma( sphericalHarmonicsArAgAbW.g ),
		hlslMacrosLinearToGamma( sphericalHarmonicsArAgAbW.b )
	);
	vec3 light = max( main + additionalLightsColor, max( max( sh, vec3( 0.0 ) ), vec3( 0.100000001 ) ) );
	vec3 base = ambientMode != 0.0
		? shadowedDiffuse * light + ambientColor
		: shadowedDiffuse * light * ambientColor;
	return base + combinedHighlight * addIntensity;
}

// GLES3 Forward e007 lines 609-679: selected additional lights add RGB before
// the ambient floor. The shadow-atlas variant is archived, not published.
vec3 hlslMacrosAdditionalLights( vec3 worldPosition ) {
	vec3 sum = vec3( 0.0 );
	for ( int i = 0; i < 8; ++i ) {
		if ( i >= uAdditionalLightCount ) break;
		vec3 lightVector = uAdditionalLightPosition[ i ].xyz
			- worldPosition * uAdditionalLightPosition[ i ].w;
		float distanceSquared = max( dot( lightVector, lightVector ), 6.10351562e-05 );
		vec3 lightDirection = lightVector * inversesqrt( distanceSquared );
		float rangeTerm = distanceSquared * uAdditionalLightAttenuation[ i ].x;
		float rangeAttenuation = max( 1.0 - rangeTerm * rangeTerm, 0.0 );
		rangeAttenuation = rangeAttenuation * rangeAttenuation / distanceSquared;
		float spotAttenuation = clamp(
			dot( uAdditionalLightSpotDir[ i ].xyz, lightDirection )
				* uAdditionalLightAttenuation[ i ].z + uAdditionalLightAttenuation[ i ].w,
			0.0, 1.0
		);
		spotAttenuation *= spotAttenuation;
		sum += uAdditionalLightColor[ i ].rgb *
			( rangeAttenuation * spotAttenuation );
	}
	return sum;
}

// e001 lines 441-444: this is not a ControlMap2 threshold. The ControlMap2
// red channel affects outline extrusion in the vertex program instead.
void hlslMacrosOutlineClip( float outlineClipThreshold ) {
	if ( 1.0 - outlineClipThreshold < 0.0 ) discard;
}

// e001 lines 714-716: the outline colour blends after complete toon shading.
vec3 hlslMacrosOutlineBlend(
	vec3 outlinedSurfaceColor,
	vec3 outlineColor,
	float outlineBlendFinalColor
) {
	return outlineColor + ( outlineColor * outlinedSurfaceColor - outlineColor ) * outlineBlendFinalColor;
}

// Control-map toon ramp with the archived scene-shadow modulation removed.
vec3 hlslMacrosShadeRamp(
	vec3 mainColor,
	vec3 firstShadowColor,
	vec3 secondShadowColor,
	vec3 shadowBorderColor,
	float rampInput,
	float firstShadowStep,
	float firstShadowFather,
	float secondShadowStep,
	float secondShadowFather,
	float shadowBorderRange,
	out float firstStepFinal,
	out float secondStep
) {
	float low1 = firstShadowStep - firstShadowFather;
	float high1 = firstShadowStep + firstShadowFather;
	float t1 = clamp( ( rampInput - low1 ) / ( high1 - low1 ), 0.0, 1.0 );
	float step1 = t1 * t1 * ( 3.0 - 2.0 * t1 );
	float center2 = ( secondShadowStep + 1.0 ) * ( firstShadowStep + 1.0 ) * 0.5 - 1.0;
	float low2 = center2 - secondShadowFather;
	float high2 = center2 + secondShadowFather;
	float t2 = clamp( ( rampInput - low2 ) / ( high2 - low2 ), 0.0, 1.0 );
	secondStep = t2 * t2 * ( 3.0 - 2.0 * t2 );
	float lowBorder = low1 - shadowBorderRange;
	float tb = clamp( ( rampInput - lowBorder ) / ( high1 - lowBorder ), 0.0, 1.0 );
	float borderStep = tb * tb * ( 3.0 - 2.0 * tb );
	firstStepFinal = step1;
	float borderFinal = borderStep;
	float borderBlend = min( abs( firstStepFinal - borderFinal ), 1.0 );
	vec3 shadowed = firstShadowColor + ( secondShadowColor - firstShadowColor ) * ( 1.0 - secondStep );
	shadowed += borderBlend * shadowBorderColor * ( mainColor - shadowed );
	shadowed += firstStepFinal * ( mainColor - shadowed );
	return shadowed;
}

// e007 lines 491-518. The retained face variant does not sample NormalTex;
// its corrected world normal is the fixed (.5, .5, 1) combination of the
// source-generated tangent, bitangent and spherical-corrected normal. The
// DetailMask.r amount appears twice in the subsequent inverse-normal path.
vec3 hlslMacrosCorrectedNormal(
	vec3 worldTangent,
	vec3 worldBitangent,
	vec3 sphericalWorldNormal,
	float detailMaskRed,
	vec3 inverseNormal,
	vec3 worldToObjectColumn0,
	vec3 worldToObjectColumn1,
	vec3 worldToObjectColumn2,
	vec3 objectToWorldColumn0,
	vec3 objectToWorldColumn1,
	vec3 objectToWorldColumn2,
	out vec3 fixedTbnNormal
) {
	fixedTbnNormal = worldTangent * 0.5 + worldBitangent * 0.5 + sphericalWorldNormal;
	vec3 objectNormal = vec3(
		dot( fixedTbnNormal, worldToObjectColumn0 ),
		dot( fixedTbnNormal, worldToObjectColumn1 ),
		dot( fixedTbnNormal, worldToObjectColumn2 )
	);
	objectNormal *= detailMaskRed * inverseNormal;
	vec3 restoredWorldNormal = vec3(
		dot( objectNormal, objectToWorldColumn0 ),
		dot( objectNormal, objectToWorldColumn1 ),
		dot( objectNormal, objectToWorldColumn2 )
	);
	return fixedTbnNormal + detailMaskRed * ( restoredWorldNormal - fixedTbnNormal );
}

// e007 lines 684-700 / e001 lines 588-608. matcap UV is from the corrected
// normal transformed by Unity's view matrix, rather than mesh UV.
vec3 hlslMacrosMatcap(
	vec3 matcapTextureRgb,
	vec4 matcapColor,
	float matcapControlAlpha,
	float matcapBlendLevel,
	float affectedMatcapByShadowStep,
	float shadowStepMin
) {
	vec3 matcap = matcapTextureRgb * matcapColor.rgb;
	matcap *= matcapControlAlpha * matcapColor.a * matcapBlendLevel;
	return matcap + affectedMatcapByShadowStep * ( matcap * shadowStepMin - matcap );
}

// e007 lines 705-734 / e001 lines 633-656. The caller must provide the
// normalized tangent-space view vector produced by the compiled TBN path.
vec3 hlslMacrosRim(
	vec3 tangentSpaceView,
	vec3 rimColor,
	float rimControlBlue,
	float rimPower,
	float rimSmoothness,
	float affectedRimByShadowStep,
	float shadowStepMin
) {
	float rim = clamp( dot( tangentSpaceView, vec3( 0.5, 0.5, 1.0 ) ), 0.0, 1.0 );
	rim = pow( 1.0 - rim, rimPower );
	float low = 0.499000013 - 0.499000013 * rimSmoothness;
	float high = 0.500999987 + 0.499000013 * rimSmoothness;
	rim = clamp( ( rim - low ) / ( high - low ), 0.0, 1.0 );
	rim = rim * rim * ( 3.0 - 2.0 * rim );
	vec3 result = rim * rimColor * rimControlBlue;
	return affectedRimByShadowStep != 0.0 ? result * shadowStepMin : result;
}

// e007 lines 769-788 / e001 lines 609-633. glossRgb is sampled at the
// separately transformed GlossMap UV, not at MainTex_ST UV.
vec3 hlslMacrosSpecular(
	vec3 halfVector,
	vec3 correctedNormal,
	vec3 glossRgb,
	vec3 specularColor,
	float specularControlGreen,
	float specularPower,
	vec2 specularXScaleYOffset,
	float specularSmoothness,
	float affectedSpecularByShadowStep,
	float shadowStepMin
) {
	float hdot = dot( halfVector, correctedNormal ) * 0.5 + 0.5;
	float specular = pow( abs( hdot ), exp2( 11.0 - 10.0 * specularPower ) );
	specular = clamp( specular * specularXScaleYOffset.x + specularXScaleYOffset.y, 0.0, 1.0 );
	float low = 0.499000013 - 0.499000013 * specularSmoothness;
	float high = 0.500999987 + 0.499000013 * specularSmoothness;
	specular = clamp( ( specular - low ) / ( high - low ), 0.0, 1.0 );
	specular = specular * specular * ( 3.0 - 2.0 * specular );
	vec3 result = specular * specularColor * specularControlGreen * glossRgb;
	return affectedSpecularByShadowStep != 0.0 ? result * shadowStepMin : result;
}

// e007 lines 740-766. These are the retained compiled operations; no
// fitted highlight curve or externally inferred anisotropy is used.
vec3 hlslMacrosAnisotropic(
	vec3 halfVector,
	vec3 geometricNormal,
	vec3 tangent,
	vec3 bitangent,
	float detailMaskGreen,
	float jitterIntensity,
	vec2 anisotropicIntensity,
	float lightDotCorrectedNormal,
	float geometricNormalDotView,
	float anisotropicSmoothness,
	vec3 anisotropicColor,
	float specularControlGreen,
	float affectedAnisotropicByShadowStep,
	float shadowStepMin
) {
	vec3 jitteredBitangent = normalize( bitangent + geometricNormal * ( detailMaskGreen * jitterIntensity ) );
	vec2 axis = vec2( dot( halfVector, tangent ), dot( halfVector, jitteredBitangent ) ) / anisotropicIntensity;
	float exponent = -2.0 * dot( axis, axis ) / ( dot( halfVector, geometricNormal ) + 1.0 );
	float anisotropic = sqrt( max( lightDotCorrectedNormal / geometricNormalDotView, 0.0 ) )
		* exp2( exponent * 1.44269502 );
	float low = 0.499000013 - 0.499000013 * anisotropicSmoothness;
	float high = 0.500999987 + 0.499000013 * anisotropicSmoothness;
	anisotropic = clamp( ( anisotropic - low ) / ( high - low ), 0.0, 1.0 );
	anisotropic = anisotropic * anisotropic * ( 3.0 - 2.0 * anisotropic );
	vec3 result = anisotropic * anisotropicColor * specularControlGreen;
	return result + affectedAnisotropicByShadowStep * ( result * shadowStepMin - result );
}

// e007 lines 788-795 / e001 lines 650-662: max, not additive blending.
vec3 hlslMacrosCombinedHighlight(
	vec3 matcap,
	vec3 rim,
	vec3 specular,
	vec3 anisotropic
) {
	return max( max( matcap, rim ), max( specular, anisotropic ) );
}

// e007 lines 797-825, e001 lines 441-468. Unity's
// _AlphaToMaskAvailable is a runtime-global value, not a material property.
// This function intentionally keeps derivative-based clipping and coverage.
float hlslMacrosClipAlpha(
	float controlMap1Blue,
	float controlMap1Alpha,
	float transparency,
	float alphaClipThreshold,
	float alphaToMaskAvailable
) {
	float alpha = controlMap1Blue * controlMap1Alpha * transparency;
	float clipValue = alpha - alphaClipThreshold;
	if ( alphaToMaskAvailable != 0.0 && alphaClipThreshold > 0.0 ) {
			float derivativeWidth = abs( dFdx( alpha ) ) + abs( dFdy( alpha ) );
			clipValue = clamp(
				( clipValue - derivativeWidth * 0.5 ) / max( derivativeWidth, 9.99999975e-05 ) + 1.0,
				0.0, 1.0
			) - 9.99999975e-05;
	}
	if ( clipValue < 0.0 ) discard;
	return alphaToMaskAvailable != 0.0 ? alpha : 1.0;
}

// @end

// @section HLSL_MACROS_VERTEX_PRELUDE
#define USE_UV
// Three only declares tangent for built-in normal/anisotropy maps. The
// retained HLSL compiled body consumes vertex tangents even though it never
// samples NormalTex, so declare the existing glTF TANGENT accessor directly.
#ifndef USE_TANGENT
#define USE_TANGENT
attribute vec4 tangent;
#endif
varying vec3 vHlslMacrosWorldPosition;
varying vec3 vHlslMacrosWorldNormal;
varying vec3 vHlslMacrosWorldTangent;
varying vec3 vHlslMacrosWorldBitangent;
varying vec3 vHlslMacrosSphericalNormal;
uniform vec4 uSphericalNormalCorrectOrigin;
uniform float uSphericalNormalCorrect;
vec3 hlslMacrosSafeNormalize3( vec3 value ) {
	return value * inversesqrt( max( dot( value, value ), 1.17549435e-38 ) );
}
vec2 hlslMacrosSafeNormalize2( vec2 value ) {
	return value * inversesqrt( max( dot( value, value ), 1.17549435e-38 ) );
}
// @end

// @section HLSL_MACROS_VERTEX_SKINNORMAL
mat3 hlslMacrosObjectToWorld3 = mat3( modelMatrix );
mat3 hlslMacrosNormalMatrix = transpose( inverse( hlslMacrosObjectToWorld3 ) );
vHlslMacrosWorldNormal = hlslMacrosSafeNormalize3( hlslMacrosNormalMatrix * objectNormal );
vHlslMacrosWorldTangent = hlslMacrosSafeNormalize3( hlslMacrosObjectToWorld3 * objectTangent );
float hlslMacrosTransformSign = determinant( hlslMacrosObjectToWorld3 ) >= 0.0 ? 1.0 : -1.0;
vHlslMacrosWorldBitangent = cross( vHlslMacrosWorldNormal, vHlslMacrosWorldTangent )
	* hlslMacrosTransformSign * tangent.w;
// @end

// @section HLSL_MACROS_VERTEX_SKINNING
// Unity's retained program receives already-skinned in_POSITION0. Three's
// equivalent is transformed after <skinning_vertex>, not bind-pose position.
vec2 hlslMacrosRadial = hlslMacrosSafeNormalize2( transformed.xz - uSphericalNormalCorrectOrigin.xz );
vec3 hlslMacrosSphericalWorld = hlslMacrosSafeNormalize3(
	hlslMacrosNormalMatrix * vec3( hlslMacrosRadial.x, 0.0, hlslMacrosRadial.y )
);
vHlslMacrosSphericalNormal = vHlslMacrosWorldNormal
	+ uSphericalNormalCorrect * ( hlslMacrosSphericalWorld - vHlslMacrosWorldNormal );
vHlslMacrosWorldPosition = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;
// @end

// @section HLSL_MACROS_OUTLINE_VERTEX_PRELUDE
uniform sampler2D uControlMap2;
uniform vec4 uMainTex_ST;
uniform float uOutlineWidth;
uniform float uOutlineDistance;
uniform float uOutlineMaskScale;
// @end

// @section HLSL_MACROS_OUTLINE_VERTEX_INJECT
// e001 lines 162-187. An explicit LOD-0 vertex texture fetch is required;
// the pass must compile as GLSL3/WebGL2, never replace this with a guessed
// fragment-stage or implicit-LOD sample.
float hlslMacrosOriginalClipW = ( projectionMatrix * modelViewMatrix * vec4( transformed, 1.0 ) ).w;
float hlslMacrosOutlineMask = textureLod(
	uControlMap2, uv * uMainTex_ST.xy + uMainTex_ST.zw, 0.0
).r * uOutlineMaskScale;
transformed += objectNormal * ( uOutlineWidth * hlslMacrosOutlineMask
	* min( hlslMacrosOriginalClipW, uOutlineDistance ) );
vHlslMacrosWorldPosition = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;
// @end

// @section HLSL_MACROS_FRAGMENT_PRELUDE
#define USE_UV
uniform mat4 modelMatrix;
varying vec3 vHlslMacrosWorldPosition;
varying vec3 vHlslMacrosWorldNormal;
varying vec3 vHlslMacrosWorldTangent;
varying vec3 vHlslMacrosWorldBitangent;
varying vec3 vHlslMacrosSphericalNormal;
uniform sampler2D uMainTex;
uniform sampler2D uControlMap1;
uniform sampler2D uControlMap2;
uniform sampler2D uDetailMask;
uniform sampler2D u1stShadowTex;
uniform sampler2D u2ndShadowTex;
uniform sampler2D uMatcapTex;
uniform sampler2D uGlossMap;
uniform vec4 uMainTex_ST;
uniform vec4 uDetailMask_ST;
uniform vec4 uGlossMap_ST;
uniform vec4 uMainColor;
uniform vec4 u1stShadowColor;
uniform vec4 u2ndShadowColor;
uniform vec4 uShadowBorderColor;
uniform vec4 uMatcapColor;
uniform vec4 uRimColor;
uniform vec4 uSpecularColor;
uniform vec4 uAnisotropicColor;
uniform vec4 uAmbientColor;
uniform vec4 uKeyLightColor;
uniform vec4 uMainLightOffset;
uniform vec4 uInverseNormal;
uniform vec4 uAnisotropicIntensity;
uniform vec4 uSpecularXScaleYOffset;
uniform float u1stShadowStep;
uniform float u1stShadowFather;
uniform float u2ndShadowStep;
uniform float u2ndShadowFather;
uniform float uShadowBorderRange;
uniform float uMatcapBlendLevel;
uniform float uAffectedMatcapByShadowStep;
uniform float uRimPower;
uniform float uRimSmoothness;
uniform float uAffectedRimByShadowStep;
uniform float uSpecularPower;
uniform float uSpecularSmoothness;
uniform float uAffectedSpecularByShadowStep;
uniform float uJitterIntensity;
uniform float uAnisotropicSmoothness;
uniform float uAffectedAnisotropicByShadowStep;
uniform float uOverrideMainLightColor;
uniform float uMainLightIntensity;
uniform float uAmbientMode;
uniform float uAddIntensity;
uniform float uTransparency;
uniform float uAlphaClipThreshold;
uniform float uIsShadeEmissionLightColorContribution;
uniform vec3 uMainLightDirection;
uniform vec3 uMainLightColor;
uniform int uAdditionalLightCount;
uniform vec4 uAdditionalLightPosition[16];
uniform vec4 uAdditionalLightColor[16];
uniform vec4 uAdditionalLightAttenuation[16];
uniform vec4 uAdditionalLightSpotDir[16];
uniform vec3 uUnitySHAmbientW;
uniform float uAlphaToMaskAvailable;
uniform float uGlobalMipBias;
uniform bool uOrthographicView;
// @end

// @section HLSL_MACROS_FORWARD_BODY
vec2 hlslMacrosMainUV = hlslMacrosMainUv( vUv, uMainTex_ST );
vec2 hlslMacrosDetailUV = hlslMacrosDetailUv( vUv, uDetailMask_ST );
vec2 hlslMacrosGlossUV = hlslMacrosGlossUv( vUv, uGlossMap_ST );
vec3 hlslMacrosMainColor = texture2D( uMainTex, hlslMacrosMainUV, uGlobalMipBias ).rgb * uMainColor.rgb;
vec4 hlslMacrosControl1 = texture2D( uControlMap1, hlslMacrosMainUV, uGlobalMipBias );
vec4 hlslMacrosControl2 = texture2D( uControlMap2, hlslMacrosMainUV, uGlobalMipBias );
vec2 hlslMacrosDetail = texture2D( uDetailMask, hlslMacrosDetailUV, uGlobalMipBias ).xy;
vec3 hlslMacrosGeometricNormal = normalize( vHlslMacrosWorldNormal );
mat4 hlslMacrosWorldToObject = inverse( modelMatrix );
vec3 hlslMacrosFixedNormal;
vec3 hlslMacrosDetailNormal = hlslMacrosCorrectedNormal(
	vHlslMacrosWorldTangent, vHlslMacrosWorldBitangent, vHlslMacrosSphericalNormal,
	hlslMacrosDetail.x, uInverseNormal.xyz,
	hlslMacrosWorldToObject[0].xyz, hlslMacrosWorldToObject[1].xyz, hlslMacrosWorldToObject[2].xyz,
	modelMatrix[0].xyz, modelMatrix[1].xyz, modelMatrix[2].xyz,
	hlslMacrosFixedNormal
);
vec3 hlslMacrosLightDirection = uMainLightDirection + uMainLightOffset.xyz;
float hlslMacrosNdotL = max(
	dot( hlslMacrosLightDirection, hlslMacrosDetailNormal ),
	dot( hlslMacrosLightDirection, hlslMacrosFixedNormal )
);
float hlslMacrosFirstStep;
float hlslMacrosSecondStep;
vec3 hlslMacrosRampColor = hlslMacrosShadeRamp(
	hlslMacrosMainColor,
	texture2D( u1stShadowTex, hlslMacrosMainUV, uGlobalMipBias ).rgb * u1stShadowColor.rgb,
	texture2D( u2ndShadowTex, hlslMacrosMainUV, uGlobalMipBias ).rgb * u2ndShadowColor.rgb,
	uShadowBorderColor.rgb,
	hlslMacrosNdotL * hlslMacrosControl1.r,
	u1stShadowStep, u1stShadowFather, u2ndShadowStep, u2ndShadowFather,
	uShadowBorderRange, hlslMacrosFirstStep, hlslMacrosSecondStep
);
float hlslMacrosShadowStepMin = min( hlslMacrosFirstStep, hlslMacrosSecondStep );
vec2 hlslMacrosMatcapUV = ( viewMatrix * vec4( hlslMacrosFixedNormal, 0.0 ) ).xy * 0.5 + 0.5;
vec3 hlslMacrosMatcapColor = hlslMacrosMatcap(
	texture2D( uMatcapTex, hlslMacrosMatcapUV, uGlobalMipBias ).rgb,
	uMatcapColor, hlslMacrosControl2.a, uMatcapBlendLevel,
	uAffectedMatcapByShadowStep, hlslMacrosShadowStepMin
);
vec3 hlslMacrosViewDelta = cameraPosition - vHlslMacrosWorldPosition;
vec3 hlslMacrosView = uOrthographicView ?
	vec3( viewMatrix[0][2], viewMatrix[1][2], viewMatrix[2][2] ) :
	normalize( hlslMacrosViewDelta );
vec3 hlslMacrosRimVector = normalize( vec3(
	dot( hlslMacrosViewDelta, vHlslMacrosWorldTangent ),
	dot( hlslMacrosViewDelta, vHlslMacrosWorldBitangent ),
	dot( hlslMacrosViewDelta, hlslMacrosGeometricNormal )
) );
vec3 hlslMacrosRimColor = hlslMacrosRim(
	hlslMacrosRimVector, uRimColor.rgb, hlslMacrosControl2.b,
	uRimPower, uRimSmoothness, uAffectedRimByShadowStep,
	hlslMacrosShadowStepMin
);
vec3 hlslMacrosHalf = normalize( hlslMacrosLightDirection + hlslMacrosView );
vec3 hlslMacrosSpecularColor = hlslMacrosSpecular(
	hlslMacrosHalf, hlslMacrosFixedNormal,
	texture2D( uGlossMap, hlslMacrosGlossUV, uGlobalMipBias ).rgb,
	uSpecularColor.rgb, hlslMacrosControl1.g,
	uSpecularPower, uSpecularXScaleYOffset.xy, uSpecularSmoothness,
	uAffectedSpecularByShadowStep, hlslMacrosShadowStepMin
);
vec3 hlslMacrosAnisotropicColor = hlslMacrosAnisotropic(
	hlslMacrosHalf, hlslMacrosGeometricNormal,
	vHlslMacrosWorldTangent, vHlslMacrosWorldBitangent,
	hlslMacrosDetail.y, uJitterIntensity, uAnisotropicIntensity.xy,
	hlslMacrosNdotL, dot( hlslMacrosGeometricNormal, hlslMacrosView ),
	uAnisotropicSmoothness, uAnisotropicColor.rgb, hlslMacrosControl1.g,
	uAffectedAnisotropicByShadowStep, hlslMacrosShadowStepMin
);
vec3 hlslMacrosHighlight = hlslMacrosShadeEmission(
	hlslMacrosCombinedHighlight(
		hlslMacrosMatcapColor, hlslMacrosRimColor,
		hlslMacrosSpecularColor, hlslMacrosAnisotropicColor
	),
	uMainLightColor, uIsShadeEmissionLightColorContribution
);
diffuseColor.a = hlslMacrosClipAlpha(
	hlslMacrosControl1.b, hlslMacrosControl1.a, uTransparency,
	uAlphaClipThreshold, uAlphaToMaskAvailable
);
vec3 outgoingLight = hlslMacrosFinalColor(
	hlslMacrosRampColor, hlslMacrosHighlight,
	uMainLightColor, hlslMacrosAdditionalLights( vHlslMacrosWorldPosition ), uKeyLightColor.rgb,
	uAmbientColor.rgb, uUnitySHAmbientW,
	uOverrideMainLightColor, uMainLightIntensity, uAmbientMode, uAddIntensity
);
// @end
// @section HLSL_MACROS_OUTLINE_FRAGMENT_PRELUDE
uniform vec4 uOutlineColor;
uniform float uOutlineBlendFinalColor;
uniform float uOutlineClipThreshold;
// @end

// @section HLSL_MACROS_OUTLINE_BODY
hlslMacrosOutlineClip( uOutlineClipThreshold );
vec2 hlslMacrosMainUV = hlslMacrosMainUv( vUv, uMainTex_ST );
vec2 hlslMacrosDetailUV = hlslMacrosDetailUv( vUv, uDetailMask_ST );
vec2 hlslMacrosGlossUV = hlslMacrosGlossUv( vUv, uGlossMap_ST );
vec3 hlslMacrosMainColor = texture2D( uMainTex, hlslMacrosMainUV, uGlobalMipBias ).rgb * uMainColor.rgb;
vec4 hlslMacrosControl1 = texture2D( uControlMap1, hlslMacrosMainUV, uGlobalMipBias );
vec4 hlslMacrosControl2 = texture2D( uControlMap2, hlslMacrosMainUV, uGlobalMipBias );
vec2 hlslMacrosDetail = texture2D( uDetailMask, hlslMacrosDetailUV, uGlobalMipBias ).xy;
vec3 hlslMacrosGeometricNormal = normalize( vHlslMacrosWorldNormal );
mat4 hlslMacrosWorldToObject = inverse( modelMatrix );
vec3 hlslMacrosFixedNormal;
vec3 hlslMacrosDetailNormal = hlslMacrosCorrectedNormal(
	vHlslMacrosWorldTangent, vHlslMacrosWorldBitangent, vHlslMacrosSphericalNormal,
	hlslMacrosDetail.x, uInverseNormal.xyz,
	hlslMacrosWorldToObject[0].xyz, hlslMacrosWorldToObject[1].xyz, hlslMacrosWorldToObject[2].xyz,
	modelMatrix[0].xyz, modelMatrix[1].xyz, modelMatrix[2].xyz,
	hlslMacrosFixedNormal
);
vec3 hlslMacrosLightDirection = uMainLightDirection + uMainLightOffset.xyz;
float hlslMacrosNdotL = max(
	dot( hlslMacrosLightDirection, hlslMacrosDetailNormal ),
	dot( hlslMacrosLightDirection, hlslMacrosFixedNormal )
);
float hlslMacrosFirstStep;
float hlslMacrosSecondStep;
vec3 hlslMacrosRampColor = hlslMacrosShadeRamp(
	hlslMacrosMainColor,
	texture2D( u1stShadowTex, hlslMacrosMainUV, uGlobalMipBias ).rgb * u1stShadowColor.rgb,
	texture2D( u2ndShadowTex, hlslMacrosMainUV, uGlobalMipBias ).rgb * u2ndShadowColor.rgb,
	uShadowBorderColor.rgb,
	hlslMacrosNdotL * hlslMacrosControl1.r,
	u1stShadowStep, u1stShadowFather, u2ndShadowStep, u2ndShadowFather,
	uShadowBorderRange, hlslMacrosFirstStep, hlslMacrosSecondStep
);
float hlslMacrosShadowStepMin = min( hlslMacrosFirstStep, hlslMacrosSecondStep );
vec2 hlslMacrosMatcapUV = ( viewMatrix * vec4( hlslMacrosFixedNormal, 0.0 ) ).xy * 0.5 + 0.5;
vec3 hlslMacrosMatcapColor = hlslMacrosMatcap(
	texture2D( uMatcapTex, hlslMacrosMatcapUV, uGlobalMipBias ).rgb,
	uMatcapColor, hlslMacrosControl2.a, uMatcapBlendLevel,
	uAffectedMatcapByShadowStep, hlslMacrosShadowStepMin
);
vec3 hlslMacrosViewDelta = cameraPosition - vHlslMacrosWorldPosition;
vec3 hlslMacrosView = uOrthographicView ?
	vec3( viewMatrix[0][2], viewMatrix[1][2], viewMatrix[2][2] ) :
	normalize( hlslMacrosViewDelta );
vec3 hlslMacrosRimVector = normalize( vec3(
	dot( hlslMacrosViewDelta, vHlslMacrosWorldTangent ),
	dot( hlslMacrosViewDelta, vHlslMacrosWorldBitangent ),
	dot( hlslMacrosViewDelta, hlslMacrosGeometricNormal )
) );
vec3 hlslMacrosRimColor = hlslMacrosRim(
	hlslMacrosRimVector, uRimColor.rgb, hlslMacrosControl2.b,
	uRimPower, uRimSmoothness, uAffectedRimByShadowStep,
	hlslMacrosShadowStepMin
);
vec3 hlslMacrosHalf = normalize( hlslMacrosLightDirection + hlslMacrosView );
vec3 hlslMacrosSpecularColor = hlslMacrosSpecular(
	hlslMacrosHalf, hlslMacrosFixedNormal,
	texture2D( uGlossMap, hlslMacrosGlossUV, uGlobalMipBias ).rgb,
	uSpecularColor.rgb, hlslMacrosControl1.g,
	uSpecularPower, uSpecularXScaleYOffset.xy, uSpecularSmoothness,
	uAffectedSpecularByShadowStep, hlslMacrosShadowStepMin
);
vec3 hlslMacrosAnisotropicColor = hlslMacrosAnisotropic(
	hlslMacrosHalf, hlslMacrosGeometricNormal,
	vHlslMacrosWorldTangent, vHlslMacrosWorldBitangent,
	hlslMacrosDetail.y, uJitterIntensity, uAnisotropicIntensity.xy,
	hlslMacrosNdotL, dot( hlslMacrosGeometricNormal, hlslMacrosView ),
	uAnisotropicSmoothness, uAnisotropicColor.rgb, hlslMacrosControl1.g,
	uAffectedAnisotropicByShadowStep, hlslMacrosShadowStepMin
);
vec3 hlslMacrosHighlight = hlslMacrosShadeEmission(
	hlslMacrosCombinedHighlight(
		hlslMacrosMatcapColor, hlslMacrosRimColor,
		hlslMacrosSpecularColor, hlslMacrosAnisotropicColor
	),
	uMainLightColor, uIsShadeEmissionLightColorContribution
);
diffuseColor.a = hlslMacrosClipAlpha(
	hlslMacrosControl1.b, hlslMacrosControl1.a, uTransparency,
	uAlphaClipThreshold, uAlphaToMaskAvailable
);
vec3 hlslMacrosOutlinedSurface = hlslMacrosFinalColor(
	hlslMacrosRampColor, hlslMacrosHighlight,
	uMainLightColor, vec3( 0.0 ), uKeyLightColor.rgb,
	uAmbientColor.rgb, uUnitySHAmbientW,
	uOverrideMainLightColor, uMainLightIntensity, uAmbientMode, uAddIntensity
);
vec3 outgoingLight = hlslMacrosOutlineBlend(
	hlslMacrosOutlinedSurface, uOutlineColor.rgb, uOutlineBlendFinalColor
);
// @end
