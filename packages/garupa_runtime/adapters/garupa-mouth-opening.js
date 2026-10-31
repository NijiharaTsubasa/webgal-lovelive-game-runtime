// Shared visual calibration from Anon's source artwork. These are height-growth
// samples, not measurements of visible cavity area or an original game algorithm.
const FORMS = [-1, -0.5, 0, 0.5];
const OPENING = [
  [0, 0.080729, 0.232869, 0.432561, 0.632289],
  [0, 0.029107, 0.065410, 0.161053, 0.264423],
  [0, 0.247887, 0.498591, 0.749296, 1],
  [0, 0.318359, 0.639535, 0.960712, 1.281888],
];

export function mouthScaleGain(scale) {
  return 1 + Math.max(-1, Math.min(1, finite(scale))) * 0.115;
}

function finite(value) {
  return Number.isFinite(value) ? value : 0;
}

function unit(value) {
  return Math.max(0, Math.min(1, value));
}

export function mouthOpening(open, form) {
  open = unit(finite(open));
  form = finite(form);
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
  const calibrated = lower * (1 - blend) + upper * blend;
  // Extended negative FORM selects a more open contour during speech in the
  // source. OPEN=0 remains closed. This is a shared target approximation, not a
  // reproduction of individual MOC parameter ranges or artwork restrictions.
  const extended = unit((-form - 1) * 2);
  return unit(calibrated * (1 - extended) + open * extended);
}

// Coefficients multiply authored target bases once. No additional OPEN-based
// round-mouth floor should be applied by the caller. SCALE describes mouth size,
// independently of aperture; applying it as an opening gain changes its meaning.
export function mouthSemantics(open, form, scale = 0) {
  form = finite(form);
  const opening = mouthOpening(open, form);
  const positive = unit(2 * form);
  const negative = unit(-2 * form);
  const strong = unit(-2 * form - 1);
  const extendedNegative = unit((-form - 1) * 2);
  // The extended negative speaking contour is a horizontal oval, unlike the
  // ordinary negative U/O contour. Blend native A with the rounded base while
  // retaining the closed frown contribution; do not substitute a smiling base.
  const extendedOval = opening * negative * strong * extendedNegative * 0.75;
  return {
    opening,
    ordinary: opening * (1 - negative) * (1 - positive) + extendedOval,
    smile: opening * (1 - negative) * positive,
    negativeMid: opening * negative * (1 - strong),
    negativeStrong: opening * negative * strong - extendedOval,
    closed: 1 - opening,
    sizeGain: mouthScaleGain(scale),
    extendedNegative,
  };
}
