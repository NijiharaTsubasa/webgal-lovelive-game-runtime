import { meteorProgramData } from './meteor-program-data.js';
import { selectMeteorVariant } from './meteor-variants.js';
import { meteorCoordinateMatrices } from './meteor-coordinates.js';
import { prepareMeteorSections, selectMeteorSections } from './meteor-sections.js';

const families = {
  'garupa-meteor': 'Meteor/MeteorShader',
  'garupa-meteor-offset': 'Meteor/MeteorShaderOffset',
  'garupa-meteor-transparent': 'Meteor/MeteorShaderTransparent',
};
const sourceGlobalTextures = new Set(Object.values(meteorProgramData).flatMap(p => p.globalTextures.map(t => t.uniform)));
const descriptors = new Map(Object.values(meteorProgramData).flatMap(p => p.globals.map(u => [u.name, u])));
const faceNames = ['_FaceFrontX', '_FaceFrontZ', '_FaceRightX', '_FaceRightZ'];
const shNames = ['SHAr', 'SHAg', 'SHAb', 'SHBr', 'SHBg', 'SHBb', 'SHC']
  .filter(name => descriptors.has(`u_UnityPerDraw_unity_${name}`));
const sameKeywords = (value, saved) => Array.isArray(value) && saved !== undefined && value.length === saved.length && value.every((keyword, i) => keyword === saved[i]);

function components(value) {
  if (Array.isArray(value) || ArrayBuffer.isView(value)) return Array.from(value);
  if (typeof value?.toArray === 'function') return value.toArray();
  if (value && Number.isFinite(value.r)) return [value.r, value.g, value.b, ...(value.a === undefined ? [] : [value.a])];
  throw new TypeError('Explicit vector components are required');
}

function writeValue(uniform, value) {
  const target = uniform.value;
  if (target?.isVector2 || target?.isVector3 || target?.isVector4) {
    const values = components(value);
    const size = target.isVector4 ? 4 : target.isVector3 ? 3 : 2;
    if (values.length !== size || values.some(v => !Number.isFinite(v))) throw new TypeError(`Expected ${size} finite components`);
    target.fromArray(values);
  } else if (Array.isArray(target)) {
    if (!Array.isArray(value) || value.length !== target.length) throw new TypeError('Explicit complete uniform array is required');
    target.forEach((item, i) => writeValue({ value: item }, value[i]));
  } else if (target instanceof Float32Array) {
    if (value.length !== target.length) throw new TypeError('Uniform array length mismatch');
    target.set(value);
  } else uniform.value = value;
}

function uniformValue(THREE, descriptor) {
  const scalar = () => descriptor.width === 1 ? 0 : new THREE[`Vector${descriptor.width}`]();
  return descriptor.array ? (descriptor.width === 1 ? new Float32Array(descriptor.array) : Array.from({ length: descriptor.array }, scalar)) : scalar();
}

function keywords(value) {
  if (!Array.isArray(value) || value.some(item => typeof item !== 'string' || !item)) throw new TypeError('globalKeywords must be an explicit string array');
  return [...new Set(value)].sort();
}

/** Runtime for retained source programs. Frame lighting is an explicit input;
 * this class does not search a scene or synthesize a stage/environment rig.
 */
export default class MeteorRuntime {
  constructor(THREE, renderer, material, mesh) {
    this.THREE = THREE;
    this.material = material;
    this.mesh = mesh;
    this.sourceShader = families[material?.userData?.shader];
    if (!this.sourceShader) throw new Error(`Unsupported Meteor shader family: ${material?.userData?.shader}`);
    this.passes = new Map();
    this.frame = null;
    this.globalKeywords = [];
    this.available = new Set();
    this.uniforms = Object.fromEntries([...descriptors].map(([name, descriptor]) => [name, { value: uniformValue(THREE, descriptor) }]));
    for (const name of sourceGlobalTextures) this.uniforms[name] = { value: null };
    this.uniforms.uMeteorTargetHeight = { value: 0 };
    this.uniforms.uMeteorMeshToSource = { value: new THREE.Matrix4() };
    this.frontFacingStatus = 'UNVERIFIED';
  }

  configurePass(passId, material, mesh, pass) {
    if (this.passes.has(passId)) throw new Error(`Meteor pass configured twice: ${passId}`);
    if (!Array.isArray(pass?.extras?.materialKeywords)) throw new Error(`Meteor pass ${passId} lacks original materialKeywords`);
    const binding = { passId, material, mesh, pass, baseKey: material.customProgramCacheKey(), faceUniforms: {},
      sourceSections: prepareMeteorSections(pass.sections) };
    if (pass.extras.faceLighting) {
      for (const name of faceNames) {
        const saved = pass.shaderParams?.[name];
        if (!Number.isFinite(saved)) throw new Error(`Face pass requires preserved source value ${name}`);
        binding.faceUniforms[`u${name}`] = { value: saved };
      }
    }
    // Binding precedes the profile's first explicit frame. Select no implicit
    // global keyword state here. getUniforms remains closed until setFrame selects.
    if (this.frame) this.selectPrograms(binding, this.globalKeywords);
    material.forceSinglePass = true;
    material.fog = false;
    material.toneMapped = false;
    material.alphaTest = 0;
    material.alphaHash = false;
    material.premultipliedAlpha = false;
    material.dithering = false;
    // MeshStandardMaterial's PBR samplers must not add another texture/color
    // operation before or after the retained source program.
    for (const name of Object.keys(material)) if (/Map$/.test(name) || name === 'map') material[name] = null;
    material.defines = { ...material.defines, STANDARD: '' };
    const originalCompile = material.onBeforeCompile;
    material.onBeforeCompile = function preserveMeteorAlpha(shader, ...args) {
      originalCompile.call(this, shader, ...args);
      const anchor = '#include <opaque_fragment>';
      if (!shader.fragmentShader.includes(anchor)) throw new Error('Meteor alpha restore requires opaque_fragment anchor');
      shader.fragmentShader = shader.fragmentShader.replace(anchor, `${anchor}\ngl_FragColor.a = meteor_sourceRGBA.a;`);
    };
    material.customProgramCacheKey = () => `${binding.baseKey}:meteor:${binding.vertexSha}:${binding.fragmentSha}:defaultTangent=${binding.defaultTangent}`;
    this.passes.set(passId, binding);
    if (this.frame) this.applyFace(binding);
  }

  programSelection(binding, globals) {
    const materialKeywords = binding.pass.extras.materialKeywords;
    const colorMask = binding.pass.renderState?.colorMask;
    // Cache only a fully validated selection. Compare keyword contents, not
    // array identity: callers may mutate material metadata in place. Geometry
    // channel checks remain in selectPrograms and run even on a cache hit.
    if (binding.selection && sameKeywords(globals, binding.selectionGlobals) &&
        sameKeywords(materialKeywords, binding.selectionMaterial) && binding.selectionColorMask === colorMask) {
      return binding.selection;
    }
    const select = stage => {
      const candidate = selectMeteorVariant({ shader: this.sourceShader, pass: binding.passId, stage,
        materialKeywords: binding.pass.extras.materialKeywords, globalKeywords: globals });
      const program = meteorProgramData[candidate.source_sha256];
      if (!program || program.stage !== stage) throw new Error(`Untranscribed Meteor ${stage} program ${candidate.source_sha256}`);
      return { sha: candidate.source_sha256, program };
    };
    const vertex = select('vertex'), fragment = select('fragment');
    for (const [name, type] of Object.entries(fragment.program.inputs)) {
      if (!vertex.program.outputs[name] || vertex.program.outputs[name].width < type.width) throw new Error(`Meteor stage interface lacks required components of ${name}`);
    }
    if (Object.keys(fragment.program.outputs).length === 0 && binding.pass.renderState?.colorMask !== 0) {
      throw new Error('Void source fragment requires original ColorMask=0');
    }
    binding.selectionGlobals = globals.slice();
    binding.selectionMaterial = materialKeywords.slice();
    binding.selectionColorMask = colorMask;
    return binding.selection = { vertex, fragment };
  }

  selectPrograms(binding, globals, selection = this.programSelection(binding, globals)) {
    const { vertex, fragment } = selection;
    const attributes = binding.mesh?.geometry?.attributes ?? {};
    const usesTangent = vertex.program.activeInputs.includes('TANGENT0');
    const defaultTangent = usesTangent && !attributes.tangent;
    if (vertex.program.activeInputs.includes('TEXCOORD0') && !attributes._source_uv0) throw new Error('Meteor source vertex reads missing _source_uv0');
    if (binding.vertexSha === vertex.sha && binding.fragmentSha === fragment.sha && binding.defaultTangent === defaultTangent) return;
    // makePatcher reads this per-material Pass metadata at compile time. Only
    // the selected original pair and unchanged common code reach Three.js.
    if (binding.vertexSha !== vertex.sha || binding.fragmentSha !== fragment.sha) {
      binding.pass.sections = selectMeteorSections(binding.sourceSections, vertex.program.define, fragment.program.define);
    }
    const defines = binding.material.defines ??= {};
    for (const name of Object.keys(defines)) if (/^METEOR_(VERTEX|FRAGMENT)_/.test(name)) delete defines[name];
    defines[vertex.program.define] = 1;
    defines[fragment.program.define] = 1;
    if (usesTangent && !defaultTangent) defines.USE_TANGENT = '';
    else delete defines.USE_TANGENT;
    if (defaultTangent) defines.METEOR_DEFAULT_TANGENT = 1;
    else delete defines.METEOR_DEFAULT_TANGENT;
    binding.defaultTangent = defaultTangent;
    if (vertex.program.activeInputs.includes('TEXCOORD1') && !attributes._source_uv1) {
      // Native vertex channel default is xy=0; neither retained Outline VS
      // reads its absent z/w channels. Use an attribute constant, not UV0.
      binding.material.defaultAttributeValues = { ...binding.material.defaultAttributeValues, _source_uv1: [0, 0] };
    }
    binding.vertexSha = vertex.sha;
    binding.fragmentSha = fragment.sha;
    binding.programs = [vertex.program, fragment.program];
    binding.material.needsUpdate = true;
  }

  getUniforms(passId) {
    const binding = this.passes.get(passId);
    if (!binding) throw new Error(`Meteor pass not configured: ${passId}`);
    if (!binding.programs) throw new Error(`Meteor ${passId} requires an explicit matching frame before compilation`);
    return Object.assign(binding.uniforms ??= { ...this.uniforms }, binding.faceUniforms);
  }

  put(name, value) {
    const uniform = this.uniforms[name];
    if (!uniform) throw new Error(`Unknown source global ${name}`);
    writeValue(uniform, value);
    this.available.add(name);
  }

  setFrame(frame) {
    if (!Number.isFinite(frame?.targetHeight) || frame.targetHeight <= 0) throw new TypeError('Meteor frame requires positive targetHeight');
    const globals = keywords(frame.globalKeywords ?? []);
    const selections = [...this.passes.values()].map(binding => [binding, this.programSelection(binding, globals)]);
    this.frame = frame;
    this.globalKeywords = globals;
    this.available.clear();
    this.uniforms.uMeteorTargetHeight.value = frame.targetHeight;
    for (const [binding, selection] of selections) this.selectPrograms(binding, globals, selection);
    if (frame.mainLightPosition !== undefined) {
      const position = components(frame.mainLightPosition);
      if (position.length !== 4) throw new TypeError('mainLightPosition requires xyzw');
      this.put('u_FGlobals_MainLightPosition', [-position[0], position[1], position[2], position[3]]);
    }
    if (frame.mainLightColor !== undefined) {
      const color = components(frame.mainLightColor);
      this.put('u_FGlobals_MainLightColor', color.length === 3 ? [...color, 1] : color);
    }
    // No per-object additional lights in the menu frame. Nonempty additional
    // rigs require explicit source arrays/count/indices rather than guessed URP
    // attenuation or cookie mapping.
    if (frame.additionalLights?.length) throw new Error('Additional light rigs require explicit source frame.uniforms bindings');
    this.put('u_UnityPerDraw_unity_LightIndices', [[0, 0, 0, 0], [0, 0, 0, 0]]);
    for (const [name, descriptor] of descriptors) if (descriptor.scope === 'AdditionalLights') {
      const value = descriptor.array ? Array.from({ length: descriptor.array }, () => Array(descriptor.width).fill(0)) : Array(descriptor.width).fill(0);
      this.put(name, value);
    }
    if (frame.sh !== undefined) {
      for (const name of shNames) this.put(`u_UnityPerDraw_unity_${name}`, frame.sh[name]);
    } else if (frame.ambientRGB !== undefined) {
      const ambient = components(frame.ambientRGB);
      if (ambient.length !== 3) throw new TypeError('ambientRGB requires three components');
      for (const [i, name] of shNames.entries()) this.put(`u_UnityPerDraw_unity_${name}`, [0, 0, 0, i < 3 ? ambient[i] : 0]);
    }
    for (const [name, value] of Object.entries(frame.uniforms ?? {})) this.put(name, value);
    for (const binding of this.passes.values()) this.applyFace(binding);
  }

  applyFace(binding) {
    if (!binding.pass.extras.faceLighting) return;
    const face = this.frame.faceDirections;
    const values = face ? [...components(face.frontXZ), ...components(face.rightXZ)] : faceNames.map(name => binding.pass.shaderParams[name]);
    if (values.length !== 4 || values.some(value => !Number.isFinite(value))) throw new TypeError('faceDirections requires source-world frontXZ/rightXZ pairs');
    faceNames.forEach((name, index) => { binding.faceUniforms[`u${name}`].value = values[index]; });
  }

  onBeforeRender(renderer, scene, camera) {
    if (!this.frame) throw new Error('Meteor requires setFrame before rendering');
    if (!camera || !this.mesh) throw new Error('Meteor requires an object and camera');
    camera.updateMatrixWorld(true);
    this.mesh.updateWorldMatrix(true, false);
    const matrices = meteorCoordinateMatrices({ modelMatrix: this.mesh.matrixWorld, objectMatrix: this.frame.objectMatrix, viewMatrix: camera.matrixWorldInverse, projectionMatrix: camera.projectionMatrix });
    this.uniforms.uMeteorMeshToSource.value.copy(matrices.meshToSource);
    const assignMatrix = (name, matrix) => {
      const columns = this.uniforms[name].value;
      columns.forEach((column, index) => column.fromArray(matrix.elements, index * 4));
      this.available.add(name);
    };
    for (const [name, matrix] of [
      ['u_UnityPerDraw_hlslcc_mtx4x4unity_ObjectToWorld', matrices.objectToWorld],
      ['u_UnityPerDraw_hlslcc_mtx4x4unity_WorldToObject', matrices.worldToObject],
      ['u_VGlobals_hlslcc_mtx4x4unity_MatrixV', matrices.view],
      ['u_VGlobals_hlslcc_mtx4x4unity_MatrixInvV', matrices.inverseView],
      ['u_VGlobals_hlslcc_mtx4x4unity_MatrixVP', matrices.viewProjection],
      ['u_VGlobals_hlslcc_mtx4x4glstate_matrix_projection', matrices.projection],
      ['u_VGlobals_hlslcc_mtx4x4unity_CameraProjection', camera.projectionMatrix],
    ]) assignMatrix(name, matrix);
    const c = camera.matrixWorld.elements;
    this.put('u_FGlobals_WorldSpaceCameraPos', [-c[12], c[13], c[14]]);
    const halfHeight = camera.isOrthographicCamera ? (camera.top - camera.bottom) / (2 * camera.zoom) : 0;
    const ortho = [0, halfHeight, 0, camera.isOrthographicCamera ? 1 : 0];
    this.put('u_VGlobals_unity_OrthoParams', ortho);
    for (const binding of this.passes.values()) {
      const missing = binding.programs.flatMap(program => [...program.globals.map(u => u.name), ...program.globalTextures.map(t => t.uniform)])
        .filter(name => !this.available.has(name) || (sourceGlobalTextures.has(name) && this.uniforms[name].value == null));
      if (missing.length) throw new Error(`Meteor ${binding.passId}: missing explicit active globals: ${[...new Set(missing)].sort().join(', ')}`);
    }
  }

  destroy() { this.passes.clear(); this.frame = null; }
}
