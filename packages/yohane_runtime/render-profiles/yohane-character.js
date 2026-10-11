import { profilePrograms } from './outline-program.js';
import { createAuraArcBinding } from '../particles/aura-arc-binding.js';
import { createBloom } from './bloom.js';
import { bloomCompositeProgram } from './bloom-composite.js';
// Camera renderer index 1 -> URP-Outline-Renderer (5967) -> feature 5958.
// Raw fragment body is compiled Hidden/BX/OutlinePostEffect program 9-0004.
export function createRenderProfile({ THREE, renderer, createPassMaterial }) {
  const roots = new Set();
  const records = [];
  const registeredMeshes = new Set();
  const runtimes = new Set();
  const materials = new Set();
  const sceneObjects = [];
  const auraBindings = new Map();
  const bloom = createBloom({ THREE, renderer });
  let bloomEnabled = true;
  let auraEnabled = true,
    auraSeed = null,
    auraDepthTarget = null;
  const seedWord = new Uint32Array(1);
  function initialAuraSeed(instance) {
    if (auraSeed !== null) {
      return auraSeed;
    }
    if (!instance.resetSeedOnPlay) {
      return instance.startSeed >>> 0;
    }
    crypto.getRandomValues(seedWord);
    return seedWord[0];
  }
  const hidden = new THREE.MeshBasicMaterial();
  hidden.visible = false;
  const savedColor = new THREE.Color();
  const savedViewport = new THREE.Vector4();
  const savedScissor = new THREE.Vector4();
  const outputViewport = new THREE.Vector4();
  const outputScissor = new THREE.Vector4();
  let normalTarget = null,
    colorTarget = null,
    outlineTarget = null;
  let width = 0,
    height = 0,
    dirty = true,
    destroyed = false;
  const identity = new Float32Array(new THREE.Matrix4().elements);
  const uniforms = {
    hlslcc_mtx4x4unity_ObjectToWorld: { value: identity },
    hlslcc_mtx4x4unity_MatrixVP: { value: identity },
    _ProjectionParams: { value: new THREE.Vector4(1, 0, 0, 0) },
    _ScreenParams: { value: new THREE.Vector4() },
    _GlobalMipBias: { value: new THREE.Vector2(0, 1) },
    _ZBufferParams: { value: new THREE.Vector4() },
    _OutlineColor: {
      value: new THREE.Vector4(0.4811320900917053, 0.4289337992668152, 0.4289337992668152, 1),
    },
    _OutlineWidth: { value: 0.5 },
    _DepthScale: { value: 10 },
    _Threshold: { value: 1 },
    _CameraDepthTexture: { value: null },
    _CameraNormalsTexture: { value: null },
    _MainTex: { value: null },
  };
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'in_POSITION0',
    new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3),
  );
  geometry.setAttribute('in_TEXCOORD0', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
  // Raw source attribute names do not provide Three's position.count fallback.
  geometry.setDrawRange(0, 3);
  const outlineMaterial = new THREE.RawShaderMaterial({
    ...profilePrograms.outline,
    uniforms,
    glslVersion: THREE.GLSL3,
    depthTest: false,
    depthWrite: false,
    blending: THREE.NoBlending,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  const quadScene = new THREE.Scene();
  const quad = new THREE.Mesh(geometry, outlineMaterial);
  quad.frustumCulled = false;
  quadScene.add(quad);
  const quadCamera = new THREE.Camera();
  const copyGeometry = new THREE.BufferGeometry();
  copyGeometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3),
  );
  copyGeometry.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
  const copyUniforms = { uSource: { value: null } };
  const copyMaterial = new THREE.ShaderMaterial({
    ...profilePrograms.copy,
    uniforms: copyUniforms,
    depthTest: false,
    depthWrite: false,
    blending: THREE.NoBlending,
    toneMapped: false,
  });
  const copyScene = new THREE.Scene();
  const copyQuad = new THREE.Mesh(copyGeometry, copyMaterial);
  copyQuad.frustumCulled = false;
  copyScene.add(copyQuad);
  const bloomUniforms = {
    uSource: { value: null },
    uBloom: { value: null },
    // Event Volume Profile / Bloom80: intensity override = 12; tint default white.
    uIntensity: { value: 12 },
    uPremultipliedAlpha: {
      value: renderer.getContext?.().getContextAttributes?.()?.premultipliedAlpha ?? true,
    },
  };
  const bloomMaterial = new THREE.ShaderMaterial({
    ...bloomCompositeProgram,
    uniforms: bloomUniforms,
    depthTest: false,
    depthWrite: false,
    blending: THREE.NoBlending,
    toneMapped: false,
  });
  function setTargets(w, h) {
    if (width === w && height === h) {
      return false;
    }
    if (!normalTarget) {
      if (!renderer.extensions?.has?.('EXT_color_buffer_float')) {
        throw new Error('Yohane outline requires signed floating-point normal attachments');
      }
      normalTarget = new THREE.WebGLRenderTarget(w, h, {
        type: THREE.HalfFloatType,
        format: THREE.RGBAFormat,
        minFilter: THREE.NearestFilter,
        magFilter: THREE.NearestFilter,
        depthBuffer: true,
        stencilBuffer: false,
      });
      normalTarget.depthTexture = new THREE.DepthTexture(w, h, THREE.UnsignedIntType);
      normalTarget.depthTexture.minFilter = THREE.NearestFilter;
      normalTarget.depthTexture.magFilter = THREE.NearestFilter;
      colorTarget = new THREE.WebGLRenderTarget(w, h, {
        type: THREE.HalfFloatType,
        depthBuffer: true,
        stencilBuffer: false,
      });
      outlineTarget = new THREE.WebGLRenderTarget(w, h, {
        type: THREE.HalfFloatType,
        depthBuffer: false,
        stencilBuffer: false,
      });
      for (const target of [normalTarget, colorTarget, outlineTarget]) {
        target.texture.colorSpace = THREE.NoColorSpace;
      }
    } else {
      for (const target of [normalTarget, colorTarget, outlineTarget]) {
        target.setSize(w, h);
      }
    }
    width = w;
    height = h;
    bloom.setSize(w, h);
    auraDepthTarget?.setSize(w, h);
    uniforms._ScreenParams.value.set(w, h, 1 + 1 / w, 1 + 1 / h);
    uniforms._CameraDepthTexture.value = normalTarget.depthTexture;
    uniforms._CameraNormalsTexture.value = normalTarget.texture;
    return true;
  }
  function runtimeFrame(frame) {
    for (const runtime of runtimes) {
      runtime.setFrame?.(frame);
    }
  }
  function isTransparentPhase(material) {
    if (material.visible === false) {
      return false;
    }
    const queue = material.userData?.materialPass?.renderState?.renderQueue;
    if (!Number.isFinite(queue)) {
      throw new Error('Yohane color Pass requires its source renderQueue');
    }
    // URP RenderQueueRange.opaque includes GeometryLast (2500). Three's
    // transparent flag also implements queue sorting and is not source SurfaceType.
    return queue > 2500;
  }
  async function prepare(frame) {
    if (destroyed) {
      throw new Error('Yohane render profile is destroyed');
    }
    setTargets(
      Math.max(1, Math.round(frame.viewport.z)),
      Math.max(1, Math.round(frame.viewport.w)),
    );
    const changed = dirty;
    if (dirty) {
      for (const [metadataRoot, bindings] of auraBindings) {
        let retained = false;
        for (const root of roots) {
          if (root === metadataRoot || root.getObjectById(metadataRoot.id)) {
            retained = true;
          }
        }
        if (!retained) {
          for (const binding of bindings) {
            binding.destroy();
          }
          auraBindings.delete(metadataRoot);
        }
      }
      for (const root of roots) {
        root.updateWorldMatrix(true, true);
        const metadataRoots = [];
        root.traverse((node) => {
          if (node.userData.yohaneAuraArc?.length) {
            metadataRoots.push(node);
          }
        });
        for (const metadataRoot of metadataRoots) {
          if (!auraBindings.has(metadataRoot)) {
            const { auraArcCurve } = await import('../particles/resources/aura-curve.js');
            const bindings = [];
            try {
              for (const instance of metadataRoot.userData.yohaneAuraArc) {
                bindings.push(
                  createAuraArcBinding({
                    THREE,
                    root,
                    metadataRoot,
                    instance,
                    curve: auraArcCurve,
                    seed: initialAuraSeed(instance),
                  }),
                );
              }
            } catch (error) {
              for (const binding of bindings) {
                binding.destroy();
              }
              throw error;
            }
            auraBindings.set(metadataRoot, bindings);
          }
        }
      }
      if (auraBindings.size && !auraDepthTarget) {
        colorTarget.dispose();
        colorTarget.depthTexture = new THREE.DepthTexture(width, height, THREE.UnsignedIntType);
        colorTarget.depthTexture.minFilter = colorTarget.depthTexture.magFilter =
          THREE.NearestFilter;
        // Independent depth attachment avoids texture/FBO feedback during the
        // transparent output draw. Source depth is copied after opaque colors.
        auraDepthTarget = new THREE.WebGLRenderTarget(width, height, {
          depthBuffer: true,
          stencilBuffer: false,
        });
        auraDepthTarget.depthTexture = new THREE.DepthTexture(width, height, THREE.UnsignedIntType);
        auraDepthTarget.depthTexture.minFilter = auraDepthTarget.depthTexture.magFilter =
          THREE.NearestFilter;
        renderer.initRenderTarget(auraDepthTarget);
      }
      // createPassMaterial products belong to the renderer scope; the profile
      // owns only its own fullscreen materials and render targets.
      materials.clear();
      records.length = 0;
      registeredMeshes.clear();
      runtimes.clear();
      sceneObjects.length = 0;
      for (const root of roots) {
        const meshes = [];
        root.traverse((object) => {
          if (object.isMesh) {
            meshes.push(object);
          }
        });
        for (const mesh of meshes) {
          registeredMeshes.add(mesh);
          const bound = mesh.userData.__parameterizedMaterials ?? mesh.material;
          const source = Array.isArray(bound) ? bound : [bound];
          const transparency = source.map(isTransparentPhase);
          const normals = [];
          for (const [index, material] of source.entries()) {
            for (const runtime of material.userData?.__parameterizedShaderRuntimes ?? []) {
              runtimes.add(runtime);
            }
            const pass = material.userData?.__parameterizedPassId;
            // The source Aura shader has only Universal Forward, so it does
            // not participate in URP's DepthNormals shader-tag selection.
            if (
              transparency[index] ||
              material.userData?.__parameterizedShader === 'yohane-aura' ||
              !pass?.match(/^Forward(?:Front)?_/)
            ) {
              normals.push(hidden);
              continue;
            }
            const aux = material.userData?.materialPass?.extras?.depthNormalsPass;
            if (!aux) {
              throw new Error('Yohane source color Pass requires extras.depthNormalsPass');
            }
            const normal = await createPassMaterial(material, aux, mesh);
            normal.depthWrite = true;
            normal.depthTest = true;
            normal.blending = THREE.NoBlending;
            normal.transparent = false;
            materials.add(normal);
            normals.push(normal);
          }
          records.push({
            mesh,
            source,
            original: mesh.material,
            normals,
            opaque: source.map((m, i) => (transparency[i] ? hidden : m)),
            transparent: source.map((m, i) => (transparency[i] ? m : hidden)),
            visible: false,
          });
        }
      }
      frame.scene.traverse((object) => {
        if (object.isMesh && !registeredMeshes.has(object)) {
          sceneObjects.push({ object, visible: false });
        }
      });
      dirty = false;
    }
    runtimeFrame(frame);
    for (const bindings of auraBindings.values()) {
      for (const binding of bindings) {
        binding.anchor(frame.time);
      }
    }
    if (!changed) {
      return;
    }
    // Driver compilation happens during preparation, never in render().
    const originalBackground = frame.scene.background;
    const originalMaterials = records.map((record) => record.mesh.material);
    const priorTarget = renderer.getRenderTarget();
    try {
      frame.scene.background = null;
      for (const record of records) {
        record.mesh.material = record.normals.length === 1 ? record.normals[0] : record.normals;
      }
      renderer.setRenderTarget(normalTarget);
      await renderer.compileAsync(frame.scene, frame.camera);
      for (let i = 0; i < records.length; i++) {
        records[i].mesh.material = originalMaterials[i];
      }
      frame.scene.background = originalBackground;
      renderer.setRenderTarget(colorTarget);
      await renderer.compileAsync(frame.scene, frame.camera);
      renderer.setRenderTarget(outlineTarget);
      await renderer.compileAsync(quadScene, quadCamera);
      renderer.setRenderTarget(colorTarget);
      await renderer.compileAsync(copyScene, quadCamera);
      renderer.setRenderTarget(frame.target);
      await renderer.compileAsync(copyScene, quadCamera);
      await bloom.prepare();
      copyQuad.material = bloomMaterial;
      await renderer.compileAsync(copyScene, quadCamera);
      for (const bindings of auraBindings.values()) {
        for (const binding of bindings) {
          await binding.prepare(renderer, frame.camera, frame.time);
        }
      }
    } finally {
      frame.scene.background = originalBackground;
      for (let i = 0; i < records.length; i++) {
        records[i].mesh.material = originalMaterials[i];
      }
      renderer.setRenderTarget(priorTarget);
      copyQuad.material = copyMaterial;
    }
  }
  function phase(key) {
    for (const record of records) {
      const list = record[key];
      record.mesh.material = list.length === 1 ? list[0] : list;
      record.mesh.visible = record.visible && list.some((m) => m.visible);
    }
  }
  function fullscreen(material, texture, target, scene) {
    if (texture) {
      copyUniforms.uSource.value = texture;
    }
    // RenderTarget.viewport already uses attachment pixels. setViewport applies
    // the renderer's canvas pixel ratio and must not rescale these attachments.
    renderer.setRenderTarget(target);
    renderer.setScissorTest(false);
    renderer.render(scene, quadCamera);
  }
  function render(frame) {
    if (destroyed || dirty || !normalTarget) {
      throw new Error('Yohane render profile must be prepared before rendering');
    }
    setTargets(
      Math.max(1, Math.round(frame.viewport.z)),
      Math.max(1, Math.round(frame.viewport.w)),
    );
    runtimeFrame(frame);
    const near = frame.camera.near,
      far = frame.camera.far;
    const invNear = near === 0 ? 0 : 1 / near,
      invFar = far === 0 ? 0 : 1 / far;
    const zc0 = 1 - far * invNear,
      zc1 = far * invNear;
    uniforms._ZBufferParams.value.set(zc0, zc1, zc0 * invFar, zc1 * invFar);
    const target = renderer.getRenderTarget();
    renderer.getViewport(savedViewport);
    renderer.getScissor(savedScissor);
    const scissorTest = renderer.getScissorTest();
    renderer.getClearColor(savedColor);
    const alpha = renderer.getClearAlpha();
    const autoClear = renderer.autoClear;
    const background = frame.scene.background;
    for (const entry of sceneObjects) {
      entry.visible = entry.object.visible;
      entry.object.visible = false;
    }
    for (const record of records) {
      record.visible = record.mesh.visible;
      record.original = record.mesh.material;
    }
    if (auraBindings.size) {
      for (const root of roots) {
        root.updateWorldMatrix(true, true);
      }
    }
    for (const bindings of auraBindings.values()) {
      for (const binding of bindings) {
        binding.captureVisibility();
      }
    }
    try {
      renderer.autoClear = false;
      frame.scene.background = null;
      renderer.setScissorTest(false);
      phase('normals');
      renderer.setRenderTarget(normalTarget);
      renderer.setClearColor(0, 1);
      renderer.clear(true, true, false);
      renderer.render(frame.scene, frame.camera);
      phase('opaque');
      renderer.setRenderTarget(colorTarget);
      renderer.setClearColor(
        background?.isColor ? background : savedColor,
        background?.isColor ? 1 : alpha,
      );
      renderer.clear(true, true, false);
      renderer.render(frame.scene, frame.camera);
      if (auraEnabled && auraBindings.size) {
        renderer.initRenderTarget(auraDepthTarget);
        renderer.copyTextureToTexture(colorTarget.depthTexture, auraDepthTarget.depthTexture);
        renderer.setRenderTarget(colorTarget);
      }
      if (background !== null && !background.isColor) {
        for (const record of records) {
          record.mesh.visible = false;
        }
        frame.scene.background = background;
        renderer.render(frame.scene, frame.camera);
        frame.scene.background = null;
      }
      uniforms._MainTex.value = colorTarget.texture;
      fullscreen(outlineMaterial, null, outlineTarget, quadScene);
      fullscreen(copyMaterial, outlineTarget.texture, colorTarget, copyScene);
      phase('transparent');
      renderer.setRenderTarget(colorTarget);
      renderer.render(frame.scene, frame.camera);
      for (const bindings of auraBindings.values()) {
        for (const binding of bindings) {
          const enabled = auraEnabled && binding.isVisible();
          binding.advance(frame.time, enabled);
          if (enabled) {
            binding.draw.render(renderer, frame, auraDepthTarget.depthTexture, width, height);
          }
        }
      }
      copyUniforms.uSource.value = colorTarget.texture;
      if (bloomEnabled) {
        bloomUniforms.uSource.value = colorTarget.texture;
        bloomUniforms.uBloom.value = bloom.render(colorTarget.texture);
        copyQuad.material = bloomMaterial;
      } else {
        copyQuad.material = copyMaterial;
      }
      // Profile frames carry physical draw pixels; these public Three setters
      // multiply by canvas DPR even when a RenderTarget is active.
      const pixelRatio = renderer.getPixelRatio();
      renderer.setRenderTarget(frame.target);
      renderer.setViewport(outputViewport.copy(frame.viewport).multiplyScalar(1 / pixelRatio));
      renderer.setScissor(outputScissor.copy(frame.scissor).multiplyScalar(1 / pixelRatio));
      renderer.setScissorTest(frame.scissorTest);
      renderer.render(copyScene, quadCamera);
    } finally {
      for (const record of records) {
        record.mesh.material = record.original;
        record.mesh.visible = record.visible;
      }
      for (const entry of sceneObjects) {
        entry.object.visible = entry.visible;
      }
      frame.scene.background = background;
      copyQuad.material = copyMaterial;
      renderer.autoClear = autoClear;
      renderer.setClearColor(savedColor, alpha);
      renderer.setRenderTarget(target);
      renderer.setViewport(savedViewport);
      renderer.setScissor(savedScissor);
      renderer.setScissorTest(scissorTest);
    }
  }
  return {
    attach(root) {
      if (!roots.has(root)) {
        roots.add(root);
        dirty = true;
      }
    },
    detach(root) {
      if (roots.delete(root)) {
        dirty = true;
      }
    },
    prepare,
    render,
    setBloomEnabled(enabled) {
      bloomEnabled = !!enabled;
    },
    setAuraArcEnabled(enabled) {
      auraEnabled = !!enabled;
    },
    resetAuraArc(seed) {
      auraSeed = seed >>> 0;
      for (const bindings of auraBindings.values()) {
        for (const binding of bindings) {
          binding.reset(auraSeed);
        }
      }
    },
    getAuraArcMetrics() {
      let strips = 0,
        trajectories = 0;
      for (const bindings of auraBindings.values()) {
        for (const binding of bindings) {
          strips += binding.simulation.activeStripCount;
          trajectories += binding.simulation.trajectoryCount;
        }
      }
      return { enabled: auraEnabled, instances: auraBindings.size, strips, trajectories };
    },
    destroy() {
      if (destroyed) {
        return;
      }
      destroyed = true;
      for (const bindings of auraBindings.values()) {
        for (const binding of bindings) {
          binding.destroy();
        }
      }
      auraBindings.clear();
      roots.clear();
      materials.clear();
      hidden.dispose();
      outlineMaterial.dispose();
      copyMaterial.dispose();
      bloomMaterial.dispose();
      bloom.destroy();
      geometry.dispose();
      copyGeometry.dispose();
      for (const rt of [normalTarget, colorTarget, outlineTarget, auraDepthTarget]) {
        rt?.dispose();
      }
      records.length = 0;
    },
  };
}
