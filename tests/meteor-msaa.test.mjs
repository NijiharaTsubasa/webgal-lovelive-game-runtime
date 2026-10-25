import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { resolveOpaqueAttachments, copyDepthAttachment } from '../packages/garupa_runtime/render-profiles/meteor-oit.js';
import { createRenderProfile } from '../packages/garupa_runtime/render-profiles/garupa-menu.js';

function attachment(samples = 0) {
  const target = new THREE.WebGLRenderTarget(73, 109, {
    samples, type: THREE.UnsignedByteType, format: THREE.RGBAFormat,
    depthBuffer: true, stencilBuffer: false,
  });
  target.texture.colorSpace = THREE.NoColorSpace;
  target.depthTexture = new THREE.DepthTexture(73, 109, THREE.UnsignedIntType);
  return target;
}

function rendererFixture({ actualSamples, failBlit = false } = {}) {
  const previous = attachment(), viewport = new THREE.Vector4(7, 11, 131, 173);
  const scissor = new THREE.Vector4(13, 17, 89, 101), calls = [];
  let current = previous, read = previous, draw = previous, face = 3, mip = 2, scissorTest = true;
  let resets = 0;
  const gl = {
    FRAMEBUFFER: 0x8d40, FRAMEBUFFER_BINDING: 0x8ca6,
    READ_FRAMEBUFFER: 0x8ca8, DRAW_FRAMEBUFFER: 0x8ca9,
    READ_FRAMEBUFFER_BINDING: 0x8caa, DRAW_FRAMEBUFFER_BINDING: 0x8ca6,
    SAMPLES: 0x80a9, COLOR_BUFFER_BIT: 0x4000, DEPTH_BUFFER_BIT: 0x0100,
    NEAREST: 0x2600, SCISSOR_TEST: 0x0c11,
    getParameter(parameter) {
      if (parameter === this.SAMPLES) return actualSamples ?? draw?.samples ?? 0;
      if (parameter === this.READ_FRAMEBUFFER_BINDING) return read;
      return draw;
    },
    bindFramebuffer(binding, value) {
      if (binding !== this.DRAW_FRAMEBUFFER) read = value;
      if (binding !== this.READ_FRAMEBUFFER) draw = value;
    },
    disable(parameter) { assert.equal(parameter, this.SCISSOR_TEST); scissorTest = false; },
    blitFramebuffer(...args) {
      calls.push({ args, read, draw, scissorTest });
      if (failBlit) throw new Error('deliberate framebuffer failure');
    },
  };
  const renderer = {
    getContext: () => gl, getRenderTarget: () => current,
    getActiveCubeFace: () => face, getActiveMipmapLevel: () => mip,
    getViewport: value => value.copy(viewport), getScissor: value => value.copy(scissor),
    getScissorTest: () => scissorTest,
    setViewport: value => viewport.copy(value), setScissor: value => scissor.copy(value),
    setScissorTest: value => { scissorTest = value; },
    setRenderTarget(target, nextFace = 0, nextMip = 0) {
      current = read = draw = target; face = nextFace; mip = nextMip;
      viewport.set(0, 0, target?.width ?? 1, target?.height ?? 1);
      scissor.copy(viewport);
    },
    resetState() { resets++; read = draw = null; },
  };
  function assertRestored() {
    assert.equal(current, previous); assert.equal(read, previous); assert.equal(draw, previous);
    assert.equal(face, 3); assert.equal(mip, 2);
    assert.deepEqual(viewport.toArray(), [7, 11, 131, 173]);
    assert.deepEqual(scissor.toArray(), [13, 17, 89, 101]);
    assert.equal(scissorTest, true); assert.equal(resets, 1);
  }
  return { renderer, gl, calls, assertRestored };
}

test('opaque resolve copies color and D24 depth with nearest and restores host state', () => {
  const f = rendererFixture(), source = attachment(4), destination = attachment();
  resolveOpaqueAttachments(THREE, f.renderer, source, destination);
  assert.equal(f.calls.length, 1);
  assert.deepEqual(f.calls[0], { args: [0, 0, 73, 109, 0, 0, 73, 109,
    f.gl.COLOR_BUFFER_BIT | f.gl.DEPTH_BUFFER_BIT, f.gl.NEAREST], read: source, draw: destination, scissorTest: false });
  f.assertRestored();
});

test('opaque resolve restores host state when the framebuffer blit throws', () => {
  const f = rendererFixture({ failBlit: true });
  assert.throws(() => resolveOpaqueAttachments(THREE, f.renderer, attachment(4), attachment()), /deliberate framebuffer failure/);
  assert.equal(f.calls.length, 1); f.assertRestored();
});

test('opaque resolve rejects driver sample downgrade and restores host state before any blit', () => {
  const f = rendererFixture({ actualSamples: 2 });
  assert.throws(() => resolveOpaqueAttachments(THREE, f.renderer, attachment(4), attachment()), /4|sample/i);
  assert.equal(f.calls.length, 0); f.assertRestored();
});

const invalidAttachments = [
  ['single sample source', source => { source.samples = 0; }],
  ['two sample source', source => { source.samples = 2; }],
  ['multisample destination', (_, destination) => { destination.samples = 4; }],
  ['mismatched width', (_, destination) => { destination.width++; }],
  ['mismatched height', (_, destination) => { destination.height++; }],
  ['missing source depth', source => { source.depthTexture = null; }],
  ['missing destination depth', (_, destination) => { destination.depthTexture = null; }],
  ['source float color', source => { source.texture.type = THREE.HalfFloatType; }],
  ['destination float color', (_, destination) => { destination.texture.type = THREE.HalfFloatType; }],
  ['source red color', source => { source.texture.format = THREE.RedFormat; }],
  ['destination red color', (_, destination) => { destination.texture.format = THREE.RedFormat; }],
  ['source sRGB color', source => { source.texture.colorSpace = THREE.SRGBColorSpace; }],
  ['destination sRGB color', (_, destination) => { destination.texture.colorSpace = THREE.SRGBColorSpace; }],
  ['source short depth', source => { source.depthTexture.type = THREE.UnsignedShortType; }],
  ['destination short depth', (_, destination) => { destination.depthTexture.type = THREE.UnsignedShortType; }],
];
for (const [name, change] of invalidAttachments) test(`opaque resolve rejects ${name} before blitting`, () => {
  const f = rendererFixture(), source = attachment(4), destination = attachment();
  change(source, destination);
  assert.throws(() => resolveOpaqueAttachments(THREE, f.renderer, source, destination), /Meteor/i);
  assert.equal(f.calls.length, 0);
});

test('OIT depth copy retains its single sample restriction', () => {
  const f = rendererFixture();
  assert.throws(() => copyDepthAttachment(THREE, f.renderer, attachment(4), attachment()), /single.sample/i);
  assert.throws(() => copyDepthAttachment(THREE, f.renderer, attachment(), attachment(4)), /single.sample/i);
  assert.equal(f.calls.length, 0);
});

for (const unsupportedFormat of ['RGBA8', 'DEPTH_COMPONENT24']) test(`profile rejects unavailable 4x ${unsupportedFormat} samples`, () => {
  const queries = [], gl = { RENDERBUFFER: 0x8d41, RGBA8: 0x8058, DEPTH_COMPONENT24: 0x81a6, SAMPLES: 0x80a9,
    getInternalformatParameter(target, format, parameter) {
      queries.push({ target, format, parameter });
      return new Int32Array(format === this[unsupportedFormat] ? [2, 1] : [4, 2, 1]);
    } };
  assert.throws(() => createRenderProfile({ THREE, renderer: {
    getContext: () => gl, extensions: { has: () => true },
  } }), /4|sample/i);
  assert.ok(queries.some(query => query.format === gl[unsupportedFormat]));
  for (const query of queries) {
    assert.equal(query.target, gl.RENDERBUFFER); assert.equal(query.parameter, gl.SAMPLES);
  }
});
