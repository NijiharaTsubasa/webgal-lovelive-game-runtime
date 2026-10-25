import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { meteorArithmetic as scalarSource } from '../packages/garupa_runtime/shaders/meteor-arithmetic.js';
import { meteorArithmetic } from '../packages/garupa_runtime/shaders/meteor-arithmetic-vectors.js';

const names = ['meteor_half', 'meteor_fma32', 'meteor_fma16'];
const definitions = [...meteorArithmetic.matchAll(/\b(float|vec[234])\s+(meteor_half|meteor_fma32|meteor_fma16)\(([^)]*)\)\s*\{([^}]+)\}/g)]
  .map(([, type, name, parameters, body]) => ({ type, name, body,
    parameters: parameters.replace(/\b(?:lowp|mediump|highp)\s+/g, '').split(',').map(value => value.trim().split(/\s+/)) }));

test('scalar and vector shader APIs are declared once in readable combined source', async () => {
  assert.ok(meteorArithmetic.startsWith(scalarSource));
  assert.equal(meteorArithmetic.indexOf(scalarSource, scalarSource.length), -1);
  assert.equal(definitions.length, 12);
  for (const name of names) for (const type of ['float', 'vec2', 'vec3', 'vec4']) {
    const found = definitions.filter(item => item.name === name && item.type === type);
    assert.equal(found.length, 1, `${name} ${type}`);
    assert.deepEqual(found[0].parameters.map(([argumentType]) => argumentType), Array(name === 'meteor_half' ? 1 : 3).fill(type));
  }
  const moduleSource = await readFile(new URL('../packages/garupa_runtime/shaders/meteor-arithmetic-vectors.js', import.meta.url), 'utf8');
  assert.match(moduleSource, /\r?\n(?:(?:lowp|mediump|highp)\s+)?vec2\s+meteor_half/);
  assert.ok(!moduleSource.includes('\\n') && !meteorArithmetic.includes('\\n'));
});

// These GLSL bodies use componentwise arithmetic. Evaluate the actual body for
// each component to check formulas and operand independence, without emulating
// GPU precision, contraction, or half rounding.
function scalarEvaluation(definition, values) {
  const body = definition.body.replace(/\b(?:lowp|mediump|highp)\s+/g, '')
    .replace(/\b(?:float|vec[234])\s+(\w+)/g, 'let $1');
  const run = new Function(...definition.parameters.map(([, name]) => name), body);
  return run(...values);
}

test('FMA APIs retain multiply-add operands at non-endpoints with independent vector components', () => {
  const operands = [[-.731, 2.193, .047, -5.379], [3.271, -.413, 7.193, .179], [.239, 1.713, -.597, 2.371]];
  for (const definition of definitions.filter(item => item.name !== 'meteor_half')) {
    const width = definition.type === 'float' ? 1 : Number(definition.type.slice(3));
    for (let lane = 0; lane < width; lane++) {
      const values = operands.map(operand => operand[lane]);
      const expected = values[0] * values[1] + values[2];
      const actual = scalarEvaluation(definition, values);
      assert.ok(Math.abs(actual - expected) < 1e-12, `${definition.name}/${definition.type}/${lane}`);
    }
  }
});

test('half APIs retain each source component without clamping or color conversion', () => {
  const values = [-2.371, .193, 3.719, -.047];
  for (const definition of definitions.filter(item => item.name === 'meteor_half')) {
    const width = definition.type === 'float' ? 1 : Number(definition.type.slice(3));
    for (let lane = 0; lane < width; lane++) {
      assert.equal(scalarEvaluation(definition, [values[lane]]), values[lane]);
    }
  }
});
