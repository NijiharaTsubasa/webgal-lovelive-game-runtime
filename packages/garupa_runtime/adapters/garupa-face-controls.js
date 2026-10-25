const SIDES = ['L', 'R'];

// Cross-medium controls are bounded separately from the original model weights.
// The destination is supplied by the driver and reused for every frame.
export const FACE_PARAMETERS = [
  ...SIDES.flatMap((side) => [
    [`PARAM_EYE_${side}_OPEN`, 1, 0, 1.5],
    [`PARAM_EYE_${side}_SMILE`, 0, 0, 1],
    ...['X', 'Y', 'ANGLE', 'FORM'].map((axis) => [`PARAM_BROW_${side}_${axis}`, 0, -1, 1]),
  ]),
  ['PARAM_MOUTH_OPEN_Y', 0, 0, 1],
  ['PARAM_MOUTH_FORM_01', 0, -1, 1],
  ['PARAM_MOUTH_SCALE', 0, -1, 1],
  ['PARAM_MOUTH_FORM_Y', 0, -1, 1],
  ['PARAM_EYE_BALL_X', 0, -1, 1],
  ['PARAM_EYE_BALL_Y', 0, -1, 1],
  ['PARAM_EYE_SCALE', 0, -1, 1],
  ['PARAM_EYE_FORM', 0, -1, 1],
  ['PARAM_EYE_HIGHLIGHT', 0, 0, 1],
];

export function readFaceParameters(parameters, output) {
  // Reject the entire update before changing the cached controls.
  for (let i = 0; i < FACE_PARAMETERS.length; i++) {
    const [id, initial] = FACE_PARAMETERS[i];
    if (!Number.isFinite(parameters[id] ?? initial)) {
      throw new Error(`Non-finite face parameter: ${id}`);
    }
  }
  let changed = false;
  for (let i = 0; i < FACE_PARAMETERS.length; i++) {
    const [id, initial, low, high] = FACE_PARAMETERS[i];
    const value = parameters[id] ?? initial;
    const bounded = Math.max(low, Math.min(high, value));
    changed ||= output[i] !== bounded;
    output[i] = bounded;
  }
  return changed;
}

export const PARAMETER_INDEX = Object.fromEntries(
  FACE_PARAMETERS.map(([id], index) => [id, index]),
);

export function classifyFaceMorph(name) {
  let match = /^face_main_mouth_(open_[aiueo]|joy|angry|sad|fun|smile|kime|serious|wink)$/i.exec(name);
  if (match) {
    return { region: 'mouth', shape: match[1].toLowerCase(), side: null };
  }
  match = /^(face_main_eye_|eyelash_)(close|eye_close|joy|angry|sad|fun|smile|kime|serious|wink)_([LR])$/i.exec(name);
  if (match) {
    return {
      region: 'eye',
      shape: match[2].toLowerCase().replace('eye_', ''),
      side: match[3].toUpperCase(),
    };
  }
  match = /^eyebrow_(joy|angry|sad|fun|smile|kime|serious|wink)_([LR])$/i.exec(name);
  if (match) {
    return { region: 'brow', shape: match[1].toLowerCase(), side: match[2].toUpperCase() };
  }
  return null;
}
