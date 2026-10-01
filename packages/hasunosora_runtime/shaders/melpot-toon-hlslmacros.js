// Current-scene input binding for the shipped HLSLMacros GLES3 program.
// This does not reconstruct the original game's light probes or
// colour-management state. Unity atlas values must be supplied by the scene.
import { renderTargetSamples, sceneLightCandidates, unityRangeAttenuation, unitySpotCone } from "./shared-runtime.js";

export default class HlslMacrosRuntime {
  constructor(THREE, renderer, material, mesh) {
    this.renderer = renderer;
    this.material = material;
    this.mesh = mesh;
    this.outlineMesh = null;
    this.lightWorldPosition = new THREE.Vector3();
    this.targetWorldPosition = new THREE.Vector3();
    this.direction = new THREE.Vector3();
    this.ambientContribution = new THREE.Color();
    this.uniforms = {
      uMainLightDirection: { value: new THREE.Vector3() },
      uMainLightColor: { value: new THREE.Color() },
      uAdditionalLightCount: { value: 0 },
      uAdditionalLightPosition: { value: Array.from({ length: 16 }, () => new THREE.Vector4()) },
      uAdditionalLightColor: { value: Array.from({ length: 16 }, () => new THREE.Vector4()) },
      uAdditionalLightAttenuation: { value: Array.from({ length: 16 }, () => new THREE.Vector4()) },
      uAdditionalLightSpotDir: { value: Array.from({ length: 16 }, () => new THREE.Vector4()) },
      uUnitySHAmbientW: { value: new THREE.Color() },
      uAlphaToMaskAvailable: { value: 0 },
      uGlobalMipBias: { value: 0 },
      uOrthographicView: { value: false },
    };
  }

  init(renderer) {
    this.renderer = renderer;
    if (!renderer?.capabilities?.isWebGL2) {
      throw new Error("HLSLMacros requires WebGL2 for GLSL3 and vertex textureLod");
    }
  }

  getUniforms() {
    return this.uniforms;
  }

  createPass(passId, material, mesh) {
    // The compiled HLSLMacros passes clip solely from ControlMap1.zw and
    // Transparency. glTF MASK adds an unrelated MainTex alphaTest otherwise.
    material.alphaTest = 0;
    if (passId !== "Outline") {
      return null;
    }
    const outline = mesh.clone();
    outline.name = `${mesh.name || "mesh"}_hlslmacros_outline`;
    outline.material = material;
    if (mesh.parent) mesh.parent.add(outline);
    this.outlineMesh = outline;
    return outline;
  }

  onBeforeRender(renderer, scene, camera) {
    if (!renderer || !scene || !camera) {
      throw new Error("HLSLMacros requires renderer, scene and camera on every frame");
    }
    this.uniforms.uOrthographicView.value = Boolean(camera.isOrthographicCamera);
    let directional = null;
    const additional = [];
    const ambientColor = this.uniforms.uUnitySHAmbientW.value.setRGB(0, 0, 0);
    sceneLightCandidates(scene, renderer, true).forEach((object) => {
      if (!object.isLight || (this.mesh?.layers && !this.mesh.layers.test(object.layers))) return;
      if (object.isDirectionalLight) {
        if (directional) additional.push(object);
        else directional = object;
      } else if (object.isAmbientLight) {
        ambientColor.add(this.ambientContribution.copy(object.color).multiplyScalar(object.intensity));
      } else if (object.isPointLight || object.isSpotLight) {
        additional.push(object);
      } else {
        throw new Error(`HLSLMacros unsupported scene light: ${object.type}`);
      }
    });
    additional.length = Math.min(additional.length, 8);
    if (directional) {
      directional.getWorldPosition(this.lightWorldPosition);
      directional.target.getWorldPosition(this.targetWorldPosition);
      this.uniforms.uMainLightDirection.value
        .subVectors(this.lightWorldPosition, this.targetWorldPosition).normalize();
      this.uniforms.uMainLightColor.value.copy(directional.color).multiplyScalar(directional.intensity);
    } else {
      this.uniforms.uMainLightDirection.value.set(0, 0, 0);
      this.uniforms.uMainLightColor.value.setRGB(0, 0, 0);
    }
    // This is an explicit current-scene ambient-light mapping to the three
    // SH constant coefficients read by e007/e001, not original game SH data.
    this.uniforms.uAdditionalLightCount.value = additional.length;
    for (const [index, light] of additional.entries()) {
      const position = this.uniforms.uAdditionalLightPosition.value[index];
      const color = this.uniforms.uAdditionalLightColor.value[index];
      const attenuation = this.uniforms.uAdditionalLightAttenuation.value[index];
      const spotDirection = this.uniforms.uAdditionalLightSpotDir.value[index];
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
    const samples = renderTargetSamples(renderer);
    // URP DrawObjectsPass sets the corresponding flag only for multisampled
    // targets with more than one sample, not merely a nonzero sample count.
    this.uniforms.uAlphaToMaskAvailable.value = samples > 1 ? 1 : 0;
    const source = this.mesh?.morphTargetInfluences;
    const destination = this.outlineMesh?.morphTargetInfluences;
    if (source && destination) {
      for (let i = 0; i < source.length; i++) destination[i] = source[i];
    }
  }

  destroy() {
    if (this.outlineMesh) {
      this.outlineMesh.removeFromParent();
      this.outlineMesh.material.dispose();
    }
    this.outlineMesh = null;
    this.material = null;
    this.mesh = null;
    this.renderer = null;
  }
}
