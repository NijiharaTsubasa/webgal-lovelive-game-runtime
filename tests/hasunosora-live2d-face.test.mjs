import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { readFile } from 'node:fs/promises';
import { HASUNOSORA_FACE_PROFILES } from '../packages/hasunosora_runtime/adapters/hasunosora-face-profiles.js';
import { createExpressionAdapter, HasunosoraLive2dFace } from '../packages/hasunosora_runtime/adapters/hasunosora-live2d-face.js';
import { originalUpdate } from './fixtures/hasunosora-face-before-group-cache.mjs';

// Hand-authored tiny facial islands: tests need no source bundles or converted GLB.
// Left/right pieces have distinct vertices; eye closure cannot accidentally pass
// by moving the whole face or the other eye.
const groups = ['kaho', 'old', 'new'];
const near = (actual, expected, label = '') => assert.ok(
  Math.abs(actual - expected) < 1e-6, `${label}: ${actual} != ${expected}`);
const nearPoint = (actual, expected) => actual.forEach((value, index) => near(value, expected[index]));

function makeGeometry(kind) {
  const brow = kind === 'Brow';
  const y = brow ? 1.65 : 1.6;
  const points = [];
  for (const sign of [1, -1]) points.push(
    [sign * .03, y, .10], [sign * .04, y + .004, .10], [sign * .05, y, .10],
  );
  if (kind === 'Face') points.push(
    [-.015, 1.53, .1], [0, 1.534, .1], [.015, 1.53, .1],
    [-.015, 1.53, .1], [.015, 1.53, .1], [0, 1.526, .1],
  );
  const targets = new Map();
  const add = (name, transform) => targets.set(`${kind}_.${name}`,
    points.flatMap((point, index) => transform(point, index)));
  const zero = () => [0, 0, 0];
  if (brow) {
    add('Eyebrow_Normal', zero);
    add('Eyebrow_Angry', ([x]) => [0, Math.abs(x) * .01, 0]);
    for (const side of ['L', 'R']) add(`Eyebrow_Smile_${side}`, (_, i) =>
      (i < 3) === (side === 'L') ? [0, i % 3 === 1 ? .001 : 0, 0] : zero());
    for (const side of ['L', 'R']) for (const [suffix, direction] of [['Up', 1], ['Down', -1]]) {
      add(`Eyebrow_${suffix}_${side}`, (_, i) =>
        (i < 3) === (side === 'L') ? [0, direction * .005, 0] : zero());
    }
  } else if (kind === 'Eye') {
    for (const name of ['Eyelids_pupil', 'Eyelids_Pupil', 'Eyelids_pupilSquash', 'Eyelids_HighLightDown']) add(name, zero);
  } else {
    add('Eyelids_Normal', zero);
    for (const side of ['L', 'R']) {
      const selected = i => i < 6 && (i < 3) === (side === 'L');
      add(`Eyelids_Close_${side}`, (_, i) => selected(i) ? [0, -.004, 0] : zero());
      add(`Eyelids_SmileB_${side}`, (_, i) => selected(i) ? [0, -.003, .0005] : zero());
    }
    add('Eyelids_Open', (_, i) => i < 6 ? [0, .002, 0] : zero());
    add('Eyelids_Smile', (_, i) => i < 6 ? [0, .001, 0] : zero());
    add('Eyelids_CloseUnder', (_, i) => i < 6 ? [0, .0008, 0] : zero());
    if (kind === 'Face') {
      add('Mouth_Normal', (_, i) => i >= 6 ? [0, .0003, 0] : zero());
      add('Mouth_A', (_, i) => i >= 6 ? [0, i < 9 ? .004 : -.004, 0] : zero());
      add('Mouth_O', ([x], i) => i >= 6 ? [-x * .3, i < 9 ? .005 : -.005, 0] : zero());
      add('Mouth_Squash', ([x], i) => i >= 6 ? [-x * .2, 0, 0] : zero());
      for (const name of ['Mouth_UP', 'Mouth_Up', 'Mouth_Down'])
        add(name, (_, i) => i >= 6 ? [0, name === 'Mouth_Down' ? -.002 : .002, 0] : zero());
      for (const side of ['L', 'R']) for (const name of ['Mouth_cornerUP', 'Mouth_cornerUp', 'Mouth_cornerDown'])
        add(`${name}_${side}`, ([x], i) => i >= 6 && (x > 0) === (side === 'L')
          ? [0, name.endsWith('Down') ? -.002 : .002, 0] : zero());
    }
  }
  // The host/application may own other Morphs on the same Mesh.
  targets.set('ApplicationDecoration', points.flatMap(() => [0, 0, .001]));
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points.flat(), 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(points.flatMap(() => [0, 0, 1]), 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(points.flatMap(() => [.5, .5]), 2));
  geometry.setIndex(points.map((_, index) => index));
  geometry.morphTargetsRelative = true;
  geometry.morphAttributes.position = [...targets].map(([name, values]) => {
    const attribute = new THREE.Float32BufferAttribute(values, 3);
    attribute.name = name;
    return attribute;
  });
  return geometry;
}

function fixture(character = 'kaho', shared = undefined) {
  const root = new THREE.Group();
  const nodes = new Map();
  const meshes = {};
  const geometries = shared ?? Object.fromEntries(['Face', 'Brow', 'Eye', 'EyeShadow'].map(kind => [kind, makeGeometry(kind)]));
  for (const [kind, geometry] of Object.entries(geometries)) {
    const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
    mesh.name = `${kind} Renderer`;
    nodes.set(mesh.name, mesh); root.add(mesh); meshes[kind] = mesh;
  }
  for (const [name, x] of [['LeftEye', .04], ['RightEye', -.04]]) {
    const bone = new THREE.Bone(); bone.name = name; bone.position.set(x, 1.6, .1);
    root.add(bone); nodes.set(name, bone);
  }
  root.updateMatrixWorld(true);
  const component = { type: 'model', role: 'integrated', motionGroup: `hasunosora.${character}` };
  const context = { THREE, root, parts: [{ root, role: 'integrated', component, gltf: {} }],
    getShaderRuntimes: () => [],
    resolveNode(role, name) {
      assert.equal(role, 'integrated');
      if (!nodes.has(name)) throw new Error(`fixture missing node: ${name}`);
      return nodes.get(name);
    } };
  return { root, nodes, meshes, geometries, component, context };
}

function point(mesh, index) {
  const value = new THREE.Vector3().fromBufferAttribute(mesh.geometry.attributes.position, index);
  mesh.morphTargetInfluences?.forEach((weight, target) => {
    if (weight) value.addScaledVector(new THREE.Vector3().fromBufferAttribute(
      mesh.geometry.morphAttributes.position[target], index), weight);
  });
  return value.toArray();
}

function snapshot(f) {
  return Object.fromEntries(Object.entries(f.meshes).map(([kind, mesh]) => [kind, {
    geometry: mesh.geometry, dictionary: mesh.morphTargetDictionary,
    influences: [...(mesh.morphTargetInfluences ?? [])],
    position: mesh.position.toArray(), scale: mesh.scale.toArray(), quaternion: mesh.quaternion.toArray(),
  }]));
}

function assertRestored(f, original) {
  for (const [kind, mesh] of Object.entries(f.meshes)) {
    assert.equal(mesh.geometry, original[kind].geometry);
    assert.equal(mesh.morphTargetDictionary, original[kind].dictionary);
    assert.deepEqual([...(mesh.morphTargetInfluences ?? [])], original[kind].influences);
    assert.deepEqual(mesh.position.toArray(), original[kind].position);
    assert.deepEqual(mesh.scale.toArray(), original[kind].scale);
    assert.deepEqual(mesh.quaternion.toArray(), original[kind].quaternion);
  }
}

test('all three neutral domains create independent adapters through the standard context', () => {
  for (const name of groups) {
    const f = fixture(name), before = snapshot(f);
    const adapter = createExpressionAdapter(f.context);
    assert.ok(adapter, name);
    assert.deepEqual(Object.keys(adapter).sort(), ['apply', 'dispose', 'restore']);
    adapter.apply(Object.freeze({}), { time: 0, delta: 0 });
    adapter.dispose();
    assertRestored(f, before);
  }
  assert.equal(createExpressionAdapter(fixture('npc').context), null);
});

test('left eye and brow inputs leave the right side and mouth unchanged', () => {
  const f = fixture(), adapter = createExpressionAdapter(f.context);
  adapter.apply({}, { time: 0, delta: 0 });
  const neutral = Object.fromEntries(Object.entries(f.meshes).map(([kind, mesh]) =>
    [kind, Array.from({ length: mesh.geometry.attributes.position.count }, (_, i) => point(mesh, i))]));
  adapter.restore();
  adapter.apply({ PARAM_EYE_L_OPEN: 0, PARAM_BROW_L_Y: .7, PARAM_BROW_L_FORM: -.6 }, { time: .5, delta: .5 });
  assert.notDeepEqual(point(f.meshes.Face, 1), neutral.Face[1]);
  assert.notDeepEqual(point(f.meshes.Brow, 1), neutral.Brow[1]);
  for (const kind of ['Face', 'EyeShadow', 'Brow']) for (const index of [3, 4, 5])
    nearPoint(point(f.meshes[kind], index), neutral[kind][index]);
  for (let index = 6; index < 12; index++) nearPoint(point(f.meshes.Face, index), neutral.Face[index]);
  adapter.dispose();
});

test('independent eyelid-line parameters keep the face aperture and its shadow paired', () => {
  for (const group of groups) {
    const f = fixture(group), original = snapshot(f);
    const adapter = createExpressionAdapter(f.context);
    for (const open of [0, .3, .73, 1, 1.5]) for (const smile of [0, .6, 1]) {
      const parameters = { PARAM_EYE_L_OPEN: open, PARAM_EYE_R_OPEN: .6,
        PARAM_EYE_L_SMILE: smile, PARAM_EYE_R_SMILE: .4 };
      adapter.apply(parameters);
      const baseline = Object.fromEntries(['Face', 'EyeShadow'].map(kind => [kind,
        Array.from(f.meshes[kind].geometry.attributes.position.array)]));
      for (const [left, right] of [[-.83, -.83], [-1, 0], [0, 1], [.45, -.3]]) {
        adapter.restore();
        adapter.apply({ ...parameters, PARAM_EYELID_L: left, PARAM_EYELID_R: right });
        for (const kind of ['Face', 'EyeShadow']) {
          assert.deepEqual(Array.from(f.meshes[kind].geometry.attributes.position.array), baseline[kind],
            `${group} ${kind}: independent line control must not detach the shadow from the aperture`);
        }
        for (let i = 0; i < 6; i++) nearPoint(point(f.meshes.Face, i), point(f.meshes.EyeShadow, i));
      }
    }
    adapter.dispose();
    assertRestored(f, original);
  }
});

test('neutral input uses character basal shape without reading named emotional recipes', () => {
  const a = fixture('old'), b = fixture('old');
  b.component.morphPoses = [{ name: 'normal', targets: { 'Face Renderer': { 'Face_.Mouth_A': 123 } } }];
  b.component.expressionGroups = [{name:'face',type:'eye',states:[{name:'normal',poses:{normal:123}}]}];
  b.component.defaultExpression = {eye:'normal'};
  const da = createExpressionAdapter(a.context), db = createExpressionAdapter(b.context);
  da.apply({}, { time: 0, delta: 0 }); db.apply({}, { time: 0, delta: 0 });
  for (const kind of Object.keys(a.meshes)) for (let i = 0; i < a.meshes[kind].geometry.attributes.position.count; i++)
    nearPoint(point(a.meshes[kind], i), point(b.meshes[kind], i));
  const face = a.meshes.Face;
  for (let i = 6; i < 12; i++) {
    const base = new THREE.Vector3().fromBufferAttribute(a.geometries.Face.attributes.position, i).toArray();
    // The nonzero authored Mouth_Normal is essential even with all parameter controls at baseline.
    near(point(face, i)[1], base[1] + .0003);
  }
  const first = Array.from({ length: 12 }, (_, i) => point(face, i));
  da.restore(); da.apply({}, { time: 3, delta: 3 });
  first.forEach((value, i) => nearPoint(point(face, i), value));
  da.dispose(); db.dispose();
});

test('derived geometry and owned weights cover every material pass while restoring each underlay', () => {
  const f = fixture('old');
  const passes = Object.values(f.meshes).map(mesh => {
    const pass = mesh.clone();
    pass.name = `${mesh.name}_Outline`;
    pass.userData.__parameterizedPassObject = true;
    mesh.morphTargetInfluences.fill(.17);
    pass.morphTargetInfluences = pass.morphTargetInfluences.map(() => .59);
    f.root.add(pass);
    return [mesh, pass];
  });
  const adapter = createExpressionAdapter(f.context);
  adapter.apply({ PARAM_EYE_L_OPEN: .1, PARAM_MOUTH_OPEN_Y: .6, PARAM_BROW_L_FORM: -.8 }, { time: .5, delta: .5 });
  for (const [mesh, pass] of passes) {
    assert.equal(mesh.geometry, pass.geometry);
    for (const [name, index] of Object.entries(mesh.morphTargetDictionary)) {
      if (name !== 'ApplicationDecoration') near(mesh.morphTargetInfluences[index], pass.morphTargetInfluences[index]);
    }
    near(mesh.morphTargetInfluences[mesh.morphTargetDictionary.ApplicationDecoration], .17);
    near(pass.morphTargetInfluences[pass.morphTargetDictionary.ApplicationDecoration], .59);
  }
  adapter.dispose();
  for (const [mesh, pass] of passes) {
    assert.equal(mesh.geometry, f.geometries[mesh.name.split(' ')[0]]);
    assert.equal(pass.geometry, mesh.geometry);
    assert.ok(mesh.morphTargetInfluences.every(value => value === .17));
    assert.ok(pass.morphTargetInfluences.every(value => value === .59));
  }
});

test('restore exposes each new native underlay and dispose releases only adapter-owned state', () => {
  const f = fixture();
  const mesh = f.meshes.Face;
  const close = mesh.morphTargetDictionary['Face_.Eyelids_Close_L'];
  const decoration = mesh.morphTargetDictionary.ApplicationDecoration;
  mesh.morphTargetInfluences[close] = .21;
  mesh.morphTargetInfluences[decoration] = .46;
  const adapter = createExpressionAdapter(f.context);
  for (const underlay of [.21, .63, -.15]) {
    mesh.morphTargetInfluences[close] = underlay;
    adapter.apply({ PARAM_EYE_L_OPEN: 0, PARAM_MOUTH_OPEN_Y: .6 }, { time: 1, delta: 0 });
    near(mesh.morphTargetInfluences[decoration], .46);
    adapter.restore();
    near(mesh.morphTargetInfluences[close], underlay);
    adapter.restore();
    near(mesh.morphTargetInfluences[close], underlay);
  }
  adapter.apply({ PARAM_MOUTH_OPEN_Y: .9 }, { time: 0, delta: 0 });
  adapter.dispose();
  near(mesh.morphTargetInfluences[close], -.15);
  near(mesh.morphTargetInfluences[decoration], .46);
  assert.equal(mesh.geometry, f.geometries.Face);
  adapter.dispose();
});

test('instances sharing original geometry cannot change each other or the source attributes', () => {
  const a = fixture(), b = fixture('kaho', a.geometries);
  const originals = Object.fromEntries(Object.entries(a.geometries).map(([kind, geometry]) =>
    [kind, { positions: geometry.attributes.position.array.slice(), targets: geometry.morphAttributes.position.map(x => x.array.slice()) }]));
  const da = createExpressionAdapter(a.context), db = createExpressionAdapter(b.context);
  db.apply({ PARAM_MOUTH_OPEN_Y: .25, PARAM_EYE_R_OPEN: .2 }, { time: 1, delta: 0 });
  const bWeights = Object.fromEntries(Object.entries(b.meshes).map(([kind, mesh]) => [kind, [...(mesh.morphTargetInfluences ?? [])]]));
  const bPoints = Array.from({ length: 12 }, (_, i) => point(b.meshes.Face, i));
  da.apply({ PARAM_MOUTH_OPEN_Y: 1, PARAM_BROW_L_FORM: -1, PARAM_EYE_L_OPEN: 0 }, { time: 2, delta: .1 });
  da.dispose();
  for (const [kind, mesh] of Object.entries(b.meshes)) assert.deepEqual([...(mesh.morphTargetInfluences ?? [])], bWeights[kind]);
  bPoints.forEach((expected, i) => nearPoint(point(b.meshes.Face, i), expected));
  for (const [kind, geometry] of Object.entries(a.geometries)) {
    assert.deepEqual(geometry.attributes.position.array, originals[kind].positions);
    assert.deepEqual(geometry.morphAttributes.position.map(x => x.array), originals[kind].targets);
  }
  db.dispose();
});

test('finite values outside common source ranges produce finite bounded geometry', () => {
  const f = fixture(), adapter = createExpressionAdapter(f.context);
  for (const value of [-10, 10, -1e6, 1e6]) {
    const parameters = Object.freeze({ PARAM_EYE_L_OPEN: value, PARAM_EYE_R_SMILE: value,
      PARAM_BROW_L_FORM: value, PARAM_BROW_R_Y: value, PARAM_MOUTH_OPEN_Y: value,
      PARAM_MOUTH_FORM_01: value, PARAM_MOUTH_SCALE: value, PARAM_MOUTH_FORM_Y: value,
      PARAM_EYE_BALL_X: value, PARAM_EYE_SCALE: value, PARAM_TEAR: value });
    adapter.apply(parameters, { time: 0, delta: 0 });
    for (const mesh of Object.values(f.meshes)) {
      assert.ok(mesh.morphTargetInfluences.every(Number.isFinite));
      for (let index = 0; index < mesh.geometry.attributes.position.count; index++)
        assert.ok(point(mesh, index).every(coordinate => Number.isFinite(coordinate) && Math.abs(coordinate) < 3));
    }
    adapter.restore();
  }
  adapter.dispose();
});

test('failed creation restores resources already bound before the missing node', () => {
  const f = fixture(), original = snapshot(f);
  f.nodes.delete('EyeShadow Renderer');
  assert.throws(() => createExpressionAdapter(f.context), /EyeShadow/);
  assertRestored(f, original);
});

test('original node groups can contain multiple primitives with optional normals and indices absent', () => {
  const f = fixture('old');
  const source = f.meshes.Face;
  const original = source.geometry;
  original.deleteAttribute('normal'); original.setIndex(null);
  const second = new THREE.Mesh(original.clone(), new THREE.MeshBasicMaterial());
  const secondOriginal = second.geometry;
  const group = new THREE.Group(); group.name = 'Face Renderer';
  source.removeFromParent(); group.add(source, second); f.root.add(group);
  f.nodes.set(group.name, group);
  const adapter = createExpressionAdapter(f.context);
  adapter.apply({ PARAM_EYE_R_OPEN: .25, PARAM_MOUTH_OPEN_Y: .7 }, { time: .5, delta: 0 });
  assert.notEqual(source.geometry, original);
  assert.notEqual(second.geometry, secondOriginal);
  for (let i = 0; i < source.geometry.attributes.position.count; i++) nearPoint(point(source, i), point(second, i));
  adapter.dispose();
  assert.equal(source.geometry, original);
  assert.equal(second.geometry, secondOriginal);
});

test('equivalent costume bind frames preserve posed positions and authored normal deltas', () => {
  const a = fixture('old'), b = fixture('old');
  const transform = new THREE.Matrix4().compose(new THREE.Vector3(.4, -.9, .2),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(.12, -.17, .22)), new THREE.Vector3(1, 1, 1));
  const linear = new THREE.Matrix3().setFromMatrix4(transform);
  const normalMatrix = new THREE.Matrix3().getNormalMatrix(transform);
  const canonicalHeadInverse = new THREE.Matrix4().set(
    0, -1, 0, 0, 0, 0, -1, 0, 1, 0, 0, 0, 0, 0, 0, 1);
  for (const [f, changed] of [[a, false], [b, true]]) for (const mesh of Object.values(f.meshes)) {
    const geometry = mesh.geometry;
    geometry.morphAttributes.normal = geometry.morphAttributes.position.map(position => {
      const deltas = Array.from({ length: position.count }, (_, i) =>
        [position.getY(i) !== 0 ? .08 : 0, 0, 0]).flat();
      const normal = new THREE.Float32BufferAttribute(deltas, 3); normal.name = position.name;
      return normal;
    });
    if (changed) {
      geometry.attributes.position.applyMatrix4(transform);
      geometry.attributes.normal.applyNormalMatrix(normalMatrix);
      for (const attr of geometry.morphAttributes.position) attr.applyMatrix3(linear);
      for (const attr of geometry.morphAttributes.normal) attr.applyMatrix3(normalMatrix);
    }
    const head = new THREE.Bone(); head.name = 'Head';
    const inverse = canonicalHeadInverse.clone();
    if (changed) inverse.multiply(transform.clone().invert());
    mesh.skeleton = new THREE.Skeleton([head], [inverse]);
    mesh.bindMatrix = new THREE.Matrix4();
  }
  const da = createExpressionAdapter(a.context), db = createExpressionAdapter(b.context);
  const controls = { PARAM_EYE_L_OPEN: .2, PARAM_EYE_R_OPEN: .7, PARAM_EYE_R_SMILE: .4,
    PARAM_BROW_L_FORM: -.6, PARAM_BROW_R_ANGLE: .3, PARAM_MOUTH_OPEN_Y: .5,
    PARAM_MOUTH_FORM_01: -.4, PARAM_MOUTH_SCALE: .7, PARAM_EYE_BALL_X: .25 };
  da.apply(controls, { time: 1, delta: 0 }); db.apply(controls, { time: 1, delta: 0 });
  for (const kind of Object.keys(a.meshes)) {
    const ma = a.meshes[kind], mb = b.meshes[kind];
    for (let i = 0; i < ma.geometry.attributes.position.count; i++) {
      nearPoint(point(mb, i), new THREE.Vector3(...point(ma, i)).applyMatrix4(transform).toArray());
      const expectedNormal = new THREE.Vector3().fromBufferAttribute(ma.geometry.attributes.normal, i).applyMatrix3(normalMatrix);
      nearPoint(new THREE.Vector3().fromBufferAttribute(mb.geometry.attributes.normal, i).toArray(), expectedNormal.toArray());
    }
  }
  assert.ok(a.meshes.Face.geometry.attributes.normal.getX(1) > .01,
    'authored eye-closure normal displacement must reach output');
  da.dispose(); db.dispose();
});

test('iris size and highlight size remain independent while gaze moves both together', () => {
  const f = fixture('old'), eye = f.meshes.Eye, geometry = eye.geometry;
  for (const [name, attribute] of Object.entries(geometry.attributes)) {
    const values = [...attribute.array, ...attribute.array];
    geometry.setAttribute(name, new THREE.Float32BufferAttribute(values, attribute.itemSize));
  }
  for (const [kind, attributes] of Object.entries(geometry.morphAttributes)) {
    geometry.morphAttributes[kind] = attributes.map(attribute => {
      const extended = new THREE.Float32BufferAttribute([...attribute.array, ...attribute.array], attribute.itemSize);
      extended.name = attribute.name; return extended;
    });
  }
  const positions = geometry.attributes.position;
  for (let i = 6; i < 12; i++) {
    const centerX = positions.getX(i) > 0 ? .04 : -.04;
    positions.setXY(i, centerX + (positions.getX(i) - centerX) * .2,
      1.6 + (positions.getY(i) - 1.6) * .2);
  }
  geometry.setIndex(Array.from({ length: 12 }, (_, i) => i));
  geometry.clearGroups(); geometry.addGroup(0, 6, 0); geometry.addGroup(6, 6, 1);
  const iris = new THREE.MeshBasicMaterial(), highlight = new THREE.MeshBasicMaterial();
  iris.userData.__parameterizedShader = 'character-eye';
  highlight.userData.__parameterizedShader = 'character-highlight';
  eye.material = [iris, highlight];
  const adapter = createExpressionAdapter(f.context);
  adapter.apply({}, { time: 0, delta: 0 });
  const neutral = Array.from({ length: 12 }, (_, i) => point(eye, i));
  adapter.restore(); adapter.apply({ PARAM_EYE_SCALE: 1 }, { time: 1, delta: 0 });
  assert.notDeepEqual(point(eye, 0), neutral[0]);
  for (let i = 6; i < 12; i++) nearPoint(point(eye, i), neutral[i]);
  adapter.restore(); adapter.apply({ PARAM_EYE_HIGHLIGHT: 1 }, { time: 2, delta: 0 });
  assert.notDeepEqual(point(eye, 6), neutral[6]);
  for (let i = 0; i < 6; i++) nearPoint(point(eye, i), neutral[i]);
  adapter.restore(); adapter.apply({ PARAM_EYE_BALL_X: .6, PARAM_EYE_BALL_Y: -.3 }, { time: 3, delta: 0 });
  const firstDelta = point(eye, 0).map((v, axis) => v - neutral[0][axis]);
  assert.ok(Math.abs(firstDelta[0]) > .0001);
  for (let i = 1; i < 12; i++) nearPoint(point(eye, i).map((v, axis) => v - neutral[i][axis]), firstDelta);
  adapter.dispose();
  assert.equal(eye.geometry, geometry);
  assert.deepEqual(eye.material, [iris, highlight]);
});

test('tear uses its source channel, updates cached geometry and restores native ownership', () => {
  const f = fixture('old'), face = f.meshes.Face;
  const count = face.geometry.attributes.position.count;
  const attribute = new THREE.Float32BufferAttribute(Array.from({ length: count }, (_, i) =>
    i < 6 ? [0, -.002, .001] : [0, 0, 0]).flat(), 3);
  attribute.name = 'Face_.Other_Tear'; face.geometry.morphAttributes.position.push(attribute); face.updateMorphTargets();
  const index = face.morphTargetDictionary['Face_.Other_Tear'];
  face.morphTargetInfluences[index] = .23;
  const adapter = createExpressionAdapter(f.context);
  adapter.apply({}, { time: 0, delta: 0 }); const neutral = point(face, 0);
  adapter.restore(); adapter.apply({ PARAM_TEAR: .6 }, { time: 0, delta: 0 });
  nearPoint(point(face, 0), [neutral[0], neutral[1] - .0012, neutral[2] + .0006]);
  near(face.morphTargetInfluences[index], 0);
  adapter.restore(); near(face.morphTargetInfluences[index], .23);
  adapter.dispose(); near(face.morphTargetInfluences[index], .23);
  const unsupported = fixture('new'), other = createExpressionAdapter(unsupported.context);
  other.apply({}, { time: 0, delta: 0 }); const before = point(unsupported.meshes.Face, 0);
  other.restore(); other.apply({ PARAM_TEAR: 1 }, { time: 0, delta: 0 });
  nearPoint(point(unsupported.meshes.Face, 0), before); other.dispose();
});

test('dispose keeps rendered private attributes reachable for renderer buffer cleanup', () => {
  const f = fixture('old'), original = f.meshes.Face.geometry;
  let sourceDisposed = false;
  original.addEventListener('dispose', () => { sourceDisposed = true; });
  const adapter = createExpressionAdapter(f.context);
  adapter.apply({ PARAM_MOUTH_OPEN_Y: .5 }, { time: 1, delta: 0 });
  const privateGeometry = f.meshes.Face.geometry;
  const renderedPosition = privateGeometry.attributes.position;
  const renderedNormal = privateGeometry.attributes.normal;
  assert.notEqual(privateGeometry, original);
  let privateDisposed = false;
  privateGeometry.addEventListener('dispose', () => {
    privateDisposed = true;
    assert.equal(privateGeometry.attributes.position, renderedPosition);
    assert.equal(privateGeometry.attributes.normal, renderedNormal);
  });
  adapter.restore();
  adapter.dispose();
  assert.equal(privateDisposed, true);
  assert.equal(sourceDisposed, false);
  assert.equal(f.meshes.Face.geometry, original);
});

test('active derived geometry bypasses stale culling bounds and restores each object flag', () => {
  const f = fixture('old');
  f.meshes.Face.frustumCulled = true;
  f.meshes.Brow.frustumCulled = false;
  const pass = f.meshes.Face.clone(); pass.userData.__parameterizedPassObject = true;
  pass.frustumCulled = false; f.root.add(pass);
  const adapter = createExpressionAdapter(f.context);
  adapter.apply({ PARAM_BROW_L_Y: 1 }, { time: 1, delta: 0 });
  assert.equal(f.meshes.Face.frustumCulled, false);
  assert.equal(f.meshes.Brow.frustumCulled, false);
  assert.equal(pass.frustumCulled, false);
  adapter.restore();
  assert.equal(f.meshes.Face.frustumCulled, true);
  assert.equal(f.meshes.Brow.frustumCulled, false);
  assert.equal(pass.frustumCulled, false);
  adapter.apply({}, { time: 2, delta: 0 }); adapter.dispose();
  assert.equal(f.meshes.Face.frustumCulled, true);
  assert.equal(f.meshes.Brow.frustumCulled, false);
  assert.equal(pass.frustumCulled, false);
});

test('rejecting a nonfinite control cannot leave the previous frame applied', () => {
  const f = fixture('old');
  const face = f.meshes.Face, index = face.morphTargetDictionary['Face_.Mouth_A'];
  face.morphTargetInfluences[index] = .37;
  const adapter = createExpressionAdapter(f.context);
  adapter.apply({ PARAM_MOUTH_OPEN_Y: .9 }, { time: 1, delta: 0 });
  adapter.restore();
  assert.throws(() => adapter.apply({ PARAM_MOUTH_OPEN_Y: NaN }, { time: 2, delta: 0 }), /finite/i);
  near(face.morphTargetInfluences[index], .37);
  adapter.dispose();
  assert.equal(face.geometry, f.geometries.Face);
});

function foreheadFixture({ slope = false, behind = false, nonIndexed = false } = {}) {
  const geometries = Object.fromEntries(['Face', 'Brow', 'Eye', 'EyeShadow'].map(kind => [kind, makeGeometry(kind)]));
  const vertices = slope
    ? [[-.08, 1.645, .075], [.08, 1.645, .075], [.08, 1.68, .145], [-.08, 1.68, .145]]
    : [[.029, 1.659, .08], [.051, 1.659, .08], [.051, 1.666, .08],
      [.029, 1.666, .08], [.04, 1.662, .114]];
  const indices = slope ? [0, 1, 2, 0, 2, 3] : [0, 1, 4, 1, 2, 4, 2, 3, 4, 3, 0, 4];
  const face = new THREE.BufferGeometry();
  face.setAttribute('position', new THREE.Float32BufferAttribute(
    vertices.flatMap(([x, y, z]) => [x, y, behind ? z - 1 : z]), 3));
  face.setIndex(indices);
  face.computeVertexNormals();
  face.morphTargetsRelative = true;
  const neutral = new THREE.Float32BufferAttribute(vertices.flatMap(() => [0, 0, 0]), 3);
  neutral.name = 'Face_.Eyelids_Normal';
  face.morphAttributes.position = [neutral];
  geometries.Face = nonIndexed ? face.toNonIndexed() : face;
  // An authored depth slope must survive clearance as a rigid side translation.
  for (let i = 0; i < 6; i++) geometries.Brow.attributes.position.setZ(i, .1 + (i % 3) * .001);
  const f = fixture('new', geometries);
  f.meshes.Face.material.side = THREE.DoubleSide;
  return f;
}

function skinDepthAt(f, x, y) {
  // Raycasting independently checks the visible rendered surface, not the
  // adapter's overlap implementation or its choice of acceleration structure.
  f.root.updateMatrixWorld(true);
  const hit = new THREE.Raycaster(new THREE.Vector3(x, y, 2), new THREE.Vector3(0, 0, -1))
    .intersectObject(f.meshes.Face, false)[0];
  return hit?.point.z ?? -Infinity;
}

function assertBrowVisible(f, indices) {
  const [a, b, c] = indices.map(index => new THREE.Vector3(...point(f.meshes.Brow, index)));
  // Interior samples matter: a forehead peak can pierce a triangle even when
  // all three eyebrow vertices remain in front of the skin.
  for (let i = 0; i <= 16; i++) for (let j = 0; j <= 16 - i; j++) {
    const p = a.clone().multiplyScalar(i / 16).addScaledVector(b, j / 16)
      .addScaledVector(c, 1 - (i + j) / 16);
    assert.ok(p.z > skinDepthAt(f, p.x, p.y) + 1e-7,
      `brow triangle is occluded at (${p.x}, ${p.y}, ${p.z})`);
  }
}

test('eyebrow clearance covers interior forehead intersections and translates each side uniformly', () => {
  const f = foreheadFixture(), reference = foreheadFixture({ behind: true });
  const original = snapshot(f), source = f.geometries.Brow.attributes.position.array.slice();
  const adapter = createExpressionAdapter(f.context), free = createExpressionAdapter(reference.context);
  adapter.apply({});
  for (let i = 0; i < 6; i++) nearPoint(point(f.meshes.Brow, i), Array.from(source.slice(i * 3, i * 3 + 3)));
  const controls = { PARAM_BROW_L_Y: 1 };
  free.apply(controls);
  for (const i of [0, 1, 2]) {
    const p = point(reference.meshes.Brow, i);
    assert.ok(p[2] > skinDepthAt(f, p[0], p[1]), 'fixture eyebrow vertices must already clear the skin');
  }
  adapter.apply(controls);
  assertBrowVisible(f, [0, 1, 2]);
  const offset = point(f.meshes.Brow, 0)[2] - point(reference.meshes.Brow, 0)[2];
  assert.ok(offset > .005 && offset < .03, 'clearance resolves the hidden interior with a small depth shift');
  for (let i = 0; i < 6; i++) {
    const expected = point(reference.meshes.Brow, i);
    nearPoint(point(f.meshes.Brow, i), [expected[0], expected[1], expected[2] + (i < 3 ? offset : 0)]);
  }
  const version = f.meshes.Brow.geometry.attributes.position.version;
  adapter.apply(controls);
  assert.equal(f.meshes.Brow.geometry.attributes.position.version, version, 'identical controls reuse baked geometry');
  adapter.apply({});
  for (let i = 0; i < 6; i++) nearPoint(point(f.meshes.Brow, i), Array.from(source.slice(i * 3, i * 3 + 3)));
  assert.deepEqual(f.geometries.Brow.attributes.position.array, source);
  adapter.restore(); assertRestored(f, original);
  adapter.dispose(); free.dispose();
});

test('both brows independently clear a sloping non-indexed forehead without changing their shapes', () => {
  const f = foreheadFixture({ slope: true, nonIndexed: true });
  const reference = foreheadFixture({ slope: true, behind: true, nonIndexed: true });
  const adapter = createExpressionAdapter(f.context), free = createExpressionAdapter(reference.context);
  const controls = { PARAM_BROW_L_Y: 1, PARAM_BROW_L_ANGLE: .35, PARAM_BROW_L_FORM: -.4,
    PARAM_BROW_R_Y: .8, PARAM_BROW_R_ANGLE: -.2, PARAM_BROW_R_FORM: .5 };
  adapter.apply(controls); free.apply(controls);
  const offsets = [];
  for (const indices of [[0, 1, 2], [3, 4, 5]]) {
    assertBrowVisible(f, indices);
    const offset = point(f.meshes.Brow, indices[0])[2] - point(reference.meshes.Brow, indices[0])[2];
    assert.ok(offset > 0); offsets.push(offset);
    for (const i of indices) {
      const expected = point(reference.meshes.Brow, i);
      nearPoint(point(f.meshes.Brow, i), [expected[0], expected[1], expected[2] + offset]);
      nearPoint(new THREE.Vector3().fromBufferAttribute(f.meshes.Brow.geometry.attributes.normal, i).toArray(),
        new THREE.Vector3().fromBufferAttribute(reference.meshes.Brow.geometry.attributes.normal, i).toArray());
    }
  }
  assert.ok(Math.abs(offsets[0] - offsets[1]) > .0001, 'independent side clearance follows different brow heights');
  adapter.dispose(); free.dispose();
});

test('forehead clearance is equivalent across rotated costume bind frames', () => {
  const a = foreheadFixture(), b = foreheadFixture();
  const transform = new THREE.Matrix4().compose(new THREE.Vector3(.4, -.9, .2),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(.12, -.17, .22)), new THREE.Vector3(1, 1, 1));
  const linear = new THREE.Matrix3().setFromMatrix4(transform);
  const normal = new THREE.Matrix3().getNormalMatrix(transform);
  const headInverse = new THREE.Matrix4().set(0, -1, 0, 0, 0, 0, -1, 0, 1, 0, 0, 0, 0, 0, 0, 1);
  for (const [f, rotated] of [[a, false], [b, true]]) for (const mesh of Object.values(f.meshes)) {
    if (rotated) {
      mesh.geometry.attributes.position.applyMatrix4(transform);
      mesh.geometry.attributes.normal.applyNormalMatrix(normal);
      for (const attribute of mesh.geometry.morphAttributes.position) attribute.applyMatrix3(linear);
    }
    const head = new THREE.Bone(); head.name = 'Head';
    const inverse = headInverse.clone();
    if (rotated) inverse.multiply(transform.clone().invert());
    mesh.skeleton = new THREE.Skeleton([head], [inverse]);
    mesh.bindMatrix = new THREE.Matrix4();
  }
  const da = createExpressionAdapter(a.context), db = createExpressionAdapter(b.context);
  da.apply({ PARAM_BROW_L_Y: 1 }); db.apply({ PARAM_BROW_L_Y: 1 });
  assertBrowVisible(a, [0, 1, 2]);
  for (let i = 0; i < 6; i++) nearPoint(point(b.meshes.Brow, i),
    new THREE.Vector3(...point(a.meshes.Brow, i)).applyMatrix4(transform).toArray());
  da.dispose(); db.dispose();
});

test('eyebrow clearance follows the final face morph even when brow controls stay unchanged', () => {
  const f = foreheadFixture();
  const face = f.meshes.Face, original = snapshot(f);
  const tear = new THREE.Float32BufferAttribute(Array.from(
    { length: face.geometry.attributes.position.count }, () => [0, 0, .018]).flat(), 3);
  tear.name = 'Face_.Other_Tear';
  face.geometry.morphAttributes.position.push(tear); face.updateMorphTargets();
  const adapter = createExpressionAdapter(f.context);
  adapter.apply({ PARAM_BROW_L_Y: 1 });
  const before = Array.from({ length: 6 }, (_, i) => point(f.meshes.Brow, i));
  adapter.apply({ PARAM_BROW_L_Y: 1, PARAM_TEAR: 1 });
  assertBrowVisible(f, [0, 1, 2]);
  for (let i = 0; i < 6; i++) nearPoint(point(f.meshes.Brow, i),
    [before[i][0], before[i][1], before[i][2] + (i < 3 ? .018 : 0)]);
  adapter.apply({ PARAM_BROW_L_Y: 1 });
  for (let i = 0; i < 6; i++) nearPoint(point(f.meshes.Brow, i), before[i]);
  adapter.dispose();
  assert.equal(face.geometry, original.Face.geometry);
});

test('authored hidden alternate brow islands do not force visible brows outside the forehead', () => {
  const f = foreheadFixture({ slope: true }), reference = foreheadFixture({ slope: true, behind: true });
  for (const sample of [f, reference]) {
    const geometry = sample.geometries.Brow;
    // A separate native-expression island occupies the same XY area but is
    // parked deep inside the head in the parameter-face neutral shape.
    for (const [name, attribute] of Object.entries(geometry.attributes)) {
      geometry.setAttribute(name, new THREE.Float32BufferAttribute(
        [...attribute.array, ...attribute.array.slice(0, 3 * attribute.itemSize)], attribute.itemSize));
    }
    for (const [kind, attributes] of Object.entries(geometry.morphAttributes)) {
      geometry.morphAttributes[kind] = attributes.map(attribute => {
        const extended = new THREE.Float32BufferAttribute(
          [...attribute.array, ...attribute.array.slice(0, 3 * attribute.itemSize)], attribute.itemSize);
        extended.name = attribute.name;
        return extended;
      });
    }
    for (let i = 6; i < 9; i++) geometry.attributes.position.setZ(i,
      geometry.attributes.position.getZ(i) - .04);
    geometry.setIndex(Array.from({ length: 9 }, (_, i) => i));
  }
  const source = f.geometries.Brow.attributes.position.array.slice();
  const adapter = createExpressionAdapter(f.context), free = createExpressionAdapter(reference.context);
  adapter.apply({});
  for (let i = 0; i < 9; i++) nearPoint(point(f.meshes.Brow, i),
    Array.from(source.slice(i * 3, i * 3 + 3)));
  const controls = { PARAM_BROW_L_Y: 1 };
  adapter.apply(controls); free.apply(controls);
  assertBrowVisible(f, [0, 1, 2]);
  const shift = point(f.meshes.Brow, 0)[2] - point(reference.meshes.Brow, 0)[2];
  assert.ok(shift > 0 && shift < .02, 'only the visible brow should determine required clearance');
  for (let i = 0; i < 3; i++) {
    const expected = point(reference.meshes.Brow, i);
    nearPoint(point(f.meshes.Brow, i), [expected[0], expected[1], expected[2] + shift]);
  }
  for (let i = 6; i < 9; i++) {
    const p = point(f.meshes.Brow, i), expected = point(reference.meshes.Brow, i);
    nearPoint(p, expected);
    near(p[2], source[i * 3 + 2], 'dormant island retains authored depth');
    assert.ok(p[2] < skinDepthAt(f, p[0], p[1]) - .005, 'the alternate island must remain inside the skin');
  }
  adapter.dispose(); free.dispose();
  assert.deepEqual(f.geometries.Brow.attributes.position.array, source);
});


test('runtime registers each neutral profile exactly once', async () => {
  const manifest = JSON.parse(await readFile(new URL('../packages/hasunosora_runtime/config.json', import.meta.url), 'utf8'));
  const registered = manifest.components.filter(component => component.type === 'garupa-expression-adapter');
  assert.deepEqual(registered.map(component => component.motionGroup).sort(),
    ['hasunosora.kaho', 'hasunosora.new', 'hasunosora.old']);
  assert.deepEqual(Object.keys(HASUNOSORA_FACE_PROFILES).sort(), registered.map(component => component.motionGroup).sort());
});

function removeTargets(geometry, names) {
  for (const semantic of Object.keys(geometry.morphAttributes))
    geometry.morphAttributes[semantic] = geometry.morphAttributes[semantic].filter(attribute => !names.includes(attribute.name));
}

test('an eye without Morphs supports gaze and restores its exact source geometry', () => {
  const geometries = Object.fromEntries(['Face', 'Brow', 'Eye', 'EyeShadow'].map(kind => [kind, makeGeometry(kind)]));
  geometries.Eye.morphAttributes = {};
  geometries.Eye.morphTargetsRelative = false;
  const f = fixture('new', geometries), before = snapshot(f);
  const adapter = createExpressionAdapter(f.context);
  adapter.apply({});
  const neutral = point(f.meshes.Eye, 0);
  adapter.apply({ PARAM_EYE_BALL_X: .5, PARAM_EYE_BALL_Y: -.5 });
  const gazing = point(f.meshes.Eye, 0);
  assert.ok(gazing[0] > neutral[0]);
  assert.ok(gazing[1] < neutral[1]);
  adapter.dispose();
  assertRestored(f, before);
  assert.equal(geometries.Eye.morphTargetsRelative, false);
});

test('absolute Morphs still reject creation and restore previously bound meshes', () => {
  const f = fixture('new'), before = snapshot(f);
  f.geometries.Eye.morphTargetsRelative = false;
  assert.throws(() => createExpressionAdapter(f.context), /relative Morph/);
  assertRestored(f, before);
});

test('missing round-mouth target preserves aperture at partial and maximum round input', () => {
  const geometries = Object.fromEntries(['Face', 'Brow', 'Eye', 'EyeShadow'].map(kind => [kind, makeGeometry(kind)]));
  removeTargets(geometries.Face, ['Face_.Mouth_O']);
  const f = fixture('new', geometries), adapter = createExpressionAdapter(f.context);
  for (const open of [.2, .6, 1]) for (const form of [-.3, -1]) {
    adapter.apply({ PARAM_MOUTH_OPEN_Y: open, PARAM_MOUTH_FORM_01: form });
    // Upper and lower centre vertices share the corner shift, so aperture isolates opening.
    const baseUpper = geometries.Face.attributes.position.getY(7);
    const baseLower = geometries.Face.attributes.position.getY(11);
    near(point(f.meshes.Face, 7)[1] - point(f.meshes.Face, 11)[1], baseUpper - baseLower + .008 * open);
  }
  adapter.dispose();
});

test('face and eye strip share partial-smile capability while retaining bilateral smile closure', () => {
  const geometries = Object.fromEntries(['Face', 'Brow', 'Eye', 'EyeShadow'].map(kind => [kind, makeGeometry(kind)]));
  removeTargets(geometries.EyeShadow, ['EyeShadow_.Eyelids_Smile']);
  const f = fixture('new', geometries), adapter = createExpressionAdapter(f.context);
  for (const open of [0, .2, .6, 1]) {
    adapter.apply({ PARAM_EYE_L_OPEN: open, PARAM_EYE_L_SMILE: 1 });
    for (let i = 0; i < 6; i++) nearPoint(point(f.meshes.Face, i), point(f.meshes.EyeShadow, i));
    near(point(f.meshes.Face, 1)[1], geometries.Face.attributes.position.getY(1) - .003 * (1 - open));
    nearPoint(point(f.meshes.Face, 4), new THREE.Vector3().fromBufferAttribute(geometries.Face.attributes.position, 4).toArray());
  }
  adapter.dispose();
});

test('fully supported meshes retain the authored partial-smile contribution', () => {
  const f = fixture('new'), adapter = createExpressionAdapter(f.context);
  adapter.apply({ PARAM_EYE_L_OPEN: .5, PARAM_EYE_L_SMILE: .8 });
  const base = f.geometries.Face.attributes.position.getY(1);
  near(point(f.meshes.Face, 1)[1], base - .004 * .5 * .2 - .003 * .5 * .8 + .001 * .8 * .5 * .5 * 1.6);
  adapter.dispose();
});


function groupedCacheFixture(group, { shared = false, bind = false } = {}) {
  const f = fixture(group);
  if (shared) {
    f.meshes.Eye.geometry = f.meshes.Face.geometry;
    f.meshes.Eye.updateMorphTargets();
  }
  for (const geometry of new Set(Object.values(f.meshes).map(mesh => mesh.geometry))) {
    geometry.morphAttributes.normal = geometry.morphAttributes.position.map(attribute =>
      new THREE.Float32BufferAttribute(Array.from(attribute.array, value => value * .13), 3));
  }
  for (const mesh of Object.values(f.meshes)) {
    if (bind) {
      const head = new THREE.Bone(); head.name = 'Head';
      mesh.skeleton = new THREE.Skeleton([head], [new THREE.Matrix4().compose(
        new THREE.Vector3(.04, -.03, .07), new THREE.Quaternion().setFromEuler(new THREE.Euler(.11, -.21, .3)),
        new THREE.Vector3(1.1, .9, 1.2))]);
      mesh.bindMatrix = new THREE.Matrix4().makeRotationZ(.17).setPosition(.02, -.01, .04);
    }
    const pass = mesh.clone(); pass.userData.__parameterizedPassObject = true;
    pass.morphTargetInfluences = [...mesh.morphTargetInfluences]; f.root.add(pass);
  }
  f.allMeshes = []; f.root.traverse(object => { if (object.isMesh) f.allMeshes.push(object); });
  return f;
}

function cacheOutput(f) {
  const bytes = attribute => attribute ? Buffer.from(attribute.array.buffer,
    attribute.array.byteOffset, attribute.array.byteLength) : null;
  return f.allMeshes.map(mesh => ({
    position: bytes(mesh.geometry.attributes.position), normal: bytes(mesh.geometry.attributes.normal),
    weights: [...mesh.morphTargetInfluences], culled: mesh.frustumCulled,
    local: [...mesh.position.toArray(), ...mesh.quaternion.toArray(), ...mesh.scale.toArray()],
  }));
}

function nativeFrame(f, frame) {
  f.allMeshes.forEach((mesh, index) => {
    for (let j = 0; j < mesh.morphTargetInfluences.length; j++)
      mesh.morphTargetInfluences[j] = Math.sin(frame * .1 + index + j) * .3;
    mesh.position.x = Math.sin(frame * .2 + index) * .01;
  });
}

function compareGroupCache(group, options) {
  const f = groupedCacheFixture(group, options), reference = groupedCacheFixture(group, options);
  const driver = new HasunosoraLive2dFace(f.context), old = new HasunosoraLive2dFace(reference.context);
  old.update = originalUpdate;
  for (const item of [driver, old]) for (const work of item.workspaces) work.restoreAttributes();
  const base = { PARAM_BROW_L_Y: .8, PARAM_BROW_R_FORM: -.4, PARAM_EYE_R_OPEN: .6, PARAM_MOUTH_OPEN_Y: .35 };
  for (let frame = 0; frame < 90; frame++) {
    driver.beginFrame(); old.beginFrame(); nativeFrame(f, frame); nativeFrame(reference, frame);
    const native = snapshot(f), nativeReference = snapshot(reference);
    const t = frame % 9;
    const parameters = t < 3 ? base : t < 6
      ? { ...base, PARAM_EYE_BALL_X: Math.sin(frame), PARAM_EYE_HIGHLIGHT: .4, PARAM_EYE_SCALE: -.2 }
      : { ...base, PARAM_TEAR: .3, PARAM_MOUTH_FORM_01: -.5, PARAM_EYE_L_SMILE: .23 };
    // Includes A-B-A, same effective control through defaults, and ignored parameters.
    const defaults = frame % 2 ? parameters : { PARAM_EYE_L_OPEN: 1 };
    const input = frame % 2 ? { PARAM_EYELID_L: frame } : parameters;
    assert.deepEqual(driver.setParameters(input, defaults), old.setParameters(input, defaults));
    assert.deepEqual(driver.update(), old.update());
    assert.deepEqual(cacheOutput(f), cacheOutput(reference), `${group}/${JSON.stringify(options)}/${frame}`);
    driver.beginFrame(); old.beginFrame();
    assertRestored(f, native); assertRestored(reference, nativeReference);
    assert.deepEqual(cacheOutput(f), cacheOutput(reference));
  }
  const before = snapshot(f), oldBefore = snapshot(reference);
  driver.setParameters(base); old.setParameters(base); driver.update(); old.update();
  driver.dispose(); old.dispose(); assertRestored(f, before); assertRestored(reference, oldBefore);
  assert.deepEqual(cacheOutput(f), cacheOutput(reference));
}

test('split face/eye cache exactly matches frozen update bytes with native underlays, defaults and nonidentity binds', () => {
  for (const group of groups) for (const bind of [false, true]) compareGroupCache(group, { bind });
});

test('shared Face/Eye workspace couples both dirty groups and matches original operation order', () => {
  for (const group of groups) compareGroupCache(group, { shared: true, bind: true });
});

test('independent gaze/highlight and face changes skip unrelated geometry but still activate and restore every workspace', () => {
  const f = groupedCacheFixture('old'), driver = new HasunosoraLive2dFace(f.context);
  const counts = { face: 0, eye: 0, clear: 0, activate: 0 };
  for (const [method, key] of [['applyEyes', 'face'], ['applyGaze', 'eye'], ['clearBrows', 'clear']]) {
    const original = driver[method]; driver[method] = function (...args) { counts[key]++; return original.apply(this, args); };
  }
  for (const work of driver.workspaces) {
    const original = work.activate; work.activate = function (...args) { counts.activate++; return original.apply(this, args); };
  }
  const apply = parameters => { driver.setParameters(parameters); driver.update(); };
  apply({});
  const faceVersion = f.meshes.Face.geometry.attributes.position.version;
  apply({ PARAM_EYE_BALL_X: .35, PARAM_EYE_HIGHLIGHT: .6 });
  assert.equal(counts.face, 1); assert.equal(counts.clear, 1); assert.equal(counts.eye, 2);
  assert.equal(f.meshes.Face.geometry.attributes.position.version, faceVersion);
  const eyeVersion = f.meshes.Eye.geometry.attributes.position.version;
  apply({ PARAM_EYE_BALL_X: .35, PARAM_EYE_HIGHLIGHT: .6, PARAM_MOUTH_OPEN_Y: .8 });
  assert.equal(counts.face, 2); assert.equal(counts.clear, 2); assert.equal(counts.eye, 2);
  assert.equal(f.meshes.Eye.geometry.attributes.position.version, eyeVersion);
  apply({ PARAM_EYE_BALL_X: .35, PARAM_EYE_HIGHLIGHT: .6, PARAM_MOUTH_OPEN_Y: .8, PARAM_EYELID_L: -.7 });
  assert.equal(counts.face, 2); assert.equal(counts.eye, 2);
  assert.equal(counts.activate, driver.workspaces.length * 4);
  driver.dispose();
});
