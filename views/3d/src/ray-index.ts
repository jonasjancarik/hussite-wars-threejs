import * as THREE from "three";

/**
 * Nearest ray hit on a mostly horizontal mesh (the battlefield surface) using
 * a uniform grid over the mesh's local XZ plane. `Raycaster` tests every
 * triangle of a 200k-triangle terrain on each pointer move; this walks only
 * the cells under the ray, in order, and stops at the first cell whose exit
 * lies beyond the nearest hit. Results are the same triangles and the same
 * nearest point, and both faces count, as seen from above.
 */
export interface RayHit { point: THREE.Vector3; distance: number }

/** Mean triangles per cell the grid aims for. */
const TRIANGLES_PER_CELL = 24;

class MeshRayGrid {
  public readonly version: number;
  private readonly positions: ArrayLike<number>;
  private readonly indices: ArrayLike<number> | null;
  private readonly minX: number;
  private readonly minZ: number;
  private readonly cellSize: number;
  private readonly columns: number;
  private readonly rows: number;
  /** Triangles of cell c are cellTriangles[cellStart[c] .. cellStart[c + 1]). */
  private readonly cellStart: Uint32Array;
  private readonly cellTriangles: Uint32Array;
  private readonly cellMinY: Float32Array;
  private readonly cellMaxY: Float32Array;
  private readonly box: THREE.Box3;

  public constructor(geometry: THREE.BufferGeometry) {
    const position = geometry.getAttribute("position") as THREE.BufferAttribute;
    this.version = position.version;
    this.positions = position.array;
    this.indices = geometry.index ? geometry.index.array : null;
    const triangleCount = Math.floor((this.indices ? this.indices.length : position.count) / 3);
    geometry.computeBoundingBox();
    this.box = geometry.boundingBox!.clone();
    const width = Math.max(this.box.max.x - this.box.min.x, 1e-3), depth = Math.max(this.box.max.z - this.box.min.z, 1e-3);
    this.cellSize = Math.max(Math.sqrt(width * depth * TRIANGLES_PER_CELL / Math.max(triangleCount, 1)), 1e-3);
    this.columns = Math.max(1, Math.ceil(width / this.cellSize));
    this.rows = Math.max(1, Math.ceil(depth / this.cellSize));
    this.minX = this.box.min.x;
    this.minZ = this.box.min.z;
    const cellCount = this.columns * this.rows;
    this.cellMinY = new Float32Array(cellCount).fill(Infinity);
    this.cellMaxY = new Float32Array(cellCount).fill(-Infinity);
    const counts = new Uint32Array(cellCount + 1);
    const spans = new Int32Array(triangleCount * 4);
    for (let triangle = 0; triangle < triangleCount; triangle += 1) {
      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, minY = Infinity, maxY = -Infinity;
      for (let corner = 0; corner < 3; corner += 1) {
        const vertex = this.vertex(triangle * 3 + corner) * 3;
        const x = this.positions[vertex]!, y = this.positions[vertex + 1]!, z = this.positions[vertex + 2]!;
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
        if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
      }
      const c0 = this.column(minX), c1 = this.column(maxX), r0 = this.row(minZ), r1 = this.row(maxZ);
      spans[triangle * 4] = c0; spans[triangle * 4 + 1] = c1; spans[triangle * 4 + 2] = r0; spans[triangle * 4 + 3] = r1;
      for (let row = r0; row <= r1; row += 1) for (let column = c0; column <= c1; column += 1) {
        const cell = row * this.columns + column;
        counts[cell + 1]! += 1;
        if (minY < this.cellMinY[cell]!) this.cellMinY[cell] = minY;
        if (maxY > this.cellMaxY[cell]!) this.cellMaxY[cell] = maxY;
      }
    }
    for (let cell = 0; cell < cellCount; cell += 1) counts[cell + 1]! += counts[cell]!;
    this.cellStart = counts;
    this.cellTriangles = new Uint32Array(counts[cellCount]!);
    const fill = counts.slice(0, cellCount);
    for (let triangle = 0; triangle < triangleCount; triangle += 1) {
      const c0 = spans[triangle * 4]!, c1 = spans[triangle * 4 + 1]!, r0 = spans[triangle * 4 + 2]!, r1 = spans[triangle * 4 + 3]!;
      for (let row = r0; row <= r1; row += 1) for (let column = c0; column <= c1; column += 1) {
        this.cellTriangles[fill[row * this.columns + column]!++] = triangle;
      }
    }
  }

  /** Distance along the local ray to the nearest triangle, or Infinity. */
  public intersect(ray: THREE.Ray): number {
    const origin = ray.origin, direction = ray.direction;
    const span = clipToBox(ray, this.box);
    if (!span) return Infinity;
    let [t, tEnd] = span;
    let column = this.column(origin.x + direction.x * t), row = this.row(origin.z + direction.z * t);
    const stepX = direction.x > 0 ? 1 : -1, stepZ = direction.z > 0 ? 1 : -1;
    const deltaX = Math.abs(direction.x) > 1e-12 ? this.cellSize / Math.abs(direction.x) : Infinity;
    const deltaZ = Math.abs(direction.z) > 1e-12 ? this.cellSize / Math.abs(direction.z) : Infinity;
    const boundary = (index: number, step: number, minimum: number): number => minimum + (index + (step > 0 ? 1 : 0)) * this.cellSize;
    let nextX = deltaX === Infinity ? Infinity : (boundary(column, stepX, this.minX) - origin.x) / direction.x;
    let nextZ = deltaZ === Infinity ? Infinity : (boundary(row, stepZ, this.minZ) - origin.z) / direction.z;
    let nearest = Infinity;
    for (;;) {
      const exit = Math.min(nextX, nextZ, tEnd);
      const cell = row * this.columns + column;
      // Skip cells whose height range the ray passes over or under.
      const y0 = origin.y + direction.y * t, y1 = origin.y + direction.y * exit;
      if (Math.max(y0, y1) >= this.cellMinY[cell]! - 1e-4 && Math.min(y0, y1) <= this.cellMaxY[cell]! + 1e-4) {
        for (let entry = this.cellStart[cell]!; entry < this.cellStart[cell + 1]!; entry += 1) {
          const distance = this.triangleDistance(ray, this.cellTriangles[entry]!);
          if (distance < nearest) nearest = distance;
        }
      }
      // A triangle can span several cells; its hit is final once the ray has left the cells before it.
      if (nearest <= exit || exit >= tEnd) return nearest;
      t = exit;
      if (nextX < nextZ) { column += stepX; nextX += deltaX; } else { row += stepZ; nextZ += deltaZ; }
      if (column < 0 || column >= this.columns || row < 0 || row >= this.rows) return nearest;
    }
  }

  private vertex(corner: number): number { return this.indices ? this.indices[corner]! : corner; }
  private column(x: number): number { return Math.min(this.columns - 1, Math.max(0, Math.floor((x - this.minX) / this.cellSize))); }
  private row(z: number): number { return Math.min(this.rows - 1, Math.max(0, Math.floor((z - this.minZ) / this.cellSize))); }

  /** Möller–Trumbore, both faces. */
  private triangleDistance(ray: THREE.Ray, triangle: number): number {
    const p = this.positions;
    const a = this.vertex(triangle * 3) * 3, b = this.vertex(triangle * 3 + 1) * 3, c = this.vertex(triangle * 3 + 2) * 3;
    const ax = p[a]!, ay = p[a + 1]!, az = p[a + 2]!;
    const e1x = p[b]! - ax, e1y = p[b + 1]! - ay, e1z = p[b + 2]! - az;
    const e2x = p[c]! - ax, e2y = p[c + 1]! - ay, e2z = p[c + 2]! - az;
    const d = ray.direction, o = ray.origin;
    const px = d.y * e2z - d.z * e2y, py = d.z * e2x - d.x * e2z, pz = d.x * e2y - d.y * e2x;
    const determinant = e1x * px + e1y * py + e1z * pz;
    if (Math.abs(determinant) < 1e-12) return Infinity;
    const inverse = 1 / determinant;
    const tx = o.x - ax, ty = o.y - ay, tz = o.z - az;
    const u = (tx * px + ty * py + tz * pz) * inverse;
    if (u < 0 || u > 1) return Infinity;
    const qx = ty * e1z - tz * e1y, qy = tz * e1x - tx * e1z, qz = tx * e1y - ty * e1x;
    const v = (d.x * qx + d.y * qy + d.z * qz) * inverse;
    if (v < 0 || u + v > 1) return Infinity;
    const distance = (e2x * qx + e2y * qy + e2z * qz) * inverse;
    return distance >= 0 ? distance : Infinity;
  }
}

/** The ray's parameter interval inside a box, or null when it misses. */
function clipToBox(ray: THREE.Ray, box: THREE.Box3): [number, number] | null {
  let near = 0, far = Infinity;
  for (const axis of ["x", "y", "z"] as const) {
    const origin = ray.origin[axis], direction = ray.direction[axis];
    const min = box.min[axis] - 1e-4, max = box.max[axis] + 1e-4;
    if (Math.abs(direction) < 1e-12) {
      if (origin < min || origin > max) return null;
      continue;
    }
    let t0 = (min - origin) / direction, t1 = (max - origin) / direction;
    if (t0 > t1) [t0, t1] = [t1, t0];
    near = Math.max(near, t0); far = Math.min(far, t1);
    if (near > far) return null;
  }
  return [near, far];
}

const grids = new WeakMap<THREE.BufferGeometry, MeshRayGrid>();
const localRay = new THREE.Ray();
const inverse = new THREE.Matrix4();
const localPoint = new THREE.Vector3();

/** Nearest hit of a world-space ray on any of the meshes (grids are built on first use). */
export function intersectMeshes(ray: THREE.Ray, objects: readonly THREE.Object3D[]): RayHit | null {
  let best: RayHit | null = null;
  for (const object of objects) {
    if (!(object instanceof THREE.Mesh) || !object.visible) continue;
    const geometry = object.geometry as THREE.BufferGeometry;
    const position = geometry.getAttribute("position") as THREE.BufferAttribute | undefined;
    if (!position) continue;
    let grid = grids.get(geometry);
    if (!grid || grid.version !== position.version) { grid = new MeshRayGrid(geometry); grids.set(geometry, grid); }
    object.updateWorldMatrix(true, false);
    localRay.copy(ray).applyMatrix4(inverse.copy(object.matrixWorld).invert());
    const localDistance = grid.intersect(localRay);
    if (localDistance === Infinity) continue;
    const point = localRay.at(localDistance, localPoint).applyMatrix4(object.matrixWorld).clone();
    const distance = point.distanceTo(ray.origin);
    if (!best || distance < best.distance) best = { point, distance };
  }
  return best;
}
