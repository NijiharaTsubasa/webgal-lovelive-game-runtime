// highlight-distortion — Eye lens refraction shader

// @section VERTEX_PRELUDE
#define USE_UV
varying vec3 vMelpotEyeWorldPos;
varying vec3 vMelpotEyeWorldNormal;
varying vec4 vMelpotEyeWorldTangent;
varying vec4 vMelpotEyeClipPos;
// @end

// @section VERTEX_SKINNORMAL
vMelpotEyeWorldNormal = normalize( mat3( modelMatrix ) * objectNormal );
#ifdef USE_TANGENT
	vMelpotEyeWorldTangent = vec4( normalize( mat3( modelMatrix ) * objectTangent ), tangent.w );
#else
	vMelpotEyeWorldTangent = vec4( normalize( cross( vec3( 0.0, 1.0, 0.0 ), vMelpotEyeWorldNormal ) + 1e-8 ), 1.0 );
#endif
// @end

// @section VERTEX_SKINNING
vMelpotEyeWorldPos = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;
// @end

// @section VERTEX_PROJECT
vMelpotEyeClipPos = gl_Position;
// @end

// @section FRAGMENT_PRELUDE
#define USE_UV
varying vec3 vMelpotEyeWorldPos;
varying vec3 vMelpotEyeWorldNormal;
varying vec4 vMelpotEyeWorldTangent;
varying vec4 vMelpotEyeClipPos;
uniform sampler2D uOpaqueTex;
uniform float uOpaqueTexSRGB;
uniform float uDistortionIntensity;
uniform float uTilinegValue;
uniform float uTime;
// @end

// @section FRAGMENT_FUNCTIONS
// Character/Highlight/Distortion GLES3 e001 evaluates four normalized
// gradient corners of a square and interpolates with a quintic fade. It is
// not simplex noise; the gradient construction below follows that program.
float melpotDistMod289( float x ) { return fract( x * ( 1.0 / 289.0 ) ) * 289.0; }
float melpotDistPermute( float x ) { return melpotDistMod289( ( x * 34.0 + 1.0 ) * x ); }
vec2 melpotDistGradient( vec2 grid ) {
	float x = melpotDistMod289( grid.x );
	float y = melpotDistMod289( grid.y );
	float h = melpotDistPermute( melpotDistPermute( x ) + y );
	float gx = fract( h * 0.024390243 ) * 2.0 - 1.0;
	vec2 gradient = vec2( gx - floor( gx + 0.5 ), abs( gx ) - 0.5 );
	return normalize( gradient );
}
float melpotDistNoise( vec2 p ) {
	vec2 grid = floor( p );
	vec2 f = fract( p );
	float p00 = dot( melpotDistGradient( grid ), f );
	float p01 = dot( melpotDistGradient( grid + vec2( 0.0, 1.0 ) ), f - vec2( 0.0, 1.0 ) );
	float p10 = dot( melpotDistGradient( grid + vec2( 1.0, 0.0 ) ), f - vec2( 1.0, 0.0 ) );
	float p11 = dot( melpotDistGradient( grid + vec2( 1.0, 1.0 ) ), f - vec2( 1.0, 1.0 ) );
	vec2 fade = f * f * f * ( f * ( f * 6.0 - 15.0 ) + 10.0 );
	return mix( mix( p00, p01, fade.y ), mix( p10, p11, fade.y ), fade.x );
}
// @end

// @section FRAGMENT_BODY
// animated simplex noise masked to the UV border
float melpotDistNoiseValue = melpotDistNoise( vec2( uTime, vUv.y * uTilinegValue ) * 3.0 ) + 0.5;
vec2 melpotDistEdgeL = clamp( ( vUv - 1.0 ) * -5.0, 0.0, 1.0 );
vec2 melpotDistEdgeU = clamp( vUv * 5.0, 0.0, 1.0 );
vec2 melpotDistA = melpotDistEdgeL * melpotDistEdgeL * ( 3.0 - 2.0 * melpotDistEdgeL );
vec2 melpotDistB = melpotDistEdgeU * melpotDistEdgeU * ( 3.0 - 2.0 * melpotDistEdgeU );
melpotDistNoiseValue *= melpotDistA.x * melpotDistA.y * melpotDistB.x * melpotDistB.y;

// derivative-based screen-space perturbation normal (Shader Graph Distortion)
float melpotDistNx = dFdx( melpotDistNoiseValue );
float melpotDistNy = dFdy( melpotDistNoiseValue );
vec3 melpotDistPX = dFdx( vMelpotEyeWorldPos );
vec3 melpotDistPY = dFdy( vMelpotEyeWorldPos );
vec3 melpotDistN = normalize( vMelpotEyeWorldNormal );
float melpotDistInv = 1.0 / max( dot( melpotDistN, melpotDistN ), 1e-15 );
vec3 melpotDistNZ = melpotDistN.zxy;
vec3 melpotDistC1 = melpotDistNZ.zxy * melpotDistPX.zxy - melpotDistPX.yzx * melpotDistNZ;
melpotDistC1 = melpotDistNy * melpotDistC1;
vec3 melpotDistC2 = melpotDistPY.yzx * melpotDistNZ - melpotDistNZ.zxy * melpotDistPY.zxy;
vec3 melpotDistC = melpotDistNx * melpotDistC2 + melpotDistNy * melpotDistC1;
float melpotDistDet = dot( melpotDistPX, melpotDistC2 );
float melpotDistDetSign = melpotDistDet < 0.0 ? -1.0 : 1.0;
melpotDistC *= melpotDistDetSign / max( abs( melpotDistDet ), 1.19209299e-15 );
vec3 melpotDistPert = normalize( melpotDistNZ.yzx - melpotDistC * 0.03 );

float melpotDistSignT = ( vMelpotEyeWorldTangent.w > 0.0 ) ? 1.0 : -1.0;
vec3 melpotDistT = vMelpotEyeWorldTangent.xyz;
vec3 melpotDistBtan = ( melpotDistNZ * melpotDistT - melpotDistT.zxy * melpotDistN ) * melpotDistSignT * melpotDistInv;

vec3 melpotDistT1 = melpotDistBtan * melpotDistNZ - melpotDistNZ.zxy * melpotDistBtan.yzx;
float melpotDistVx = dot( melpotDistT1, melpotDistPert );
float melpotDistSgn = dot( melpotDistInv * melpotDistT, melpotDistT1 );
melpotDistSgn = melpotDistSgn < 0.0 ? -1.0 : 1.0;
vec3 melpotDistT2 = melpotDistNZ.zxy * melpotDistT.zxy - melpotDistNZ * melpotDistT.yzx;
float melpotDistVy = dot( melpotDistT2, melpotDistPert );
vec3 melpotDistT3 = melpotDistT.yzx * melpotDistBtan.yzx - melpotDistBtan * melpotDistT.zxy;
float melpotDistVz = dot( melpotDistT3, melpotDistPert );
vec3 melpotDistVN = normalize( vec3( melpotDistVx, melpotDistVy, melpotDistVz ) * melpotDistSgn );

// sample the opaque scene at the distorted screen UV
vec2 melpotDistUv = vMelpotEyeClipPos.xy / max( vMelpotEyeClipPos.w, 1e-8 ) * 0.5 + 0.5;
// FramebufferTexture uses the same Y-up coordinates as clip space NDC.
melpotDistUv += melpotDistVN.xy * uDistortionIntensity;
vec3 melpotOpaqueSample = texture2D( uOpaqueTex, melpotDistUv ).rgb;
vec3 melpotOpaqueLinear = mix( melpotOpaqueSample / 12.92,
  pow( ( melpotOpaqueSample + 0.055 ) / 1.055, vec3( 2.4 ) ),
  step( vec3( 0.04045 ), melpotOpaqueSample ) );
vec3 outgoingLight = mix( melpotOpaqueSample, melpotOpaqueLinear, uOpaqueTexSRGB );
// @end
