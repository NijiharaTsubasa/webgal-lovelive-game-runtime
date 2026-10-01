import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const shader = readFileSync(
  new URL("../packages/hasunosora_runtime/shaders/melpot-toon-hlslmacros.glsl", import.meta.url),
  "utf8",
);

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (x) => x * x * (3 - 2 * x);

// Independent transcription of the retained e007 register sequence, rather
// than calling the port's GLSL function. Inputs include values used by the
// shipped Face material (_2ndShadowFather=0, _1stShadowFather=.01).
function compiledRamp(input, firstStep, firstFather, secondStep, secondFather, borderRange, realStep) {
  const low1 = firstStep - firstFather;
  const high1 = firstStep + firstFather;
  const t1 = clamp01((input - low1) * (1 / (high1 - low1)));
  const s1 = smooth(t1);
  const center2 = (secondStep + 1) * (firstStep + 1) * 0.5 - 1;
  const low2 = center2 - secondFather;
  const high2 = center2 + secondFather;
  const t2 = clamp01((input - low2) * (1 / (high2 - low2)));
  const s2 = smooth(t2);
  const lowBorder = low1 - borderRange;
  const tb = clamp01((input - lowBorder) * (1 / (high1 - lowBorder)));
  return { first: Math.min(realStep, s1), second: s2, border: Math.min(realStep, smooth(tb)) };
}

function portRamp(input, firstStep, firstFather, secondStep, secondFather, borderRange, realStep) {
  const low1 = firstStep - firstFather;
  const high1 = firstStep + firstFather;
  const s1 = smooth(clamp01((input - low1) / (high1 - low1)));
  const center2 = (secondStep + 1) * (firstStep + 1) * 0.5 - 1;
  const s2 = smooth(clamp01((input - center2 + secondFather) / (2 * secondFather)));
  const sb = smooth(clamp01((input - low1 + borderRange) / (high1 - low1 + borderRange)));
  return { first: Math.min(realStep, s1), second: s2, border: Math.min(realStep, sb) };
}

test("HLSLMacros ramp retains source midpoints and zero-second-feather behavior", () => {
  assert.match(shader, /float t1 = clamp\( \( rampInput - low1 \) \/ \( high1 - low1 \)/);
  assert.match(shader, /float t2 = clamp\( \( rampInput - low2 \) \/ \( high2 - low2 \)/);
  for (const input of [-0.82, -0.805, -0.8, -0.795, -0.76, 0.2]) {
    const source = compiledRamp(input, -0.8, 0.01, -1, 0, 0.02, 1);
    const port = portRamp(input, -0.8, 0.01, -1, 0, 0.02, 1);
    assert.ok(Math.abs(source.first - port.first) < 1e-12, `first ${input}`);
    assert.ok(Math.abs(source.second - port.second) < 1e-12, `second ${input}`);
    assert.ok(Math.abs(source.border - port.border) < 1e-12, `border ${input}`);
  }
  assert.equal(compiledRamp(-0.8, -0.8, 0.01, -1, 0, 0.02, 1).first, 0.5);
});

test("HLSLMacros rim uses dot products in tangent space, not a basis-weighted world vector", () => {
  const view = [0.3, 0.4, 0.5];
  const tangent = [0.6, 0.8, 0];
  const bitangent = [-0.8, 0.6, 0];
  const normal = [0, 0, 1];
  const dot = (a, b) => a.reduce((sum, value, index) => sum + value * b[index], 0);
  const source = [dot(view, tangent), dot(view, bitangent), dot(view, normal)];
  assert.deepEqual(source.map((value) => Number(value.toFixed(6))), [0.5, 0, 0.5]);
  assert.match(shader, /dot\( hlslMacrosViewDelta, vHlslMacrosWorldTangent \)/);
  assert.match(shader, /dot\( hlslMacrosViewDelta, vHlslMacrosWorldBitangent \)/);
  assert.match(shader, /dot\( hlslMacrosViewDelta, hlslMacrosGeometricNormal \)/);
});

test("HLSLMacros emission gate uses non-white main-light chroma only after max-combining highlights", () => {
  assert.match(shader, /combinedHighlight \* \( mainLightColor \/ denominator \)/);
  assert.match(shader, /hlslMacrosCombinedHighlight\([\s\S]*?uMainLightColor, uIsShadeEmissionLightColorContribution/);
  const light = [0.2, 0.6, 1.0];
  const highlight = [0.7, 0.4, 0.3];
  const denominator = Math.max(...light) + 1.00000001e-7;
  const emitted = highlight.map((channel, index) => channel * light[index] / denominator);
  assert.ok(Math.abs(emitted[0] - 0.14) < 1e-7);
  assert.ok(Math.abs(emitted[1] - 0.24) < 1e-7);
  assert.ok(Math.abs(emitted[2] - 0.3) < 1e-7);
});

test("HLSLMacros alpha clipping preserves non-endpoint A2C and zero-threshold branches", () => {
  assert.match(shader, /alphaToMaskAvailable != 0\.0 && alphaClipThreshold > 0\.0/);
  assert.match(shader, /abs\( dFdx\( alpha \) \) \+ abs\( dFdy\( alpha \) \)/);
  const sourceClip = (alpha, threshold, a2c, derivativeWidth) => {
    let clip = alpha - threshold;
    if (a2c && threshold > 0) {
      clip = clamp01((clip - derivativeWidth * 0.5) / Math.max(derivativeWidth, 0.0001) + 1) - 0.0001;
    }
    return { discard: clip < 0, outputAlpha: a2c ? alpha : 1 };
  };
  assert.deepEqual(sourceClip(0.4, 0.5, false, 0.2), { discard: true, outputAlpha: 1 });
  assert.deepEqual(sourceClip(0.5, 0.5, true, 0.2), { discard: false, outputAlpha: 0.5 });
  assert.deepEqual(sourceClip(0, 0, true, 0.2), { discard: false, outputAlpha: 0 });
  assert.deepEqual(sourceClip(0.39, 0.5, true, 0.2), { discard: true, outputAlpha: 0.39 });
});

test("HLSLMacros Forward keeps the compiled per-pixel range and spot attenuation", () => {
  assert.match(shader, /distanceSquared = max\( dot\( lightVector, lightVector \), 6\.10351562e-05 \)/);
  assert.match(shader, /rangeTerm = distanceSquared \* uAdditionalLightAttenuation\[ i \]\.x/);
  assert.match(shader, /rangeAttenuation = max\( 1\.0 - rangeTerm \* rangeTerm, 0\.0 \)/);
  assert.match(shader, /rangeAttenuation = rangeAttenuation \* rangeAttenuation \/ distanceSquared/);
  assert.match(shader, /spotAttenuation \*= spotAttenuation/);
  assert.match(shader, /hlslMacrosAdditionalLights\( vHlslMacrosWorldPosition \)/);
  const distanceSquared = 4;
  const rangeTerm = distanceSquared / 100;
  const range = Math.max(1 - rangeTerm * rangeTerm, 0) ** 2 / distanceSquared;
  const spot = Math.min(1, Math.max(0, 0.6 * 2 - 0.5)) ** 2;
  assert.ok(Math.abs(range * spot - 0.1221083136) < 1e-10);
});
