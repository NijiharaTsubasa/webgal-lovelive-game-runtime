import assert from 'node:assert/strict';
import test from 'node:test';
import { mouthOpening, mouthSemantics } from '../packages/garupa_runtime/adapters/garupa-mouth-opening.js';

test('speech off stays closed, including the extended angry form', () => {
  for (const form of [-2, -1.5, -1, -.5, 0, .5, 1]) {
    const result = mouthSemantics(0, form, 1);
    assert.equal(result.opening, 0);
    assert.equal(result.closed, 1);
  }
});

test('ordinary speech retains normal opening; extended negative form is preserved', () => {
  assert.ok(mouthOpening(.7, 0) > .6);
  assert.ok(mouthOpening(.7, -1.5) > mouthOpening(.7, -1));
  assert.ok(mouthOpening(.7, -1) < .7);
  assert.ok(mouthOpening(.7, -.5) < mouthOpening(.7, -1));
});

test('scale changes size independently of aperture', () => {
  const small = mouthSemantics(.7, 0, -1);
  const large = mouthSemantics(.7, 0, 1);
  assert.equal(small.opening, large.opening);
  assert.ok(small.sizeGain < 1 && large.sizeGain > 1);
});

test('mouth contour coefficients partition the opening without a round floor', () => {
  for (const form of [-2, -1.5, -1, -.75, -.5, -.25, 0, .25, .5, 1]) {
    for (const open of [0, .125, .5, .7, 1]) {
      const result = mouthSemantics(open, form);
      const sum = result.ordinary + result.smile + result.negativeMid + result.negativeStrong;
      assert.ok(Math.abs(sum - result.opening) < 1e-12);
      assert.ok(Math.abs(sum + result.closed - 1) < 1e-12);
      for (const key of ['opening', 'ordinary', 'smile', 'negativeMid', 'negativeStrong', 'closed']) {
        assert.ok(Number.isFinite(result[key]) && result[key] >= 0 && result[key] <= 1);
      }
    }
  }
});

test('extended negative speaking contour opens horizontally without replacing the closed frown', () => {
  const ordinaryNegative = mouthSemantics(.7, -1);
  const extended = mouthSemantics(.7, -1.5);
  assert.equal(ordinaryNegative.ordinary, 0);
  assert.ok(extended.ordinary > extended.negativeStrong);
  assert.equal(extended.smile, 0);
  assert.equal(extended.closed, 1 - extended.opening);
  assert.equal(mouthSemantics(0, -1.5).ordinary, 0);
  const edge = mouthSemantics(.7, -1 - 1e-7);
  assert.ok(Math.abs(edge.ordinary - ordinaryNegative.ordinary) < 1e-6);
});
