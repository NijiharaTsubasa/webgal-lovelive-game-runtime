// Projected triangle boundaries are piecewise linear in X. Checking both ends
// of every overlapping edge interval gives the exact vertical silhouette gap,
// including contacts between vertices of the two different meshes.
export function verticalSilhouetteGap(upper, lower) {
  let gap = Infinity;
  for (const [a, b] of upper) for (const [c, d] of lower) {
    const lo = Math.max(Math.min(a.x, b.x), Math.min(c.x, d.x));
    const hi = Math.min(Math.max(a.x, b.x), Math.max(c.x, d.x));
    if (lo > hi) continue;
    const at = (p, q, x, minimum) => p.x === q.x
      ? (minimum ? Math.min(p.y, q.y) : Math.max(p.y, q.y))
      : p.y + (q.y - p.y) * (x - p.x) / (q.x - p.x);
    for (const x of [lo, hi]) gap = Math.min(gap, at(a, b, x, true) - at(c, d, x, false));
  }
  return gap;
}

export function createEyelidTravelConstraint(mesh, regions) {
  const geometry = mesh.geometry, index = geometry.index;
  const uv = geometry.attributes.uv;
  // The neighboring atlas islands include skin masks as well as eyelashes.
  // Only the black lash strip bounds the visible eye opening in projection.
  const lash = i => uv.getX(i) > .25 && uv.getX(i) < .45 && uv.getY(i) > .35 && uv.getY(i) < .39;
  const count = index?.count ?? geometry.attributes.position.count;
  const at = i => index ? index.getX(i) : i;
  const sides = Object.fromEntries(Object.entries(regions).map(([side, { eye, lid, brow }]) => {
    const edges = [new Map(), new Map(), new Map()];
    for (let i = 0; i < count; i += 3) {
      const tri = [at(i), at(i + 1), at(i + 2)];
      const group = tri.every(j => lid[j]) ? 0 : tri.every(j => eye[j] && !lid[j] && lash(j)) ? 1
        : tri.every(j => brow[j]) ? 2 : -1;
      if (group < 0) continue;
      for (let j = 0; j < 3; j++) {
        const a = tri[j], b = tri[(j + 1) % 3];
        edges[group].set(`${Math.min(a, b)},${Math.max(a, b)}`, [a, b]);
      }
    }
    return [side, edges.map(group => [...group.values()])];
  }));
  return (side, upward = false) => {
    const base = geometry.attributes.position, targets = geometry.morphAttributes.position;
    const posed = new Map();
    const point = i => {
      if (!posed.has(i)) {
        const p = { x: base.getX(i), y: base.getY(i) };
        for (let j = 0; j < targets.length; j++) {
          const weight = mesh.morphTargetInfluences[j];
          if (!weight) continue;
          p.x += targets[j].getX(i) * weight;
          p.y += targets[j].getY(i) * weight;
        }
        posed.set(i, p);
      }
      return posed.get(i);
    };
    const [line, eye, brow] = sides[side].map(edges => edges.map(ids => ids.map(point)));
    const gap = upward ? verticalSilhouetteGap(brow, line) : verticalSilhouetteGap(line, eye);
    // Keep half the current separation from either eyelashes or eyebrows,
    // including their independent expression changes and blinking.
    return Number.isFinite(gap) ? Math.max(0, gap * .5) : 0;
  };
}
