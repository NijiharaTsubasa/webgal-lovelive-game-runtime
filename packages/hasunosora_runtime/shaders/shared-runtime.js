function bindMaterialUniforms(material, uniforms) {
  if (!material.uniforms) material.uniforms = {};
  Object.assign(material.uniforms, uniforms);
}

const shaderTimeOrigin = performance.now();

const defaultFramebufferSamples = new WeakMap();

// SAMPLES is constant for a default drawing buffer, but querying it can
// synchronize with the GPU. Share the native result across materials/frames;
// explicit Three render targets keep using their current sample setting.
export function renderTargetSamples(renderer) {
  const target = renderer?.getRenderTarget?.();
  if (target) return target.samples;
  const gl = renderer?.getContext?.();
  if (!gl) return undefined;
  const canvas = gl.canvas ?? renderer.domElement;
  let entry = defaultFramebufferSamples.get(gl);
  if (!entry) {
    entry = { samples: undefined, width: undefined, height: undefined, lost: false };
    defaultFramebufferSamples.set(gl, entry);
    canvas?.addEventListener("webglcontextlost", () => {
      entry.samples = undefined;
      entry.lost = true;
    });
    canvas?.addEventListener("webglcontextrestored", () => {
      entry.samples = undefined;
      entry.lost = false;
    });
  }
  if (entry.lost) return null;
  if (entry.samples === undefined || entry.width !== canvas?.width || entry.height !== canvas?.height) {
    const samples = gl.getParameter(gl.SAMPLES);
    // A lost context can return null before its loss event is delivered.
    if (samples == null) return samples;
    entry.samples = samples;
    entry.width = canvas?.width;
    entry.height = canvas?.height;
  }
  return entry.samples;
}

const sceneLightsByRenderer = new WeakMap();

function collectSceneLights(scene, visibleOnly) {
  const lights = [];
  scene[visibleOnly ? "traverseVisible" : "traverse"]((object) => {
    if (object.isLight || object.isDirectionalLight || object.isAmbientLight) lights.push(object);
  });
  return lights;
}

// Runtime hooks share the scene structure until the next renderer frame. A
// GrabPass render advances that frame too, so its following hooks get a fresh
// snapshot. Keep all/visible traversals separate: their ancestor rules differ.
// Only candidate references are cached; per-mesh layers and light values stay live.
export function sceneLightCandidates(scene, renderer, visibleOnly = false) {
  const frame = renderer?.info?.render?.frame;
  if (!Number.isFinite(frame)) return collectSceneLights(scene, visibleOnly);
  let scenes = sceneLightsByRenderer.get(renderer);
  if (!scenes) {
    scenes = new WeakMap();
    sceneLightsByRenderer.set(renderer, scenes);
  }
  let entry = scenes.get(scene);
  if (!entry || entry.frame !== frame) {
    entry = { frame };
    scenes.set(scene, entry);
  }
  const key = visibleOnly ? "visible" : "all";
  if (!entry[key]) entry[key] = collectSceneLights(scene, visibleOnly);
  return entry[key];
}

export function findSceneLights(scene, renderer) {
  const lights = { directional: null, ambient: null };
  sceneLightCandidates(scene, renderer).forEach((object) => {
    if (!lights.directional && object.isDirectionalLight) lights.directional = object;
    if (!lights.ambient && object.isAmbientLight) lights.ambient = object;
  });
  return lights;
}

// Three distance=0 means no range cutoff. The compiled Unity light loop
// accepts an attenuation.x of zero; keep that mapping instead of rejecting it.
export function unityRangeAttenuation(distance) {
  return distance === 0 ? 0 : 1 / (distance * distance);
}

// Three's hard-edge spotlight has penumbra=0. Its limiting Unity cone input
// needs a finite slope; this approximation belongs to scene input mapping,
// not to the compiled shader's attenuation algorithm.
export function unitySpotCone(angle, penumbra) {
  const outer = Math.cos(angle);
  const inner = Math.cos(angle * (1 - penumbra));
  const delta = inner - outer;
  const inverse = 1 / (delta === 0 ? Number.EPSILON : delta);
  return [inverse, -outer * inverse];
}

export class TimeRuntime {
  constructor(THREE, renderer, material) {
    this.material = material;
    // Unity's _TimeParameters is shared by a scene, not restarted for each
    // material that happens to bind this shader later.
    this.startTime = shaderTimeOrigin;
    this.uniforms = { uTime: { value: 0 } };
  }

  init() {
    bindMaterialUniforms(this.material, this.uniforms);
  }

  getUniforms() {
    return this.uniforms;
  }

  onBeforeRender() {
    this.uniforms.uTime.value = (performance.now() - this.startTime) / 1000;
  }

  destroy() {}
}

export class LightSyncRuntime {
  constructor(THREE, renderer, material) {
    this.material = material;
    this.uniforms = {
      uSceneLightColor: { value: new THREE.Color(0, 0, 0) },
      uSceneAmbientColor: { value: new THREE.Color(0, 0, 0) },
    };
  }

  init() {
    bindMaterialUniforms(this.material, this.uniforms);
  }

  getUniforms() {
    return this.uniforms;
  }

  onBeforeRender(renderer, scene) {
    if (!scene) return;
    const { directional, ambient } = findSceneLights(scene, renderer);
    this.uniforms.uSceneLightColor.value.setRGB(0, 0, 0);
    this.uniforms.uSceneAmbientColor.value.setRGB(0, 0, 0);
    if (directional) {
      this.uniforms.uSceneLightColor.value.copy(directional.color);
      this.uniforms.uSceneLightColor.value.multiplyScalar(directional.intensity);
    }
    if (ambient) {
      this.uniforms.uSceneAmbientColor.value.copy(ambient.color);
      this.uniforms.uSceneAmbientColor.value.multiplyScalar(ambient.intensity);
    }
  }

  destroy() {}
}
