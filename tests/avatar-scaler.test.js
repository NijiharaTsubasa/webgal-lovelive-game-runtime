import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";

import AvatarScaler from "../packages/garupa_runtime/behaviors/avatar-scaler.js";
import { MotionPlayer } from "webgal-lovelive-gltf-renderer/motion-player.js";

function node(name, position = [0, 0, 0], scale = [1, 1, 1]) {
  const result = new THREE.Object3D();
  result.name = name;
  result.userData.name = name;
  result.position.fromArray(position);
  result.scale.fromArray(scale);
  return result;
}

const IDENTITY_MATRIX = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

function secondaryOffset({ target, useRotation, defaultValue, axis, range }) {
  return {
    target,
    useRotation,
    default: defaultValue,
    axis,
    range,
    source: {
      position: [0, 0, 0],
      rotation: [0, 0, 0, 1],
      scale: [1, 1, 1],
    },
    projection: { left: IDENTITY_MATRIX, right: IDENTITY_MATRIX },
  };
}

function fixture({ useScaling = true, partName = "Part", targetPosition = [0, 1, 0] } = {}) {
  const root = node("Root");
  const nodes = new Map();
  const add = (value, parent = root) => {
    parent.add(value);
    nodes.set(value.name, value);
    return value;
  };
  const hips = add(node("Hips", [0, 1, 0]));
  const hipChild = add(node("HipChild", [0, 0.5, 0]), hips);
  add(node("UpperLeg", [0.2, 0, 0]), hips);
  add(node("RightUpperLeg", [-0.2, 0, 0]), hips);
  const leftUpperLeg = add(node("LeftUpperLeg", [0.2, -0.1, 0]), hips);
  const leftLowerLeg = add(node("LeftLowerLeg", [0, -0.5, 0]), leftUpperLeg);
  add(node("LeftFoot", [0, -0.4, 0]), leftLowerLeg);
  add(node("Shoulder", [0.3, 0, 0]), hips);
  add(node("RightShoulder", [-0.3, 0, 0]), hips);
  add(node("Head"), hips);
  const segmentStart = add(node("SegmentStart", [0.4, 0.25, -0.1]), hips);
  add(node("SegmentEnd", targetPosition), segmentStart);
  add(node("Accessory", [0.1, 0.2, 0.3], [2, 2, 2]), hips);
  const bodyRenderer = add(node("BodyRenderer"), hips);
  bodyRenderer.morphTargetInfluences = [0, 0, 0.25];
  let humanoidScale = 0.9;
  const indexedNodes = new Map([...nodes].map(([name, value]) => [name, [value]]));
  const declarations = [
    {
      role: "head",
      parameters: {
        profile: {
          height: 1.705,
          legSpacing: 0.5,
          headScaling: 0.5,
          hipScaling: 0.9,
          shoulderSpacing: 1.25,
          boneSettings: [{
            name: partName,
            heightInfluence: 0.5,
            length: -2,
            thickness: 3,
          }],
        },
      },
    },
    {
      role: "body",
      parameters: {
        binding: {
          useScaling,
          legSpacing: 1.2,
          hipScaling: 1.1,
          shoulderSpacing: 0.8,
          upperLegs: ["UpperLeg", "RightUpperLeg"],
          shoulders: ["Shoulder", "RightShoulder"],
          shoulderFrames: [
            { sourcePosition: [-0.3, 0, 0], projection: IDENTITY_MATRIX },
            { sourcePosition: [0.3, 0, 0], projection: IDENTITY_MATRIX },
          ],
          head: "Head",
          hip: "Hips",
          leftLeg: ["LeftUpperLeg", "LeftLowerLeg", "LeftFoot"],
          accessories: ["Accessory"],
          breast: {
            defaultValue: 50,
            blendShapeMax: [100, 100],
            renderers: [{
              target: "BodyRenderer",
              morphs: [{ value: 0, index: 0 }, { value: 100, index: 1 }],
            }],
          },
          boneParts: [{
            name: partName,
            heightInfluence: 0.2,
            length: 4,
            thickness: 5,
            bones: ["SegmentStart"],
            targets: ["SegmentEnd"],
            boneFrames: [{
              source: {
                position: [0, 0, 0],
                rotation: [0, 0, 0, 1],
                scale: [1, 1, 1],
              },
              projection: { left: IDENTITY_MATRIX, right: IDENTITY_MATRIX },
            }],
            targetFrames: partName === "Feets" ? [{
              source: {
                position: [-targetPosition[0], targetPosition[1], targetPosition[2]],
                rotation: [0, 0, 0, 1],
                scale: [1, 1, 1],
              },
              projection: { left: IDENTITY_MATRIX, right: IDENTITY_MATRIX },
            }] : [],
          }],
        },
      },
    },
  ];
  const behavior = new AvatarScaler({
    THREE,
    root,
    parts: [{ role: "body", nodesByName: indexedNodes }],
    resolveNode(role, name) {
      assert.equal(role, "body");
      const result = nodes.get(name);
      if (!result) throw new Error(`missing ${name}`);
      return result;
    },
    getHumanoidScale: () => humanoidScale,
    setHumanoidScale: (value) => { humanoidScale = value; },
  }, declarations);
  return {
    behavior, root, nodes, indexedNodes, hips, hipChild, getScale: () => humanoidScale,
  };
}

test("AvatarScaler merges head profile into body bindings and applies static transforms", () => {
  const { behavior, nodes, indexedNodes, hipChild, hips, getScale } = fixture();
  const segmentStart = nodes.get("SegmentStart");
  const segmentEnd = nodes.get("SegmentEnd");
  const targetWorldBefore = segmentEnd.getWorldPosition(new THREE.Vector3());
  behavior.Awake();

  assert.ok(Math.abs(segmentEnd.position.length() - 1.0775) < 1e-9);
  assert.deepEqual(new THREE.Vector3().setFromMatrixScale(segmentStart.matrix)
    .toArray().map((v) => Number(v.toFixed(6))), [
    7.272727, 16.5, 16.5,
  ]);
  assert.deepEqual(segmentEnd.scale.toArray(), [1, 1, 1]);
  assert.equal(segmentStart.parent.name, "SegmentStart");
  assert.equal(segmentStart.name, "SegmentStart$AvatarScalerScaled");
  assert.equal(indexedNodes.get("SegmentStart")[0], segmentStart.parent);
  assert.equal(indexedNodes.get("SegmentStart$AvatarScalerScaled")[0], segmentStart);
  assert.equal(segmentEnd.parent, segmentStart.parent);
  assert.ok(segmentEnd.getWorldPosition(new THREE.Vector3()).distanceTo(targetWorldBefore) > 0);
  assert.ok(Math.abs(nodes.get("UpperLeg").position.x - 0.132) < 1e-9);
  assert.ok(Math.abs(nodes.get("Shoulder").position.x - 0.33) < 1e-9);
  assert.deepEqual(nodes.get("Head").scale.toArray(), [1.05, 1.05, 1.05]);
  assert.ok(Math.abs(new THREE.Vector3().setFromMatrixScale(nodes.get("Hips").matrix).x - 1.089) < 1e-9);
  assert.equal(hipChild.parent, hips.parent);
  assert.deepEqual(hipChild.scale.toArray(), [1, 1, 1]);
  assert.deepEqual(nodes.get("Accessory").position.toArray().map((v) => Number(v.toFixed(6))), [0.11, 0.22, 0.33]);
  assert.deepEqual(nodes.get("Accessory").scale.toArray(), [1.1, 1.1, 1.1]);
  assert.ok(Math.abs(getScale() - 0.99) < 1e-9);
});

test("AvatarScaler leaves bone and hip scale untouched when their effective controls are zero", () => {
  const { behavior, nodes, hips } = fixture();
  behavior.profile.boneSettings[0].length = 0;
  behavior.profile.boneSettings[0].thickness = 0;
  behavior.profile.hipScaling = 0;
  behavior.Awake();

  assert.deepEqual(nodes.get("SegmentStart").scale.toArray(), [1, 1, 1]);
  assert.equal(nodes.get("SegmentStart").parent, hips);
  assert.deepEqual(hips.scale.toArray(), [1, 1, 1]);
  assert.equal(hips.parent.name, "Root");
});

test("AvatarScaler raises the hips by the measured change in the left leg chain", () => {
  const { behavior, hips } = fixture({ partName: "Upper Legs", targetPosition: [0, 1, 0] });
  behavior.binding.boneParts[0].bones = ["LeftUpperLeg"];
  behavior.binding.boneParts[0].targets = ["LeftLowerLeg"];
  const before = hips.position.y;
  behavior.Awake();
  assert.ok(Math.abs(behavior.hips.position.y - (before + 0.0775)) < 1e-9);
});

test("AvatarScaler applies the reverse-engineered breast secondary endpoint", () => {
  const { behavior, nodes } = fixture();
  const secondary = nodes.get("Accessory");
  const rotational = nodes.get("HipChild");
  const expectedRotation = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(0, -1, 0), Math.PI / 3,
  );
  behavior.profile.breastSize = 100;
  behavior.binding.secondaryOffsets = [
    secondaryOffset({
      target: "Accessory", useRotation: false,
      defaultValue: [-0.1, 0.21, 0.3], axis: [0, 1, 0], range: [0.01, -0.02],
    }),
    secondaryOffset({
      target: "HipChild", useRotation: true,
      defaultValue: [0, 0, 0], axis: [0, 1, 0], range: [0, 60],
    }),
  ];
  behavior.Awake();
  assert.deepEqual(secondary.position.toArray().map((value) => Number(value.toFixed(6))), [
    0.1, 0.19, 0.3,
  ]);
  assert.ok(
    rotational.quaternion.angleTo(expectedRotation) < 1e-7,
    JSON.stringify(rotational.quaternion.toArray()),
  );
  assert.deepEqual(nodes.get("BodyRenderer").morphTargetInfluences, [0, 1, 0.25]);
});

test("AvatarScaler expresses source-axis bone scale through the canonical seam", () => {
  const { behavior, nodes } = fixture();
  const projectionRight = new THREE.Matrix4()
    .makeRotationZ(Math.PI / 2)
    .toArray();
  behavior.binding.boneParts[0].boneFrames = [{
    source: {
      position: [0, 0, 0],
      rotation: [0, 0, 0, 1],
      scale: [1, 1, 1],
    },
    projection: { left: IDENTITY_MATRIX, right: projectionRight },
  }];

  behavior.Awake();

  const scaledBone = nodes.get("SegmentStart");
  const expected = new THREE.Matrix4().makeScale(16.5, 8 / 1.1, 16.5);
  assert.equal(scaledBone.matrixAutoUpdate, false);
  assert.ok(
    scaledBone.matrix.elements.every(
      (value, index) => Math.abs(value - expected.elements[index]) < 1e-9,
    ),
    JSON.stringify(scaledBone.matrix.elements),
  );
});

test("AvatarScaler preserves world dimensions with nonidentity joint frames", () => {
  const baseline = fixture();
  const framed = fixture();
  const basis = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.31, -0.47, 0.22));
  const reframe = (bone) => {
    framed.root.updateMatrixWorld(true);
    const children = bone.children.map((child) => [child, child.matrixWorld.clone()]);
    bone.quaternion.copy(basis);
    framed.root.updateMatrixWorld(true);
    const inverse = bone.matrixWorld.clone().invert();
    for (const [child, previousWorld] of children) {
      inverse.clone().multiply(previousWorld).decompose(child.position, child.quaternion, child.scale);
    }
    framed.root.updateMatrixWorld(true);
  };
  for (const name of ["SegmentStart", "LeftUpperLeg", "LeftLowerLeg", "Head"]) {
    reframe(framed.nodes.get(name));
  }
  const chestFrame = new THREE.Object3D();
  chestFrame.quaternion.copy(basis);
  framed.hips.add(chestFrame);
  framed.root.updateMatrixWorld(true);
  for (const name of ["Shoulder", "RightShoulder"]) chestFrame.attach(framed.nodes.get(name));
  for (const frame of framed.behavior.binding.shoulderFrames) {
    frame.projection = new THREE.Matrix4().makeRotationFromQuaternion(basis.clone().invert()).toArray();
  }
  framed.behavior.binding.boneParts[0].boneFrames[0].projection.right =
    new THREE.Matrix4().makeRotationFromQuaternion(basis).toArray();
  baseline.behavior.Awake();
  framed.behavior.Awake();

  for (const name of ["SegmentEnd", "LeftUpperLeg", "LeftLowerLeg", "LeftFoot", "UpperLeg", "RightUpperLeg", "Shoulder", "RightShoulder"]) {
    const expected = baseline.nodes.get(name).getWorldPosition(new THREE.Vector3());
    const actual = framed.nodes.get(name).getWorldPosition(new THREE.Vector3());
    assert.ok(actual.distanceTo(expected) < 1e-9, name);
  }
  assert.ok(framed.behavior.hips.position.distanceTo(baseline.behavior.hips.position) < 1e-9);
  const framedScale = framed.nodes.get("SegmentStart").matrix.clone();
  const basisMatrix = new THREE.Matrix4().makeRotationFromQuaternion(basis);
  const recoveredScale = basisMatrix.clone().multiply(framedScale).multiply(basisMatrix.clone().invert());
  const expectedScale = baseline.nodes.get("SegmentStart").matrix;
  assert.ok(recoveredScale.elements.every((value, index) => Math.abs(value - expectedScale.elements[index]) < 1e-9));
});

test("AvatarScaler projects only the source-X shoulder spacing delta", () => {
  const { behavior, nodes } = fixture();
  const projection = new THREE.Matrix4().makeRotationZ(Math.PI / 2).toArray();
  behavior.binding.shoulderFrames = [
    { sourcePosition: [-0.3, 0, 0], projection },
    { sourcePosition: [0.3, 0, 0], projection },
  ];

  behavior.Awake();

  assert.deepEqual(
    nodes.get("Shoulder").position.toArray().map((value) => Number(value.toFixed(9))),
    [0.3, 0.03, 0],
  );
  assert.deepEqual(
    nodes.get("RightShoulder").position.toArray().map((value) => Number(value.toFixed(9))),
    [-0.3, -0.03, 0],
  );
});

test("AvatarScaler reproduces all three UpdateBreasts default-size branches", () => {
  const cases = [
    { defaultValue: 0, breastSize: 0, expected: [0, 0, 0.25] },
    { defaultValue: 0, breastSize: 50, expected: [0.8, 0, 0.25] },
    { defaultValue: 0, breastSize: 100, expected: [0, 0.8, 0.25] },
    { defaultValue: 50, breastSize: 0, expected: [0.4, 0, 0.25] },
    { defaultValue: 50, breastSize: 50, expected: [0, 0, 0.25] },
    { defaultValue: 50, breastSize: 100, expected: [0, 0.8, 0.25] },
    { defaultValue: 100, breastSize: 0, expected: [0.4, 0, 0.25] },
    { defaultValue: 100, breastSize: 50, expected: [0, 0.8, 0.25] },
    { defaultValue: 100, breastSize: 100, expected: [0, 0, 0.25] },
  ];
  for (const item of cases) {
    const { behavior, nodes } = fixture();
    behavior.binding.breast.defaultValue = item.defaultValue;
    behavior.binding.breast.blendShapeMax = [40, 80];
    behavior.binding.breast.renderers[0].morphs = [0, 50, 100]
      .filter((value) => value !== behavior.binding.breast.defaultValue)
      .map((value, index) => ({ value, index }));
    behavior.profile.breastSize = item.breastSize;
    behavior.Awake();
    assert.deepEqual(
      nodes.get("BodyRenderer").morphTargetInfluences,
      item.expected,
      JSON.stringify(item),
    );
  }
});

test("AvatarScaler applies one Unity renderer breast binding to every glTF primitive", () => {
  const { behavior, nodes } = fixture();
  const rendererGroup = new THREE.Group();
  const primitiveA = new THREE.Mesh();
  const primitiveB = new THREE.Mesh();
  primitiveA.morphTargetInfluences = [0, 0];
  primitiveB.morphTargetInfluences = [0, 0];
  rendererGroup.add(primitiveA, primitiveB);
  nodes.set("BodyRenderer", rendererGroup);
  behavior.profile.breastSize = 0;

  behavior.Awake();

  assert.deepEqual(primitiveA.morphTargetInfluences, [1, 0]);
  assert.deepEqual(primitiveB.morphTargetInfluences, [1, 0]);
});

test("AvatarScaler preserves a finite numeric breast value in the recovered secondary formula", () => {
  const { behavior, nodes } = fixture();
  behavior.profile.breastSize = 75;
  behavior.binding.breast.blendShapeMax = [40, 80];
  behavior.binding.secondaryOffsets = [secondaryOffset({
      target: "Accessory", useRotation: false,
      defaultValue: [-0.1, 0.4, 0.3], axis: [0, 1, 0], range: [0, 0.5],
    }), secondaryOffset({
      target: "HipChild", useRotation: true,
      defaultValue: [10, 20, 30], axis: [1, 2, 3], range: [0, 10],
    })];

  behavior.Awake();

  assert.deepEqual(nodes.get("BodyRenderer").morphTargetInfluences, [0, 0.4, 0.25]);
  assert.deepEqual(
    nodes.get("Accessory").position.toArray().map((value) => Number(value.toFixed(6))),
    [0.1, 0.6, 0.3],
  );
  const expectedRotation = new THREE.Quaternion(
    0.1964460617780776,
    -0.18179330810988625,
    -0.31760639277172187,
    0.9096627491597544,
  );
  assert.ok(nodes.get("HipChild").quaternion.angleTo(expectedRotation) < 1e-7);
});

test("AvatarScaler animation compensation is stable across frames", () => {
  const { behavior, root } = fixture();
  behavior.Awake();
  const hips = behavior.hips;
  root.position.set(2, 0, 4);
  hips.position.set(0.5, 1.2, -0.25);

  behavior.LateUpdate();
  assert.deepEqual(root.position.toArray().map((v) => Number(v.toFixed(6))), [
    1.818182, 0, 3.636364,
  ]);
  assert.deepEqual(hips.position.toArray().map((v) => Number(v.toFixed(6))), [
    0.5, 1.181818, -0.25,
  ]);

  behavior.Update();
  behavior.LateUpdate();
  assert.deepEqual(root.position.toArray().map((v) => Number(v.toFixed(6))), [
    1.818182, 0, 3.636364,
  ]);
  assert.deepEqual(hips.position.toArray().map((v) => Number(v.toFixed(6))), [
    0.5, 1.181818, -0.25,
  ]);
});

test("AvatarScaler isolation exposes exactly one logical bone to shared motion", () => {
  const { behavior, root, nodes, getScale } = fixture();
  const reference = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.3, -0.6, 0.2));
  nodes.get("SegmentStart").quaternion.copy(reference);
  behavior.Awake();
  const delta = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), 0.4);
  const rotation = delta.toArray();
  const motion = {
    clips: [{
      id: "idle",
      duration: 1,
      sampleRate: 1,
      frames: 2,
      tracks: [{ bone: "SegmentStart", rotation: [...rotation, ...rotation] }],
    }],
    auxiliaryClips: [],
    leftHandPoses: [],
    rightHandPoses: [],
    program: {
      parameters: [],
      commands: {},
      baseLayer: "Base Layer",
      layers: [{
        id: "Base Layer",
        blend: "override",
        weight: 1,
        initialState: "idle",
        states: [{ id: "idle", clip: "idle", speed: 1, loop: true, transitions: [] }],
      }],
      poseSlots: [],
    },
  };

  const player = new MotionPlayer(root, getScale(), motion);
  const tracks = player.tracks.filter((track) => track.bone === "SegmentStart");
  assert.equal(tracks.length, 1);
  assert.equal(tracks[0].object.name, "SegmentStart");
  const expected = reference.clone().multiply(delta);
  const scaledMatrix = nodes.get("SegmentStart").matrix.clone();
  for (let frame = 0; frame < 3; frame += 1) {
    player.update(0.1);
    assert.ok(tracks[0].object.quaternion.angleTo(expected) < 1e-7);
    assert.ok(nodes.get("SegmentStart").matrix.equals(scaledMatrix));
  }
});

test("AvatarScaler Feets applies the fixed negative-X source formula before projection", () => {
  const { behavior, nodes } = fixture({
    partName: "Feets",
    targetPosition: [-1, 0.125, 0.25],
  });
  const target = nodes.get("SegmentEnd");
  const baseLength = target.position.length();
  const targetLength = baseLength + (1.705 - 1.55) * 0.5;
  behavior.binding.boneParts[0].targetFrames = [{
    source: {
      position: [1, 0.125, 0.25],
      rotation: [0, 0, 0, 1],
      scale: [1, 1, 1],
    },
    projection: { left: IDENTITY_MATRIX, right: IDENTITY_MATRIX },
  }];

  behavior.Awake();

  const expectedX = Math.sqrt(targetLength ** 2 - 0.125 ** 2);
  assert.ok(Math.abs(target.position.x - expectedX) < 1e-9);
  assert.equal(target.position.y, 0.125);
  assert.equal(target.position.z, 0.25);
});

test("AvatarScaler keeps the original arithmetic for a finite negative target length", () => {
  const { behavior, nodes } = fixture({ targetPosition: [0, 0.1, 0] });
  behavior.profile.height = 0.1;
  behavior.profile.boneSettings[0].length = 0;
  behavior.profile.boneSettings[0].thickness = 0;

  behavior.Awake();

  assert.ok(Math.abs(nodes.get("SegmentEnd").position.y - (-0.625)) < 1e-12);
});

test("AvatarScaler is a true no-op when body UseScaling is false", () => {
  const { behavior, nodes, root, getScale } = fixture({ useScaling: false });
  const before = nodes.get("SegmentEnd").position.clone();
  behavior.Awake();
  root.position.set(2, 0, 4);
  behavior.LateUpdate();
  assert.ok(nodes.get("SegmentEnd").position.equals(before));
  assert.equal(getScale(), 0.9);
  assert.deepEqual(root.position.toArray(), [2, 0, 4]);
  assert.equal(behavior.hips, undefined);
  behavior.Update();
  assert.deepEqual(root.position.toArray(), [2, 0, 4]);
});

test("AvatarScaler rejects incomplete cross-role declarations before mutation", () => {
  const context = {
    root: node("Root"),
    resolveNode() { throw new Error("must not resolve"); },
    getHumanoidScale: () => 1,
    setHumanoidScale() {},
  };
  assert.throws(() => new AvatarScaler(context, [{
    role: "head",
    parameters: { profile: { height: 1.55 } },
  }]), /body 角色/);
});

test("AvatarScaler rejects malformed strict bindings before mutation", () => {
  {
    const { behavior, nodes } = fixture();
    const before = nodes.get("SegmentEnd").position.clone();
    behavior.profile.height = 0;
    assert.throws(() => behavior.Awake(), /profile\.height 必须大于 0/);
    assert.ok(nodes.get("SegmentEnd").position.equals(before));
  }
  {
    const { behavior, nodes } = fixture();
    const before = nodes.get("Shoulder").position.clone();
    delete behavior.binding.shoulderFrames;
    assert.throws(() => behavior.Awake(), /binding\.shoulderFrames 数量无效/);
    assert.ok(nodes.get("Shoulder").position.equals(before));
  }
  {
    const { behavior, nodes } = fixture();
    const before = nodes.get("SegmentEnd").position.clone();
    delete behavior.binding.boneParts[0].boneFrames;
    assert.throws(() => behavior.Awake(), /boneFrames 数量无效/);
    assert.ok(nodes.get("SegmentEnd").position.equals(before));
  }
  {
    const { behavior, nodes } = fixture({ partName: "Feets" });
    const before = nodes.get("SegmentEnd").position.clone();
    delete behavior.binding.boneParts[0].targetFrames;
    assert.throws(() => behavior.Awake(), /targetFrames 数量无效/);
    assert.ok(nodes.get("SegmentEnd").position.equals(before));
  }
  {
    const { behavior, nodes } = fixture();
    const before = nodes.get("SegmentEnd").position.clone();
    behavior.binding.secondaryOffsets = [{
      target: "Accessory",
      useRotation: "false",
      default: [0, 0, 0],
      axis: [0, 0, 0],
      range: [0, 0],
    }];
    assert.throws(() => behavior.Awake(), /useRotation 必须是 boolean/);
    assert.ok(nodes.get("SegmentEnd").position.equals(before));
  }
});
