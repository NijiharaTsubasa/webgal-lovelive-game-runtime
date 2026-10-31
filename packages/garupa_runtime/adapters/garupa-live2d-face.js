import { FACE_PARAMETERS, PARAMETER_INDEX as P, classifyFaceMorph, readFaceParameters } from './garupa-face-controls.js';
import { GarupaEyeDriver } from './garupa-eye-driver.js';
import { mouthSemantics } from './garupa-mouth-opening.js';
import { createBrowDriver } from './garupa-brow-driver.js';
import { calibrateOpenSmile } from './garupa-eye-smile.js';
import { resolveEyeCapabilities } from './garupa-eye-capabilities.js';
import { discoverMouthCapabilities } from './garupa-mouth-capabilities.js';

const SIDES = ['L', 'R'];
const EYE_BASES = ['close', 'closedSmile', 'openSmile', 'wide', 'formNegative', 'formPositive'];
const clamp = (value, low = 0, high = 1) => Math.max(low, Math.min(high, value));
const NEGATIVE_LANDMARK = -1 / 3;
const SIDE_PARAMETERS = SIDES.map((side) => ({
  open: P[`PARAM_EYE_${side}_OPEN`], smile: P[`PARAM_EYE_${side}_SMILE`],
}));

function isPassObject(object) {
  for (let node = object; node; node = node.parent) {
    if (node.userData?.__parameterizedPassObject) return true;
  }
  return false;
}

function sourceCaps(component) {
  const nodes = new Map();
  for (const pose of component.morphPoses ?? []) {
    if (!pose.name.startsWith('source.')) continue;
    for (const [node, targets] of Object.entries(pose.targets)) {
      let caps = nodes.get(node);
      if (!caps) { caps = new Map(); nodes.set(node, caps); }
      for (const [name, cap] of Object.entries(targets)) {
        if (!Number.isFinite(cap)) throw new Error(`Invalid Garupa source Morph weight: ${node}/${name}`);
        const previous = caps.get(name);
        // Multiple native routes may drive the same Morph at different gains.
        // Preserve the strongest native gain when several routes share a target.
        caps.set(name, previous === undefined ? cap : Math.max(previous, cap));
      }
    }
  }
  return nodes;
}

// Without a semantic group rule, screen out obviously opening native candidates
// from closed-mouth directions. This is a conservative directional
// guard, not a claim that projection measures the visible mouth aperture.
function openingProjection(reference, candidate) {
  if (!reference || !candidate || reference.geometry !== candidate.geometry
    || reference.attribute.count !== candidate.attribute.count) return null;
  let dot = 0; let norm = 0; let candidateNorm = 0;
  for (let i = 0; i < reference.attribute.count; i++) {
    const ax = reference.attribute.getX(i), ay = reference.attribute.getY(i), az = reference.attribute.getZ(i);
    const x = candidate.attribute.getX(i), y = candidate.attribute.getY(i), z = candidate.attribute.getZ(i);
    dot += ax * x + ay * y + az * z;
    norm += ax * ax + ay * ay + az * az;
    candidateNorm += x * x + y * y + z * z;
  }
  return norm > 0 && candidateNorm > 0 ? dot / norm : null;
}

function inferMouthCapabilities(bindings) {
  const names = (region, side, shape, gain = 1) => Object.fromEntries(bindings
    .filter((binding) => binding.channel.region === region && binding.channel.side === side && binding.channel.shape === shape)
    .map((binding) => [binding.name, gain]));
  const mouthBindings = new Map();
  for (const binding of bindings) {
    if (binding.channel.region === 'mouth') {
      const attribute = binding.geometry.morphAttributes.position?.[binding.index];
      if (attribute) mouthBindings.set(binding.channel.shape, { attribute, geometry: binding.geometry });
    }
  }
  const closed = (shapes) => {
    const shape = shapes.find((name) => {
      const projection = openingProjection(mouthBindings.get('open_a'), mouthBindings.get(name));
      return projection !== null && projection < 0.2;
    });
    return shape ? names('mouth', null, shape) : {};
  };
  const negative = closed(['serious', 'sad', 'angry']);
  const opening = (preferred) => {
    const shape = preferred.find((name) => {
      const projection = openingProjection(mouthBindings.get('open_a'), mouthBindings.get(name));
      return projection !== null && projection >= 0.2;
    });
    return names('mouth', null, shape ?? 'open_a');
  };
  const strong = {};
  for (const preferred of [['open_u', 'open_o', 'open_a'], ['open_o', 'open_u', 'open_a']]) {
    for (const [name, value] of Object.entries(opening(preferred))) strong[name] = (strong[name] ?? 0) + value * 0.5;
  }
  return {
    anchors: { neutral: {}, negativeLandmark: negative, negativeEnd: negative, positiveEnd: closed(['joy', 'smile', 'wink']) },
    bases: {
      ordinaryOpen: names('mouth', null, 'open_a'),
      smileOpen: opening(['fun', 'smile', 'open_a']),
      negativeMidOpen: opening(['open_o', 'open_a']),
      negativeStrongOpen: strong,
    },
  };
}

// The adapter owns cross-medium interpretation. Every vector below contains
// actual Morph weights; source.* expressions retain their own original recipes.
export class GarupaLive2dFace {
  constructor(context, part) {
    this.parameters = new Float64Array(FACE_PARAMETERS.length).fill(NaN);
    this.bindings = [];
    this.active = false;
    this.disposed = false;
    const caps = sourceCaps(part.component);
    const meshCaps = new Map();
    for (const [nodeName, targets] of caps) {
      const node = context.resolveNode(part.role, nodeName);
      node.traverse((object) => {
        if (object.isMesh && !isPassObject(object)) meshCaps.set(object, targets);
      });
    }
    const meshes = new Set(meshCaps.keys());
    part.root.traverse((object) => { if (object.isMesh) meshes.add(object); });
    const seen = new Map();
    for (const object of meshes) {
      if (isPassObject(object) || !object.morphTargetDictionary || !object.morphTargetInfluences) continue;
      const array = object.morphTargetInfluences;
      let indices = seen.get(array);
      if (!indices) { indices = new Set(); seen.set(array, indices); }
      for (const [name, index] of Object.entries(object.morphTargetDictionary)) {
        const channel = classifyFaceMorph(name);
        if (!channel || indices.has(index)) continue;
        indices.add(index);
        this.bindings.push({ object, geometry: object.geometry, array, index, name, channel, cap: meshCaps.get(object)?.get(name), original: 0 });
      }
    }
    this.weights = new Float64Array(this.bindings.length);
    const avatar = part.component.behaviors?.find((entry) => entry.name === 'Garupa.AvatarScaler');
    const characterId = avatar?.parameters?.profile?.id;
    const groupedMouth = discoverMouthCapabilities(characterId, this.bindings);
    const eyeCapabilities = resolveEyeCapabilities(part, this.bindings);
    this.capabilities = { mouth: Boolean(groupedMouth), eyes: true, characterId: characterId ?? null };
    const mouth = groupedMouth ?? inferMouthCapabilities(this.bindings);
    this.mouthAnchors = Object.fromEntries(Object.entries(mouth.anchors).map(([key, vector]) => [key, this.compile(vector)]));
    this.mouthBases = Object.fromEntries(Object.entries(mouth.bases).map(([key, vector]) => [key, this.compile(vector)]));
    this.eyeBases = SIDES.map((side) => {
      const aliases = eyeCapabilities[side];
      const vectors = EYE_BASES.map((name) => this.compile(aliases[name] ?? {}));
      vectors[2] = calibrateOpenSmile(vectors[2], vectors[0], vectors[1], this.bindings);
      return vectors;
    });
    this.eyeStrengths = this.eyeBases.map((aliases) => aliases.map((vector) => vector.reduce((maximum, value) => Math.max(maximum, value), 0)));
    this.brows = createBrowDriver(context, part, this.bindings);
    this.eyes = new GarupaEyeDriver(context, part, caps.size > 0);
  }

  compile(vector) {
    return Float64Array.from(this.bindings, (binding) => vector?.[binding.name] ?? 0);
  }

  add(vector, coefficient) {
    if (!vector || coefficient === 0) return;
    for (let i = 0; i < this.weights.length; i++) this.weights[i] += vector[i] * coefficient;
  }

  restore() {
    this.brows.restore();
    this.eyes.restore();
    if (this.active) {
      for (const binding of this.bindings) binding.array[binding.index] = binding.original;
      this.active = false;
    }
  }

  calculateWeights() {
    const values = this.parameters;
    this.weights.fill(0);
    for (let sideIndex = 0; sideIndex < SIDES.length; sideIndex++) {
      const parameters = SIDE_PARAMETERS[sideIndex];
      const open = clamp(values[parameters.open]);
      const smile = values[parameters.smile];
      const aliases = this.eyeBases[sideIndex];
      const form = values[P.PARAM_EYE_FORM];
      const close = (1 - open) * (1 - smile);
      const closedSmile = (1 - open) * smile;
      const openSmile = open * smile;
      const formAmount = open * (1 - smile) * Math.abs(form);
      this.add(aliases[0], close);
      this.add(aliases[1], closedSmile);
      this.add(aliases[2], openSmile);
      this.add(aliases[form < 0 ? 4 : 5], formAmount);
      const strengths = this.eyeStrengths[sideIndex];
      const consumed = close * strengths[0] + closedSmile * strengths[1] + openSmile * strengths[2]
        + formAmount * strengths[form < 0 ? 4 : 5];
      this.add(aliases[3], clamp((values[parameters.open] - 1) / 0.5) * Math.max(0, 1 - consumed));
    }

    const rawForm = values[P.PARAM_MOUTH_FORM_01];
    const form = clamp(rawForm, -1, 1);
    const mouth = mouthSemantics(values[P.PARAM_MOUTH_OPEN_Y], rawForm, values[P.PARAM_MOUTH_SCALE]);
    this.add(this.mouthBases.ordinaryOpen, mouth.ordinary);
    this.add(this.mouthBases.smileOpen, mouth.smile);
    this.add(this.mouthBases.negativeMidOpen, mouth.negativeMid);
    this.add(this.mouthBases.negativeStrongOpen, mouth.negativeStrong);
    const remaining = mouth.closed;
    if (form > 0) {
      this.add(this.mouthAnchors.neutral, remaining * (1 - form));
      this.add(this.mouthAnchors.positiveEnd, remaining * form);
    } else if (form >= NEGATIVE_LANDMARK) {
      const blend = form / NEGATIVE_LANDMARK;
      this.add(this.mouthAnchors.neutral, remaining * (1 - blend));
      this.add(this.mouthAnchors.negativeLandmark, remaining * blend);
    } else {
      const blend = (NEGATIVE_LANDMARK - form) / (1 + NEGATIVE_LANDMARK);
      this.add(this.mouthAnchors.negativeLandmark, remaining * (1 - blend));
      this.add(this.mouthAnchors.negativeEnd, remaining * blend);
    }
  }

  apply(parameters) {
    if (this.disposed) throw new Error('Garupa face adapter has been disposed');
    const changed = readFaceParameters(parameters, this.parameters);
    this.restore();
    if (changed) this.calculateWeights();
    for (let i = 0; i < this.bindings.length; i++) {
      const binding = this.bindings[i];
      binding.original = binding.array[binding.index];
      binding.array[binding.index] = clamp(this.weights[i]);
    }
    this.active = true;
    this.brows.apply(this.parameters);
    this.eyes.apply(this.parameters[P.PARAM_EYE_BALL_X], this.parameters[P.PARAM_EYE_BALL_Y],
      this.parameters[P.PARAM_EYE_SCALE], this.parameters[P.PARAM_EYE_HIGHLIGHT]);
  }

  dispose() {
    this.restore();
    this.brows.dispose();
    this.bindings.length = 0;
    this.eyes.dispose();
    this.disposed = true;
  }
}

export function createExpressionAdapter(context) {
  const part = context.parts.find((entry) => entry.component.motionGroup === 'garupa' && entry.role === 'head');
  return part ? new GarupaLive2dFace(context, part) : null;
}

export function createFocusAdapter(context) {
  const part = context.parts.find((entry) => entry.component.motionGroup === 'garupa' && entry.role === 'head');
  if (!part) return null;
  const eyes = new GarupaEyeDriver(context, part, sourceCaps(part.component).size > 0);
  return {
    restore() { eyes.restore(); },
    apply({ x, y }) { eyes.apply(x, y, 0, 0); },
    dispose() { eyes.dispose(); },
  };
}
