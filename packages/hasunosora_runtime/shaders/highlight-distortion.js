// Copy the color buffer at the first lens draw of each renderer frame.
export { TimeRuntime } from './shared-runtime.js';

const hooks = new WeakMap();

function installHook(mesh, runtime) {
  let hook = hooks.get(mesh);
  if (!hook) {
    const prior = mesh.onBeforeRender;
    hook = { prior, runtimes: new Set(), wrapper: null };
    hook.wrapper = function (...args) {
      hook.prior?.apply(this, args);
      const [renderer, , , , material] = args;
      for (const member of hook.runtimes) {
        if (member.shared && (material === member.material ||
          material?.userData?.__parameterizedShaderRuntimes?.includes(member))) {
          member.copy(renderer);
          break;
        }
      }
    };
    hooks.set(mesh, hook);
    mesh.onBeforeRender = hook.wrapper;
  }
  hook.runtimes.add(runtime);
}

function removeHook(mesh, runtime) {
  const hook = hooks.get(mesh);
  if (!hook) return;
  hook.runtimes.delete(runtime);
  if (!hook.runtimes.size) {
    if (mesh.onBeforeRender === hook.wrapper) mesh.onBeforeRender = hook.prior;
    hooks.delete(mesh);
  }
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

  makeTexture(width, height) {
    const texture = new this.THREE.FramebufferTexture(width, height);
    texture.minFilter = this.THREE.LinearFilter;
    texture.magFilter = this.THREE.LinearFilter;
    return texture;
  }

  init(renderer) {
    let shared = GrabPass.sharedByRenderer.get(renderer);
    if (!shared) {
      const size = renderer.getDrawingBufferSize(new this.THREE.Vector2());
      shared = { size, texture: this.makeTexture(size.x, size.y), members: new Set(), capturedFrame: -1 };
      GrabPass.sharedByRenderer.set(renderer, shared);
    }
    shared.members.add(this);
    this.shared = shared;
    this.uniforms = { uOpaqueTex: { value: shared.texture }, uOpaqueTexSRGB: { value: 1 } };
    installHook(this.mesh, this);
  }

  getUniforms() { return this.uniforms; }

  copy(renderer) {
    const shared = this.shared;
    if (!shared || shared.capturedFrame === renderer.info.render.frame) return;
    const target = renderer.getRenderTarget();
    const size = target ? shared.size.set(target.width, target.height)
      : renderer.getDrawingBufferSize(shared.size);
    if (shared.texture.image.width !== size.x || shared.texture.image.height !== size.y) {
      const oldTexture = shared.texture;
      shared.texture = this.makeTexture(size.x, size.y);
      for (const member of shared.members) member.uniforms.uOpaqueTex.value = shared.texture;
      oldTexture.dispose();
    }
    const colorSpace = target ? target.texture.colorSpace : renderer.outputColorSpace;
    for (const member of shared.members) {
      member.uniforms.uOpaqueTexSRGB.value = colorSpace === member.THREE.SRGBColorSpace ? 1 : 0;
    }
    renderer.copyFramebufferToTexture(shared.texture);
    shared.capturedFrame = renderer.info.render.frame;
  }

  destroy() {
    if (!this.shared) return;
    removeHook(this.mesh, this);
    this.shared.members.delete(this);
    if (!this.shared.members.size) {
      this.shared.texture.dispose();
      GrabPass.sharedByRenderer.delete(this.renderer);
    }
    this.shared = null;
    this.uniforms = null;
  }
}
