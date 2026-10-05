// Runtime inputs and inverted-hull realization for LLAS AS/Member.
// NaviModel.Initialize supplies _RenderTextureResolution from Screen.width/
// height. Capture equivalent drawing buffer dimensions when this runtime is
// created. The live-only _Beat input is unused by portrait characters and is
// intentionally not implemented here; its original GLSL branch remains in
// member.glsl for a future live-scene port.

const MAIN_KEYWORDS = new Map([
  ["_CHEEK_ON", "LLAS_CHEEK_ON"],
  ["_EMISSIVE_ON", "LLAS_EMISSIVE_ON"],
  ["_MATCAP_ON", "LLAS_MATCAP_ON"],
  // These serialized Material keywords do not select a distinct GLES3
  // program in Hidden/AS/Member/Main. Rimlight is present in all 8 programs;
  // MatcapTexAdd is a uniform within the _MATCAP_ON programs.
  ["_RIMLIGHT_ON", null],
  ["_MATCAPTEXADD_ON", null],
]);

export default class LlasMemberRuntime {
  constructor(THREE, renderer, material, mesh) {
    this.THREE = THREE;
    this.mesh = mesh;
    this.outlineMesh = null;
    this.hasOutline = false;
    this.mainMaterial = null;
    this.externalCheek = false;
    this.cheekSupport = { supported: false, reason: "main-pass-unavailable" };
    this.cheekUniforms = {
      uCheekIntensity: { value: 0 },
      uCheekTexArrayIndex: { value: 0 },
    };
    this.uniforms = {
      uScreenParams: { value: new THREE.Vector4() },
      uRenderTextureResolution: { value: new THREE.Vector4() },
    };
    this.drawingBufferSize = new THREE.Vector2();
    this.renderTextureResolution = null;
    if (renderer?.getDrawingBufferSize) {
      renderer.getDrawingBufferSize(this.drawingBufferSize);
      const { x: width, y: height } = this.drawingBufferSize;
      if (Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0) {
        this.renderTextureResolution = [width, height];
      }
    }
  }

  getUniforms(passId = "Main") {
    return this.externalCheek && passId === "Main"
      ? { ...this.uniforms, ...this.cheekUniforms } : this.uniforms;
  }

  // An external face rig may borrow the original cheek variant. A white
  // missing-sampler fallback is not a usable cheek texture. Returning support
  // information lets the caller report that limitation without breaking render.
  setExternalCheek(control) {
    if (control === null) {
      if (this.externalCheek) {
        const { present, value } = this.nativeCheekDefine;
        if (present) this.mainMaterial.defines.LLAS_CHEEK_ON = value;
        else delete this.mainMaterial.defines.LLAS_CHEEK_ON;
        this.externalCheek = false;
        this.mainMaterial.needsUpdate = true;
      }
      return this.cheekSupport;
    }
    if (!this.cheekSupport.supported) return this.cheekSupport;
    const { intensity, layer = 0 } = control;
    if (!Number.isFinite(intensity) || !Number.isFinite(layer)) {
      throw new Error("LLAS external cheek intensity and layer must be finite");
    }
    this.cheekUniforms.uCheekIntensity.value = Math.max(0, Math.min(1, intensity));
    this.cheekUniforms.uCheekTexArrayIndex.value = Math.max(0,
      Math.min(this.cheekSupport.layerCount - 1, Math.round(layer)));
    if (!this.externalCheek) {
      this.nativeCheekDefine = {
        present: Object.hasOwn(this.mainMaterial.defines, "LLAS_CHEEK_ON"),
        value: this.mainMaterial.defines.LLAS_CHEEK_ON,
      };
      this.externalCheek = true;
      this.mainMaterial.defines.LLAS_CHEEK_ON = 1;
      this.mainMaterial.needsUpdate = true;
    }
    return this.cheekSupport;
  }

  createPass(passId, material, mesh, materialPass, resolvedTextures = {}) {
    if (passId !== "Main" && passId !== "Outline") return null;
    const color = mesh.geometry?.getAttribute("_shader_color");
    if (!color || color.itemSize !== 4) {
      throw new Error(`LLAS ${mesh.name || "mesh"}: _SHADER_COLOR must be RGBA for AS/Member ${passId}`);
    }
    material.vertexColors = false;
    // The original programs do their own sampling and color math. Built-in
    // PBR sampling must not introduce alpha clipping or fog before/after it.
    material.map = null;
    material.alphaMap = null;
    material.alphaTest = 0;
    material.fog = false;
    // MeshStandardMaterial's OPAQUE chunk forces alpha to 1. The original
    // opaque Unity passes write the sampled MainTex alpha to the color target.
    const baseCompile = material.onBeforeCompile;
    material.onBeforeCompile = (shader, ...args) => {
      baseCompile(shader, ...args);
      const anchor = "#include <opaque_fragment>";
      if (!shader.fragmentShader.includes(anchor)) {
        throw new Error("LLAS AS/Member: opaque fragment anchor missing");
      }
      shader.fragmentShader = shader.fragmentShader.replace(
        anchor, "gl_FragColor = vec4( outgoingLight, diffuseColor.a );",
      );
    };
    if (passId === "Main") {
      const keywords = materialPass.extras?.keywords;
      if (!Array.isArray(keywords) || keywords.some((item) => typeof item !== "string")) {
        throw new Error("LLAS AS/Member Main requires source shader keywords array");
      }
      const unknown = keywords.filter((item) => !MAIN_KEYWORDS.has(item));
      if (unknown.length) throw new Error(`LLAS AS/Member unknown keywords: ${unknown.join(", ")}`);
      if (keywords.includes("_EMISSIVE_ON")) {
        throw new Error("LLAS AS/Member _EMISSIVE_ON requires live _Beat; portrait runtime does not implement it");
      }
      material.defines = { ...material.defines };
      for (const keyword of keywords) {
        const define = MAIN_KEYWORDS.get(keyword);
        if (define) material.defines[define] = 1;
      }
      this.mainMaterial = material;
      const texture = resolvedTextures.CheekTex;
      const layerCount = texture?.image?.depth;
      this.cheekSupport = Object.hasOwn(materialPass.textures ?? {}, "CheekTex")
        && texture?.isDataArrayTexture && Number.isInteger(layerCount) && layerCount > 0
        ? { supported: true, layerCount }
        : { supported: false, reason: "missing-cheek-array-texture" };
      // The native variant may already define CHEEK. Distinct keys are still
      // needed because its static uniforms and our live uniforms have different
      // ownership. Stable uniform objects also survive repeated takeovers.
      const baseCacheKey = material.customProgramCacheKey.bind(material);
      material.customProgramCacheKey = () => `${baseCacheKey()}${this.externalCheek ? ":external-cheek" : ""}`;
      return material;
    }
    this.hasOutline = true;
    const clone = mesh.clone();
    clone.name = `${mesh.name || "mesh"}_Outline`;
    clone.material = material;
    if (mesh.parent) mesh.parent.add(clone);
    this.outlineMesh = clone;
    return clone;
  }

  onBeforeRender(renderer) {
    if (this.outlineMesh) {
      // The host keeps ticking runtimes while custom shaders are disabled.
      // Its material swap is the active-pass state; visibility alone cannot
      // distinguish a disabled pass from a temporarily hidden board pattern.
      const material = this.mesh.material;
      const enabled = Array.isArray(material)
        ? material.some((item) => item?.userData?.__parameterizedShaderRuntimes?.includes(this))
        : material?.userData?.__parameterizedShaderRuntimes?.includes(this);
      this.outlineMesh.visible = this.mesh.visible && !!enabled;
    }
    if (this.hasOutline) {
      if (!this.renderTextureResolution) {
        throw new Error("LLAS _RenderTextureResolution requires a sized drawing buffer at initialization");
      }
      renderer.getDrawingBufferSize(this.drawingBufferSize);
      const width = this.drawingBufferSize.x;
      const height = this.drawingBufferSize.y;
      this.uniforms.uScreenParams.value.set(width, height, 1 + 1 / width, 1 + 1 / height);
      this.uniforms.uRenderTextureResolution.value.set(
        this.renderTextureResolution[0], this.renderTextureResolution[1], 0, 0,
      );
    }
    const source = this.mesh?.morphTargetInfluences;
    const target = this.outlineMesh?.morphTargetInfluences;
    if (source && target) {
      for (let index = 0; index < source.length; index++) target[index] = source[index];
    }
  }

  destroy() {
    this.setExternalCheek(null);
    if (this.outlineMesh) {
      this.outlineMesh.removeFromParent();
      this.outlineMesh.material.dispose();
    }
    this.outlineMesh = null;
    this.mesh = null;
    this.mainMaterial = null;
    this.cheekSupport = { supported: false, reason: "runtime-destroyed" };
  }
}
