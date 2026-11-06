import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';

test('Three OIT resources execute source clear, blend-buffer composite and depth copies', async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage();
    const routes = new Map([
      ['/three.module.js', '../node_modules/three/build/three.module.js'],
      ['/three.core.js', '../node_modules/three/build/three.core.js'],
      ['/meteor-oit.js', '../packages/garupa_runtime/render-profiles/meteor-oit.js'],
      ['/meteor-oit-programs.js', '../packages/garupa_runtime/render-profiles/meteor-oit-programs.js'],
    ]);
    const errors = [];
    const loaded = [];
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('pageerror', error => errors.push(error.message));
    await page.route('http://meteor-oit.test/**', async route => {
      const file = routes.get(new URL(route.request().url()).pathname);
      if (file) {
        const source = new URL(file, import.meta.url);
        const body = await readFile(source, 'utf8');
        loaded.push({ url: route.request().url(), source: source.href,
          sha256: createHash('sha256').update(body).digest('hex') });
        await route.fulfill({ contentType: 'text/javascript', body });
      } else await route.fulfill({ contentType: 'text/html',
        body: '<!doctype html><script type="importmap">{"imports":{"three":"/three.module.js"}}</script>' });
    });
    await page.goto('http://meteor-oit.test/');
    const result = await page.evaluate(async () => {
      const THREE = await import('/three.module.js');
      const { createMeteorOit } = await import('/meteor-oit.js');
      const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
      renderer.setSize(4, 4); renderer.autoClear = false;
      renderer.extensions.get('EXT_float_blend');
      const source = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, depthBuffer: true });
      source.depthTexture = new THREE.DepthTexture(4, 4, THREE.UnsignedIntType);
      const oit = createMeteorOit({ THREE, renderer }); oit.setup(source);
      const sameTarget = oit.target; oit.setup(source);
      const reused = sameTarget === oit.target;
      renderer.setRenderTarget(source);
      renderer.setClearColor(new THREE.Color().setRGB(.1, .2, .3, THREE.LinearSRGBColorSpace), .4);
      renderer.clear(true, true, false);
      const gl = renderer.getContext();
      // Seed exact linear RGBA. Three's clearColor premultiplies RGB when the
      // context uses premultipliedAlpha, even for this offscreen target.
      gl.clearBufferfv(gl.COLOR, 0, new Float32Array([.1,.2,.3,.4]));
      oit.copyDepthIn(source); oit.bind(); oit.clear();
      function sample(target, attachment = 0) {
        renderer.setRenderTarget(target); gl.readBuffer(gl.COLOR_ATTACHMENT0 + attachment);
        const value = new Float32Array(4);
        gl.readPixels(2, 2, 1, 1, gl.RGBA, gl.FLOAT, value); return [...value];
      }
      const cleared = [sample(oit.target, 0), sample(oit.target, 1)];
      oit.bind();
      const material = new THREE.RawShaderMaterial({
        glslVersion: THREE.GLSL3,
        vertexShader: `
precision highp float;
in vec3 position;
void main(){gl_Position=vec4(position,1.0);}
`,
        fragmentShader: `
precision highp float;
layout(location=0) out vec4 accum;
layout(location=1) out vec4 reveal;
void main(){accum=vec4(.2,.4,.6,.25);reveal=vec4(0,.5,0,.25);}
`,
        depthTest: true, depthWrite: false, transparent: true,
        blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
        blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
      });
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute([-1,-1,0, 3,-1,0, -1,3,0],3));
      const scene = new THREE.Scene(), mesh = new THREE.Mesh(geometry, material);
      mesh.frustumCulled = false; scene.add(mesh); const camera = new THREE.Camera();
      renderer.render(scene,camera); renderer.render(scene,camera);
      const accumulated = [sample(oit.target,0), sample(oit.target,1)];
      oit.saveSourceColor(source); oit.bindGlobals(); oit.composite(source,true); oit.copyDepthBack(source);
      const composed = sample(source);
      const error = gl.getError();
      oit.destroy(); source.dispose(); material.dispose(); geometry.dispose(); renderer.dispose();
      return { cleared, accumulated, composed, reused, error };
    });
    const near = (actual, expected) => actual.forEach((x,i) => assert.ok(Math.abs(x-expected[i]) < .002, `${actual} != ${expected}`));
    near(result.cleared[0], [0,0,0,0]); near(result.cleared[1], [1,0,0,1]);
    near(result.accumulated[0], [.4,.8,1.2,0]); near(result.accumulated[1], [1,1,0,.5625]);
    near(result.composed, [.23125,.4625,.69375,.3375]);
    assert.equal(result.reused,true); assert.equal(result.error,0); assert.deepEqual(errors,[]);
    assert.ok(loaded.some(item => item.url.endsWith('/meteor-oit.js')));
    assert.ok(loaded.some(item => item.url.endsWith('/meteor-oit-programs.js')));
  } finally { await browser.close(); }
});

test('4x opaque coverage and depth resolve survive the single-sample OIT round trip', async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage(), errors = [];
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('pageerror', error => errors.push(error.message));
    const files = new Map([
      ['/three.module.js', '../node_modules/three/build/three.module.js'],
      ['/three.core.js', '../node_modules/three/build/three.core.js'],
      ['/meteor-oit.js', '../packages/garupa_runtime/render-profiles/meteor-oit.js'],
      ['/meteor-oit-programs.js', '../packages/garupa_runtime/render-profiles/meteor-oit-programs.js'],
    ]);
    await page.route('http://meteor-msaa.test/**', async route => {
      const file = files.get(new URL(route.request().url()).pathname);
      await route.fulfill(file ? { contentType: 'text/javascript', body: await readFile(new URL(file, import.meta.url), 'utf8') }
        : { contentType: 'text/html', body: '<!doctype html><script type="importmap">{"imports":{"three":"/three.module.js"}}</script>' });
    });
    await page.goto('http://meteor-msaa.test/');
    const result = await page.evaluate(async () => {
      const THREE = await import('/three.module.js');
      const { createMeteorOit, resolveOpaqueAttachments } = await import('/meteor-oit.js');
      const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false });
      renderer.setSize(8, 8); renderer.autoClear = false;
      const makeTarget = samples => {
        const target = new THREE.WebGLRenderTarget(8, 8, { type: THREE.UnsignedByteType,
          format: THREE.RGBAFormat, depthBuffer: true, stencilBuffer: false, samples });
        target.texture.colorSpace = THREE.NoColorSpace;
        target.depthTexture = new THREE.DepthTexture(8, 8, THREE.UnsignedIntType);
        return target;
      };
      const opaque = makeTarget(4), resolved = makeTarget(0), oit = createMeteorOit({ THREE, renderer });
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute([-1,-1,-.5, .8,-1,-.5, -1,.8,-.5], 3));
      const material = new THREE.RawShaderMaterial({ glslVersion: THREE.GLSL3,
        vertexShader: 'precision highp float; in vec3 position; void main(){gl_Position=vec4(position,1.0);}',
        fragmentShader: 'precision highp float; out vec4 color; void main(){color=vec4(.8,.2,.1,1.0);}' });
      const scene = new THREE.Scene(), camera = new THREE.Camera(), mesh = new THREE.Mesh(geometry, material);
      mesh.frustumCulled = false; scene.add(mesh);
      renderer.setRenderTarget(opaque); renderer.setClearColor(0, 0); renderer.clear(true, true, false);
      renderer.render(scene, camera);
      const gl = renderer.getContext(), samples = gl.getParameter(gl.SAMPLES);
      resolveOpaqueAttachments(THREE, renderer, opaque, resolved);
      const restored = renderer.getRenderTarget() === opaque;
      const read = () => { const pixels = new Uint8Array(8 * 8 * 4); renderer.readRenderTargetPixels(resolved, 0, 0, 8, 8, pixels); return [...pixels]; };
      const before = read();
      oit.setup(resolved); oit.copyDepthIn(resolved); oit.bind(); oit.clear();
      oit.saveSourceColor(resolved); oit.bindGlobals(); oit.composite(resolved, true); oit.copyDepthBack(resolved);
      const after = read();
      const farGeometry = new THREE.PlaneGeometry(2, 2), farMaterial = new THREE.RawShaderMaterial({
        glslVersion: THREE.GLSL3,
        vertexShader: 'precision highp float; in vec3 position; void main(){gl_Position=vec4(position.xy,.7,1.0);}',
        fragmentShader: 'precision highp float; out vec4 color; void main(){color=vec4(0.0,0.0,1.0,1.0);}' });
      scene.remove(mesh); const far = new THREE.Mesh(farGeometry, farMaterial); far.frustumCulled = false; scene.add(far);
      renderer.setRenderTarget(resolved); renderer.render(scene, camera); const depthResult = read();
      const error = gl.getError();
      oit.destroy(); opaque.dispose(); resolved.dispose(); geometry.dispose(); material.dispose();
      farGeometry.dispose(); farMaterial.dispose(); renderer.dispose();
      return { samples, restored, before, after, depthResult, error };
    });
    assert.equal(result.samples, 4); assert.equal(result.restored, true);
    const alphas = result.before.filter((_, index) => index % 4 === 3);
    assert.ok(alphas.some(value => value > 0 && value < 255), 'resolved diagonal retains partial pixel coverage');
    result.before.forEach((value, index) => {
      const expected = index % 4 === 3 ? 255 - value : value;
      assert.ok(Math.abs(result.after[index] - expected) <= 1, `OIT changed resolved coverage/color at ${index}`);
    });
    assert.equal(result.before[(1 * 8 + 1) * 4 + 3], 255, 'interior reference pixel is fully covered');
    assert.deepEqual(result.depthResult.slice((1 * 8 + 1) * 4, (1 * 8 + 1) * 4 + 3),
      result.before.slice((1 * 8 + 1) * 4, (1 * 8 + 1) * 4 + 3),
      'resolved opaque depth still occludes farther geometry after OIT');
    assert.deepEqual(result.depthResult.slice((7 * 8 + 7) * 4, (7 * 8 + 7) * 4 + 3), [0, 0, 255]);
    assert.equal(result.error, 0); assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('cached blit bindings survive repeated draws, resize and WebGL context restoration', async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const files = new Map([
      ['/three.module.js', '../node_modules/three/build/three.module.js'],
      ['/three.core.js', '../node_modules/three/build/three.core.js'],
      ['/meteor-oit.js', '../packages/garupa_runtime/render-profiles/meteor-oit.js'],
      ['/meteor-oit-programs.js', '../packages/garupa_runtime/render-profiles/meteor-oit-programs.js'],
    ]);
    await page.route('http://meteor-attachments.test/**', async route => {
      const file = files.get(new URL(route.request().url()).pathname);
      await route.fulfill(file ? { contentType: 'text/javascript', body: await readFile(new URL(file, import.meta.url), 'utf8') }
        : { contentType: 'text/html', body: '<!doctype html><script type="importmap">{"imports":{"three":"/three.module.js"}}</script>' });
    });
    await page.goto('http://meteor-attachments.test/');
    const result = await page.evaluate(async () => {
      const THREE = await import('/three.module.js');
      const { resolveOpaqueAttachments, copyDepthAttachment } = await import('/meteor-oit.js');
      const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false });
      renderer.setSize(8, 8); renderer.autoClear = false;
      const makeTarget = samples => {
        const target = new THREE.WebGLRenderTarget(8, 8, { samples, depthBuffer: true, stencilBuffer: false });
        target.texture.colorSpace = THREE.NoColorSpace;
        target.depthTexture = new THREE.DepthTexture(8, 8, THREE.UnsignedIntType);
        return target;
      };
      const source = makeTarget(4), resolved = makeTarget(0), depthCopy = makeTarget(0);
      const geometry = new THREE.PlaneGeometry(2, 2), camera = new THREE.Camera();
      const material = new THREE.RawShaderMaterial({ glslVersion: THREE.GLSL3,
        uniforms: { depth: { value: -.5 }, colorValue: { value: new THREE.Vector4(.8, .2, .1, 1) } },
        vertexShader: 'precision highp float; in vec3 position; uniform float depth; void main(){gl_Position=vec4(position.xy,depth,1.0);}',
        fragmentShader: 'precision highp float; uniform vec4 colorValue; out vec4 color; void main(){color=colorValue;}' });
      const scene = new THREE.Scene(), mesh = new THREE.Mesh(geometry, material);
      mesh.frustumCulled = false; scene.add(mesh);
      const gl = renderer.getContext(), getParameter = gl.getParameter.bind(gl);
      let measuring = false, queries = 0;
      gl.getParameter = function (parameter) {
        if (measuring && (parameter === gl.FRAMEBUFFER_BINDING || parameter === gl.SAMPLES)) queries++;
        return getParameter(parameter);
      };
      function draw() {
        material.uniforms.depth.value = -.5; material.uniforms.colorValue.value.set(.8, .2, .1, 1);
        renderer.setRenderTarget(source); renderer.setClearColor(0, 0); renderer.clear(true, true, false);
        renderer.render(scene, camera);
        queries = 0; measuring = true;
        try {
          resolveOpaqueAttachments(THREE, renderer, source, resolved);
          copyDepthAttachment(THREE, renderer, resolved, depthCopy);
          copyDepthAttachment(THREE, renderer, depthCopy, resolved);
        } finally { measuring = false; }
        const queryCount = queries;
        material.uniforms.depth.value = .5; material.uniforms.colorValue.value.set(0, 0, 1, 1);
        renderer.setRenderTarget(resolved); renderer.render(scene, camera);
        const pixel = new Uint8Array(4);
        renderer.readRenderTargetPixels(resolved, 1, 1, 1, 1, pixel);
        return { pixel: [...pixel], queries: queryCount, error: gl.getError() };
      }
      const first = draw();
      const newDestination = makeTarget(0), coldPixel = new Uint8Array(4);
      renderer.setRenderTarget(source);
      resolveOpaqueAttachments(THREE, renderer, source, newDestination);
      renderer.readRenderTargetPixels(newDestination, 1, 1, 1, 1, coldPixel);
      const coldDestination = { pixel: [...coldPixel], error: gl.getError() };
      newDestination.dispose();
      const repeated = draw();
      for (const target of [source, resolved, depthCopy]) target.setSize(13, 11);
      const resized = draw(), repeatedResized = draw();
      const loss = gl.getExtension('WEBGL_lose_context');
      if (!loss) throw new Error('Context restoration test requires WEBGL_lose_context');
      const lost = new Promise(resolve => renderer.domElement.addEventListener('webglcontextlost', event => {
        event.preventDefault(); resolve();
      }, { once: true }));
      const restored = new Promise(resolve => renderer.domElement.addEventListener('webglcontextrestored', resolve, { once: true }));
      loss.loseContext(); await lost;
      await new Promise(resolve => setTimeout(resolve, 50));
      loss.restoreContext(); await restored;
      const afterRestore = draw(), repeatedRestored = draw();
      for (const target of [source, resolved, depthCopy]) target.dispose();
      material.dispose(); geometry.dispose(); renderer.dispose();
      return { first, coldDestination, repeated, resized, repeatedResized, afterRestore, repeatedRestored };
    });
    for (const value of Object.values(result)) {
      assert.equal(value.error, 0);
      [204, 51, 26, 255].forEach((expected, index) => assert.ok(Math.abs(value.pixel[index] - expected) <= 1,
        'preserved depth occludes the subsequent farther Three draw'));
    }
    for (const name of ['first', 'resized', 'afterRestore']) assert.equal(result[name].queries, 4, name);
    for (const name of ['repeated', 'repeatedResized', 'repeatedRestored']) assert.equal(result[name].queries, 0, name);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
