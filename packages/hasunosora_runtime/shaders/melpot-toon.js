// ============================================================================

import { findSceneLights, sceneLightCandidates, renderTargetSamples, unityRangeAttenuation, unitySpotCone } from "./shared-runtime.js";
// MELPOT Toon Shader 运行时
// ----------------------------------------------------------------------------
// 负责维护光照相关 Uniforms (uKeyLightDir, uSceneLightColor, uSceneAmbientColor)
// 并实现每帧从 Three.js 场景中自动同步灯光数据的逻辑。
// ============================================================================

export default class MelpotToonRuntime {
  constructor(THREE, renderer, material, mesh) {
    this.renderer = renderer;
    this.material = material;
    this.mesh = mesh;

    // Scene lights are runtime inputs; absent lights contribute no color.
    this.defaults = {
      keyLightDir: new THREE.Vector3(0, 1, 0),
      keyLightColor: new THREE.Color(0, 0, 0),
      ambientColor: new THREE.Color(0, 0, 0),
    };

    // 定义并持有所需的 Uniform 对象
    this.uniforms = {
      uKeyLightDir: { value: this.defaults.keyLightDir.clone() },
      uSceneLightColor: { value: this.defaults.keyLightColor.clone() },
      uSceneAmbientColor: { value: this.defaults.ambientColor.clone() },
      uAlphaToMaskAvailable: { value: 0 },
      uAdditionalLightCount: { value: 0 },
      uAdditionalLightPosition: { value: Array.from({ length: 16 }, () => new THREE.Vector4()) },
      uAdditionalLightColor: { value: Array.from({ length: 16 }, () => new THREE.Vector4()) },
      uAdditionalLightAttenuation: { value: Array.from({ length: 16 }, () => new THREE.Vector4()) },
      uAdditionalLightSpotDir: { value: Array.from({ length: 16 }, () => new THREE.Vector4()) },
    };
    this.lightWorldPosition = new THREE.Vector3();
    this.targetWorldPosition = new THREE.Vector3();
    this.additionalWorldPosition = new THREE.Vector3();
    this.additionalTargetPosition = new THREE.Vector3();
    this.additionalDirection = new THREE.Vector3();
  }

  // 一次性初始化（此处无额外 GPU 资源申请，可留空或做初始化检查）
  init(renderer) {
    this.renderer = renderer;
  }

  // 返回此运行时需要注入 shader.uniforms 的字段
  getUniforms() {
    return this.uniforms;
  }

  createPass(passId, material) {
    // glTF MASK clips the base-color texture before MELPOT's injected body.
    // The compiled Forward and Outline programs instead clip ControlMap1.
    material.alphaTest = 0;
    return null;
  }

  // 每帧渲染前执行：从场景中寻找主平行光与环境光并同步到 uniform 中
  onBeforeRender(renderer, scene, camera) {
    if (!scene) return;

    const activeRenderer = renderer || this.renderer;
    const gl = activeRenderer?.getContext?.();
    if (gl) {
      const samples = renderTargetSamples(activeRenderer);
      this.uniforms.uAlphaToMaskAvailable.value = samples > 1 ? 1 : 0;
    }

    const { directional: mainDirLight, ambient: ambientLight } = findSceneLights(scene, activeRenderer);

    this.uniforms.uSceneLightColor.value.setRGB(0, 0, 0);
    this.uniforms.uSceneAmbientColor.value.setRGB(0, 0, 0);

    // 同步平行光数据
    if (mainDirLight) {
      if (this.uniforms.uSceneLightColor) {
        this.uniforms.uSceneLightColor.value.copy(mainDirLight.color);
        this.uniforms.uSceneLightColor.value.multiplyScalar(mainDirLight.intensity);
      }
      if (this.uniforms.uKeyLightDir) {
        // Three.js directional lights point from position to target. MELPOT's
        // light vector points from the shaded surface toward the light, so use
        // the inverse ray: light position minus target position.
        mainDirLight.getWorldPosition(this.lightWorldPosition);
        mainDirLight.target.getWorldPosition(this.targetWorldPosition);
        this.uniforms.uKeyLightDir.value
          .subVectors(this.lightWorldPosition, this.targetWorldPosition)
          .normalize();
      }
    }

    // 同步环境光数据
    if (ambientLight && this.uniforms.uSceneAmbientColor) {
      this.uniforms.uSceneAmbientColor.value.copy(ambientLight.color);
      this.uniforms.uSceneAmbientColor.value.multiplyScalar(ambientLight.intensity);
    }

    const additional = [];
    sceneLightCandidates(scene, activeRenderer, true).forEach((light) => {
      if (!light.isLight || light === mainDirLight || light === ambientLight) return;
      if (this.mesh?.layers && !this.mesh.layers.test(light.layers)) return;
      if (!light.isDirectionalLight && !light.isPointLight && !light.isSpotLight) {
        throw new Error(`MELPOT unsupported additional scene light: ${light.type}`);
      }
      additional.push(light);
    });
    // Unity chooses a bounded per-object subset; use scene order for this bridge.
    additional.length = Math.min(additional.length, 8);
    this.uniforms.uAdditionalLightCount.value = additional.length;
    for (const [index, light] of additional.entries()) {
      const position = this.uniforms.uAdditionalLightPosition.value[index];
      const color = this.uniforms.uAdditionalLightColor.value[index];
      const attenuation = this.uniforms.uAdditionalLightAttenuation.value[index];
      const spotDirection = this.uniforms.uAdditionalLightSpotDir.value[index];
      if (light.isDirectionalLight) {
        light.getWorldPosition(this.additionalWorldPosition);
        light.target.getWorldPosition(this.additionalTargetPosition);
        this.additionalDirection.subVectors(this.additionalWorldPosition, this.additionalTargetPosition).normalize();
        position.set(this.additionalDirection.x, this.additionalDirection.y, this.additionalDirection.z, 0);
        attenuation.set(0, 1, 0, 1);
        spotDirection.set(0, 0, 1, 0);
      } else {
        light.getWorldPosition(this.additionalWorldPosition);
        position.set(this.additionalWorldPosition.x, this.additionalWorldPosition.y,
          this.additionalWorldPosition.z, 1);
        attenuation.set(unityRangeAttenuation(light.distance), 1, 0, 1);
        spotDirection.set(0, 0, 1, 0);
        if (light.isSpotLight) {
          light.target.getWorldPosition(this.additionalTargetPosition);
          this.additionalDirection.subVectors(this.additionalWorldPosition, this.additionalTargetPosition).normalize();
          spotDirection.set(this.additionalDirection.x, this.additionalDirection.y,
            this.additionalDirection.z, 0);
          [attenuation.z, attenuation.w] = unitySpotCone(light.angle, light.penumbra);
        }
      }
      color.set(light.color.r * light.intensity, light.color.g * light.intensity,
        light.color.b * light.intensity, 1);
    }
  }

  // 销毁时清理引用。uniforms 共享给 onBeforeCompile 已合并的 shader.uniforms，
// 不能清空——否则后续渲染会拿到无效引用。
  destroy() {
    this.renderer = null;
    this.material = null;
    this.mesh = null;
  }
}

// MELPOT realizes Forward on the source mesh and Outline as an inverted hull.
// The geometry choice belongs to this Shader runtime, not the renderer.
export class MelpotOutlineRuntime {
  constructor(THREE, renderer, material, mesh) {
    this.THREE = THREE;
    this.mesh = mesh;
    this.outlineMesh = null;
  }

  createPass(passId, material) {
    if (passId !== "Outline") return null;
    material.alphaMap = null;
    material.normalMap = null;
    material.roughnessMap = null;
    material.metalnessMap = null;
    material.emissiveMap = null;
    material.aoMap = null;
    const outlineMesh = this.mesh.clone();
    outlineMesh.name = (this.mesh.name || "mesh") + "_outline";
    outlineMesh.material = material;
    if (this.mesh.parent) this.mesh.parent.add(outlineMesh);
    this.outlineMesh = outlineMesh;
    return outlineMesh;
  }

  onBeforeRender() {
    const source = this.mesh?.morphTargetInfluences;
    const target = this.outlineMesh?.morphTargetInfluences;
    if (!source || !target) return;
    for (let i = 0; i < source.length; i++) target[i] = source[i];
  }

  destroy() {
    if (this.outlineMesh) {
      this.outlineMesh.removeFromParent();
      this.outlineMesh.material.dispose();
    }
    this.outlineMesh = null;
    this.mesh = null;
  }
}
