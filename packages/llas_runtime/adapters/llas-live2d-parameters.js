// Authored cross-medium rig controls, measured from this BanG Dream series.
// No Live2D deformer, expression queue, or MTN sampling implementation here.
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

export function llasFaceControls(parameters, defaults = {}) {
  const value = (id, fallback = 0) => {
    const v = parameters[id] ?? defaults[id] ?? fallback;
    if (!Number.isFinite(v)) throw new Error(`Non-finite face parameter: ${id}`);
    return v;
  };
  const eyes = {},
    brows = {};
  for (const [side, sign] of [
    ['L', 1],
    ['R', -1],
  ]) {
    eyes[side] = {
      open: clamp(value(`PARAM_EYE_${side}_OPEN`, 1), 0, 1.5),
      smile: clamp(value(`PARAM_EYE_${side}_SMILE`), 0, 1),
      lid: 0.07 * clamp(value(`PARAM_EYELID_${side}`), -1, 1),
    };
    brows[side] = {
      x: sign * 0.21 * clamp(value(`PARAM_BROW_${side}_X`), -1, 1),
      y: 0.145 * clamp(value(`PARAM_BROW_${side}_Y`), -1, 1),
      angle: -sign * 0.46 * clamp(value(`PARAM_BROW_${side}_ANGLE`), -1, 1),
      curve: 0.09 * clamp(value(`PARAM_BROW_${side}_FORM`), -1, 1),
    };
  }
  return {
    eyes,
    brows,
    // Both source overlays express blushing. Use the LLAS cheek-spot artwork
    // as one shared approximation, so overlapping/crossfading source styles
    // never cause an abrupt texture-layer switch.
    cheek: Math.max(clamp(value('PARAM_CHEEK'), 0, 1), clamp(value('PARAM_CHEEK2'), 0, 1)),
    gaze: {
      x: 0.038 * clamp(value('PARAM_EYE_BALL_X'), -1, 1),
      y: 0.038 * clamp(value('PARAM_EYE_BALL_Y'), -1, 1),
      scale: 1 + 0.075 * clamp(value('PARAM_EYE_SCALE'), -1, 1),
    },
    mouth: {
      open: clamp(value('PARAM_MOUTH_OPEN_Y'), 0, 1),
      form: clamp(value('PARAM_MOUTH_FORM_01'), -1, 1),
      y: 0.01 * clamp(value('PARAM_MOUTH_FORM_Y'), -1, 1),
      scale: 1 + 0.115 * clamp(value('PARAM_MOUTH_SCALE'), -1, 1),
    },
  };
}
