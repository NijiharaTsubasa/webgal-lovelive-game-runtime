// Package-local selection after the standard named-section loader has joined
// each configured array. The renderer and its section protocol stay unchanged.
const cache = new Map();
const positions = ['vertexPrelude', 'vertexProject', 'fragmentPrelude', 'fragmentBody'];

function parse(source) {
  if (typeof source !== 'string' || !source.length) throw new Error('Meteor requires loaded named sections');
  // Shader files checked out on Windows may contain CRLF line endings.
  source = source.replaceAll('\r\n', '\n');
  if (cache.has(source)) return cache.get(source);
  const tokens = [], programs = new Set();
  const pattern = /^\/\/ @meteor-program (METEOR_(?:VERTEX|FRAGMENT)_[a-f0-9]{12})\n([\s\S]*?)\n\/\/ @meteor-end \1(?=\n|$)/gm;
  let offset = 0;
  for (const match of source.matchAll(pattern)) {
    if (programs.has(match[1])) throw new Error(`Duplicate Meteor section program ${match[1]}`);
    if (!match[2].startsWith(`#if defined(${match[1]})\n`) || !match[2].endsWith('\n#endif') || /@meteor-(?:program|end)\b/.test(match[2])) {
      throw new Error(`Malformed Meteor section program ${match[1]}`);
    }
    programs.add(match[1]);
    tokens.push(source.slice(offset, match.index), { define: match[1], code: match[2] });
    offset = match.index + match[0].length;
  }
  tokens.push(source.slice(offset));
  if (!programs.size || tokens.some(token => typeof token === 'string' && /@meteor-(?:program|end)\b/.test(token))) {
    throw new Error('Malformed or missing Meteor program section markers');
  }
  const result = { tokens, programs, selected: new Map() };
  cache.set(source, result);
  return result;
}

export function prepareMeteorSections(sections) {
  return Object.fromEntries(positions.map(position => [position, parse(sections?.[position])]));
}

export function selectMeteorSections(prepared, vertexDefine, fragmentDefine) {
  return Object.fromEntries(positions.map(position => {
    const define = position.startsWith('vertex') ? vertexDefine : fragmentDefine;
    const section = prepared[position];
    if (!section.programs.has(define)) throw new Error(`Meteor ${position} has no named program ${define}`);
    if (!section.selected.has(define)) {
      section.selected.set(define, section.tokens.map(token => typeof token === 'string' ? token : token.define === define ? token.code : '').join(''));
    }
    return [position, section.selected.get(define)];
  }));
}
