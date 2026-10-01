import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const shader = await readFile(
  new URL("../packages/hasunosora_runtime/shaders/melpot-toon.glsl", import.meta.url),
  "utf8",
);

test("CharacterHighlight uses the standard projected depth without a custom offset", async () => {
  const highlight = await readFile(new URL("../packages/hasunosora_runtime/shaders/character-highlight.glsl", import.meta.url), "utf8");
  const config = JSON.parse(await readFile(new URL("../packages/hasunosora_runtime/config.json", import.meta.url), "utf8"));
  const forward = config.components.find(c => c.name === "character-highlight").passes.find(p => p.id === "Forward");
  assert.equal(forward.sections.vertexProject, undefined);
  assert.doesNotMatch(highlight, /\bgl_Position\s*(?:\.|=)/);
});

test("MELPOT vertex basis preserves the compiled Unity transforms", () => {
  assert.match(shader, /melpotWorldToObjectNormal = transpose\( inverse\( melpotModel3 \) \)/);
  assert.match(shader, /melpotWorldToObjectNormal \* objectNormal/);
  assert.match(shader, /determinant\( melpotModel3 \).*\* tangent\.w/);
  assert.match(shader, /vMelpotSphericalNormal = vMelpotWorldNormal \+ uSphericalNormalCorrect/);
  assert.doesNotMatch(shader, /vMelpotSphericalNormal = normalize/);
});

test("MELPOT fragment normals and rim preserve the compiled coordinate operations", () => {
  assert.match(shader, /@section FRAGMENT_PRELUDE\s+#define USE_UV\s+uniform mat4 modelMatrix;/);
  assert.match(shader, /vec3 melpotNtbn = vMelpotWorldTangent \* melpotNm\.x/);
  assert.doesNotMatch(shader, /vec3 melpotNtbn = normalize/);
  assert.match(shader, /transpose\( inverse\( melpotModel3 \) \) \* melpotNtbn/);
  assert.match(shader, /transpose\( melpotModel3 \) \* \( melpotObjectN/);
  assert.match(shader, /dot\( melpotViewDelta, vMelpotWorldTangent \)/);
  assert.match(shader, /dot\( melpotViewTS, melpotNm \)/);
});

test("MELPOT uses the compiled per-slot UV transforms in Forward and Outline", () => {
  assert.match(shader, /vec2 melpotMainUv = vUv \* uMainTex_ST\.xy \+ uMainTex_ST\.zw/);
  assert.match(shader, /texture2D\( uControlMap1, melpotMainUv \)/);
  assert.match(shader, /texture2D\( uDetailMask, melpotDetailUv \)/);
  assert.match(shader, /texture2D\( uGlossMap, melpotGlossUv \)/);
  assert.match(shader, /texture2D\( uUVTexMask, melpotUvMaskUv \)/);
  assert.match(shader, /vec2 melpotOutlineUv = uv \* uMainTex_ST\.xy \+ uMainTex_ST\.zw/);
  assert.match(shader, /texture2D\( uControlMap2, vMelpotOutlineUv \* uMainTex_ST\.xy \+ uMainTex_ST\.zw \)/);
});

test("MELPOT ramp and highlight gates match the compiled shader", () => {
  assert.match(shader, /mix\( melpotRamp1, melpotRamp2, 1\.0 - melpotStep2 \)/);
  assert.doesNotMatch(shader, /melpotStep2 \* melpotStep2/);
  assert.match(shader, /uAffectedRimByShadowStep != 0\.0 \? melpotShadowStepMin : 1\.0/);
  assert.match(shader, /uAffectedSpecularByShadowStep != 0\.0 \? melpotShadowStepMin : 1\.0/);
  assert.match(shader, /abs\( dot\( melpotH, melpotNtbn \) \* 0\.5 \+ 0\.5 \)/);
  assert.match(shader, /\/ uAnisotropicIntensity\.xy/);
  assert.doesNotMatch(shader, /max\( uAnisotropicIntensity\.xy/);
});

test("MELPOT keeps the compiled zero-width ramps and normalization boundaries", () => {
  assert.match(shader, /melpotRadialLengthSquared = max\( dot\( melpotRadialDelta, melpotRadialDelta \), 1\.17549435e-38 \)/);
  assert.match(shader, /melpotRadial = melpotRadialDelta \* inversesqrt\( melpotRadialLengthSquared \)/);
  assert.doesNotMatch(shader, /melpotRadialDelta \+ vec2/);
  assert.match(shader, /melpotInverse1 = 1\.0 \/ \( melpotHigh1 - melpotLow1 \)/);
  assert.match(shader, /melpotT1 = clamp\( melpotInverse1 \* \( melpotInput - melpotLow1 \)/);
  assert.match(shader, /melpotInverse2 = 1\.0 \/ \( melpotHigh2 - melpotLow2 \)/);
  assert.match(shader, /melpotT2 = clamp\( melpotInverse2 \* \( melpotInput - melpotLow2 \)/);
  assert.match(shader, /melpotInverseB = 1\.0 \/ \( melpotHigh1 - melpotLowB \)/);
  assert.match(shader, /melpotTB = clamp\( melpotInverseB \* \( melpotInput - melpotLowB \)/);
  assert.doesNotMatch(shader, /max\( melpotHigh[12] - melpotLow[12B],/);
  assert.match(shader, /normalize\( vMelpotWorldBitangent \+ melpotNbase \* melpotJitter \)/);
});

test("MELPOT additional lights and outline use the compiled composition order", () => {
  assert.match(shader, /uAdditionalLightPosition\[ i \]\.xyz - vMelpotWorldPos \* uAdditionalLightPosition\[ i \]\.w/);
  assert.match(shader, /max\( dot\( melpotLightVector, melpotLightVector \), 6\.10351562e-05 \)/);
  assert.match(shader, /max\( 1\.0 - melpotRangeTerm \* melpotRangeTerm, 0\.0 \)/);
  assert.match(shader, /total \+= uAdditionalLightColor\[ i \]\.rgb \* melpotAttenuation/);
  assert.match(shader, /melpotLightColor \+= melpotAdditionalLightsColor\(\)/);
  assert.doesNotMatch(shader, /directionalLights\[ i \]\.color/);
  assert.doesNotMatch(shader, /melpotAddShaded/);
  assert.match(shader, /melpotOutLightColor = max\( melpotOutLightColor, max\( melpotOutAmbient, vec3\( 0\.1 \) \) \)/);
  assert.match(shader, /melpotOutCol = melpotOutShadowed \* melpotOutLightColor \* uAmbientColor\.rgb/);
  assert.match(shader, /melpotAlphaClipValue\( melpotAlpha \) < 0\.0/);
  assert.match(shader, /melpotAlphaClipValue\( melpotOutAlpha \) < 0\.0/);
  assert.match(shader, /diffuseColor\.a = uAlphaToMaskAvailable != 0\.0 \? melpotAlpha : 1\.0;/);
  assert.match(shader, /diffuseColor\.a = uAlphaToMaskAvailable != 0\.0 \? melpotOutAlpha : 1\.0;/);
  assert.doesNotMatch(shader, /#ifdef ALPHA_TO_COVERAGE/);
});

test("MELPOT alpha clipping retains the compiled derivative and zero-threshold branches", () => {
  assert.match(shader, /abs\( dFdx\( alpha \) \) \+ abs\( dFdy\( alpha \) \)/);
  assert.match(shader, /if \( threshold <= 0\.0 \) return alpha - threshold/);
  assert.match(shader, /clamp\( \( alpha - threshold - width \* 0\.5 \) \/ max\( width, 9\.99999975e-05 \) \+ 1\.0, 0\.0, 1\.0 \) - 9\.99999975e-05/);
});

