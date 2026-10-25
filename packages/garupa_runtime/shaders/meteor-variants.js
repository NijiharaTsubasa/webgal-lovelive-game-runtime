import { meteorVariantRows } from './meteor-variant-data.js';

function keywordSet(value, label) {
  if (!Array.isArray(value) || value.some(k => typeof k !== 'string' || !k.length)) {
    throw new TypeError(`${label} must be an explicit array of nonempty keyword strings`);
  }
  return [...new Set(value)].sort();
}

const equal = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

/** Select one evidence-backed program. Unrelated global keywords are ignored;
 * every keyword in this pass/stage's retained global universe is significant.
 * Both enabled and disabled state must be represented by the explicit array.
 * This selects source identity only; it does not schedule or render a pass.
 */
export function selectMeteorVariant({ shader, pass, stage, materialKeywords, globalKeywords }) {
  const material = keywordSet(materialKeywords, 'materialKeywords');
  const globals = keywordSet(globalKeywords, 'globalKeywords');
  const rows = meteorVariantRows.filter(r => r.shader === shader &&
    (r.stable_key === pass || r.pass_name === pass) && r.stage === stage &&
    equal(keywordSet(r.observed_material_keywords, 'stored material keywords'), material));
  if (rows.length !== 1) {
    throw new Error(`Unobserved or ambiguous shader/pass/stage/material combination: ${shader} / ${pass} / ${stage}`);
  }
  return selectMeteorProgramCandidate(rows[0].matching_programs, globals, rows[0].global_keyword_universe);
}

/** Exact global-state selector, also usable to validate a candidate table. */
export function selectMeteorProgramCandidate(candidates, globalKeywords, globalKeywordUniverse) {
  const globals = keywordSet(globalKeywords, 'globalKeywords');
  const universe = keywordSet(globalKeywordUniverse, 'globalKeywordUniverse');
  const relevant = globals.filter(k => universe.includes(k));
  const matched = candidates.filter(p => equal(keywordSet(p.non_material_keywords, 'non_material_keywords'), relevant));
  if (matched.length !== 1) {
    throw new Error(`Global keyword state selects ${matched.length} programs; exactly one evidence-backed candidate is required`);
  }
  return matched[0];
}
