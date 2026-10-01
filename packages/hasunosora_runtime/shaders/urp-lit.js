// Scene-global inputs for the source URP/Lit Forward branch in urp-lit.glsl.
// A supported scene has one main directional light, optional constant ambient,
// and up to four unshadowed per-object additional lights. A Three CubeTexture
// is mapped to the retained reflection-probe branch when present.
import { sceneLightCandidates, unityRangeAttenuation, unitySpotCone } from "./shared-runtime.js";

export default class UrpLitRuntime {
  constructor(THREE, renderer, material, mesh) {
    this.THREE = THREE;
    this.material = material;
    this.mesh = mesh;
    this.mainPosition = new THREE.Vector3();
    this.targetPosition = new THREE.Vector3();
    this.additionalPosition = new THREE.Vector3();
    this.additionalTarget = new THREE.Vector3();
    this.additionalDirection = new THREE.Vector3();
    this.ambientContribution = new THREE.Color();
    this.uniforms = {
      uUrpMainLightDirectionView: { value: new THREE.Vector3(0, 0, 1) },
      uUrpMainLightColor: { value: new THREE.Color(0, 0, 0) },
      uUrpBakedGI: { value: new THREE.Color(0, 0, 0) },
      uUrpAdditionalLightCount: { value: 0 },
      uUrpAdditionalLightPositionView: { value: Array.from({ length: 4 }, () => new THREE.Vector4()) },
      uUrpAdditionalLightColor: { value: Array.from({ length: 4 }, () => new THREE.Vector4()) },
      uUrpAdditionalLightAttenuation: { value: Array.from({ length: 4 }, () => new THREE.Vector4()) },
      uUrpAdditionalLightSpotDirView: { value: Array.from({ length: 4 }, () => new THREE.Vector4()) },
      uUrpReflectionProbe: { value: null },
      uUrpReflectionHDR: { value: new THREE.Vector4(1, 1, 0, 1) },
      uUrpOrthographic: { value: false },
    };
  }

  getUniforms() {
    return this.uniforms;
  }

  onBeforeRender(renderer, scene, camera) {
    if (!scene || !camera) throw new Error("URP/Lit requires a scene and camera");
    this.uniforms.uUrpOrthographic.value = Boolean(camera.isOrthographicCamera);
    if (scene.environment && !scene.environment.isCubeTexture) {
      throw new Error("URP/Lit requires a CubeTexture for the retained reflection-probe branch");
    }
    const reflectionActive = Boolean(scene.environment);
    if (this.material) {
      const defines = this.material.defines || (this.material.defines = {});
      if (reflectionActive && !defines.URP_REFLECTION_PROBE) {
        defines.URP_REFLECTION_PROBE = 1;
        this.material.needsUpdate = true;
      } else if (!reflectionActive && defines.URP_REFLECTION_PROBE) {
        delete defines.URP_REFLECTION_PROBE;
        this.material.needsUpdate = true;
      }
    }
    this.uniforms.uUrpReflectionProbe.value = scene.environment || null;
    if (this.material?.envMap || this.material?.normalMap ||
        this.material?.metalnessMap || this.material?.roughnessMap ||
        this.material?.emissiveMap || this.material?.aoMap) {
      throw new Error("URP/Lit textured material variants are not ported");
    }
    const lights = [];
    sceneLightCandidates(scene, renderer).forEach((object) => {
      if (object.isLight && object.visible &&
          (!this.mesh?.layers || this.mesh.layers.test(object.layers))) lights.push(object);
    });
    const directional = lights.filter((light) => light.isDirectionalLight);
    const ambient = lights.filter((light) => light.isAmbientLight);
    if (lights.some((light) => !light.isDirectionalLight && !light.isAmbientLight &&
          !light.isPointLight && !light.isSpotLight)) {
      throw new Error("URP/Lit requires supported scene lights");
    }
    const main = directional[0];
    const additional = lights.filter((light) => light !== main && !light.isAmbientLight);
    additional.length = Math.min(additional.length, 4);

    camera.updateMatrixWorld();
    if (main) {
      main.getWorldPosition(this.mainPosition);
      main.target.getWorldPosition(this.targetPosition);
      this.uniforms.uUrpMainLightDirectionView.value
        .subVectors(this.mainPosition, this.targetPosition)
        .normalize()
        .transformDirection(camera.matrixWorldInverse);
      this.uniforms.uUrpMainLightColor.value
        .copy(main.color).multiplyScalar(main.intensity);
    } else {
      this.uniforms.uUrpMainLightDirectionView.value.set(0, 0, 0);
      this.uniforms.uUrpMainLightColor.value.setRGB(0, 0, 0);
    }
    this.uniforms.uUrpAdditionalLightCount.value = additional.length;
    for (const [index, light] of additional.entries()) {
      const position = this.uniforms.uUrpAdditionalLightPositionView.value[index];
      const color = this.uniforms.uUrpAdditionalLightColor.value[index];
      const attenuation = this.uniforms.uUrpAdditionalLightAttenuation.value[index];
      const spotDirection = this.uniforms.uUrpAdditionalLightSpotDirView.value[index];
      light.getWorldPosition(this.additionalPosition);
      if (light.isDirectionalLight) {
        light.target.getWorldPosition(this.additionalTarget);
        this.additionalDirection.subVectors(this.additionalPosition, this.additionalTarget)
          .normalize().transformDirection(camera.matrixWorldInverse);
        position.set(this.additionalDirection.x, this.additionalDirection.y,
          this.additionalDirection.z, 0);
        attenuation.set(0, 1, 0, 1);
        spotDirection.set(0, 0, 1, 0);
      } else {
        this.additionalPosition.applyMatrix4(camera.matrixWorldInverse);
        position.set(this.additionalPosition.x, this.additionalPosition.y,
          this.additionalPosition.z, 1);
        attenuation.set(unityRangeAttenuation(light.distance), 1, 0, 1);
        spotDirection.set(0, 0, 1, 0);
        if (light.isSpotLight) {
          light.getWorldPosition(this.additionalPosition);
          light.target.getWorldPosition(this.additionalTarget);
          this.additionalDirection.subVectors(this.additionalPosition, this.additionalTarget)
            .normalize().transformDirection(camera.matrixWorldInverse);
          spotDirection.set(this.additionalDirection.x, this.additionalDirection.y,
            this.additionalDirection.z, 0);
          [attenuation.z, attenuation.w] = unitySpotCone(light.angle, light.penumbra);
        }
      }
      color.set(light.color.r * light.intensity, light.color.g * light.intensity,
        light.color.b * light.intensity, 1);
    }
    const bakedGI = this.uniforms.uUrpBakedGI.value;
    bakedGI.setRGB(0, 0, 0);
    for (const light of ambient) {
      bakedGI.add(this.ambientContribution.copy(light.color).multiplyScalar(light.intensity));
    }
  }

  destroy() {
    this.material = null;
    this.mesh = null;
  }
}
