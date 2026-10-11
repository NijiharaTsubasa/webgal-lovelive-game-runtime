import test from 'node:test';
import assert from 'node:assert/strict';
import { auraArcCurve } from '../packages/yohane_runtime/particles/resources/aura-curve.js';

test('Aura curve preserves Unity native half texels and packed sampling domain', () => {
  assert.equal(auraArcCurve.width, 128);
  assert.equal(auraArcCurve.height, 1);
  assert.equal(auraArcCurve.pixels.length, 128);
  assert.deepEqual(Array.from(new Uint32Array(auraArcCurve.Alpha_c.buffer)),
    [481246208, 1065353216, 1056964608, 12]);
  // Non-endpoint texels are direct GPU readbacks of the native BakeCurve atlas.
  assert.equal(auraArcCurve.pixels[0], 0.2205810546875);
  assert.equal(auraArcCurve.pixels[1], 0.41748046875);
  assert.equal(auraArcCurve.pixels[3], 0.84423828125);
  assert.equal(auraArcCurve.pixels[127], 0.2431640625);
});

test('Original clamp and atlas-center transform retain both out-of-range endpoints', () => {
  const sample = age => {
    // Packed half values decode to scale1 and bias0.004573822021484375.
    const t = Math.min(1, Math.max(0, age + 0.004573822021484375));
    const uv = t * 0.9921875 + 0.00390625;
    const index = uv * 128 - 0.5;
    const lower = Math.floor(index);
    const upper = Math.min(127, lower + 1);
    return auraArcCurve.pixels[lower] * (1 - (index - lower)) +
      auraArcCurve.pixels[upper] * (index - lower);
  };
  assert.equal(sample(-2), 0.2205810546875);
  assert.equal(sample(2), 0.2431640625);
  assert.equal(sample((3 / 127) - 0.004573822021484375), 0.84423828125);
});
