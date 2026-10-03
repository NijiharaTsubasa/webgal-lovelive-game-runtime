// Frozen pre-optimization numerical oracle; preserve its arithmetic and operation order.
import { evaluateBinding } from '../../packages/llas_runtime/behaviors/face.js';

export function browDepthConstraint(eyeMesh, faceMesh, regions, open, THREE) {
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
  const count = index?.count ?? p.count,
    get = (i) => (index ? index.getX(i) : i);
  for (let i = 0; i < count; i += 3) {
    const triangle = [vertices[get(i)], vertices[get(i + 1)], vertices[get(i + 2)]];
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
  }
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
    Object.entries(regions).map(([side, { brow }]) => {
      const ids = Array.from(brow, (_, i) => i).filter((i) => brow[i]);
      const gaps = ids
        .map(
          (i) =>
            base.getZ(i) +
            open[i * 3 + 2] -
            depth(base.getX(i) + open[i * 3], base.getY(i) + open[i * 3 + 1])
        )
        .filter((gap) => Number.isFinite(gap) && gap > 0);
      if (!gaps.length) throw new Error(`LLAS ${side} brow has no face surface support`);
      // A scale-relative clearance avoids coplanar depth fighting at contact.
      const indices = eyeMesh.geometry.index,
        total = indices?.count ?? base.count,
        at = (i) => (indices ? indices.getX(i) : i),
        triangles = [];
      for (let i = 0; i < total; i += 3) {
        const triangle = [at(i), at(i + 1), at(i + 2)];
        if (triangle.every((j) => brow[j])) triangles.push(triangle);
      }
      return [side, { ids, triangles, margin: Math.min(...gaps) * 0.01 }];
    })
  );
  return (side) => {
    const { ids, triangles, margin } = samples[side],
      targets = eyeMesh.geometry.morphAttributes.position,
      posed = new Map();
    for (const i of ids) {
      let x = base.getX(i),
        y = base.getY(i),
        z = base.getZ(i);
      for (let j = 0; j < targets.length; j++) {
        const weight = eyeMesh.morphTargetInfluences[j];
        if (!weight) continue;
        x += targets[j].getX(i) * weight;
        y += targets[j].getY(i) * weight;
        z += targets[j].getZ(i) * weight;
      }
      posed.set(i, { x, y, z });
    }
    let shift = 0;
    for (const ids of triangles) {
      const brow = ids.map((i) => posed.get(i));
      const loX = Math.floor((Math.min(...brow.map((v) => v.x)) - minX) / cell),
        hiX = Math.floor((Math.max(...brow.map((v) => v.x)) - minX) / cell);
      const loY = Math.floor((Math.min(...brow.map((v) => v.y)) - minY) / cell),
        hiY = Math.floor((Math.max(...brow.map((v) => v.y)) - minY) / cell);
      const candidates = new Set();
      for (let x = loX; x <= hiX; x++)
        for (let y = loY; y <= hiY; y++)
          for (const triangle of grid.get(`${x},${y}`) ?? []) candidates.add(triangle);
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


export function applyCompanionsAndGaze(controls) {
    // These semantic keys select the recovered companion-bone bindings.
    // Morph deformation itself is bound directly to the source channels.
    for (const binding of this.bindings) {
      const side = binding.node.startsWith('Right') ? 'R' : 'L',
        eye = controls.eyes[side];
      if (binding.property === 'visible') {
        // External closure has no native recipe timing. WhiteLine is a closed
        // eyelash decoration; a mixed arc must not disappear at smile=.5.
        binding.object.visible = /EyeWhiteLine$/.test(binding.node) && eye.open <= 1e-5;
        continue;
      }
      const closed = 1 - Math.min(1, eye.open),
        wide = Math.max(0, eye.open - 1) * 2;
      const value = evaluateBinding(binding, {
        'eye/Open': Math.max(0, 1 - closed - wide),
        'eye/Close': closed * (1 - eye.smile),
        'eye/CloseSmile': closed * eye.smile,
        'eye/WideOpen': wide,
      });
      binding.object[binding.property].fromArray(value);
    }
    this.root.updateMatrixWorld(true);
    for (const [side, bone] of Object.entries(this.eyeBones)) {
      // Reuse the face-local basis measured at binding.
      this.eyeSpace.copy(this.gazeBasis[side]);
      this.origin.set(0, 0, 0).applyMatrix4(this.eyeSpace);
      this.localShift
        .set(controls.gaze.x * this.eyeDistance, controls.gaze.y * this.eyeDistance, 0)
        .applyMatrix4(this.eyeSpace)
        .sub(this.origin);
      bone.position.add(this.localShift);
      this.localShift
        .copy(this.irisPivots[side])
        .multiply(bone.scale)
        .applyQuaternion(bone.quaternion)
        .multiplyScalar(1 - controls.gaze.scale);
      bone.position.add(this.localShift);
      bone.scale.multiplyScalar(controls.gaze.scale);
    }
    this.root.updateMatrixWorld(true);
  }
