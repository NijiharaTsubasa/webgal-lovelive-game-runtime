import { FACE_PARAMETERS, PARAMETER_INDEX as P, classifyFaceMorph, readFaceParameters } from './garupa-face-controls.js';
import { GarupaEyeDriver } from './garupa-eye-driver.js';
import { mouthOpening, mouthScaleGain } from './garupa-mouth-opening.js';

const SIDES = ['L', 'R'];
const SHAPES = ['close', 'joy', 'angry', 'sad', 'fun', 'smile', 'kime', 'serious', 'wink',
  'open_a', 'open_i', 'open_u', 'open_e', 'open_o'];
const SHAPE_INDEX = new Map(SHAPES.map((name, index) => [name, index]));
const STRIDE = SHAPES.length;
const positive = (value) => Math.max(0, value);

// A coarse capability guard, evaluated once while binding the model. The dot
// product detects a candidate with very little motion along the authored A
// opening direction; it is not a measurement of the visible mouth aperture.
function openingProjection(reference, candidate) {
  if (!reference || !candidate || reference.geometry !== candidate.geometry
    || reference.attribute.count !== candidate.attribute.count
    || reference.cap <= 0 || candidate.cap <= 0) {
    return null;
  }
  let dot = 0;
  let norm = 0;
  let candidateNorm = 0;
  for (let index = 0; index < reference.attribute.count; index++) {
    const ax = reference.attribute.getX(index);
    const ay = reference.attribute.getY(index);
    const az = reference.attribute.getZ(index);
    const x = candidate.attribute.getX(index);
    const y = candidate.attribute.getY(index);
    const z = candidate.attribute.getZ(index);
    dot += ax * x + ay * y + az * z;
    norm += ax * ax + ay * ay + az * az;
    candidateNorm += x * x + y * y + z * z;
  }
  return norm > 0 && candidateNorm > 0 ? dot * candidate.cap / (norm * reference.cap) : null;
}
const SIDE_PARAMETERS = SIDES.map((side) => ({
  open: P[`PARAM_EYE_${side}_OPEN`],
  smile: P[`PARAM_EYE_${side}_SMILE`],
  y: P[`PARAM_BROW_${side}_Y`],
  angle: P[`PARAM_BROW_${side}_ANGLE`],
  curve: P[`PARAM_BROW_${side}_FORM`],
}));

function isPassObject(object) {
  for (let node = object; node; node = node.parent) {
    if (node.userData?.__parameterizedPassObject) {
      return true;
    }
  }
  return false;
}

function sourceCaps(component) {
  const nodes = new Map();
  for (const pose of component.morphPoses ?? []) {
    if (!pose.name.startsWith('source.')) {
      continue;
    }
    for (const [node, targets] of Object.entries(pose.targets)) {
      let caps = nodes.get(node);
      if (!caps) {
        caps = new Map();
        nodes.set(node, caps);
      }
      for (const [name, cap] of Object.entries(targets)) {
        if (!Number.isFinite(cap)) {
          throw new Error(`Invalid Garupa source Morph range: ${node}/${name}`);
        }
        const previous = caps.get(name);
        if (previous !== undefined && previous !== cap) {
          throw new Error(`Conflicting Garupa source Morph ranges: ${node}/${name}`);
        }
        caps.set(name, cap);
      }
    }
  }
  return nodes;
}

// The adapter writes existing BlendShape channels. It neither edits geometry
// nor evaluates native expression recipes.
export class GarupaLive2dFace {
  constructor(context, part) {
    this.parameters = new Float64Array(FACE_PARAMETERS.length).fill(NaN);
    this.weights = new Float64Array(5 * STRIDE);
    this.bindings = [];
    this.active = false;
    this.disposed = false;
    const caps = sourceCaps(part.component);
    const hasNativeTargets = part.component.morphPoses?.some((pose) => Object.keys(pose.targets).length > 0);
    const hasSourceChannels = part.gltf?.parser?.json?.meshes?.some((mesh) =>
      mesh.extras?.targetNames?.some((name) => classifyFaceMorph(name)));
    if (!caps.size && (hasNativeTargets || hasSourceChannels)) {
      throw new Error('Missing Garupa source Morph bindings; regenerate the model package');
    }
    const meshCaps = new Map();
    for (const [nodeName, targets] of caps) {
      const node = context.resolveNode(part.role, nodeName);
      node.traverse((object) => {
        if (object.isMesh && !isPassObject(object)) {
          meshCaps.set(object, targets);
        }
      });
    }
    const seen = new Set();
    const mouthChannels = new Map();
    const meshes = new Set(meshCaps.keys());
    part.root.traverse((object) => {
      if (object.isMesh) {
        meshes.add(object);
      }
    });
    for (const object of meshes) {
      if (!object.isMesh || isPassObject(object) || !object.morphTargetDictionary) {
        continue;
      }
      for (const [name, index] of Object.entries(object.morphTargetDictionary)) {
        const channel = classifyFaceMorph(name);
        if (!channel) {
          continue;
        }
        const cap = meshCaps.get(object)?.get(name);
        if (cap === undefined) {
          throw new Error(`Missing Garupa source Morph binding: ${object.name}/${name}`);
        }
        const array = object.morphTargetInfluences;
        // Several draw objects can share the same influence storage.
        const indices = seen.has(array) ? this.bindings.filter((entry) => entry.array === array) : [];
        if (indices.some((entry) => entry.index === index)) {
          continue;
        }
        seen.add(array);
        const region = channel.region === 'mouth' ? 4
          : (channel.region === 'brow' ? 2 : 0) + (channel.side === 'R' ? 1 : 0);
        this.bindings.push({ array, index, cap, weight: region * STRIDE + SHAPE_INDEX.get(channel.shape), original: 0 });
        if (channel.region === 'mouth') {
          const attribute = object.geometry.morphAttributes.position?.[index];
          if (attribute) {
            mouthChannels.set(channel.shape, { attribute, cap, geometry: object.geometry });
          }
        }
      }
    }
    const reference = mouthChannels.get('open_a');
    const projections = new Map();
    const projection = (shape) => {
      if (!projections.has(shape)) {
        projections.set(shape, openingProjection(reference, mouthChannels.get(shape)));
      }
      return projections.get(shape);
    };
    const opens = (shape) => projection(shape) !== null && projection(shape) >= 0.2;
    const closed = (shapes) => shapes.find((shape) => projection(shape) !== null && projection(shape) < 0.2);
    this.positiveMouth = SHAPE_INDEX.get(opens('fun') ? 'fun' : 'open_a');
    this.negativeMouth = SHAPE_INDEX.get(opens('angry') ? 'angry' : 'open_o');
    const positiveClosed = closed(['joy', 'smile']);
    const negativeClosed = closed(['serious', 'sad', 'angry']);
    this.positiveClosedMouth = SHAPE_INDEX.get(positiveClosed) ?? -1;
    this.negativeClosedMouth = SHAPE_INDEX.get(negativeClosed) ?? -1;
    this.closedMouthShapes = [positiveClosed, negativeClosed].filter((shape) => shape !== undefined);
    this.eyes = new GarupaEyeDriver(context, part, caps.size > 0);
  }

  restore() {
    this.eyes.restore();
    if (this.active) {
      for (const binding of this.bindings) {
        binding.array[binding.index] = binding.original;
      }
      this.active = false;
    }
  }

  calculateWeights() {
    const values = this.parameters;
    const weights = this.weights;
    weights.fill(0);
    for (let sideIndex = 0; sideIndex < SIDES.length; sideIndex++) {
      const parameters = SIDE_PARAMETERS[sideIndex];
      const open = Math.min(1, values[parameters.open]);
      const smile = values[parameters.smile];
      const eye = sideIndex * STRIDE;
      weights[eye] = (1 - open) * (1 - smile);
      weights[eye + SHAPE_INDEX.get('wink')] = (1 - open) * smile;
      weights[eye + SHAPE_INDEX.get('joy')] = open * smile;
      const form = values[P.PARAM_EYE_FORM] * (1 - smile) * open;
      weights[eye + SHAPE_INDEX.get('angry')] = positive(form);
      weights[eye + SHAPE_INDEX.get('sad')] = positive(-form);

      const brow = (sideIndex + 2) * STRIDE;
      const y = values[parameters.y];
      const angle = values[parameters.angle];
      const curve = values[parameters.curve];
      weights[brow + SHAPE_INDEX.get('fun')] = positive(y);
      weights[brow + SHAPE_INDEX.get('serious')] = positive(-y);
      weights[brow + SHAPE_INDEX.get('sad')] = positive(angle);
      weights[brow + SHAPE_INDEX.get('angry')] = positive(-angle);
      weights[brow + SHAPE_INDEX.get('joy')] = positive(curve);
      weights[brow + SHAPE_INDEX.get('kime')] = positive(-curve);
      let sum = 0;
      for (let i = 0; i < STRIDE; i++) {
        sum += weights[brow + i];
      }
      if (sum > 1) {
        for (let i = 0; i < STRIDE; i++) {
          weights[brow + i] /= sum;
        }
      }
    }

    const mouth = 4 * STRIDE;
    const form = values[P.PARAM_MOUTH_FORM_01];
    const opening = mouthOpening(values[P.PARAM_MOUTH_OPEN_Y], form, values[P.PARAM_MOUTH_SCALE]);
    const negative = Math.min(1, positive(-form) * 2);
    // A strongly negative, fully open source mouth needs the round contour,
    // rather than a mostly closed interpolation from the model's neutral line.
    const roundOpening = Math.min(1, Math.max(opening,
      values[P.PARAM_MOUTH_OPEN_Y] * positive(-form) * mouthScaleGain(values[P.PARAM_MOUTH_SCALE])));
    weights[mouth + this.positiveMouth] += opening * (1 - negative);
    weights[mouth + this.negativeMouth] += roundOpening * negative;
    const remaining = Math.max(0, 1 - opening * (1 - negative) - roundOpening * negative);
    if (this.positiveClosedMouth >= 0) {
      weights[mouth + this.positiveClosedMouth] += remaining * Math.min(1, positive(form) * 2);
    }
    if (this.negativeClosedMouth >= 0) {
      weights[mouth + this.negativeClosedMouth] += remaining * negative;
    }
  }

  apply(parameters) {
    if (this.disposed) {
      throw new Error('Garupa face adapter has been disposed');
    }
    const changed = readFaceParameters(parameters, this.parameters);
    this.restore();
    if (changed) {
      this.calculateWeights();
    }
    for (const binding of this.bindings) {
      binding.original = binding.array[binding.index];
      binding.array[binding.index] = this.weights[binding.weight] * binding.cap;
    }
    this.active = true;
    this.eyes.apply(this.parameters[P.PARAM_EYE_BALL_X], this.parameters[P.PARAM_EYE_BALL_Y],
      this.parameters[P.PARAM_EYE_SCALE], this.parameters[P.PARAM_EYE_HIGHLIGHT]);
  }

  dispose() {
    this.restore();
    this.bindings.length = 0;
    this.eyes.dispose();
    this.disposed = true;
  }
}

export function createExpressionAdapter(context) {
  const part = context.parts.find((entry) => entry.component.motionGroup === 'garupa' && entry.role === 'head');
  if (!part) {
    return null;
  }
  return new GarupaLive2dFace(context, part);
}

export function createFocusAdapter(context) {
  const part = context.parts.find((entry) => entry.component.motionGroup === 'garupa' && entry.role === 'head');
  if (!part) {
    return null;
  }
  const eyes = new GarupaEyeDriver(context, part, sourceCaps(part.component).size > 0);
  return {
    restore() {
      eyes.restore();
    },
    apply({ x, y }) {
      eyes.apply(x, y, 0, 0);
    },
    dispose() {
      eyes.dispose();
    },
  };
}
