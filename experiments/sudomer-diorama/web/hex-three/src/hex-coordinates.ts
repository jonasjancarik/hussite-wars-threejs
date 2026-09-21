import type { HexCoord } from "./types.ts";

export const COLS = 20;
export const ROWS = 12;
export const HEX_RADIUS = 4;
const ROOT3 = Math.sqrt(3);

export class HexLayout {
  public readonly cols: number;
  public readonly rows: number;
  public readonly radius: number;
  public constructor(cols: number, rows: number, radius = HEX_RADIUS) {
    this.cols = cols; this.rows = rows; this.radius = radius;
  }

  public center(col: number, row: number): { x: number; z: number } {
    const x = 1.5 * this.radius * col;
    const z = ROOT3 * this.radius * (row + 0.5 * (col & 1));
    const midX = 1.5 * this.radius * (this.cols - 1) * 0.5;
    const midZ = ROOT3 * this.radius * ((this.rows - 1) * 0.5 + (this.cols > 1 ? 0.25 : 0));
    return { x: x - midX, z: z - midZ };
  }

  public contains(x: number, z: number, col: number, row: number): boolean {
    const center = this.center(col, row);
    const dx = Math.abs(x - center.x);
    const dz = Math.abs(z - center.z);
    return dx <= this.radius + 1e-7 && dz <= ROOT3 * this.radius * 0.5 + 1e-7
      && ROOT3 * dx + dz <= ROOT3 * this.radius + 1e-7;
  }

  public coordAt(x: number, z: number): HexCoord | null {
    const first = this.center(0, 0);
    const estimatedCol = Math.round((x - first.x) / (1.5 * this.radius));
    const candidates: HexCoord[] = [];
    for (let col = Math.max(0, estimatedCol - 1); col <= Math.min(this.cols - 1, estimatedCol + 1); col += 1) {
      const rowBase = Math.round((z - this.center(col, 0).z) / (ROOT3 * this.radius));
      for (let row = Math.max(0, rowBase - 1); row <= Math.min(this.rows - 1, rowBase + 1); row += 1) {
        if (this.contains(x, z, col, row)) candidates.push({ col, row });
      }
    }
    if (candidates.length === 0) return null;
    candidates.sort((a, b) => a.col - b.col || a.row - b.row);
    return candidates[0] ?? null;
  }

  public neighbours(coord: HexCoord): HexCoord[] {
    const even = coord.col % 2 === 0;
    const offsets = even
      ? [[1, 0], [1, -1], [0, -1], [-1, -1], [-1, 0], [0, 1]]
      : [[1, 1], [1, 0], [0, -1], [-1, 0], [-1, 1], [0, 1]];
    return offsets.map(([dc, dr]) => ({ col: coord.col + dc!, row: coord.row + dr! }))
      .filter(({ col, row }) => col >= 0 && col < this.cols && row >= 0 && row < this.rows);
  }

  public distanceToMap(x: number, z: number): number {
    if (this.coordAt(x, z)) return 0;
    let minimum = Infinity;
    for (let col = 0; col < this.cols; col += 1) {
      for (let row = 0; row < this.rows; row += 1) {
        const center = this.center(col, row);
        const vertices = Array.from({ length: 6 }, (_, index) => {
          const angle = index * Math.PI / 3;
          return { x: center.x + Math.cos(angle) * this.radius, z: center.z + Math.sin(angle) * this.radius };
        });
        for (let index = 0; index < vertices.length; index += 1) {
          const a = vertices[index]!, b = vertices[(index + 1) % vertices.length]!;
          const vx = b.x - a.x, vz = b.z - a.z;
          const lengthSquared = vx * vx + vz * vz;
          const t = Math.max(0, Math.min(1, ((x - a.x) * vx + (z - a.z) * vz) / lengthSquared));
          minimum = Math.min(minimum, Math.hypot(x - (a.x + vx * t), z - (a.z + vz * t)));
        }
      }
    }
    return minimum;
  }

  public bounds(margin = this.radius * 1.45): { minX: number; maxX: number; minZ: number; maxZ: number } {
    const centers = [this.center(0, 0), this.center(this.cols - 1, 0),
      this.center(0, this.rows - 1), this.center(this.cols - 1, this.rows - 1)];
    return { minX: Math.min(...centers.map(point => point.x)) - margin,
      maxX: Math.max(...centers.map(point => point.x)) + margin,
      minZ: Math.min(...centers.map(point => point.z)) - margin,
      maxZ: Math.max(...centers.map(point => point.z)) + margin };
  }
}

const defaultLayout = new HexLayout(COLS, ROWS);
export function hexCenter(col: number, row: number): { x: number; z: number } { return defaultLayout.center(col, row); }
export function pointInsideHex(x: number, z: number, col: number, row: number): boolean { return defaultLayout.contains(x, z, col, row); }
export function coordAt(x: number, z: number): HexCoord | null { return defaultLayout.coordAt(x, z); }
export function oddQNeighbours(coord: HexCoord): HexCoord[] { return defaultLayout.neighbours(coord); }

export function terrainFor(col: number, row: number): "plains" | "water" | "mud" | "dam" {
  if (col >= 6 && col <= 13 && row <= 4) return "water";
  if (col >= 6 && col <= 13 && row >= 7) return "mud";
  if (col === 9 && (row === 5 || row === 6)) return "dam";
  return "plains";
}
