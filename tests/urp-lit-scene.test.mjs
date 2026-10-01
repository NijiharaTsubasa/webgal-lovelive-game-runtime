import assert from "node:assert/strict";
import test from "node:test";
import UrpLitRuntime from "../packages/hasunosora_runtime/shaders/urp-lit.js";
import { readFileSync } from "node:fs";

const shader = readFileSync(new URL(
  "../packages/hasunosora_runtime/shaders/urp-lit.glsl", import.meta.url,
), "utf8");

class Vector3 {
  constructor(x = 0, y = 0, z = 0) { this.set(x, y, z); }
  set(x, y, z) { Object.assign(this, { x, y, z }); return this; }
  subVectors(a, b) { return this.set(a.x - b.x, a.y - b.y, a.z - b.z); }
  normalize() {
    const length = Math.hypot(this.x, this.y, this.z);
    if (length) this.set(this.x / length, this.y / length, this.z / length);
    return this;
  }
  transformDirection() { return this.normalize(); }
  applyMatrix4() { return this; }
}
class Vector4 {
  constructor(x = 0, y = 0, z = 0, w = 0) { this.set(x, y, z, w); }
  set(x, y, z, w) { Object.assign(this, { x, y, z, w }); return this; }
}
class Color {
  constructor(r = 0, g = 0, b = 0) { this.setRGB(r, g, b); }
  setRGB(r, g, b) { Object.assign(this, { r, g, b }); return this; }
  copy(other) { return this.setRGB(other.r, other.g, other.b); }
  multiplyScalar(scalar) { return this.setRGB(this.r * scalar, this.g * scalar, this.b * scalar); }
  add(other) { return this.setRGB(this.r + other.r, this.g + other.g, this.b + other.b); }
}
class Matrix4 { constructor() { this.isMatrix4 = true; } copy() { return this; } }

const THREE = { Vector3, Vector4, Color, Matrix4 };
const camera = { matrixWorldInverse: {}, updateMatrixWorld() {} };
const main = {
  isLight: true, isDirectionalLight: true, visible: true, castShadow: false,
  color: new Color(1, 0.5, 0.25), intensity: 2,
  getWorldPosition(target) { return target.set(0, 2, 0); },
  target: { getWorldPosition(target) { return target.set(0, 0, 0); } },
};
const ambient = {
  isLight: true, isAmbientLight: true, visible: true,
  color: new Color(0.1, 0.2, 0.3), intensity: 0.5,
};
function scene(lights, environment = null) {
  return { environment, userData: {}, traverse(visitor) { lights.forEach(visitor); } };
}

test("URP Lit maps only the supported current-scene globals", () => {
  const pass = new UrpLitRuntime(THREE, null, {}, { receiveShadow: false });
  pass.onBeforeRender(null, scene([{ ...main, castShadow: true }, ambient]), camera);
  assert.deepEqual(pass.getUniforms().uUrpMainLightDirectionView.value,
    new Vector3(0, 1, 0));
  assert.deepEqual(pass.getUniforms().uUrpMainLightColor.value,
    new Color(2, 1, 0.5));
  assert.deepEqual(pass.getUniforms().uUrpBakedGI.value,
    new Color(0.05, 0.1, 0.15));
});

test("URP Lit maps source attenuation inputs for an unshadowed point light", () => {
  const point = {
    isLight: true, isPointLight: true, visible: true, castShadow: false,
    color: new Color(0.5, 1, 0.25), intensity: 2, distance: 5,
    getWorldPosition(target) { return target.set(1, 2, 3); },
  };
  const pass = new UrpLitRuntime(THREE, null, {}, { receiveShadow: true });
  pass.onBeforeRender(null, scene([main, point]), camera);
  const uniforms = pass.getUniforms();
  assert.equal(uniforms.uUrpAdditionalLightCount.value, 1);
  assert.deepEqual(uniforms.uUrpAdditionalLightPositionView.value[0], new Vector4(1, 2, 3, 1));
  assert.deepEqual(uniforms.uUrpAdditionalLightAttenuation.value[0], new Vector4(1 / 25, 1, 0, 1));
  assert.deepEqual(uniforms.uUrpAdditionalLightColor.value[0], new Vector4(1, 2, 0.5, 1));
});

test("URP Lit accepts a scene without a main light and sums ambient inputs", () => {
  const pass = new UrpLitRuntime(THREE, null, {}, { receiveShadow: false });
  const a = { ...ambient, color: new Color(0.1, 0.2, 0.3), intensity: 2 };
  const b = { ...ambient, color: new Color(0.2, 0.1, 0.4), intensity: 1 };
  pass.onBeforeRender(null, scene([a, b]), camera);
  assert.deepEqual(pass.getUniforms().uUrpMainLightColor.value, new Color(0, 0, 0));
  assert.deepEqual(pass.getUniforms().uUrpBakedGI.value, new Color(0.4, 0.5, 1));
});

test("URP Lit maps a linear Three cubemap to the compiled reflection BRDF", () => {
  const material = {};
  const pass = new UrpLitRuntime(THREE, null, material, { receiveShadow: false });
  const cubemap = { isCubeTexture: true };
  pass.onBeforeRender(null, scene([main], cubemap), camera);
  assert.equal(material.defines.URP_REFLECTION_PROBE, 1);
  assert.equal(pass.getUniforms().uUrpReflectionProbe.value, cubemap);
  assert.deepEqual(pass.getUniforms().uUrpReflectionHDR.value, new Vector4(1, 1, 0, 1));
  pass.onBeforeRender(null, scene([main]), camera);
  assert.equal(material.defines.URP_REFLECTION_PROBE, undefined);
  assert.match(shader, /textureCube\( uUrpReflectionProbe, urpReflectionWS, urpReflectionMip \)/);
  assert.match(shader, /urpProbeSample\.a \* uUrpReflectionHDR\.w/);
  assert.match(shader, /urpReflectionMip = urpPerceptualRoughness \*/);
  assert.match(shader, /urpIndirectSpecular = urpProbeSample\.rgb \* urpProbeDecode \* urpEnvironmentBrdf/);
});

test("URP Lit maps a spotlight cone", () => {
  const spot = {
    isLight: true, isSpotLight: true, visible: true, castShadow: false,
    uuid: "spot-test",
    color: new Color(1, 1, 1), intensity: 1, distance: 6,
    angle: 0.7, penumbra: 0.2,
    getWorldPosition(target) { return target.set(0, 0, 3); },
    target: { getWorldPosition(target) { return target.set(0, 0, 0); } },
  };
  const pass = new UrpLitRuntime(THREE, null, {}, { receiveShadow: true });
  pass.onBeforeRender(null, scene([main, spot]), camera);
  const attenuation = pass.getUniforms().uUrpAdditionalLightAttenuation.value[0];
  const outer = Math.cos(spot.angle);
  const inner = Math.cos(spot.angle * (1 - spot.penumbra));
  assert.equal(attenuation.z, 1 / (inner - outer));
  assert.equal(attenuation.w, -outer / (inner - outer));
  assert.deepEqual(pass.getUniforms().uUrpAdditionalLightSpotDirView.value[0],
    new Vector4(0, 0, 1, 0));
});

test("URP Lit does not silently approximate unsupported scene lighting", () => {
  const pass = new UrpLitRuntime(THREE, null, {}, { receiveShadow: true });
  const point = { isLight: true, isPointLight: true, visible: true,
    color: new Color(1, 1, 1), intensity: 1, distance: 0,
    getWorldPosition(target) { return target.set(1, 2, 3); } };
  pass.onBeforeRender(null, scene([main, point]), camera);
  assert.equal(pass.getUniforms().uUrpAdditionalLightAttenuation.value[0].x, 0);
  assert.throws(() => pass.onBeforeRender(null, scene([main], {}), camera),
    /CubeTexture/);
  const cookiePoint = {
    isLight: true, isPointLight: true, visible: true, castShadow: false,
    cookie: {}, map: {}, color: new Color(1, 1, 1), intensity: 1, distance: 2,
    getWorldPosition(target) { return target.set(1, 1, 1); },
  };
  assert.doesNotThrow(() => pass.onBeforeRender(null, scene([main, cookiePoint]), camera));
  pass.onBeforeRender(null, scene([main]), { ...camera, isOrthographicCamera: true });
  assert.equal(pass.getUniforms().uUrpOrthographic.value, true);
  assert.match(shader, /uUrpOrthographic \? vec3\( 0\.0, 0\.0, 1\.0 \)/);
  const textured = new UrpLitRuntime(THREE, null, { map: {} }, { receiveShadow: false });
  assert.doesNotThrow(() => textured.onBeforeRender(null, scene([main]), camera));
});
