// character-eye — Eye base (iris + sclera) shader

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
uniform sampler2D uMainTex;
uniform vec4 uMainColor;
uniform vec4 uMainTex_ST;
uniform float uAlphaClipThreshold;
uniform float uOverrideMainLightColor;
uniform vec4 uKeyLightColor;
uniform float uMainLightIntensity;
uniform float uAmbientMode;
uniform vec4 uAmbientColor;
uniform vec3 uSceneLightColor;
uniform vec3 uSceneAmbientColor;
uniform float uGlobalMipBias;
uniform int uAdditionalLightCount;
uniform vec4 uAdditionalLightPosition[16];
uniform vec4 uAdditionalLightColor[16];
uniform vec4 uAdditionalLightAttenuation[16];
uniform vec4 uAdditionalLightSpotDir[16];
// @end

// @section FRAGMENT_FUNCTIONS
float melpotEyeLinearToGamma( float value ) {
	if ( value <= 0.00313080009 ) return value * 12.9232101;
	return exp2( log2( abs( value ) ) * 0.416666657 ) * 1.05499995 - 0.0549999997;
}

// GLES3 Forward e001: Unity's selected per-object additional lights add
// attenuated colour before the ambient floor, without another eye BRDF.
vec3 melpotEyeAdditionalLights() {
	vec3 sum = vec3( 0.0 );
	for ( int i = 0; i < 8; ++i ) {
		if ( i >= uAdditionalLightCount ) break;
		vec3 lightVector = uAdditionalLightPosition[ i ].xyz -
			vMelpotEyeWorldPos * uAdditionalLightPosition[ i ].w;
		float distanceSquared = max( dot( lightVector, lightVector ), 6.10351562e-05 );
		vec3 lightDirection = lightVector * inversesqrt( distanceSquared );
		float rangeTerm = distanceSquared * uAdditionalLightAttenuation[ i ].x;
		float rangeAttenuation = max( 1.0 - rangeTerm * rangeTerm, 0.0 );
		rangeAttenuation = rangeAttenuation * rangeAttenuation / distanceSquared;
		float spotAttenuation = clamp(
			dot( uAdditionalLightSpotDir[ i ].xyz, lightDirection ) *
			uAdditionalLightAttenuation[ i ].z + uAdditionalLightAttenuation[ i ].w,
			0.0, 1.0
		);
		spotAttenuation *= spotAttenuation;
		sum += uAdditionalLightColor[ i ].rgb * rangeAttenuation * spotAttenuation;
	}
	return sum;
}
// @end

// @section FRAGMENT_BODY
vec4 melpotEyeBase = texture2D( uMainTex, vUv * uMainTex_ST.xy + uMainTex_ST.zw,
	uGlobalMipBias ) * uMainColor;
vec3 melpotEyeLight = uOverrideMainLightColor != 0.0
	? uKeyLightColor.rgb * uMainLightIntensity
	: uSceneLightColor.rgb;
melpotEyeLight += melpotEyeAdditionalLights();
vec3 melpotEyeAmbient = vec3(
	melpotEyeLinearToGamma( uSceneAmbientColor.r ),
	melpotEyeLinearToGamma( uSceneAmbientColor.g ),
	melpotEyeLinearToGamma( uSceneAmbientColor.b )
);
melpotEyeLight = max( melpotEyeLight, max( melpotEyeAmbient, vec3( 0.100000001 ) ) );
vec3 melpotEyeLit = melpotEyeBase.rgb * melpotEyeLight;
vec3 outgoingLight = uAmbientMode != 0.0
	? melpotEyeLit + uAmbientColor.rgb
	: melpotEyeLit * uAmbientColor.rgb;
if ( melpotEyeBase.a < uAlphaClipThreshold ) discard;
diffuseColor.a = melpotEyeBase.a;
// @end
