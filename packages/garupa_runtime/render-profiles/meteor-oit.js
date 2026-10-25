import { blendBufferFragment, normalFragment, clearFragment } from './meteor-oit-programs.js';

const fullscreenVertex = `
precision highp float;
in vec3 position;
in vec2 uv;
out highp vec2 vs_TEXCOORD1;
void main() {
  vs_TEXCOORD1 = uv;
  gl_Position = vec4(position, 1.0);
}
`;

const copyFragment = `
precision highp float;
uniform sampler2D uSource;
in highp vec2 vs_TEXCOORD1;
out vec4 color;
void main() {
  color = texture(uSource, vs_TEXCOORD1);
}
`;

function withoutVersion(source) {
  return source.replace(/^\s*#version 300 es\s*\n/, '');
}

// WebGL2 equivalent of the source's single-sample 24-bit CopyDepth calls.
// Reading pixels is unnecessary; the copy remains entirely on the GPU.
export function copyDepthAttachment(THREE, renderer, source, destination) {
  if (!source?.depthTexture || !destination?.depthTexture || source.samples || destination.samples) {
    throw new Error('Meteor depth copy requires single-sample depth-texture targets');
  }
  if (source.width !== destination.width || source.height !== destination.height) {
    throw new Error('Meteor depth-copy attachment sizes must match');
  }
  blitAttachments(THREE, renderer, source, destination, false);
}

// Host AA adaptation: resolve opaque/Outline coverage before the original
// single-sample OIT schedule. The source Shader and depth comparison stay intact.
export function resolveOpaqueAttachments(THREE, renderer, source, destination) {
  if (source?.samples !== 4 || destination?.samples !== 0
      || source.depthTexture?.type !== THREE.UnsignedIntType
      || destination.depthTexture?.type !== THREE.UnsignedIntType) {
    throw new Error('Meteor opaque resolve requires 4x MSAA to single-sample 24-bit depth targets');
  }
  for (const target of [source, destination]) {
    if (target.texture?.type !== THREE.UnsignedByteType || target.texture.format !== THREE.RGBAFormat
        || target.texture.colorSpace !== THREE.NoColorSpace) {
      throw new Error('Meteor opaque resolve requires linear RGBA8 attachments');
    }
  }
  if (source.width !== destination.width || source.height !== destination.height) {
    throw new Error('Meteor opaque resolve attachment sizes must match');
  }
  blitAttachments(THREE, renderer, source, destination, true);
}

function blitAttachments(THREE, renderer, source, destination, colorAndDepth) {
  const gl = renderer.getContext();
  const previous = renderer.getRenderTarget();
  const face = renderer.getActiveCubeFace();
  const mip = renderer.getActiveMipmapLevel();
  const viewport = renderer.getViewport(new THREE.Vector4());
  const scissor = renderer.getScissor(new THREE.Vector4());
  const scissorTest = renderer.getScissorTest();
  try {
    renderer.setRenderTarget(source);
    const read = gl.getParameter(gl.FRAMEBUFFER_BINDING);
    if (colorAndDepth && gl.getParameter(gl.SAMPLES) !== 4) {
      throw new Error('Meteor opaque attachment did not provide 4x MSAA');
    }
    renderer.setRenderTarget(destination);
    const draw = gl.getParameter(gl.FRAMEBUFFER_BINDING);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, read);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, draw);
    gl.disable(gl.SCISSOR_TEST);
    gl.blitFramebuffer(0, 0, source.width, source.height, 0, 0, destination.width,
      destination.height, gl.DEPTH_BUFFER_BIT | (colorAndDepth ? gl.COLOR_BUFFER_BIT : 0), gl.NEAREST);
  } finally {
    // Direct framebuffer binds invalidate Three's cached GL state.
    renderer.resetState();
    renderer.setRenderTarget(previous, face, mip);
    renderer.setViewport(viewport); renderer.setScissor(scissor); renderer.setScissorTest(scissorTest);
  }
}

// Shared per-profile resources. Commands are deliberately separate so the
// original carried setup gate can control whether they execute this invocation.
export function createMeteorOit({ THREE, renderer }) {
  if (!renderer.extensions.has('EXT_color_buffer_float')) {
    throw new Error('Meteor OIT requires RGBA16F render attachments');
  }
  const mrt = new THREE.WebGLRenderTarget(1, 1, {
    count: 2, type: THREE.HalfFloatType, format: THREE.RGBAFormat,
    minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
    wrapS: THREE.RepeatWrapping, wrapT: THREE.RepeatWrapping,
    depthBuffer: true, stencilBuffer: false, samples: 0,
  });
  for (const t of mrt.textures) t.colorSpace = THREE.NoColorSpace;
  mrt.depthTexture = new THREE.DepthTexture(1, 1, THREE.UnsignedIntType);
  mrt.depthTexture.minFilter = mrt.depthTexture.magFilter = THREE.NearestFilter;
  mrt.depthTexture.wrapS = mrt.depthTexture.wrapT = THREE.RepeatWrapping;
  let temp = null;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([-1,-1,0, 3,-1,0, -1,3,0], 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute([0,0, 2,0, 0,2], 2));
  const scene = new THREE.Scene(), camera = new THREE.Camera();
  const uniforms = { _MainTex: { value: null }, _AccumTex: { value: mrt.textures[0] },
    _RevealageTex: { value: mrt.textures[1] } };
  const makeMaterial = (fragmentShader, values = uniforms) => new THREE.RawShaderMaterial({
    vertexShader: fullscreenVertex, fragmentShader: withoutVersion(fragmentShader),
    uniforms: values, glslVersion: THREE.GLSL3, depthTest: false, depthWrite: false,
    blending: THREE.NoBlending, side: THREE.DoubleSide, toneMapped: false,
  });
  const clear = makeMaterial(clearFragment);
  const blendBuffer = makeMaterial(blendBufferFragment);
  const normal = makeMaterial(normalFragment);
  const copyUniforms = { uSource: { value: null } };
  const copy = makeMaterial(copyFragment, copyUniforms);
  const mesh = new THREE.Mesh(geometry, clear);
  mesh.frustumCulled = false; scene.add(mesh);
  function draw(material) {
    mesh.material = material;
    const autoClear = renderer.autoClear;
    renderer.autoClear = false;
    try { renderer.render(scene, camera); }
    finally { renderer.autoClear = autoClear; }
  }
  return {
    get target() { return mrt; },
    get accumulationTexture() { return mrt.textures[0]; },
    get revealageTexture() { return mrt.textures[1]; },
    setup(source) {
      if (!source?.depthTexture || source.depthTexture.type !== THREE.UnsignedIntType || source.samples) {
        throw new Error('Meteor source requires a single-sample 24-bit depth attachment');
      }
      if (mrt.width !== source.width || mrt.height !== source.height) mrt.setSize(source.width, source.height);
      if (temp && (temp.texture.type !== source.texture.type || temp.texture.format !== source.texture.format
          || temp.texture.colorSpace !== source.texture.colorSpace)) {
        temp.dispose(); temp = null;
      }
      if (!temp) temp = new THREE.WebGLRenderTarget(source.width, source.height, {
        type: source.texture.type, format: source.texture.format,
        minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
        wrapS: THREE.RepeatWrapping, wrapT: THREE.RepeatWrapping,
        depthBuffer: false, stencilBuffer: false, samples: 0,
      });
      else if (temp.width !== source.width || temp.height !== source.height) temp.setSize(source.width, source.height);
      temp.texture.colorSpace = source.texture.colorSpace;
      return true;
    },
    copyDepthIn(source) { copyDepthAttachment(THREE, renderer, source, mrt); },
    bind() { renderer.setRenderTarget(mrt); },
    clear() { draw(clear); },
    saveSourceColor(source) {
      if (!temp) throw new Error('Meteor OIT setup required');
      copyUniforms.uSource.value = source.texture;
      renderer.setRenderTarget(temp); draw(copy);
    },
    bindGlobals() { uniforms._MainTex.value = temp.texture; },
    composite(source, forBlendBufferTexture = true) {
      renderer.setRenderTarget(source); draw(forBlendBufferTexture ? blendBuffer : normal);
    },
    copyDepthBack(destination) { copyDepthAttachment(THREE, renderer, mrt, destination); },
    destroy() {
      mrt.dispose(); temp?.dispose(); geometry.dispose();
      for (const material of [clear, blendBuffer, normal, copy]) material.dispose();
    },
  };
}
