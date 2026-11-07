import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FACE_PARAMETERS, PARAMETER_INDEX, classifyFaceMorph, readFaceParameters, eyeOpenness,
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

test('authored eye opening landmarks cover early, late, mixed and extended smile responses', () => {
  assert.equal(eyeOpenness(.5, 36), .872);
  assert.equal(eyeOpenness(.5, 1), .364);
  assert.equal(eyeOpenness(.75, 31, 1), 1);
  assert.equal(eyeOpenness(.5, 29), .398);
  assert.equal(eyeOpenness(.5, 29, 1), .518);
  assert.equal(eyeOpenness(.5, 34, 1.5), .672);
  const parameters = new Float64Array(FACE_PARAMETERS.length);
  readFaceParameters({ PARAM_EYE_L_SMILE: 1.5 }, parameters);
  assert.equal(parameters[PARAMETER_INDEX.PARAM_EYE_L_SMILE], 1.5);
  for (const id of [...Array.from({ length: 40 }, (_, i) => i + 1), 601, 999, null]) {
    for (const smile of [0, .5, 1, 1.5]) {
      let previous = -1;
      for (let sample = 0; sample <= 100; sample++) {
        const open = eyeOpenness(sample / 100, id, smile);
        assert.ok(Number.isFinite(open) && open >= previous && open >= 0 && open <= 1);
        previous = open;
      }
      assert.equal(eyeOpenness(0, id, smile), 0);
      assert.equal(eyeOpenness(1, id, smile), 1);
    }
  }
  assert.equal(eyeOpenness(.37, 999, .5), .37);
});

test('Garupa channel classification separates source Morph regions, never preset recipes', () => {
  assert.deepEqual(classifyFaceMorph('face_main_mouth_open_a'), { region: 'mouth', shape: 'open_a', side: null });
  assert.deepEqual(classifyFaceMorph('face_main_eye_close_L'), { region: 'eye', shape: 'close', side: 'L' });
  assert.deepEqual(classifyFaceMorph('eyelash_eye_close_R'), { region: 'eye', shape: 'close', side: 'R' });
  assert.deepEqual(classifyFaceMorph('eyebrow_sad_L'), { region: 'brow', shape: 'sad', side: 'L' });
  assert.equal(classifyFaceMorph('body_breast_L'), null);
  assert.equal(classifyFaceMorph('face.Sad'), null);
});

test('extended expression forms reach semantic drivers without premature clipping', () => {
  const values = new Float64Array(FACE_PARAMETERS.length);
  readFaceParameters({ PARAM_BROW_L_FORM: -1.5, PARAM_BROW_R_FORM: -3, PARAM_MOUTH_FORM_01: -2.7 }, values);
  assert.equal(values[PARAMETER_INDEX.PARAM_BROW_L_FORM], -1.5);
  assert.equal(values[PARAMETER_INDEX.PARAM_BROW_R_FORM], -3);
  assert.equal(values[PARAMETER_INDEX.PARAM_MOUTH_FORM_01], -2.7);
  readFaceParameters({ PARAM_BROW_L_FORM: 2, PARAM_MOUTH_FORM_01: 1.5 }, values);
  assert.equal(values[PARAMETER_INDEX.PARAM_BROW_L_FORM], 2);
  assert.equal(values[PARAMETER_INDEX.PARAM_MOUTH_FORM_01], 1.5);
});
