// Anon's source mouth artwork, sampled at four FORM values and five openings.
// Each row measures growth from that row's closed state relative to FORM 0's
// full opening. This calibrates the opening axis; it is not a native mouth recipe.
const FORMS = [-1, -0.5, 0, 0.5];
const OPENING = [
  [0, 0.080729, 0.232869, 0.432561, 0.632289],
  [0, 0.029107, 0.065410, 0.161053, 0.264423],
  [0, 0.247887, 0.498591, 0.749296, 1],
  [0, 0.318359, 0.639535, 0.960712, 1.281888],
];

export function mouthScaleGain(scale) {
  return 1 + Math.max(-1, Math.min(1, scale)) * 0.115;
}

export function mouthOpening(open, form, scale) {
  if (open <= 0) {
    return 0;
  }
  const position = Math.min(1, open) * 4;
  const column = Math.min(3, Math.floor(position));
  const fraction = position - column;
  const boundedForm = Math.max(-1, Math.min(0.5, form));
  const row = Math.min(2, Math.floor((boundedForm + 1) * 2));
  const blend = (boundedForm - FORMS[row]) * 2;
  const lower = OPENING[row][column] * (1 - fraction) + OPENING[row][column + 1] * fraction;
  const upper = OPENING[row + 1][column] * (1 - fraction) + OPENING[row + 1][column + 1] * fraction;
  // SCALE changes overall size in the source, rather than selecting a vowel.
  const gain = mouthScaleGain(scale);
  return Math.min(1, (lower * (1 - blend) + upper * blend) * gain);
}
