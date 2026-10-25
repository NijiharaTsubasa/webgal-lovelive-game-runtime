import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createExpressionAdapter } from '../packages/garupa_runtime/adapters/garupa-live2d-face.js';
import { mouthOpening } from '../packages/garupa_runtime/adapters/garupa-mouth-opening.js';

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

test('independent eyelids and smile closure share a single closure budget', () => {
  const f = fixture();
  const driver = createExpressionAdapter(f.context);
  driver.apply({ PARAM_EYE_L_OPEN: 0.4, PARAM_EYE_R_OPEN: 0.7, PARAM_EYE_L_SMILE: 0.25 });
  assert.ok(Math.abs(f.weight('face_main_eye_close_L') - 0.45) < 1e-12);
  assert.ok(Math.abs(f.weight('face_main_eye_wink_L') - 0.15) < 1e-12);
  assert.ok(Math.abs(f.weight('face_main_eye_close_R') - 0.3) < 1e-12);
  assert.ok(Math.abs(f.weight('face_main_eye_joy_L') - 0.1) < 1e-12);
});

test('closed positive and negative forms use the authored Joy and Serious contours', () => {
  const f = fixture(['face_main_mouth_serious']);
  const driver = createExpressionAdapter(f.context);
  driver.apply({ PARAM_MOUTH_FORM_01: 0.5, PARAM_MOUTH_OPEN_Y: 0 });
  assert.equal(f.weight('face_main_mouth_joy'), 0.8);
  assert.equal(f.weight('face_main_mouth_serious'), 0);
  assert.equal(f.weight('face_main_mouth_open_a'), 0);
  driver.apply({ PARAM_MOUTH_FORM_01: -0.5, PARAM_MOUTH_OPEN_Y: 0 });
  assert.equal(f.weight('face_main_mouth_serious'), 0.8);
  assert.equal(f.weight('face_main_mouth_joy'), 0);
  assert.equal(f.weight('face_main_mouth_open_o'), 0);
  driver.apply({ PARAM_MOUTH_FORM_01: 0 });
  assert.equal(f.weight('face_main_mouth_serious'), 0);
  assert.equal(f.weight('face_main_mouth_joy'), 0);
});

test('closed contours occupy the remaining mouth budget without changing open contour weights', () => {
  const f = fixture(['face_main_mouth_fun', 'face_main_mouth_angry', 'face_main_mouth_serious']);
  const driver = createExpressionAdapter(f.context);
  for (const form of [-1, -0.5, 0.25, 0.5, 1]) {
    for (let step = 0; step <= 100; step++) {
      const open = step / 100;
      driver.apply({ PARAM_MOUTH_FORM_01: form, PARAM_MOUTH_OPEN_Y: open });
      const opening = mouthOpening(open, form, 0);
      const negative = Math.min(1, Math.max(0, -form) * 2);
      const expectedOpen = opening * (1 - negative) + Math.max(opening, open * Math.max(0, -form)) * negative;
      const amount = Math.min(1, Math.abs(form) * 2);
      const expectedClosed = (1 - expectedOpen) * amount * 0.8;
      const closed = f.weight(form > 0 ? 'face_main_mouth_joy' : 'face_main_mouth_serious');
      assert.ok(Math.abs(closed - expectedClosed) < 1e-12);
      assert.ok(Math.abs(f.weight('face_main_mouth_fun') + f.weight('face_main_mouth_angry') - expectedOpen * 0.8) < 1e-12);
      assert.ok(closed + expectedOpen * 0.8 <= 0.8 + 1e-12);
    }
  }
});

test('a disabled authored closed contour stays neutral instead of activating another opening shape', () => {
  const f = fixture(['face_main_mouth_serious']);
  const serious = f.part.component.morphPoses.find((pose) => pose.targets.face.face_main_mouth_serious !== undefined);
  serious.targets.face.face_main_mouth_serious = 0;
  const driver = createExpressionAdapter(f.context);
  driver.apply({ PARAM_MOUTH_FORM_01: -1, PARAM_MOUTH_OPEN_Y: 0 });
  for (const name of Object.keys(f.mesh.morphTargetDictionary).filter((name) => name.includes('mouth'))) {
    assert.equal(f.weight(name), 0);
  }
});

test('an opening Joy or Serious target cannot be selected as a closed-mouth contour', () => {
  const f = fixture(['face_main_mouth_serious']);
  const attribute = (name) => f.geometry.morphAttributes.position[f.mesh.morphTargetDictionary[name]];
  attribute('face_main_mouth_joy').array.set([0, 0.001, 0]);
  attribute('face_main_mouth_serious').array.set([0, 0.001, 0]);
  attribute('face_main_mouth_smile').array.set([0.001, 0, 0]);
  attribute('face_main_mouth_sad').array.set([0.001, 0, 0]);
  const driver = createExpressionAdapter(f.context);
  for (const target of f.geometry.morphAttributes.position) {
    target.getX = target.getY = target.getZ = () => { throw new Error('Per-frame closed-mouth vertex scan'); };
  }
  driver.apply({ PARAM_MOUTH_OPEN_Y: 0, PARAM_MOUTH_FORM_01: 1 });
  assert.equal(f.weight('face_main_mouth_joy'), 0);
  assert.equal(f.weight('face_main_mouth_smile'), 0.8);
  driver.apply({ PARAM_MOUTH_OPEN_Y: 0, PARAM_MOUTH_FORM_01: -1 });
  assert.equal(f.weight('face_main_mouth_serious'), 0);
  assert.equal(f.weight('face_main_mouth_sad'), 0.8);
  assert.equal(f.weight('face_main_mouth_open_a'), 0);
});

test('mouth uses actual source range and closes without leaving smile residue', () => {
  const f = fixture();
  const driver = createExpressionAdapter(f.context);
  driver.apply({ PARAM_MOUTH_OPEN_Y: 0.6, PARAM_MOUTH_FORM_01: 0.5 });
  assert.equal(f.weight('face_main_mouth_open_a'), mouthOpening(0.6, 0.5, 0) * 0.8);
  assert.ok(Math.abs(f.weight('face_main_mouth_joy') - (1 - mouthOpening(0.6, 0.5, 0)) * 0.8) < 1e-12);
  assert.equal(f.weight('face_main_mouth_smile'), 0);
  driver.apply({});
  assert.equal(f.weight('face_main_mouth_open_a'), 0);
  assert.equal(f.weight('face_main_mouth_joy'), 0);
  assert.equal(f.weight('face_main_mouth_smile'), 0);
});

test('positive form does not turn a closed source smile into an open native grin', () => {
  const f = fixture();
  const driver = createExpressionAdapter(f.context);
  driver.apply({ PARAM_MOUTH_FORM_01: 0.83, PARAM_MOUTH_OPEN_Y: 0 });
  for (const name of ['face_main_mouth_open_a', 'face_main_mouth_open_o', 'face_main_mouth_smile']) {
    assert.equal(f.weight(name), 0);
  }
  assert.equal(f.weight('face_main_mouth_joy'), 0.8);
  assert.equal(driver.eyes.active, false);
  driver.dispose();
});

test('closed input clears opening channels and keeps only authored closed contours over a native open underlay', () => {
  const f = fixture(['face_main_mouth_fun', 'face_main_mouth_angry', 'face_main_mouth_serious']);
  f.mesh.morphTargetInfluences.fill(0.7);
  const baseline = [...f.mesh.morphTargetInfluences];
  const driver = createExpressionAdapter(f.context);
  for (const form of [-1, -0.75, -0.5, -0.1, 0, 0.25, 0.5, 1]) {
    for (const scale of [-1, 0, 1]) {
      driver.apply({ PARAM_MOUTH_OPEN_Y: 0, PARAM_MOUTH_FORM_01: form, PARAM_MOUTH_SCALE: scale });
      for (const name of Object.keys(f.mesh.morphTargetDictionary).filter((name) => name.includes('mouth'))) {
        const expected = name.endsWith('_joy') ? Math.min(1, Math.max(0, form) * 2) * 0.8
          : name.endsWith('_serious') ? Math.min(1, Math.max(0, -form) * 2) * 0.8 : 0;
        assert.equal(f.weight(name), expected, `${name}, FORM=${form}, SCALE=${scale}`);
      }
    }
  }
  driver.dispose();
  assert.deepEqual(f.mesh.morphTargetInfluences, baseline);
});

test('open contours blend native Fun and Angry while keeping a bounded opening budget', () => {
  const f = fixture(['face_main_mouth_fun', 'face_main_mouth_angry']);
  const driver = createExpressionAdapter(f.context);
  for (const form of [-1, -0.5, -0.25, 0, 0.5, 1]) {
    driver.apply({ PARAM_MOUTH_OPEN_Y: 0.7, PARAM_MOUTH_FORM_01: form });
    const opening = mouthOpening(0.7, form, 0);
    const negative = Math.min(1, Math.max(0, -form) * 2);
    const expected = (opening * (1 - negative) + Math.max(opening, 0.7 * Math.max(0, -form)) * negative) * 0.8;
    assert.ok(Math.abs(f.weight('face_main_mouth_fun') + f.weight('face_main_mouth_angry') - expected) < 1e-12);
    assert.equal(f.weight('face_main_mouth_open_a'), 0);
    assert.equal(f.weight('face_main_mouth_open_o'), 0);
  }
  driver.dispose();
});

test('a candidate with little authored opening motion uses a vowel fallback without rescanning each frame', () => {
  const f = fixture(['face_main_mouth_fun', 'face_main_mouth_angry']);
  const attributes = f.geometry.morphAttributes.position;
  attributes[f.mesh.morphTargetDictionary.face_main_mouth_fun].array.fill(0);
  attributes[f.mesh.morphTargetDictionary.face_main_mouth_angry].array.fill(0);
  const driver = createExpressionAdapter(f.context);
  for (const attribute of attributes) {
    attribute.getX = attribute.getY = attribute.getZ = () => { throw new Error('Per-frame vertex scan'); };
  }
  driver.apply({ PARAM_MOUTH_OPEN_Y: 0.5, PARAM_MOUTH_FORM_01: 0.5 });
  assert.equal(f.weight('face_main_mouth_open_a'), mouthOpening(0.5, 0.5, 0) * 0.8);
  driver.apply({ PARAM_MOUTH_OPEN_Y: 0.5, PARAM_MOUTH_FORM_01: -1 });
  assert.equal(f.weight('face_main_mouth_open_o'), 0.5 * 0.8);
  assert.equal(f.weight('face_main_mouth_fun'), 0);
  assert.equal(f.weight('face_main_mouth_angry'), 0);
  driver.dispose();
});

test('round mouths retain scale control and their native maximum at full negative form', () => {
  const f = fixture(['face_main_mouth_fun', 'face_main_mouth_angry']);
  const driver = createExpressionAdapter(f.context);
  driver.apply({ PARAM_MOUTH_OPEN_Y: 1, PARAM_MOUTH_FORM_01: -1, PARAM_MOUTH_SCALE: -1 });
  const small = f.weight('face_main_mouth_angry');
  assert.ok(small > 0 && small < 0.8);
  driver.apply({ PARAM_MOUTH_OPEN_Y: 1, PARAM_MOUTH_FORM_01: -1, PARAM_MOUTH_SCALE: 1 });
  assert.equal(f.weight('face_main_mouth_angry'), 0.8);
  driver.dispose();
});

test('the final mixed mouth opening is monotone and bounded across forms and scales', () => {
  const f = fixture(['face_main_mouth_fun', 'face_main_mouth_angry']);
  const driver = createExpressionAdapter(f.context);
  for (const form of [-1, -0.75, -0.5, -0.25, 0, 0.25, 0.5, 1]) {
    for (const scale of [-1, 0, 1]) {
      let previous = 0;
      for (let step = 0; step <= 100; step++) {
        driver.apply({ PARAM_MOUTH_OPEN_Y: step / 100, PARAM_MOUTH_FORM_01: form, PARAM_MOUTH_SCALE: scale });
        const total = f.weight('face_main_mouth_fun') + f.weight('face_main_mouth_angry');
        assert.ok(total >= previous - 1e-12 && total <= 0.8 + 1e-12);
        previous = total;
      }
    }
  }
  driver.dispose();
});

test('opening remains continuous, monotone and within the model range at every form and size', () => {
  for (const form of [-1, -0.73, -0.5, -0.1, 0, 0.31, 0.5, 1]) {
    for (const scale of [-1, 0, 1]) {
      let previous = 0;
      for (let step = 0; step <= 100; step++) {
        const value = mouthOpening(step / 100, form, scale);
        assert.ok(value >= previous && value <= 1);
        assert.ok(value - previous < 0.06);
        previous = value;
      }
    }
  }
  assert.ok(Math.abs(mouthOpening(0.5, 0, 0) - 0.5) < 0.002);
  assert.ok(mouthOpening(0.5, 0, -1) < mouthOpening(0.5, 0, 1));
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

test('source channel omitted by native presets is still bindable; zero source range stays zero', () => {
  const f = fixture();
  f.part.component.morphPoses[4].targets.face.face_main_mouth_open_a = 0;
  f.part.component.morphPoses.push({ name: 'face.Joy', targets: {} });
  const driver = createExpressionAdapter(f.context);
  driver.apply({ PARAM_MOUTH_OPEN_Y: 1, PARAM_EYE_L_SMILE: 0.6 });
  assert.equal(f.weight('face_main_mouth_open_a'), 0);
  assert.equal(f.weight('face_main_eye_joy_L'), 0.6);
});

test('malformed or missing atom bindings fail visibly rather than guessing model capabilities', () => {
  const f = fixture();
  f.part.component.morphPoses.splice(0, 1);
  assert.throws(() => createExpressionAdapter(f.context), /Missing Garupa source Morph/);
  f.part.component.motionGroup = 'other';
  assert.equal(createExpressionAdapter(f.context), null);
});

test('composition cannot hide missing atomic metadata by emptying the original component root', () => {
  const f = fixture();
  f.part.component.morphPoses = [{ name: 'face.Native', targets: { face: { face_main_eye_close_L: 1 } } }];
  f.root.clear();
  assert.throws(() => createExpressionAdapter(f.context), /regenerate the model package/);
});

test('finite signed source Morph ranges are preserved rather than clipped', () => {
  const f = fixture();
  f.part.component.morphPoses[0].targets.face.face_main_eye_close_L = -0.4;
  const driver = createExpressionAdapter(f.context);
  driver.apply({ PARAM_EYE_L_OPEN: 0.25 });
  assert.ok(Math.abs(f.weight('face_main_eye_close_L') + 0.3) < 1e-12);
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
