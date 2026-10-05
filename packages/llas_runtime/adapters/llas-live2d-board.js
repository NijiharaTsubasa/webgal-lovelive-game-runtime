// Cross-medium pattern selection; the native BoardFace visibility recipes
// remain the authority for the artwork and the complete visibility domain.
const required = {
  eye: ['Open', 'Close', 'CloseSmile', 'WinkL', 'WinkR', 'Angry', 'Trouble', 'Sad', 'Shy', 'WideOpen'],
  mouth: ['Smile', 'N', 'A', 'O', 'Laugh', 'Angry', 'Trouble', 'Sad', 'Shy'],
};
const eyeByMood = {angry: 'Angry', trouble: 'Trouble', sad: 'Sad', shy: 'Shy', surprise: 'WideOpen', smile: 'CloseSmile', neutral: 'Open'};
const mouthByMood = {angry: 'Angry', trouble: 'Trouble', sad: 'Sad', shy: 'Shy', surprise: 'N', smile: 'Smile', neutral: 'N'};
const domainNames = ['eye', 'mouth'];
function value(parameters, name, fallback = 0) {
  const v = parameters[name] ?? fallback;
  if (!Number.isFinite(v)) throw new Error(`Non-finite board parameter: ${name}`);
  return v;
}

export class BoardParameterSelection {
  constructor() {
    this.closedL = false;
    this.closedR = false;
    this.speaking = false;
    this.largeMouth = false;
    this.roundMouth = false;
    this.smileEyes = false;
    this.result = {eye: 'Open', mouth: 'Smile', mood: 'neutral'};
  }

  update(parameters) {
    const l = value(parameters, 'PARAM_EYE_L_OPEN', 1), r = value(parameters, 'PARAM_EYE_R_OPEN', 1);
    const smile = (value(parameters, 'PARAM_EYE_L_SMILE') + value(parameters, 'PARAM_EYE_R_SMILE')) * .5;
    const browY = (value(parameters, 'PARAM_BROW_L_Y') + value(parameters, 'PARAM_BROW_R_Y')) * .5;
    const browAngle = (value(parameters, 'PARAM_BROW_L_ANGLE') + value(parameters, 'PARAM_BROW_R_ANGLE')) * .5;
    const browForm = (value(parameters, 'PARAM_BROW_L_FORM') + value(parameters, 'PARAM_BROW_R_FORM')) * .5;
    const eyeForm = value(parameters, 'PARAM_EYE_FORM');
    const mouthForm = value(parameters, 'PARAM_MOUTH_FORM_01'), mouthOpen = value(parameters, 'PARAM_MOUTH_OPEN_Y');
    const cheek = value(parameters, 'PARAM_CHEEK'), cheek2 = value(parameters, 'PARAM_CHEEK2');
    // Schmitt bands act on values, not elapsed time, so brief blinks survive.
    const previous = this.result.mood;
    let mood = 'neutral';
    if (browAngle < -.5 + (previous === 'angry' ? .04 : 0) && (browY < -.2 + (previous === 'angry' ? .04 : 0) || mouthForm < -.18 + (previous === 'angry' ? .04 : 0))) mood = 'angry';
    else if (eyeForm > .4 - (previous === 'sad' ? .04 : 0) || (browY < -.3 + (previous === 'sad' ? .04 : 0) && browForm < -.55 + (previous === 'sad' ? .04 : 0))) mood = 'sad';
    else if (mouthForm < -.18 + (previous === 'trouble' ? .04 : 0) && browForm < -.25 + (previous === 'trouble' ? .04 : 0)) mood = 'trouble';
    else if (mouthForm >= -.05 - (previous === 'shy' ? .04 : 0) && (cheek > .4 - (previous === 'shy' ? .04 : 0) || (cheek > .2 - (previous === 'shy' ? .04 : 0) && cheek2 > .65 - (previous === 'shy' ? .04 : 0)))) mood = 'shy';
    else if (Math.min(l, r) > 1.18 - (previous === 'surprise' ? .04 : 0)) mood = 'surprise';
    else if (mouthForm > .15 - (previous === 'smile' ? .04 : 0) || smile > .55 - (previous === 'smile' ? .04 : 0)) mood = 'smile';
    this.closedL = l <= (this.closedL ? .28 : .18);
    this.closedR = r <= (this.closedR ? .28 : .18);
    this.speaking = mouthOpen >= (this.speaking ? .12 : .2);
    this.largeMouth = mouthOpen >= (this.largeMouth ? .5 : .6);
    this.roundMouth = mouthForm < (this.roundMouth ? -.14 : -.18);
    this.smileEyes = smile >= (this.smileEyes ? .51 : .55);
    let eye;
    if (this.closedL && this.closedR) eye = (mood === 'smile' || mood === 'shy') ? 'CloseSmile' : 'Close';
    else if (this.closedL) eye = 'WinkL';
    else if (this.closedR) eye = 'WinkR';
    else eye = mood === 'smile' && !this.smileEyes ? 'Open' : eyeByMood[mood];
    let mouth;
    if (this.speaking) mouth = mood === 'smile' || mood === 'shy' ? 'Laugh' : (this.roundMouth || !this.largeMouth ? 'O' : 'A');
    else mouth = mouthByMood[mood];
    this.result.eye = eye;
    this.result.mouth = mouth;
    this.result.mood = mood;
    return this.result;
  }
}

function bind(context) {
  const declarations = [];
  for (const part of context.parts) for (const behavior of part.component.behaviors ?? []) {
    if (behavior.name === 'LLAS.BoardFace') declarations.push({role: part.role, parameters: behavior.parameters});
  }
  if (!declarations.length) return null;
  if (declarations.length !== 1 || declarations[0].role !== 'integrated') throw new Error('Board adapter requires one integrated LLAS.BoardFace');
  const {inputNode, domains} = declarations[0].parameters;
  if (!Array.isArray(domains) || domains.length !== 2) throw new Error('Board adapter requires eye and mouth domains');
  const input = context.resolveNode('integrated', inputNode);
  if (!input) throw new Error('Missing board signal node');
  const carriers = [];
  input.traverse(node => { if (node.isMesh && node.morphTargetInfluences && node.morphTargetDictionary) carriers.push(node); });
  if (carriers.length !== 1) throw new Error('Board adapter requires one signal primitive');
  const nodes = [], recipes = {}, owned = new Set(), signals = new Set();
  for (const domain of domains) {
    if (!required[domain.name] || recipes[domain.name]) throw new Error('Invalid board adapter domain');
    if (!domain.defaults || typeof domain.defaults !== 'object' || Array.isArray(domain.defaults)) throw new Error('Invalid board defaults');
    const names = Object.keys(domain.defaults).sort();
    if (!names.length) throw new Error('Empty board visibility domain');
    const offset = nodes.length;
    for (const name of names) {
      const node = context.resolveNode('integrated', name);
      if (!node || node === input || owned.has(node)) throw new Error(`Invalid board output: ${name}`);
      owned.add(node);
      nodes.push(node);
    }
    const snapshot = (map) => {
      if (!map || typeof map !== 'object' || Array.isArray(map)) throw new Error('Invalid board visibility snapshot');
      const keys = Object.keys(map).sort();
      if (keys.length !== names.length || keys.some((k, i) => k !== names[i])) throw new Error('Board snapshot must cover its complete domain');
      const values = new Uint8Array(names.length);
      for (let i = 0; i < names.length; i++) {
        if (typeof map[names[i]] !== 'boolean') throw new Error('Board visibility must be boolean');
        values[i] = Number(map[names[i]]);
      }
      return values;
    };
    snapshot(domain.defaults);
    if (!Array.isArray(domain.entries)) throw new Error('Missing board entries');
    const options = Object.create(null);
    for (const entry of domain.entries) {
      const index = carriers[0].morphTargetDictionary[entry.morph];
      if (!Number.isInteger(index) || index < 0 || index >= carriers[0].morphTargetInfluences.length || signals.has(index)) throw new Error(`Invalid board signal: ${entry.morph}`);
      signals.add(index);
      const prefix = `${domain.name}/`;
      if (!entry.morph.startsWith(prefix)) throw new Error('Board signal domain mismatch');
      options[entry.morph.slice(prefix.length)] = snapshot(entry.visibility);
    }
    for (const key of required[domain.name]) if (!options[key]) throw new Error(`Missing board recipe: ${domain.name}/${key}`);
    recipes[domain.name] = {offset, options};
  }
  return {nodes, recipes};
}

export function createExpressionAdapter(context) {
  const binding = bind(context);
  if (!binding) return null;
  const selection = new BoardParameterSelection();
  const saved = new Uint8Array(binding.nodes.length);
  let applied = false, disposed = false;
  const restore = () => {
    if (!applied) return;
    for (let i = 0; i < binding.nodes.length; i++) {
      const visible = Boolean(saved[i]);
      if (binding.nodes[i].visible !== visible) binding.nodes[i].visible = visible;
    }
    applied = false;
  };
  return {
    restore,
    apply(parameters) {
      if (disposed) return;
      const result = selection.update(parameters);
      restore();
      for (let i = 0; i < binding.nodes.length; i++) saved[i] = Number(binding.nodes[i].visible);
      applied = true;
      for (const name of domainNames) {
        const {offset, options} = binding.recipes[name], values = options[result[name]];
        for (let i = 0; i < values.length; i++) {
          const node = binding.nodes[offset + i], visible = Boolean(values[i]);
          if (node.visible !== visible) node.visible = visible;
        }
      }
      return result;
    },
    dispose() { restore(); disposed = true; },
  };
}
