// MELPOT/Toon/UberToonShader_Eye Forward runtime for the current Three scene.
// This maps scene INPUTS to the shipped e001 GLSL arithmetic. It does not
// assert that the original game's unrecovered lighting/SH values were equal
// to the preview scene's values.
import { renderTargetSamples, sceneLightCandidates, unityRangeAttenuation, unitySpotCone } from "./shared-runtime.js";

const eyeClockEpoch = performance.now();

export default class MelpotToonEyeRuntime {
  constructor(THREE, renderer, material, mesh) {
    this.THREE = THREE;
    this.renderer = renderer;
    this.material = material;
    this.mesh = mesh;
    this.lightWorldPosition = new THREE.Vector3();
    this.targetWorldPosition = new THREE.Vector3();
    this.direction = new THREE.Vector3();
    this.ambientContribution = new THREE.Color();
    if (material) {
      material.defines = { ...material.defines, MELPOT_EYE_ADDITIONAL_LIGHTS: 1 };
      material.needsUpdate = true;
    }
    this.uniforms = {
      uUnityTimeParameters: { value: new THREE.Vector4(0, 0, 1, 0) },
      uUnityMainLightColor: { value: new THREE.Vector4(1, 1, 1, 1) },
      uUnitySHAmbient: { value: new THREE.Color(0, 0, 0) },
      // This Three scene does not set Unity's global mip bias, so its
      // supported input value is explicitly zero, not an original-game claim.
      uUnityGlobalMipBias: { value: 0 },
      // URP sets this for opaque draws with MSAA even when the material's
      // fixed AlphaToMask state is Off. Updated from the active target below.
      uUnityAlphaToMaskAvailable: { value: 0 },
      uUnityAdditionalLightsCount: { value: 0 },
      uUnityLightDataY: { value: 0 },
      uUnityLightIndices: { value: [new THREE.Vector4(0, 1, 2, 3),
        new THREE.Vector4(4, 5, 6, 7)] },
      uUnityAdditionalLightsPosition: { value: Array.from({ length: 16 }, () => new THREE.Vector4()) },
      uUnityAdditionalLightsColor: { value: Array.from({ length: 16 }, () => new THREE.Vector4()) },
      uUnityAdditionalLightsAttenuation: { value: Array.from({ length: 16 }, () => new THREE.Vector4()) },
      uUnityAdditionalLightsSpotDir: { value: Array.from({ length: 16 }, () => new THREE.Vector4()) },
    };
  }

  getUniforms() {
    return this.uniforms;
  }

  createPass(passId, material) {
    if (passId !== "Forward") return null;
    // The source program owns its alpha clip; glTF MASK must not pre-clip it.
    material.alphaTest = 0;
    return null;
  }

  onBeforeRender(renderer, scene) {
    if (!scene) throw new Error("melpot-toon-eye requires a scene for Unity lighting globals");
    const activeRenderer = renderer || this.renderer;
    const gl = activeRenderer?.getContext?.();
    if (!gl) throw new Error("melpot-toon-eye requires WebGL sample count for _AlphaToMaskAvailable");
    const samples = renderTargetSamples(activeRenderer);
    // Explicit Unity render queues share Three's transparent sorting list.
    // NoBlending still denotes an opaque Unity draw in that list.
    const opaqueDraw = this.material?.transparent !== true ||
      this.material?.blending === this.THREE.NoBlending;
    this.uniforms.uUnityAlphaToMaskAvailable.value = samples > 1 && opaqueDraw ? 1 : 0;
    let directional = null;
    const additional = [];
    const ambientColor = this.uniforms.uUnitySHAmbient.value.setRGB(0, 0, 0);
    sceneLightCandidates(scene, activeRenderer, true).forEach((object) => {
      if (!object.isLight || (this.mesh?.layers && !this.mesh.layers.test(object.layers))) return;
      if (object.isDirectionalLight && directional === null) directional = object;
      else if (object.isDirectionalLight || object.isPointLight || object.isSpotLight) additional.push(object);
      else if (object.isAmbientLight) {
        ambientColor.add(this.ambientContribution.copy(object.color).multiplyScalar(object.intensity));
      } else throw new Error(`melpot-toon-eye unsupported scene light: ${object.type}`);
    });
    additional.length = Math.min(additional.length, 8);
    this.uniforms.uUnityAdditionalLightsCount.value = additional.length;
    this.uniforms.uUnityLightDataY.value = additional.length;
    for (const [index, light] of additional.entries()) {
      const position = this.uniforms.uUnityAdditionalLightsPosition.value[index];
      const color = this.uniforms.uUnityAdditionalLightsColor.value[index];
      const attenuation = this.uniforms.uUnityAdditionalLightsAttenuation.value[index];
      const spotDirection = this.uniforms.uUnityAdditionalLightsSpotDir.value[index];
      if (light.isDirectionalLight) {
        light.getWorldPosition(this.lightWorldPosition);
        light.target.getWorldPosition(this.targetWorldPosition);
        this.direction.subVectors(this.lightWorldPosition, this.targetWorldPosition).normalize();
        position.set(this.direction.x, this.direction.y, this.direction.z, 0);
        attenuation.set(0, 1, 0, 1);
        spotDirection.set(0, 0, 1, 0);
      } else {
        light.getWorldPosition(this.lightWorldPosition);
        position.set(this.lightWorldPosition.x, this.lightWorldPosition.y, this.lightWorldPosition.z, 1);
        attenuation.set(unityRangeAttenuation(light.distance), 1, 0, 1);
        spotDirection.set(0, 0, 1, 0);
        if (light.isSpotLight) {
          light.target.getWorldPosition(this.targetWorldPosition);
          this.direction.subVectors(this.lightWorldPosition, this.targetWorldPosition).normalize();
          spotDirection.set(this.direction.x, this.direction.y, this.direction.z, 0);
          [attenuation.z, attenuation.w] = unitySpotCone(light.angle, light.penumbra);
        }
      }
      color.set(light.color.r * light.intensity, light.color.g * light.intensity,
        light.color.b * light.intensity, 1);
    }

    const key = directional;
    const keyColor = this.uniforms.uUnityMainLightColor.value;
    keyColor.set(
      key ? key.color.r * key.intensity : 0,
      key ? key.color.g * key.intensity : 0,
      key ? key.color.b * key.intensity : 0,
      1,
    );

    // Unity URP's _TimeParameters = (t, sin(t), cos(t), unused).
    const t = (performance.now() - eyeClockEpoch) * 0.001;
    this.uniforms.uUnityTimeParameters.value.set(t, Math.sin(t), Math.cos(t), 0);
  }

  destroy() {
    this.renderer = null;
    this.material = null;
    this.mesh = null;
  }
}
