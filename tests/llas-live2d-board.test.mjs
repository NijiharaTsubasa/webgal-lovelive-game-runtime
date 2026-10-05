import test from 'node:test';
import assert from 'node:assert/strict';
import {BoardParameterSelection, createExpressionAdapter} from '../packages/llas_runtime/adapters/llas-live2d-board.js';

const patterns = {
  eye: ['Open', 'Close', 'CloseSmile', 'WinkL', 'WinkR', 'Angry', 'Trouble', 'Sad', 'Shy', 'WideOpen'],
  mouth: ['Smile', 'N', 'A', 'O', 'Laugh', 'Angry', 'Trouble', 'Sad', 'Shy'],
};
function fixture() {
  const nodes = new Map(), dictionary = {}, weights = [];
  const domains = Object.entries(patterns).map(([name, choices]) => {
    const defaults = Object.fromEntries(choices.map((choice, i) => [`${name}_${choice}`, i === 0]));
    for (const [key, visible] of Object.entries(defaults)) nodes.set(key, {visible});
    return {name, defaults, entries: choices.map(choice => {
      const morph = `${name}/${choice}`;
      dictionary[morph] = weights.length;
      weights.push(0);
      return {morph, visibility: Object.fromEntries(choices.map(key => [`${name}_${key}`, key === choice]))};
    })};
  });
  const carrier = {isMesh: true, morphTargetDictionary: dictionary, morphTargetInfluences: weights};
  nodes.set('input', {visible: false, traverse: fn => fn(carrier)});
  const parameters = {inputNode: 'input', domains};
  return {nodes, weights, parameters, context: {
    parts: [{role: 'integrated', component: {behaviors: [{name: 'LLAS.BoardFace', parameters}]}}],
    resolveNode: (role, name) => nodes.get(name),
  }};
}
const brows = (field, number) => ({[`PARAM_BROW_L_${field}`]: number, [`PARAM_BROW_R_${field}`]: number});
const eyes = (field, number) => ({[`PARAM_EYE_L_${field}`]: number, [`PARAM_EYE_R_${field}`]: number});

test('neutral, smile, angry, depressed, trouble, surprise and shy use combined scalar evidence', () => {
  const select = p => ({...new BoardParameterSelection().update(p)});
  assert.deepEqual(select({}), {eye: 'Open', mouth: 'N', mood: 'neutral'});
  assert.equal(select({PARAM_MOUTH_FORM_01: .25}).mood, 'smile');
  assert.equal(select({...eyes('OPEN', .69), PARAM_MOUTH_FORM_01: .25}).eye, 'Open');
  assert.equal(select({...eyes('SMILE', .8), PARAM_MOUTH_FORM_01: .25}).eye, 'CloseSmile');
  assert.equal(select({...brows('ANGLE', -1), ...brows('Y', -.67), PARAM_MOUTH_FORM_01: -.4}).mood, 'angry');
  assert.equal(select({PARAM_EYE_FORM: .7, ...eyes('SMILE', 1), PARAM_MOUTH_FORM_01: -.5}).eye, 'Sad');
  // The real kandou-style combination is not a smile or a CHEEK2 blush.
  assert.equal(select({...brows('FORM', -1), ...eyes('SMILE', .97), PARAM_MOUTH_FORM_01: -.32, PARAM_CHEEK: .27, PARAM_CHEEK2: 1}).mood, 'trouble');
  // Wide eyes also occur in worried faces; worried brows and mouth take priority.
  assert.equal(select({...eyes('OPEN', 1.5), ...brows('FORM', -1), PARAM_MOUTH_FORM_01: -.5}).eye, 'Trouble');
  assert.equal(select({...eyes('OPEN', 1.5), PARAM_MOUTH_FORM_01: -1}).eye, 'WideOpen');
  assert.equal(select({...eyes('OPEN', 1.5), PARAM_MOUTH_FORM_01: -1}).mouth, 'N');
  assert.equal(select({...eyes('OPEN', 1.5), PARAM_MOUTH_FORM_01: -1, PARAM_MOUTH_OPEN_Y: .5}).mouth, 'O');
  assert.equal(select({PARAM_CHEEK: .54, PARAM_MOUTH_FORM_01: .03}).mood, 'shy');
  assert.equal(select({PARAM_CHEEK: .29, PARAM_CHEEK2: .86, PARAM_MOUTH_FORM_01: .5}).mood, 'shy');
  assert.equal(select({PARAM_CHEEK2: .8}).mood, 'neutral');
});

test('short blinks and anatomical winks override moods immediately, independently of hysteresis', () => {
  const state = new BoardParameterSelection();
  const anger = {...brows('ANGLE', -.8), PARAM_MOUTH_FORM_01: -.4};
  assert.equal(state.update(anger).eye, 'Angry');
  assert.equal(state.update({...anger, ...eyes('OPEN', .17)}).eye, 'Close');
  assert.equal(state.update({...anger, ...eyes('OPEN', .24)}).eye, 'Close');
  assert.equal(state.update({...anger, ...eyes('OPEN', .29)}).eye, 'Angry');
  assert.equal(state.update({PARAM_EYE_L_OPEN: 0, PARAM_EYE_R_OPEN: .66, PARAM_CHEEK2: .79, PARAM_MOUTH_FORM_01: .5}).eye, 'WinkL');
  assert.equal(state.update({PARAM_EYE_R_OPEN: 0, PARAM_EYE_L_OPEN: .66}).eye, 'WinkR');
  assert.equal(state.update({...eyes('OPEN', 0), PARAM_MOUTH_FORM_01: .5}).eye, 'CloseSmile');
});

test('compound mood boundaries retain sadness, shyness and anger through small oscillations then release', () => {
  const state = new BoardParameterSelection();
  const sad = {...brows('Y', -.4), ...brows('FORM', -.56), PARAM_MOUTH_FORM_01: -.4};
  assert.equal(state.update(sad).mood, 'sad');
  for (const form of [-.54, -.56, -.54]) {
    assert.equal(state.update({...sad, ...brows('FORM', form)}).mood, 'sad');
  }
  assert.equal(state.update({...sad, ...brows('FORM', -.49)}).mood, 'trouble');
  const shy = {PARAM_CHEEK: .3, PARAM_CHEEK2: .66, PARAM_MOUTH_FORM_01: -.04};
  assert.equal(state.update(shy).mood, 'shy');
  for (const [cheek2, mouth] of [[.64, -.06], [.66, -.04], [.64, -.06]]) {
    assert.equal(state.update({...shy, PARAM_CHEEK2: cheek2, PARAM_MOUTH_FORM_01: mouth}).mood, 'shy');
  }
  assert.equal(state.update({...shy, PARAM_CHEEK2: .60}).mood, 'neutral');
  assert.equal(state.update(shy).mood, 'shy');
  assert.equal(state.update({...shy, PARAM_MOUTH_FORM_01: -.1}).mood, 'neutral');
  const angry = {...brows('ANGLE', -.6), ...brows('Y', -.21)};
  assert.equal(state.update(angry).mood, 'angry');
  assert.equal(state.update({...angry, ...brows('Y', -.19)}).mood, 'angry');
  assert.equal(state.update({...angry, ...brows('Y', -.15)}).mood, 'neutral');
  assert.equal(state.update({...brows('ANGLE', -.6), PARAM_MOUTH_FORM_01: -.19}).mood, 'angry');
  assert.equal(state.update({...brows('ANGLE', -.6), PARAM_MOUTH_FORM_01: -.17}).mood, 'angry');
  assert.equal(state.update({...brows('ANGLE', -.6), PARAM_MOUTH_FORM_01: -.13}).mood, 'neutral');
});

test('mouth amplitudes retain a stable pattern near boundaries and close without random phonemes', () => {
  const state = new BoardParameterSelection(), input = {PARAM_MOUTH_OPEN_Y: .21};
  assert.equal(state.update(input).mouth, 'O');
  input.PARAM_MOUTH_OPEN_Y = .15;
  assert.equal(state.update(input).mouth, 'O');
  input.PARAM_MOUTH_OPEN_Y = .11;
  assert.equal(state.update(input).mouth, 'N');
  input.PARAM_MOUTH_OPEN_Y = .61;
  assert.equal(state.update(input).mouth, 'A');
  input.PARAM_MOUTH_OPEN_Y = .55;
  assert.equal(state.update(input).mouth, 'A');
  input.PARAM_MOUTH_OPEN_Y = .49;
  assert.equal(state.update(input).mouth, 'O');
  assert.equal(state.update({...input, PARAM_MOUTH_FORM_01: .3}).mouth, 'Laugh');
  input.PARAM_MOUTH_OPEN_Y = .8;
  input.PARAM_MOUTH_FORM_01 = -.19;
  assert.equal(state.update(input).mouth, 'O');
  input.PARAM_MOUTH_FORM_01 = -.17;
  assert.equal(state.update(input).mouth, 'O');
  input.PARAM_MOUTH_FORM_01 = -.13;
  assert.equal(state.update(input).mouth, 'A');
  input.PARAM_MOUTH_FORM_01 = -.17;
  assert.equal(state.update(input).mouth, 'A');
  assert.throws(() => state.update({PARAM_MOUTH_OPEN_Y: NaN}), /Non-finite/);
});

test('full visibility snapshots restore the current native underlay, leaving signals and unrelated nodes untouched', () => {
  const f = fixture(), adapter = createExpressionAdapter(f.context);
  const initial = [...f.nodes].map(([name, node]) => [name, node.visible]);
  f.weights.fill(.65);
  adapter.apply({...eyes('SMILE', .8), PARAM_MOUTH_FORM_01: .5});
  assert.equal(f.nodes.get('eye_CloseSmile').visible, true);
  assert.equal(f.nodes.get('eye_Open').visible, false);
  assert.equal(f.nodes.get('mouth_Smile').visible, true);
  assert.deepEqual(f.weights, f.weights.map(() => .65));
  // Repeated application cannot snapshot its own override as native state.
  adapter.apply({...brows('ANGLE', -1), PARAM_MOUTH_FORM_01: -.4});
  adapter.restore();
  assert.deepEqual([...f.nodes].map(([name, node]) => [name, node.visible]), initial);
  // Native BoardFace can change its underlay after restore, before next apply.
  f.nodes.get('eye_Open').visible = false;
  f.nodes.get('eye_Sad').visible = true;
  adapter.apply({});
  adapter.dispose();
  assert.equal(f.nodes.get('eye_Sad').visible, true);
  assert.equal(f.nodes.get('eye_Open').visible, false);
  adapter.dispose();
  adapter.apply({});
  assert.equal(f.nodes.get('eye_Sad').visible, true);
});

test('unchanged visibility is not written while complete underlay capture remains active', () => {
  const f = fixture();
  let writes = 0;
  for (const node of f.nodes.values()) {
    let visible = node.visible;
    Object.defineProperty(node, 'visible', {get: () => visible, set: next => {writes++; visible = next;}});
  }
  const adapter = createExpressionAdapter(f.context);
  adapter.apply({});
  // Neutral eyes already match. Mouth Smile -> N changes exactly two nodes.
  assert.equal(writes, 2);
  adapter.restore();
  assert.equal(writes, 4);
  adapter.restore();
  adapter.dispose();
  assert.equal(writes, 4);
});

test('binding rejects incomplete/ambiguous metadata before touching any visibility', () => {
  assert.equal(createExpressionAdapter({parts: [{component: {}}]}), null);
  for (const corrupt of [
    f => delete f.parameters.domains[0].entries[0].visibility.eye_Close,
    f => f.parameters.domains[0].entries.pop(),
    f => f.parameters.domains[0].defaults.eye_Open = 1,
    f => f.context.parts[0].role = 'head',
    f => f.context.parts.push(f.context.parts[0]),
    f => f.parameters.domains[1].name = 'eye',
    f => f.nodes.delete('eye_Close'),
    f => f.parameters.domains[0].entries[1].morph = f.parameters.domains[0].entries[0].morph,
  ]) {
    const f = fixture(), before = [...f.nodes.values()].map(n => n.visible);
    corrupt(f);
    const current = [...f.nodes.values()].map(n => n.visible);
    assert.throws(() => createExpressionAdapter(f.context));
    assert.deepEqual([...f.nodes.values()].map(n => n.visible), current);
    assert.ok(before.length >= current.length);
  }
});
