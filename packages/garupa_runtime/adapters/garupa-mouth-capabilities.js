const PREFIX = 'face_main_mouth_';

// These vectors describe authored mouth directions shared by semantic avatar
// groups. Their weights are independent of the gains in native source recipes.
const NEGATIVE_DIRECTIONS = {
  none: {}, serious: { serious: 1 }, sad: { sad: 1 },
  seriousSad: { serious: 1, sad: 1 },
  seriousHalfSad: { serious: 1, sad: .5 }, joy: { joy: 1 },
};

// [negative direction, endpoint strength, flat fraction of endpoint, positive
// direction, open smile direction, negative opening direction, neutral Sad].
// The numeric keys are original AvatarDescription.Id values.
const GROUPS = {
  1: ['serious', 1, 1], 2: ['sad', 1, .5, 'joy'],
  3: ['serious', 1, 1, 'joy'], 4: ['serious', 1, 1],
  5: ['serious', 1, 1, 'joy'], 6: ['none', 0, 0, 'joy'],
  7: ['sad', 1, .3, 'joy'], 8: ['serious', 1, 1],
  9: ['sad', 1, 1, null, null, null, .5],
  10: ['serious', 1, 1],
  11: ['seriousSad', .588666, 1, 'joy'],
  12: ['seriousSad', .86552, 1, 'joy'],
  13: ['serious', 1, .8, 'joy'], 14: ['serious', 1, 1],
  16: ['serious', 1, 1],
  17: ['seriousHalfSad', 1, .662428],
  18: ['seriousSad', 1, .635493],
  19: ['none', 0, 0], 20: ['seriousSad', 1, 1],
  21: ['none', 0, 0, 'joy'], 22: ['none', 0, 0, 'joy'],
  23: ['sad', 1, 1], 24: ['joy', 1, 1],
  25: ['none', 0, 0, 'wink', 'smile'],
  26: ['seriousSad', .691968, 1, 'joy'],
  27: ['serious', 1, 1], 28: ['serious', 1, 1],
  29: ['serious', 1, 1, 'joy'],
  30: ['none', 0, 0, 'joy', 'aFun'],
  31: ['none', 0, 0, 'joy'], 32: ['none', 0, 0],
  33: ['none', 0, 0, 'joy'], 34: ['sad', 1, 1, 'wink'],
  35: ['serious', 1, 1, 'joy'], 36: ['serious', 1, 0, 'joy'],
  37: ['serious', 1, .5, 'joy'],
  38: ['serious', 1, 0, 'joy', 'aFun'],
  39: ['serious', 1, .5, null, null, 'angry'],
  40: ['serious', 1, 1, 'joy'], 601: ['none', 0, 0, 'joy'],
};

function add(...vectors) {
  const result = {};
  for (const vector of vectors) {
    for (const [name, weight] of Object.entries(vector)) {
      result[name] = (result[name] ?? 0) + weight;
    }
  }
  return result;
}

export function discoverMouthCapabilities(characterId, bindings) {
  const rule = Number.isInteger(characterId) ? GROUPS[characterId] : null;
  if (!rule) return null;
  const [direction, strength, flat, positive, smile = 'fun', negativeOpen, neutralSad] = rule;
  const available = new Set();
  const gains = new Map();
  for (const binding of bindings) {
    if (!binding.name.startsWith(PREFIX)) continue;
    const shape = binding.name.slice(PREFIX.length);
    available.add(shape);
    if (Number.isFinite(binding.cap)) {
      gains.set(shape, Math.max(gains.get(shape) ?? -Infinity, binding.cap));
    }
  }
  const authored = (vector, amount = 1) => Object.fromEntries(Object.entries(vector)
    .filter(([name, weight]) => available.has(name) && weight * amount !== 0)
    .map(([name, weight]) => [PREFIX + name, weight * amount]));
  const native = (name, amount = 1) => authored({ [name]: gains.get(name) ?? 1 }, amount);
  const negative = NEGATIVE_DIRECTIONS[direction];
  return {
    anchors: {
      neutral: neutralSad ? authored({ sad: neutralSad }) : {},
      negativeLandmark: authored(negative, strength * flat),
      negativeEnd: authored(negative, strength),
      positiveEnd: positive ? native(positive) : {},
    },
    bases: {
      ordinaryOpen: native('open_a'),
      smileOpen: smile === 'aFun'
        ? add(native('open_a', .25), native('fun', .75)) : native(smile ?? 'fun'),
      negativeMidOpen: native(negativeOpen === 'angry' ? 'angry' : 'open_o'),
      negativeStrongOpen: negativeOpen === 'angry' ? native('angry')
        : add(native('open_u', .5), native('open_o', .5)),
    },
  };
}
