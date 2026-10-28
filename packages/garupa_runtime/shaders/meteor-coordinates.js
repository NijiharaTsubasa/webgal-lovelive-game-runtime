// normalized_model.py reflects mesh POSITION/NORMAL.x and TANGENT.x/w,
// and reverses triangle indices. This module reconstructs source attributes
// before executing retained source math; it does not infer front_facing.
let reflectX;

function matrix(value, label) {
  if (!value?.isMatrix4 || !value.elements.every(Number.isFinite)) throw new TypeError(`${label} must be a finite Matrix4`);
  return value;
}

function inverse(value, label, target) {
  if (value.determinant() === 0) throw new RangeError(`${label} must be invertible`);
  return target.copy(value).invert();
}

/** Return source-space values from the converter's reflected attributes. */
export const meteorSourcePosition = value => value.clone().set(-value.x, value.y, value.z);
export const meteorSourceNormal = value => value.clone().set(-value.x, value.y, value.z);
export const meteorSourceTangent = value => value.clone().set(-value.x, value.y, value.z, -value.w);

/** Conventional GL depth [-w,+w] -> reversed Metal depth [w,0].
 * Only row z changes: z_M = (w_GL-z_GL)/2. Columns remain columns.
 */
export function meteorMetalProjection(glProjection, target) {
  matrix(glProjection, 'glProjection');
  const result = target ? target.copy(glProjection) : glProjection.clone();
  const source = glProjection.elements;
  for (let column = 0; column < 4; column++) {
    const base = column * 4;
    result.elements[base + 2] = .5 * (source[base + 3] - source[base + 2]);
  }
  return result;
}

/** Each runtime owns one result and updates its matrices in place. */
export function createMeteorCoordinateMatrices(matrixTemplate) {
  matrix(matrixTemplate, 'matrixTemplate');
  return {
    objectToWorld: matrixTemplate.clone(), worldToObject: matrixTemplate.clone(),
    view: matrixTemplate.clone(), inverseView: matrixTemplate.clone(),
    projection: matrixTemplate.clone(), meshToSource: matrixTemplate.clone(),
    viewProjection: matrixTemplate.clone(), cameraProjectionY: 0,
  };
}

/** Source uniforms and post-skin input bridge, in reflected source world.
 * Native SkinnedMeshRenderer shader objectMatrix is its original RootBone
 * world frame. Static renderers naturally use modelMatrix (their mesh frame).
 * POSITION and direction inputs must use meshToSource before retained VS math;
 * raw UV data, including Outline encoded normals, must not use that bridge.
 * Callers supply the current matrices after skin/object/camera updates.
 * These are mathematical basis changes, not a source float-instruction emulator.
 * Source array-of-float4 bindings must upload these Matrix4 columns unchanged.
 * Pass a runtime-owned target to reuse matrix storage between draws.
 */
export function meteorCoordinateMatrices({ modelMatrix, objectMatrix = modelMatrix, viewMatrix, projectionMatrix }, target) {
  matrix(modelMatrix, 'modelMatrix');
  matrix(viewMatrix, 'viewMatrix');
  matrix(objectMatrix, 'objectMatrix');
  reflectX ??= modelMatrix.clone().makeScale(-1, 1, 1);
  const result = target ?? createMeteorCoordinateMatrices(modelMatrix);
  result.objectToWorld.multiplyMatrices(reflectX, objectMatrix).multiply(reflectX);
  inverse(result.objectToWorld, 'objectMatrix', result.worldToObject);
  result.view.multiplyMatrices(viewMatrix, reflectX);
  inverse(result.view, 'viewMatrix', result.inverseView);
  meteorMetalProjection(projectionMatrix, result.projection);
  // Native SMR shader object frame is RootBone, while Three skinned values
  // remain mesh-local. U * bridge = Sx * meshWorld (positions and directions).
  inverse(objectMatrix, 'objectMatrix', result.meshToSource);
  result.meshToSource.premultiply(reflectX).multiply(modelMatrix);
  result.viewProjection.multiplyMatrices(result.projection, result.view);
  // Four source Outline VS read only unity_CameraProjection[1].y.
  // The other entries of that separate Unity matrix are not reconstructed.
  result.cameraProjectionY = projectionMatrix.elements[5];
  return result;
}

/** Only the source OrthoParams.y/w fields actually read by retained programs.
 * Supply the source-equivalent half-height explicitly, even for perspective:
 * no value is invented for an inactive camera property. Width/z are unfilled.
 */
export function meteorOrthoReadFields({ orthographic, halfHeight }) {
  if (typeof orthographic !== 'boolean' || !Number.isFinite(halfHeight) || halfHeight <= 0) {
    throw new TypeError('orthographic boolean and positive explicit halfHeight are required');
  }
  return { y: halfHeight, w: orthographic ? 1 : 0 };
}

/** Apply only AFTER the complete source VS, including its Outline z override. */
export function meteorMetalClipToGL(sourceClip) {
  return sourceClip.clone().set(sourceClip.x, sourceClip.y, sourceClip.w - 2 * sourceClip.z, sourceClip.w);
}

function targetHeight(height) {
  if (!Number.isFinite(height) || height <= 0) throw new TypeError('positive render-target height is required');
  return height;
}

/** Raw Metal [[position]], for matching full-target origin-zero viewports.
 * Both APIs expose reciprocal clip-w here. The source entry reconstructs w.
 * Target depthRange must be [0,1], GL projection conventional, depth unreversed.
 */
export function meteorMetalFragCoord(glFragCoord, height) {
  targetHeight(height);
  return glFragCoord.clone().set(glFragCoord.x, height - glFragCoord.y, 1 - glFragCoord.z, glFragCoord.w);
}

/** The hlslcc_FragCoord AFTER the source MSL entry's explicit 1/position.w. */
export function meteorHlslFragCoord(glFragCoord, height) {
  const result = meteorMetalFragCoord(glFragCoord, height);
  result.w = 1 / result.w;
  return result;
}

// Source checks: Outline 136178e1:134/163/165/201-204; the same projection
// components occur in 59035f93/7daed3a7/b3a95655/c6742bea Outline VS.
// OIT 37d9b70a:137 explicitly computes 1/mtl_FragCoord.w.
// front_facing/Three cull state is intentionally UNVERIFIED. Attribute reflection
// and index reversal alone do not establish the original Metal raster state.
export const meteorCoordinateBoundary = Object.freeze({ frontFacing: 'UNVERIFIED' });

export const meteorCoordinates = `
vec3 meteor_sourcePosition(vec3 value) { return vec3(-value.x, value.yz); }
vec3 meteor_sourceNormal(vec3 value) { return vec3(-value.x, value.yz); }
vec4 meteor_sourceTangent(vec4 value) { return vec4(-value.x, value.yz, -value.w); }
vec4 meteor_metalClipToGL(vec4 sourceClip) {
    return vec4(sourceClip.xy, sourceClip.w - 2.0 * sourceClip.z, sourceClip.w);
}
vec4 meteor_metalFragCoord(vec4 glFragCoord, float targetHeight) {
    return vec4(glFragCoord.x, targetHeight - glFragCoord.y, 1.0 - glFragCoord.z, glFragCoord.w);
}
vec4 meteor_hlslFragCoord(vec4 glFragCoord, float targetHeight) {
    vec4 value = meteor_metalFragCoord(glFragCoord, targetHeight);
    value.w = 1.0 / value.w;
    return value;
}
`;
