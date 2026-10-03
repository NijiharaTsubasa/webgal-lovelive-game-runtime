// Runtime-authored channels are local to this instance. Neither the published
// geometry nor another character sharing it is edited.
export class FaceMorphWorkspace {
  constructor(root, mesh, THREE) {
    this.Float32BufferAttribute = THREE.Float32BufferAttribute;
    if (!mesh.geometry?.morphTargetsRelative)
      throw new Error('LLAS face requires relative Morph geometry');
    this.originalGeometry = mesh.geometry;
    this.geometry = mesh.geometry.clone();
    this.mesh = mesh;
    this.originalCount = mesh.morphTargetInfluences.length;
    this.channels = new Map();
    this.objects = [];
    root.traverse((object) => {
      if (object.geometry !== this.originalGeometry) return;
      this.objects.push({
        object,
        geometry: object.geometry,
        dictionary: object.morphTargetDictionary,
        influences: object.morphTargetInfluences,
      });
      object.geometry = this.geometry;
      object.morphTargetDictionary = { ...object.morphTargetDictionary };
      object.morphTargetInfluences = [...object.morphTargetInfluences];
    });
  }

  add(name, positions, normals) {
    if (this.channels.has(name)) throw new Error(`Duplicate derived face channel: ${name}`);
    const count = this.geometry.attributes.position.count;
    if (positions.length !== count * 3 || !positions.every(Number.isFinite))
      throw new Error(`Invalid face channel: ${name}`);
    const attributes = this.geometry.morphAttributes;
    const index = attributes.position.length;
    const position = new this.Float32BufferAttribute(positions, 3);
    position.name = name;
    attributes.position.push(position);
    // Keep all enabled Morph attributes at the same target count. Zero means
    // this derived position-only channel retains the original surface normal.
    for (const [kind, targets] of Object.entries(attributes)) {
      if (kind === 'position') continue;
      const size = targets[0].itemSize;
      const values = kind === 'normal' && normals ? normals : new Float32Array(count * size);
      if (values.length !== count * size || !values.every(Number.isFinite))
        throw new Error(`Invalid ${kind} face channel: ${name}`);
      const attribute = new this.Float32BufferAttribute(values, size);
      attribute.name = name;
      targets.push(attribute);
    }
    for (const { object } of this.objects) {
      object.morphTargetDictionary[name] = index;
      object.morphTargetInfluences.push(0);
      for (const material of [object.material].flat()) if (material) material.needsUpdate = true;
    }
    this.channels.set(name, index);
    return index;
  }

  write(values) {
    for (const { object } of this.objects) {
      for (const [name, index] of this.channels)
        object.morphTargetInfluences[index] = values[name] ?? 0;
    }
  }

  dispose() {
    if (!this.geometry) return;
    for (const saved of this.objects) {
      for (let index = 0; index < saved.influences.length; index++)
        saved.influences[index] = saved.object.morphTargetInfluences[index];
      saved.object.geometry = saved.geometry;
      saved.object.morphTargetDictionary = saved.dictionary;
      saved.object.morphTargetInfluences = saved.influences;
      for (const material of [saved.object.material].flat())
        if (material) material.needsUpdate = true;
    }
    this.geometry.dispose();
    this.geometry = null;
    this.objects = [];
  }
}

export function maskedDifference(to, from, mask) {
  const result = new Float32Array(to.length);
  for (let i = 0; i < mask.length; i++)
    if (mask[i]) {
      for (let axis = 0; axis < 3; axis++)
        result[i * 3 + axis] = to[i * 3 + axis] - from[i * 3 + axis];
    }
  return result;
}

export function connectedVertices(geometry) {
  const count = geometry.attributes.position.count;
  const parents = Int32Array.from({ length: count }, (_, i) => i);
  const find = (i) => {
    while (parents[i] !== i) {
      parents[i] = parents[parents[i]];
      i = parents[i];
    }
    return i;
  };
  const join = (a, b) => {
    parents[find(a)] = find(b);
  };
  const index = geometry.index;
  const length = index?.count ?? count;
  const get = (i) => (index ? index.getX(i) : i);
  for (let i = 0; i < length; i += 3) {
    join(get(i), get(i + 1));
    join(get(i), get(i + 2));
  }
  const groups = new Map();
  for (let i = 0; i < count; i++) {
    const key = find(i);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(i);
  }
  return [...groups.values()];
}

// LLAS face atlas, measured on all 30 ordinary faces: brow V is
// [0.396522, 0.406101], disjoint from eyelids, with no split triangles.
// This is a source-asset convention, not a generic humanoid assumption.
export function classifyEyeRegions(geometry) {
  const position = geometry.attributes.position,
    uv = geometry.attributes.uv;
  if (!uv || uv.count !== position.count) throw new Error('LLAS eye atlas is missing');
  const regions = {};
  for (const [side, sign] of [
    ['L', 1],
    ['R', -1],
  ]) {
    const brow = new Uint8Array(position.count),
      eye = new Uint8Array(position.count);
    for (let i = 0; i < position.count; i++) {
      if (position.getX(i) * sign <= 0) continue;
      if (uv.getY(i) > 0.39 && uv.getY(i) < 0.41) brow[i] = 1;
      else eye[i] = 1;
    }
    if (!brow.some(Boolean)) throw new Error(`LLAS ${side} brow region not found`);
    regions[side] = { brow, eye, lid: new Uint8Array(position.count) };
  }
  for (const vertices of connectedVertices(geometry)) {
    const masks = Object.values(regions).flatMap((region) => [region.brow, region.eye]);
    if (masks.filter((mask) => vertices.some((i) => mask[i])).length > 1)
      throw new Error('LLAS face region would cut connected geometry');
    // Use whole islands: unrelated skin UVs can cross the same V band.
    if (
      vertices.every(
        (i) => uv.getX(i) > 0.34 && uv.getX(i) < 0.45 && uv.getY(i) > 0.414 && uv.getY(i) < 0.46
      )
    ) {
      for (const i of vertices) regions[position.getX(i) > 0 ? 'L' : 'R'].lid[i] = 1;
    }
  }
  return regions;
}

export function regionBounds(geometry, mask, offset) {
  const p = geometry.attributes.position;
  const min = [Infinity, Infinity, Infinity],
    max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < p.count; i++)
    if (mask[i])
      for (let axis = 0; axis < 3; axis++) {
        const value = p.getComponent(i, axis) + (offset?.[i * 3 + axis] ?? 0);
        min[axis] = Math.min(min[axis], value);
        max[axis] = Math.max(max[axis], value);
      }
  return {
    min,
    max,
    center: min.map((v, i) => (v + max[i]) / 2),
    size: min.map((v, i) => max[i] - v),
  };
}

// Query the skin in eye-mesh coordinates so a complete facial overlay can
// clear it without changing its authored bend, thickness, or relative depth.
export function faceRegionDepthConstraint(eyeMesh, faceMesh, regions, open, THREE, region = 'brow') {
  const transform = new THREE.Matrix4()
    .copy(eyeMesh.matrixWorld)
    .invert()
    .multiply(faceMesh.matrixWorld);
  const p = faceMesh.geometry.attributes.position,
    index = faceMesh.geometry.index;
  const vertices = Array.from({ length: p.count }, (_, i) =>
    new THREE.Vector3().fromBufferAttribute(p, i).applyMatrix4(transform)
  );
  const minX = Math.min(...vertices.map((v) => v.x)),
    minY = Math.min(...vertices.map((v) => v.y));
  const cell = Math.max(...vertices.map((v) => Math.max(v.x - minX, v.y - minY))) / 24;
  if (!(cell > 0)) throw new Error('LLAS face surface is degenerate');
  const grid = new Map(),
    key = (x, y) => `${Math.floor((x - minX) / cell)},${Math.floor((y - minY) / cell)}`;
  const insert = (grid, triangle) => {
    const loX = Math.floor((Math.min(...triangle.map((v) => v.x)) - minX) / cell),
      hiX = Math.floor((Math.max(...triangle.map((v) => v.x)) - minX) / cell);
    const loY = Math.floor((Math.min(...triangle.map((v) => v.y)) - minY) / cell),
      hiY = Math.floor((Math.max(...triangle.map((v) => v.y)) - minY) / cell);
    for (let x = loX; x <= hiX; x++)
      for (let y = loY; y <= hiY; y++) {
        const k = `${x},${y}`;
        if (!grid.has(k)) grid.set(k, []);
        grid.get(k).push(triangle);
      }
  };
  const count = index?.count ?? p.count,
    get = (i) => (index ? index.getX(i) : i);
  for (let i = 0; i < count; i += 3)
    insert(grid, [vertices[get(i)], vertices[get(i + 1)], vertices[get(i + 2)]]);
  const depth = (x, y) => {
    let z = -Infinity;
    for (const [a, b, c] of grid.get(key(x, y)) ?? []) {
      const den = (b.y - c.y) * (a.x - c.x) + (c.x - b.x) * (a.y - c.y);
      if (Math.abs(den) < cell * cell * 1e-12) continue;
      const u = ((b.y - c.y) * (x - c.x) + (c.x - b.x) * (y - c.y)) / den;
      const v = ((c.y - a.y) * (x - c.x) + (a.x - c.x) * (y - c.y)) / den,
        w = 1 - u - v;
      if (u >= -1e-7 && v >= -1e-7 && w >= -1e-7) z = Math.max(z, u * a.z + v * b.z + w * c.z);
    }
    return z;
  };
  const base = eyeMesh.geometry.attributes.position;
  const samples = Object.fromEntries(
    Object.entries(regions).map(([side, masks]) => {
      const brow = masks[region];
      const ids = Array.from(brow, (_, i) => i).filter((i) => brow[i]);
      if (!ids.length) return [side, { ids, triangles: [], margin: 0 }];
      const supportedGaps = ids
        .map(
          (i) =>
            base.getZ(i) +
            open[i * 3 + 2] -
            depth(base.getX(i) + open[i * 3], base.getY(i) + open[i * 3 + 1])
        )
        .filter(Number.isFinite);
      const gaps = supportedGaps.filter(gap => gap > 0);
      if (region === 'brow' && !gaps.length)
        throw new Error(`LLAS ${side} ${region} has no face surface support`);
      // A scale-relative clearance avoids coplanar depth fighting at contact.
      const indices = eyeMesh.geometry.index,
        total = indices?.count ?? base.count,
        at = (i) => (indices ? indices.getX(i) : i),
        triangles = [];
      for (let i = 0; i < total; i += 3) {
        const triangle = [at(i), at(i + 1), at(i + 2)];
        if (triangle.every((j) => brow[j])) triangles.push(triangle);
      }
      // Eyelid overlays can begin over the face's eye opening, with no skin
      // triangle below them. Their moved triangles still query the whole grid.
      return [side, { ids, triangles, margin: gaps.length ? Math.min(...gaps) * 0.01 : cell * 1e-4 }];
    })
  );
  const pose = (i) => {
    const vertex = { x: base.getX(i), y: base.getY(i), z: base.getZ(i) };
    const targets = eyeMesh.geometry.morphAttributes.position;
    for (let j = 0; j < targets.length; j++) {
      const weight = eyeMesh.morphTargetInfluences[j];
      if (!weight) continue;
      vertex.x += targets[j].getX(i) * weight;
      vertex.y += targets[j].getY(i) * weight;
      vertex.z += targets[j].getZ(i) * weight;
    }
    return vertex;
  };
  // Eye_Around also carries the skin bordering the eye opening. Its complete
  // skin triangles occupy V < .3 in all 30 LLAS face atlases, separately from
  // lashes, brows and crease/shadow sheets. They follow the current eye Morph.
  const skinTriangles = [];
  if (region === 'lid') {
    const uv = eyeMesh.geometry.attributes.uv,
      indices = eyeMesh.geometry.index,
      total = indices?.count ?? base.count,
      at = (i) => (indices ? indices.getX(i) : i);
    for (let i = 0; i < total; i += 3) {
      const triangle = [at(i), at(i + 1), at(i + 2)];
      if (triangle.every((j) => uv.getY(j) < 0.3 &&
        Object.values(regions).every((masks) => !masks.lid[j] && !masks.brow[j])))
        skinTriangles.push(triangle);
    }
  }
  const skinIds = [...new Set(skinTriangles.flat())],
    skinTargets = eyeMesh.geometry.morphAttributes.position
      .map((target, index) => ({ target, index }))
      .filter(({ target }) => skinIds.some((i) => target.getX(i) || target.getY(i) || target.getZ(i)))
      .map(({ index }) => index);
  let skinWeights = null;
  const skinGrid = new Map();
  const updateSkin = () => {
    const weights = skinTargets.map((i) => eyeMesh.morphTargetInfluences[i]);
    if (skinWeights && weights.every((w, i) => w === skinWeights[i])) return;
    skinWeights = weights;
    skinGrid.clear();
    const posed = new Map(skinIds.map((i) => [i, pose(i)]));
    for (const triangle of skinTriangles) insert(skinGrid, triangle.map((i) => posed.get(i)));
  };
  return (side) => {
    updateSkin();
    const { ids, triangles, margin } = samples[side],
      posed = new Map(ids.map((i) => [i, pose(i)]));
    let shift = 0;
    for (const ids of triangles) {
      const brow = ids.map((i) => posed.get(i));
      const loX = Math.floor((Math.min(...brow.map((v) => v.x)) - minX) / cell),
        hiX = Math.floor((Math.max(...brow.map((v) => v.x)) - minX) / cell);
      const loY = Math.floor((Math.min(...brow.map((v) => v.y)) - minY) / cell),
        hiY = Math.floor((Math.max(...brow.map((v) => v.y)) - minY) / cell);
      const candidates = new Set();
      for (let x = loX; x <= hiX; x++)
        for (let y = loY; y <= hiY; y++) {
          for (const triangle of grid.get(`${x},${y}`) ?? []) candidates.add(triangle);
          for (const triangle of skinGrid.get(`${x},${y}`) ?? []) candidates.add(triangle);
        }
      for (const triangle of candidates)
        shift = Math.max(shift, triangleDepthGap(brow, triangle) + margin);
    }
    return shift;
  };
}

// Both depth fields are affine on each projected triangle. Their largest
// difference lies at a vertex of the overlap polygon, including edge crossings
// inside the brow; checking only mesh vertices misses those intersections.
export function triangleDepthGap(brow, skin) {
  const [a, b, c] = brow,
    den = (b.y - c.y) * (a.x - c.x) + (c.x - b.x) * (a.y - c.y);
  if (Math.abs(den) < Number.EPSILON) return -Infinity;
  const sign = Math.sign(den);
  let polygon = skin;
  for (let edge = 0; edge < 3 && polygon.length; edge++) {
    const p = brow[edge],
      q = brow[(edge + 1) % 3];
    const distance = (v) => sign * ((q.x - p.x) * (v.y - p.y) - (q.y - p.y) * (v.x - p.x));
    const clipped = [];
    for (let i = 0; i < polygon.length; i++) {
      const u = polygon[i],
        v = polygon[(i + 1) % polygon.length],
        du = distance(u),
        dv = distance(v);
      if (du >= 0) clipped.push(u);
      if (du >= 0 !== dv >= 0) {
        const t = du / (du - dv);
        clipped.push({
          x: u.x + t * (v.x - u.x),
          y: u.y + t * (v.y - u.y),
          z: u.z + t * (v.z - u.z),
        });
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

// General planar affine channels for an isolated part. sin/cos coefficients
// express a real rotation without a per-frame vertex loop or endpoint lerp.
export function planarChannels(geometry, mask, center, offset) {
  const p = geometry.attributes.position,
    n = geometry.attributes.normal;
  const make = () => new Float32Array(p.count * 3);
  const result = {
    x: make(),
    y: make(),
    sin: make(),
    cos: make(),
    scale: make(),
    curve: make(),
    normalSin: make(),
    normalCos: make(),
  };
  const bounds = regionBounds(geometry, mask, offset),
    width = bounds.size[0];
  for (let i = 0; i < p.count; i++)
    if (mask[i]) {
      const x = p.getX(i) + (offset?.[i * 3] ?? 0) - center[0],
        y = p.getY(i) + (offset?.[i * 3 + 1] ?? 0) - center[1];
      result.x[i * 3] = 1;
      result.y[i * 3 + 1] = 1;
      result.sin[i * 3] = -y;
      result.sin[i * 3 + 1] = x;
      result.cos[i * 3] = x;
      result.cos[i * 3 + 1] = y;
      result.scale[i * 3] = x;
      result.scale[i * 3 + 1] = y;
      result.curve[i * 3 + 1] = width * (1 - ((2 * x) / width) ** 2);
      if (n) {
        result.normalSin[i * 3] = -n.getY(i);
        result.normalSin[i * 3 + 1] = n.getX(i);
        result.normalCos[i * 3] = n.getX(i);
        result.normalCos[i * 3 + 1] = n.getY(i);
      }
    }
  return result;
}

// Least-squares quadratic fit with a separate linear slope. Measuring the
// neutral arch avoids assuming that every character starts with the same brow.
export function browCurvature(geometry, mask, offset) {
  const p = geometry.attributes.position,
    { center, size } = regionBounds(geometry, mask, offset),
    samples = [];
  for (let i = 0; i < p.count; i++)
    if (mask[i]) {
      const t = (2 * (p.getX(i) + (offset?.[i * 3] ?? 0) - center[0])) / size[0];
      samples.push([t, 1 - t * t, (p.getY(i) + (offset?.[i * 3 + 1] ?? 0) - center[1]) / size[0]]);
    }
  const mean = [0, 1, 2].map((k) => samples.reduce((sum, s) => sum + s[k], 0) / samples.length);
  const covariance = (a, b) =>
    samples.reduce((sum, s) => sum + (s[a] - mean[a]) * (s[b] - mean[b]), 0);
  const tt = covariance(0, 0),
    tq = covariance(0, 1),
    qq = covariance(1, 1);
  return (covariance(1, 2) * tt - covariance(0, 2) * tq) / (qq * tt - tq * tq);
}

// Solve the mouth's support once at binding. Native A's stationary vertices
// remain fixed; the lip contour receives the full authored deformation. A's
// movement magnitude is not a blend weight: using it creates sharp gradients
// at small-moving interior vertices and can reverse the surrounding triangles.
export function mouthSupportWeights(geometry, opening, lip) {
  const p = geometry.attributes.position,
    count = p.count,
    groups = [],
    byPosition = new Map(),
    vertexGroup = new Uint32Array(count);
  // UV seams split the outer lip from the inner lip/cavity into separate
  // index islands. They are still one surface: solve coincident vertices
  // together so a closed mouth cannot split along those texture seams.
  for (let i = 0; i < count; i++) {
    const key = `${p.getX(i)},${p.getY(i)},${p.getZ(i)}`;
    if (!byPosition.has(key)) {
      byPosition.set(key, groups.length);
      groups.push([]);
    }
    vertexGroup[i] = byPosition.get(key);
    groups[vertexGroup[i]].push(i);
  }
  const neighbors = groups.map(() => new Map()),
    fixed = new Uint8Array(groups.length),
    weights = new Float64Array(groups.length);
  for (const [group, vertices] of groups.entries())
    for (const i of vertices) {
      const stationary = Math.hypot(opening[i * 3], opening[i * 3 + 1], opening[i * 3 + 2]) <= 1e-8;
      if (stationary) {
        fixed[group] = 2;
        weights[group] = 0;
      } else if (lip[i] && fixed[group] !== 2) {
        fixed[group] = 1;
        weights[group] = 1;
      }
    }
  const edge = (a, b) => {
    const ga = vertexGroup[a],
      gb = vertexGroup[b];
    if (ga === gb) return;
    const distance = Math.hypot(
      p.getX(a) - p.getX(b),
      p.getY(a) - p.getY(b),
      p.getZ(a) - p.getZ(b)
    );
    const weight = 1 / Math.max(distance, 1e-8);
    neighbors[ga].set(gb, weight);
    neighbors[gb].set(ga, weight);
  };
  const index = geometry.index,
    total = index?.count ?? count,
    get = (i) => (index ? index.getX(i) : i);
  for (let i = 0; i < total; i += 3) {
    const a = get(i),
      b = get(i + 1),
      c = get(i + 2);
    edge(a, b);
    edge(b, c);
    edge(c, a);
  }
  // Welded components without lip anchors or stationary outer seams are
  // detached mouth interiors (teeth/cavity). They follow the mouth warp in
  // full; leaving them at zero support exposes them through the moving skin.
  const internal = new Uint8Array(count),
    visited = new Set();
  for (let first = 0; first < groups.length; first++)
    if (!visited.has(first)) {
      const component = [],
        pending = [first];
      visited.add(first);
      while (pending.length) {
        const i = pending.pop();
        component.push(i);
        for (const j of neighbors[i].keys())
          if (!visited.has(j)) {
            visited.add(j);
            pending.push(j);
          }
      }
      if (component.every((i) => fixed[i] === 0))
        for (const i of component) {
          fixed[i] = 1;
          weights[i] = 1;
          for (const v of groups[i]) internal[v] = 1;
        }
    }
  for (let iteration = 0; iteration < 512; iteration++) {
    let change = 0;
    for (let i = 0; i < groups.length; i++)
      if (!fixed[i] && neighbors[i].size) {
        let value = 0,
          total = 0;
        for (const [j, weight] of neighbors[i]) {
          value += weights[j] * weight;
          total += weight;
        }
        value /= total;
        change = Math.max(change, Math.abs(value - weights[i]));
        weights[i] = value;
      }
    if (change < 1e-7) break;
  }
  const result = Float64Array.from(vertexGroup, (group) => weights[group]);
  // Internal vertices also skip the outer skin's spatial falloff.
  result.internal = internal;
  return result;
}

export function mouthChannels(geometry, opening) {
  const p = geometry.attributes.position,
    uv = geometry.attributes.uv;
  const lip = new Uint8Array(p.count);
  for (let i = 0; i < p.count; i++)
    lip[i] =
      uv.getX(i) > 0.22 && uv.getX(i) < 0.285 && uv.getY(i) > 0.2625 && uv.getY(i) < 0.2642 ? 1 : 0;
  if (!lip.some(Boolean)) throw new Error('LLAS mouth atlas region not found');
  const bounds = regionBounds(geometry, lip),
    center = bounds.center,
    w = bounds.size[0] / 2;
  // Fit the actual closed lip midline, including both upper/lower samples.
  // Different LLAS faces start with different smiles; a fixed additive bend
  // can merely flatten one face while turning another into a frown.
  let samples = 0,
    sumQ = 0,
    sumY = 0,
    sumQQ = 0,
    sumQY = 0;
  for (let i = 0; i < p.count; i++)
    if (lip[i]) {
      const q = ((p.getX(i) - center[0]) / w) ** 2,
        y = (p.getY(i) - center[1]) / (2 * w);
      samples++;
      sumQ += q;
      sumY += y;
      sumQQ += q * q;
      sumQY += q * y;
    }
  const curvature = -(sumQY - (sumQ * sumY) / samples) / (sumQQ - (sumQ * sumQ) / samples);
  const names = ['baseX', 'openX', 'baseY', 'openY', 'moveY', 'curve0', 'curve1', 'curve2'];
  const channels = Object.fromEntries(names.map((name) => [name, new Float32Array(p.count * 3)]));
  const support = mouthSupportWeights(geometry, opening, lip);
  const falloff = (v, inner, outer) => {
    const t = Math.max(0, Math.min(1, (v - inner) / (outer - inner)));
    return 1 - t * t * (3 - 2 * t);
  };
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) - center[0],
      y = p.getY(i) - center[1],
      dx = opening[i * 3],
      dy = opening[i * 3 + 1];
    // Mouth shares stationary seams with Face/Body. Native A keeps these
    // vertices fixed; a purely spatial warp would tear the two meshes apart.
    const mask = support.internal[i]
      ? 1
      : falloff(Math.abs(x) / w, 1, 1.8) * falloff(Math.abs(y) / w, 0.6, 1.5) * support[i];
    channels.baseX[i * 3] = mask * x;
    channels.openX[i * 3] = mask * dx;
    channels.baseY[i * 3 + 1] = mask * y;
    channels.openY[i * 3 + 1] = mask * dy;
    channels.moveY[i * 3 + 1] = mask;
    // A common continuous warp moves upper/lower lips and interior together.
    // q(x+a*dx) is expanded so runtime remains scalar Morph blending.
    channels.curve0[i * 3 + 1] = mask * 2 * w * (1 - (x / w) ** 2);
    channels.curve1[i * 3 + 1] = mask * ((-4 * x * dx) / w);
    channels.curve2[i * 3 + 1] = mask * ((-2 * dx * dx) / w);
  }
  return { channels, bounds, curvature };
}
