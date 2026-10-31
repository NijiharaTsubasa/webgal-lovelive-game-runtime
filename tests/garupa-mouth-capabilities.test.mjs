import assert from 'node:assert/strict';
import test from 'node:test';
import { discoverMouthCapabilities } from '../packages/garupa_runtime/adapters/garupa-mouth-capabilities.js';

const name = (shape) => `face_main_mouth_${shape}`;
const shapes = ['open_a', 'open_u', 'open_o', 'fun', 'smile', 'joy', 'sad', 'serious', 'wink', 'angry'];
const bindings = (gains = {}) => shapes.map((shape) => ({ name: name(shape), cap: gains[shape] ?? 1 }));
const vector = (values) => Object.fromEntries(Object.entries(values).map(([shape, value]) => [name(shape), value]));

test('semantic avatar groups preserve flat, negative and native smile anchors', () => {
  const result = discoverMouthCapabilities(37, bindings({ joy: .8 }));
  assert.deepEqual(result.anchors, {
    neutral: {}, negativeLandmark: vector({ serious: .5 }),
    negativeEnd: vector({ serious: 1 }), positiveEnd: vector({ joy: .8 }),
  });
  const soyo = discoverMouthCapabilities(39, bindings());
  assert.deepEqual(soyo.anchors.negativeLandmark, vector({ serious: .5 }));
  assert.deepEqual(soyo.anchors.negativeEnd, vector({ serious: 1 }));
  assert.deepEqual(soyo.bases.negativeMidOpen, vector({ angry: 1 }));
  assert.deepEqual(soyo.bases.negativeStrongOpen, vector({ angry: 1 }));
  assert.deepEqual(discoverMouthCapabilities(7, bindings()).anchors.negativeLandmark,
    vector({ sad: .3 }));
});

test('native gains affect open bases once and remain independent from authored closure', () => {
  const result = discoverMouthCapabilities(17, bindings({ open_a: .8, open_u: .6, open_o: .4, fun: .7, sad: .8 }));
  assert.deepEqual(result.bases, {
    ordinaryOpen: vector({ open_a: .8 }), smileOpen: vector({ fun: .7 }),
    negativeMidOpen: vector({ open_o: .4 }), negativeStrongOpen: vector({ open_u: .3, open_o: .2 }),
  });
  assert.deepEqual(result.anchors.negativeLandmark, vector({ serious: .662428, sad: .331214 }));
  assert.deepEqual(result.anchors.negativeEnd, vector({ serious: 1, sad: .5 }));
});

test('group rules combine shared directions without imposing a total weight limit', () => {
  const full = discoverMouthCapabilities(18, bindings());
  assert.deepEqual(full.anchors.negativeEnd, vector({ serious: 1, sad: 1 }));
  const plateau = discoverMouthCapabilities(11, bindings());
  assert.deepEqual(plateau.anchors.negativeLandmark, plateau.anchors.negativeEnd);
  assert.deepEqual(plateau.anchors.negativeEnd, vector({ serious: .588666, sad: .588666 }));
  assert.deepEqual(discoverMouthCapabilities(9, bindings()).anchors.neutral, vector({ sad: .5 }));
});

test('new geometry, package names and vertex ordering do not alter a semantic group', () => {
  const first = bindings().map((binding) => ({ ...binding, object: { name: 'head', geometry: { vertices: [1, 2, 3] } } }));
  const future = bindings().reverse().map((binding) => ({ ...binding,
    object: { name: 'new_avatar', geometry: { vertices: [9, 5, 8, 6] } }, index: 987,
  }));
  assert.deepEqual(discoverMouthCapabilities(34, first), discoverMouthCapabilities(34, future));
});

test('unsupported semantic groups leave capability discovery to the caller', () => {
  for (const id of [undefined, null, 123456, '37', NaN, 1.5]) {
    assert.equal(discoverMouthCapabilities(id, bindings()), null);
  }
});

test('additional Morphs do not change available mouth semantics', () => {
  const original = bindings();
  const extended = [...original, { name: 'face_main_mouth_new_shape', cap: 1 },
    { name: 'eyebrow_angry_L', cap: 1 }];
  assert.deepEqual(discoverMouthCapabilities(2, original), discoverMouthCapabilities(2, extended));
  const missing = discoverMouthCapabilities(2, original.filter((binding) => binding.name !== name('sad')));
  assert.deepEqual(missing.anchors.negativeLandmark, {});
  assert.deepEqual(missing.anchors.negativeEnd, {});
});

test('zero gains and absent native recipe gains retain their distinct meanings', () => {
  const zero = discoverMouthCapabilities(37, bindings({ open_a: 0, joy: 0 }));
  assert.deepEqual(zero.bases.ordinaryOpen, {});
  assert.deepEqual(zero.anchors.positiveEnd, {});
  const noRecipe = shapes.map((shape) => ({ name: name(shape) }));
  assert.deepEqual(discoverMouthCapabilities(37, noRecipe).bases.ordinaryOpen, vector({ open_a: 1 }));
  const repeated = [...bindings({ joy: .4 }), { name: name('joy'), cap: .8 }];
  assert.deepEqual(discoverMouthCapabilities(37, repeated).anchors.positiveEnd, vector({ joy: .8 }));
});

test('native vowel and smile gains remain separate for mixed open smiles', () => {
  const result = discoverMouthCapabilities(38, bindings({ open_a: .8, fun: .4 }));
  assert.deepEqual(result.bases.smileOpen, vector({ open_a: .2, fun: .30000000000000004 }));
  const wink = discoverMouthCapabilities(25, bindings({ wink: .8, smile: .6 }));
  assert.deepEqual(wink.anchors.positiveEnd, vector({ wink: .8 }));
  assert.deepEqual(wink.bases.smileOpen, vector({ smile: .6 }));
});
