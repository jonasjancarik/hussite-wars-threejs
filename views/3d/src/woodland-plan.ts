/**
 * Terrain-derived woodland for generated battles. Forest hexes become mixed
 * stands of the shared low-poly tree kit, shrubs soften the woodland edge,
 * hills carry the odd rock outcrop and swamps grow reed beds. Everything keeps clear of the largest
 * formation footprint on every hex, so trees frame units instead of hiding
 * them. Presentation only: no rule or terrain type changes.
 */
import { decorationSeed } from "./generated-meadow.ts";
import { FORMATION_FOOTPRINT } from "./formation-envelope.ts";
import { distanceToPolygon, mulberry32, pointInPolygon } from "./geometry-utils.ts";
import type { HexLayout } from "./hex-coordinates.ts";
import { fractalNoise, isWaterTerrain, type TerrainCell, type TerrainRegions } from "./terrain-regions.ts";
import { isRoadTerrain } from "./road-corridors.ts";

export interface WoodlandPlacement {
  model: string;
  col: number;
  row: number;
  x: number;
  z: number;
  scale: number;
  rotation: number;
  /** Linear RGB multiplier for foliage only; trunks keep their colour. */
  tint: [number, number, number];
}

interface Species {
  model: string;
  weight: number;
  /** Uniform scale range. */
  scale: [number, number];
  /** Unscaled crown radius in metres, measured from the GLB. */
  crown: number;
  /** Deciduous crowns are removed in winter, leaving bare branches. */
  deciduous: boolean;
}

const BROADLEAF: Species[] = [
  { model: "procedural-worlds/pw_deciduous_01", weight: .24, scale: [.50, .68], crown: 2.1, deciduous: true },
  { model: "procedural-worlds/pw_deciduous_02", weight: .24, scale: [.50, .66], crown: 1.5, deciduous: true },
  { model: "procedural-worlds/pw_deciduous_03", weight: .20, scale: [.46, .60], crown: 1.4, deciduous: true },
  { model: "broadleaf_olive", weight: .14, scale: [.72, .95], crown: 2.2, deciduous: true },
  { model: "broadleaf_gold", weight: .07, scale: [.72, .95], crown: 1.9, deciduous: true },
  { model: "cypress", weight: .11, scale: [.95, 1.3], crown: .55, deciduous: false },
];
const SHRUB: Species = { model: "procedural-worlds/pw_shrub_01", weight: 1, scale: [.75, 1.15], crown: .9, deciduous: false };
const ROCK: Species = { model: "bank_rocks", weight: 1, scale: [.55, .85], crown: .95, deciduous: false };
const REEDS: Species = { model: "reeds", weight: 1, scale: [.75, 1.15], crown: .6, deciduous: false };

/** Leaf colour drifts across a wood; each tree adds a little of its own. */
const FOLIAGE: Array<[number, number, number]> = [
  [.80, .92, .96], // blue-green
  [.92, .98, .88], // cool sage
  [1, 1, 1],
  [1.08, 1.04, .82], // olive
  [1.2, 1.1, .74], // yellowing
];

/** Trunks keep at least this much ground between them and any formation outline. */
export const TRUNK_CLEARANCE = .45;
/** Share of a crown's radius allowed to overhang a formation outline. */
export const CROWN_OVERHANG = .5;

const FOOTPRINT = FORMATION_FOOTPRINT.map(([x, z]) => [x, z] as [number, number]);
const key = (cell: { col: number; row: number }): string => `${cell.col},${cell.row}`;

export function woodlandModels(winter: boolean): string[] {
  return [...new Set([...BROADLEAF.filter(species => !winter || species.model.startsWith("procedural-worlds") || !species.deciduous)
    .map(species => species.model), ...(winter ? [] : [SHRUB.model]), ROCK.model, REEDS.model])];
}

/** Distance from (x, z) to the nearest formation outline of `cells`; negative inside one. */
export function formationClearance(x: number, z: number, cells: readonly TerrainCell[]): number {
  let clearance = Infinity;
  for (const cell of cells) {
    const dx = x - cell.center.x, dz = z - cell.center.z;
    if (dx * dx + dz * dz > 64) continue;
    const distance = distanceToPolygon(dx, dz, FOOTPRINT);
    clearance = Math.min(clearance, pointInPolygon(dx, dz, FOOTPRINT) ? -distance : distance);
  }
  return clearance;
}

export interface WoodlandSource {
  field: TerrainRegions;
  layout: HexLayout;
  winter: boolean;
  /** Cells whose scenery is owned by another planner (settlements, castles). */
  replacedCells: ReadonlySet<string>;
  /** Existing environment placements to keep clear of. */
  obstacles: ReadonlyArray<{ x: number; z: number }>;
}

export function planWoodland(source: WoodlandSource): WoodlandPlacement[] {
  const { field, layout, winter } = source;
  const cells = new Map(field.tiles.map(cell => [key(cell), cell]));
  const placements: WoodlandPlacement[] = [];
  const trunks: Array<{ x: number; z: number; radius: number }> = [];
  const neighbours = (cell: TerrainCell): TerrainCell[] => layout.neighbours(cell)
    .map(coord => cells.get(key(coord))).filter((other): other is TerrainCell => Boolean(other));
  const species = winter ? BROADLEAF.filter(entry => entry.model.startsWith("procedural-worlds") || !entry.deciduous) : BROADLEAF;

  const fits = (cell: TerrainCell, x: number, z: number, kind: Species, scale: number, terrain: (name: string) => boolean): boolean => {
    if (!layout.contains(x, z, cell.col, cell.row)) return false;
    const classified = field.classify(x, z);
    if (!classified || !terrain(classified.toLowerCase())) return false;
    if ((field.roads.active ? field.roads.sample(x, z)?.weight ?? 0 : 0) > .05) return false;
    if (field.waterInfluenceAt(x, z) > .05) return false;
    const radius = kind.crown * scale;
    const clearance = formationClearance(x, z, [cell, ...neighbours(cell)]);
    if (clearance < Math.max(TRUNK_CLEARANCE, radius * (1 - CROWN_OVERHANG))) return false;
    if (source.obstacles.some(other => Math.hypot(x - other.x, z - other.z) < 2.2 + radius * .5)) return false;
    return !trunks.some(other => Math.hypot(x - other.x, z - other.z) < (radius + other.radius) * .62);
  };

  const place = (cell: TerrainCell, kind: Species, random: () => number, count: number, attempts: number,
    terrain: (name: string) => boolean, bias?: { x: number; z: number }): void => {
    // Leafy scrub would read as summer on snow; bare trees and rocks remain.
    if (winter && kind === SHRUB) return;
    for (let placed = 0, attempt = 0; placed < count && attempt < attempts; attempt += 1) {
      const angle = random() * Math.PI * 2, reach = Math.sqrt(random()) * layout.radius;
      let x = cell.center.x + Math.cos(angle) * reach, z = cell.center.z + Math.sin(angle) * reach;
      if (bias) { x = x * .55 + bias.x * .45; z = z * .55 + bias.z * .45; }
      const scale = kind.scale[0] + (kind.scale[1] - kind.scale[0]) * random();
      if (!fits(cell, x, z, kind, scale, terrain)) continue;
      trunks.push({ x, z, radius: kind.crown * scale });
      placements.push({ model: kind.model, col: cell.col, row: cell.row, x, z, scale,
        rotation: random() * Math.PI * 2, tint: foliageTint(field.seed, x, z, random) });
      placed += 1;
    }
  };

  const open = (name: string): boolean => !isWaterTerrain(name) && !isRoadTerrain(name)
    && !["town", "church", "mud", "swamp", "marsh", "trenches"].includes(name);
  for (const cell of field.tiles) {
    if (source.replacedCells.has(key(cell))) continue;
    const terrain = cell.terrain.toLowerCase();
    const random = mulberry32(decorationSeed(field.seed, cell.col, cell.row, "woodland"));
    if (terrain === "forest") {
      // A slow noise field groups conifers into stands rather than salting every wood.
      const stand = fractalNoise(field.seed ^ 0x2c1b3c6d, cell.center.x / 26, cell.center.z / 26, 2);
      for (let tree = 0; tree < 14; tree += 1) {
        place(cell, pickSpecies(species, random(), stand), random, 1, 6, name => name === "forest");
      }
      place(cell, SHRUB, random, 2, 12, name => name === "forest");
    } else if (terrain === "swamp" || terrain === "marsh") {
      // Reed beds in clumps around the formation clearing.
      const marsh = (name: string): boolean => name === "swamp" || name === "marsh";
      const clumps = 2 + Math.floor(random() * 3);
      for (let clump = 0; clump < clumps; clump += 1) place(cell, REEDS, random, 1 + Math.floor(random() * 3), 10, marsh);
    } else if (open(terrain)) {
      const woods = neighbours(cell).filter(other => other.terrain.toLowerCase() === "forest");
      // Scrub and the odd sapling spill out of a wood onto the open ground beside it.
      for (const wood of woods) {
        const edge = { x: (cell.center.x + wood.center.x) / 2, z: (cell.center.z + wood.center.z) / 2 };
        place(cell, SHRUB, random, random() < .7 ? 1 : 2, 10, open, edge);
        if (random() < .3) place(cell, pickSpecies(species, random(), -1), random, 1, 8, open, edge);
      }
      if (["hills", "hill", "ridge", "highland", "slope", "steep_slope"].includes(terrain) && random() < .28) {
        place(cell, ROCK, random, 1, 10, open);
      }
    }
  }
  return placements;
}

function pickSpecies(species: Species[], roll: number, stand: number): Species {
  // Conifer stands: in a strongly positive noise region most trees are cypress.
  const coniferShare = stand > .18 ? .6 : 0;
  const cypress = species.find(entry => entry.model === "cypress");
  if (cypress && roll < coniferShare) return cypress;
  const rest = roll < coniferShare ? 0 : (roll - coniferShare) / (1 - coniferShare);
  const total = species.reduce((sum, entry) => sum + entry.weight, 0);
  let cumulative = 0;
  for (const entry of species) {
    cumulative += entry.weight / total;
    if (rest < cumulative) return entry;
  }
  return species.at(-1)!;
}

function foliageTint(seed: number, x: number, z: number, random: () => number): [number, number, number] {
  const drift = (fractalNoise(seed ^ 0x3e8a91f1, x / 18, z / 18, 2) + 1) / 2;
  const position = Math.min(FOLIAGE.length - 1.001, Math.max(0, drift * (FOLIAGE.length - 1) + (random() - .5) * 1.6));
  const index = Math.floor(position), t = position - index;
  const a = FOLIAGE[index]!, b = FOLIAGE[index + 1]!;
  const brightness = .92 + random() * .16;
  return [0, 1, 2].map(channel => (a[channel]! + (b[channel]! - a[channel]!) * t) * brightness) as [number, number, number];
}
