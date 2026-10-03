import test from 'node:test';
import assert from 'node:assert/strict';
import { verticalSilhouetteGap } from '../packages/llas_runtime/adapters/llas-eyelid-line.js';

test('eyelid travel uses the matching X silhouette rather than global bounding boxes', () => {
  const upper = [[{ x: 0, y: 1 }, { x: 2, y: 3 }]];
  const lower = [[{ x: 0, y: 0 }, { x: 2, y: 2 }]];
  assert.equal(verticalSilhouetteGap(upper, lower), 1);
  assert.equal(verticalSilhouetteGap(upper.map(e => [...e].reverse()), lower), 1);
  const peak = [[{ x: .75, y: .9 }, { x: .9, y: 1.8 }],
    [{ x: .9, y: 1.8 }, { x: 1.25, y: 1 }]];
  assert.ok(Math.abs(verticalSilhouetteGap(upper, peak) - .1) < 1e-12);
});

test('vertical edges, authored overlap and disjoint projections remain distinguishable', () => {
  const upper = [[{ x: 0, y: 1 }, { x: 1, y: 1 }]];
  assert.equal(verticalSilhouetteGap(upper, [[{ x: .5, y: 0 }, { x: .5, y: .8 }]]), 1 - .8);
  assert.equal(verticalSilhouetteGap(upper, [[{ x: .5, y: 0 }, { x: .5, y: 1.1 }]]), 1 - 1.1);
  assert.equal(verticalSilhouetteGap(upper, [[{ x: 2, y: 0 }, { x: 3, y: 0 }]]), Infinity);
});
