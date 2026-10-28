import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { Euler, Matrix3, Matrix4, OrthographicCamera, PerspectiveCamera, Quaternion, Vector3, Vector4 } from 'three';
import {
  meteorSourcePosition, meteorSourceNormal, meteorSourceTangent,
  meteorMetalProjection, createMeteorCoordinateMatrices, meteorCoordinateMatrices, meteorOrthoReadFields,
  meteorMetalClipToGL, meteorMetalFragCoord, meteorHlslFragCoord,
  meteorCoordinateBoundary, meteorCoordinates,
} from '../packages/garupa_runtime/shaders/meteor-coordinates.js';

function close(actual, expected, label = '') {
  const a = actual.toArray ? actual.toArray() : actual;
  const b = expected.toArray ? expected.toArray() : expected;
  assert.equal(a.length, b.length);
  a.forEach((x, i) => assert.ok(Math.abs(x - b[i]) <= 2e-11 * Math.max(1, Math.abs(x), Math.abs(b[i])), `${label}[${i}]: ${x} vs ${b[i]}`));
}

test('coordinate helpers load as raw runtime modules without a package-name resolver', async () => {
  const source=await readFile(new URL('../packages/garupa_runtime/shaders/meteor-coordinates.js',import.meta.url),'utf8');
  const raw=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  const args={modelMatrix:new Matrix4(),viewMatrix:new Matrix4(),projectionMatrix:new Matrix4()};
  close(raw.meteorCoordinateMatrices(args).meshToSource,meteorCoordinateMatrices(args).meshToSource);
});

function cameras() {
  const perspective = new PerspectiveCamera(47.3, 1.731, .137, 231.5);
  // Asymmetric projections exercise row/column indexing beyond centered cases.
  perspective.setViewOffset(1700, 1000, 113, 61, 1400, 900);
  const ortho = new OrthographicCamera(-2.9, 4.3, 3.1, -1.7, .093, 176.2);
  ortho.zoom = 1.37;
  ortho.updateProjectionMatrix();
  for (const camera of [perspective, ortho]) {
    camera.position.set(3.71, 2.29, 7.83);
    camera.lookAt(-.31, .73, -.47);
    camera.updateMatrixWorld(true);
  }
  return [perspective, ortho];
}

test('attributes invert the exact converter reflection including tangent handedness', () => {
  const source = new Vector3(-.713, 1.271, .039);
  close(meteorSourcePosition(meteorSourcePosition(source)), source);
  close(meteorSourceNormal(meteorSourceNormal(source)), source);
  for (const w of [-1, 1]) {
    const tangent = new Vector4(.371, -.249, .891, w);
    close(meteorSourceTangent(meteorSourceTangent(tangent)), tangent);
  }
});

test('nonuniform model and reflected source world preserve view coordinates and inverse-transpose normals', () => {
  const model = new Matrix4().compose(new Vector3(.47, -1.31, 2.19), new Quaternion().setFromEuler(new Euler(.27, -.61, .43)), new Vector3(1.73, .47, 2.39));
  for (const camera of cameras()) {
    const matrices = meteorCoordinateMatrices({ modelMatrix: model, viewMatrix: camera.matrixWorldInverse, projectionMatrix: camera.projectionMatrix });
    close(matrices.objectToWorld.clone().multiply(matrices.worldToObject), new Matrix4());
    close(matrices.view.clone().multiply(matrices.inverseView), new Matrix4());
    for (const p of [new Vector3(.37, -.23, .91), new Vector3(-.53, 1.71, -.31)]) {
      const expected = new Vector4(p.x, p.y, p.z, 1).applyMatrix4(model).applyMatrix4(camera.matrixWorldInverse);
      const source = meteorSourcePosition(p);
      const actual = new Vector4(source.x, source.y, source.z, 1).applyMatrix4(matrices.objectToWorld).applyMatrix4(matrices.view);
      close(actual, expected);
      const sourceWorld = new Vector4(source.x, source.y, source.z, 1).applyMatrix4(matrices.objectToWorld);
      close(sourceWorld, new Vector4(-1, 1, 1, 1).multiply(new Vector4(p.x, p.y, p.z, 1).applyMatrix4(model)));
      const normal = p.clone().normalize();
      const targetNormal = normal.clone().applyMatrix3(new Matrix3().getNormalMatrix(model)).normalize();
      const sourceNormal = meteorSourceNormal(normal).applyMatrix3(new Matrix3().getNormalMatrix(matrices.objectToWorld)).normalize();
      close(sourceNormal, meteorSourceNormal(targetNormal));
    }
  }
});

for (const [index, camera] of cameras().entries()) {
  test(`${index === 0 ? 'perspective' : 'orthographic'} reversed Metal projection and final GL clip agree at interior points`, () => {
    const p = camera.projectionMatrix;
    const before = p.toArray();
    const metal = meteorMetalProjection(p);
    assert.deepEqual(p.toArray(), before);
    for (let column = 0; column < 4; column++) {
      for (const row of [0, 1, 3]) assert.equal(metal.elements[column * 4 + row], p.elements[column * 4 + row]);
    }
    for (const z of [-camera.near, -.713, -2.379, -31.47, -camera.far]) {
      const viewPoint = new Vector4(.173, -.297, z, 1);
      const gl = viewPoint.clone().applyMatrix4(p);
      const source = viewPoint.clone().applyMatrix4(metal);
      close(meteorMetalClipToGL(source), gl);
      close([source.z / source.w], [.5 * (1 - gl.z / gl.w)]);
    }
    const uniforms = meteorCoordinateMatrices({ modelMatrix: new Matrix4(), viewMatrix: camera.matrixWorldInverse, projectionMatrix: p });
    assert.equal(uniforms.cameraProjectionY, p.elements[5]);
    assert.equal(uniforms.projection.elements[10], metal.elements[10]);
    assert.equal(uniforms.projection.elements[14], metal.elements[14]);
  });
}

test('OrthoParams exposes only evidenced y/w with explicit half-height and mode', () => {
  assert.deepEqual(meteorOrthoReadFields({ orthographic: true, halfHeight: 2.371 }), { y: 2.371, w: 1 });
  assert.deepEqual(meteorOrthoReadFields({ orthographic: false, halfHeight: 3.291 }), { y: 3.291, w: 0 });
  assert.throws(() => meteorOrthoReadFields({ orthographic: true }), /halfHeight/);
});

test('raw Metal FragCoord and source hlslcc reconstruction distinguish reciprocal w from clip w', () => {
  for (const height of [719, 1080]) for (const w of [.713, 1, 3.291, 17.371]) {
    const gl = new Vector4(317.5, 151.5, .27139, 1 / w);
    close(meteorMetalFragCoord(gl, height), [317.5, height - 151.5, .72861, 1 / w]);
    close(meteorHlslFragCoord(gl, height), [317.5, height - 151.5, .72861, w]);
    assert.notEqual(meteorHlslFragCoord(gl, height).z / meteorHlslFragCoord(gl, height).w, gl.z);
  }
});

test('Outline source z override occurs before the final depth conversion for both projection types', () => {
  // 136178e1:196-204: z'=w*(viewZ*P[2].z+P[3].z)/(-viewZ).
  // This intentionally retains the source expression even for an ortho matrix;
  // replacing its denominator by projected w would change source behavior.
  for (const camera of cameras()) {
    const p = meteorMetalProjection(camera.projectionMatrix);
    const point = new Vector4(.271, -.319, -3.713, 1);
    const original = point.clone().applyMatrix4(p);
    const mask = .371, zOffset = 1.239;
    const viewZ = -(mask * zOffset * .100000001 + .0000999999975) - original.w;
    const sourceZ = original.w * (viewZ * p.elements[10] + p.elements[14]) / -viewZ;
    const modified = original.clone();
    modified.z = sourceZ;
    const final = meteorMetalClipToGL(modified);
    close(final, [original.x, original.y, original.w - 2 * sourceZ, original.w]);
    assert.notEqual(final.z, meteorMetalClipToGL(original).z);
    // Writing sourceZ after the conversion is observably incorrect.
    assert.notEqual(final.z, sourceZ);
  }
});

test('matrix columns reconstruct source position order without accidental transpose', () => {
  const m = new Matrix4().set(1.7, .31, -.23, 2.91, -.47, .83, .19, -1.37, .29, -.61, 2.13, .73, 0, 0, 0, 1);
  const input = new Vector4(.317, -.271, 1.193, 1);
  const e = m.elements;
  const columns = Array.from({ length: 4 }, (_, c) => e.slice(c * 4, c * 4 + 4));
  const result = [0, 1, 2, 3].map(row => columns[1][row] * input.y + columns[0][row] * input.x + columns[2][row] * input.z + columns[3][row]);
  close(result, input.clone().applyMatrix4(m));
});

test('unsupported inference stays explicit and input matrices must be invertible', () => {
  assert.equal(meteorCoordinateBoundary.frontFacing, 'UNVERIFIED');
  assert.throws(() => meteorCoordinateMatrices({ modelMatrix: new Matrix4().makeScale(1, 0, 1), viewMatrix: new Matrix4(), projectionMatrix: new Matrix4() }), /invertible/);
  assert.throws(() => meteorMetalFragCoord(new Vector4(), 0), /height/);
  assert.ok(!meteorCoordinates.includes('\\n'));
});


test('native RootBone object frame bridges post-skin mesh inputs without transforming encoded UV normals', () => {
  const mesh = new Matrix4().compose(new Vector3(.371, -.239, 1.193), new Quaternion().setFromEuler(new Euler(.317, -.571, .193)), new Vector3(1.37, .71, 2.19));
  const root = new Matrix4().compose(new Vector3(-.719, 1.137, .431), new Quaternion().setFromEuler(new Euler(-.239, .731, -.371)), new Vector3(.83, 1.91, .63));
  const camera = cameras()[0], reflection = new Matrix4().makeScale(-1, 1, 1);
  const m = meteorCoordinateMatrices({modelMatrix: mesh, objectMatrix: root, viewMatrix: camera.matrixWorldInverse, projectionMatrix: camera.projectionMatrix});
  close(m.objectToWorld, reflection.clone().multiply(root).multiply(reflection));
  for (const w of [0, 1]) {
    const input = new Vector4(.137, -.719, .371, w);
    close(input.clone().applyMatrix4(m.meshToSource).applyMatrix4(m.objectToWorld), input.clone().applyMatrix4(mesh).applyMatrix4(reflection), `w=${w}`);
  }
  // Outline UV1 encodes a source-world normal; it is input data, not a mesh
  // attribute direction. Only retained source WorldToObject interprets it.
  const uv = [.137, .731], snapshot = [...uv];
  const decoded = new Vector4(uv[0] * 2 - 1, uv[1] * 2 - 1, .239, 0);
  close(decoded.clone().applyMatrix4(m.worldToObject), decoded.clone().applyMatrix4(reflection.clone().multiply(root).multiply(reflection).invert()));
  assert.deepEqual(uv, snapshot);
  assert.throws(() => meteorCoordinateMatrices({modelMatrix: mesh, objectMatrix: new Matrix4().makeScale(0,1,1), viewMatrix: camera.matrixWorldInverse, projectionMatrix: camera.projectionMatrix}), /invertible/);
});

// The allocating expression order is a regression oracle for changing only
// storage lifetime. The geometric source/GL invariants above remain independent.
function coordinateReference({ modelMatrix, objectMatrix, viewMatrix, projectionMatrix }) {
  const reflection = new Matrix4().makeScale(-1, 1, 1);
  const objectToWorld = modelMatrix.clone().multiplyMatrices(reflection, objectMatrix).multiply(reflection);
  const view = modelMatrix.clone().multiplyMatrices(viewMatrix, reflection);
  const projection = meteorMetalProjection(projectionMatrix);
  return {
    objectToWorld, worldToObject: objectToWorld.clone().invert(),
    view, inverseView: view.clone().invert(), projection,
    meshToSource: modelMatrix.clone().multiplyMatrices(reflection, objectMatrix.clone().invert()).multiply(modelMatrix),
    viewProjection: modelMatrix.clone().multiplyMatrices(projection, view),
    cameraProjectionY: projectionMatrix.elements[5],
  };
}

test('reused coordinate outputs preserve expression results through moving cameras and nonuniform animated roots', () => {
  const output = createMeteorCoordinateMatrices(new Matrix4());
  const references = { ...output };
  const matrixKeys = Object.keys(output).filter(key => key !== 'cameraProjectionY');
  const reflection = new Matrix4().makeScale(-1, 1, 1);
  for (const [cameraIndex, camera] of cameras().entries()) for (const frame of [0, 1, 7, 19, 37]) {
    const t = frame * .173;
    camera.position.set(3.71 + t * .21, 2.29 - t * .13, 7.83 + Math.sin(t) * .37);
    camera.lookAt(-.31 + t * .17, .73, -.47);
    if (camera.isPerspectiveCamera) camera.fov = 47.3 + t * .73;
    else camera.zoom = 1.37 + t * .031;
    camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
    const modelMatrix = new Matrix4().compose(new Vector3(.371 + t, -.239, 1.193 - t * .31),
      new Quaternion().setFromEuler(new Euler(.317 + t * .23, -.571, .193 - t * .17)),
      new Vector3(frame % 2 ? -1.37 : 1.37, .71 + t * .017, 2.19));
    const objectMatrix = new Matrix4().compose(new Vector3(-.719, 1.137 + t * .13, .431),
      new Quaternion().setFromEuler(new Euler(-.239, .731 + t * .19, -.371)),
      new Vector3(.83, 1.91, .63 + t * .011));
    const args = { modelMatrix, objectMatrix, viewMatrix: camera.matrixWorldInverse, projectionMatrix: camera.projectionMatrix };
    const inputsBefore = Object.values(args).map(value => value.toArray());
    const expected = coordinateReference(args);
    assert.equal(meteorCoordinateMatrices(args, output), output);
    for (const key of matrixKeys) {
      assert.equal(output[key], references[key], `${key} identity stays stable`);
      assert.deepEqual(output[key].elements, expected[key].elements, `${cameraIndex}/${frame}/${key}`);
    }
    assert.equal(output.cameraProjectionY, expected.cameraProjectionY);
    assert.deepEqual(Object.values(args).map(value => value.toArray()), inputsBefore);
    const point = new Vector4(.137 + t * .013, -.719, .371, 1);
    close(point.clone().applyMatrix4(output.meshToSource).applyMatrix4(output.objectToWorld),
      point.clone().applyMatrix4(modelMatrix).applyMatrix4(reflection), 'source root bridge remains equivalent');
  }
});

test('coordinate workspaces isolate instances and allocate no cloned matrices while reused', () => {
  const a = createMeteorCoordinateMatrices(new Matrix4()), b = createMeteorCoordinateMatrices(new Matrix4());
  const [cameraA, cameraB] = cameras();
  const argsA = { modelMatrix: new Matrix4().makeTranslation(.371, -.719, 1.193), viewMatrix: cameraA.matrixWorldInverse, projectionMatrix: cameraA.projectionMatrix };
  const argsB = { modelMatrix: new Matrix4().makeScale(-1.37, .71, 2.19), viewMatrix: cameraB.matrixWorldInverse, projectionMatrix: cameraB.projectionMatrix };
  meteorCoordinateMatrices(argsA, a);
  const savedA = Object.fromEntries(Object.entries(a).map(([key, value]) => [key, value.toArray ? value.toArray() : value]));
  let clones = 0;
  const originalClone = Matrix4.prototype.clone;
  Matrix4.prototype.clone = function () { clones++; return originalClone.call(this); };
  try {
    meteorCoordinateMatrices(argsB, b);
    argsB.modelMatrix.elements[12] = 4.137;
    meteorCoordinateMatrices(argsB, b);
    assert.equal(clones, 0);
  } finally { Matrix4.prototype.clone = originalClone; }
  for (const [key, value] of Object.entries(a)) {
    if (value.toArray) { assert.notEqual(value, b[key]); assert.deepEqual(value.toArray(), savedA[key]); }
    else assert.equal(value, savedA[key]);
  }
  const independent = meteorCoordinateMatrices(argsB);
  assert.notEqual(independent, b); assert.notEqual(independent.meshToSource, b.meshToSource);
});
