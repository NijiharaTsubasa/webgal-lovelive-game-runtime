import { evaluateBinding } from '../behaviors/face.js';
import {
  FaceMorphWorkspace,
  maskedDifference,
  classifyEyeRegions,
  regionBounds,
  planarChannels,
  mouthChannels,
  browDepthConstraint,
  browCurvature,
} from './llas-face-geometry.js';
import { llasFaceControls } from './llas-live2d-parameters.js';
import { bindLlasFaceChannels } from './llas-face-channels.js';

// LLAS-specific authored rig. Native LLAS.Face remains unchanged; the host
// relinquishes its original expression writer while this driver is installed.
export class LlasLive2dFace {
  constructor(context) {
    this.root = context.root;
    this.parameters = {};
    this.defaults = {};
    this.underlay = null;
    this.workspaces = [];
    try {
      const eyeGeometry = this.bindFaceResources(context);
      this.measureEyeRig(context.THREE);
      this.createMorphChannels(context.THREE, eyeGeometry);
      this.collectOwnership();
    } catch (error) {
      for (const work of this.workspaces) work.dispose();
      throw error;
    }
  }

  resolveMesh(name) {
    const node = this.resolve(name);
    if (node.isMesh) return node;
    const found = [];
    // Pass objects can duplicate a primitive beneath the source node.
    node.traverse((o) => {
      if (o.isMesh && !o.userData?.__parameterizedPassObject) found.push(o);
    });
    if (found.length !== 1) throw new Error(`LLAS ${name}: expected a single source primitive`);
    return found[0];
  }

  bindFaceResources(context) {
    const runtimes = new Set();
    this.root.traverse((object) => {
      for (const material of [object.material].flat())
        for (const runtime of material ? context.getShaderRuntimes(material) : [])
          if (typeof runtime.setExternalCheek === 'function') runtimes.add(runtime);
    });
    this.cheekRuntimes = [...runtimes];
    const part = context.parts.find((part) =>
      part.component.behaviors?.some((b) => b.name === 'LLAS.Face')
    );
    if (!part)
      throw new Error(
        'LLAS direct face requires ordinary face bindings; board faces use their own rig'
      );
    this.resolve = (name) => context.resolveNode(part.role, name);
    const definition = part.component;
    const declaration = definition.behaviors?.find((b) => b.name === 'LLAS.Face');
    if (!declaration)
      throw new Error(
        'LLAS direct face requires ordinary face bindings; board faces use their own rig'
      );
    this.bindings = declaration.parameters.bindings.map((binding) => ({
      ...binding,
      object: this.resolve(binding.node),
    }));
    this.eyeMesh = this.resolveMesh('Eye_Around');
    this.mouthMesh = this.resolveMesh('Mouth');
    this.sourceChannels = bindLlasFaceChannels({
      eyeMesh: this.eyeMesh,
      mouthMesh: this.mouthMesh,
      leftWhiteLine: this.resolveMesh('LeftEyeWhiteLine'),
      rightWhiteLine: this.resolveMesh('RightEyeWhiteLine'),
    });
    this.eyeWork = new FaceMorphWorkspace(this.root, this.eyeMesh, context.THREE);
    this.workspaces.push(this.eyeWork);
    const regions = classifyEyeRegions(this.eyeMesh.geometry);
    const vector = (shape, kind) =>
      this.sourceChannels.eye.vector(
        { Open: 'neutral', Close: 'close', CloseSmile: 'closeSmile', WideOpen: 'wide' }[shape],
        kind
      );
    const open = vector('Open'),
      openNormal = vector('Open', 'normal');
    const bounds = Object.fromEntries(
      ['L', 'R'].map((side) => [
        side,
        regionBounds(this.eyeMesh.geometry, regions[side].brow, open),
      ])
    );
    this.browCurvatures = Object.fromEntries(
      ['L', 'R'].map((side) => [
        side,
        browCurvature(this.eyeMesh.geometry, regions[side].brow, open),
      ])
    );
    return { regions, vector, open, openNormal, bounds };
  }

  measureEyeRig(THREE) {
    const { Matrix4, Vector3 } = THREE;
    // Some LLAS faces skin the iris to Eye1, not Eye2. The common parent
    // carries both and keeps the original child companion deformation intact.
    this.eyeBones = Object.fromEntries(
      ['L', 'R'].map((side) => [
        side,
        this.resolve(side === 'L' ? 'LeftEye_Root' : 'RightEye_Root'),
      ])
    );
    const bindProperties = this.bindings
      .filter((b) => b.property !== 'visible')
      .map((b) => ({ ...b, value: b.object[b.property].toArray() }));
    try {
      // Measure the neutral companion rig, not whichever native expression
      // happened to be selected before installing this driver.
      for (const binding of bindProperties)
        binding.object[binding.property].fromArray(evaluateBinding(binding, { 'eye/Open': 1 }));
      this.root.updateMatrixWorld(true);
      const centers = Object.fromEntries(
        ['L', 'R'].map((side) => [
          side,
          this.resolve(side === 'L' ? 'LeftEye2' : 'RightEye2').getWorldPosition(new Vector3()),
        ])
      );
      this.irisPivots = Object.fromEntries(
        ['L', 'R'].map((side) => [side, this.eyeBones[side].worldToLocal(centers[side].clone())])
      );
      this.eyeDistance = this.eyeMesh
        .worldToLocal(centers.L.clone())
        .distanceTo(this.eyeMesh.worldToLocal(centers.R.clone()));
    } finally {
      for (const binding of bindProperties)
        binding.object[binding.property].fromArray(binding.value);
      this.root.updateMatrixWorld(true);
    }
    this.gazeBasis = Object.fromEntries(
      Object.entries(this.eyeBones).map(([side, bone]) => {
        // Eye_Around and Eye_Root share the rigid Head_All ancestor. Its
        // animated transform cancels, leaving a fixed face-local basis.
        const matrix = new Matrix4()
          .copy(bone.parent.matrixWorld)
          .invert()
          .multiply(this.eyeMesh.matrixWorld);
        return [side, matrix];
      })
    );
    this.eyeSpace = new Matrix4();
    this.localShift = new Vector3();
    this.origin = new Vector3();
  }

  createMorphChannels(THREE, { regions, vector, open, openNormal, bounds }) {
    for (const side of ['L', 'R']) {
      // Authored eye channels also move brows; isolate the eye region so the
      // independent parameter brow controls retain sole ownership there.
      for (const shape of ['Close', 'CloseSmile', 'WideOpen'])
        this.eyeWork.add(
          `eye:${side}:${shape}`,
          maskedDifference(vector(shape), open, regions[side].eye),
          maskedDifference(vector(shape, 'normal'), openNormal, regions[side].eye)
        );
      const channels = planarChannels(
        this.eyeMesh.geometry,
        regions[side].brow,
        bounds[side].center,
        open
      );
      for (const name of ['x', 'y', 'sin', 'cos', 'curve'])
        this.eyeWork.add(
          `brow:${side}:${name}`,
          channels[name],
          name === 'sin' ? channels.normalSin : name === 'cos' ? channels.normalCos : undefined
        );
      const depth = new Float32Array(open.length);
      for (let i = 0; i < regions[side].brow.length; i++)
        if (regions[side].brow[i]) depth[i * 3 + 2] = 1;
      this.eyeWork.add(`brow:${side}:depth`, depth);
    }
    this.browDepth = browDepthConstraint(
      this.eyeMesh,
      this.resolveMesh('Face'),
      regions,
      open,
      THREE
    );
    this.mouthWork = new FaceMorphWorkspace(this.root, this.mouthMesh, THREE);
    this.workspaces.push(this.mouthWork);
    const mouth = mouthChannels(
      this.mouthMesh.geometry,
      this.sourceChannels.mouth.vector('opening')
    );
    this.closedMouthCurvature = mouth.curvature;
    for (const [name, delta] of Object.entries(mouth.channels))
      this.mouthWork.add(`mouth:${name}`, delta);
    // A and O have different stationary regions on some faces. Build each
    // support independently so size/position controls keep its seams fixed.
    const round = mouthChannels(
      this.mouthMesh.geometry,
      this.sourceChannels.mouth.vector('rounded')
    );
    for (const name of ['baseX', 'openX', 'baseY', 'openY', 'moveY'])
      this.mouthWork.add(`roundMouth:${name}`, round.channels[name]);
  }

  collectOwnership() {
    // Main and Outline share geometry, but each keeps its own Morph weights.
    this.sourceObjects = new Map();
    this.morphs = [];
    for (const source of Object.values(this.sourceChannels)) {
      const objects = [];
      this.root.traverse((object) => {
        if (object.geometry === source.mesh.geometry) {
          objects.push(object);
          for (const index of source.ownedIndices) this.morphs.push({ object, index });
        }
      });
      this.sourceObjects.set(source, objects);
    }
    const ownedMorphs = new Map(this.morphs.map((b) => [`${b.object.uuid}:${b.index}`, b]));
    for (const work of this.workspaces)
      for (const { object } of work.objects)
        for (const index of work.channels.values())
          ownedMorphs.set(`${object.uuid}:${index}`, { object, index });
    this.ownedMorphs = [...ownedMorphs.values()];
    const owned = new Map();
    const own = (object, property) =>
      owned.set(`${object.uuid}:${property}`, { object, property });
    for (const binding of this.bindings) own(binding.object, binding.property);
    for (const object of Object.values(this.eyeBones)) {
      own(object, 'position');
      own(object, 'scale');
    }
    this.ownedProperties = [...owned.values()];
  }

  setParameters(parameters, defaults = {}) {
    this.parameters = { ...parameters };
    this.defaults = { ...defaults };
    return llasFaceControls(parameters, defaults);
  }

  beginFrame() {
    if (!this.underlay) return;
    for (const { object, index, value } of this.underlay.morphs)
      object.morphTargetInfluences[index] = value;
    for (const { object, property, value } of this.underlay.properties) {
      if (property === 'visible') object.visible = value;
      else object[property].fromArray(value);
    }
    this.underlay = null;
    for (const runtime of this.cheekRuntimes) runtime.setExternalCheek(null);
  }

  update() {
    this.beginFrame();
    const controls = llasFaceControls(this.parameters, this.defaults);
    this.captureUnderlay();
    this.applyEyesAndBrows(controls);
    this.applyMouth(controls.mouth);
    this.applyCompanionsAndGaze(controls);
    this.applyCheek(controls);
    return controls;
  }

  captureUnderlay() {
    // Save the latest native animation result before taking ownership. The
    // next beginFrame restores it before the host evaluates another frame.
    this.underlay = {
      morphs: this.ownedMorphs.map((b) => ({
        ...b,
        value: b.object.morphTargetInfluences[b.index],
      })),
      properties: this.ownedProperties.map((b) => ({
        ...b,
        value: b.property === 'visible' ? b.object.visible : b.object[b.property].toArray(),
      })),
    };
    for (const b of this.morphs) b.object.morphTargetInfluences[b.index] = 0;
  }

  applyEyesAndBrows(controls) {
    const weights = {};
    for (const side of ['L', 'R']) {
      const eye = controls.eyes[side],
        closed = 1 - Math.min(1, eye.open),
        brow = controls.brows[side];
      weights[`eye:${side}:Close`] = closed * (1 - eye.smile);
      weights[`eye:${side}:CloseSmile`] = closed * eye.smile;
      weights[`eye:${side}:WideOpen`] = Math.max(0, eye.open - 1) * 2;
      weights[`brow:${side}:x`] = brow.x * this.eyeDistance;
      weights[`brow:${side}:y`] = brow.y * this.eyeDistance;
      weights[`brow:${side}:sin`] = Math.sin(brow.angle);
      weights[`brow:${side}:cos`] = Math.cos(brow.angle) - 1;
      // Neutral arches differ across faces. A negative form first removes
      // that measured arch, then bends the same vertices through zero.
      weights[`brow:${side}:curve`] =
        brow.curve >= 0 ? brow.curve : brow.curve * (1 + this.browCurvatures[side] / 0.09);
      const line = this.sourceChannels[side === 'L' ? 'leftWhiteLine' : 'rightWhiteLine'];
      for (const object of this.sourceObjects.get(line)) {
        object.morphTargetInfluences[line.indices.close] = closed * (1 - eye.smile);
        object.morphTargetInfluences[line.indices.closeSmile] = closed * eye.smile;
      }
    }
    this.eyeWork.write(weights);
    // The surface query must see the complete XY shape with zero depth lift;
    // applying the returned lift afterward prevents frame-to-frame feedback.
    for (const side of ['L', 'R']) weights[`brow:${side}:depth`] = this.browDepth(side);
    this.eyeWork.write(weights);
  }

  applyMouth(mouth) {
    // Negative forms gradually become a rounded opening. Mixing complete
    // branches preserves authored lips, teeth and cavity depth; a shared
    // planar bend alone cannot turn A into O without also bending the teeth.
    const roundness = Math.max(0, -mouth.form) * mouth.open;
    for (const object of this.sourceObjects.get(this.sourceChannels.mouth)) {
      object.morphTargetInfluences[this.sourceChannels.mouth.indices.opening] =
        mouth.open * (1 - roundness);
      object.morphTargetInfluences[this.sourceChannels.mouth.indices.rounded] =
        mouth.open * roundness;
    }
    const open = mouth.open,
      scale = mouth.scale;
    const width = 1 + mouth.form * (0.25 + 0.4 * open),
      openingHeight = 1 + 0.45 * Math.min(0, mouth.form);
    // The separate face surface surrounds Mouth. Expanding beyond native A
    // buries corners in it even before Mouth triangles reverse. Keep A as the
    // widest aperture; negative forms still narrow it. Clamp the combined
    // width/scale rather than allowing size to reintroduce that expansion.
    const widthScale = Math.max(0.6, Math.min(1, width * scale)),
      verticalScale = Math.min(1, scale);
    // Fit the closed contour before applying the shared target curve. This
    // cross-medium calibration also accounts for the painted lower lip.
    const f = mouth.form;
    const closedCurve = f < 0 ? -0.12 * f : -0.08 * f;
    const curve =
      (closedCurve - this.closedMouthCurvature) * (1 - open) +
      (f < 0 ? -0.045 * f : -0.025 * f) * open;
    const weights = {
      'mouth:baseX': widthScale - 1,
      'mouth:openX': open * (widthScale - 1),
      'mouth:baseY': verticalScale - 1,
      'mouth:openY': open * (verticalScale * openingHeight - 1),
      'mouth:moveY': mouth.y * this.eyeDistance,
      'mouth:curve0': curve * verticalScale,
      'mouth:curve1': curve * verticalScale * open,
      'mouth:curve2': curve * verticalScale * open * open,
    };
    for (const name of Object.keys(weights)) weights[name] *= 1 - roundness;
    // Source negative openings are small round mouths. Scale the complete O
    // shape, rather than lowering its Morph weight toward the wider base lip.
    const roundScale = 0.5 * Math.min(1, scale);
    Object.assign(weights, {
      'roundMouth:baseX': roundness * (roundScale - 1),
      'roundMouth:openX': roundness * open * (roundScale - 1),
      'roundMouth:baseY': roundness * (roundScale - 1),
      'roundMouth:openY': roundness * open * (roundScale - 1),
      'roundMouth:moveY': roundness * mouth.y * this.eyeDistance,
    });
    this.mouthWork.write(weights);
  }

  applyCompanionsAndGaze(controls) {
    // These semantic keys select the recovered companion-bone bindings.
    // Morph deformation itself is bound directly to the source channels.
    for (const binding of this.bindings) {
      const side = binding.node.startsWith('Right') ? 'R' : 'L',
        eye = controls.eyes[side];
      if (binding.property === 'visible') {
        // External closure has no native recipe timing. WhiteLine is a closed
        // eyelash decoration; a mixed arc must not disappear at smile=.5.
        binding.object.visible = /EyeWhiteLine$/.test(binding.node) && eye.open <= 1e-5;
        continue;
      }
      const closed = 1 - Math.min(1, eye.open),
        wide = Math.max(0, eye.open - 1) * 2;
      const value = evaluateBinding(binding, {
        'eye/Open': Math.max(0, 1 - closed - wide),
        'eye/Close': closed * (1 - eye.smile),
        'eye/CloseSmile': closed * eye.smile,
        'eye/WideOpen': wide,
      });
      binding.object[binding.property].fromArray(value);
    }
    this.root.updateMatrixWorld(true);
    for (const [side, bone] of Object.entries(this.eyeBones)) {
      // Reuse the face-local basis measured at binding.
      this.eyeSpace.copy(this.gazeBasis[side]);
      this.origin.set(0, 0, 0).applyMatrix4(this.eyeSpace);
      this.localShift
        .set(controls.gaze.x * this.eyeDistance, controls.gaze.y * this.eyeDistance, 0)
        .applyMatrix4(this.eyeSpace)
        .sub(this.origin);
      bone.position.add(this.localShift);
      this.localShift
        .copy(this.irisPivots[side])
        .multiply(bone.scale)
        .applyQuaternion(bone.quaternion)
        .multiplyScalar(1 - controls.gaze.scale);
      bone.position.add(this.localShift);
      bone.scale.multiplyScalar(controls.gaze.scale);
    }
    this.root.updateMatrixWorld(true);
  }

  applyCheek(controls) {
    for (const runtime of this.cheekRuntimes)
      runtime.setExternalCheek({ intensity: controls.cheek, layer: 0 });
  }

  dispose() {
    this.beginFrame();
    for (const runtime of this.cheekRuntimes) runtime.setExternalCheek(null);
    this.cheekRuntimes = [];
    for (const work of this.workspaces) work.dispose();
    this.workspaces = [];
  }
}

// Published package entry: the adapter only receives component metadata and
// the shared context contract, never the host's expression-controller internals.
export function createExpressionAdapter(context) {
  if (!context.parts.some((part) => part.component.behaviors?.some((b) => b.name === 'LLAS.Face')))
    return null;
  const driver = new LlasLive2dFace(context);
  return {
    restore() {
      driver.beginFrame();
    },
    apply(parameters) {
      driver.setParameters(parameters);
      return driver.update();
    },
    dispose() {
      driver.dispose();
    },
  };
}
