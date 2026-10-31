import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { resolveEyeCapabilities } from '../packages/garupa_runtime/adapters/garupa-eye-capabilities.js';

function fixture({ fun = .4, joy = .2, relative = true, cap = 1, order = false } = {}) {
  const positions = [-.5, -.1, .1, .5].flatMap((x) => [[x, -.5, 0], [x, .5, 0]]);
  if (order) positions.reverse();
  const geometry = new THREE.BufferGeometry();
  geometry.morphTargetsRelative = relative;
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions.flat(), 3));
  const shapes = { close: -1, wink: -1, joy, fun, angry: -.3, sad: -.1 };
  const bindings = [];
  for (const side of ['L', 'R']) for (const prefix of ['face_main_eye_', 'eyelash_']) for (const [shape, amount] of Object.entries(shapes)) {
    const name = prefix + (prefix === 'eyelash_' && shape === 'close' ? 'eye_close' : shape) + '_' + side;
    const index = bindings.length;
    geometry.morphAttributes.position ??= [];
    geometry.morphAttributes.position.push(new THREE.Float32BufferAttribute(positions.flatMap(([x, y, z]) => relative ? [0, y * amount, 0] : [x, y + y * amount, z]), 3));
    bindings.push({ geometry, index, name, cap, channel: { region: 'eye', side, shape } });
  }
  return { part: { component: {} }, bindings };
}

test('eye widening and narrowing are selected from measured native gap direction', () => {
  const f = fixture(), result = resolveEyeCapabilities(f.part, f.bindings);
  assert.equal(result.L.close.face_main_eye_close_L, 1);
  assert.equal(result.L.closedSmile.eyelash_wink_L, 1);
  assert.equal(result.L.wide.face_main_eye_fun_L, 1);
  assert.ok(result.L.formNegative.face_main_eye_angry_L > 0);
  assert.ok(result.L.formPositive.face_main_eye_fun_L > 0);
  assert.ok(result.L.openSmile.face_main_eye_joy_L > 0);
  assert.equal(resolveEyeCapabilities(f.part, f.bindings), result);
});

test('a same-named Morph that narrows the eye is not used for widening', () => {
  const f = fixture({ fun: -.4 });
  const result = resolveEyeCapabilities(f.part, f.bindings);
  assert.equal(result.L.wide.face_main_eye_joy_L, 1);
  assert.equal(result.L.wide.face_main_eye_fun_L, undefined);
  const none = fixture({ fun: -.4, joy: -.2 });
  assert.deepEqual(resolveEyeCapabilities(none.part, none.bindings).L.wide, {});
});

test('native zero smile uses a measured small wink without relying on model identity', () => {
  const f = fixture({ joy: 0 });
  const result = resolveEyeCapabilities(f.part, f.bindings);
  assert.ok(result.L.openSmile.face_main_eye_wink_L > .06);
  assert.ok(result.L.openSmile.face_main_eye_wink_L < .07);
});

test('vertex reordering and equivalent absolute Morph storage preserve capabilities', () => {
  const f = fixture(), reordered = fixture({ order: true }), absolute = fixture({ relative: false });
  const a = resolveEyeCapabilities(f.part, f.bindings);
  for (const other of [reordered, absolute]) {
    const b = resolveEyeCapabilities(other.part, other.bindings);
    for (const side of ['L', 'R']) for (const key of Object.keys(a[side])) {
      assert.deepEqual(Object.keys(b[side][key]), Object.keys(a[side][key]));
      for (const name of Object.keys(a[side][key])) assert.ok(Math.abs(a[side][key][name] - b[side][key][name]) < 1e-6);
    }
  }
});

test('a missing eye field remains empty and does not borrow another region', () => {
  const part = { component: {} };
  assert.deepEqual(resolveEyeCapabilities(part, []).L, {
    close: {}, closedSmile: {}, openSmile: {}, wide: {}, formNegative: {}, formPositive: {},
  });
});

test('subpixel offsets do not split equal-height contour vertices into a different eye family', () => {
  const original = fixture(), changed = fixture();
  for (const f of [original, changed]) for (const binding of f.bindings) {
    if (binding.channel.shape !== 'angry') continue;
    const base = binding.geometry.attributes.position;
    const delta = binding.geometry.morphAttributes.position[binding.index];
    for (let i = 0; i < base.count; i++) delta.setY(i, base.getY(i) * Math.sign(base.getX(i)) * .2);
  }
  const position = changed.bindings[0].geometry.attributes.position;
  for (let i = 0; i < position.count; i++) {
    position.setY(i, position.getY(i) + 1e-7 * Math.sign(position.getY(i)) * Math.sign(position.getX(i)));
  }
  const before = resolveEyeCapabilities(original.part, original.bindings);
  const after = resolveEyeCapabilities(changed.part, changed.bindings);
  assert.deepEqual(after, before);
  assert.ok(before.L.formNegative.face_main_eye_sad_L > 0);
});
