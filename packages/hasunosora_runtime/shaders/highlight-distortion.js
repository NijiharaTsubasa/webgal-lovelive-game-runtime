// GrabPass — capture scene without this mesh into a render target, expose the
// result as `uOpaqueTex` for the lens-distortion shader to sample.
//
// JS uniform names must match the shader.glsl declarations — `uOpaqueTex` is
// the sampler in highlight-distortion.glsl.

export { TimeRuntime } from "./shared-runtime.js";

const materialIdentityKeys = new Set(["id", "uuid", "_listeners", "onBeforeCompile", "customProgramCacheKey"]);

function releaseCaptureMaterial(shared, source) {
  const entry = shared.captureMaterials.get(source);
  if (!entry) return;
  shared.captureMaterials.delete(source);
  source.removeEventListener("dispose", entry.onDispose);
  entry.material.dispose();
}

function captureMaterial(shared, source, synchronized) {
  if (!source?.isMaterial) return source;
  let entry = shared.captureMaterials.get(source);
  if (!entry) {
    // Material.copy/clone JSON-clones userData, but shader runtimes can contain
    // cycles. Keep independent Three identities and shallow-share live inputs.
    entry = { material: new source.constructor(), keys: [], onDispose: null };
    entry.material.onBeforeCompile = (...args) => source.onBeforeCompile(...args);
    entry.material.customProgramCacheKey = (...args) => source.customProgramCacheKey(...args);
    entry.onDispose = () => releaseCaptureMaterial(shared, source);
    shared.captureMaterials.set(source, entry);
    shared.highestSourceId = Math.max(shared.highestSourceId, source.id);
    source.addEventListener("dispose", entry.onDispose);
  }
  if (!synchronized.has(source)) {
    for (const key of entry.keys) {
      if (!Object.hasOwn(source, key)) delete entry.material[key];
    }
    entry.keys = Object.keys(source).filter((key) => !materialIdentityKeys.has(key));
    for (const key of entry.keys) entry.material[key] = source[key];
    synchronized.add(source);
  }
  return entry.material;
}

function prepareCaptureMaterials(shared, sources, synchronized) {
  const added = [...sources].filter((source) => !shared.captureMaterials.has(source));
  if (added.some((source) => source.id < shared.highestSourceId)) {
    // Three's opaque sort compares material.id before depth. If an older source
    // joins later, rebuild in source order instead of changing that draw order.
    for (const source of shared.captureMaterials.keys()) releaseCaptureMaterial(shared, source);
    shared.highestSourceId = -Infinity;
    added.length = 0;
    added.push(...sources);
  }
  added.sort((a, b) => a.id - b.id);
  for (const source of added) captureMaterial(shared, source, synchronized);
}

function memberCanDraw(member, scene, camera) {
  const mesh = member.mesh;
  // An unbound runtime or a scene-wide material override needs the conservative
  // capture path. Do not infer fragment visibility from pose, depth or stencil.
  if (!mesh || scene.overrideMaterial) return true;
  let inScene = false;
  for (let object = mesh; object; object = object.parent) {
    if (!object.visible) return false;
    if (object === scene) { inScene = true; break; }
  }
  if (!inScene || !mesh.layers.test(camera.layers)) return false;
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  return materials.some((material) => material?.visible &&
    (material === member.material || material.userData.__parameterizedShaderRuntimes?.includes(member)));
}

export class GrabPass {
  static sharedByRenderer = new WeakMap();

  constructor(THREE, renderer, material, mesh) {
    this.THREE = THREE;
    this.renderer = renderer;
    this.material = material;
    this.mesh = mesh;
    this.shared = null;
    this.uniforms = null;
  }

  // Share this adapter's lens backdrop per renderer. This is a scene redraw,
  // not a literal copy of Unity's framebuffer at a draw-queue position.
  init(renderer) {
    let shared = GrabPass.sharedByRenderer.get(renderer);
    if (!shared) {
      const size = renderer.getDrawingBufferSize(new this.THREE.Vector2());
      shared = {
        size,
        rt: new this.THREE.WebGLRenderTarget(size.x, size.y, {
          minFilter: this.THREE.LinearFilter,
          magFilter: this.THREE.LinearFilter,
          format: this.THREE.RGBAFormat,
          stencilBuffer: true,
        }),
        members: new Set(),
        capturedFrame: -1,
        captureMaterials: new Map(),
        highestSourceId: -Infinity,
      };
      GrabPass.sharedByRenderer.set(renderer, shared);
    }
    shared.members.add(this);
    this.shared = shared;
    this.uniforms = { uOpaqueTex: { value: shared.rt.texture } };
  }

  // Declare the texture uniforms this pass owns. Called by the binder
  // during onBeforeCompile so the values land in shader.uniforms and the
  // GPU sees the RT at first draw.
  getUniforms() {
    return this.uniforms;
  }

  // Per-frame hook: capture the scene minus this mesh into our RT.
  onBeforeRender(renderer, scene, camera) {
    const shared = this.shared;
    if (!shared) return;
    if (![...shared.members].some((member) => memberCanDraw(member, scene, camera))) return;

    const size = renderer.getDrawingBufferSize(shared.size);
    if (shared.rt.width !== size.x || shared.rt.height !== size.y) {
      shared.rt.setSize(size.x, size.y);
    }
    if (shared.capturedFrame === renderer.info.render.frame) return;

    // A named GrabPass is shared by every matching object. Hide all of those
    // objects while capturing so none of the lenses appear in the backdrop.
    const visibility = [];
    const materialBindings = [];
    const sources = new Set();
    const synchronized = new Set();
    const originalOverride = scene.overrideMaterial;
    const currentRT = renderer.getRenderTarget();
    const currentAutoClear = renderer.autoClear;
    try {
      for (const member of shared.members) {
        if (!member.mesh) continue;
        visibility.push([member.mesh, member.mesh.visible]);
        member.mesh.visible = false;
      }
      // Separate material identities retain each output target's program state.
      // Shader hooks, uniforms, render state and output colour spaces are unchanged.
      scene.traverse?.((object) => {
        if (!object.material) return;
        const original = object.material;
        materialBindings.push([object, original]);
        for (const source of Array.isArray(original) ? original : [original]) {
          if (source?.isMaterial) sources.add(source);
        }
      });
      if (originalOverride?.isMaterial) sources.add(originalOverride);
      prepareCaptureMaterials(shared, sources, synchronized);
      for (const [object, original] of materialBindings) {
        object.material = Array.isArray(original)
          ? original.map((source) => captureMaterial(shared, source, synchronized))
          : captureMaterial(shared, original, synchronized);
      }
      if (originalOverride) scene.overrideMaterial = captureMaterial(shared, originalOverride, synchronized);
      renderer.setRenderTarget(shared.rt);
      renderer.render(scene, camera);
      shared.capturedFrame = renderer.info.render.frame;
    } finally {
      for (const [object, material] of materialBindings) object.material = material;
      if (originalOverride) scene.overrideMaterial = originalOverride;
      renderer.autoClear = currentAutoClear;
      for (const [mesh, wasVisible] of visibility) mesh.visible = wasVisible;
      renderer.setRenderTarget(currentRT);
    }
  }

  // Free the render target.
  destroy() {
    if (!this.shared) return;
    this.shared.members.delete(this);
    if (this.shared.members.size === 0) {
      for (const source of this.shared.captureMaterials.keys()) releaseCaptureMaterial(this.shared, source);
      this.shared.rt.dispose();
      GrabPass.sharedByRenderer.delete(this.renderer);
    }
    this.shared = null;
    this.uniforms = null;
  }
}
