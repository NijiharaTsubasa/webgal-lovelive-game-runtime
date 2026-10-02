// Both inputs are in the Head bind frame used by the expression adapter.
// Skin and brow depth are affine on each projected triangle. The maximum
// difference lies on an overlap vertex, which can be an edge intersection
// rather than a vertex of either original mesh.
function depthGap(brow, skin) {
  const [a, b, c] = brow;
  const den = (b.y - c.y) * (a.x - c.x) + (c.x - b.x) * (a.y - c.y);
  if (Math.abs(den) < Number.EPSILON) return -Infinity;
  const sign = Math.sign(den);
  let polygon = skin;
  for (let edge = 0; edge < 3 && polygon.length; edge++) {
    const p = brow[edge], q = brow[(edge + 1) % 3];
    const distance = (v) => sign * ((q.x - p.x) * (v.y - p.y) - (q.y - p.y) * (v.x - p.x));
    const clipped = [];
    for (let i = 0; i < polygon.length; i++) {
      const u = polygon[i], v = polygon[(i + 1) % polygon.length];
      const du = distance(u), dv = distance(v);
      if (du >= 0) clipped.push(u);
      if ((du >= 0) !== (dv >= 0)) {
        const t = du / (du - dv);
        clipped.push({ x: u.x + t * (v.x - u.x), y: u.y + t * (v.y - u.y), z: u.z + t * (v.z - u.z) });
      }
    }
    polygon = clipped;
  }
  let gap = -Infinity;
  for (const p of polygon) {
    const u = ((b.y - c.y) * (p.x - c.x) + (c.x - b.x) * (p.y - c.y)) / den;
    const v = ((c.y - a.y) * (p.x - c.x) + (a.x - c.x) * (p.y - c.y)) / den;
    gap = Math.max(gap, p.z - u * a.z - v * b.z - (1 - u - v) * c.z);
  }
  return gap;
}

function triangles(work) {
  const index = work.source.index, count = index?.count ?? work.baseFace.count;
  const result = [];
  for (let i = 0; i < count; i += 3)
    result.push([0, 1, 2].map((j) => index ? index.getX(i + j) : i + j));
  return result;
}

const vertex = (p, i) => ({ x: p.getX(i), y: p.getY(i), z: p.getZ(i) });
const bounds = (points) => ({
  minX: Math.min(...points.map((v) => v.x)), maxX: Math.max(...points.map((v) => v.x)),
  minY: Math.min(...points.map((v) => v.y)), maxY: Math.max(...points.map((v) => v.y)),
});
const overlaps = (a, b) => a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY;

function surfaceDepth(triangles, x, y) {
  let depth = -Infinity;
  for (const [a, b, c] of triangles) {
    const den = (b.y - c.y) * (a.x - c.x) + (c.x - b.x) * (a.y - c.y);
    if (Math.abs(den) < Number.EPSILON) continue;
    const u = ((b.y - c.y) * (x - c.x) + (c.x - b.x) * (y - c.y)) / den;
    const v = ((c.y - a.y) * (x - c.x) + (a.x - c.x) * (y - c.y)) / den;
    if (u >= -1e-7 && v >= -1e-7 && u + v <= 1 + 1e-7)
      depth = Math.max(depth, u * a.z + v * b.z + (1 - u - v) * c.z);
  }
  return depth;
}

function visibleBrowTriangles(work, surface) {
  const all = triangles(work), parent = Array.from({ length: work.baseFace.count }, (_, i) => i);
  const find = (i) => {
    while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; }
    return i;
  };
  for (const [a, b, c] of all) { parent[find(b)] = find(a); parent[find(c)] = find(a); }
  const visible = new Set();
  for (let i = 0; i < parent.length; i++) {
    const x = work.baseFace.getX(i) + work.neutral[i * 3];
    const y = work.baseFace.getY(i) + work.neutral[i * 3 + 1];
    const z = work.baseFace.getZ(i) + work.neutral[i * 3 + 2];
    if (z >= surfaceDepth(surface, x, y)) visible.add(find(i));
  }
  // Early source rigs also store alternate emotional brow islands under the
  // skin. Their native Morphs expose them; the parameter adapter uses the
  // neutral brow only, so these dormant islands must not drive clearance.
  return all.filter(([a]) => visible.has(find(a)));
}

export function createBrowClearance(faces, brows, eyeDistance) {
  const skin = faces.map((work) => ({ work, triangles: triangles(work) }));
  const surface = skin.flatMap(({ work, triangles }) => triangles.map((ids) => ids.map((i) => ({
    x: work.baseFace.getX(i) + work.eyeNeutral[i * 3] + work.mouthNeutral[i * 3],
    y: work.baseFace.getY(i) + work.eyeNeutral[i * 3 + 1] + work.mouthNeutral[i * 3 + 1],
    z: work.baseFace.getZ(i) + work.eyeNeutral[i * 3 + 2] + work.mouthNeutral[i * 3 + 2],
  }))));
  const active = brows.map((work) => ({ work, triangles: visibleBrowTriangles(work, surface) }));
  const sides = [true, false].map((left) => active.map(({ work, triangles }) => {
    const selected = triangles.filter((ids) => ids.every((i) => (work.baseFace.getX(i) >= 0) === left));
    return { work, vertices: [...new Set(selected.flat())], triangles: selected };
  }));
  const margin = eyeDistance * 1e-4;
  return () => {
    for (const side of sides) {
      const patches = side.flatMap(({ work, triangles }) => triangles.map((ids) => {
        const points = ids.map((i) => vertex(work.position, i));
        return { points, bounds: bounds(points) };
      }));
      if (!patches.length) continue;
      const area = {
        minX: Math.min(...patches.map((p) => p.bounds.minX)), maxX: Math.max(...patches.map((p) => p.bounds.maxX)),
        minY: Math.min(...patches.map((p) => p.bounds.minY)), maxY: Math.max(...patches.map((p) => p.bounds.maxY)),
      };
      let shift = 0;
      for (const { work, triangles } of skin) {
        const p = work.position;
        for (const ids of triangles) {
          // Reject distant skin without allocating polygons. Query the current
          // face after eyelid/mouth/tear deformation, not a static forehead.
          const [a, b, c] = ids;
          const loX = Math.min(p.getX(a), p.getX(b), p.getX(c));
          const hiX = Math.max(p.getX(a), p.getX(b), p.getX(c));
          if (loX > area.maxX || hiX < area.minX) continue;
          const loY = Math.min(p.getY(a), p.getY(b), p.getY(c));
          const hiY = Math.max(p.getY(a), p.getY(b), p.getY(c));
          if (loY > area.maxY || hiY < area.minY) continue;
          const box = { minX: loX, maxX: hiX, minY: loY, maxY: hiY };
          const points = ids.map((i) => vertex(p, i));
          for (const patch of patches)
            if (overlaps(patch.bounds, box)) shift = Math.max(shift, depthGap(patch.points, points) + margin);
        }
      }
      // One translation per side preserves the authored relative depths and
      // the parameter-driven XY silhouette, including across primitives.
      if (shift > 0)
        for (const { work, vertices } of side)
          for (const i of vertices) work.position.setZ(i, work.position.getZ(i) + shift);
    }
  };
}
