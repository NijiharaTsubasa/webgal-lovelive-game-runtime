// LiveMemberAnimationMask: ProcessFrameMask 0x27C5858, UpdateAnimationMask
// 0x27C594C. The converter supplies native-Unity visibility snapshots.
// The ordered Morph signal list is our input adapter, not a recovered Timeline.
export default class BoardFace {
  constructor(context, declarations) {
    if (declarations.length !== 1 || declarations[0].role !== 'integrated') {
      throw new Error('LLAS.BoardFace requires one integrated declaration');
    }
    this.context = context;
    this.parameters = declarations[0].parameters;
    this.domains = [];
  }

  Awake() {
    const {inputNode, minRateToActive, domains} = this.parameters;
    if (!Number.isFinite(minRateToActive) || minRateToActive <= 0 || minRateToActive > 1) {
      throw new Error('LLAS.BoardFace invalid activation threshold');
    }
    if (!Array.isArray(domains) || !domains.length) throw new Error('LLAS.BoardFace missing domains');
    const input = this.context.resolveNode('integrated', inputNode);
    const carriers = [];
    input.traverse(node => {
      if (node.isMesh && node.morphTargetInfluences && node.morphTargetDictionary) carriers.push(node);
    });
    if (carriers.length !== 1) throw new Error('LLAS.BoardFace requires one signal primitive');
    this.input = input;
    this.carrier = carriers[0];
    this.threshold = minRateToActive;
    const owned = new Set(), signals = new Set(), domainNames = new Set();
    const bind = (values, expected) => {
      if (!values || typeof values !== 'object' || Array.isArray(values)) throw new Error('Invalid board visibility map');
      const keys = Object.keys(values).sort();
      if (!keys.length || (expected && (keys.length !== expected.length || keys.some((k,i) => k !== expected[i])))) {
        throw new Error('Board visibility snapshot must cover its complete domain');
      }
      return keys.map(name => {
        if (typeof values[name] !== 'boolean') throw new Error('Board visibility must be boolean');
        const node = this.context.resolveNode('integrated', name);
        if (node === input) throw new Error('Board output cannot own its input node');
        return {node, value: values[name]};
      });
    };
    const domainsResolved = domains.map(domain => {
      if (!domain.name || domainNames.has(domain.name)) throw new Error('Duplicate or empty board domain');
      domainNames.add(domain.name);
      const keys = Object.keys(domain.defaults).sort();
      const defaults = bind(domain.defaults);
      for (const {node} of defaults) {
        if (owned.has(node)) throw new Error('Board domains must not share visibility outputs');
        owned.add(node);
      }
      if (!Array.isArray(domain.entries) || !domain.entries.length) throw new Error('Missing board entries');
      const entries = domain.entries.map(entry => {
        const index = this.carrier.morphTargetDictionary[entry.morph];
        if (!Number.isInteger(index) || index < 0 || index >= this.carrier.morphTargetInfluences.length || signals.has(index)) {
          throw new Error(`Invalid or duplicate board signal ${entry.morph}`);
        }
        signals.add(index);
        return {index, visibility: bind(entry.visibility, keys)};
      });
      return {defaults, entries};
    });
    // Validate every reference before touching scene state.
    this.domains = domainsResolved;
    this.input.visible = false;
    this.restoreDefaults();
  }

  restoreDefaults() {
    for (const domain of this.domains) for (const {node, value} of domain.defaults) node.visible = value;
  }

  LateUpdate() {
    const weights = this.carrier.morphTargetInfluences;
    const selected = this.domains.map(domain => {
      // StartProcessFrame clears all clip input weights. A lower-weight request
      // does not cancel the last qualifying request in this frame. No argmax.
      let visibility = domain.defaults;
      for (const entry of domain.entries) {
        const weight = weights[entry.index];
        if (!Number.isFinite(weight)) throw new Error('Non-finite board signal');
        if (weight < this.threshold) continue;
        visibility = entry.visibility;
      }
      return visibility;
    });
    for (const visibility of selected) for (const {node, value} of visibility) node.visible = value;
  }

  OnDisable() { this.restoreDefaults(); }
  OnDestroy() { this.restoreDefaults(); this.domains = []; }
}
