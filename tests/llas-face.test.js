import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import Face, { evaluateBinding, sampleVisibility } from '../packages/llas_runtime/behaviors/face.js';
import { MotionPlayer } from 'webgal-lovelive-gltf-renderer/motion-player.js';

function binding(property = 'scale') {
  return { node: 'Eye', property, default: [1, 1, 1], poses: [
    { name: 'eye/Close', value: [1, 0.5, 1] },
    { name: 'eye/Angry', value: [1, 0.75, 1] },
  ] };
}

function visibility() {
  return { node: 'WhiteLine', property: 'visible', default: false,
    poses: [{ name: 'eye/Close', length: 1, curve: [[0, 0, 0, 0, 0], [1, 0, 0, 0, 1]] }] };
}

test('exported ordinary faces use game-initialized hidden WhiteLine defaults, not prefab enabled flags', t => {
  const samples = ['ch0001_co0002_member', 'ch0005_co0002_member', 'ch0009_co0005_member'].map(id =>
    [id, new URL(`./fixtures/expression-samples/llas/${id}/config.json`, import.meta.url)]);
  if (samples.some(([, path]) => !fs.existsSync(path))) {
    t.skip('requires existing LLAS small-sample conversions');
    return;
  }
  for (const [id, path] of samples) {
    const config = JSON.parse(fs.readFileSync(path, 'utf8'));
    const bindings = config.components[0].behaviors.find(b => b.name === 'LLAS.Face').parameters.bindings;
    for (const name of ['LeftEyeWhiteLine', 'RightEyeWhiteLine']) {
      const binding = bindings.find(b => b.node === name && b.property === 'visible');
      assert.equal(binding.default, false, `${id}/${name}: Navi initialization disables display_OnOff renderers`);
      for (const weights of [{}, { 'eye/Open': 1 }, { 'eye/Closish': 1 }, { 'eye/Close': .5 }, { 'eye/Close': .99 }, { 'eye/Close': .99998 }]) {
        assert.equal(evaluateBinding(binding, weights), false, `${id}/${name}: incomplete close must not inherit prefab visibility`);
      }
      assert.equal(evaluateBinding(binding, { 'eye/Close': 1 }), true, `${id}/${name}: fully closed highlight remains`);
      assert.equal(evaluateBinding(binding, { 'eye/CloseSmile': 1 }), true);
    }
  }
});

function setup(bindings = [binding(), visibility()], initialize = true) {
  const nodes = { Eye: new THREE.Object3D(), WhiteLine: new THREE.Object3D(), Other: new THREE.Object3D() };
  nodes.Eye.position.set(2, 3, 4);
  nodes.Eye.morphTargetInfluences = [0.6];
  let state = null;
  const context = {
    getExpressionDefinition: role => {
      assert.equal(role, 'integrated');
      return { morphPoses: ['eye/Close', 'eye/Angry', 'eye/Open'].map(name => ({ name, targets: {} })) };
    },
    getExpressionState: role => { assert.equal(role, 'integrated'); return state; },
    resolveNode: (role, name) => { assert.equal(role, 'integrated'); return nodes[name]; },
  };
  const face = new Face(context, [{ role: 'integrated', parameters: { bindings } }]);
  if (initialize) face.Awake();
  return { face, nodes, context, setState: value => { state = value; } };
}

test('face mixing uses per-property positive weights and unnormalized default residual', () => {
  const data = binding();
  assert.deepEqual(evaluateBinding(data, { 'eye/Close': 0.25 }), [1, 0.875, 1]);
  assert.deepEqual(evaluateBinding(data, { 'eye/Close': 0.25, 'eye/Angry': 0.25 }), [1, 0.8125, 1]);
  assert.deepEqual(evaluateBinding(data, { 'eye/Close': 2 }), [2, 1, 2]);
  assert.deepEqual(evaluateBinding(data, { 'eye/Close': -2, 'eye/Open': 1 }), [1, 1, 1]);
  assert.deepEqual(evaluateBinding(data, { 'custom/unknown': 100 }), [1, 1, 1]);
  // A recipe that does not animate this property consumes none of its weight.
  assert.deepEqual(evaluateBinding(data, { 'eye/Close': 0.25, 'eye/Open': 0.75 }), [1, 0.875, 1]);
});

test('face quaternions use ordered hemisphere alignment and normalize only the result', () => {
  const data = { property: 'quaternion', default: [0, 0, 0, 1], poses: [
    { name: 'a', value: [0, 0, 1, 0] }, { name: 'b', value: [0, 0, -1, 0] },
  ] };
  assert.deepEqual(evaluateBinding(data, { a: 0.25, b: 0.75 }), [0, 0, 1, 0]);
  assert.deepEqual(evaluateBinding(data, { a: 3 }), [0, 0, 1, 0]);
  data.poses = [{ name: 'a', value: [0, 0, 0, -1] }];
  assert.deepEqual(evaluateBinding(data, { a: 0.25 }), [0, 0, 0, -1]);
  data.poses = [{ name: 'a', value: [0, 0, 1, 0] }];
  const half = evaluateBinding(data, { a: 0.5 });
  assert.ok(Math.abs(half[2] - Math.SQRT1_2) < 1e-12);
  assert.ok(Math.abs(half[3] - Math.SQRT1_2) < 1e-12);
});

test('face evaluator matches recorded real Unity mixer probes, including default hemisphere flip', () => {
  // Recorded by LlasTrsMixProbe.cs; retain the numeric oracle here so this
  // regression does not depend on disposable .tmp probe reports or Unity.
  const position = { property: 'position', default: [3, 5, 7], poses: [
    { name: 'A', value: [11, 13, 17] }, { name: 'B', value: [-7, 23, 19] },
  ] };
  const scale = { property: 'scale', default: [1.25, 0.75, 2], poses: [
    { name: 'A', value: [2, 3, 4] }, { name: 'B', value: [5, 7, 11] },
  ] };
  const close = (actual, expected, tolerance = 2e-6) => actual.forEach((value, i) => {
    assert.ok(Math.abs(value - expected[i]) < tolerance, `${value} != ${expected[i]}`);
  });
  close(evaluateBinding(position, { A: 0.1, B: 0.2, 'rotation-only': 0.3 }),
    [1.7999999523162842, 9.399999618530273, 10.399999618530273]);
  close(evaluateBinding(scale, { A: 0.7, B: 0.8, 'rotation-only': 0.9 }),
    [5.400000095367432, 7.699999809265137, 11.600000381469727]);
  const rotation = { property: 'quaternion',
    default: [0.12767943739891052, 0.14487813413143158, 0.23929832875728607, 0.9515485167503357],
    poses: [
      { name: 'positive-120', value: [0.866025447845459, 0, 0, 0.4999999701976776] },
      { name: 'negative-120', value: [-0.866025447845459, 0, 0, 0.4999999701976776] },
      { name: 'identity', value: [0, 0, 0, 1] },
    ],
  };
  close(evaluateBinding(rotation, { 'positive-120': 0.1, 'negative-120': 0.2, identity: 0.3 }),
    [0.27177491784095764, -0.0754527598619461, -0.12462694942951202, -0.9512693881988525], 2e-7);
});

test('visibility evaluates original cubic coefficients at float32 synchronized time', () => {
  const pose = { length: 2, curve: [[0, 2, 3, 4, 5], [1, 0, 0, 0, 1]] };
  assert.equal(sampleVisibility(pose, 0.25), 8);
  assert.equal(sampleVisibility(pose, 0.5), 1);
  assert.equal(sampleVisibility(pose, 2), 1);
  const linear = { property: 'visible', default: false, poses: [{ name: 'a', length: 1, curve: [[0, 0, 0, 1, 0]] }] };
  assert.equal(evaluateBinding(linear, { a: 0.02 }), false);
  assert.equal(evaluateBinding(linear, { a: 0.04 }), true);
});

test('visibility uses the native strict absolute float32 threshold after blending', () => {
  const data = { property: 'visible', default: false, poses: [{ name: 'a', length: 1, curve: [[0, 0, 0, 0, 1]] }] };
  const threshold = Math.fround(0.001);
  assert.equal(evaluateBinding(data, { a: threshold }), false);
  assert.equal(evaluateBinding(data, { a: Math.fround(threshold + 1e-9) }), true);
  assert.equal(evaluateBinding(data, { a: -1 }), false);
  data.poses[0].curve[0][4] = -1;
  assert.equal(evaluateBinding(data, { a: 0.1 }), true);
  data.default = true;
  assert.equal(evaluateBinding(data, {}), true);
});

test('face initializes source visibility and writes only its declared properties', () => {
  const { face, nodes, setState } = setup();
  assert.equal(nodes.WhiteLine.visible, false);
  face.LateUpdate();
  assert.equal(nodes.WhiteLine.visible, false);
  setState({ active: true, poseWeights: { 'eye/Close': 1 } });
  face.LateUpdate();
  assert.equal(nodes.Eye.scale.y, 0.5);
  assert.equal(nodes.WhiteLine.visible, true);
  assert.deepEqual(nodes.Eye.position.toArray(), [2, 3, 4]);
  assert.deepEqual(nodes.Eye.quaternion.toArray(), [0, 0, 0, 1]);
  assert.deepEqual(nodes.Eye.morphTargetInfluences, [0.6]);
  assert.equal(nodes.Other.visible, true);
});

test('face releases its previous override before motion and never overwrites inactive motion frames', () => {
  const { face, nodes, setState } = setup();
  setState({ active: true, poseWeights: { 'eye/Close': 1 } });
  face.LateUpdate();
  face.Update();
  assert.equal(nodes.Eye.scale.y, 1);
  nodes.Eye.scale.y = 0.8; // Motion now owns the base value.
  nodes.WhiteLine.visible = true;
  face.LateUpdate();
  assert.equal(nodes.Eye.scale.y, 0.5);
  face.Update();
  assert.equal(nodes.Eye.scale.y, 0.8);
  nodes.Eye.scale.y = 0.7;
  setState({ active: false, poseWeights: {} });
  face.LateUpdate();
  assert.equal(nodes.Eye.scale.y, 0.7);
  face.Update();
  nodes.Eye.scale.y = 0.6;
  face.LateUpdate();
  face.OnDisable();
  face.OnDestroy();
  assert.equal(nodes.Eye.scale.y, 0.6);
  assert.equal(nodes.WhiteLine.visible, true);
});

test('debug toggle and repeated immediate evaluations restore underlay without stacking', () => {
  const { face, nodes, setState } = setup();
  nodes.Eye.scale.y = 0.8;
  setState({ active: true, poseWeights: { 'eye/Close': 1 } });
  face.LateUpdate();
  setState({ active: true, poseWeights: { 'eye/Angry': 1 } });
  face.LateUpdate();
  assert.equal(nodes.Eye.scale.y, 0.75);
  face.setEnabled(false);
  assert.equal(nodes.Eye.scale.y, 0.8);
  nodes.Eye.scale.y = 0.9;
  face.LateUpdate();
  assert.equal(nodes.Eye.scale.y, 0.9);
  face.setEnabled(true);
  face.LateUpdate();
  face.OnDestroy();
  assert.equal(nodes.Eye.scale.y, 0.9);
  assert.throws(() => face.setEnabled(1), /boolean/);
});

test('face validates every declaration and target before any initialization writes', () => {
  assert.throws(() => new Face({}, []), /integrated declaration/);
  assert.throws(() => new Face({}, [{ role: 'head' }]), /integrated declaration/);
  for (const invalid of [
    { ...binding(), node: 'Missing' },
    { ...binding(), property: 'rotation' },
    { ...binding(), default: [1, NaN, 1] },
    { ...binding(), poses: [{ name: 'missing', value: [1, 1, 1] }] },
    { ...binding(), poses: [{ name: 'eye/Close', value: [1, 1] }] },
    { ...visibility(), poses: [{ name: 'eye/Close', length: 0, curve: [[0, 0, 0, 0, 1]] }] },
    { ...visibility(), poses: [{ name: 'eye/Close', length: 1, curve: [[1, 0, 0, 0, 1]] }] },
  ]) {
    const { face, nodes } = setup([visibility(), invalid], false);
    assert.equal(nodes.WhiteLine.visible, true);
    assert.throws(() => face.Awake(), /LLAS.Face/);
    assert.equal(nodes.WhiteLine.visible, true);
    assert.deepEqual(nodes.Eye.scale.toArray(), [1, 1, 1]);
  }
  const duplicate = setup([binding(), binding()], false);
  assert.throws(() => duplicate.face.Awake(), /duplicate target/);
});

test('invalid numeric input fails before writing scene properties', () => {
  const { face, nodes, setState } = setup();
  for (const weight of [NaN, Infinity, Number.MAX_VALUE]) {
    setState({ active: true, poseWeights: { 'eye/Close': weight } });
    assert.throws(() => face.LateUpdate(), /LLAS.Face/);
    assert.deepEqual(nodes.Eye.scale.toArray(), [1, 1, 1]);
    assert.equal(nodes.WhiteLine.visible, false);
  }
  const overflow = binding();
  overflow.poses[0].value = [3e38, 3e38, 3e38];
  assert.throws(() => evaluateBinding(overflow, { 'eye/Close': 2 }), /non-finite/);
});

function faceMotion({ rotation = [0, 0, 0, 1], groupTracks = [] } = {}) {
  return {
    clips: [{ id: 'idle', duration: 1, sampleRate: 1, frames: 2,
      tracks: [{ bone: 'LeftEye', rotation: [...rotation, ...rotation] }], groupTracks }],
    auxiliaryClips: [], leftHandPoses: [], rightHandPoses: [],
    program: { parameters: [], commands: {}, baseLayer: 'Base', poseSlots: [],
      layers: [{ id: 'Base', blend: 'override', weight: 1, initialState: 'idle',
        states: [{ id: 'idle', clip: 'idle', speed: 1, loop: true, transitions: [] }] }] },
  };
}

test('deferred motion creation captures the underlying joint reference, not the previous face overlay', () => {
  const reference = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.2, -0.3, 0.1));
  const facialRotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.5, 0.4, 0.6));
  const data = { node: 'Eye', property: 'quaternion', default: reference.toArray(),
    poses: [{ name: 'eye/Close', value: facialRotation.toArray() }] };
  const { face, nodes, setState } = setup([data]);
  const root = new THREE.Group();
  nodes.Eye.name = 'LeftEye';
  nodes.Eye.quaternion.copy(reference);
  root.add(nodes.Eye);
  setState({ active: true, poseWeights: { 'eye/Close': 1 } });
  face.LateUpdate();
  assert.ok(nodes.Eye.quaternion.angleTo(facialRotation) < 1e-7);

  // The host queues an async load; constructing the player is deferred until
  // Behavior.Update has removed the previous LateUpdate result.
  face.Update();
  const delta = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.3, 0.1, -0.2));
  const player = new MotionPlayer(root, 1, faceMotion({ rotation: delta.toArray() }));
  player.update(0);
  const animated = reference.clone().multiply(delta);
  assert.ok(nodes.Eye.quaternion.angleTo(animated) < 1e-7);
  face.LateUpdate();
  face.setEnabled(false);
  assert.ok(nodes.Eye.quaternion.angleTo(animated) < 1e-7);

  face.setEnabled(true);
  face.LateUpdate();
  face.Update();
  player.dispose();
  face.LateUpdate();
  face.setEnabled(false);
  assert.ok(nodes.Eye.quaternion.angleTo(reference) < 1e-7);
});

test('deferred motion replacement and stop do not retain facial TRS or visibility in group-track rest state', () => {
  const facialRotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.4, 0.2, -0.3));
  const { face, nodes, setState } = setup([
    binding(), visibility(),
    { node: 'Eye', property: 'position', default: [2, 3, 4],
      poses: [{ name: 'eye/Close', value: [8, 9, 10] }] },
    { node: 'Eye', property: 'quaternion', default: [0, 0, 0, 1],
      poses: [{ name: 'eye/Close', value: facialRotation.toArray() }] },
  ]);
  const root = new THREE.Group();
  nodes.Eye.name = 'LeftEye';
  nodes.WhiteLine.name = 'WhiteLine';
  root.add(nodes.Eye, nodes.WhiteLine);
  const motion = (position, scale, angle, visible) => {
    const rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, angle, 0)).toArray();
    return faceMotion({ groupTracks: [
      { kind: 'transform', node: 'LeftEye', property: 'localTRS',
        translation: [...position, ...position], scale: [...scale, ...scale], rotation: [...rotation, ...rotation] },
      { kind: 'visibility', node: 'WhiteLine', property: 'visible', values: [Number(visible), Number(visible)] },
    ] });
  };
  const assertPose = (position, scale, angle, visible) => {
    assert.deepEqual(nodes.Eye.position.toArray(), position);
    assert.deepEqual(nodes.Eye.scale.toArray(), scale);
    assert.ok(nodes.Eye.quaternion.angleTo(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, angle, 0))) < 1e-7);
    assert.equal(nodes.WhiteLine.visible, visible);
  };
  setState({ active: true, poseWeights: { 'eye/Close': 1 } });
  face.LateUpdate();
  face.Update();
  let player = new MotionPlayer(root, 1, motion([3, 4, 5], [1, 0.8, 1], 0.2, true), 'llas', 'llas');
  player.update(0);
  face.LateUpdate();
  face.setEnabled(false);
  assertPose([3, 4, 5], [1, 0.8, 1], 0.2, true);
  face.setEnabled(true);
  face.LateUpdate();

  // Replacement first removes face, then restores the old player's rest state,
  // and only then lets the new player capture its reference and group underlay.
  face.Update();
  player.dispose();
  assertPose([2, 3, 4], [1, 1, 1], 0, false);
  player = new MotionPlayer(root, 1, motion([5, 6, 7], [1, 0.9, 1], -0.4, false), 'llas', 'llas');
  player.update(0);
  face.LateUpdate();
  face.setEnabled(false);
  assertPose([5, 6, 7], [1, 0.9, 1], -0.4, false);
  face.setEnabled(true);
  face.LateUpdate();

  // The deferred unload uses the same phase. Later disable/destroy must not
  // resurrect either the last motion pose or the prior facial overlay.
  face.Update();
  player.dispose();
  face.LateUpdate();
  face.setEnabled(false);
  face.OnDisable();
  face.OnDestroy();
  assertPose([2, 3, 4], [1, 1, 1], 0, false);
});
