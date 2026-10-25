// Pure CPU test reference extracted from the diagnostic tool; arithmetic preserved.
const cpuFields = ['updateMs', 'prepareMs', 'shaderTickMs', 'renderMs', 'totalCpuMs'];

export function metric(values, unit = 'ms') {
  const sorted = values.filter(Number.isFinite).slice().sort((a, b) => a - b);
  if (!sorted.length) return { count: 0, unit, min: null, median: null, p95: null, p99: null, max: null, mean: null };
  const percentile = p => { const position = (sorted.length - 1) * p, index = Math.floor(position); return sorted[index] + (sorted[Math.ceil(position)] - sorted[index]) * (position - index); };
  return { count: sorted.length, unit, min: sorted[0], median: percentile(.5), p95: percentile(.95), p99: percentile(.99), max: sorted.at(-1), mean: sorted.reduce((sum, n) => sum + n, 0) / sorted.length };
}

export function summarizeFrames(records, gpuFrames = []) {
  const times = records.map(record => record.time);
  const intervals = times.slice(1).map((time, i) => time - times[i]).filter(value => Number.isFinite(value) && value > 0);
  const phaseNames = [...new Set(records.flatMap(record => Object.keys(record.phaseCpu ?? {})))].sort();
  return {
    cpu: Object.fromEntries(cpuFields.map(field => [field, metric(records.map(record => record[field]))])),
    phaseCpu: Object.fromEntries(phaseNames.map(name => [name, { ...metric(records.map(record => record.phaseCpu?.[name] ?? 0)),
      measuredInFrames: records.filter(record => Number.isFinite(record.phaseCpu?.[name])).length }])),
    gpu: metric(gpuFrames.filter(frame => frame.valid).map(frame => frame.ms)),
    drawCalls: metric(records.map(record => record.drawCalls), 'calls/frame'), triangles: metric(records.map(record => record.triangles), 'triangles/frame'),
    raf: { intervalMs: metric(intervals), measuredCadenceFps: intervals.length ? 1000 / metric(intervals).mean : null,
      referenceBudgetMs: 1000 / 60, intervalsOver25ms: intervals.filter(ms => ms > 25).length,
      intervalsOver33_333ms: intervals.filter(ms => ms > 1000 / 30).length, intervalsOver50ms: intervals.filter(ms => ms > 50).length,
      estimatedMissed60HzSlots: intervals.reduce((sum, ms) => sum + Math.max(0, Math.round(ms / (1000 / 60)) - 1), 0),
      note: 'Cadence/jank observations only; 60 Hz is a reporting reference, not an acceptance threshold.' },
    animationTimestepSeconds: metric(records.map(record => record.delta), 'seconds/frame'),
    sampleRange: { frames: records.length, firstRafTimeMs: times[0] ?? null, lastRafTimeMs: times.at(-1) ?? null,
      spanBetweenFirstAndLastRafMs: times.length > 1 ? times.at(-1) - times[0] : 0 },
  };
}

export function textureStorage(descriptor) {
  const { width, height, depth = 1, faces = 1, bytesPerTexel } = descriptor;
  if (!(width > 0 && height > 0 && bytesPerTexel > 0)) return { estimatedBytes: null, levels: [], reason: 'Unknown dimensions/format; no allocation guessed' };
  let levels;
  if (descriptor.explicitMipDimensions?.length) levels = descriptor.explicitMipDimensions.map(([w, h, d = depth]) => ({ width: w, height: h, depth: d }));
  else {
    levels = [{ width, height, depth }];
    if (descriptor.generateMipmaps) while (levels.at(-1).width > 1 || levels.at(-1).height > 1) {
      const prior = levels.at(-1); levels.push({ width: Math.max(1, prior.width >> 1), height: Math.max(1, prior.height >> 1), depth });
    }
  }
  return { levels, estimatedBytes: levels.reduce((sum, level) => sum + level.width * level.height * level.depth * faces * bytesPerTexel, 0),
    basis: descriptor.explicitMipDimensions?.length ? 'explicit mip dimensions' : descriptor.generateMipmaps ? 'generated full mip chain estimated from texture flag' : 'single base level' };
}

export function summarizeMemory(snapshot) {
  const textures = snapshot.textures.map(texture => ({ ...texture, storage: textureStorage(texture) }));
  const targetTextureIds = new Set(snapshot.renderTargets.flatMap(target => [...target.colorTextureIds, target.depthTextureId].filter(Boolean)));
  const sources = new Map();
  for (const texture of textures.filter(texture => !targetTextureIds.has(texture.uuid))) {
    const entry = sources.get(texture.sourceId) ?? { sourceId: texture.sourceId, textures: [], maxEstimatedBytes: 0, variants: new Set() };
    entry.textures.push(texture.uuid); entry.maxEstimatedBytes = Math.max(entry.maxEstimatedBytes, texture.storage.estimatedBytes ?? 0);
    entry.variants.add(JSON.stringify([texture.width, texture.height, texture.faces, texture.bytesPerTexel, texture.generateMipmaps, texture.explicitMipDimensions, texture.colorSpace, texture.samplerState]));
    sources.set(texture.sourceId, entry);
  }
  const renderTargets = snapshot.renderTargets.map(target => {
    const colorBytes = target.colorTextureIds.reduce((sum, id) => sum + (textures.find(texture => texture.uuid === id)?.storage.estimatedBytes ?? 0), 0);
    const depthTexture = textures.find(texture => texture.uuid === target.depthTextureId);
    const depthBytes = target.depthBuffer ? (depthTexture?.storage.estimatedBytes ?? target.width * target.height * 4) : 0;
    const samples = Math.max(1, target.samples);
    return { ...target, estimatedColorBytes: colorBytes, estimatedDepthBytes: depthBytes,
      estimatedTotalBytes: colorBytes * (target.samples > 0 ? samples + 1 : 1) + depthBytes * samples };
  });
  return { ...snapshot, textures, textureSources: [...sources.values()].map(source => ({ ...source, variants: source.variants.size })), renderTargets,
    estimates: { geometryAttributeUploadBytes: snapshot.geometryBuffers.reduce((sum, buffer) => sum + buffer.bytes, 0),
      morphSourceCpuBytes: (snapshot.morphSourceBuffers ?? []).reduce((sum, buffer) => sum + buffer.bytes, 0),
      internalMorphTextureBytesEstimate: (snapshot.morphTextureEstimates ?? []).reduce((sum, texture) => sum + texture.estimatedBytes, 0),
      nonRenderTargetTextureBytesIfSharedPerSource: [...sources.values()].reduce((sum, source) => sum + source.maxEstimatedBytes, 0),
      nonRenderTargetTextureBytesIfAllocatedPerTextureObject: textures.filter(texture => !targetTextureIds.has(texture.uuid)).reduce((sum, texture) => sum + (texture.storage.estimatedBytes ?? 0), 0),
      renderTargetBytes: renderTargets.reduce((sum, target) => sum + target.estimatedTotalBytes, 0) },
    limitation: 'Logical observed-scene object/source/mip estimates, not driver VRAM readback. Hidden owned geometry may not be resident. Internal Morph array-texture sizes follow this checkout Three WebGLMorphtargets packing and are separate from geometry attribute buffers. Texture state/color-space variants can defeat source sharing; driver alignment, caches, browser compositing, shader storage and allocations outside observed scenes/targets are not included. Depth24 uses a 4-byte storage estimate.' };
}

