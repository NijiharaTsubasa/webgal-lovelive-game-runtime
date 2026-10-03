// Neutral recipes define compatibility groups; target deltas come from each mesh.
const plain = (options = {}) => ({
  browNeutral: { Eyebrow_Normal: 1 },
  eyeNeutral: { Eyelids_Normal: 1 },
  mouthNeutral: { Mouth_Normal: 1 },
  ...options,
});
const modern = () => plain({
  browNeutral: {}, eyeNeutral: {}, mouthNeutral: {},
});

export const HASUNOSORA_FACE_PROFILES = Object.freeze({
  'hasunosora.old': plain(),
  'hasunosora.new': modern(),
  'hasunosora.kaho': plain({
    browNeutral: {
      Eyebrow_Angry: 0.05,
      Eyebrow_Smile_L: 1,
      Eyebrow_Smile_R: 1,
      Eyebrow_Down_L: 0.38,
      Eyebrow_Down_R: 0.38,
    },
  }),
});
