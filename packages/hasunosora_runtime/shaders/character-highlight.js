export { LightSyncRuntime, TimeRuntime } from "./shared-runtime.js";
import { findSceneLights, sceneLightCandidates, renderTargetSamples, unityRangeAttenuation, unitySpotCone } from "./shared-runtime.js";
export class HighlightAlphaClipRuntime {
  createPass(passId, material) {
    if (passId !== "Forward") return null;
    // The source clips generated highlight luminance, not glTF base alpha.
    material.alphaTest = 0;
    return null;
  }
}

// Map current Three scene lights to CharacterHighlight's compiled URP
// per-object light slots. The light and attenuation equations stay in GLSL.
export class HighlightAdditionalLightsRuntime {
  constructor(THREE, renderer, material, mesh) {
    this.material = material;
    this.mesh = mesh;
    this.lightPosition = new THREE.Vector3();
    this.targetPosition = new THREE.Vector3();
    this.direction = new THREE.Vector3();
    this.uniforms = {
      uAdditionalLightCount: { value: 0 },
      uAdditionalLightPosition: { value: Array.from({ length: 8 }, () => new THREE.Vector4()) },
      uAdditionalLightColor: { value: Array.from({ length: 8 }, () => new THREE.Vector4()) },
      uAdditionalLightAttenuation: { value: Array.from({ length: 8 }, () => new THREE.Vector4()) },
      uAdditionalLightSpotDir: { value: Array.from({ length: 8 }, () => new THREE.Vector4()) },
    };
  }

  getUniforms() {
    return this.uniforms;
  }

  onBeforeRender(renderer, scene) {
    if (!scene) throw new Error("CharacterHighlight requires a scene for Unity lighting inputs");
    const { directional: main, ambient } = findSceneLights(scene, renderer);
    const additional = [];
    sceneLightCandidates(scene, renderer, true).forEach((light) => {
      if (!light.isLight || light === main || light === ambient ||
        (this.mesh?.layers && !this.mesh.layers.test(light.layers))) return;
      if (!light.isDirectionalLight && !light.isPointLight && !light.isSpotLight) {
        throw new Error(`CharacterHighlight unsupported scene light: ${light.type}`);
      }
      additional.push(light);
    });
    additional.length = Math.min(additional.length, 8);
    this.uniforms.uAdditionalLightCount.value = additional.length;
    for (const [index, light] of additional.entries()) {
      const position = this.uniforms.uAdditionalLightPosition.value[index];
      const color = this.uniforms.uAdditionalLightColor.value[index];
      const attenuation = this.uniforms.uAdditionalLightAttenuation.value[index];
      const spotDirection = this.uniforms.uAdditionalLightSpotDir.value[index];
      if (light.isDirectionalLight) {
        light.getWorldPosition(this.lightPosition);
        light.target.getWorldPosition(this.targetPosition);
        this.direction.subVectors(this.lightPosition, this.targetPosition).normalize();
        position.set(this.direction.x, this.direction.y, this.direction.z, 0);
        attenuation.set(0, 1, 0, 1);
        spotDirection.set(0, 0, 1, 0);
      } else {
        light.getWorldPosition(this.lightPosition);
        position.set(this.lightPosition.x, this.lightPosition.y, this.lightPosition.z, 1);
        attenuation.set(unityRangeAttenuation(light.distance), 1, 0, 1);
        spotDirection.set(0, 0, 1, 0);
        if (light.isSpotLight) {
          light.target.getWorldPosition(this.targetPosition);
          this.direction.subVectors(this.lightPosition, this.targetPosition).normalize();
          spotDirection.set(this.direction.x, this.direction.y, this.direction.z, 0);
          [attenuation.z, attenuation.w] = unitySpotCone(light.angle, light.penumbra);
        }
      }
      color.set(light.color.r * light.intensity, light.color.g * light.intensity,
        light.color.b * light.intensity, 1);
    }
  }

}

// Unity's _AlphaToMaskAvailable is a render-target input, not a material
// property. The compiled CharacterHighlight clip and output alpha use it.
export class AlphaToMaskRuntime {
  constructor(THREE, renderer) {
    this.renderer = renderer;
    this.uniforms = { uUnityAlphaToMaskAvailable: { value: 0 } };
  }

  getUniforms() {
    return this.uniforms;
  }

  onBeforeRender(renderer) {
    const active = renderer || this.renderer;
    const samples = renderTargetSamples(active);
    this.uniforms.uUnityAlphaToMaskAvailable.value = samples > 1 ? 1 : 0;
  }
}
