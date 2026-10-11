import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createRenderProfile } from '../packages/yohane_runtime/render-profiles/yohane-character.js';
import { profilePrograms } from '../packages/yohane_runtime/render-profiles/outline-program.js';
import { bloomPrograms } from '../packages/yohane_runtime/render-profiles/bloom-program.js';
import { bloomCompositeProgram } from '../packages/yohane_runtime/render-profiles/bloom-composite.js';
const { fragmentShader } = profilePrograms.outline;

function fixture(extension = true) {
  const calls = [];
  let target = null,
    scissorTest = true,
    alpha = 0.3;
  const viewport = new THREE.Vector4(4, 5, 200, 100),
    scissor = new THREE.Vector4(3, 2, 190, 90),
    color = new THREE.Color(0.1, 0.2, 0.3);
  const renderer = {
    autoClear: true,
    extensions: { has: () => extension },
    info: { render: { frame: 0 } },
    getPixelRatio: () => 1,
    compileAsync: async (scene) => {
      calls.push(['compile', scene]);
    },
    getRenderTarget: () => target,
    setRenderTarget: (t) => {
      target = t;
    },
    getViewport: (out) => out.copy(viewport),
    getScissor: (out) => out.copy(scissor),
    getScissorTest: () => scissorTest,
    setViewport: (x, y, z, w) => {
      if (x?.isVector4) viewport.copy(x);
      else viewport.set(x, y, z, w);
    },
    setScissor: (v) => scissor.copy(v),
    setScissorTest: (v) => {
      scissorTest = v;
    },
    getClearColor: (out) => out.copy(color),
    getClearAlpha: () => alpha,
    setClearColor: (c, a) => {
      color.set(c);
      alpha = a;
    },
    clear: (...flags) => calls.push(['clear', flags]),
    render: (scene) => {
      const mats = [];
      scene.traverseVisible((o) => {
        if (
          o.isMesh &&
          (Array.isArray(o.material) ? o.material.some((m) => m.visible) : o.material.visible)
        ) {
          if (!o.geometry.attributes.position) assert.equal(o.geometry.drawRange.count, 3);
          mats.push(o.material);
        }
      });
      calls.push(['render', target, mats]);
    },
  };
  const scene = new THREE.Scene(),
    root = new THREE.Group();
  scene.add(root);
  for (const [pass, transparent] of [
    ['ForwardFront_BASE', false],
    ['ForwardBack_BASE', false],
    ['Forward_SURFACE_TYPE_TRANSPARENT', true],
  ]) {
    const material = new THREE.MeshStandardMaterial({ transparent });
    material.userData.__parameterizedPassId = pass;
    material.userData.materialPass = {
      extras: { depthNormalsPass: 'DepthNormals_BASE' },
      renderState: { renderQueue: transparent ? 3000 : 2000 },
    };
    root.add(new THREE.Mesh(new THREE.BoxGeometry(), material));
  }
  const external = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
  scene.add(external);
  const frame = {
    scene,
    camera: new THREE.PerspectiveCamera(45, 2, 0.1, 100),
    target: null,
    viewport: new THREE.Vector4(0, 0, 200, 100),
    scissor: new THREE.Vector4(0, 0, 200, 100),
    scissorTest: false,
    time: 1.25,
    delta: 1 / 60,
  };
  let helperCount = 0;
  const profile = createRenderProfile({
    THREE,
    renderer,
    createPassMaterial: async (m, id) => {
      helperCount++;
      const n = m.clone();
      n.name = id;
      return n;
    },
  });
  return {
    profile,
    renderer,
    scene,
    root,
    external,
    frame,
    calls,
    helpers: () => helperCount,
    viewport,
    scissor,
    color,
    getAlpha: () => alpha,
  };
}

test('Yohane profile prepares helpers once, renders source phases and restores all state', async () => {
  const f = fixture();
  f.profile.attach(f.root);
  await f.profile.prepare(f.frame);
  assert.equal(f.helpers(), 1); // Only Front contributes source DepthNormals.
  const compilations = f.calls.filter((c) => c[0] === 'compile').length;
  await f.profile.prepare({ ...f.frame, time: 2 });
  assert.equal(f.calls.filter((c) => c[0] === 'compile').length, compilations);
  const source = f.root.children.map((o) => o.material);
  f.calls.length = 0;
  f.profile.render(f.frame);
  const renders = f.calls.filter((c) => c[0] === 'render');
  assert.equal(renders.length, 7); // normals, opaque, outline, copy, transparent, Bloom prefilter, composite
  assert.equal(renders[0][2].length, 1);
  assert.equal(renders[1][2].length, 2);
  assert.equal(renders[4][2].length, 1);
  assert.deepEqual(
    f.root.children.map((o) => o.material),
    source
  );
  assert.equal(f.external.visible, true);
  assert.equal(f.renderer.autoClear, true);
  assert.deepEqual(f.viewport.toArray(), [4, 5, 200, 100]);
  assert.deepEqual(f.scissor.toArray(), [3, 2, 190, 90]);
  assert.equal(f.renderer.getScissorTest(), true);
  assert.equal(f.getAlpha(), 0.3);
  assert.equal(f.renderer.getRenderTarget(), null);
  let disposed = 0;
  renders[0][1].addEventListener('dispose', () => disposed++);
  f.profile.destroy();
  f.profile.destroy();
  assert.equal(disposed, 1);
});

test('Yohane signed-normal prerequisite fails explicitly and drawing failures restore source objects', async () => {
  const unsupported = fixture(false);
  unsupported.profile.attach(unsupported.root);
  await assert.rejects(unsupported.profile.prepare(unsupported.frame), /signed floating-point/);
  unsupported.profile.destroy();
  const f = fixture();
  f.profile.attach(f.root);
  await f.profile.prepare(f.frame);
  const materials = f.root.children.map((o) => o.material);
  f.renderer.render = () => {
    throw new Error('driver failure');
  };
  assert.throws(() => f.profile.render(f.frame), /driver failure/);
  assert.deepEqual(
    f.root.children.map((o) => o.material),
    materials
  );
  assert.ok(f.root.children.every((o) => o.visible));
  assert.equal(f.external.visible, true);
  assert.equal(f.renderer.autoClear, true);
  assert.equal(f.renderer.getRenderTarget(), null);
  f.profile.destroy();
});

test('Yohane retains compiled signed Laplacian and source alpha branches', () => {
  assert.match(fragmentShader, /_ScreenParams.zwzw \+ vec4\(-1.0, -1.0, -1.0, -1.0\)/);
  assert.match(fragmentShader, /0.100000001/);
  assert.match(fragmentShader, /max\(/);
  assert.match(fragmentShader, /SV_Target0.w = 1.0/);
  assert.match(fragmentShader, /SV_Target0 = u_xlat16_2/);
  const near = 0.1,
    far = 100,
    z = 0.37;
  const linear = 1 / (((1 - far / near) / far) * z + 1 / near);
  const openGLDepth = (2 * near * far) / (far + near - (2 * z - 1) * (far - near));
  assert.ok(Math.abs(linear - openGLDepth) < 1e-12);
});

test('Yohane Color background clears once; core ticks and helper disposal stay host-owned', async () => {
  const f = fixture();
  f.scene.background = new THREE.Color(0.4, 0.5, 0.6);
  let ticks = 0,
    frameCalls = 0,
    lastTime = null,
    helperDisposals = 0;
  const runtime = {
    onBeforeRender() {
      ticks++;
    },
    setFrame(frame) {
      frameCalls++;
      lastTime = frame.time;
    },
  };
  for (const mesh of f.root.children)
    mesh.material.userData.__parameterizedShaderRuntimes = [runtime];
  f.profile.attach(f.root);
  await f.profile.prepare(f.frame);
  const helpers = [];
  const originalRender = f.renderer.render;
  f.renderer.render = (scene) => {
    if (scene === f.scene) assert.equal(scene.background, null);
    originalRender(scene);
  };
  f.calls.length = 0;
  f.profile.render({ ...f.frame, time: 8.5 });
  assert.equal(f.calls.filter((c) => c[0] === 'render').length, 7);
  assert.equal(ticks, 0);
  assert.equal(frameCalls, 2);
  assert.equal(lastTime, 8.5);
  for (const material of f.calls.find((c) => c[0] === 'render')[2]) {
    helpers.push(material);
    material.addEventListener('dispose', () => helperDisposals++);
  }
  f.profile.destroy();
  assert.equal(helperDisposals, 0);
  for (const material of helpers) material.dispose();
  assert.equal(helperDisposals, 1);
});

test('Yohane resizes attachments during render without recompiling source programs', async () => {
  const f = fixture();
  f.profile.attach(f.root);
  await f.profile.prepare(f.frame);
  const compilations = f.calls.filter((c) => c[0] === 'compile').length;
  f.calls.length = 0;
  f.profile.render({ ...f.frame, viewport: new THREE.Vector4(0, 0, 320, 180) });
  const targets = f.calls.filter((c) => c[0] === 'render' && c[1]).map((c) => c[1]);
  assert.deepEqual(
    targets.map((target) => [target.width, target.height]),
    [[320, 180], [320, 180], [320, 180], [320, 180], [320, 180], [160, 90]]
  );
  assert.equal(f.calls.filter((c) => c[0] === 'compile').length, 0);
  await f.profile.prepare({ ...f.frame, viewport: new THREE.Vector4(0, 0, 320, 180) });
  assert.equal(f.calls.filter((c) => c[0] === 'compile').length, 0);
  assert.equal(compilations, 10); // source phases, four Bloom kernels, transparent composite
  f.profile.destroy();
});

test('Yohane external target output converts physical viewport and scissor at DPR 2', async () => {
  const f = fixture();
  f.renderer.getPixelRatio = () => 2;
  f.profile.attach(f.root);
  await f.profile.prepare(f.frame);
  const externalTarget = new THREE.WebGLRenderTarget(800, 600);
  const frame = {
    ...f.frame,
    target: externalTarget,
    viewport: new THREE.Vector4(10, 20, 400, 300),
    scissor: new THREE.Vector4(12, 24, 380, 280),
    scissorTest: true,
  };
  let outputViewport, outputScissor;
  const render = f.renderer.render;
  f.renderer.render = (scene) => {
    if (f.renderer.getRenderTarget() === externalTarget) {
      outputViewport = f.viewport.clone();
      outputScissor = f.scissor.clone();
    }
    render(scene);
  };
  f.profile.render(frame);
  assert.deepEqual(outputViewport.toArray(), [5, 10, 200, 150]);
  assert.deepEqual(outputScissor.toArray(), [6, 12, 190, 140]);
  const intermediate = f.calls.filter((c) => c[0] === 'render' && c[1] && c[1] !== externalTarget);
  assert.deepEqual(
    intermediate.map((c) => [c[1].width, c[1].height]),
    [[400, 300], [400, 300], [400, 300], [400, 300], [400, 300], [200, 150]]
  );
  f.profile.destroy();
  externalTarget.dispose();
});

test('Yohane preparation with shaders disabled caches bound shader materials', async () => {
  const f = fixture(),
    bound = f.root.children.map((o) => o.material),
    base = bound.map(() => new THREE.MeshStandardMaterial());
  for (let i = 0; i < bound.length; i++) {
    f.root.children[i].userData.__parameterizedMaterials = bound[i];
    f.root.children[i].material = base[i];
  }
  f.profile.attach(f.root);
  await f.profile.prepare(f.frame);
  assert.equal(f.helpers(), 1);
  assert.deepEqual(
    f.root.children.map((o) => o.material),
    base
  );
  for (let i = 0; i < bound.length; i++) f.root.children[i].material = bound[i];
  f.calls.length = 0;
  f.profile.render(f.frame);
  assert.equal(f.calls.filter((c) => c[0] === 'render')[1][2].length, 2);
  assert.deepEqual(
    f.root.children.map((o) => o.material),
    bound
  );
  f.profile.destroy();
  base.forEach((m) => m.dispose());
});

test('Yohane URP queue classification ignores Three queue-sorting transparency', async () => {
  const f = fixture();
  for (const mesh of f.root.children) mesh.material.transparent = true;
  f.root.children[0].material.userData.materialPass.renderState.renderQueue = 2500;
  f.root.children[2].material.userData.materialPass.renderState.renderQueue = 2501;
  f.profile.attach(f.root);
  await f.profile.prepare(f.frame);
  assert.equal(f.helpers(), 1);
  f.calls.length = 0;
  f.profile.render(f.frame);
  const renders = f.calls.filter((c) => c[0] === 'render');
  assert.equal(renders[0][2].length, 1);
  assert.equal(renders[1][2].length, 2);
  assert.equal(renders[4][2].length, 1);
  f.profile.destroy();
});

test('Yohane opaque Aura participates in color but has no source DepthNormals pass', async () => {
  const f = fixture(),
    material = new THREE.MeshStandardMaterial({ transparent: true });
  material.userData = {
    __parameterizedShader: 'yohane-aura',
    __parameterizedPassId: 'Forward_BASE',
    materialPass: { renderState: { renderQueue: 2000 } },
  };
  f.root.add(new THREE.Mesh(new THREE.BoxGeometry(), material));
  f.profile.attach(f.root);
  await f.profile.prepare(f.frame);
  assert.equal(f.helpers(), 1);
  f.calls.length = 0;
  f.profile.render(f.frame);
  const renders = f.calls.filter((c) => c[0] === 'render');
  assert.equal(renders[0][2].length, 1);
  assert.equal(renders[1][2].length, 3);
  f.profile.destroy();
});

test('Yohane composites Bloom after transparent geometry and can bypass it for visual comparison', async () => {
  const f = fixture();
  f.profile.attach(f.root);
  await f.profile.prepare(f.frame);
  f.calls.length = 0;
  f.profile.render(f.frame);
  const renders = f.calls.filter((call) => call[0] === 'render');
  assert.equal(renders[4][2][0], f.root.children[2].material);
  assert.equal(renders[5][2][0].fragmentShader, bloomPrograms.prefilter);
  const composite = renders[6][2][0];
  assert.equal(composite.fragmentShader, bloomCompositeProgram.fragmentShader);
  assert.equal(composite.uniforms.uSource.value, renders[4][1].texture);
  assert.equal(composite.uniforms.uBloom.value, renders[5][1].texture);
  assert.equal(composite.uniforms.uIntensity.value, 12);
  assert.notEqual(renders[6][1]?.texture, composite.uniforms.uSource.value);
  f.profile.setBloomEnabled(false);
  f.calls.length = 0;
  f.profile.render(f.frame);
  assert.equal(f.calls.filter((call) => call[0] === 'render').length, 6);
  assert.ok(f.calls.filter((call) => call[0] === 'render').every(
    (call) => call[2][0].fragmentShader !== bloomPrograms.prefilter
  ));
  f.profile.destroy();
});

test('Yohane Bloom drawing failures restore the profile source objects and renderer state', async () => {
  const f = fixture();
  f.profile.attach(f.root);
  await f.profile.prepare(f.frame);
  const materials = f.root.children.map((mesh) => mesh.material);
  const originalRender = f.renderer.render;
  f.renderer.render = (scene) => {
    const material = scene.children[0]?.material;
    if (material?.fragmentShader === bloomPrograms.prefilter) {
      throw new Error('Bloom drawing failure');
    }
    originalRender(scene);
  };
  assert.throws(() => f.profile.render(f.frame), /Bloom drawing failure/);
  assert.deepEqual(f.root.children.map((mesh) => mesh.material), materials);
  assert.ok(f.root.children.every((mesh) => mesh.visible));
  assert.equal(f.external.visible, true);
  assert.equal(f.renderer.autoClear, true);
  assert.equal(f.renderer.getRenderTarget(), null);
  assert.deepEqual(f.viewport.toArray(), [4, 5, 200, 100]);
  assert.deepEqual(f.scissor.toArray(), [3, 2, 190, 90]);
  assert.equal(f.renderer.getScissorTest(), true);
  assert.equal(f.getAlpha(), 0.3);
  f.profile.destroy();
});
