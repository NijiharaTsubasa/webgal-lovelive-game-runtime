import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import * as THREE from "three";

import {
  LightSyncRuntime as HighlightLightSyncRuntime,
  TimeRuntime as HighlightTimeRuntime,
  HighlightAdditionalLightsRuntime,
} from "../packages/hasunosora_runtime/shaders/character-highlight.js";
import CharacterEyeRuntime from "../packages/hasunosora_runtime/shaders/character-eye.js";

function assertSharedAdvancingTimeRuntime(TimeRuntime) {
  const material = {};
  const pass = new TimeRuntime({}, null, material, null);
  pass.init();

  const firstUniforms = pass.getUniforms();
  const secondUniforms = pass.getUniforms();

  assert.equal(firstUniforms, secondUniforms);
  assert.equal(firstUniforms.uTime, material.uniforms.uTime);

  pass.startTime = performance.now() - 1_000;
  pass.onBeforeRender();
  assert.ok(firstUniforms.uTime.value >= 0.9);
}

test("character-highlight shares one advancing uTime uniform with the shader", () => {
  assertSharedAdvancingTimeRuntime(HighlightTimeRuntime);
  const first = new HighlightTimeRuntime({}, null, {});
  const second = new HighlightTimeRuntime({}, null, {});
  assert.equal(first.startTime, second.startTime);
});

test("character-highlight scene-light uniforms do not retain removed lights", () => {
  const scene = new THREE.Scene();
  const directional = new THREE.DirectionalLight(0xffffff, 1);
  const ambient = new THREE.AmbientLight(0x808080, 1);
  scene.add(directional, ambient);
  const pass = new HighlightLightSyncRuntime(THREE, null, {});
  pass.onBeforeRender(null, scene);
  assert.ok(pass.getUniforms().uSceneLightColor.value.r > 0);
  assert.ok(pass.getUniforms().uSceneAmbientColor.value.r > 0);
  scene.remove(directional, ambient);
  pass.onBeforeRender(null, scene);
  assert.deepEqual(pass.getUniforms().uSceneLightColor.value.toArray(), [0, 0, 0]);
  assert.deepEqual(pass.getUniforms().uSceneAmbientColor.value.toArray(), [0, 0, 0]);
});

test("highlight-distortion exports a shared advancing TimeRuntime", async () => {
  const module = await import("../packages/hasunosora_runtime/shaders/highlight-distortion.js");
  assert.equal(module.TimeRuntime, HighlightTimeRuntime);
  assertSharedAdvancingTimeRuntime(module.TimeRuntime);
});

test("highlight-distortion retains the compiled four-corner noise and source intensity", () => {
  const shader = readFileSync(new URL(
    "../packages/hasunosora_runtime/shaders/highlight-distortion.glsl", import.meta.url,
  ), "utf8");
  // GLES3 e001 hashes a square's four corners and interpolates with a
  // quintic fade; the old simplex substitute changed the displacement field.
  for (const corner of ["p00", "p01", "p10", "p11"]) {
    assert.match(shader, new RegExp(`float ${corner} = dot\\( melpotDistGradient\\(`));
  }
  assert.match(shader, /f \* f \* f \* \( f \* \( f \* 6\.0 - 15\.0 \) \+ 10\.0 \)/);
  assert.doesNotMatch(shader, /melpotDistSnoise/);
  assert.match(shader, /melpotDistDetSign = melpotDistDet < 0\.0 \? -1\.0 : 1\.0/);
  assert.match(shader, /melpotDistVN\.xy \* uDistortionIntensity;/);
  assert.doesNotMatch(shader, /melpotDistVN\.xy \* uDistortionIntensity \* 0\.1/);
});

test("character-highlight uses the compiled noise corners and ambient-floor light rule", () => {
  const shader = readFileSync(new URL(
    "../packages/hasunosora_runtime/shaders/character-highlight.glsl", import.meta.url,
  ), "utf8");
  for (const corner of ["corner.yy", "nextCorner.xy", "nextCorner.yx", "nextCorner.xx",
    "corner.ww", "nextCorner.zw", "nextCorner.wz", "nextCorner.zz"]) {
    assert.ok(shader.includes(`dot( ${corner}, hashBasis )`), corner);
  }
  assert.match(shader, /uSceneLightColor \/ maximum/);
  assert.match(shader, /max\( mainLight \+ additionalLight,/);
  assert.match(shader, /max\( ambientFloor, vec3\( 0\.10000000149011612 \) \) \)/);
  assert.doesNotMatch(shader, /min\( max\( melpotHLLight/);
});

test("character-highlight maps scene additional lights to its eight source slots", () => {
  const scene = new THREE.Scene();
  const main = new THREE.DirectionalLight(0xffffff, 1);
  const point = new THREE.PointLight(0x804020, 2, 5);
  point.position.set(1, 2, 3);
  scene.add(main, point);
  const mesh = new THREE.Mesh();
  const pass = new HighlightAdditionalLightsRuntime(THREE, null, {}, mesh);
  pass.onBeforeRender(null, scene);
  assert.equal(pass.getUniforms().uAdditionalLightCount.value, 1);
  assert.deepEqual(pass.getUniforms().uAdditionalLightPosition.value[0].toArray(), [1, 2, 3, 1]);
  assert.equal(pass.getUniforms().uAdditionalLightAttenuation.value[0].x, 1 / 25);
});

test("CharacterEye owns its additional-light inputs without changing CharacterHighlight", () => {
  assert.notEqual(CharacterEyeRuntime, HighlightLightSyncRuntime);
  assert.ok(new CharacterEyeRuntime(THREE, null, null, new THREE.Mesh())
    .getUniforms().uAdditionalLightPosition);
});

test("CharacterEye retains the compiled main-plus-ambient-floor light rule", () => {
  const shader = readFileSync(new URL(
    "../packages/hasunosora_runtime/shaders/character-eye.glsl", import.meta.url,
  ), "utf8");
  assert.match(shader, /vUv \* uMainTex_ST\.xy \+ uMainTex_ST\.zw/);
  assert.match(shader, /melpotEyeLight = max\( melpotEyeLight, max\( melpotEyeAmbient, vec3\( 0\.100000001 \) \) \)/);
  assert.doesNotMatch(shader, /min\( max\( melpotEyeLight/);
  assert.match(shader, /diffuseColor\.a = melpotEyeBase\.a/);
});

test("MELPOT package owns its inverted-hull second-pass behavior", async () => {
  const { MelpotOutlineRuntime } = await import("../packages/hasunosora_runtime/shaders/melpot-toon.js");
  const parent = { add(object) { object.parent = this; } };
  const source = {
    name: "Face",
    parent,
    morphTargetInfluences: [0.25, 0.75],
    clone() {
      return {
        isObject3D: true,
        userData: {},
        morphTargetInfluences: [0, 0],
        removeFromParent() { this.parent = null; },
      };
    },
  };
  let disposed = false;
  const material = {
    alphaMap: {}, normalMap: {}, roughnessMap: {}, metalnessMap: {}, emissiveMap: {}, aoMap: {},
    dispose() { disposed = true; },
  };
  const pass = new MelpotOutlineRuntime({ BackSide: "back" }, null, {}, source);
  assert.equal(pass.createPass("Forward", material), null);
  const outline = pass.createPass("Outline", material);

  assert.equal(outline.name, "Face_outline");
  assert.equal(outline.parent, parent);
  assert.equal(material.normalMap, null);
  pass.onBeforeRender();
  assert.deepEqual(outline.morphTargetInfluences, [0.25, 0.75]);
  pass.destroy();
  assert.equal(outline.parent, null);
  assert.equal(disposed, true);
});

test("MELPOT follows the directional light's position-to-target vector", async () => {
  const { default: MelpotToonRuntime } = await import("../packages/hasunosora_runtime/shaders/melpot-toon.js");
  const scene = new THREE.Scene();
  const light = new THREE.DirectionalLight(0xffffff, 3.2);
  light.position.set(3, 5, 4);
  light.target.position.set(0, 1, 0);
  scene.add(light, light.target);
  scene.updateMatrixWorld(true);

  const pass = new MelpotToonRuntime(THREE, null, {}, null);
  pass.onBeforeRender(null, scene, null);

  const expected = new THREE.Vector3(3, 4, 4).normalize();
  assert.ok(pass.getUniforms().uKeyLightDir.value.distanceTo(expected) < 1e-12);
  const gl = { SAMPLES: 0x80A9, getParameter: () => 4 };
  pass.onBeforeRender({ getContext: () => gl, getRenderTarget: () => null }, scene, null);
  assert.equal(pass.getUniforms().uAlphaToMaskAvailable.value, 1);
  pass.onBeforeRender({ getContext: () => gl, getRenderTarget: () => ({ samples: 1 }) }, scene, null);
  assert.equal(pass.getUniforms().uAlphaToMaskAvailable.value, 0);
});

test("shader runtimes share default framebuffer samples but read every active target", async () => {
  const { default: MelpotToonRuntime } = await import("../packages/hasunosora_runtime/shaders/melpot-toon.js");
  const { default: MelpotToonEyeRuntime } = await import("../packages/hasunosora_runtime/shaders/melpot-toon-eye.js");
  const { default: HlslMacrosRuntime } = await import("../packages/hasunosora_runtime/shaders/melpot-toon-hlslmacros.js");
  const { AlphaToMaskRuntime } = await import("../packages/hasunosora_runtime/shaders/character-highlight.js");
  let queries = 0;
  let target = { samples: 0 };
  const gl = { SAMPLES: 0x80A9, getParameter(key) {
    assert.equal(key, this.SAMPLES);
    queries++;
    return 4;
  } };
  const renderer = { getContext: () => gl, getRenderTarget: () => target };
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera();
  const passes = [MelpotToonRuntime, MelpotToonEyeRuntime, HlslMacrosRuntime, AlphaToMaskRuntime]
    .map((Pass) => new Pass(THREE, renderer, {}, new THREE.Mesh()));
  const render = (expected) => {
    for (const pass of passes) {
      pass.onBeforeRender(renderer, scene, camera);
      const uniforms = pass.getUniforms();
      assert.equal((uniforms.uAlphaToMaskAvailable ?? uniforms.uUnityAlphaToMaskAvailable).value, expected);
    }
  };
  render(0);
  target.samples = 1;
  render(0);
  target.samples = 4;
  render(1);
  assert.equal(queries, 0, "offscreen targets never query the default framebuffer");
  target = null;
  for (let i = 0; i < 3; i++) render(1);
  assert.equal(queries, 1, "all materials and frames share one native query");
  target = { samples: 0 };
  render(0);
  target = null;
  render(1);
  assert.equal(queries, 1, "switching targets preserves the default framebuffer cache");
});

test("default framebuffer sample cache follows resize and context loss/restoration", async () => {
  const { renderTargetSamples } = await import("../packages/hasunosora_runtime/shaders/shared-runtime.js");
  const canvas = Object.assign(new EventTarget(), { width: 100, height: 50 });
  let samples = 4;
  let queries = 0;
  const gl = { canvas, SAMPLES: 0x80A9, getParameter() { queries++; return samples; } };
  const renderer = { getContext: () => gl, getRenderTarget: () => null };
  assert.equal(renderTargetSamples(renderer), 4);
  assert.equal(renderTargetSamples(renderer), 4);
  assert.equal(queries, 1);
  canvas.width = 200;
  samples = 2;
  assert.equal(renderTargetSamples(renderer), 2);
  canvas.height = 80;
  samples = 1;
  assert.equal(renderTargetSamples(renderer), 1);
  assert.equal(queries, 3);
  canvas.dispatchEvent(new Event("webglcontextlost"));
  samples = null;
  assert.equal(renderTargetSamples(renderer) > 1, false);
  canvas.dispatchEvent(new Event("webglcontextrestored"));
  samples = 8;
  const beforeRestore = queries;
  assert.equal(renderTargetSamples(renderer), 8);
  assert.equal(renderTargetSamples(renderer), 8);
  assert.equal(queries, beforeRestore + 1);
});

test("sample cache isolates contexts, caches zero, and does not retain failed queries", async () => {
  const { renderTargetSamples } = await import("../packages/hasunosora_runtime/shaders/shared-runtime.js");
  let samples = null;
  let queries = 0;
  const gl = { SAMPLES: 0x80A9, getParameter() { queries++; return samples; } };
  const renderer = { getContext: () => gl, getRenderTarget: () => null };
  assert.equal(renderTargetSamples(renderer), null);
  samples = 0;
  assert.equal(renderTargetSamples(renderer), 0);
  assert.equal(renderTargetSamples(renderer), 0);
  assert.equal(queries, 2);
  const otherGl = { SAMPLES: gl.SAMPLES, getParameter: () => 4 };
  const other = { getContext: () => otherGl, getRenderTarget: () => null };
  assert.equal(renderTargetSamples(other), 4);
  assert.equal(renderTargetSamples(renderer), 0);
});

test("lighting runtimes share one all/visible scene scan per renderer frame", async () => {
  const { default: MelpotToonRuntime } = await import("../packages/hasunosora_runtime/shaders/melpot-toon.js");
  const { default: MelpotToonEyeRuntime } = await import("../packages/hasunosora_runtime/shaders/melpot-toon-eye.js");
  const { default: HlslMacrosRuntime } = await import("../packages/hasunosora_runtime/shaders/melpot-toon-hlslmacros.js");
  const { default: UrpLitRuntime } = await import("../packages/hasunosora_runtime/shaders/urp-lit.js");
  const scene = new THREE.Scene();
  scene.add(new THREE.DirectionalLight(), new THREE.AmbientLight(), new THREE.PointLight());
  const scans = { traverse: 0, traverseVisible: 0 };
  for (const method of Object.keys(scans)) {
    const original = scene[method];
    scene[method] = function (visitor) { scans[method]++; original.call(this, visitor); };
  }
  const gl = { SAMPLES: 0x80A9, getParameter: () => 4 };
  const renderer = { info: { render: { frame: 0 } }, getContext: () => gl };
  const camera = new THREE.PerspectiveCamera();
  const passes = [MelpotToonRuntime, MelpotToonEyeRuntime, HlslMacrosRuntime, UrpLitRuntime,
    HighlightLightSyncRuntime, HighlightAdditionalLightsRuntime, CharacterEyeRuntime]
    .map((Pass) => new Pass(THREE, renderer, {}, new THREE.Mesh()));
  for (let frame = 0; frame < 2; frame++) {
    renderer.info.render.frame = frame;
    for (let repeat = 0; repeat < 3; repeat++) {
      for (const pass of passes) pass.onBeforeRender(renderer, scene, camera);
    }
    assert.deepEqual(scans, { traverse: frame + 1, traverseVisible: frame + 1 });
  }
});

test("scene-light candidates isolate renderers/scenes and refresh hierarchy on the next frame", async () => {
  const { sceneLightCandidates } = await import("../packages/hasunosora_runtime/shaders/shared-runtime.js");
  const scene = new THREE.Scene(), otherScene = new THREE.Scene();
  const first = new THREE.PointLight(), second = new THREE.PointLight();
  const hidden = new THREE.Group(); hidden.visible = false; hidden.add(second);
  scene.add(first, hidden);
  const renderer = { info: { render: { frame: 0 } } };
  const otherRenderer = { info: { render: { frame: 0 } } };
  assert.deepEqual(sceneLightCandidates(scene, renderer), [first, second]);
  assert.deepEqual(sceneLightCandidates(scene, renderer, true), [first]);
  assert.deepEqual(sceneLightCandidates(otherScene, renderer, true), []);
  hidden.visible = true;
  assert.deepEqual(sceneLightCandidates(scene, otherRenderer, true), [first, second]);
  renderer.info.render.frame++;
  assert.deepEqual(sceneLightCandidates(scene, renderer, true), [first, second]);
  scene.remove(first);
  otherScene.add(first);
  second.visible = false;
  renderer.info.render.frame++;
  assert.deepEqual(sceneLightCandidates(scene, renderer), [second]);
  assert.deepEqual(sceneLightCandidates(scene, renderer, true), []);
  assert.deepEqual(sceneLightCandidates(otherScene, renderer, true), [first]);
});

test("scene-light calls without a finite renderer frame always read the current scene", async () => {
  const { sceneLightCandidates, findSceneLights } = await import("../packages/hasunosora_runtime/shaders/shared-runtime.js");
  for (const renderer of [null, {}, { info: { render: { frame: NaN } } },
    { info: { render: { frame: Infinity } } }]) {
    const scene = new THREE.Scene();
    const first = new THREE.DirectionalLight(), second = new THREE.DirectionalLight();
    scene.add(first);
    assert.equal(findSceneLights(scene, renderer).directional, first);
    assert.deepEqual(sceneLightCandidates(scene, renderer, true), [first]);
    scene.remove(first); scene.add(second);
    assert.equal(findSceneLights(scene, renderer).directional, second);
    assert.deepEqual(sceneLightCandidates(scene, renderer, true), [second]);
    second.visible = false;
    assert.deepEqual(sceneLightCandidates(scene, renderer, true), []);
  }
});

test("shared lighting candidates preserve hidden-ancestor rules and live per-mesh light inputs", async () => {
  const { default: UrpLitRuntime } = await import("../packages/hasunosora_runtime/shaders/urp-lit.js");
  const { findSceneLights } = await import("../packages/hasunosora_runtime/shaders/shared-runtime.js");
  const scene = new THREE.Scene();
  const hidden = new THREE.Group(); hidden.visible = false;
  const hiddenMain = new THREE.DirectionalLight(0xff0000, 1);
  const hiddenAmbient = new THREE.AmbientLight(0xff0000, 0.1);
  hidden.add(hiddenMain, hiddenAmbient);
  const visibleMain = new THREE.DirectionalLight(0x00ff00, 2);
  const visibleAmbient = new THREE.AmbientLight(0x00ff00, 0.2);
  const point = new THREE.PointLight(0x0000ff, 3);
  point.position.set(1, 2, 3);
  const invisiblePoint = new THREE.PointLight(); invisiblePoint.visible = false;
  scene.add(hidden, visibleMain, visibleAmbient, point, invisiblePoint);
  const renderer = { info: { render: { frame: 0 } } };
  const mesh = new THREE.Mesh(), otherMesh = new THREE.Mesh(); otherMesh.layers.set(1);
  const eye = new CharacterEyeRuntime(THREE, renderer, {}, mesh);
  const otherEye = new CharacterEyeRuntime(THREE, renderer, {}, otherMesh);
  const urp = new UrpLitRuntime(THREE, renderer, {}, mesh);
  const camera = new THREE.PerspectiveCamera();
  assert.equal(findSceneLights(scene, renderer).directional, hiddenMain);
  assert.equal(findSceneLights(scene, renderer).ambient, hiddenAmbient);
  eye.onBeforeRender(renderer, scene);
  otherEye.onBeforeRender(renderer, scene);
  urp.onBeforeRender(renderer, scene, camera);
  assert.deepEqual(eye.uniforms.uSceneLightColor.value.toArray(), [0, 2, 0]);
  assert.equal(eye.uniforms.uAdditionalLightCount.value, 1);
  assert.equal(otherEye.uniforms.uAdditionalLightCount.value, 0);
  assert.deepEqual(urp.uniforms.uUrpMainLightColor.value.toArray(), [1, 0, 0]);
  assert.deepEqual(urp.uniforms.uUrpBakedGI.value.toArray(), [0.1, 0.2, 0]);
  assert.equal(urp.uniforms.uUrpAdditionalLightCount.value, 2);

  // Candidates are shared, but layers, positions, colours and intensity stay live.
  point.layers.set(1); point.position.set(4, 5, 6); point.color.setRGB(0.25, 0.5, 1); point.intensity = 2;
  visibleMain.intensity = 4;
  eye.onBeforeRender(renderer, scene);
  otherEye.onBeforeRender(renderer, scene);
  assert.deepEqual(eye.uniforms.uSceneLightColor.value.toArray(), [0, 4, 0]);
  assert.equal(eye.uniforms.uAdditionalLightCount.value, 0);
  assert.equal(otherEye.uniforms.uAdditionalLightCount.value, 1);
  assert.deepEqual(otherEye.uniforms.uAdditionalLightPosition.value[0].toArray(), [4, 5, 6, 1]);
  assert.deepEqual(otherEye.uniforms.uAdditionalLightColor.value[0].toArray(), [0.5, 1, 2, 1]);
});

test("MELPOT scene-light inputs clear when lights are removed", async () => {
  const { default: MelpotToonRuntime } = await import("../packages/hasunosora_runtime/shaders/melpot-toon.js");
  const scene = new THREE.Scene();
  const directional = new THREE.DirectionalLight(0xffffff, 2);
  const ambient = new THREE.AmbientLight(0x808080, 1);
  scene.add(directional, ambient);
  const pass = new MelpotToonRuntime(THREE, null, {}, null);
  pass.onBeforeRender(null, scene, null);
  assert.ok(pass.getUniforms().uSceneLightColor.value.r > 0);
  assert.ok(pass.getUniforms().uSceneAmbientColor.value.r > 0);
  scene.remove(directional, ambient);
  pass.onBeforeRender(null, scene, null);
  assert.deepEqual(pass.getUniforms().uSceneLightColor.value.toArray(), [0, 0, 0]);
  assert.deepEqual(pass.getUniforms().uSceneAmbientColor.value.toArray(), [0, 0, 0]);
});

test("MELPOT pass disables glTF main-texture alphaTest before source ControlMap1 clipping", async () => {
  const { default: MelpotToonRuntime } = await import("../packages/hasunosora_runtime/shaders/melpot-toon.js");
  const mesh = new THREE.Mesh(new THREE.BoxGeometry());
  const pass = new MelpotToonRuntime(THREE, null, {}, mesh);
  const material = new THREE.MeshStandardMaterial();
  material.alphaTest = 0.5;
  assert.equal(pass.createPass("Forward", material, mesh, { shaderParams: {
    MainTex_ST: [1, 1, 0, 0], Transparency: 1, AlphaClipThreshold: 0.5,
  } }, { ControlMap1: new THREE.Texture() }), null);
  assert.equal(material.alphaTest, 0);
  material.alphaTest = 0.5;
  assert.equal(pass.createPass("Outline", material), null);
  assert.equal(material.alphaTest, 0);
  pass.destroy();
  material.dispose();
});

test("MELPOT maps an additional point light to Unity's compiled distance attenuation inputs", async () => {
  const { default: MelpotToonRuntime } = await import("../packages/hasunosora_runtime/shaders/melpot-toon.js");
  const scene = new THREE.Scene();
  const key = new THREE.DirectionalLight(0xffffff, 1);
  const ambient = new THREE.AmbientLight(0xffffff, 0.1);
  const point = new THREE.PointLight(0x8080ff, 2, 10);
  point.position.set(1, 2, 3);
  scene.add(key, ambient, point);
  const pass = new MelpotToonRuntime(THREE, null, {}, new THREE.Mesh());
  pass.onBeforeRender(null, scene, null);
  assert.equal(pass.getUniforms().uAdditionalLightCount.value, 1);
  assert.deepEqual(pass.getUniforms().uAdditionalLightPosition.value[0].toArray(), [1, 2, 3, 1]);
  assert.equal(pass.getUniforms().uAdditionalLightAttenuation.value[0].x, 0.01);
  assert.deepEqual(pass.getUniforms().uAdditionalLightAttenuation.value[0].toArray().slice(2), [0, 1]);
  point.distance = 0;
  pass.onBeforeRender(null, scene, null);
  assert.equal(pass.getUniforms().uAdditionalLightAttenuation.value[0].x, 0);
});

test("MELPOT maps a Three spotlight cone into the source dot-product gate", async () => {
  const { default: MelpotToonRuntime } = await import("../packages/hasunosora_runtime/shaders/melpot-toon.js");
  const scene = new THREE.Scene();
  scene.add(new THREE.DirectionalLight(), new THREE.AmbientLight());
  const spot = new THREE.SpotLight(0xffffff, 1, 12, Math.PI / 4, 0.5);
  spot.position.set(0, 5, 0);
  spot.target.position.set(0, 0, 0);
  scene.add(spot, spot.target);
  const pass = new MelpotToonRuntime(THREE, null, {}, new THREE.Mesh());
  pass.onBeforeRender(null, scene, null);
  assert.equal(pass.getUniforms().uAdditionalLightCount.value, 1);
  assert.deepEqual(pass.getUniforms().uAdditionalLightSpotDir.value[0].toArray(), [0, 1, 0, 0]);
  const encoded = pass.getUniforms().uAdditionalLightAttenuation.value[0];
  const outer = Math.cos(spot.angle);
  const inner = Math.cos(spot.angle * (1 - spot.penumbra));
  assert.ok(Math.abs(encoded.z - 1 / (inner - outer)) < 1e-10);
  assert.ok(Math.abs(encoded.w + outer / (inner - outer)) < 1e-10);
  spot.penumbra = 0.0001;
  pass.onBeforeRender(null, scene, null);
  const narrowInner = Math.cos(spot.angle * (1 - spot.penumbra));
  assert.ok(narrowInner - outer < 0.001);
  assert.ok(Math.abs(encoded.z * (narrowInner - outer) - 1) < 1e-12);
  spot.penumbra = 0;
  pass.onBeforeRender(null, scene, null);
  assert.equal(encoded.z, 1 / Number.EPSILON);
});
