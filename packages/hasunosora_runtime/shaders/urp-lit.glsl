// Universal Render Pipeline/Lit, Forward, no material keywords.
// Source: __scsch101tsk_face_normal.fbx.assetbundle, GLES20 e001 Forward.
// Reflection and lighting use the current Three scene input mapping.

// @section VERTEX_PRELUDE
varying vec3 vUrpWorldPosition;
// @end

// @section VERTEX_INJECT
vUrpWorldPosition = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;
// @end

// @section FRAGMENT_PRELUDE
varying vec3 vUrpWorldPosition;
uniform float uMetallic;
uniform float uSmoothness;
uniform vec3 uUrpMainLightDirectionView;
uniform vec3 uUrpMainLightColor;
uniform vec3 uUrpBakedGI;
uniform bool uUrpOrthographic;
uniform int uUrpAdditionalLightCount;
uniform vec4 uUrpAdditionalLightPositionView[4];
uniform vec4 uUrpAdditionalLightColor[4];
uniform vec4 uUrpAdditionalLightAttenuation[4];
uniform vec4 uUrpAdditionalLightSpotDirView[4];
#ifdef URP_REFLECTION_PROBE
uniform samplerCube uUrpReflectionProbe;
uniform vec4 uUrpReflectionHDR;
#endif
// @end

// @section FRAGMENT_FUNCTIONS
// URP Common.hlsl SafeNormalize, BRDF.hlsl DirectBRDFSpecular.
vec3 urpSafeNormalize( vec3 value ) {
    return value * inversesqrt( max( 1.17549435e-38, dot( value, value ) ) );
}

vec3 urpViewToWorld( vec3 directionVS ) {
    return vec3(
        dot( vec3( viewMatrix[0][0], viewMatrix[0][1], viewMatrix[0][2] ), directionVS ),
        dot( vec3( viewMatrix[1][0], viewMatrix[1][1], viewMatrix[1][2] ), directionVS ),
        dot( vec3( viewMatrix[2][0], viewMatrix[2][1], viewMatrix[2][2] ), directionVS )
    );
}

float urpDirectBRDFSpecular(
    float roughness2, float roughness2MinusOne, float normalizationTerm,
    vec3 normalVS, vec3 lightDirectionVS, vec3 viewDirectionVS
) {
    vec3 halfDir = urpSafeNormalize( lightDirectionVS + viewDirectionVS );
    float noH = clamp( dot( normalVS, halfDir ), 0.0, 1.0 );
    float loH = clamp( dot( lightDirectionVS, halfDir ), 0.0, 1.0 );
    float d = noH * noH * roughness2MinusOne + 1.00001;
    float specularTerm = roughness2 /
        ( ( d * d ) * max( 0.1, loH * loH ) * normalizationTerm );
    // The original GLES3+ compiled program uses mediump half and clamps to
    // 1000 after subtracting HALF_MIN (BRDF.hlsl REAL_IS_HALF branch).
    return clamp( specularTerm - 6.103515625e-5, 0.0, 1000.0 );
}

// Retained GLES20 Forward e001: each per-object additional light evaluates
// the same direct BRDF as the main light after range and spot attenuation.
vec3 urpAdditionalDirectLight(
    vec3 diffuse, vec3 specular, float roughness2, float roughness2MinusOne,
    float normalizationTerm, vec3 normalVS, vec3 viewDirectionVS
) {
    vec3 sum = vec3( 0.0 );
    vec3 positionVS = -vViewPosition;
    for ( int i = 0; i < 4; ++i ) {
        if ( i >= uUrpAdditionalLightCount ) break;
        vec3 lightVector = uUrpAdditionalLightPositionView[ i ].xyz -
            positionVS * uUrpAdditionalLightPositionView[ i ].w;
        float distanceSquared = max( dot( lightVector, lightVector ), 6.10351562e-05 );
        vec3 lightDirection = lightVector * inversesqrt( distanceSquared );
        float rangeTerm = distanceSquared * uUrpAdditionalLightAttenuation[ i ].x;
        float range = max( 1.0 - rangeTerm * rangeTerm, 0.0 );
        range = range * range / distanceSquared;
        float spot = clamp( dot( uUrpAdditionalLightSpotDirView[ i ].xyz, lightDirection ) *
            uUrpAdditionalLightAttenuation[ i ].z + uUrpAdditionalLightAttenuation[ i ].w,
            0.0, 1.0 );
        float attenuation = range * spot * spot;
        float ndotl = clamp( dot( normalVS, lightDirection ), 0.0, 1.0 );
        float directSpecular = urpDirectBRDFSpecular(
            roughness2, roughness2MinusOne, normalizationTerm,
            normalVS, lightDirection, viewDirectionVS
        );
        sum += ( diffuse + specular * directSpecular ) *
            uUrpAdditionalLightColor[ i ].rgb * ( attenuation * ndotl );
    }
    return sum;
}
// @end

// @section FRAGMENT_BODY
// URP LitInput.hlsl samples a white _BaseMap when none is assigned. Three's
// diffuseColor already carries the glTF baseColorFactor in linear space.
vec3 urpAlbedo = diffuseColor.rgb;
float urpOneMinusReflectivity = 0.96 - uMetallic * 0.96;
vec3 urpDiffuse = urpAlbedo * urpOneMinusReflectivity;
vec3 urpSpecular = mix( vec3( 0.04 ), urpAlbedo, uMetallic );
float urpPerceptualRoughness = 1.0 - uSmoothness;
float urpRoughness = max( urpPerceptualRoughness * urpPerceptualRoughness, 0.0078125 );
float urpRoughness2 = max( urpRoughness * urpRoughness, 6.103515625e-5 );
float urpNormalizationTerm = urpRoughness * 4.0 + 2.0;
float urpRoughness2MinusOne = urpRoughness2 - 1.0;

// The stock Three.js normal/view vectors are in view space; URP's BRDF is
// invariant to an orthonormal change from world to view space.
vec3 urpNormal = normalize( normal );
// e001 chooses the camera-to-vertex vector for perspective, but the view
// matrix's z column for orthographic projection (view-space +Z).
vec3 urpView = uUrpOrthographic ? vec3( 0.0, 0.0, 1.0 ) :
    urpSafeNormalize( vViewPosition );
vec3 urpLight = normalize( uUrpMainLightDirectionView );
float urpNdotL = max( dot( urpNormal, urpLight ), 0.0 );
float urpSpecularTerm = urpDirectBRDFSpecular(
    urpRoughness2, urpRoughness2MinusOne, urpNormalizationTerm,
    urpNormal, urpLight, urpView
);
vec3 urpMainLight = ( urpDiffuse + urpSpecular * urpSpecularTerm ) *
    uUrpMainLightColor * urpNdotL;
vec3 urpAdditionalLight = urpAdditionalDirectLight(
    urpDiffuse, urpSpecular, urpRoughness2, urpRoughness2MinusOne,
    urpNormalizationTerm, urpNormal, urpView
);

vec3 urpIndirectSpecular = vec3( 0.0 );
#ifdef URP_REFLECTION_PROBE
// e001 lines 305-334: reflect(-view, normal), perceptual roughness mip,
// Unity HDR decode and EnvironmentBRDF's grazing interpolation.
vec3 urpReflectionVS = reflect( -urpView, urpNormal );
vec3 urpReflectionWS = urpViewToWorld( urpReflectionVS );
float urpNoV = clamp( dot( urpNormal, urpView ), 0.0, 1.0 );
float urpFresnel = 1.0 - urpNoV;
urpFresnel *= urpFresnel;
urpFresnel *= urpFresnel;
float urpReflectionMip = urpPerceptualRoughness *
    ( urpPerceptualRoughness * -0.699999988 + 1.70000005 ) * 6.0;
vec4 urpProbeSample = textureCube( uUrpReflectionProbe, urpReflectionWS, urpReflectionMip );
float urpProbeDecode = pow( max( urpProbeSample.a * uUrpReflectionHDR.w +
    ( 1.0 - urpProbeSample.a ), 0.0 ), uUrpReflectionHDR.y ) * uUrpReflectionHDR.x;
float urpGrazingTerm = clamp( 1.0 + uSmoothness - urpOneMinusReflectivity, 0.0, 1.0 );
vec3 urpEnvironmentBrdf = ( urpSpecular +
    ( vec3( urpGrazingTerm ) - urpSpecular ) * urpFresnel ) / ( urpRoughness2 + 1.0 );
urpIndirectSpecular = urpProbeSample.rgb * urpProbeDecode * urpEnvironmentBrdf;
#endif

// The source GlobalIllumination term combines SH diffuse with the decoded
// reflection probe before direct main and additional lights.
vec3 outgoingLight = min(
    uUrpBakedGI * urpDiffuse + urpIndirectSpecular + urpMainLight + urpAdditionalLight,
    vec3( 65504.0 )
);
// @end
