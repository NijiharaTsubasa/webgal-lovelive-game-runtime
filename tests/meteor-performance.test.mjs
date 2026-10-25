import assert from 'node:assert/strict';
import test from 'node:test';
import { metric, summarizeFrames, textureStorage, summarizeMemory } from './helpers/meteor-performance-metrics.mjs';

test('profiling summaries preserve sample bounds, interpolated percentiles and incomplete GPU-query exclusions', () => {
  assert.deepEqual(metric([]).median, null);
  const p = metric([5, 1, NaN, 4, 3, 2]);
  assert.equal(p.count, 5); assert.equal(p.median, 3); assert.equal(p.p95, 4.8); assert.equal(p.p99, 4.96);
  const records = [100, 116, 150, 200].map((time, i) => ({ time, delta: [.016, .016, .034, .05][i],
    updateMs: i + .1, prepareMs: i + .2, shaderTickMs: i + .3, renderMs: i + .4, totalCpuMs: i + 1,
    drawCalls: 10 + i, triangles: 1000 + i, phaseCpu: i === 0 ? {} : { opaque: i * 2 } }));
  const summary = summarizeFrames(records, [{ valid: true, ms: 3.7 }, { valid: false, ms: 999 }, { valid: true, ms: 5.1 }]);
  assert.equal(summary.gpu.count, 2); assert.equal(summary.gpu.median, 4.4);
  assert.equal(summary.phaseCpu.opaque.measuredInFrames, 3);
  assert.equal(summary.phaseCpu.opaque.min, 0);
  assert.equal(summary.sampleRange.spanBetweenFirstAndLastRafMs, 100);
  assert.equal(summary.raf.intervalsOver25ms, 2);
  assert.equal(summary.raf.intervalsOver50ms, 0);
  assert.equal(summary.raf.estimatedMissed60HzSlots, 3);
});

test('texture and MRT estimates account for mips, shared sources and depth without double counting targets', () => {
  assert.equal(textureStorage({ width: 4, height: 2, bytesPerTexel: 4, generateMipmaps: true }).estimatedBytes, 44);
  assert.equal(textureStorage({ width: 1, height: 1, faces: 6, bytesPerTexel: 4 }).estimatedBytes, 24);
  assert.equal(textureStorage({ width: 4, height: 4, bytesPerTexel: 8, explicitMipDimensions: [[4, 4], [2, 2], [1, 1]] }).estimatedBytes, 168);
  assert.equal(textureStorage({ width: 4, height: 4, bytesPerTexel: null }).estimatedBytes, null);
  const image = { sourceId: 'image', width: 4, height: 2, bytesPerTexel: 4, generateMipmaps: true };
  const target = { sourceId: 'rt', width: 8, height: 4, bytesPerTexel: 8 };
  const result = summarizeMemory({ geometryBuffers: [{ bytes: 12 }, { bytes: 24 }],
    textures: [{ ...image, uuid: 'a' }, { ...image, uuid: 'b' }, { ...target, uuid: 'color0' },
      { ...target, uuid: 'color1' }, { ...target, uuid: 'depth', bytesPerTexel: 4 }],
    renderTargets: [{ uuid: 'mrt', width: 8, height: 4, samples: 0, depthBuffer: true, colorTextureIds: ['color0', 'color1'], depthTextureId: 'depth' }] });
  assert.equal(result.estimates.geometryAttributeUploadBytes, 36);
  assert.equal(result.estimates.nonRenderTargetTextureBytesIfSharedPerSource, 44);
  assert.equal(result.estimates.nonRenderTargetTextureBytesIfAllocatedPerTextureObject, 88);
  assert.equal(result.estimates.renderTargetBytes, 640);
});

