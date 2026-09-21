export function pointInPolygon(x: number, z: number, points: Array<[number, number]>): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const [xi, zi] = points[i]!;
    const [xj, zj] = points[j]!;
    const crosses = (zi > z) !== (zj > z)
      && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}

export function distanceToSegment(x: number, z: number, ax: number, az: number, bx: number, bz: number): number {
  const vx = bx - ax;
  const vz = bz - az;
  const lengthSquared = vx * vx + vz * vz;
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / lengthSquared));
  return Math.hypot(x - (ax + vx * t), z - (az + vz * t));
}

export function distanceToPolygon(x: number, z: number, points: Array<[number, number]>): number {
  let distance = Number.POSITIVE_INFINITY;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i]!;
    const b = points[(i + 1) % points.length]!;
    distance = Math.min(distance, distanceToSegment(x, z, a[0], a[1], b[0], b[1]));
  }
  return distance;
}

export function distanceToPolyline(x: number, z: number, points: Array<[number, number]>): number {
  let distance = Number.POSITIVE_INFINITY;
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i]!;
    const b = points[i + 1]!;
    distance = Math.min(distance, distanceToSegment(x, z, a[0], a[1], b[0], b[1]));
  }
  return distance;
}

export function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = seed + 0x6d2b79f5 | 0;
    let value = Math.imul(seed ^ seed >>> 15, 1 | seed);
    value = value + Math.imul(value ^ value >>> 7, 61 | value) ^ value;
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}
