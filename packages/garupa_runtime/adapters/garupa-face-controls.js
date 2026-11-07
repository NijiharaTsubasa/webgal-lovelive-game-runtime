const SIDES = ['L', 'R'];

// Interior OPEN landmarks at .25, .5 and .75, separately for ordinary and
// smiling eyes. Keys are original AvatarDescription.Id role groups. The values
// summarize measured native Live2D blink fields; model Morph capabilities still
// supply each head's authored closed/open shapes.
const EYE_OPEN_CURVES = {
  1: [[0.182, 0.364, 0.524], [0.164, 0.328, 0.522]], // kasumi
  2: [[0.289, 0.579, 0.87], [0.281, 0.557, 0.824]], // tae
  3: [[0.262, 0.524, 0.785], [0.25, 0.501, 0.747]], // rimi
  4: [[0.3, 0.598, 0.791], [0.26, 0.525, 0.74]], // saya
  5: [[0.364, 0.684, 0.94], [0.345, 0.66, 0.927]], // arisa
  6: [[0.305, 0.61, 0.911], [0.26, 0.52, 0.779]], // ran
  7: [[0.254, 0.507, 0.761], [0.229, 0.459, 0.688]], // moca
  8: [[0.25, 0.5, 0.75], [0.23, 0.46, 0.735]], // himari
  9: [[0.256, 0.508, 0.759], [0.246, 0.492, 0.738]], // tomoe
  10: [[0.251, 0.503, 0.756], [0.238, 0.475, 0.713]], // tsugumi
  11: [[0.258, 0.519, 0.779], [0.25, 0.501, 0.752]], // kokoro
  12: [[0.389, 0.675, 0.774], [0.308, 0.544, 0.651]], // kaoru
  13: [[0.276, 0.552, 0.826], [0.268, 0.535, 0.798]], // hagumi
  14: [[0.266, 0.533, 0.756], [0.261, 0.522, 0.859]], // kanon
  16: [[0.27, 0.539, 0.807], [0.253, 0.503, 0.748]], // aya
  17: [[0.276, 0.551, 0.827], [0.267, 0.534, 0.801]], // hina
  18: [[0.258, 0.518, 0.776], [0.26, 0.52, 0.78]], // chisato
  19: [[0.248, 0.497, 0.754], [0.257, 0.516, 0.782]], // maya
  20: [[0.273, 0.545, 0.818], [0.26, 0.52, 0.779]], // eve
  21: [[0.258, 0.512, 0.758], [0.207, 0.442, 0.72]], // yukina
  22: [[0.209, 0.418, 0.627], [0.198, 0.396, 0.593]], // sayo
  23: [[0.313, 0.585, 0.795], [0.288, 0.55, 0.777]], // lisa
  24: [[0.25, 0.501, 0.751], [0.25, 0.501, 0.751]], // ako
  25: [[0.278, 0.556, 0.834], [0.269, 0.538, 0.807]], // rinko
  26: [[0.252, 0.504, 0.753], [0.224, 0.447, 0.668]], // mashiro
  27: [[0.373, 0.746, 0.873], [0.337, 0.675, 0.837]], // toko
  28: [[0.277, 0.553, 0.747], [0.266, 0.533, 0.76]], // nanami
  29: [[0.199, 0.398, 0.596], [0.259, 0.518, 0.766]], // tsukushi
  30: [[0.29, 0.579, 0.79], [0.268, 0.537, 0.768]], // rui
  31: [[0.259, 0.517, 0.759], [0.247, 0.495, 1]], // layer
  32: [[0.285, 0.571, 0.856], [0.266, 0.531, 0.8]], // lock
  33: [[0.25, 0.501, 0.887], [0.248, 0.496, 0.753]], // masking
  34: [[0.255, 0.511, 0.941], [0.324, 0.648, 0.994], [0.336, 0.672, 0.994]], // pareo, SMILE=1.5
  35: [[0.315, 0.629, 0.942], [0.312, 0.624, 0.936]], // chu2
  36: [[0.436, 0.872, 0.917], [0.428, 0.855, 0.903]], // tomori
  37: [[0.284, 0.568, 0.886], [0.289, 0.578, 0.854]], // anon
  38: [[0.421, 0.841, 0.852], [0.398, 0.796, 0.837]], // rana
  39: [[0.408, 0.816, 0.927], [0.381, 0.762, 0.903]], // soyo
  40: [[0.259, 0.517, 0.772], [0.259, 0.518, 0.767]], // taki
  601: [[0.286, 0.558, 0.807], [0.226, 0.481, 0.779]], // misaki
};

function sampleEyeCurve(open, curve) {
  if (!curve || open === 0 || open === 1) return open;
  const segment = Math.min(3, Math.floor(open * 4));
  const low = segment === 0 ? 0 : curve[segment - 1];
  const high = segment === 3 ? 1 : curve[segment];
  return low + (high - low) * (open * 4 - segment);
}

export function eyeOpenness(value, characterId, smile = 0) {
  const open = Math.max(0, Math.min(1, value));
  const curves = EYE_OPEN_CURVES[characterId];
  const result = sampleEyeCurve(open, curves?.[smile > 0 ? 1 : 0]);
  if (!(smile > 1) || !curves?.[2]) return result;
  // PAREO has a further authored SMILE landmark. Its eyelid type remains a
  // bounded smile, while the opening response continues to that landmark.
  const amount = Math.min(1, (smile - 1) / .5);
  return result + (sampleEyeCurve(open, curves[2]) - result) * amount;
}

// Cross-medium controls and authored Morph weights have separate bounds.
// FORM values retain their finite source range; semantic segments saturate in
// the driver, so extended negative expressions are not collapsed to FORM=-1.
// The destination is supplied by the driver and reused for every frame.
export const FACE_PARAMETERS = [
  ...SIDES.flatMap((side) => [
    [`PARAM_EYE_${side}_OPEN`, 1, 0, 1.5],
    [`PARAM_EYE_${side}_SMILE`, 0, 0],
    [`PARAM_EYELID_${side}`, 0, -1, 1],
    ...['X', 'Y', 'ANGLE'].map((axis) => [`PARAM_BROW_${side}_${axis}`, 0, -1, 1]),
    [`PARAM_BROW_${side}_FORM`, 0],
  ]),
  ['PARAM_MOUTH_OPEN_Y', 0, 0, 1],
  ['PARAM_MOUTH_FORM_01', 0],
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
    const bounded = Math.max(low ?? -Infinity, Math.min(high ?? Infinity, value));
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
