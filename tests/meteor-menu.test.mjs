import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { collectMenuRecords, createRenderProfile, sourceFaceDirections } from '../packages/garupa_runtime/render-profiles/garupa-menu.js';
import { createRenderProfileScope } from '../../webgal-lovelive-gltf-renderer/src/render-profiles.js';

function fixture() {
  const root = new THREE.Group();
  root.userData.meteorLayer = 20;
  root.userData.meteorBoundsAnchor = 'body:0';
  const geometry = new THREE.BoxGeometry(.3, 1.37, .2);
  const material = new THREE.MeshStandardMaterial();
  const frames = [];
  material.userData = { shader: 'garupa-meteor', materialPass: { id: 'Forward',
    renderState: { renderQueue: 2000 }, extras: { lightMode: 'UniversalForward' } },
    __parameterizedShaderRuntimes: [{ setFrame: frame => frames.push(frame) }] };
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'body'; root.add(mesh);
  const matrix = new THREE.Matrix4().toArray();
  mesh.userData.meteorBounds = { rendererId: 'fixture', root: { node: 'body:0', bindMatrix: matrix },
    updateWhenOffscreen: true, localBounds: { center: [0, 0, 0], extents: [.15, .685, .1] },
    bones: [{ node: 'body:0', bindMatrix: matrix, center: [0, 0, 0], extents: [.15, .685, .1] }] };
  mesh.userData.__parameterizedMaterials = material;
  mesh.userData.__parameterizedPassesByMaterial = [[{ id: 'Forward', material, objects: [] }]];
  return { root, mesh, geometry, material, frames };
}

test('cached menu membership uses original layer and provided pass metadata', () => {
  const f = fixture();
  const group = collectMenuRecords(THREE, f.root);
  assert.equal(group.records.length, 1);
  assert.equal(group.records[0].layer, 20);
  assert.equal(group.records[0].geometry, f.geometry);
  assert.equal(group.records[0].passes[0].lightMode, 'UniversalForward');
  delete f.root.userData.meteorLayer;
  assert.throws(() => collectMenuRecords(THREE, f.root), /original layer/);
});

test('face directions follow original rotation axes under nonuniform parent scale', () => {
  const root = new THREE.Group(), head = new THREE.Bone(); root.add(head);
  root.rotation.set(.317, -.731, .137); root.scale.set(1.7, .43, 2.3);
  head.rotation.set(-.193, .571, -.239);
  head.userData.meteorFaceFrame = { up: [.13, .97, -.17], forward: [.31, .19, .93] };
  const q = root.quaternion.clone().multiply(head.quaternion);
  const up = new THREE.Vector3(...head.userData.meteorFaceFrame.up).applyQuaternion(q);
  const forward = new THREE.Vector3(...head.userData.meteorFaceFrame.forward).applyQuaternion(q);
  const result = { frontXZ: [0, 0], rightXZ: [0, 0] };
  assert.equal(sourceFaceDirections(THREE, head, result), result);
  assert.deepEqual(result, { frontXZ: [up.x, -up.z], rightXZ: [-forward.x, forward.z] });
});

test('composed head source IDs resolve through parts bindings after their duplicate bones leave the tree', () => {
  const f = fixture(), detachedHead = new THREE.Bone();
  detachedHead.userData.meteorBoundsAnchor = 'head:3';
  f.mesh.userData.meteorBounds.bones[0].node = 'head:3';
  const localMatrix = new THREE.Matrix4().makeTranslation(.239, -.317, .731);
  const parts = [{ nodeBindings: new Map([[detachedHead, { node: f.root, localMatrix }]]) }];
  f.root.updateMatrixWorld(true);
  const group = collectMenuRecords(THREE, f.root, parts);
  const result = group.records[0].bounds.provider.update();
  for (const [actual, expected] of result.center.toArray().map((value, i) => [value, [.239, -.317, .731][i]])) {
    assert.ok(Math.abs(actual - expected) < 1e-12);
  }
  assert.throws(() => collectMenuRecords(THREE, f.root), /missing bone 0 anchor head:3/);
});

test('one shared profile keeps identical private anchor IDs independent for separate actors', () => {
  const a = fixture(), b = fixture(); b.root.position.x = 1.7;
  const oldA = new THREE.Bone(), oldB = new THREE.Bone();
  oldA.userData.meteorBoundsAnchor = oldB.userData.meteorBoundsAnchor = 'head:3';
  a.mesh.userData.meteorBounds.bones[0].node = b.mesh.userData.meteorBounds.bones[0].node = 'head:3';
  const matrix = new THREE.Matrix4().makeTranslation(.239, -.317, .731);
  const parts = [{ nodeBindings: new Map([[oldA, { node: a.root, localMatrix: matrix }]]) },
    { nodeBindings: new Map([[oldB, { node: b.root, localMatrix: matrix }]]) }];
  a.root.updateMatrixWorld(true); b.root.updateMatrixWorld(true);
  const first = collectMenuRecords(THREE, a.root, parts).records[0].bounds.provider.update().center;
  const second = collectMenuRecords(THREE, b.root, parts).records[0].bounds.provider.update().center;
  assert.ok(Math.abs(second.x - first.x - 1.7) < 1e-12);
  assert.ok(Math.abs(second.y - first.y) < 1e-12);
  assert.ok(Math.abs(second.z - first.z) < 1e-12);
});

function hostFixture(width = 810, height = 1080) {
  const f = fixture(), scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, width / height, .01, 100);
  const ambient = new THREE.AmbientLight(new THREE.Color(.137, .239, .371), 1);
  const light = new THREE.DirectionalLight(0xffffff, .731);
  light.position.set(3, 5, 4); scene.add(f.root, ambient, light); camera.position.z = 3;
  const head = new THREE.Bone(); head.userData.meteorFaceFrame = { up: [0, 1, 0], forward: [0, 0, 1] };
  f.root.add(head);
  const snapshots = [];
  f.material.userData.__parameterizedShaderRuntimes[0].setFrame = value => {
    snapshots.push({ ...value, ambientRGB: value.ambientRGB.slice(),
      mainLightPosition: value.mainLightPosition.slice(),
      faceDirections: { frontXZ: value.faceDirections.frontXZ.slice(), rightXZ: value.faceDirections.rightXZ.slice() },
      objectMatrix: value.objectMatrix.clone() });
  };
  const rendered = [], blits = [], clears = [], operations = [], targets = new Set();
  let currentTarget = null, readFramebuffer = null, drawFramebuffer = null, throwOnDraw = false, scissorTest = false;
  const clearColor = new THREE.Color(.2, .3, .4); let clearAlpha = .6;
  const viewport = new THREE.Vector4(0, 0, width, height), scissor = viewport.clone();
  const gl = { FRAMEBUFFER_BINDING: 0x8ca6, READ_FRAMEBUFFER: 0x8ca8, DRAW_FRAMEBUFFER: 0x8ca9,
    READ_FRAMEBUFFER_BINDING: 0x8caa, DRAW_FRAMEBUFFER_BINDING: 0x8ca6,
    FRAMEBUFFER: 0x8d40, RENDERBUFFER: 0x8d41, RGBA8: 0x8058, DEPTH_COMPONENT24: 0x81a6, SAMPLES: 0x80a9,
    COLOR_BUFFER_BIT: 0x4000, DEPTH_BUFFER_BIT: 0x0100, NEAREST: 0x2600, SCISSOR_TEST: 0x0c11,
    getContextAttributes: () => ({ premultipliedAlpha: true }),
    getInternalformatParameter: () => new Int32Array([4, 2, 1]),
    getParameter(parameter) {
      if (parameter === this.SAMPLES) return drawFramebuffer?.samples ?? 0;
      if (parameter === this.READ_FRAMEBUFFER_BINDING) return readFramebuffer;
      return drawFramebuffer;
    },
    bindFramebuffer(binding, framebuffer) {
      if (binding !== this.DRAW_FRAMEBUFFER) readFramebuffer = framebuffer;
      if (binding !== this.READ_FRAMEBUFFER) drawFramebuffer = framebuffer;
    },
    disable() {}, blitFramebuffer(...args) {
      blits.push(args); operations.push({ kind: 'blit', args, source: readFramebuffer, target: drawFramebuffer });
    } };
  const renderer = { extensions: { has: () => true },
    state: { viewport: value => viewport.copy(value), scissor: value => scissor.copy(value),
      setScissorTest: value => { scissorTest = value; } },
    setRenderTarget: target => {
      currentTarget = readFramebuffer = drawFramebuffer = target;
      if (target) targets.add(target);
    }, getRenderTarget: () => currentTarget,
    getActiveCubeFace: () => 0, getActiveMipmapLevel: () => 0,
    setScissorTest: value => { scissorTest = value; }, getScissorTest: () => scissorTest,
    setViewport: value => viewport.copy(value), getViewport: value => value.copy(viewport),
    setScissor: value => scissor.copy(value), getScissor: value => value.copy(scissor),
    getClearColor: value => value.copy(clearColor), getClearAlpha: () => clearAlpha,
    setClearColor(value, alpha) { clearColor.set(value); if (alpha !== undefined) clearAlpha = alpha; },
    clear: (...args) => clears.push({ target: currentTarget, args }), resetState() {},
    outputColorSpace: THREE.SRGBColorSpace, getContext: () => gl,
    render(drawScene) {
      if (throwOnDraw) throw new Error('deliberate draw failure');
      rendered.push({ scene: drawScene, target: currentTarget,
        fragments: drawScene.children.map(object => object.material?.fragmentShader ?? '') });
      operations.push({ kind: 'draw', scene: drawScene, target: currentTarget });
      if (drawScene === scene) assert.equal(f.mesh.visible, false, 'original source is hidden while pass proxies draw');
    } };
  const profile = createRenderProfile({ THREE, renderer }); profile.attach(f.root);
  const frame = { scene, camera, target: null, viewport: viewport.clone(), scissor: scissor.clone(), scissorTest: false, cancelled: () => false };
  return { ...f, renderer, scene, camera, ambient, light, head, profile, frame, rendered, blits, clears, snapshots, operations, targets, gl,
    failDraw: value => { throwOnDraw = value; },
    bodyProxy: () => rendered.flatMap(item => item.scene.children).find(object => object.name === 'body:Forward'),
    destroy: () => { profile.detach(f.root); profile.destroy(); } };
}

test('host physical viewport determines targets and resizes without changing source storage or camera', async () => {
  const f = hostFixture();
  await f.profile.prepare(f.frame);
  const estimate = f.profile.resourceEstimate();
  assert.equal(estimate.width, 810); assert.equal(estimate.height, 1080);
  assert.equal(estimate.sourceType, THREE.UnsignedByteType);
  assert.equal(estimate.sourceColorSpace, THREE.NoColorSpace);
  assert.equal(f.snapshots.at(-1).targetHeight, 1080);
  const source = f.clears.find(item => item.target)?.target;
  assert.ok(source); assert.equal(source.samples, 4);
  assert.equal(source.depthTexture.type, THREE.UnsignedIntType);
  assert.equal(estimate.opaqueSamples, 4);
  assert.equal(estimate.opaqueMsaaBytes, 810 * 1080 * 8 * 4);
  assert.equal(estimate.opaqueResolveBytes, 810 * 1080 * 8);
  const camera = f.camera.matrixWorld.clone(), projection = f.camera.projectionMatrix.clone();
  const previousBlits = f.blits.length;
  f.frame.viewport.set(13, 29, 1080.4, 1439.6);
  await f.profile.prepare(f.frame);
  assert.equal(f.profile.resourceEstimate().width, 1080);
  assert.equal(f.profile.resourceEstimate().height, 1440);
  assert.equal(f.snapshots.at(-1).targetHeight, 1440);
  assert.ok(f.blits.length > previousBlits, 'resized attachments are warmed before prepare resolves');
  for (const target of f.targets) assert.deepEqual([target.width, target.height], [1080, 1440]);
  f.frame.viewport.set(7, 11, 640, 960);
  assert.equal(f.profile.render(f.frame), undefined);
  assert.equal(f.profile.resourceEstimate().width, 640);
  assert.equal(f.profile.resourceEstimate().height, 960);
  assert.equal(f.snapshots.at(-1).targetHeight, 960, 'ordinary draw follows a changed host viewport synchronously');
  for (const target of f.targets) assert.deepEqual([target.width, target.height], [640, 960]);
  assert.ok(f.camera.matrixWorld.equals(camera)); assert.ok(f.camera.projectionMatrix.equals(projection));
  f.destroy();
});

test('host viewport rejects nonfinite or nonpositive dimensions before rendering', async () => {
  const f = hostFixture();
  for (const [width, height] of [[0, 1080], [810, 0], [-1, 1080], [810, NaN], [Infinity, 1080]]) {
    const frame = { ...f.frame, viewport: new THREE.Vector4(0, 0, width, height) };
    await assert.rejects(async () => f.profile.prepare(frame), /viewport|dimension|positive|size/i);
  }
  assert.equal(f.rendered.length, 0);
  f.destroy();
});

test('opaque and outline draw on MSAA before resolve while OIT and output retain their own targets', async () => {
  const f = hostFixture();
  await f.profile.prepare(f.frame);
  const resolveMask = f.gl.COLOR_BUFFER_BIT | f.gl.DEPTH_BUFFER_BIT;
  const resolves = f.operations.filter(item => item.kind === 'blit' && item.args[8] === resolveMask);
  assert.equal(resolves.length, 2);
  const opaque = resolves[0].source, main = resolves[0].target;
  assert.equal(opaque.samples, 4); assert.equal(main.samples, 0);
  assert.notEqual(opaque, main);
  for (const resolve of resolves) {
    assert.equal(resolve.source, opaque); assert.equal(resolve.target, main);
    const index = f.operations.indexOf(resolve);
    const initial = f.operations.slice(index - 3, index);
    assert.deepEqual(initial.map(item => item.kind), ['draw', 'draw', 'draw']);
    for (const draw of initial) assert.equal(draw.target, opaque, 'scene, opaque and outline use the MSAA target');
  }
  const firstResolve = f.operations.indexOf(resolves[0]);
  const secondScene = f.operations.findIndex((item, index) => index > firstResolve && item.scene === f.scene);
  const firstTail = f.operations.slice(firstResolve + 1, secondScene);
  assert.deepEqual(firstTail.map(item => item.target), [main, main, null],
    'first invocation resolves before transparent, alpha-write-off and host output');
  const depthCopies = f.operations.filter(item => item.kind === 'blit' && item.args[8] === f.gl.DEPTH_BUFFER_BIT);
  assert.equal(depthCopies.length, 2);
  assert.ok(f.operations.indexOf(depthCopies[0]) > f.operations.indexOf(resolves[1]));
  assert.equal(depthCopies[0].source, main);
  const oit = depthCopies[0].target;
  assert.equal(oit.samples, 0); assert.equal(oit.textures.length, 2);
  assert.equal(depthCopies[1].source, oit); assert.equal(depthCopies[1].target, main);
  assert.equal(f.rendered.at(-1).target, null);
  const ownedTargets = [...f.targets], disposed = new Set();
  for (const target of ownedTargets) target.addEventListener('dispose', () => disposed.add(target));
  f.destroy();
  assert.equal(disposed.size, ownedTargets.length, 'destroy releases both opaque targets and all OIT attachments');
});

test('awaited prepare warms the complete OIT pipeline once and invalidates on membership changes', async () => {
  const f = hostFixture();
  await f.profile.prepare(f.frame);
  assert.deepEqual(f.blits.map(args => args[8]), [f.gl.COLOR_BUFFER_BIT | f.gl.DEPTH_BUFFER_BIT,
    f.gl.COLOR_BUFFER_BIT | f.gl.DEPTH_BUFFER_BIT, f.gl.DEPTH_BUFFER_BIT, f.gl.DEPTH_BUFFER_BIT],
  'both source invocations resolve opaque color/depth before the full OIT depth-copy pair');
  const firstBlits = f.blits;
  for (const args of firstBlits) assert.deepEqual(args.slice(0, 8), [0, 0, 810, 1080, 0, 0, 810, 1080]);
  assert.ok(f.rendered.some(item => item.fragments.some(source => source.includes('texture(_AccumTex'))),
    'transparent composite has really drawn before preparation completes');
  const count = f.rendered.length, blits = f.blits.length;
  await f.profile.prepare(f.frame);
  assert.equal(f.rendered.length, count, 'resident preparation reuses already-warmed attachments');
  assert.equal(f.blits.length, blits);
  const other = fixture(); other.root.position.x = .5; f.scene.add(other.root); f.profile.attach(other.root);
  await f.profile.prepare(f.frame);
  assert.ok(f.rendered.length > count, 'newly attached materials receive preparation draws');
  assert.ok(f.mesh.visible); assert.ok(other.mesh.visible);
  f.profile.detach(other.root); f.destroy();
});

test('synchronous render refreshes moving bounds, face direction, layers and lights without another prepare', async () => {
  const f = hostFixture(); await f.profile.prepare(f.frame);
  const body = f.bodyProxy(); assert.ok(body); assert.equal(body.material, f.material);
  assert.deepEqual(f.snapshots.at(-1).globalKeywords, ['EVALUATE_SH_VERTEX']);
  assert.deepEqual(f.snapshots.at(-1).ambientRGB, [.137, .239, .371]);
  const initialFace = f.snapshots.at(-1).faceDirections;
  f.head.rotation.set(.193, -.571, .317);
  f.ambient.color.setRGB(.41, .23, .17); f.ambient.intensity = .65;
  f.light.position.set(-2, 4, 1);
  f.mesh.layers.set(3); f.camera.layers.set(3);
  assert.equal(f.profile.render(f.frame), undefined, 'normal drawing remains synchronous');
  assert.equal(body.layers.mask, 8); assert.ok(body.visible);
  assert.notDeepEqual(f.snapshots.at(-1).faceDirections, initialFace);
  const expected = sourceFaceDirections(THREE, f.head, { frontXZ: [0, 0], rightXZ: [0, 0] });
  assert.deepEqual(f.snapshots.at(-1).faceDirections, expected);
  assert.deepEqual(f.snapshots.at(-1).ambientRGB, [.41 * .65, .23 * .65, .17 * .65]);
  const direction = new THREE.Vector3(-2, 4, 1).normalize().toArray();
  direction.forEach((value, index) => assert.ok(Math.abs(f.snapshots.at(-1).mainLightPosition[index] - value) < 1e-12));
  const camera = f.camera.matrixWorld.clone(), projection = f.camera.projectionMatrix.clone();
  f.mesh.frustumCulled = false;
  f.root.position.x = 30; f.profile.render(f.frame);
  assert.equal(body.visible, false, 'moved native bounds leave the fixed camera frustum');
  f.root.position.x = .2; f.profile.render(f.frame);
  assert.equal(body.visible, true, 'returning bounds are reconsidered by the next ordinary draw');
  assert.ok(f.camera.matrixWorld.equals(camera)); assert.ok(f.camera.projectionMatrix.equals(projection));
  f.failDraw(true);
  assert.throws(() => f.profile.render(f.frame), /deliberate draw failure/);
  assert.ok(f.mesh.visible, 'draw failure restores the source visibility');
  f.destroy();
});

for (const immediately of [true, false]) test(`cancelled ${immediately ? 'queued' : 'yielding'} preparation stops before released Shader state is read`, async () => {
  const f = hostFixture(), scope = createRenderProfileScope(f.profile, f.renderer), events = [];
  const detach = f.profile.detach.bind(f.profile), destroy = f.profile.destroy.bind(f.profile);
  f.profile.detach = root => { events.push('detach'); detach(root); };
  f.profile.destroy = () => { events.push('destroy'); destroy(); };
  scope.attach(f.root);
  let released = false, scheduled = false, readsAfterRelease = 0, drawsAfterRelease = 0;
  const runtime = f.material.userData.__parameterizedShaderRuntimes[0], setFrame = runtime.setFrame;
  runtime.setFrame = value => {
    if (released) { readsAfterRelease++; throw new Error('released Shader runtime'); }
    setFrame(value);
  };
  const cancel = () => {
    // CharacterRenderer.clear defers profile cleanup, then immediately releases
    // the Shader runtime and removes the root while prepare is still pending.
    scope.dispose(); released = true; f.scene.remove(f.root);
  };
  const draw = f.renderer.render;
  f.renderer.render = function (...args) {
    if (released) drawsAfterRelease++;
    const result = draw.apply(this, args);
    if (!immediately && !scheduled) { scheduled = true; queueMicrotask(cancel); }
    return result;
  };
  const pending = scope.prepare(f.scene, f.camera, 0, 0);
  if (immediately) cancel();
  await pending;
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(readsAfterRelease, 0);
  assert.equal(drawsAfterRelease, 0);
  if (immediately) assert.equal(f.rendered.length, 0, 'queued cancellation prevents the first warm-up draw');
  else assert.ok(f.rendered.length > 0, 'cancellation happens after real warm-up work has begun');
  assert.equal(f.blits.filter(args => args[8] === f.gl.DEPTH_BUFFER_BIT).length, 0,
    'cancelled first invocation never reaches OIT depth work');
  assert.equal(f.blits.filter(args => args[8] === (f.gl.COLOR_BUFFER_BIT | f.gl.DEPTH_BUFFER_BIT)).length,
    immediately ? 0 : 1, 'only a started first invocation performs its opaque resolve');
  assert.deepEqual(events, ['detach', 'destroy']);
  assert.equal(f.renderer.getRenderTarget(), null);
  assert.deepEqual(f.renderer.getViewport(new THREE.Vector4()).toArray(), [0, 0, 810, 1080]);
  assert.deepEqual(f.renderer.getScissor(new THREE.Vector4()).toArray(), [0, 0, 810, 1080]);
  assert.equal(f.renderer.getScissorTest(), false);
  assert.deepEqual(f.renderer.getClearColor(new THREE.Color()).toArray(), [.2, .3, .4]);
  assert.equal(f.renderer.getClearAlpha(), .6);
  assert.ok(f.mesh.visible);
  assert.throws(() => scope.render(f.scene, f.camera, 0, 0), /disposed/);
});

test('cancelled partial warm-up is retried instead of marking the preparation revision ready', async () => {
  const f = hostFixture(); let cancelled = false, scheduled = false;
  f.frame.cancelled = () => cancelled;
  const draw = f.renderer.render;
  f.renderer.render = function (...args) {
    const result = draw.apply(this, args);
    if (!scheduled) { scheduled = true; queueMicrotask(() => { cancelled = true; }); }
    return result;
  };
  await f.profile.prepare(f.frame);
  assert.deepEqual(f.blits.map(args => args[8]), [f.gl.COLOR_BUFFER_BIT | f.gl.DEPTH_BUFFER_BIT]);
  const partialDraws = f.rendered.length;
  cancelled = false;
  await f.profile.prepare(f.frame);
  assert.ok(f.rendered.length > partialDraws);
  assert.ok(f.blits.filter(args => args[8] === f.gl.DEPTH_BUFFER_BIT).length >= 2,
    'retry really draws the full transparent path');
  f.destroy();
});
