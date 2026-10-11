// URP 12.1: ScriptableRenderer.SetPerCameraShaderVariables/SetShaderTimeValues;
// UniversalRenderPipeline.GetMainLightIndex; InitializeLightConstants_Common.
// Matrices adapt Unity model-local/world X to the normalized glTF convention.
const timeOrigin = performance.now();
const lightCache = new WeakMap();
function directionalLights(scene, renderer) {
  const frame = renderer?.info?.render?.frame;
  let cache = lightCache.get(scene);
  if (!cache || cache.renderer !== renderer || !Number.isFinite(frame) || cache.frame !== frame) {
    const lights = [];
    scene.traverseVisible((object) => {
      if (object.isDirectionalLight) {
        lights.push(object);
      }
    });
    cache = { renderer, frame, lights };
    lightCache.set(scene, cache);
  }
  return cache.lights;
}
export default class YohaneUnityInputs {
  constructor(THREE, renderer, material, mesh) {
    this.THREE = THREE;
    this.mesh = mesh;
    this.reflection = new THREE.Matrix4().makeScale(-1, 1, 1);
    this.objectToWorld = new THREE.Matrix4();
    this.worldToObject = new THREE.Matrix4();
    this.view = new THREE.Matrix4();
    this.viewProjection = new THREE.Matrix4();
    this.cameraPosition = new THREE.Vector3();
    this.lightPosition = new THREE.Vector3();
    this.lightTarget = new THREE.Vector3();
    this.uniforms = {
      uYohanehlslcc_mtx4x4unity_ObjectToWorld: { value: new Float32Array(16) },
      uYohanehlslcc_mtx4x4unity_WorldToObject: { value: new Float32Array(16) },
      uYohanehlslcc_mtx4x4unity_MatrixV: { value: new Float32Array(16) },
      uYohanehlslcc_mtx4x4unity_MatrixVP: { value: new Float32Array(16) },
      uYohaneWorldSpaceCameraPos: { value: new THREE.Vector3() },
      uYohaneMainLightPosition: { value: new THREE.Vector4(0, 0, 1, 0) },
      uYohaneMainLightColor: { value: new THREE.Vector4(0, 0, 0, 1) },
      uYohaneunity_LightData: { value: new THREE.Vector4(0, 0, 0, 0) },
      // This renderer uses a single native-resolution target, with no URP
      // image-upscaling stage: cameraWidth/scaledCameraWidth=1, mipBias=0.
      uYohaneGlobalMipBias: { value: new THREE.Vector2(0, 1) },
      uYohaneunity_OrthoParams: { value: new THREE.Vector4() },
      uYohaneProjectionParams: { value: new THREE.Vector4() },
      uYohaneTimeParameters: { value: new THREE.Vector4() },
    };
  }
  getUniforms(passId) {
    if (passId?.startsWith('ShadowCaster_') && !this.shadowFrame) {
      throw new Error(
        'Yohane ShadowCaster requires explicit shadow camera, light direction and URP bias inputs',
      );
    }
    return this.uniforms;
  }
  configurePass(passId, material) {
    // The compiled shader owns texture decoding, alpha testing, lighting and
    // final RGBA. Remove inherited glTF/PBR work before Three adds its defines.
    for (const name of [
      'map',
      'alphaMap',
      'normalMap',
      'bumpMap',
      'emissiveMap',
      'metalnessMap',
      'roughnessMap',
      'aoMap',
      'lightMap',
      'envMap',
    ]) {
      material[name] = null;
    }
    material.alphaTest = 0;
    material.alphaHash = false;
    material.premultipliedAlpha = false;
    material.fog = false;
    material.toneMapped = false;
    material.opacity = 1;
    const patch = material.onBeforeCompile;
    material.onBeforeCompile = function (shader, ...args) {
      patch.call(this, shader, ...args);
      const anchor = '#include <opaque_fragment>';
      if (!shader.fragmentShader.includes(anchor)) {
        throw new Error('Yohane source RGBA requires Three opaque_fragment anchor');
      }
      const output = shader.fragmentShader.match(
        /vec3 outgoingLight = (yohaneFragment_\w+)\.rgb;/,
      )?.[1];
      if (!output) {
        throw new Error('Yohane source RGBA output was not injected');
      }
      shader.fragmentShader = shader.fragmentShader.replace(
        anchor,
        anchor + '\ngl_FragColor.a = ' + output + '.a;',
      );
    };
  }
  setFrame(frame) {
    if (!Number.isFinite(frame.time)) {
      throw new Error('Yohane shader frame.time must be finite');
    }
    this.frame = frame;
    const t = frame.time;
    this.uniforms.uYohaneTimeParameters.value.set(t, Math.sin(t), Math.cos(t), 0);
  }
  onBeforeRender(renderer, scene, camera) {
    if (!scene || !camera || !this.mesh) {
      throw new Error('Yohane shader requires a scene, camera and mesh');
    }
    if (!camera.isOrthographicCamera && !camera.isPerspectiveCamera) {
      throw new Error('Yohane shader requires a perspective or orthographic camera');
    }
    this.mesh.updateWorldMatrix(true, false);
    camera.updateWorldMatrix(true, false);
    const determinant = this.mesh.matrixWorld.determinant();
    if (determinant === 0 || !Number.isFinite(determinant)) {
      throw new Error('Yohane shader requires an invertible mesh transform');
    }
    const S = this.reflection;
    this.objectToWorld.copy(S).multiply(this.mesh.matrixWorld).multiply(S);
    this.worldToObject.copy(this.objectToWorld).invert();
    this.view.copy(camera.matrixWorldInverse).multiply(S);
    this.viewProjection.copy(camera.projectionMatrix).multiply(this.view);
    const u = this.uniforms;
    u.uYohanehlslcc_mtx4x4unity_ObjectToWorld.value.set(this.objectToWorld.elements);
    u.uYohanehlslcc_mtx4x4unity_WorldToObject.value.set(this.worldToObject.elements);
    u.uYohanehlslcc_mtx4x4unity_MatrixV.value.set(this.view.elements);
    u.uYohanehlslcc_mtx4x4unity_MatrixVP.value.set(this.viewProjection.elements);
    camera.getWorldPosition(this.cameraPosition);
    u.uYohaneWorldSpaceCameraPos.value.set(
      -this.cameraPosition.x,
      this.cameraPosition.y,
      this.cameraPosition.z,
    );
    const ortho = camera.isOrthographicCamera;
    u.uYohaneunity_OrthoParams.value.set(
      ortho ? (camera.right - camera.left) / (2 * camera.zoom) : 0,
      ortho ? (camera.top - camera.bottom) / (2 * camera.zoom) : 0,
      0,
      ortho ? 1 : 0,
    );
    // GLES/WebGL projections retain their native bottom-left orientation.
    u.uYohaneProjectionParams.value.set(
      1,
      camera.near,
      camera.far,
      camera.far === 0 ? 0 : 1 / camera.far,
    );
    const t = this.frame ? this.frame.time : (performance.now() - timeOrigin) / 1000;
    if (!Number.isFinite(t)) {
      throw new Error('Yohane shader frame.time must be finite');
    }
    u.uYohaneTimeParameters.value.set(t, Math.sin(t), Math.cos(t), 0);
    // Unity picks the brightest visible directional when RenderSettings.sun is
    // absent. Three's scene has no sun selector; directional input is unchanged.
    let main = null;
    let intensity = 0;
    for (const light of directionalLights(scene, renderer)) {
      if (camera.layers && !camera.layers.test(light.layers)) {
        continue;
      }
      if (light.intensity > intensity) {
        main = light;
        intensity = light.intensity;
      }
    }
    if (main) {
      main.getWorldPosition(this.lightPosition);
      main.target.getWorldPosition(this.lightTarget);
      this.lightPosition.sub(this.lightTarget).normalize();
      u.uYohaneMainLightPosition.value.set(
        -this.lightPosition.x,
        this.lightPosition.y,
        this.lightPosition.z,
        0,
      );
      u.uYohaneMainLightColor.value.set(
        main.color.r * intensity,
        main.color.g * intensity,
        main.color.b * intensity,
        1,
      );
      u.uYohaneunity_LightData.value.z = this.mesh.layers.test(main.layers) ? 1 : 0;
    } else {
      u.uYohaneMainLightPosition.value.set(0, 0, 1, 0);
      u.uYohaneMainLightColor.value.set(0, 0, 0, 1);
      u.uYohaneunity_LightData.value.z = 0;
    }
  }
  destroy() {
    this.mesh = null;
  }
}
