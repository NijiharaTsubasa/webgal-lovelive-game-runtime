// ForwardRendererCostumeModel, renderer 6 / PathID 7191.
// Evidence: runtime_schedule_agent/schedule/frame_schedule.json and
// oit/frame_protocol.json; per-feature native control flow is retained there.
// Commands are supplied by the GPU implementation. This module only implements
// recovered selection and invocation state; it does not invent missing inputs.
export const costumeSettings = Object.freeze({
  opaqueLayerMask: 0xffffffff,
  transparentLayerMask: 0x400fff37,
  oitLayerMask: 0x01f00000,
  alphaWriteOffLayerMask: 0x3e000000,
  depthOnlyPass: false,
  forBlendBufferTexture: true,
});

const standardTags = ['SRPDefaultUnlit', 'UniversalForward', 'UniversalForwardOnly'];

// ShaderTagId equivalence was checked on Unity 2022.3.62f1. A match consumes
// exactly one pass; Shader file order does not imply execution of every pass.
export function firstMatchingPass(passes, tags) {
  for (const tag of tags) {
    const match = passes.find(pass => pass.lightMode.toLowerCase() === tag.toLowerCase());
    if (match) return match;
  }
  return null;
}

export function selectDraws(records, { tags, transparent, layerMask }) {
  const selected = [];
  for (const record of records) {
    if (!Number.isInteger(record.layer) || record.layer < 0 || record.layer > 31) {
      throw new Error('Meteor draw record requires source GameObject layer 0..31');
    }
    if (!Number.isFinite(record.renderQueue)) throw new Error('Meteor draw record requires source renderQueue');
    // Unity RenderQueueRange: opaque [0,2500], transparent [2501,5000].
    const min = transparent ? 2501 : 0;
    const max = transparent ? 5000 : 2500;
    if (record.renderQueue < min || record.renderQueue > max) continue;
    if (((1 << record.layer) & layerMask) === 0) continue;
    const pass = firstMatchingPass(record.passes, tags);
    if (pass) selected.push({ record, pass });
  }
  return selected;
}

// Build when membership changes, never by traversing the model every frame.
// Runtime visibility, camera culling and distance sorting remain draw-time work.
export function buildCostumeBatches(records) {
  const choose = (tags, transparent, layerMask) => selectDraws(records, { tags, transparent, layerMask });
  return {
    opaque: choose(standardTags, false, costumeSettings.opaqueLayerMask),
    outline: choose(['OutlineExtension'], false, 0xffffffff),
    accumulate: choose(['Accumulate'], true, costumeSettings.oitLayerMask),
    transparent: choose(standardTags, true, costumeSettings.transparentLayerMask),
    alphaWriteOff: choose(['AlphaWriteOffBase', 'AlphaWriteOffOffset'], true,
      costumeSettings.alphaWriteOffLayerMask),
  };
}

export function createCostumeSchedule() {
  let isSetupRender = false;
  return {
    // setup must return success based on actual resources, not inferred defaults.
    // Its placement follows AddRenderPasses -> SetupRenderPasses -> Execute.
    render({ setup, command, preview = false }) {
      command('globals');
      const enqueued = isSetupRender;
      if (!preview) {
        isSetupRender = false;
        isSetupRender = setup() === true;
      }
      command('opaque');
      command('outline');
      if (enqueued) {
        command('copyDepthIn');
        command('bindOitMrt');
        command('clearOit');
        command('accumulate');
        // Costume's serialized DepthOnlyPass is false.
        command('saveSourceColor');
        command('bindOitGlobals');
        command('compositeForBlendBuffer');
        command('copyDepthBack');
      }
      command('transparent');
      command('alphaWriteOff');
    },
    destroy() { isSetupRender = false; },
  };
}
