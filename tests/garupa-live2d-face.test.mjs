import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createExpressionAdapter } from '../packages/garupa_runtime/adapters/garupa-live2d-face.js';

function fixture(extraMouths = []) {
  const names = ['face_main_eye_close_L', 'face_main_eye_close_R', 'face_main_eye_wink_L',
    'face_main_eye_joy_L', 'face_main_mouth_open_a', 'face_main_mouth_open_o',
    'face_main_mouth_joy', 'face_main_mouth_sad', 'eyebrow_angry_L', 'eyebrow_sad_L',
    'face_main_mouth_smile', 'face_main_mouth_open_e', ...extraMouths, 'decoration'];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3));
  geometry.morphAttributes.position = names.map((name) => {
    const closed = ['face_main_mouth_joy', 'face_main_mouth_serious'].includes(name);
    const attribute = new THREE.Float32BufferAttribute(closed ? [0.001, 0, 0] : [0, 0.001, 0], 3);
    attribute.name = name;
    return attribute;
  });
  geometry.morphTargetsRelative = true;
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
  mesh.name = 'face';
  const root = new THREE.Group();
  root.add(mesh);
  const head = new THREE.Bone();
  head.name = 'Head';
  root.add(head);
  for (const side of ['L', 'R']) {
    let eyePivot;
    for (const suffix of ['', '_Hilight_1', '_Hilight_2', '_Hilight_3']) {
      const pivot = new THREE.Bone();
      pivot.name = `${side}Eye${suffix}${suffix ? '_0' : '_0_0'}`;
      const end = new THREE.Bone();
      end.name = `${side}Eye${suffix}${suffix ? '_1' : '_0_1'}`;
      pivot.add(end);
      if (suffix) {
        eyePivot.add(pivot);
      } else {
        head.add(pivot);
        eyePivot = pivot;
      }
    }
  }
  const morphPoses = names.slice(0, -1).map((name) => ({
    name: `source.${name}`,
    targets: { face: { [name]: name.includes('mouth') ? 0.8 : 1 } },
  }));
  const part = { role: 'head', root, component: { motionGroup: 'garupa', morphPoses },
    gltf: { parser: { json: { nodes: [{ name: 'Head', rotation: [0, 0, 0, 1] }] } } } };
  const context = { THREE, root, parts: [part], resolveNode: (role, name) => root.getObjectByName(name) };
  return { context, part, root, mesh, geometry, weight: (name) => mesh.morphTargetInfluences[mesh.morphTargetDictionary[name]] };
}

// Synthetic geometry exercises an unclassified but legal model. Audited facial
// profiles have separate numeric tests; neither test depends on private assets.
test('partial blink and smile preserve separate left/right closure semantics', () => {
  const f = fixture();
  const driver = createExpressionAdapter(f.context);
  driver.apply({ PARAM_EYE_L_OPEN: 0.4, PARAM_EYE_R_OPEN: 0.7, PARAM_EYE_L_SMILE: 0.25 });
  for (const [name, value] of [['face_main_eye_close_L', .45], ['face_main_eye_wink_L', .15], ['face_main_eye_close_R', .3]]) {
    assert.ok(Math.abs(f.weight(name) - value) < 1e-12, name);
  }
  driver.dispose();
});

test('closed parameter forms never activate an opening vowel on a classified closure direction', () => {
  const f = fixture(['face_main_mouth_serious']);
  const driver = createExpressionAdapter(f.context);
  for (const form of [-1, -.5, -1/3, -.1, 0, .25, .5, 1]) {
    driver.apply({ PARAM_MOUTH_FORM_01: form, PARAM_MOUTH_OPEN_Y: 0 });
    for (const name of ['face_main_mouth_open_a', 'face_main_mouth_open_o', 'face_main_mouth_open_e']) {
      assert.equal(f.weight(name), 0, `${name} at ${form}`);
    }
    for (const value of f.mesh.morphTargetInfluences) assert.ok(Number.isFinite(value) && value >= 0 && value <= 1);
  }
  driver.dispose();
});

test('visible opening candidates cannot be used as closed-mouth contours', () => {
  const f = fixture(['face_main_mouth_serious']);
  const attribute = name => f.geometry.morphAttributes.position[f.mesh.morphTargetDictionary[name]];
  attribute('face_main_mouth_joy').array.set([0, .001, 0]);
  attribute('face_main_mouth_serious').array.set([0, .001, 0]);
  attribute('face_main_mouth_smile').array.set([.001, 0, 0]);
  attribute('face_main_mouth_sad').array.set([.001, 0, 0]);
  const driver = createExpressionAdapter(f.context);
  for (const form of [-1, 1]) {
    driver.apply({ PARAM_MOUTH_FORM_01: form, PARAM_MOUTH_OPEN_Y: 0 });
    for (const name of ['face_main_mouth_joy', 'face_main_mouth_serious', 'face_main_mouth_open_a']) assert.equal(f.weight(name), 0);
  }
  driver.dispose();
});

test('mouth controls use authored units, including full opening and finite bounded intermediates', () => {
  const f = fixture();
  const driver = createExpressionAdapter(f.context);
  driver.apply({ PARAM_MOUTH_OPEN_Y: 1 });
  assert.equal(f.weight('face_main_mouth_open_a'), 1);
  for (const form of [-1, -.5, 0, .5, 1]) for (const scale of [-1, 0, 1]) {
    for (let step = 0; step <= 20; step++) {
      driver.apply({ PARAM_MOUTH_OPEN_Y: step / 20, PARAM_MOUTH_FORM_01: form, PARAM_MOUTH_SCALE: scale });
      for (const value of f.mesh.morphTargetInfluences) assert.ok(Number.isFinite(value) && value >= 0 && value <= 1);
    }
  }
  driver.dispose();
});

test('positive opening remains available when an unclassified head lacks a useful native grin', () => {
  for (const hasZeroFun of [false, true]) {
    const f = fixture(hasZeroFun ? ['face_main_mouth_fun'] : []);
    f.geometry.morphAttributes.position[f.mesh.morphTargetDictionary.face_main_mouth_smile].array.fill(0);
    if (hasZeroFun) f.geometry.morphAttributes.position[f.mesh.morphTargetDictionary.face_main_mouth_fun].array.fill(0);
    const driver = createExpressionAdapter(f.context);
    driver.apply({ PARAM_MOUTH_FORM_01: 1, PARAM_MOUTH_OPEN_Y: 1 });
    assert.equal(f.weight('face_main_mouth_open_a'), 1);
    driver.dispose();
  }
});

test('morph geometry is analysed at binding and never rescanned by per-frame controls', () => {
  const f = fixture(['face_main_mouth_fun', 'face_main_mouth_serious']);
  const driver = createExpressionAdapter(f.context);
  for (const attribute of f.geometry.morphAttributes.position) {
    attribute.getX = attribute.getY = attribute.getZ = () => { throw new Error('Per-frame vertex scan'); };
  }
  for (let i = 0; i < 20; i++) driver.apply({ PARAM_MOUTH_OPEN_Y: i / 20, PARAM_MOUTH_FORM_01: -.7, PARAM_BROW_L_Y: i / 20 });
  driver.dispose();
});

test('the same controls produce the same result after different previous expressions', () => {
  const f = fixture(['face_main_mouth_fun', 'face_main_mouth_serious']);
  const driver = createExpressionAdapter(f.context);
  const controls = { PARAM_MOUTH_FORM_01: -.45, PARAM_MOUTH_OPEN_Y: .35, PARAM_BROW_L_Y: .6, PARAM_EYE_R_OPEN: .4 };
  driver.apply(controls);
  const expected = [...f.mesh.morphTargetInfluences];
  driver.apply({ PARAM_MOUTH_FORM_01: 1, PARAM_MOUTH_OPEN_Y: 1, PARAM_EYE_L_SMILE: 1, PARAM_BROW_L_ANGLE: -1 });
  driver.apply(controls);
  assert.deepEqual(f.mesh.morphTargetInfluences, expected);
  driver.dispose();
});

test('native Morph underlay, unrelated decorations and shared geometry survive lifecycle', () => {
  const f = fixture();
  const other = new THREE.Mesh(f.geometry, f.mesh.material);
  f.mesh.morphTargetInfluences.fill(0.27);
  other.morphTargetInfluences.fill(0.61);
  const baseline = [...f.mesh.morphTargetInfluences];
  const geometryValues = [...f.geometry.attributes.position.array];
  const driver = createExpressionAdapter(f.context);
  driver.apply({ PARAM_MOUTH_OPEN_Y: 1 });
  assert.equal(f.weight('decoration'), 0.27);
  assert.deepEqual(other.morphTargetInfluences, namesFilled(other, 0.61));
  driver.restore();
  assert.deepEqual(f.mesh.morphTargetInfluences, baseline);
  // The host can update the native state between restore and apply.
  f.mesh.morphTargetInfluences[0] = 0.83;
  driver.apply({ PARAM_EYE_L_OPEN: 0 });
  driver.apply({ PARAM_EYE_L_OPEN: 0 });
  driver.dispose();
  assert.equal(f.mesh.morphTargetInfluences[0], 0.83);
  assert.equal(f.mesh.geometry, f.geometry);
  assert.deepEqual([...f.geometry.attributes.position.array], geometryValues);
  assert.throws(() => driver.apply({}), /disposed/);
});

function namesFilled(mesh, value) {
  return Array(mesh.morphTargetInfluences.length).fill(value);
}

test('source recipes are native data, while parameter controls use actual Morph units', () => {
  const f = fixture(['face_main_mouth_serious']);
  f.part.component.morphPoses.find(p => p.targets.face.face_main_mouth_open_a !== undefined).targets.face.face_main_mouth_open_a = 0;
  const original = JSON.stringify(f.part.component.morphPoses);
  const driver = createExpressionAdapter(f.context);
  driver.apply({ PARAM_MOUTH_OPEN_Y: 1 });
  assert.equal(f.weight('face_main_mouth_open_a'), 1);
  assert.equal(JSON.stringify(f.part.component.morphPoses), original);
  driver.dispose();
});

test('available Morph bindings remain usable without a complete native preset collection', () => {
  const f = fixture();
  f.part.component.morphPoses = [];
  const driver = createExpressionAdapter(f.context);
  driver.apply({ PARAM_EYE_L_OPEN: 0.25, PARAM_MOUTH_OPEN_Y: 0.7 });
  assert.ok(Math.abs(f.weight('face_main_eye_close_L') - 0.75) < 1e-12);
  assert.ok(f.weight('face_main_mouth_open_a') > 0);
  driver.dispose();
  f.part.component.motionGroup = 'other';
  assert.equal(createExpressionAdapter(f.context), null);
});

test('different native recipes may reference the same Morph with different gains', () => {
  const f = fixture();
  f.part.component.morphPoses.push({name:'source.otherRoute',targets:{face:{face_main_mouth_open_a:.3}}});
  const original=JSON.stringify(f.part.component.morphPoses);
  const driver=createExpressionAdapter(f.context);
  driver.apply({PARAM_MOUTH_OPEN_Y:.6});
  assert.ok(f.weight('face_main_mouth_open_a')>0);
  driver.dispose();
  assert.equal(JSON.stringify(f.part.component.morphPoses),original);
});

test('native avatar semantic group drives a new head independently from its resource identity', () => {
  const f = fixture(['face_main_mouth_serious', 'face_main_mouth_angry']);
  f.part.component.name = 'a newly authored costume';
  f.part.component.defaultMotion = 'unrelated/path';
  f.part.component.behaviors = [{ name: 'Garupa.AvatarScaler', parameters: { profile: { id: 39 } } }];
  f.geometry.attributes.position.setX(0, .002);
  const driver = createExpressionAdapter(f.context);
  assert.equal(driver.capabilities.characterId, 39);
  driver.apply({ PARAM_MOUTH_FORM_01: -1/3, PARAM_MOUTH_OPEN_Y: 0 });
  assert.equal(f.weight('face_main_mouth_serious'), .5);
  driver.apply({ PARAM_MOUTH_FORM_01: -1, PARAM_MOUTH_OPEN_Y: 1 });
  assert.ok(f.weight('face_main_mouth_angry') > 0);
  assert.equal(f.weight('face_main_mouth_open_o'), 0);
  driver.dispose();
});

test('invalid input leaves cached controls usable for the following valid update', () => {
  const f = fixture();
  const driver = createExpressionAdapter(f.context);
  driver.apply({ PARAM_EYE_L_OPEN: 0.5 });
  const visible = [...f.mesh.morphTargetInfluences];
  assert.throws(() => driver.apply({ PARAM_EYE_L_OPEN: 0.2, PARAM_EYE_HIGHLIGHT: NaN }), /Non-finite/);
  assert.deepEqual(f.mesh.morphTargetInfluences, visible);
  driver.apply({ PARAM_EYE_L_OPEN: 0.2 });
  assert.equal(f.weight('face_main_eye_close_L'), 0.8);
});

test('source node resolution survives sanitized names and composition moving eye nodes', () => {
  const f = fixture();
  const nodes = new Map();
  f.root.traverse((node) => nodes.set(node.name, node));
  f.context.resolveNode = (role, name) => nodes.get(name);
  f.mesh.name = 'sanitized_display_name';
  const composedRoot = new THREE.Group();
  for (const child of [...f.root.children]) {
    if (child.isBone) {
      composedRoot.add(child);
    }
  }
  f.context.root = composedRoot;
  const driver = createExpressionAdapter(f.context);
  driver.apply({ PARAM_EYE_L_OPEN: 0.6, PARAM_EYE_BALL_X: 0.7 });
  assert.equal(f.weight('face_main_eye_close_L'), 0.4);
  assert.ok(nodes.get('LEye_0_0').quaternion.angleTo(new THREE.Quaternion()) > 0.05);
  driver.dispose();
  assert.equal(nodes.get('LEye_0_0').quaternion.angleTo(new THREE.Quaternion()), 0);
});

test('additional pass meshes beneath a marked group retain renderer ownership', () => {
  const f = fixture();
  const group = new THREE.Group();
  group.userData.__parameterizedPassObject = true;
  const passMesh = new THREE.Mesh(f.geometry, f.mesh.material);
  passMesh.name = 'pass';
  passMesh.morphTargetInfluences.fill(0.42);
  group.add(passMesh);
  f.mesh.add(group);
  const driver = createExpressionAdapter(f.context);
  driver.apply({ PARAM_MOUTH_OPEN_Y: 0.5 });
  assert.deepEqual(passMesh.morphTargetInfluences, namesFilled(passMesh, 0.42));
  driver.dispose();
});

test('gaze and highlight overlays restore native rotations and nonuniform scales exactly', () => {
  const f = fixture();
  const eye = f.root.getObjectByName('LEye_0_0');
  eye.rotation.set(0.07, -0.04, 0.02);
  const iris = f.root.getObjectByName('LEye_0_1');
  iris.scale.set(1.1, 0.9, 1.3);
  const highlight = f.root.getObjectByName('LEye_Hilight_1_1');
  highlight.scale.set(0.3, 0.4, 0.5);
  const originalRotation = eye.quaternion.toArray();
  const originalScale = iris.scale.toArray();
  const originalHighlight = highlight.scale.toArray();
  const driver = createExpressionAdapter(f.context);
  driver.apply({ PARAM_EYE_BALL_X: 0.4, PARAM_EYE_BALL_Y: -0.7, PARAM_EYE_SCALE: 0.5, PARAM_EYE_HIGHLIGHT: 0.8 });
  assert.notDeepEqual(eye.quaternion.toArray(), originalRotation);
  assert.notDeepEqual(highlight.scale.toArray(), originalHighlight);
  driver.restore();
  assert.deepEqual(eye.quaternion.toArray(), originalRotation);
  assert.deepEqual(iris.scale.toArray(), originalScale);
  assert.deepEqual(highlight.scale.toArray(), originalHighlight);
  driver.dispose();
});

test('enabling gaze during head motion retains face-relative axes with a nontrivial neutral bone frame', () => {
  const f = fixture();
  const head = f.root.getObjectByName('Head');
  const neutral = new THREE.Quaternion(-0.5, 0.5, -0.5, 0.5);
  f.part.gltf.parser.json.nodes[0].rotation = neutral.toArray();
  const pose = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2);
  head.quaternion.copy(pose).multiply(neutral);
  const driver = createExpressionAdapter(f.context);
  const binding = driver.eyes.bindings[0];
  const parentWorld = binding.pivot.parent.getWorldQuaternion(new THREE.Quaternion());
  const actualWorldPitch = binding.vertical.clone().applyQuaternion(parentWorld);
  const expectedWorldPitch = new THREE.Vector3(-1, 0, 0).applyQuaternion(pose);
  assert.ok(actualWorldPitch.distanceTo(expectedWorldPitch) < 1e-10);
  driver.apply({ PARAM_EYE_BALL_Y: 0.7 });
  assert.ok(binding.pivot.quaternion.angleTo(binding.rotation) > 0.05);
  driver.dispose();
});

test('highlight gaze is inherited once while highlight scale remains independent of iris scale', () => {
  const f = fixture();
  const driver = createExpressionAdapter(f.context);
  const highlight = f.root.getObjectByName('LEye_Hilight_1_0');
  const baseline = highlight.quaternion.toArray();
  driver.apply({ PARAM_EYE_BALL_X: 0.6, PARAM_EYE_BALL_Y: -0.4, PARAM_EYE_HIGHLIGHT: 0.8, PARAM_EYE_SCALE: 0.7 });
  assert.deepEqual(highlight.quaternion.toArray(), baseline);
  const eyeWorld = f.root.getObjectByName('LEye_0_0').getWorldQuaternion(new THREE.Quaternion());
  assert.ok(highlight.getWorldQuaternion(new THREE.Quaternion()).angleTo(eyeWorld) < 1e-8);
  assert.equal(driver.eyes.bindings.filter((binding) => binding.gazeRoot).length, 2);
  assert.ok(Math.abs(f.root.getObjectByName('LEye_Hilight_1_1').scale.x - 1.104) < 1e-12);
  driver.dispose();
});
