import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FACE_PARAMETERS, PARAMETER_INDEX, classifyFaceMorph, readFaceParameters,
} from '../packages/garupa_runtime/adapters/garupa-face-controls.js';

test('Garupa controls retain independent eyes and bound custom finite parameters', () => {
  const values = new Float64Array(FACE_PARAMETERS.length).fill(NaN);
  assert.equal(readFaceParameters({}, values), true);
  assert.equal(values[PARAMETER_INDEX.PARAM_EYE_L_OPEN], 1);
  assert.equal(values[PARAMETER_INDEX.PARAM_EYE_R_OPEN], 1);
  assert.equal(readFaceParameters({}, values), false);
  readFaceParameters({ PARAM_EYE_L_OPEN: 0.37, PARAM_EYE_R_OPEN: 7, PARAM_BROW_L_ANGLE: -3 }, values);
  assert.equal(values[PARAMETER_INDEX.PARAM_EYE_L_OPEN], 0.37);
  assert.equal(values[PARAMETER_INDEX.PARAM_EYE_R_OPEN], 1.5);
  assert.equal(values[PARAMETER_INDEX.PARAM_BROW_L_ANGLE], -1);
  assert.throws(() => readFaceParameters({ PARAM_MOUTH_OPEN_Y: Infinity }, values), /Non-finite/);
});

test('Garupa channel classification separates source Morph regions, never preset recipes', () => {
  assert.deepEqual(classifyFaceMorph('face_main_mouth_open_a'), { region: 'mouth', shape: 'open_a', side: null });
  assert.deepEqual(classifyFaceMorph('face_main_eye_close_L'), { region: 'eye', shape: 'close', side: 'L' });
  assert.deepEqual(classifyFaceMorph('eyelash_eye_close_R'), { region: 'eye', shape: 'close', side: 'R' });
  assert.deepEqual(classifyFaceMorph('eyebrow_sad_L'), { region: 'brow', shape: 'sad', side: 'L' });
  assert.equal(classifyFaceMorph('body_breast_L'), null);
  assert.equal(classifyFaceMorph('face.Sad'), null);
});
