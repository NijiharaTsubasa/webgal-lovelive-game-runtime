import { createAuraArcParameters, createAuraArcSimulation } from './aura-arc-simulation.js';
import { createAuraArcRenderer } from './aura-arc-renderer.js';
// Unity's native skinned vertex buffer is expressed in its current rootBone
// frame. Recover that source frame from the normalized bone before sampling.
export function createAuraArcBinding({ THREE, root, metadataRoot, instance, curve, seed }) {
  let sourceNode, effectNode, skinRoot;
  if (!instance.source.skinRoot) {
    throw new Error('AuraArc source skinRoot is missing; regenerate the model');
  }
  metadataRoot.traverse((node) => {
    if (node.userData.__parameterizedPassObject) {
      return;
    }
    if (node.userData.yohaneAuraSourceNode === instance.source.node) {
      sourceNode = node;
    }
    if (node.userData.yohaneAuraArcNode === instance.node) {
      effectNode = node;
    }
    if (node.userData.yohaneAuraSkinRootNode === instance.source.skinRoot.node) {
      skinRoot = node;
    }
  });
  if (!sourceNode || !effectNode || !skinRoot) {
    throw new Error('AuraArc source/effect node binding is missing');
  }
  const sourceMeshes = [];
  sourceNode.traverse((node) => {
    if (node.isMesh && !node.userData.__parameterizedPassObject) {
      sourceMeshes.push(node);
    }
  });
  const mesh = sourceMeshes[instance.source.primitive];
  if (!mesh || mesh.geometry.attributes.position.count !== instance.source.vertexCount) {
    throw new Error('AuraArc source primitive vertex layout differs from the exported original');
  }
  const sample = new THREE.Vector3(),
    skinRootInverse = new THREE.Matrix4(),
    sourceRootFrame = new THREE.Matrix4().fromArray(instance.source.skinRoot.toSourceFrame);
  const unityLocalToWorld = new THREE.Matrix4(),
    unityWorldToLocal = new THREE.Matrix4(),
    reflection = new THREE.Matrix4().makeScale(-1, 1, 1);
  const localToWorld = new Float32Array(16),
    worldToLocal = new Float32Array(16);
  const mainTexture = new THREE.DataTexture(
    new Uint8Array(4 * 4 * 4).fill(255),
    4,
    4,
    THREE.RGBAFormat,
  );
  mainTexture.colorSpace = THREE.SRGBColorSpace;
  mainTexture.minFilter = mainTexture.magFilter = THREE.LinearFilter;
  mainTexture.wrapS = mainTexture.wrapT = THREE.ClampToEdgeWrapping;
  mainTexture.generateMipmaps = false;
  mainTexture.needsUpdate = true;
  const bakedTexture = new THREE.DataTexture(
    Uint16Array.from(curve.pixels, THREE.DataUtils.toHalfFloat),
    curve.width,
    curve.height,
    THREE.RedFormat,
    THREE.HalfFloatType,
  );
  bakedTexture.internalFormat = 'R16F';
  bakedTexture.minFilter = bakedTexture.magFilter = THREE.LinearFilter;
  bakedTexture.wrapS = bakedTexture.wrapT = THREE.ClampToEdgeWrapping;
  bakedTexture.generateMipmaps = false;
  bakedTexture.needsUpdate = true;
  const properties = {};
  for (const [name, entry] of Object.entries(instance.overrides)) {
    properties[name] = entry.value;
  }
  const channelInfo = 3 << 8; // The callback view exposes float32 xyz, replacing the source vertex-buffer read.
  const parameters = createAuraArcParameters({
    seed,
    vertexCount: instance.source.vertexCount,
    channelInfo,
    localToWorld,
    worldToLocal,
    properties,
    bakedCurve: new Float32Array(curve.Alpha_c),
    mainTexture,
  });
  function samplePosition(index, out) {
    mesh.getVertexPosition(index, sample);
    sample.applyMatrix4(mesh.matrixWorld).applyMatrix4(skinRootInverse);
    out[0] = -sample.x;
    out[1] = sample.y;
    out[2] = sample.z;
  }
  const simulation = createAuraArcSimulation({ seed, parameters, samplePosition });
  if (instance.initialEvent !== 'OnPlay') {
    simulation.stop();
  }
  const nbMaxBits = new Uint32Array([64000]);
  const output = {
    ...parameters.output,
    nbMax: new Float32Array(nbMaxBits.buffer)[0],
    systemSeed: seed,
    cameraXRSettings: new THREE.Vector3(1, 0, 0),
  };
  // Host triangulation: the original output's corner bits define the four vertices.
  const draw = createAuraArcRenderer({
    THREE,
    simulation,
    output,
    bakedTexture,
    mainTexture,
    quadIndices: [0, 1, 2, 2, 1, 3],
  });
  function updateTransforms() {
    mesh.updateWorldMatrix(true, false);
    effectNode.updateWorldMatrix(true, false);
    metadataRoot.updateWorldMatrix(true, false);
    mesh.skeleton?.update();
    skinRoot.updateWorldMatrix(true, false);
    skinRootInverse.copy(skinRoot.matrixWorld).multiply(sourceRootFrame).invert();
    unityLocalToWorld.copy(reflection).multiply(effectNode.matrixWorld).multiply(reflection);
    unityWorldToLocal.copy(unityLocalToWorld).invert();
    localToWorld.set(unityLocalToWorld.elements);
    worldToLocal.set(unityWorldToLocal.elements);
  }
  updateTransforms();
  let visible = true,
    lastTime = null;
  return {
    simulation,
    draw,
    samplePosition,
    anchor(time) {
      lastTime = time;
    },
    captureVisibility() {
      visible = true;
      for (let node = effectNode; node; node = node.parent) {
        if (!node.visible) {
          visible = false;
          break;
        }
      }
    },
    isVisible() {
      return visible;
    },
    async prepare(renderer, camera, time) {
      lastTime = time;
      updateTransforms();
      await draw.prepare(renderer, camera);
    },
    advance(time, enabled = true) {
      if (!Number.isFinite(time)) {
        throw new Error('AuraArc requires finite host frame time');
      }
      const delta = lastTime === null ? 0 : Math.max(0, time - lastTime);
      lastTime = time;
      if (enabled && delta > 0) {
        updateTransforms();
        simulation.advance(delta);
      }
    },
    reset(nextSeed) {
      simulation.reinitialize(nextSeed);
      lastTime = null;
    },
    destroy() {
      draw.destroy();
      mainTexture.dispose();
      bakedTexture.dispose();
    },
  };
}
