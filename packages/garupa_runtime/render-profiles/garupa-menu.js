import { buildCostumeBatches, createCostumeSchedule } from './meteor-schedule.js';
import { createMeteorOit, resolveOpaqueAttachments } from './meteor-oit.js';
import { createMeteorBounds } from './meteor-bounds.js';

const phases = ['opaque', 'outline', 'accumulate', 'transparent', 'alphaWriteOff'];
const families = new Set(['garupa-meteor', 'garupa-meteor-offset', 'garupa-meteor-transparent']);

// The native controller reads Transform rotation axes, not scaled matrix
// columns. Multiplying local quaternions preserves that rule under nonuniform
// parent scale. Stored axes already include the original-to-canonical bind.
export function sourceFaceDirections(THREE, head, result) {
  const rotation = new THREE.Quaternion();
  for (let node = head; node; node = node.parent) rotation.premultiply(node.quaternion);
  const axes = head.userData.meteorFaceFrame;
  const up = new THREE.Vector3().fromArray(axes.up).applyQuaternion(rotation);
  const forward = new THREE.Vector3().fromArray(axes.forward).applyQuaternion(rotation);
  result.frontXZ[0] = up.x; result.frontXZ[1] = -up.z;
  result.rightXZ[0] = -forward.x; result.rightXZ[1] = forward.z;
  return result;
}

function inheritedLayer(object) {
  for (let node = object; node; node = node.parent) {
    if (node.userData.meteorLayer !== undefined) return node.userData.meteorLayer;
  }
  throw new Error(`Meteor mesh ${object.name} lacks original layer metadata`);
}

function visible(object) {
  for (let node = object; node; node = node.parent) if (!node.visible) return false;
  return true;
}

function belongsTo(node, root) {
  for (; node; node = node.parent) if (node === root) return true;
  return false;
}

function slotGeometry(THREE, source, slot, count) {
  if (count === 1) return source;
  // Share buffers, isolate only the primitive groups belonging to this slot.
  // No vertex/index duplication and no per-frame geometry construction.
  const geometry = new THREE.BufferGeometry();
  geometry.index = source.index;
  geometry.attributes = source.attributes;
  geometry.morphAttributes = source.morphAttributes;
  geometry.morphTargetsRelative = source.morphTargetsRelative;
  geometry.boundingBox = source.boundingBox;
  geometry.boundingSphere = source.boundingSphere;
  geometry.drawRange = { ...source.drawRange };
  for (const group of source.groups) if (group.materialIndex === slot) geometry.addGroup(group.start, group.count, 0);
  return geometry;
}

export function collectMenuRecords(THREE, root, parts = []) {
  const records = [], hidden = [], geometries = new Set(), runtimes = new Set();
  const anchors = new Map(), bounds = new Map(), runtimeBounds = new Map(), runtimeFrames = new Map();
  let head = null;
  root.traverse(object => {
    if (object.userData.__parameterizedPassObject) { hidden.push(object); return; }
    if (object.userData.meteorBoundsAnchor !== undefined) {
      const id = object.userData.meteorBoundsAnchor;
      if (anchors.has(id)) throw new Error(`Duplicate Meteor bounds anchor ${id}`);
      anchors.set(id, { node: object, localMatrix: new THREE.Matrix4() });
    }
    if (object.userData.meteorFaceFrame) {
      if (head && head !== object) throw new Error('Meteor menu root contains multiple body Head frame bindings');
      head = object;
    }
    const registry = object.userData.__parameterizedPassesByMaterial;
    if (!object.isMesh || !registry) return;
    hidden.push(object);
    const materials = object.userData.__parameterizedMaterials;
    for (let slot = 0; slot < registry.length; slot++) {
      const registered = registry[slot];
      if (!registered) continue;
      const first = Array.isArray(materials) ? materials[slot] : materials;
      if (!families.has(first?.userData?.shader)) throw new Error(`Non-Meteor shader in menu profile: ${first?.userData?.shader}`);
      const geometry = slotGeometry(THREE, object.geometry, slot, registry.length);
      if (geometry !== object.geometry) geometries.add(geometry);
      const passes = registered.map(entry => {
        const material = entry.material ?? entry.objects[0]?.material;
        if (!material) throw new Error(`Meteor pass ${entry.id} has no registered material`);
        const metadata = material.userData.materialPass;
        if (typeof metadata?.extras?.lightMode !== 'string') throw new Error(`Meteor pass ${entry.id} lacks LightMode`);
        for (const runtime of material.userData.__parameterizedShaderRuntimes ?? []) runtimes.add(runtime);
        return { id: entry.id, lightMode: metadata.extras.lightMode, material };
      });
      const renderQueue = first.userData.materialPass.renderState.renderQueue;
      let boundsNode = object;
      while (boundsNode && !boundsNode.userData.meteorBounds) boundsNode = boundsNode.parent;
      if (!boundsNode) throw new Error(`Meteor mesh ${object.name} lacks source renderer bounds`);
      if (!bounds.has(boundsNode)) bounds.set(boundsNode, { metadata: boundsNode.userData.meteorBounds,
        worldBox: new THREE.Box3(), inView: true });
      const bound = bounds.get(boundsNode);
      for (const pass of passes) for (const runtime of pass.material.userData.__parameterizedShaderRuntimes ?? []) {
        if (runtimeBounds.has(runtime) && runtimeBounds.get(runtime) !== bound) {
          throw new Error('A Meteor runtime cannot belong to different source renderer frames');
        }
        runtimeBounds.set(runtime, bound);
        if (!runtimeFrames.has(runtime)) runtimeFrames.set(runtime, {});
      }
      records.push({ source: object, geometry, vertexSource: object.geometry, bounds: bounds.get(boundsNode), grouped: registry.length > 1,
        renderQueue, layer: inheritedLayer(object), passes });
    }
  });
  // Composition removes duplicate head Humanoid nodes. Their private IDs
  // remain valid through the renderer's explicit old-node binding map.
  for (const part of parts) for (const [oldNode, binding] of part.nodeBindings ?? []) {
    if (!belongsTo(binding.node, root)) continue;
    const id = oldNode.userData.meteorBoundsAnchor;
    if (id === undefined) continue;
    if (anchors.has(id)) throw new Error(`Duplicate composed Meteor bounds anchor ${id}`);
    anchors.set(id, binding);
  }
  for (const entry of bounds.values()) entry.provider = createMeteorBounds(THREE, entry.metadata, anchors);
  return { root, records, hidden, geometries, runtimes, head, bounds, runtimeBounds, runtimeFrames,
    faceDirections: { frontXZ: [0, 0], rightXZ: [0, 0] } };
}

const outputVertex = `
precision highp float;
in vec3 position;
in vec2 uv;
out vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position, 1.0); }
`;
// Original BlendBuffer stores remaining transparency in A. The canvas expects
// coverage. Keep the native composite intact and adapt the output convention
// once, after all native draws. Encoding follows unpremultiply -> sRGB ->
// premultiply when the host canvas requests premultiplied alpha.
export const menuOutputFragment = `
precision highp float;
uniform sampler2D sourceColor;
uniform bool remainingAlpha;
uniform bool encodeSRGB;
uniform bool premultiplyOutput;
in vec2 vUv;
out vec4 color;
vec3 linearToSRGB(vec3 v) {
  return mix(1.055 * pow(v, vec3(1.0 / 2.4)) - 0.055,
    v * 12.92, lessThanEqual(v, vec3(0.0031308)));
}
void main() {
  vec4 value = texture(sourceColor, vUv);
  float coverage = clamp(remainingAlpha ? 1.0 - value.a : value.a, 0.0, 1.0);
  vec3 straight = coverage > 0.0 ? value.rgb / coverage : vec3(0.0);
  if (encodeSRGB) straight = linearToSRGB(straight);
  color = vec4(premultiplyOutput ? straight * coverage : straight, coverage);
}
`;

export function createRenderProfile({ THREE, renderer, parts = [], diagnostics = null }) {
  const gl = renderer.getContext();
  for (const format of [gl.RGBA8, gl.DEPTH_COMPONENT24]) {
    const supported = gl.getInternalformatParameter(gl.RENDERBUFFER, format, gl.SAMPLES);
    if (!supported || !Array.from(supported).includes(4)) {
      throw new Error('Meteor requires 4x MSAA support for RGBA8 and 24-bit depth');
    }
  }
  const groups = new Map(), schedule = createCostumeSchedule();
  const cameraFrustum = new THREE.Frustum(), projectionView = new THREE.Matrix4();
  const oit = createMeteorOit({ THREE, renderer });
  const main = new THREE.WebGLRenderTarget(1, 1, { type: THREE.UnsignedByteType,
    format: THREE.RGBAFormat, depthBuffer: true, stencilBuffer: false, samples: 0,
    minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
  main.texture.colorSpace = THREE.NoColorSpace;
  let preparationRevision = 0, preparedRevision = -1;
  main.depthTexture = new THREE.DepthTexture(1, 1, THREE.UnsignedIntType);
  // Unlike the reference menu, host-sized portraits need multisample coverage
  // for fine outlines. Live's highest quality provides the 4x MSAA reference.
  const opaque = new THREE.WebGLRenderTarget(1, 1, { type: THREE.UnsignedByteType,
    format: THREE.RGBAFormat, depthBuffer: true, stencilBuffer: false, samples: 4,
    minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
  opaque.texture.colorSpace = THREE.NoColorSpace;
  opaque.depthTexture = new THREE.DepthTexture(1, 1, THREE.UnsignedIntType);
  const phaseScenes = Object.fromEntries(phases.map(name => [name, new THREE.Scene()]));
  const draws = Object.fromEntries(phases.map(name => [name, []]));
  const outputScene = new THREE.Scene(), outputCamera = new THREE.Camera();
  const outputGeometry = new THREE.BufferGeometry();
  outputGeometry.setAttribute('position', new THREE.Float32BufferAttribute([-1,-1,0, 3,-1,0, -1,3,0], 3));
  outputGeometry.setAttribute('uv', new THREE.Float32BufferAttribute([0,0, 2,0, 0,2], 2));
  const outputUniforms = { sourceColor: { value: main.texture }, remainingAlpha: { value: false },
    encodeSRGB: { value: true }, premultiplyOutput: { value: true } };
  const outputMaterial = new THREE.RawShaderMaterial({ vertexShader: outputVertex, fragmentShader: menuOutputFragment,
    uniforms: outputUniforms, glslVersion: THREE.GLSL3, depthTest: false, depthWrite: false,
    blending: THREE.NoBlending, side: THREE.DoubleSide, toneMapped: false });
  const outputMesh = new THREE.Mesh(outputGeometry, outputMaterial);
  outputMesh.frustumCulled = false; outputScene.add(outputMesh);
  const lightPosition = new THREE.Vector3(), targetPosition = new THREE.Vector3(), center = new THREE.Vector3();
  const cameraPosition = new THREE.Vector3();
  let lightScene = null, lights = [];

  function rebuild() {
    for (const name of phases) { phaseScenes[name].clear(); draws[name].length = 0; }
    const batches = buildCostumeBatches([...groups.values()].flatMap(group => group.records));
    for (const name of phases) for (const item of batches[name]) {
      const { source, geometry } = item.record;
      // Three submits geometry.groups only for an array material. A scalar
      // here would draw the whole shared index buffer for every source slot.
      const material = item.record.grouped ? [item.pass.material] : item.pass.material;
      const proxy = source.isSkinnedMesh ? new THREE.SkinnedMesh(geometry, material) : new THREE.Mesh(geometry, material);
      proxy.name = `${source.name}:${item.pass.id}`;
      proxy.matrixAutoUpdate = false;
      proxy.frustumCulled = false;
      proxy.morphTargetInfluences = source.morphTargetInfluences;
      proxy.morphTargetDictionary = source.morphTargetDictionary;
      if (source.isSkinnedMesh) {
        proxy.skeleton = source.skeleton;
        proxy.bindMode = source.bindMode;
        proxy.bindMatrix.copy(source.bindMatrix);
        proxy.bindMatrixInverse.copy(source.bindMatrixInverse);
      }
      phaseScenes[name].add(proxy);
      draws[name].push({ ...item, proxy, depth: 0 });
    }
  }

  function frameInputs(scene, camera) {
    // Cache membership once; light objects themselves remain live. A host that
    // changes the rig can supply exact frame inputs or replace the cached list
    // explicitly with scene.userData.meteorLights.
    if (scene !== lightScene) {
      lights = []; scene.traverse(node => { if (node.isLight) lights.push(node); });
      lightScene = scene;
    }
    const explicit = scene.userData.meteorFrame ?? {};
    const rig = scene.userData.meteorLights ?? lights;
    const mainLights = rig.filter(light => light.isDirectionalLight && visible(light));
    if (mainLights.length > 1 && explicit.mainLightPosition === undefined) throw new Error('Meteor menu requires explicit mainLightPosition for multiple directional lights');
    const directional = mainLights[0];
    let position = [0, 0, 1, 0], color = [0, 0, 0, 1];
    if (directional) {
      directional.getWorldPosition(lightPosition); directional.target.getWorldPosition(targetPosition);
      lightPosition.sub(targetPosition).normalize();
      position = [...lightPosition.toArray(), 0];
      color = [directional.color.r * directional.intensity, directional.color.g * directional.intensity,
        directional.color.b * directional.intensity, 1];
    }
    const ambient = [0, 0, 0];
    for (const light of rig) if (light.isAmbientLight && visible(light)) {
      ambient[0] += light.color.r * light.intensity; ambient[1] += light.color.g * light.intensity;
      ambient[2] += light.color.b * light.intensity;
    }
    if (rig.some(light => visible(light) && !light.isAmbientLight && !light.isDirectionalLight)
        && explicit.sh === undefined && explicit.uniforms === undefined) {
      throw new Error('Meteor menu needs explicit source SH/additional-light inputs for this host light rig');
    }
    // Native ForwardLights.Setup + ShAutoDetect: source mobile Auto mode uses
    // PerVertex SH and explicitly sets EVALUATE_SH_VERTEX. Evidence is in
    // validation/urp-sh-keyword-evidence.json; additional lights are separate.
    return { targetHeight: main.height, globalKeywords: ['EVALUATE_SH_VERTEX'], mainLightPosition: position, mainLightColor: color,
      ambientRGB: ambient, ...explicit, targetHeight: main.height };
  }

  function updateDraws(camera) {
    camera.getWorldPosition(cameraPosition);
    for (const name of phases) {
      const transparent = name === 'accumulate' || name === 'transparent' || name === 'alphaWriteOff';
      for (const item of draws[name]) {
        const { source, geometry, grouped } = item.record;
        // Parameter adapters can activate a private geometry for this actor.
        // Material-slot views keep their draw groups and share its live buffers.
        if (grouped && item.record.vertexSource !== source.geometry) {
          const live = source.geometry;
          geometry.index = live.index;
          geometry.attributes = live.attributes;
          geometry.morphAttributes = live.morphAttributes;
          geometry.morphTargetsRelative = live.morphTargetsRelative;
          geometry.boundingBox = live.boundingBox;
          geometry.boundingSphere = live.boundingSphere;
          geometry.drawRange = live.drawRange;
          item.record.vertexSource = live;
        }
        item.proxy.geometry = grouped ? geometry : source.geometry;
        item.proxy.morphTargetInfluences = source.morphTargetInfluences;
        item.proxy.morphTargetDictionary = source.morphTargetDictionary;
        // CharacterRenderer disables Three's skinned bounding-sphere culling.
        // Native renderer bounds remain authoritative for this profile.
        item.proxy.visible = visible(source) && source.layers.test(camera.layers) && item.record.bounds.inView;
        item.proxy.layers.mask = source.layers.mask;
        item.proxy.matrix.copy(source.matrixWorld);
        item.proxy.matrixWorldNeedsUpdate = true;
        center.copy(item.record.bounds.state.center);
        item.depth = camera.isOrthographicCamera ? center.applyMatrix4(camera.matrixWorldInverse).z * -1 : center.distanceToSquared(cameraPosition);
      }
      draws[name].sort((a, b) => a.record.renderQueue - b.record.renderQueue ||
        (transparent ? b.depth - a.depth : a.depth - b.depth));
      draws[name].forEach((item, index) => { item.proxy.renderOrder = index; });
    }
  }

  function sizeTargets({ scene, viewport }) {
    if (!Number.isFinite(viewport?.z) || !Number.isFinite(viewport?.w)
        || viewport.z <= 0 || viewport.w <= 0) {
      throw new Error('Meteor requires a positive physical-pixel viewport');
    }
    if (Object.hasOwn(scene.userData.meteorFrame ?? {}, 'colorTarget')) {
      throw new Error('Meteor color target uses linear RGBA8; colorTarget override is unsupported');
    }
    const width = Math.max(1, Math.round(viewport.z));
    const height = Math.max(1, Math.round(viewport.w));
    if (main.width !== width || main.height !== height) {
      main.setSize(width, height);
      opaque.setSize(width, height);
      preparationRevision++;
    }
  }

  function updateFrame({ scene, camera }) {
    scene.updateMatrixWorld(true); camera.updateMatrixWorld(true);
    cameraFrustum.setFromProjectionMatrix(projectionView.multiplyMatrices(camera.projectionMatrix,
      camera.matrixWorldInverse), camera.coordinateSystem);
    const frame = frameInputs(scene, camera);
    for (const group of groups.values()) {
      for (const entry of group.bounds.values()) {
        entry.state = entry.provider.update();
        entry.worldBox.min.copy(entry.state.center).sub(entry.state.extents);
        entry.worldBox.max.copy(entry.state.center).add(entry.state.extents);
        entry.inView = cameraFrustum.intersectsBox(entry.worldBox);
      }
      const localFrame = group.head ? { ...frame, faceDirections: sourceFaceDirections(THREE, group.head, group.faceDirections) } : frame;
      for (const runtime of group.runtimes) {
        const objectMatrix = group.runtimeBounds.get(runtime).state.sourceObjectMatrix;
        if (!objectMatrix?.isMatrix4) throw new Error('Meteor source renderer frame was not restored');
        // Native skinned Shader inputs and unity_ObjectToWorld use the
        // current rootBone frame, not the GLTF mesh's post-skin frame.
        const runtimeFrame = group.runtimeFrames.get(runtime);
        for (const key in runtimeFrame) {
          if (key !== 'objectMatrix' && !Object.hasOwn(localFrame, key)) delete runtimeFrame[key];
        }
        runtime.setFrame(Object.assign(runtimeFrame, localFrame, { objectMatrix }));
      }
    }
    updateDraws(camera);
  }

  return {
    attach(root) {
      if (groups.has(root)) return;
      groups.set(root, collectMenuRecords(THREE, root, parts)); rebuild();
      preparationRevision++;
    },
    detach(root) {
      const group = groups.get(root);
      if (!group) return;
      groups.delete(root); rebuild();
      preparationRevision++;
      for (const geometry of group.geometries) geometry.dispose();
    },
    async prepare(frame) {
      if (typeof frame.cancelled !== 'function') throw new Error('Meteor preparation requires the host cancellation signal');
      if (frame.cancelled()) return;
      sizeTargets(frame);
      const revision = preparationRevision;
      if (preparedRevision === revision) return;
      // The first source invocation primes OIT; the next executes its full
      // transparent path. Realize both while the host owns the warm-up surface.
      for (let pass = 0; pass < 2; pass++) {
        if (frame.cancelled()) return;
        this.render(frame);
        await new Promise(resolve => setTimeout(resolve, 0));
      }
      if (!frame.cancelled() && preparationRevision === revision) preparedRevision = revision;
    },
    render({ scene, camera, target, viewport, scissor, scissorTest }) {
      const frame = { scene, camera, target, viewport, scissor, scissorTest };
      sizeTargets(frame);
      updateFrame(frame);
      const saved = [];
      for (const group of groups.values()) for (const object of group.hidden) {
        saved.push([object, object.visible]); object.visible = false;
      }
      renderer.autoClear = false;
      let remainingAlpha = false;
      let opaqueResolved = false;
      const resolveOpaque = () => {
        if (opaqueResolved) return;
        const started = diagnostics?.enabled ? performance.now() : null;
        try {
          resolveOpaqueAttachments(THREE, renderer, opaque, main);
          renderer.setRenderTarget(main); renderer.setScissorTest(false);
          opaqueResolved = true;
        } finally {
          if (started !== null) diagnostics.record('resolveOpaque', performance.now() - started);
        }
      };
      try {
        renderer.setRenderTarget(opaque); renderer.setScissorTest(false);
        renderer.setClearColor(0, 0); renderer.clear(true, true, false);
        renderer.render(scene, camera);
        schedule.render({ setup: () => oit.setup(main), command(name) {
          // The first invocation skips OIT, but must resolve before any later
          // transparent draw too. Resolve outside that command's diagnostics.
          if (name === 'copyDepthIn' || name === 'transparent' || name === 'alphaWriteOff') resolveOpaque();
          const started = diagnostics?.enabled ? performance.now() : null;
          try {
            if (phases.includes(name)) {
              renderer.render(phaseScenes[name], camera);
            } else if (name === 'copyDepthIn') oit.copyDepthIn(main);
            else if (name === 'bindOitMrt') oit.bind();
            else if (name === 'clearOit') oit.clear();
            else if (name === 'saveSourceColor') oit.saveSourceColor(main);
            else if (name === 'bindOitGlobals') oit.bindGlobals();
            else if (name === 'compositeForBlendBuffer') { oit.composite(main, true); remainingAlpha = true; }
            else if (name === 'copyDepthBack') oit.copyDepthBack(main);
          } finally {
            if (started !== null) diagnostics.record(name, performance.now() - started);
          }
        } });
        resolveOpaque();
        renderer.setRenderTarget(target);
        // Scope rectangles are physical pixels, while setViewport/Scissor use
        // logical canvas units. State setters keep target dimensions intact.
        renderer.state.viewport(viewport);
        renderer.state.scissor(scissor);
        renderer.state.setScissorTest(scissorTest);
        outputUniforms.remainingAlpha.value = remainingAlpha;
        // An sRGB render attachment performs its transfer in hardware. The
        // default canvas instead needs Three's usual shader-side transfer.
        outputUniforms.encodeSRGB.value = !target && renderer.outputColorSpace === THREE.SRGBColorSpace;
        outputUniforms.premultiplyOutput.value = target ? true : renderer.getContext().getContextAttributes().premultipliedAlpha;
        const outputStarted = diagnostics?.enabled ? performance.now() : null;
        renderer.render(outputScene, outputCamera);
        if (outputStarted !== null) diagnostics.record('output', performance.now() - outputStarted);
      } finally {
        for (const [object, wasVisible] of saved) object.visible = wasVisible;
      }
    },
    resourceEstimate() {
      const sourceBytes = main.texture.type === THREE.HalfFloatType ? 8 : 4;
      return { width: main.width, height: main.height, sourceType: main.texture.type,
        opaqueSamples: 4, opaqueMsaaBytes: main.width * main.height * 8 * 4,
        opaqueResolveBytes: main.width * main.height * 8,
        sourceColorSpace: main.texture.colorSpace, sourceAndCopyBytes: main.width * main.height * sourceBytes * 2,
        oitColorBytes: main.width * main.height * 8 * 2, depthBytes: main.width * main.height * 4 * 2,
        note: 'Allocated attachment estimate; 24-bit depth is budgeted as four bytes per pixel. Driver overhead excluded.' };
    },
    destroy() {
      for (const group of groups.values()) for (const geometry of group.geometries) geometry.dispose();
      groups.clear();
      for (const scene of Object.values(phaseScenes)) scene.clear();
      schedule.destroy(); oit.destroy(); opaque.dispose(); main.dispose(); outputGeometry.dispose(); outputMaterial.dispose();
    },
  };
}
