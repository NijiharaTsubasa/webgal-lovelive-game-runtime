// AS/General/Transparent does not use Three.js lighting, fog, material maps,
// alpha testing, or tone mapping. Its one texture is bound by the package
// sampler descriptor and sampled in transparent.glsl.
export class LlasTransparentRuntime {
  constructor(_THREE, _renderer, material, mesh) {
    this.material = material;
    this.mesh = mesh;
  }

  init() {
    if (this.material.userData?.shaderParams?.VertexColor) {
      if (!this.mesh.geometry?.getAttribute("_shader_color")) {
        throw new Error("AS/General/Transparent _VERTEX_COLOR_ON requires a _SHADER_COLOR vertex attribute");
      }
    }
    this.material.vertexColors = false;
    this.material.map = null;
    this.material.alphaMap = null;
    this.material.alphaTest = 0;
    this.material.fog = false;
    this.material.toneMapped = false;
  }
}
