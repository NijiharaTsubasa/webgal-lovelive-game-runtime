import test from 'node:test';
import assert from 'node:assert/strict';
import { Matrix4, Vector3 } from 'three';
import { createAuraArcParameters, createAuraArcSimulation, auraHash, auraRandom } from '../packages/yohane_runtime/particles/aura-arc-simulation.js';
const fixed = 0.01666666753590107;
function fixture(properties = {}, seed = 12345, matrix = new Matrix4()) {
  const parameters = createAuraArcParameters({ seed, vertexCount: 4, channelInfo: 3 << 8,
    localToWorld: Float32Array.from(matrix.elements), worldToLocal: Float32Array.from(matrix.clone().invert().elements), properties });
  const samples = [[-1, 0, 0], [1, 1, 0], [0, 2, 1], [1, -1, -1]];
  return createAuraArcSimulation({ seed, parameters, samplePosition(index, out) { out.set(samples[index]); } });
}
function run(sim, count) { for (let i = 0; i < count; i++) sim.advance(fixed); return sim; }
test('original integer hash boundary vectors and float mantissa conversion', () => {
  for (const x of [0, 1, 9, 0x7fffffff, 0x80000000, 0xffffffff]) {
    let y = BigInt(x); y = ((y ^ (y >> 16n)) * 73244475n) & 0xffffffffn;
    y = ((y ^ (y >> 16n)) * 73244475n) & 0xffffffffn; y ^= y >> 16n;
    assert.equal(auraHash(x), Number(y));
    assert.equal(auraRandom(x), Number(y >> 9n) / 8388608);
  }
});
for (const ArcRate of [0, 1, 2]) for (const Amount of [0, 0.3, 1]) {
  test(`graph constant-rate spawner ArcRate=${ArcRate}, Amount=${Amount}`, () => {
    const sim = run(fixture({ ArcRate, Amount }), 60);
    // Sixty float32 additions of 1/60 produce 0.999999702, so the 1 Hz spawn occurs on frame 61.
    const expected = ArcRate === 1 && Amount === 1 ? 0 : Math.floor(Math.fround(Math.fround(ArcRate) * Math.fround(Amount)) * fixed * 60);
    assert.equal(sim.trajectoryCount, expected);
    if (ArcRate === 1 && Amount === 1) { sim.advance(fixed); assert.equal(sim.trajectoryCount, 1); }
    if (!ArcRate || !Amount) assert.equal(sim.activeStripCount, 0);
  });
}
test('trajectory initializes at age zero then events copy current Bezier position and progression', () => {
  const sim = fixture({ ArcRate: 60, ArcSegments: 60 });
  sim.step(fixed);
  assert.equal(sim.trajectoryAttributes[1], 0); assert.equal(sim.trajectoryAttributes[4098], 1);
  assert.equal(sim.trajectoryFloats[0], 1);
  assert.equal(sim.trajectoryFloats[4097], Math.fround(fixed));
  assert.equal(sim.eventCount, 1); assert.equal(sim.events[0], 0);
  assert.equal(sim.stripData[1], 1); assert.equal(sim.stripData[2], 1);
  assert.equal(sim.lineFloats[512003], 2); assert.equal(sim.lineFloats[512000], 0);
  assert.equal(sim.lineAttributes[3], 1);
  assert.equal(sim.bounds.some(x => x !== 0), true);
});
test('strict lifetime comparison includes equality; death preserves previous source position', () => {
  const sim = fixture({ ArcRate: 60, ArcSegments: 60 }); sim.step(fixed); sim.stop();
  sim.trajectoryFloats[4097] = 0.75;
  sim.step(0.25); assert.equal(sim.trajectoryAttributes[4098], 1);
  const before = sim.trajectoryFloats.slice(12288, 12291);
  sim.step(0.001); assert.equal(sim.trajectoryAttributes[4098], 0);
  assert.deepEqual(sim.trajectoryFloats.slice(12288, 12291), before);
  run(sim, 190); assert.equal(sim.trajectoryCount, 0); assert.equal(sim.activeStripCount, 0);
  assert.equal(sim.stripData[3], 0xfffffffe);
});
test('fixed clock batches N steps into one dispatch, cap and zero dt are preserved', () => {
  for (const n of [0, 1, 2, 3]) {
    const a = fixture({ ArcRate: 60 }), b = fixture({ ArcRate: 60 });
    a.advance(n * fixed); if (n) b.step(Math.fround(n * fixed));
    assert.deepEqual(a.trajectoryAttributes, b.trajectoryAttributes);
  }
  const sim = fixture(); sim.step(0); assert.equal(sim.time, 0);
  sim.advance(10); assert.equal(sim.time, Math.fround(3 * fixed));
});
test('OnStop drains existing particles, pause freezes state, reinitialize restores allocator and seed', () => {
  const sim = run(fixture(), 60); sim.stop(); run(sim, 200);
  assert.equal(sim.activeStripCount, 0); assert.equal(sim.trajectoryCount, 0);
  sim.play(); run(sim, 60); assert.ok(sim.activeStripCount > 0);
  sim.pause(); const before = sim.lineAttributes.slice(); sim.advance(0.05);
  assert.deepEqual(sim.lineAttributes, before); sim.resume();
  sim.reinitialize(12345); const expected = run(fixture(), 60); run(sim, 60);
  assert.deepEqual(sim.trajectoryAttributes, expected.trajectoryAttributes);
  assert.deepEqual(sim.lineAttributes, expected.lineAttributes);
});
test('ring wrap and parent reuse do not retain dead strip points', () => {
  const sim = fixture({ ArcRate: 1, ArcSegments: 300 });
  run(sim, 2000); assert.ok(sim.activeStripCount > 0 && sim.activeStripCount <= 4);
  for (let i = 0; i < sim.activeStripCount; i++) {
    const h = sim.activeStripIds[i] * 5; assert.ok(sim.stripData[h] < 64);
    assert.ok(sim.stripData[h + 2] <= 64);
  }
});
test('non-unit transforms preserve world trajectory and expression field inverse', () => {
  const matrix = new Matrix4().makeRotationY(0.37).scale(new Vector3(2, 0.5, 1.3)).setPosition(4, -2, 1);
  const sim = fixture({ ArcRate: 60, ArcSegments: 0 }, 12345, matrix);
  sim.step(fixed);
  const source = new Vector3(...[[-1, 0, 0], [1, 1, 0], [0, 2, 1], [1, -1, -1]][Math.trunc(auraRandom(12344) * 4)]).applyMatrix4(matrix);
  for (let c = 0; c < 3; c++) assert.ok(Math.abs(sim.trajectoryFloats[12288 + c] - source.toArray()[c]) < 1e-6);
  sim.parameters.setTime(13.7);
  const product = new Matrix4().fromArray(sim.parameters.fieldTransform).multiply(new Matrix4().fromArray(sim.parameters.inverseFieldTransform));
  for (let i = 0; i < 16; i++) assert.ok(Math.abs(product.elements[i] - (i % 5 === 0 ? 1 : 0)) < 1e-5);
});
test('lineInitialize fails explicitly at original out-of-capacity strip index', () => {
  const sim = fixture({ ArcRate: 1200, ArcSegments: 60 });
  assert.throws(() => sim.step(1), /strip 1000/);
});
test('OnStop then Reinit sends InitialEvent OnPlay; exposed Amount changes affect next spawn', () => {
  const sim = fixture({ Amount: 0 }); run(sim, 60); assert.equal(sim.trajectoryCount, 0);
  sim.parameters.setProperties({ Amount: 1, ArcRate: 2 }); run(sim, 60);
  assert.equal(sim.trajectoryCount, 2);
  sim.stop(); sim.reinitialize(); run(sim, 60); assert.equal(sim.trajectoryCount, 2);
});
