import type { HexCoord } from "./types.ts";

export const COLS = 20;
export const ROWS = 12;
export const HEX_RADIUS = 4;
const ROOT3 = Math.sqrt(3);

export function hexCenter(col: number, row: number): { x: number; z: number } {
  const x = 1.5 * HEX_RADIUS * col;
  const z = ROOT3 * HEX_RADIUS * (row + 0.5 * (col & 1));
  const midX = 1.5 * HEX_RADIUS * (COLS - 1) * 0.5;
  const midZ = ROOT3 * HEX_RADIUS * ((ROWS - 1) * 0.5 + 0.25);
  return { x: x - midX, z: z - midZ };
}

export function pointInsideHex(x: number, z: number, col: number, row: number): boolean {
  const center = hexCenter(col, row);
  const dx = Math.abs(x - center.x);
  const dz = Math.abs(z - center.z);
  return dx <= HEX_RADIUS + 1e-7
    && dz <= ROOT3 * HEX_RADIUS * 0.5 + 1e-7
    && ROOT3 * dx + dz <= ROOT3 * HEX_RADIUS + 1e-7;
}

export function coordAt(x: number, z: number): HexCoord | null {
  const first = hexCenter(0, 0);
  const estimatedCol = Math.round((x - first.x) / (1.5 * HEX_RADIUS));
  const candidates: HexCoord[] = [];
  for (let col = Math.max(0, estimatedCol - 1); col <= Math.min(COLS - 1, estimatedCol + 1); col += 1) {
    const rowBase = Math.round((z - hexCenter(col, 0).z) / (ROOT3 * HEX_RADIUS));
    for (let row = Math.max(0, rowBase - 1); row <= Math.min(ROWS - 1, rowBase + 1); row += 1) {
      if (pointInsideHex(x, z, col, row)) candidates.push({ col, row });
    }
  }
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.col - b.col || a.row - b.row);
  return candidates[0] ?? null;
}

export function oddQNeighbours(coord: HexCoord): HexCoord[] {
  const even = coord.col % 2 === 0;
  const offsets = even
    ? [[1, 0], [1, -1], [0, -1], [-1, -1], [-1, 0], [0, 1]]
    : [[1, 1], [1, 0], [0, -1], [-1, 0], [-1, 1], [0, 1]];
  return offsets
    .map(([dc, dr]) => ({ col: coord.col + dc!, row: coord.row + dr! }))
    .filter(({ col, row }) => col >= 0 && col < COLS && row >= 0 && row < ROWS);
}

export function terrainFor(col: number, row: number): "plains" | "water" | "mud" | "dam" {
  if (col >= 6 && col <= 13 && row <= 4) return "water";
  if (col >= 6 && col <= 13 && row >= 7) return "mud";
  if (col === 9 && (row === 5 || row === 6)) return "dam";
  return "plains";
}
