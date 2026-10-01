// Current Three-scene inputs for CharacterEye's compiled GLES3 Forward e001.
// The shader owns its lighting formula; this adapter only fills the original
// main-light, SH-constant and per-object additional-light inputs.
import { sceneLightCandidates, unityRangeAttenuation, unitySpotCone } from "./shared-runtime.js";

export default class CharacterEyeRuntime {
  constructor(THREE, renderer, material, mesh) {
    this.mesh = mesh;
    this.lightPosition = new THREE.Vector3();
    this.targetPosition = new THREE.Vector3();
    this.direction = new THREE.Vector3();
    this.ambientContribution = new THREE.Color();
    this.uniforms = {
      uSceneLightColor: { value: new THREE.Color(0, 0, 0) },
      uSceneAmbientColor: { value: new THREE.Color(0, 0, 0) },
      uGlobalMipBias: { value: 0 },
      uAdditionalLightCount: { value: 0 },
      uAdditionalLightPosition: { value: Array.from({ length: 16 }, () => new THREE.Vector4()) },
      uAdditionalLightColor: { value: Array.from({ length: 16 }, () => new THREE.Vector4()) },
      uAdditionalLightAttenuation: { value: Array.from({ length: 16 }, () => new THREE.Vector4()) },
      uAdditionalLightSpotDir: { value: Array.from({ length: 16 }, () => new THREE.Vector4()) },
    };
  }

  getUniforms() {
    return this.uniforms;
  }

  createPass(passId, material) {
    if (passId === "Forward") {
      // GLES3 e001 clips MainTex * MainColor against AlphaClipThreshold.
      // glTF MASK must not run its independent alphaTest first.
      material.alphaTest = 0;
    }
    return null;
  }

  onBeforeRender(renderer, scene) {
    if (!scene) throw new Error("CharacterEye requires a scene for Unity lighting inputs");
    let main = null;
    const additional = [];
    const mainColor = this.uniforms.uSceneLightColor.value.setRGB(0, 0, 0);
    const ambientColor = this.uniforms.uSceneAmbientColor.value.setRGB(0, 0, 0);
    sceneLightCandidates(scene, renderer, true).forEach((light) => {
      if (!light.isLight || (this.mesh?.layers && !this.mesh.layers.test(light.layers))) return;
      if (light.isAmbientLight) {
        ambientColor.add(this.ambientContribution.copy(light.color).multiplyScalar(light.intensity));
      } else if (light.isDirectionalLight && main === null) {
        main = light;
        mainColor.copy(light.color).multiplyScalar(light.intensity);
      } else if (light.isDirectionalLight || light.isPointLight || light.isSpotLight) {
        additional.push(light);
      } else {
        throw new Error(`CharacterEye unsupported scene light: ${light.type}`);
      }
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

  destroy() {
    this.mesh = null;
  }
}
