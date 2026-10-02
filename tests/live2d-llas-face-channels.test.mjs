import test from 'node:test';
import assert from 'node:assert/strict';
import { BufferGeometry, Float32BufferAttribute, Mesh } from 'three';
import { bindLlasFaceChannels } from '../packages/llas_runtime/adapters/llas-face-channels.js';

function mesh(names, { normals = false, zero = [] } = {}) {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3));
  geometry.morphTargetsRelative = true;
  geometry.morphAttributes.position = names.map((name, i) => {
    const attribute = new Float32BufferAttribute(new Float32Array(9).fill(zero.includes(name) ? 0 : i + 1), 3);
    attribute.name = name;
    return attribute;
  });
  if (normals) {
    geometry.morphAttributes.normal = names.map((_, i) => new Float32BufferAttribute(new Float32Array(9).fill((i + 1) / 8), 3));
  }
  const result = new Mesh(geometry);
  // Dictionary enumeration order must not become the channel's numeric index.
  result.morphTargetDictionary = Object.fromEntries(Object.entries(result.morphTargetDictionary).reverse());
  return result;
}

function fixture(options = {}) {
  return {
    eyeMesh: mesh([
      'applicationExpression', 'EyeBlendShape.eye_facial_005',
      'EyeBlendShape.eye_facial_003_006_011', 'EyeBlendShape.eye_facial_004',
      'EyeBlendShape.eye_facial_001', 'EyeBlendShape.eye_facial_015',
      'brow:L:depth', 'EyeBlendShape.unrelated',
    ], options),
    mouthMesh: mesh(['MouthBlendShape.mouth_facial_010', 'applicationExpression', 'MouthBlendShape.mouth_facial_001', 'MouthBlendShape.mouth_facial_005'], options),
    leftWhiteLine: mesh(['LeftEyeWhiteLineBlendShape.LeftEye_LineWhite_002', 'LeftEyeWhiteLineBlendShape.LeftEye_LineWhite_001'], options),
    rightWhiteLine: mesh(['RightEyeWhiteLineBlendShape.RightEye_LineWhite_001', 'RightEyeWhiteLineBlendShape.RightEye_LineWhite_002'], options),
  };
}

test('native channels bind by exact names despite target and dictionary order', () => {
  const input = fixture({ normals: true });
  const bound = bindLlasFaceChannels(input);
  assert.deepEqual(bound.eye.indices, { close: 4, closeSmile: 1, wide: 3 });
  assert.deepEqual(bound.mouth.indices, { opening: 2, rounded: 3 });
  assert.deepEqual(bound.leftWhiteLine.indices, { close: 1, closeSmile: 0 });
  assert.deepEqual(bound.rightWhiteLine.indices, { close: 0, closeSmile: 1 });
  assert.deepEqual([...bound.eye.vector('close')], Array(9).fill(5));
  assert.deepEqual([...bound.eye.vector('close', 'normal')], Array(9).fill(5 / 8));
  assert.deepEqual([...bound.leftWhiteLine.vector('closeSmile')], Array(9).fill(1));
  assert.deepEqual([...bound.mouth.vector('rounded')], Array(9).fill(4));
  assert.deepEqual([...bound.mouth.vector('rounded', 'normal')], Array(9).fill(4 / 8));
  const copy = bound.eye.vector('close');
  copy.fill(999);
  assert.equal(input.eyeMesh.geometry.morphAttributes.position[4].getX(0), 5);
});

test('neutral vectors need no Open or Smile recipes or neutral named channels', () => {
  const input = fixture();
  delete input.eyeMesh.morphTargetDictionary['EyeBlendShape.eye_facial_003_006_011'];
  const bound = bindLlasFaceChannels(input);
  for (const part of Object.values(bound)) {
    assert.deepEqual([...part.vector('neutral')], Array(9).fill(0));
    assert.deepEqual([...part.vector('neutral', 'normal')], Array(9).fill(0));
  }
  assert.notEqual(bound.eye.vector('neutral'), bound.eye.vector('neutral'));
});

test('Rin split and extra native channels are owned but unrelated Morphs are excluded', () => {
  const input = fixture();
  input.eyeMesh = mesh([
    'EyeBlendShape.eye_facial_101', 'EyeBlendShape.eye_facial_003',
    'EyeBlendShape.eye_facial_001', 'EyeBlendShape.eye_facial_006',
    'EyeBlendShape.eye_facial_011', 'EyeBlendShape.eye_facial_005',
    'EyeBlendShape.eye_facial_004', 'EyeBlendShape.eye_facial_025',
    'EyeBlendShape.eye_facial_900', 'applicationExpression', 'brow:R:curve',
  ]);
  input.leftWhiteLine = mesh([
    'LeftEyeWhiteLineBlendShape.LeftEye_LineWhite_004',
    'LeftEyeWhiteLineBlendShape.LeftEye_LineWhite_001',
    'LeftEyeWhiteLineBlendShape.LeftEye_LineWhite_002', 'applicationExpression',
  ]);
  const bound = bindLlasFaceChannels(input);
  assert.deepEqual(bound.eye.indices, { close: 2, closeSmile: 5, wide: 6 });
  assert.deepEqual(bound.eye.ownedIndices, [0, 1, 2, 3, 4, 5, 6, 7, 8]);
  assert.deepEqual(bound.leftWhiteLine.ownedIndices, [0, 1, 2]);
  assert.deepEqual(bound.mouth.ownedIndices, [0, 2, 3]);
  assert.deepEqual(bindLlasFaceChannels(fixture()).eye.ownedIndices, [1, 2, 3, 4, 5]);
});

test('zero Wide geometry is a valid authored channel and absent normals yield zero', () => {
  const bound = bindLlasFaceChannels(fixture({ zero: ['EyeBlendShape.eye_facial_004'] }));
  assert.equal(bound.eye.indices.wide, 3);
  assert.deepEqual([...bound.eye.vector('wide')], Array(9).fill(0));
  assert.deepEqual([...bound.eye.vector('close', 'normal')], Array(9).fill(0));
  assert.deepEqual([...bound.mouth.vector('opening', 'normal')], Array(9).fill(0));
});

test('pose recipes and native weights are neither consumed nor changed by binding', () => {
  const input = fixture();
  const snapshots = [];
  for (const mesh of Object.values(input)) {
    Object.defineProperty(mesh, 'morphPoses', { get() { throw new Error('must not read emotional recipes'); } });
    mesh.morphTargetInfluences.fill(.75);
    snapshots.push([...mesh.morphTargetInfluences]);
  }
  Object.defineProperty(input, 'morphPoses', { get() { throw new Error('must not read recipes'); } });
  const bound = bindLlasFaceChannels(input);
  assert.equal(bound.eye.vector('close')[0], 5);
  Object.values(input).forEach((mesh, i) => assert.deepEqual(mesh.morphTargetInfluences, snapshots[i]));
});

test('every missing required source channel produces a descriptive error', () => {
  const required = {
    eyeMesh: ['EyeBlendShape.eye_facial_001', 'EyeBlendShape.eye_facial_005', 'EyeBlendShape.eye_facial_004'],
    mouthMesh: ['MouthBlendShape.mouth_facial_001', 'MouthBlendShape.mouth_facial_005'],
    leftWhiteLine: ['LeftEyeWhiteLineBlendShape.LeftEye_LineWhite_001', 'LeftEyeWhiteLineBlendShape.LeftEye_LineWhite_002'],
    rightWhiteLine: ['RightEyeWhiteLineBlendShape.RightEye_LineWhite_001', 'RightEyeWhiteLineBlendShape.RightEye_LineWhite_002'],
  };
  for (const [part, names] of Object.entries(required)) {
    for (const name of names) {
      const input = fixture();
      delete input[part].morphTargetDictionary[name];
      assert.throws(() => bindLlasFaceChannels(input), error => error.message.includes(`missing required Morph ${name}`));
    }
  }
});

test('binding rejects broken relative geometry and invalid channel requests', () => {
  const input = fixture();
  input.eyeMesh.geometry.morphTargetsRelative = false;
  assert.throws(() => bindLlasFaceChannels(input), /Eye_Around: expected relative Morph geometry/);
  const bound = bindLlasFaceChannels(fixture());
  assert.throws(() => bound.eye.vector('sad'), /unknown bound channel sad/);
  assert.throws(() => bound.eye.vector('close', 'tangent'), /unsupported Morph attribute tangent/);
});
