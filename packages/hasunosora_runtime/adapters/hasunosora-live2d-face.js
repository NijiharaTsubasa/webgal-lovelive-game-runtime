import { HASUNOSORA_FACE_PROFILES } from './hasunosora-face-profiles.js';
import { createBrowClearance } from './hasunosora-brow-clearance.js';

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const SIDES = ['L', 'R'];

export function hasunosoraFaceControls(parameters, defaults = {}) {
  const value = (name, fallback = 0, low = -1, high = 1) => {
    const number = parameters[name] ?? defaults[name] ?? fallback;
    if (!Number.isFinite(number)) throw new Error(`Non-finite face parameter: ${name}`);
    return clamp(number, low, high);
  };
  return {
    eyes: Object.fromEntries(SIDES.map((side) => [side, {
      open: value(`PARAM_EYE_${side}_OPEN`, 1, 0, 1.5),
      smile: value(`PARAM_EYE_${side}_SMILE`, 0, 0, 1),
    }])),
    brows: Object.fromEntries(SIDES.map((side) => [side, {
      x: value(`PARAM_BROW_${side}_X`),
      y: value(`PARAM_BROW_${side}_Y`),
      angle: value(`PARAM_BROW_${side}_ANGLE`),
      form: value(`PARAM_BROW_${side}_FORM`),
    }])),
    mouth: {
      open: value('PARAM_MOUTH_OPEN_Y', 0, 0, 1),
      form: value('PARAM_MOUTH_FORM_01'),
      scale: value('PARAM_MOUTH_SCALE'),
      y: value('PARAM_MOUTH_FORM_Y'),
    },
    gaze: {
      x: value('PARAM_EYE_BALL_X'),
      y: value('PARAM_EYE_BALL_Y'),
      scale: value('PARAM_EYE_SCALE'),
    },
    tear: value('PARAM_TEAR', 0, 0, 1),
    highlight: value('PARAM_EYE_HIGHLIGHT', 0, 0, 1),
  };
}

function sourceMeshes(node) {
  if (!node) throw new Error('Hasunosora face node is missing');
  const found = [];
  node.traverse((object) => {
    if (object.isMesh && !object.userData?.__parameterizedPassObject) found.push(object);
  });
  if (!found.length) throw new Error(`Hasunosora face node has no meshes: ${node.name}`);
  return found;
}

// The published geometry is immutable. Forward/Outline share one private copy,
// while every object retains its own native Morph weights for restoration.
class FaceWorkspace {
  constructor(root, mesh, THREE) {
    this.source = mesh.geometry;
    const hasMorphs = Object.values(this.source.morphAttributes).some((attributes) => attributes.length);
    if (hasMorphs && !this.source.morphTargetsRelative)
      throw new Error('Hasunosora face requires relative Morph geometry');
    this.geometry = this.source.clone();
    this.basePosition = this.geometry.attributes.position;
    this.position = this.basePosition.clone();
    this.baseNormal = this.geometry.attributes.normal;
    this.normal = this.baseNormal?.clone();
    // In the source rigs face right/up/forward correspond to Head
    // local +Z/-X/-Y. Recover that frame from bind data, not the current pose.
    // This removes costume-specific rigid translation/rotation before shaping.
    const head = mesh.skeleton?.bones.findIndex((bone) => bone.name === 'Head') ?? -1;
    this.toFace = new THREE.Matrix4();
    if (head >= 0) {
      this.toFace.set(0, 0, 1, 0, -1, 0, 0, 0, 0, -1, 0, 0, 0, 0, 0, 1)
        .multiply(mesh.skeleton.boneInverses[head])
        .multiply(mesh.bindMatrix);
    }
    this.fromFace = this.toFace.clone().invert();
    this.toFaceLinear = new THREE.Matrix3().setFromMatrix4(this.toFace);
    this.fromFaceLinear = new THREE.Matrix3().setFromMatrix4(this.fromFace);
    this.toFaceNormal = new THREE.Matrix3().getNormalMatrix(this.toFace);
    this.fromFaceNormal = new THREE.Matrix3().getNormalMatrix(this.fromFace);
    this.baseFace = this.basePosition.clone().applyMatrix4(this.toFace);
    this.baseFaceNormal = this.baseNormal?.clone().applyNormalMatrix(this.toFaceNormal);
    this.objects = [];
    this.targets = new Map();
    this.highlightMask = new Uint8Array(this.basePosition.count);
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const groups = this.source.groups.length ? this.source.groups : [{
      start: 0, count: this.source.index?.count ?? this.basePosition.count, materialIndex: 0,
    }];
    for (const group of groups) {
      const material = materials[group.materialIndex];
      if ((material?.userData?.__parameterizedShader ?? material?.userData?.shader) !== 'character-highlight') continue;
      for (let i = group.start; i < group.start + group.count; i++)
        this.highlightMask[this.source.index ? this.source.index.getX(i) : i] = 1;
    }
    for (const [name, index] of Object.entries(mesh.morphTargetDictionary ?? {})) {
      const semantic = name.slice(name.indexOf('.') + 1);
      if (/^(?:Face|Brow|EyeShadow|Eye)_\./.test(name)) {
        const attribute = this.source.morphAttributes.position[index].clone().applyMatrix3(this.toFaceLinear);
        const normal = this.source.morphAttributes.normal?.[index];
        if (normal) attribute.normalDelta = normal.clone().applyMatrix3(this.toFaceNormal);
        this.targets.set(semantic, { index, attribute });
      }
    }
    root.traverse((object) => {
      if (object.geometry !== this.source) return;
      this.objects.push({ object, geometry: object.geometry, frustumCulled: object.frustumCulled });
      object.geometry = this.geometry;
    });
  }

  target(name) {
    // These are the two exact spellings present in the source corpus.
    const alternate = name.replace('Mouth_UP', 'Mouth_Up').replace('cornerUP', 'cornerUp');
    return this.targets.get(name)?.attribute ?? this.targets.get(alternate)?.attribute;
  }

  vector(weights) {
    const result = new Float32Array(this.basePosition.count * 3);
    result.normalDelta = new Float32Array(result.length);
    for (const [name, weight] of Object.entries(weights)) {
      const target = this.target(name);
      if (!target || !weight) continue;
      for (let i = 0; i < result.length; i++) result[i] += target.array[i] * weight;
      if (target.normalDelta)
        for (let i = 0; i < result.length; i++) result.normalDelta[i] += target.normalDelta.array[i] * weight;
    }
    return result;
  }

  reset() {
    this.position.array.set(this.baseFace.array);
    if (this.normal) this.normal.array.set(this.baseFaceNormal.array);
  }

  add(vector, weight = 1, side) {
    if (!vector || !weight) return;
    const source = vector.array ?? vector;
    const position = this.position.array;
    for (let i = 0; i < position.length; i += 3) {
      // Only split bilateral controls. Authored unilateral channels retain
      // their complete source deltas, including their soft centre seam.
      const mask = side ? this.sideWeights[side][i / 3] : 1;
      position[i] += source[i] * weight * mask;
      position[i + 1] += source[i + 1] * weight * mask;
      position[i + 2] += source[i + 2] * weight * mask;
      const normals = vector.normalDelta?.array ?? vector.normalDelta;
      if (this.normal && normals) {
        for (let axis = 0; axis < 3; axis++)
          this.normal.array[i + axis] += normals[i + axis] * weight * mask;
      }
    }
  }

  activate(changed) {
    // Geometry-only bounds do not describe a posed skinned face. Avoid both
    // false culling and rescanning every inactive source Morph each frame.
    for (const { object } of this.objects) {
      object.geometry = this.geometry;
      object.frustumCulled = false;
    }
    this.geometry.setAttribute('position', this.position);
    if (this.normal) this.geometry.setAttribute('normal', this.normal);
    if (changed) {
      // Transform deltas, then add the original attributes. An unchanged eye
      // keeps its exact source coordinates rather than acquiring round-trip
      // float error on nearly coplanar iris/highlight surfaces.
      for (let i = 0; i < this.position.array.length; i++)
        this.position.array[i] -= this.baseFace.array[i];
      this.position.applyMatrix3(this.fromFaceLinear);
      for (let i = 0; i < this.position.array.length; i++)
        this.position.array[i] += this.basePosition.array[i];
      if (this.normal) {
        for (let i = 0; i < this.normal.array.length; i++)
          this.normal.array[i] -= this.baseFaceNormal.array[i];
        this.normal.applyMatrix3(this.fromFaceNormal);
        for (let i = 0; i < this.normal.array.length; i++)
          this.normal.array[i] += this.baseNormal.array[i];
      }
      this.position.needsUpdate = true;
      if (this.normal) this.normal.needsUpdate = true;
    }
  }

  restoreAttributes() {
    // Keep the private geometry attached to its uploaded buffers until it is
    // disposed. Native frames use the untouched source geometry directly.
    for (const saved of this.objects) {
      saved.object.geometry = saved.geometry;
      saved.object.frustumCulled = saved.frustumCulled;
    }
  }

  dispose() {
    for (const saved of this.objects) {
      saved.object.geometry = saved.geometry;
      saved.object.frustumCulled = saved.frustumCulled;
    }
    this.geometry.dispose();
  }
}

function sideBounds(work, neutral, side, mask) {
  const positive = side === 'L';
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < work.basePosition.count; i++) {
    if (mask && !mask[i]) continue;
    if ((work.baseFace.getX(i) >= 0) !== positive) continue;
    for (let axis = 0; axis < 3; axis++) {
      const value = work.baseFace.array[i * 3 + axis] + (neutral?.[i * 3 + axis] ?? 0);
      lo[axis] = Math.min(lo[axis], value);
      hi[axis] = Math.max(hi[axis], value);
    }
  }
  if (!Number.isFinite(lo[0])) return { center: [0, 0, 0], width: 0.01 };
  return { center: lo.map((v, axis) => (v + hi[axis]) * 0.5), width: Math.max(hi[0] - lo[0], 1e-5) };
}

export class HasunosoraLive2dFace {
  constructor(context) {
    this.parameters = {};
    this.defaults = {};
    this.workspaces = [];
    this.underlay = null;
    this.cacheKey = null;
    this.part = context.parts.find((part) => HASUNOSORA_FACE_PROFILES[part.component.motionGroup]);
    if (!this.part) throw new Error('Hasunosora parameter face requires a supported character motionGroup');
    this.profile = HASUNOSORA_FACE_PROFILES[this.part.component.motionGroup];
    try {
      const geometryWork = new Map();
      this.parts = {};
      for (const part of ['Face', 'Brow', 'EyeShadow', 'Eye']) {
        this.parts[part] = sourceMeshes(context.resolveNode(this.part.role, `${part} Renderer`)).map((mesh) => {
          let work = geometryWork.get(mesh.geometry);
          if (!work) {
            work = new FaceWorkspace(context.root, mesh, context.THREE);
            geometryWork.set(work.source, work);
            geometryWork.set(work.geometry, work);
            this.workspaces.push(work);
          }
          return work;
        });
        this.parts[part] = [...new Set(this.parts[part])];
      }
      const eye = this.parts.Eye[0];
      this.eyeBounds = Object.fromEntries(SIDES.map((side) => [side, sideBounds(eye, null, side)]));
      this.eyeDistance = Math.max(0.001, Math.abs(this.eyeBounds.L.center[0] - this.eyeBounds.R.center[0]));
      for (const work of this.workspaces) {
        work.sideWeights = { L: new Float32Array(work.basePosition.count), R: new Float32Array(work.basePosition.count) };
        for (let i = 0; i < work.basePosition.count; i++) {
          const left = clamp(0.5 + work.baseFace.getX(i) / (this.eyeDistance * 0.2), 0, 1);
          work.sideWeights.L[i] = left;
          work.sideWeights.R[i] = 1 - left;
        }
      }
      // The face opening and its companion strip must use the same smile controls.
      this.hasPartialSmile = [...this.parts.Face, ...this.parts.EyeShadow]
        .every((work) => work.target('Eyelids_Smile'));
      for (const work of [...this.parts.Face, ...this.parts.EyeShadow]) {
        work.eyeNeutral = work.vector(this.profile.eyeNeutral);
      }
      for (const work of this.parts.Brow) {
        work.neutral = work.vector(this.profile.browNeutral);
        work.bounds = Object.fromEntries(SIDES.map((side) => [side, sideBounds(work, work.neutral, side)]));
      }
      for (const work of this.parts.Face) this.bindMouth(work);
      this.clearBrows = createBrowClearance(this.parts.Face, this.parts.Brow, this.eyeDistance);
      for (const work of this.parts.Eye) {
        work.eyeBounds = Object.fromEntries(SIDES.map((side) => [side, sideBounds(work, null, side)]));
        work.highlightBounds = Object.fromEntries(SIDES.map((side) => [side,
          sideBounds(work, null, side, work.highlightMask)]));
      }
    } catch (error) {
      for (const work of this.workspaces) work.dispose();
      throw error;
    }
  }

  bindMouth(work) {
    work.mouthNeutral = work.vector(this.profile.mouthNeutral);
    const controls = ['Mouth_A', 'Mouth_O', 'Mouth_Squash', 'Mouth_UP', 'Mouth_Down',
      'Mouth_cornerUP_L', 'Mouth_cornerUP_R', 'Mouth_cornerDown_L', 'Mouth_cornerDown_R'];
    const vectors = controls.map((name) => work.target(name)).filter(Boolean);
    work.mouthSupport = new Float32Array(work.basePosition.count);
    let sum = 0, cx = 0, cy = 0;
    const squash = work.target('Mouth_Squash') ?? work.target('Mouth_A');
    for (let i = 0; i < work.basePosition.count; i++) {
      let extent = 0;
      for (const target of vectors)
        extent = Math.max(extent, Math.hypot(target.getX(i), target.getY(i), target.getZ(i)));
      work.mouthSupport[i] = clamp(extent / (this.eyeDistance * 0.025), 0, 1);
      const weight = squash ? Math.hypot(squash.getX(i), squash.getY(i), squash.getZ(i)) : 0;
      sum += weight;
      cx += (work.baseFace.getX(i) + work.mouthNeutral[i * 3]) * weight;
      cy += (work.baseFace.getY(i) + work.mouthNeutral[i * 3 + 1]) * weight;
    }
    work.mouthCenter = sum > 0 ? [cx / sum, cy / sum] : [0, 0];
  }

  setParameters(parameters, defaults = {}) {
    this.parameters = { ...parameters };
    this.defaults = { ...defaults };
    return hasunosoraFaceControls(parameters, defaults);
  }

  beginFrame() {
    if (!this.underlay) return;
    for (const { object, index, value } of this.underlay)
      object.morphTargetInfluences[index] = value;
    for (const work of this.workspaces) work.restoreAttributes();
    this.underlay = null;
  }

  update() {
    this.beginFrame();
    const controls = hasunosoraFaceControls(this.parameters, this.defaults);
    this.underlay = [];
    for (const work of this.workspaces) {
      for (const { object } of work.objects) {
        for (const { index } of work.targets.values()) {
          this.underlay.push({ object, index, value: object.morphTargetInfluences[index] });
          object.morphTargetInfluences[index] = 0;
        }
      }
    }
    const key = JSON.stringify(controls), changed = key !== this.cacheKey;
    if (changed) {
      for (const work of this.workspaces) work.reset();
      this.applyEyes(controls.eyes);
      this.applyBrows(controls.brows);
      this.applyMouth(controls.mouth);
      this.applyGaze(controls.gaze, controls.highlight);
      for (const work of this.parts.Face)
        work.add(work.target('Other_Tear'), controls.tear);
      this.clearBrows();
      this.cacheKey = key;
    }
    for (const work of this.workspaces) work.activate(changed);
    return controls;
  }

  applyEyes(eyes) {
    for (const work of [...this.parts.Face, ...this.parts.EyeShadow]) {
      for (const side of SIDES) {
        const eye = eyes[side], closure = 1 - Math.min(1, eye.open);
        const wide = Math.max(0, eye.open - 1) * 2;
        work.add(work.eyeNeutral, (1 - closure) * (1 - wide), side);
        work.add(work.target(`Eyelids_Close_${side}`), closure * (1 - eye.smile));
        work.add(work.target(`Eyelids_SmileB_${side}`), closure * eye.smile);
        work.add(work.target('Eyelids_Open'), wide, side);
        if (this.hasPartialSmile)
          work.add(work.target('Eyelids_Smile'), eye.smile * closure * (1 - closure) * 1.6, side);
      }
    }
  }

  applyBrows(brows) {
    for (const work of this.parts.Brow) {
      work.add(work.neutral);
      for (let i = 0; i < work.position.count; i++) {
        const side = work.baseFace.getX(i) >= 0 ? 'L' : 'R', sign = side === 'L' ? 1 : -1;
        const control = brows[side], { center, width } = work.bounds[side];
        const angle = -sign * control.angle * 0.46, cosine = Math.cos(angle), sine = Math.sin(angle);
        const x = work.position.getX(i) - center[0], y = work.position.getY(i) - center[1];
        const curve = (1 - Math.min(1, (2 * x / width) ** 2)) * control.form * width * 0.12;
        work.position.setXYZ(i,
          center[0] + x * cosine - (y + curve) * sine + sign * control.x * this.eyeDistance * 0.15,
          center[1] + x * sine + (y + curve) * cosine + control.y * this.eyeDistance * 0.13,
          work.position.getZ(i));
        if (work.normal) {
          const nx = work.normal.getX(i), ny = work.normal.getY(i);
          work.normal.setXY(i, nx * cosine - ny * sine, nx * sine + ny * cosine);
        }
      }
    }
  }

  applyMouth(mouth) {
    for (const work of this.parts.Face) {
      const round = work.target('Mouth_O') ? Math.max(0, -mouth.form) * mouth.open : 0;
      work.add(work.mouthNeutral, 1 - mouth.open);
      work.add(work.target('Mouth_A'), mouth.open * (1 - round));
      work.add(work.target('Mouth_O'), mouth.open * round);
      const corner = mouth.form >= 0 ? 'UP' : 'Down';
      for (const side of SIDES)
        work.add(work.target(`Mouth_corner${corner}_${side}`), Math.abs(mouth.form) * (1 - round));
      work.add(work.target(mouth.y >= 0 ? 'Mouth_UP' : 'Mouth_Down'), Math.abs(mouth.y) * 0.5);
      // Scale the complete aperture, including the mouth's internal vertices.
      // The authored Morph support fades the correction into stationary skin.
      const scale = 1 + mouth.scale * 0.115;
      if (scale !== 1) {
        for (let i = 0; i < work.position.count; i++) {
          const factor = work.mouthSupport[i] * (scale - 1);
          if (!factor) continue;
          work.position.setXY(i,
            work.position.getX(i) + (work.position.getX(i) - work.mouthCenter[0]) * factor,
            work.position.getY(i) + (work.position.getY(i) - work.mouthCenter[1]) * factor);
        }
      }
    }
  }

  applyGaze(gaze, highlight) {
    for (const work of this.parts.Eye) {
      for (let i = 0; i < work.position.count; i++) {
        const side = work.baseFace.getX(i) >= 0 ? 'L' : 'R';
        const isHighlight = work.highlightMask[i] !== 0;
        const center = (isHighlight ? work.highlightBounds : work.eyeBounds)[side].center;
        // Core measurements distinguish iris scale from the independent
        // sparkle control. The latter enlarges patterns, never hides them.
        const scale = 1 + (isHighlight ? highlight * 0.13 : gaze.scale * 0.075);
        work.position.setXY(i,
          center[0] + (work.position.getX(i) - center[0]) * scale + gaze.x * this.eyeDistance * 0.038,
          center[1] + (work.position.getY(i) - center[1]) * scale + gaze.y * this.eyeDistance * 0.038);
      }
    }
  }

  dispose() {
    this.beginFrame();
    for (const work of this.workspaces) work.dispose();
    this.workspaces = [];
  }
}

export function createExpressionAdapter(context) {
  if (!context.parts.some((part) => HASUNOSORA_FACE_PROFILES[part.component.motionGroup])) return null;
  const driver = new HasunosoraLive2dFace(context);
  return {
    restore() { driver.beginFrame(); },
    apply(parameters) {
      driver.setParameters(parameters);
      return driver.update();
    },
    dispose() { driver.dispose(); },
  };
}
