import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCostumeBatches, createCostumeSchedule, firstMatchingPass, selectDraws }
  from '../packages/garupa_runtime/render-profiles/meteor-schedule.js';

const pass = (id, lightMode = id) => ({ id, lightMode });
const draw = (name, layer, renderQueue, passes) => ({ name, layer, renderQueue, passes });
const names = batch => batch.map(item => `${item.record.name}:${item.pass.id}`);

test('Costume batches preserve layers, queues and first tag match', () => {
  const records = [
    draw('body', 0, 2000, [pass('Forward', 'UniversalForward'), pass('Outline', 'OutlineExtension')]),
    draw('hair', 20, 3000, [pass('Forward', 'UniversalForward'), pass('Accumulate'), pass('AlphaOnly')]),
    draw('offset', 25, 3000, [pass('Forward', 'SRPDEFAULTUNLIT'), pass('Offset', 'UniversalForward'),
      pass('AlphaWriteOffBase'), pass('AlphaWriteOffOffset')]),
    draw('fallback', 26, 3000, [pass('AlphaWriteOffOffset')]),
    draw('ordinary', 0, 3000, [pass('Forward', 'UniversalForward')]),
    draw('tooEarly', 20, -1, [pass('Accumulate')]),
    draw('tooLate', 20, 5001, [pass('Accumulate')]),
  ];
  const batches = buildCostumeBatches(records);
  assert.deepEqual(names(batches.opaque), ['body:Forward']);
  assert.deepEqual(names(batches.outline), ['body:Outline']);
  assert.deepEqual(names(batches.accumulate), ['hair:Accumulate']);
  assert.deepEqual(names(batches.transparent), ['ordinary:Forward']);
  assert.deepEqual(names(batches.alphaWriteOff), ['offset:AlphaWriteOffBase', 'fallback:AlphaWriteOffOffset']);
});

test('standard tags select uppercase SRPDEFAULTUNLIT before UniversalForward', () => {
  assert.equal(firstMatchingPass([pass('Offset', 'UniversalForward'), pass('Forward', 'SRPDEFAULTUNLIT')],
    ['SRPDefaultUnlit', 'UniversalForward']).id, 'Forward');
  assert.equal(firstMatchingPass([pass('AlphaOnly')], ['Accumulate']), null);
});

test('queue endpoints and signed layer 31 keep Unity membership', () => {
  const records = [draw('lastOpaque', 31, 2500, [pass('Forward')]),
    draw('firstTransparent', 31, 2501, [pass('Forward')]), draw('lastTransparent', 31, 5000, [pass('Forward')])];
  const select = transparent => names(selectDraws(records, { tags: ['Forward'], transparent, layerMask: 0x80000000 }));
  assert.deepEqual(select(false), ['lastOpaque:Forward']);
  assert.deepEqual(select(true), ['firstTransparent:Forward', 'lastTransparent:Forward']);
  assert.throws(() => buildCostumeBatches([draw('invalid', 32, 2000, [])]), /layer/);
  assert.throws(() => buildCostumeBatches([draw('invalid', 0, NaN, [])]), /renderQueue/);
});

test('OIT first setup primes; second invocation runs the recorded command order', () => {
  const schedule = createCostumeSchedule();
  const invoke = success => {
    const commands = [];
    schedule.render({ setup: () => { commands.push('setup'); return success; }, command: id => commands.push(id) });
    return commands;
  };
  assert.deepEqual(invoke(true), ['globals', 'setup', 'opaque', 'outline', 'transparent', 'alphaWriteOff']);
  assert.deepEqual(invoke(true), ['globals', 'setup', 'opaque', 'outline', 'copyDepthIn', 'bindOitMrt',
    'clearOit', 'accumulate', 'saveSourceColor', 'bindOitGlobals', 'compositeForBlendBuffer',
    'copyDepthBack', 'transparent', 'alphaWriteOff']);
});

test('setup failure does not retract previously enqueued OIT; next failure skips it', () => {
  const schedule = createCostumeSchedule();
  const invoke = success => {
    const commands = [];
    schedule.render({ setup: () => success, command: id => commands.push(id) }); return commands;
  };
  invoke(true);
  assert.ok(invoke(false).includes('accumulate'));
  assert.ok(!invoke(false).includes('accumulate'));
});

test('preview preserves carried setup state and destroy resets it', () => {
  const schedule = createCostumeSchedule();
  schedule.render({ setup: () => true, command() {} });
  const commands = [];
  schedule.render({ preview: true, setup() { throw new Error('preview must skip setup'); }, command: id => commands.push(id) });
  assert.ok(commands.includes('accumulate'));
  schedule.destroy();
  const reset = [];
  schedule.render({ setup: () => true, command: id => reset.push(id) });
  assert.ok(!reset.includes('accumulate'));
});
