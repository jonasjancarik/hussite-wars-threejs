import type { TerrainCell } from "./terrain-regions.ts";

export interface FortificationPlacement {
  model: string;
  x: number;
  z: number;
  scale: number;
  rotation: number;
}

export interface FortificationPlan {
  replacedCells: ReadonlySet<string>;
  placements: FortificationPlacement[];
}

/** Compressed scenery for the existing labelled manor sites, not a site reconstruction. */
export function planFortifications(scenario: string | null, tiles: readonly TerrainCell[]): FortificationPlan {
  const site = scenario === "nekmir_1419" ? { col: 18, row: 7, timber: true }
    : scenario === "malesov_1424" ? { col: 14, row: 11, timber: false } : null;
  const empty = { replacedCells: new Set<string>(), placements: [] };
  if (!site) return empty;
  const keys = [0, 1].flatMap(dc => [0, 1].map(dr => `${site.col + dc},${site.row + dr}`));
  const cells = new Map(tiles.map(cell => [`${cell.col},${cell.row}`, cell]));
  // An edited map must fall back to its real terrain rather than inherit a misplaced castle.
  if (!keys.every(key => cells.get(key)?.terrain === "town")) return empty;
  const origin = cells.get(`${site.col},${site.row}`)!.center;
  const placements: FortificationPlacement[] = [];
  const add = (model: string, x: number, z: number, scale: number, rotation = 0): void => {
    placements.push({ model, x: origin.x + x, z: origin.z + z, scale, rotation });
  };
  // Keep the middle of the four playable town hexes open. Breaks between wall
  // fragments also avoid suggesting a new impassable perimeter in the rules.
  add("fort_manor", 2, -Math.sqrt(3) * 2, .4);
  add(site.timber ? "fort_tower_square" : "fort_tower_round", 8.2, 1.3, .46);
  add("fort_gatehouse", 2.8, 11.4, .5);
  add(site.timber ? "timber_palisade" : "fort_wall", -2.45, 2.3, .65, -Math.PI / 2);
  add("fort_wall", -2.45, 7.2, .65, -Math.PI / 2);
  add("fort_wall", 8.5, 6.6, .65, Math.PI / 2);
  add("timber_palisade", 5.4, 12.9, .5);
  return { replacedCells: new Set(keys), placements };
}
