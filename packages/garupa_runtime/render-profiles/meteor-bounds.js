// CPU probes of original035 bundles support bone boxes unioned in root space,
// followed by transforming the entire root box to world. This preserves that
// algorithm, not Unity's bit-level arithmetic or its still-untraced sort key.

function vector(value, label, extent = false) {
  if (!Array.isArray(value) || value.length !== 3 || !value.every(Number.isFinite)
      || (extent && value.some(component => component < 0))) {
    throw new Error(`meteor bounds: invalid ${label}`);
  }
  return value.slice();
}

function validateMatrix(matrix, label) {
  const e = matrix?.elements;
  let finite = !!e && e.length === 16;
  if (finite) for (let index = 0; index < 16; index++) finite = finite && Number.isFinite(e[index]);
  const determinant = finite ? matrix.determinant() : NaN;
  if (!finite || Math.abs(e[3]) > 1e-12 || Math.abs(e[7]) > 1e-12
      || Math.abs(e[11]) > 1e-12 || Math.abs(e[15] - 1) > 1e-12
      || !Number.isFinite(determinant) || determinant === 0) {
    throw new Error(`meteor bounds: invalid affine matrix ${label}`);
  }
  return matrix;
}

/** Resolve once: Map<anchorId, {node:Object3D, localMatrix:Matrix4}>.
 * node.matrixWorld must already reflect this frame's composed pose. */
export function createMeteorBounds(THREE, metadata, anchors) {
  if (!metadata || typeof metadata.updateWhenOffscreen !== 'boolean') {
    throw new Error('meteor bounds: updateWhenOffscreen must be boolean');
  }
  if (!Array.isArray(metadata.bones) || metadata.bones.length === 0) {
    throw new Error('meteor bounds: no source bone boxes');
  }
  const label = String(metadata.rendererId ?? 'unidentified renderer');
  function resolve(source, kind) {
    const binding = anchors?.get(source?.node);
    const anchor = binding?.node;
    if (!anchor) throw new Error(`meteor bounds: missing ${kind} anchor ${source?.node} (${label})`);
    if (!Array.isArray(source.bindMatrix) || source.bindMatrix.length !== 16
        || !source.bindMatrix.every(Number.isFinite)) {
      throw new Error(`meteor bounds: invalid ${kind} bindMatrix (${label})`);
    }
    const bind = validateMatrix(new THREE.Matrix4().fromArray(source.bindMatrix), `${kind} bind (${label})`);
    validateMatrix(anchor.matrixWorld, `${kind} anchor (${label})`);
    validateMatrix(binding.localMatrix, `${kind} anchor localMatrix (${label})`);
    return { anchor, localMatrix: binding.localMatrix, bind, validationLabel: `${kind} anchor (${label})` };
  }
  const root = resolve(metadata.root, 'root');
  const rootWorldLabel = `root world (${label})`;
  const bones = metadata.bones.map((bone, index) => {
    const binding = resolve(bone, `bone ${index}`);
    return {
      ...binding,
      center: vector(bone.center, `bone ${index} center`),
      extents: vector(bone.extents, `bone ${index} extents`, true),
    };
  });
  const savedCenter = vector(metadata.localBounds?.center, 'localBounds center');
  const savedExtents = vector(metadata.localBounds?.extents, 'localBounds extents', true);
  const rootWorld = new THREE.Matrix4();
  const rootInverse = new THREE.Matrix4();
  const boneWorld = new THREE.Matrix4();
  const relative = new THREE.Matrix4();
  const localCenter = new THREE.Vector3();
  const localExtents = new THREE.Vector3();
  // Native GPU probe: shader object frame is the original rootBone frame.
  // Expose the already-computed compensated root matrix by stable reference.
  const result = { center: new THREE.Vector3(), extents: new THREE.Vector3(), sourceObjectMatrix: rootWorld };
  // Mutable accumulators and matrices are retained across updates. No posed
  // vertices are read, and no per-frame boxes, vectors or arrays are allocated.
  let minX, minY, minZ, maxX, maxY, maxZ;
  function reset() { minX = minY = minZ = Infinity; maxX = maxY = maxZ = -Infinity; }
  function accumulate(matrix, cx, cy, cz, ex, ey, ez) {
    const e = matrix.elements;
    for (let corner = 0; corner < 8; corner++) {
      const x = cx + ((corner & 1) ? ex : -ex);
      const y = cy + ((corner & 2) ? ey : -ey);
      const z = cz + ((corner & 4) ? ez : -ez);
      const wx = e[0] * x + e[4] * y + e[8] * z + e[12];
      const wy = e[1] * x + e[5] * y + e[9] * z + e[13];
      const wz = e[2] * x + e[6] * y + e[10] * z + e[14];
      if (!Number.isFinite(wx) || !Number.isFinite(wy) || !Number.isFinite(wz)) throw new Error(`meteor bounds: nonfinite box transform (${label})`);
      minX = Math.min(minX, wx); minY = Math.min(minY, wy); minZ = Math.min(minZ, wz);
      maxX = Math.max(maxX, wx); maxY = Math.max(maxY, wy); maxZ = Math.max(maxZ, wz);
    }
  }
  return {
    update() {
      validateMatrix(root.anchor.matrixWorld, root.validationLabel);
      rootWorld.multiplyMatrices(root.anchor.matrixWorld, root.localMatrix).multiply(root.bind);
      validateMatrix(rootWorld, rootWorldLabel);
      if (metadata.updateWhenOffscreen) {
        rootInverse.copy(rootWorld).invert();
        reset();
        for (const bone of bones) {
          validateMatrix(bone.anchor.matrixWorld, bone.validationLabel);
          boneWorld.multiplyMatrices(bone.anchor.matrixWorld, bone.localMatrix).multiply(bone.bind);
          validateMatrix(boneWorld, bone.validationLabel);
          relative.multiplyMatrices(rootInverse, boneWorld);
          const c = bone.center, e = bone.extents;
          accumulate(relative, c[0], c[1], c[2], e[0], e[1], e[2]);
        }
        localCenter.set((minX + maxX) * .5, (minY + maxY) * .5, (minZ + maxZ) * .5);
        localExtents.set((maxX - minX) * .5, (maxY - minY) * .5, (maxZ - minZ) * .5);
      } else {
        localCenter.fromArray(savedCenter);
        localExtents.fromArray(savedExtents);
      }
      reset();
      accumulate(rootWorld, localCenter.x, localCenter.y, localCenter.z,
        localExtents.x, localExtents.y, localExtents.z);
      result.center.set((minX + maxX) * .5, (minY + maxY) * .5, (minZ + maxZ) * .5);
      result.extents.set((maxX - minX) * .5, (maxY - minY) * .5, (maxZ - minZ) * .5);
      return result;
    },
  };
}
