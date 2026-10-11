import { auraArcPrograms } from './aura-arc-program.js';
// Integer textures retain the original SSBO bits, including packed curve data.
// Active strips are compacted only for transport; vertex IDs retain source IDs.
export function createAuraArcRenderer({
  THREE,
  simulation,
  output,
  bakedTexture,
  mainTexture,
  quadIndices,
}) {
  if (!quadIndices || quadIndices.length !== 6) {
    throw new Error('AuraArc requires a host quad index order');
  }
  const scene = new THREE.Scene(),
    geometry = new THREE.BufferGeometry();
  const uniforms = {};
  for (const [key, value] of Object.entries(output)) {
    uniforms[key] = { value };
  }
  Object.assign(uniforms, {
    auraAttributes: { value: null },
    auraHeaders: { value: null },
    auraSlots: { value: null },
    bakedTexture: { value: bakedTexture },
    mainTexture: { value: mainTexture },
    _CameraDepthTexture: { value: null },
    _WorldSpaceCameraPos: { value: new THREE.Vector3() },
    unity_OrthoParams: { value: new THREE.Vector4() },
    hlslcc_mtx4x4unity_MatrixV: { value: new Float32Array(16) },
    hlslcc_mtx4x4unity_MatrixVP: { value: new Float32Array(16) },
    _ScaledScreenParams: { value: new THREE.Vector4() },
    _ProjectionParams: { value: new THREE.Vector4() },
    _GlobalMipBias: { value: new THREE.Vector2(0, 1) },
    _ZBufferParams: { value: new THREE.Vector4() },
    unity_FogParams: { value: new THREE.Vector4() },
    unity_FogColor: { value: new THREE.Color() },
  });
  const material = new THREE.RawShaderMaterial({
    ...auraArcPrograms.none,
    uniforms,
    glslVersion: THREE.GLSL3,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    depthFunc: THREE.LessEqualDepth,
    side: THREE.DoubleSide,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.SrcAlphaFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.SrcAlphaFactor,
    blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  scene.add(mesh);
  const reflection = new THREE.Matrix4().makeScale(-1, 1, 1),
    view = new THREE.Matrix4(),
    vp = new THREE.Matrix4(),
    position = new THREE.Vector3();
  const slotData = new Uint32Array(1000);
  function texture(data, w, h, format) {
    const t = new THREE.DataTexture(data, w, h, format, THREE.UnsignedIntType);
    t.internalFormat = format === THREE.RedIntegerFormat ? 'R32UI' : 'RGBA32UI';
    t.minFilter = t.magFilter = THREE.NearestFilter;
    t.generateMipmaps = false;
    t.needsUpdate = true;
    return t;
  }
  const slots = texture(slotData, 1000, 1, THREE.RedIntegerFormat);
  uniforms.auraSlots.value = slots;
  let capacity = 0,
    attributes,
    headers,
    attributeData,
    headerData,
    vertexIds,
    variant = 'none',
    destroyed = false;
  function grow(count) {
    if (count <= capacity) {
      return;
    }
    capacity = Math.max(4, 2 ** Math.ceil(Math.log2(count)));
    attributes?.dispose();
    headers?.dispose();
    attributeData = new Uint32Array(capacity * 64 * 3 * 4);
    headerData = new Uint32Array(capacity * 5);
    attributes = texture(attributeData, 64, capacity * 3, THREE.RGBAIntegerFormat);
    headers = texture(headerData, 5, capacity, THREE.RedIntegerFormat);
    uniforms.auraAttributes.value = attributes;
    uniforms.auraHeaders.value = headers;
    vertexIds = new Uint32Array(capacity * 252);
    const vertexAttribute = new THREE.BufferAttribute(vertexIds, 1);
    vertexAttribute.gpuType = THREE.IntType;
    geometry.setAttribute('auraVertexId', vertexAttribute);
    const indices = new Uint32Array(capacity * 63 * 6);
    for (let q = 0; q < capacity * 63; q++) {
      for (let i = 0; i < 6; i++) {
        indices[q * 6 + i] = q * 4 + quadIndices[i];
      }
    }
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  }
  function sync() {
    const count = simulation.activeStripCount;
    grow(count || 1);
    for (let slot = 0; slot < count; slot++) {
      const strip = simulation.activeStripIds[slot];
      slotData[strip] = slot;
      for (let i = 0; i < 5; i++) {
        headerData[slot * 5 + i] = simulation.stripData[strip * 5 + i];
      }
      for (let region = 0; region < 3; region++) {
        for (let i = 0; i < 256; i++) {
          attributeData[(slot * 3 + region) * 256 + i] =
            simulation.lineAttributes[region * 256000 + strip * 256 + i];
        }
      }
      for (let i = 0; i < 252; i++) {
        vertexIds[slot * 252 + i] = strip * 252 + i;
      }
    }
    attributes.needsUpdate = headers.needsUpdate = slots.needsUpdate = true;
    geometry.getAttribute('auraVertexId').needsUpdate = true;
    geometry.setDrawRange(0, count * 63 * 6);
    return count;
  }
  function setFrame(frame, depth, w, h) {
    const camera = frame.camera;
    camera.updateWorldMatrix(true, false);
    view.copy(camera.matrixWorldInverse).multiply(reflection);
    vp.copy(camera.projectionMatrix).multiply(view);
    uniforms.hlslcc_mtx4x4unity_MatrixV.value.set(view.elements);
    uniforms.hlslcc_mtx4x4unity_MatrixVP.value.set(vp.elements);
    camera.getWorldPosition(position);
    uniforms._WorldSpaceCameraPos.value.set(-position.x, position.y, position.z);
    const ortho = camera.isOrthographicCamera;
    uniforms.unity_OrthoParams.value.set(
      ortho ? (camera.right - camera.left) / (2 * camera.zoom) : 0,
      ortho ? (camera.top - camera.bottom) / (2 * camera.zoom) : 0,
      0,
      ortho ? 1 : 0,
    );
    const near = camera.near,
      far = camera.far,
      z0 = 1 - far / near,
      z1 = far / near;
    uniforms._ZBufferParams.value.set(z0, z1, z0 / far, z1 / far);
    uniforms._ProjectionParams.value.set(1, near, far, 1 / far);
    uniforms._ScaledScreenParams.value.set(w, h, 1 + 1 / w, 1 + 1 / h);
    uniforms._CameraDepthTexture.value = depth;
    const fog = frame.scene.fog,
      next = fog?.isFogExp2 ? 'exp2' : fog?.isFog ? 'linear' : 'none';
    if (next !== variant) {
      variant = next;
      Object.assign(material, auraArcPrograms[next]);
      material.needsUpdate = true;
    }
    if (fog) {
      uniforms.unity_FogColor.value.copy(fog.color);
      uniforms.unity_FogParams.value.set(
        fog.density * Math.LOG2E ** 0.5,
        fog.density * Math.LOG2E,
        -1 / (fog.far - fog.near),
        fog.far / (fog.far - fog.near),
      );
    }
  }
  return {
    scene,
    material,
    geometry,
    uniforms,
    sync,
    setFrame,
    async prepare(renderer, camera) {
      if (destroyed) {
        throw new Error('AuraArc renderer is destroyed');
      }
      sync();
      for (const program of Object.values(auraArcPrograms)) {
        Object.assign(material, program);
        material.needsUpdate = true;
        await renderer.compileAsync(scene, camera);
      }
      Object.assign(material, auraArcPrograms[variant]);
      material.needsUpdate = true;
    },
    render(renderer, frame, depth, w, h) {
      if (destroyed) {
        throw new Error('AuraArc renderer is destroyed');
      }
      setFrame(frame, depth, w, h);
      if (sync()) {
        renderer.render(scene, frame.camera);
      }
    },
    destroy() {
      if (destroyed) {
        return;
      }
      destroyed = true;
      attributes?.dispose();
      headers?.dispose();
      slots.dispose();
      geometry.dispose();
      material.dispose();
      scene.clear();
    },
  };
}
