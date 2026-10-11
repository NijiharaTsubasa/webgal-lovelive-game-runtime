import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { auraArcPrograms } from '../packages/yohane_runtime/particles/aura-arc-program.js';

import { createAuraArcRenderer } from '../packages/yohane_runtime/particles/aura-arc-renderer.js';
import { createAuraArcBinding } from '../packages/yohane_runtime/particles/aura-arc-binding.js';

test('AuraArc sampling matches Unity native root-bone-space vertex buffer', () => {
  // Unity 2022 D3D11 GetVertexBuffer and BakeMesh readbacks of the same pose.
  const rendererWorld = new THREE.Matrix4().fromArray([
    1, 0, 0, 0, 0, -1.1920928955078125e-7, -1.0000001192092896, 0,
    0, 1.0000001192092896, -1.1920928955078125e-7, 0, 0, 0, 0, 1,
  ]);
  const rootWorld = new THREE.Matrix4().fromArray([
    .9649240970611572, -.023180771619081497, -.26150354743003845, 0,
    .025248391553759575, .9996707439422607, .00454938318580389, 0,
    .26131194829940796, -.010992410592734814, .9651919007301331, 0,
    .01984497159719467, .8102600574493408, .13002155721187592, 1,
  ]);
  const baked = [
    [-.08645100891590118, -.12984910607337952, 1.2106515169143677],
    [-.10394015908241272, -.10241398215293884, 1.2234889268875122],
    [-.10433253645896912, -.12270677089691162, 1.208133578300476],
  ];
  const native = [
    [-.11180375516414642, .3975750207901001, -.032344236969947815],
    [-.1218026727437973, .40984171628952026, -.0635356605052948],
    [-.12713198363780975, .3945739269256592, -.043882906436920166],
  ];
  const root = new THREE.Group();
  const reflection = new THREE.Matrix4().makeScale(-1, 1, 1);
  root.position.set(2, -1, 4);
  root.rotation.set(.2, -.3, .1);
  root.scale.set(1.3, .9, 1.1);
  const skinRoot = new THREE.Group();
  const sourceRootFrame = new THREE.Matrix4().makeRotationZ(.41);
  skinRoot.matrix.copy(reflection).multiply(rootWorld).multiply(reflection)
    .multiply(sourceRootFrame.clone().invert());
  skinRoot.matrixAutoUpdate = false;
  skinRoot.userData.yohaneAuraSkinRootNode = 5;
  root.add(skinRoot);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(
    baked.flatMap(point => new THREE.Vector3().fromArray(point).applyMatrix4(rendererWorld).applyMatrix4(reflection).toArray()), 3));
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
  mesh.userData.yohaneAuraSourceNode = 7;
  root.add(mesh);
  const effect = new THREE.Group();
  effect.userData.yohaneAuraArcNode = 9;
  root.add(effect);
  root.updateMatrixWorld(true);
  const binding = createAuraArcBinding({
    THREE, root, metadataRoot: root, seed: 1,
    instance: { node: 9, source: { node: 7, primitive: 0, vertexCount: 3,
      skinRoot: { node: 5, toSourceFrame: sourceRootFrame.elements } },
      initialEvent: 'OnPlay', overrides: {} },
    curve: { width: 1, height: 1, pixels: [1], Alpha_c: [0, 1, .5, 0] },
  });
  for (let index = 0; index < 3; index++) {
    const actual = new Float32Array(3);
    binding.samplePosition(index, actual);
    native[index].forEach((value, axis) => assert.ok(Math.abs(actual[axis] - value) < 1e-6,
      `vertex ${index} axis ${axis}: ${actual[axis]} vs native ${value}`));
  }
  binding.destroy();
  geometry.dispose();
  mesh.material.dispose();
});

test('AuraArc compact transport preserves original strip IDs and SSBO word bits', () => {
  const lineAttributes = new Uint32Array(768000),
    stripData = new Uint32Array(5000);
  for (const id of [3, 999])
    for (let r = 0; r < 3; r++)
      for (let w = 0; w < 256; w++)
        lineAttributes[r * 256000 + id * 256 + w] = (id * 1000000 + r * 10000 + w) >>> 0;
  stripData.set([5, 30, 7, 0, 29], 3 * 5);
  stripData.set([63, 2, 1, 0, 1], 999 * 5);
  const simulation = {
    lineAttributes,
    stripData,
    activeStripIds: new Uint32Array([3, 999]),
    activeStripCount: 2,
  };
  const arc = createAuraArcRenderer({
    THREE,
    simulation,
    output: {},
    quadIndices: [0, 1, 2, 2, 1, 3],
  });
  arc.sync();
  assert.equal(arc.geometry.getAttribute('auraVertexId').getX(252), 999 * 252);
  assert.equal(arc.geometry.drawRange.count, 2 * 63 * 6);
  assert.deepEqual(
    Array.from(arc.uniforms.auraHeaders.value.image.data.slice(5, 10)),
    [63, 2, 1, 0, 1]
  );
  assert.equal(
    arc.uniforms.auraAttributes.value.image.data[3 * 256 + 2 * 256 + 255],
    lineAttributes[512000 + 999 * 256 + 255]
  );
  const identity = arc.uniforms.auraAttributes.value.image.data;
  arc.sync();
  assert.equal(arc.uniforms.auraAttributes.value.image.data, identity);
  arc.destroy();
  arc.destroy();
});

test('AuraArc samples current morph/skinning in original rootBone space under model TRS', () => {
  const root = new THREE.Group(),
    metadataRoot = new THREE.Group();
  root.add(metadataRoot);
  root.position.set(3, -2, 5);
  root.rotation.set(0.23, -0.51, 0.37);
  root.scale.set(1.4, 0.8, 1.2);
  const sourceFrame = new THREE.Matrix4().compose(
    new THREE.Vector3(0.3, 0.7, -0.4),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(0.2, 0.4, -0.3)),
    new THREE.Vector3(0.9, 1.2, 0.8)
  );
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([0.2, 0.5, -0.7], 3));
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute([0, 0, 0, 0], 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute([1, 0, 0, 0], 4));
  geometry.morphTargetsRelative = true;
  geometry.morphAttributes.position = [new THREE.Float32BufferAttribute([0.1, -0.2, 0.15], 3)];
  const mesh = new THREE.SkinnedMesh(geometry, new THREE.MeshBasicMaterial());
  mesh.userData.yohaneAuraSourceNode = 7;
  metadataRoot.add(mesh);
  const bone = new THREE.Bone();
  bone.userData.yohaneAuraSkinRootNode = 5;
  bone.matrix.copy(sourceFrame);
  bone.matrixAutoUpdate = false;
  metadataRoot.add(bone);
  const skeleton = new THREE.Skeleton([bone], [new THREE.Matrix4()]);
  mesh.bind(skeleton, new THREE.Matrix4());
  mesh.morphTargetInfluences[0] = 0.37;
  const effect = new THREE.Group();
  effect.userData.yohaneAuraArcNode = 9;
  metadataRoot.add(effect);
  root.updateMatrixWorld(true);
  skeleton.update();
  const instance = {
    node: 9,
    source: { node: 7, primitive: 0, vertexCount: 1,
      skinRoot: { node: 5, toSourceFrame: new THREE.Matrix4().elements } },
    initialEvent: 'OnPlay',
    overrides: {},
  };
  const binding = createAuraArcBinding({
    THREE,
    root,
    metadataRoot,
    instance,
    seed: 1,
    curve: { width: 1, height: 1, pixels: [1], Alpha_c: [0, 1, 0.5, 0] },
  });
  const out = new Float32Array(3);
  binding.samplePosition(0, out);
  const expected = new THREE.Vector3(0.2 + 0.1 * 0.37, 0.5 - 0.2 * 0.37, -0.7 + 0.15 * 0.37);
  assert.ok(Math.abs(out[0] + expected.x) < 1e-6);
  assert.ok(Math.abs(out[1] - expected.y) < 1e-6);
  assert.ok(Math.abs(out[2] - expected.z) < 1e-6);
  bone.matrix.premultiply(new THREE.Matrix4().makeRotationY(0.43));
  root.updateMatrixWorld(true);
  skeleton.update();
  binding.anchor(0);
  binding.advance(0.01);
  binding.samplePosition(0, out);
  // Moving the rootBone changes world placement but not its native local buffer.
  assert.ok(Math.abs(out[0] + expected.x) < 1e-6);
  assert.ok(Math.abs(out[1] - expected.y) < 1e-6);
  assert.ok(Math.abs(out[2] - expected.z) < 1e-6);
  binding.advance(0.05);
  const simulatedTime = binding.simulation.time;
  assert.ok(simulatedTime > 0);
  binding.advance(0.05);
  assert.equal(
    binding.simulation.time,
    simulatedTime,
    'repeated rendering at paused host time must not advance'
  );
  binding.advance(100, false);
  assert.equal(binding.simulation.time, simulatedTime);
  binding.advance(100.01);
  assert.ok(
    binding.simulation.time - simulatedTime < 0.03,
    'hidden time must not be simulated when visible again'
  );
  binding.reset(4);
  binding.advance(101);
  assert.equal(binding.simulation.time, 0, 'reset anchors at the next host time');
  binding.destroy();
});

test('AuraArc copies opaque depth to an independent attachment without framebuffer feedback', async () => {
  const server = createServer(async (req, res) => {
    try {
      const file = new URL('./../' + req.url.slice(1), import.meta.url);
      res.setHeader('content-type', 'text/javascript');
      res.end(await readFile(file));
    } catch {
      res.statusCode = 404;
      res.end();
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(
      `http://127.0.0.1:${server.address().port}/node_modules/three/build/three.module.js`
    );
    const result = await page.evaluate(async () => {
      const THREE = await import('/node_modules/three/build/three.module.js');
      const { createAuraArcRenderer } = await import(
        '/packages/yohane_runtime/particles/aura-arc-renderer.js'
      );
      const renderer = new THREE.WebGLRenderer({ antialias: false });
      renderer.setSize(4, 4);
      const source = new THREE.WebGLRenderTarget(4, 4),
        destination = new THREE.WebGLRenderTarget(4, 4);
      for (const rt of [source, destination])
        rt.depthTexture = new THREE.DepthTexture(4, 4, THREE.UnsignedIntType);
      const scene = new THREE.Scene(),
        camera = new THREE.Camera();
      const mat = new THREE.ShaderMaterial({
        vertexShader: 'void main(){gl_Position=vec4(position.xy,0.2,1.);}',
        fragmentShader: 'void main(){gl_FragColor=vec4(1.);}',
        depthTest: true,
        depthWrite: true,
      });
      scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat));
      renderer.setRenderTarget(source);
      renderer.clear();
      renderer.render(scene, camera);
      renderer.initRenderTarget(destination);
      renderer.copyTextureToTexture(source.depthTexture, destination.depthTexture);
      renderer.setRenderTarget(source);
      renderer.autoClear = false;
      const sample = new THREE.ShaderMaterial({
        uniforms: { depth: { value: destination.depthTexture } },
        depthWrite: false,
        depthTest: false,
        vertexShader: 'void main(){gl_Position=vec4(position.xy,0.,1.);}',
        fragmentShader:
          'uniform sampler2D depth;void main(){float z=texture2D(depth,vec2(.5)).r;gl_FragColor=vec4(z,z,z,1.);}',
      });
      scene.children[0].material = sample;
      renderer.render(scene, camera);
      const pixel = new Uint8Array(4);
      renderer.readRenderTargetPixels(source, 2, 2, 1, 1, pixel);
      const lineAttributes = new Uint32Array(768000),
        lineFloats = new Float32Array(lineAttributes.buffer),
        stripData = new Uint32Array(5000);
      stripData.set([0, 3, 3, 0, 2]);
      for (let i = 0; i < 3; i++) {
        lineFloats.set([-0.5 + i * 0.5, 0, -2, 0.2], 256000 + i * 4);
        lineFloats.set([0.5, 0, 0, 1], 512000 + i * 4);
      }
      const simulation = {
        lineAttributes,
        stripData,
        activeStripIds: new Uint32Array([0]),
        activeStripCount: 1,
      };
      const white = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
      white.needsUpdate = true;
      const curve = new THREE.DataTexture(
        new Float32Array([1]),
        1,
        1,
        THREE.RedFormat,
        THREE.FloatType
      );
      curve.minFilter = curve.magFilter = THREE.NearestFilter;
      curve.needsUpdate = true;
      const packed = new Float32Array(new Uint32Array([0x3c00, 64000, 12]).buffer);
      const arc = createAuraArcRenderer({
        THREE,
        simulation,
        bakedTexture: curve,
        mainTexture: white,
        quadIndices: [0, 1, 2, 2, 1, 3],
        output: {
          Alpha_c: new Float32Array([packed[0], 1, 0.5, packed[2]]),
          uniform_a: 1,
          uniform_b: 0,
          uniform_c: new Float32Array([0.25, 0.5, 0.75, 0.8]),
          uniform_d: new Float32Array(4),
          nbMax: packed[1],
          systemSeed: 1,
          cameraXRSettings: new THREE.Vector3(1, 0, 0),
        },
      });
      renderer.setRenderTarget(source);
      renderer.setClearColor(0, 0);
      renderer.clear();
      renderer.copyTextureToTexture(source.depthTexture, destination.depthTexture);
      renderer.setRenderTarget(source);
      const arcCamera = new THREE.PerspectiveCamera(45, 1, 0.1, 10);
      arcCamera.updateMatrixWorld(true);
      await arc.prepare(renderer, arcCamera);
      arc.render(
        renderer,
        { camera: arcCamera, scene: new THREE.Scene() },
        destination.depthTexture,
        4,
        4
      );
      const arcPixel = new Uint8Array(4);
      renderer.readRenderTargetPixels(source, 2, 2, 1, 1, arcPixel);
      // An opaque surface in front must hide the actual strip vertex program.
      scene.children[0].material = mat;
      renderer.render(scene, camera);
      renderer.copyTextureToTexture(source.depthTexture, destination.depthTexture);
      renderer.setRenderTarget(source);
      arc.render(renderer, { camera: arcCamera, scene: new THREE.Scene() },
        destination.depthTexture, 4, 4);
      const occludedPixel = new Uint8Array(4);
      renderer.readRenderTargetPixels(source, 2, 2, 1, 1, occludedPixel);
      const error = renderer.getContext().getError();
      arc.destroy();
      white.dispose();
      curve.dispose();
      source.dispose();
      destination.dispose();
      renderer.dispose();
      return { pixel: Array.from(pixel), arcPixel: Array.from(arcPixel),
        occludedPixel: Array.from(occludedPixel), error };
    });
    assert.equal(result.error, 0);
    assert.ok(Math.abs(result.pixel[0] / 255 - 0.6) < 0.006, JSON.stringify(result));
    assert.ok(Math.abs(result.arcPixel[0] / 255 - 0.2) < 0.015, JSON.stringify(result));
    assert.ok(Math.abs(result.arcPixel[3] / 255 - 0.64) < 0.015, JSON.stringify(result));
    assert.deepEqual(result.occludedPixel, [255, 255, 255, 255]);
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
});

test('AuraArc original variants compile on WebGL2 and source soft-depth fade matches nonendpoint values', async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage();
    const results = await page.evaluate((programs) => {
      const gl = document.createElement('canvas').getContext('webgl2');
      const compile = (v, f) => {
        const p = gl.createProgram();
        for (const [kind, source] of [
          [gl.VERTEX_SHADER, v],
          [gl.FRAGMENT_SHADER, f],
        ]) {
          const s = gl.createShader(kind);
          gl.shaderSource(s, '#version 300 es\n' + source);
          gl.compileShader(s);
          if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
          gl.attachShader(p, s);
        }
        gl.linkProgram(p);
        if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
        return p;
      };
      for (const source of Object.values(programs))
        compile(source.vertexShader, source.fragmentShader);
      const v = `precision highp float;out vec2 vs_TEXCOORD0;out vec4 vs_COLOR0;out vec4 vs_TEXCOORD1;uniform float vertexZ;void main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);gl_Position=vec4(p*2.-1.,vertexZ,1.);vs_TEXCOORD0=vec2(.5);vs_COLOR0=vec4(.25,.5,.75,.8);vs_TEXCOORD1=vec4(1,0,0,0);}`;
      const p = compile(v, programs.none.fragmentShader);
      gl.useProgram(p);
      const uniform = (name) => gl.getUniformLocation(p, name);
      gl.uniform4f(uniform('_ScaledScreenParams'), 1, 1, 2, 2);
      gl.uniform2f(uniform('_GlobalMipBias'), 0, 1);
      gl.uniform4f(uniform('_ProjectionParams'), 1, 0.1, 10, 0.1);
      const texture = (unit, data) => {
        gl.activeTexture(gl.TEXTURE0 + unit);
        const t = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, t);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, 1, 1, 0, gl.RGBA, gl.FLOAT, data);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        return t;
      };
      texture(0, new Float32Array([1, 1, 1, 1]));
      gl.uniform1i(uniform('mainTexture'), 0);
      const depth = texture(1, new Float32Array([1, 1, 1, 1]));
      gl.uniform1i(uniform('_CameraDepthTexture'), 1);
      const out = [];
      gl.viewport(0, 0, 1, 1);
      for (const ortho of [false, true])
        for (const difference of [-0.2, 0, 0.13, 0.47, 0.89, 1, 1.2]) {
          const particle = ortho ? 0.1 + 9.9 * 0.5 : 1,
            scene = particle + difference;
          const sampled = ortho ? (scene - 0.1) / 9.9 : (1 / scene - 10) / -9.9;
          gl.activeTexture(gl.TEXTURE1);
          gl.bindTexture(gl.TEXTURE_2D, depth);
          gl.texSubImage2D(
            gl.TEXTURE_2D,
            0,
            0,
            0,
            1,
            1,
            gl.RGBA,
            gl.FLOAT,
            new Float32Array([sampled, 0, 0, 1])
          );
          gl.uniform4f(uniform('unity_OrthoParams'), 0, 0, 0, ortho ? 1 : 0);
          gl.uniform4f(uniform('_ZBufferParams'), -99, 100, -9.9, 10);
          gl.uniform1f(uniform('vertexZ'), 0);
          gl.drawArrays(gl.TRIANGLES, 0, 3);
          const pixel = new Uint8Array(4);
          gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
          out.push({ ortho, difference, alpha: pixel[3] / 255 });
        }
      return out;
    }, auraArcPrograms);
    for (const row of results) {
      const x = Math.max(0, Math.min(1, row.difference));
      assert.ok(Math.abs(row.alpha - x * x * (3 - 2 * x) * 0.8) < 0.006, JSON.stringify(row));
    }
  } finally {
    await browser.close();
  }
});
