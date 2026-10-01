import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { GrabPass } from "../packages/hasunosora_runtime/shaders/highlight-distortion.js";

function fixture() {
  const scene = new THREE.Scene();
  const lens = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial());
  scene.add(lens);
  const previousTarget = new THREE.WebGLRenderTarget(8, 8);
  let target = previousTarget;
  const renderer = {
    info: { render: { frame: 0 } },
    outputColorSpace: THREE.SRGBColorSpace,
    autoClear: false,
    getDrawingBufferSize(vector) { return vector.set(100, 50); },
    getRenderTarget() { return target; },
    setRenderTarget(value) { target = value; },
    inspect() {},
    render(actualScene, camera) {
      this.info.render.frame++;
      this.inspect(actualScene, camera);
    },
  };
  const camera = new THREE.PerspectiveCamera();
  const pass = new GrabPass(THREE, renderer, lens.material, lens);
  pass.init(renderer);
  const capture = () => {
    renderer.info.render.frame++; // A normal render separates consecutive captures.
    pass.onBeforeRender(renderer, scene, camera);
  };
  return { scene, lens, renderer, camera, pass, capture, previousTarget };
}

test("GrabPass skips only when no member can draw in this scene and camera", () => {
  const { scene, lens, renderer, camera, pass, capture } = fixture();
  const original = lens.material;
  const parent = new THREE.Group();
  parent.add(lens); scene.add(parent);
  let captures = 0;
  renderer.inspect = () => { captures++; };
  const noCapture = (change, restore) => {
    change();
    const previous = captures, frame = pass.shared.capturedFrame;
    capture();
    assert.equal(captures, previous);
    assert.equal(pass.shared.capturedFrame, frame, "no capture must not mark the target fresh");
    restore(); capture();
    assert.equal(captures, previous + 1, "becoming drawable must immediately refresh the target");
  };
  noCapture(() => { lens.visible = false; }, () => { lens.visible = true; });
  noCapture(() => { parent.visible = false; }, () => { parent.visible = true; });
  noCapture(() => { parent.remove(lens); }, () => { parent.add(lens); });
  noCapture(() => { lens.layers.set(1); }, () => { lens.layers.set(0); });
  noCapture(() => { original.visible = false; }, () => { original.visible = true; });
  const pbr = new THREE.MeshStandardMaterial();
  noCapture(() => { lens.material = pbr; }, () => { lens.material = original; });

  // Parent layers do not exclude children. Binding creates pass-material copies
  // sharing a runtime, not necessarily the constructor's original material.
  parent.layers.set(1);
  const bound = new THREE.MeshStandardMaterial();
  bound.userData.__parameterizedShaderRuntimes = [pass];
  lens.material = [pbr, bound];
  const before = captures;
  capture(); assert.equal(captures, before + 1);
  const hidden = new THREE.Mesh(new THREE.BufferGeometry(), original);
  hidden.visible = false; scene.add(hidden);
  const other = new GrabPass(THREE, renderer, original, hidden); other.init(renderer);
  renderer.info.render.frame++;
  other.onBeforeRender(renderer, scene, camera);
  assert.equal(captures, before + 2, "a hidden caller must still refresh for another drawable member");
  other.destroy(); pass.destroy();
});

test("GrabPass uses stable capture identities for single/array/outline materials and restores them", () => {
  const { scene, lens, renderer, camera, pass, capture, previousTarget } = fixture();
  const source = new THREE.MeshStandardMaterial({ opacity: 0.75 });
  const outlineSource = new THREE.MeshBasicMaterial({ side: THREE.BackSide });
  const mesh = new THREE.Mesh(new THREE.BufferGeometry(), source);
  const outline = new THREE.Mesh(mesh.geometry, outlineSource);
  const originalArray = [source, outlineSource];
  const grouped = new THREE.Mesh(mesh.geometry, originalArray);
  const liveUniform = { value: 1 };
  source.userData.runtime = { material: source }; // A real runtime forms a cycle.
  source.onBeforeCompile = function (shader) {
    assert.equal(this, source);
    shader.uniforms.uLive = liveUniform;
  };
  source.customProgramCacheKey = function () { assert.equal(this, source); return "original-program-key"; };
  source.clone = () => { throw new Error("Do not deep-clone runtime userData"); };
  scene.add(mesh, outline, grouped);
  let captured, capturedOutline, visits = 0;
  renderer.inspect = (actualScene, actualCamera) => {
    visits++;
    assert.equal(actualScene, scene);
    assert.equal(actualCamera, camera);
    assert.equal(lens.visible, false);
    assert.equal(renderer.getRenderTarget(), pass.shared.rt);
    assert.equal(renderer.outputColorSpace, THREE.SRGBColorSpace);
    assert.equal(pass.shared.rt.texture.colorSpace, THREE.NoColorSpace);
    assert.notEqual(mesh.material, source);
    assert.notEqual(mesh.material.id, source.id);
    assert.notEqual(mesh.material.uuid, source.uuid);
    assert.equal(mesh.material.isMeshStandardMaterial, true);
    assert.equal(outline.material.side, THREE.BackSide);
    assert.deepEqual(grouped.material, [mesh.material, outline.material]);
    assert.equal(mesh.material.userData, source.userData);
    assert.equal(mesh.material.customProgramCacheKey(), source.customProgramCacheKey());
    const shader = { uniforms: {} };
    mesh.material.onBeforeCompile(shader, renderer);
    assert.equal(shader.uniforms.uLive, liveUniform);
    assert.equal(mesh.material.opacity, source.opacity);
    assert.equal(mesh.material.version, source.version);
    assert.equal(mesh.material.map, source.map);
    if (captured) {
      assert.equal(mesh.material, captured);
      assert.equal(outline.material, capturedOutline);
      assert.equal(Object.hasOwn(mesh.material, "transientProperty"), false);
    }
    captured = mesh.material;
    capturedOutline = outline.material;
  };
  source.transientProperty = "remove after first capture";
  capture();
  source.opacity = 0.4;
  source.map = new THREE.Texture();
  source.needsUpdate = true;
  liveUniform.value = 2;
  delete source.transientProperty;
  source.customProgramCacheKey = () => "changed-program-key";
  capture();
  assert.equal(visits, 2);
  assert.equal(mesh.material, source);
  assert.equal(outline.material, outlineSource);
  assert.equal(grouped.material, originalArray);
  assert.equal(lens.visible, true);
  assert.equal(renderer.getRenderTarget(), previousTarget);
  assert.equal(renderer.autoClear, false);
  pass.destroy();
});

test("GrabPass preserves material-id sort order across reversed traversal and a late old material", () => {
  const { scene, renderer, pass, capture } = fixture();
  const oldest = new THREE.MeshStandardMaterial();
  const older = new THREE.MeshStandardMaterial();
  const newer = new THREE.MeshStandardMaterial();
  const first = new THREE.Mesh(new THREE.BufferGeometry(), newer);
  const second = new THREE.Mesh(first.geometry, older);
  const late = new THREE.Mesh(first.geometry, oldest);
  scene.add(first, second); // Scene order deliberately opposes the original id sort.
  let initialCapture, retiredDisposals = 0;
  renderer.inspect = () => {
    assert.ok(second.material.id < first.material.id);
    initialCapture = first.material;
  };
  capture();
  initialCapture.addEventListener("dispose", () => { retiredDisposals++; });
  scene.add(late);
  renderer.inspect = () => {
    assert.ok(late.material.id < second.material.id);
    assert.ok(second.material.id < first.material.id);
  };
  capture();
  assert.equal(retiredDisposals, 1);
  assert.equal(first.material, newer);
  assert.equal(second.material, older);
  assert.equal(late.material, oldest);
  pass.destroy();
});

test("GrabPass mirrors overrideMaterial and restores all bindings even when rendering throws", () => {
  const { scene, lens, renderer, pass, capture, previousTarget } = fixture();
  const source = new THREE.MeshStandardMaterial();
  const mesh = new THREE.Mesh(new THREE.BufferGeometry(), source);
  const override = new THREE.MeshBasicMaterial({ color: 0xff0000 });
  scene.add(mesh);
  scene.overrideMaterial = override;
  let captureOverride;
  renderer.inspect = () => {
    assert.notEqual(mesh.material, source);
    assert.notEqual(scene.overrideMaterial, override);
    captureOverride = scene.overrideMaterial;
    assert.equal(captureOverride.color, override.color);
    renderer.autoClear = true;
    throw new Error("capture draw failed");
  };
  assert.throws(capture, /capture draw failed/);
  assert.equal(mesh.material, source);
  assert.equal(scene.overrideMaterial, override);
  assert.equal(lens.visible, true);
  assert.equal(renderer.getRenderTarget(), previousTarget);
  assert.equal(renderer.autoClear, false);
  assert.equal(pass.shared.capturedFrame, -1);
  renderer.inspect = () => { assert.equal(scene.overrideMaterial, captureOverride); };
  capture();
  assert.equal(scene.overrideMaterial, override);
  pass.destroy();
});

test("GrabPass restores earlier swaps if a later capture material cannot be created", () => {
  const { scene, lens, renderer, pass, capture, previousTarget } = fixture();
  class RejectingMaterial extends THREE.MeshStandardMaterial {
    static reject = false;
    constructor() {
      super();
      if (RejectingMaterial.reject) throw new Error("material construction failed");
    }
  }
  const first = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial());
  const second = new THREE.Mesh(first.geometry, new RejectingMaterial());
  const firstSource = first.material, secondSource = second.material;
  scene.add(first, second);
  RejectingMaterial.reject = true;
  assert.throws(capture, /material construction failed/);
  assert.equal(first.material, firstSource);
  assert.equal(second.material, secondSource);
  assert.equal(lens.visible, true);
  assert.equal(renderer.getRenderTarget(), previousTarget);
  pass.destroy();
});

test("GrabPass disposes capture materials on source disposal and the last shared member release", () => {
  const { scene, renderer, pass, capture } = fixture();
  const source = new THREE.MeshStandardMaterial();
  const mesh = new THREE.Mesh(new THREE.BufferGeometry(), source);
  const secondLens = new THREE.Mesh(mesh.geometry, new THREE.MeshStandardMaterial());
  const secondPass = new GrabPass(THREE, renderer, secondLens.material, secondLens);
  secondPass.init(renderer);
  scene.add(mesh, secondLens);
  let sourceDisposals = 0, captureDisposals = 0, targetDisposals = 0;
  source.addEventListener("dispose", () => { sourceDisposals++; });
  pass.shared.rt.addEventListener("dispose", () => { targetDisposals++; });
  let captured;
  renderer.inspect = () => {
    assert.notEqual(mesh.material, source);
    captured = mesh.material;
  };
  capture();
  const firstCapture = captured;
  firstCapture.addEventListener("dispose", () => { captureDisposals++; });
  source.dispose();
  assert.equal(sourceDisposals, 1);
  assert.equal(captureDisposals, 1);
  capture();
  assert.notEqual(captured, firstCapture);
  captured.addEventListener("dispose", () => { captureDisposals++; });
  pass.destroy();
  assert.equal(captureDisposals, 1);
  assert.equal(targetDisposals, 0);
  secondPass.destroy();
  assert.equal(captureDisposals, 2);
  assert.equal(targetDisposals, 1);
  assert.equal(sourceDisposals, 1, "capture cleanup must not dispose original materials");
  source.dispose();
  assert.equal(sourceDisposals, 2);
  assert.equal(captureDisposals, 2, "source listeners must be detached after shared cleanup");
});
