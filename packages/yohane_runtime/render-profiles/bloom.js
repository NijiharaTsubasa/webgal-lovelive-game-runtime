import { bloomPrograms, bloomVertexShader } from './bloom-program.js';

// Event.unity's Bloom volume uses LQ filtering, skipIterations = 5 and threshold = 1.3.
// RGB filtering follows URP SetupBloom; the character profile owns final intensity and alpha.
export function createBloom({ THREE, renderer }) {
  const mipDown = [];
  const mipUp = [];
  const materials = {};
  const uniforms = {
    _GlobalMipBias: { value: new THREE.Vector2(0, 1) },
    _Params: { value: new THREE.Vector4(0, 65472, 0, 0) },
    _SourceTex: { value: null },
    _SourceTexLowMip: { value: null },
    _SourceTex_TexelSize: { value: new THREE.Vector4() },
  };
  // Mathf.GammaToLinearSpace uses the power branch for gamma values above one.
  const scatter = Math.fround(Math.fround(Math.fround(0.7) * Math.fround(0.9)) + Math.fround(0.05));
  uniforms._Params.value.x = scatter;
  const threshold = Math.fround(Math.pow(Math.fround(1.3), Math.fround(2.2)));
  uniforms._Params.value.z = threshold;
  uniforms._Params.value.w = threshold * 0.5;
  for (const [name, fragmentShader] of Object.entries(bloomPrograms)) {
    materials[name] = new THREE.RawShaderMaterial({
      vertexShader: bloomVertexShader,
      fragmentShader,
      uniforms,
      glslVersion: THREE.GLSL3,
      depthTest: false,
      depthWrite: false,
      blending: THREE.NoBlending,
      toneMapped: false,
    });
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
  const quad = new THREE.Mesh(geometry, materials.prefilter);
  quad.frustumCulled = false;
  const scene = new THREE.Scene();
  scene.add(quad);
  const camera = new THREE.Camera();
  const savedViewport = new THREE.Vector4();
  const savedScissor = new THREE.Vector4();
  let width = 0;
  let height = 0;
  let destroyed = false;
  let preparePromise = null;

  function createTarget(targetWidth, targetHeight) {
    const target = new THREE.WebGLRenderTarget(targetWidth, targetHeight, {
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      wrapS: THREE.ClampToEdgeWrapping,
      wrapT: THREE.ClampToEdgeWrapping,
      depthBuffer: false,
      stencilBuffer: false,
      generateMipmaps: false,
    });
    target.texture.colorSpace = THREE.NoColorSpace;
    return target;
  }

  function disposeTargets() {
    for (const target of mipDown) {
      target.dispose();
    }
    for (const target of mipUp) {
      target.dispose();
    }
    mipDown.length = 0;
    mipUp.length = 0;
  }

  function setSize(nextWidth, nextHeight) {
    if (destroyed) {
      throw new Error('Yohane Bloom has been destroyed');
    }
    nextWidth = Math.max(1, Math.floor(nextWidth));
    nextHeight = Math.max(1, Math.floor(nextHeight));
    if (width === nextWidth && height === nextHeight) {
      return;
    }
    width = nextWidth;
    height = nextHeight;
    disposeTargets();
    let targetWidth = Math.max(1, width >> 1);
    let targetHeight = Math.max(1, height >> 1);
    const iterations = Math.floor(Math.log2(Math.max(targetWidth, targetHeight)) - 1) - 5;
    const mipCount = Math.max(1, Math.min(16, iterations));
    for (let i = 0; i < mipCount; i++) {
      mipDown.push(createTarget(targetWidth, targetHeight));
      mipUp.push(createTarget(targetWidth, targetHeight));
      targetWidth = Math.max(1, targetWidth >> 1);
      targetHeight = Math.max(1, targetHeight >> 1);
    }
  }

  function prepare() {
    if (destroyed) {
      return Promise.reject(new Error('Yohane Bloom has been destroyed'));
    }
    for (const target of mipDown) {
      renderer.initRenderTarget?.(target);
    }
    for (const target of mipUp) {
      renderer.initRenderTarget?.(target);
    }
    if (!preparePromise) {
      preparePromise = (async () => {
        try {
          for (const material of Object.values(materials)) {
            quad.material = material;
            await renderer.compileAsync(scene, camera);
          }
        } finally {
          quad.material = materials.prefilter;
        }
      })();
    }
    return preparePromise;
  }

  function draw(material, source, sourceWidth, sourceHeight, target) {
    quad.material = material;
    uniforms._SourceTex.value = source;
    uniforms._SourceTex_TexelSize.value.set(1 / sourceWidth, 1 / sourceHeight, sourceWidth, sourceHeight);
    renderer.setRenderTarget(target);
    // setRenderTarget applies the target's physical-pixel viewport directly.
    renderer.setScissorTest(false);
    renderer.render(scene, camera);
  }

  function render(sourceTexture) {
    if (destroyed || mipDown.length === 0) {
      throw new Error('Yohane Bloom requires setSize() before rendering');
    }
    const savedTarget = renderer.getRenderTarget();
    const savedScissorTest = renderer.getScissorTest();
    renderer.getViewport(savedViewport);
    renderer.getScissor(savedScissor);
    try {
      draw(materials.prefilter, sourceTexture, width, height, mipDown[0]);
      for (let i = 1; i < mipDown.length; i++) {
        const previous = mipDown[i - 1];
        const temporary = mipUp[i];
        draw(materials.horizontal, previous.texture, previous.width, previous.height, temporary);
        draw(materials.vertical, temporary.texture, temporary.width, temporary.height, mipDown[i]);
      }
      for (let i = mipDown.length - 2; i >= 0; i--) {
        uniforms._SourceTexLowMip.value = i === mipDown.length - 2
          ? mipDown[i + 1].texture
          : mipUp[i + 1].texture;
        const high = mipDown[i];
        draw(materials.upsample, high.texture, high.width, high.height, mipUp[i]);
      }
      // A one-level pyramid has no upsample pass; its prefilter is the final result.
      return mipDown.length === 1 ? mipDown[0].texture : mipUp[0].texture;
    } finally {
      renderer.setRenderTarget(savedTarget);
      renderer.setViewport(savedViewport);
      renderer.setScissor(savedScissor);
      renderer.setScissorTest(savedScissorTest);
    }
  }

  function destroy() {
    if (destroyed) {
      return;
    }
    destroyed = true;
    disposeTargets();
    geometry.dispose();
    for (const material of Object.values(materials)) {
      material.dispose();
    }
    uniforms._SourceTex.value = null;
    uniforms._SourceTexLowMip.value = null;
  }

  return { setSize, prepare, render, destroy };
}
