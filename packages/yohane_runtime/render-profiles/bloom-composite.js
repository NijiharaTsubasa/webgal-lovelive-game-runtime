// Original UberPost _BLOOM_LQ adds intensity * white tint * Bloom to HDR RGB.
// The original full-scene pass has no transparent character coverage. The alpha
// below is the host adaptation for a premultiplied transparent character canvas.
export const bloomCompositeProgram = {
  vertexShader: `varying vec2 bloomUv;
void main() {
  bloomUv = uv;
  gl_Position = vec4(position, 1.0);
}
`,
  fragmentShader: `uniform sampler2D uSource;
uniform sampler2D uBloom;
uniform float uIntensity;
uniform bool uPremultipliedAlpha;
varying vec2 bloomUv;
void main() {
  vec4 source = texture2D(uSource, bloomUv);
  vec3 bloom = texture2D(uBloom, bloomUv).rgb * uIntensity;
  gl_FragColor = vec4(source.rgb + bloom, source.a);
  #include <colorspace_fragment>
  // Coverage follows the emitted light, so its tail can survive canvas alpha.
  // Conventional alpha blending attenuates the background; this is not the
  // original whole-scene additive composition, whose background is unavailable.
  if (max(max(bloom.r, bloom.g), bloom.b) > 0.0) {
    gl_FragColor.a = max(source.a, clamp(max(max(gl_FragColor.r,
      gl_FragColor.g), gl_FragColor.b), 0.0, 1.0));
  }
  if (!uPremultipliedAlpha && gl_FragColor.a > 0.0) {
    gl_FragColor.rgb /= gl_FragColor.a;
  }
}
`,
};
