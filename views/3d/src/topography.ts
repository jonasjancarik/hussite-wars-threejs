import { HexLayout } from "./hex-coordinates.ts";
import type { TerrainCell, TerrainRegions } from "./terrain-regions.ts";

const HIGH_ELEVATION = 6.0;

function nameOf(cell: TerrainCell): string { return cell.terrain.toLowerCase(); }
function isHigh(cell: TerrainCell): boolean { return ["hills", "hill", "ridge", "highland"].includes(nameOf(cell)); }
function isSlope(cell: TerrainCell): boolean { return ["slope", "steep_slope"].includes(nameOf(cell)); }
function isWater(cell: TerrainCell): boolean { return ["water", "river", "lake"].includes(nameOf(cell)); }
function isWet(cell: TerrainCell): boolean { return ["mud", "swamp", "marsh"].includes(nameOf(cell)); }

function semanticLowElevation(cell: TerrainCell): number {
  if (isWater(cell)) return -0.7;
  if (isWet(cell)) return -0.36;
  if (nameOf(cell) === "trenches") return -0.14;
  return 0;
}

function semanticLowElevationForName(terrain: string): number | null {
  const name = terrain.toLowerCase();
  if (["water", "river", "lake"].includes(name)) return -0.7;
  if (["mud", "swamp", "marsh"].includes(name)) return -0.36;
  if (name === "trenches") return -0.14;
  return null;
}

function distanceFrom(layout: HexLayout, sources: TerrainCell[]): Map<string, number> {
  const distances = new Map<string, number>();
  const queue = sources.map(cell => ({ col: cell.col, row: cell.row }));
  for (const cell of sources) distances.set(`${cell.col},${cell.row}`, 0);
  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index]!, distance = distances.get(`${current.col},${current.row}`)!;
    for (const neighbour of layout.neighbours(current)) {
      const key = `${neighbour.col},${neighbour.row}`;
      if (distances.has(key)) continue;
      distances.set(key, distance + 1);
      queue.push(neighbour);
    }
  }
  return distances;
}

/** Infers continuous visual elevation from semantic terrain without altering game rules. */
export class TopographyPlan {
  private readonly field: TerrainRegions;
  private readonly layout: HexLayout;
  private readonly elevations = new Map<string, number>();

  public constructor(field: TerrainRegions, heightOverrides: ReadonlyMap<string, number> = new Map()) {
    this.field = field;
    this.layout = new HexLayout(field.cols, field.rows, field.hexRadius);
    const elevated = (cell: TerrainCell): boolean => isHigh(cell) || (heightOverrides.get(this.key(cell.col,cell.row)) ?? 0) >= HIGH_ELEVATION;
    const high = field.tiles.filter(elevated);
    const low = field.tiles.filter(cell => !elevated(cell) && !isSlope(cell));
    const highDistance = distanceFrom(this.layout, high);
    const lowDistance = distanceFrom(this.layout, low);
    for (const cell of field.tiles) {
      const key = this.key(cell.col, cell.row);
      if (heightOverrides.has(key)) this.elevations.set(key,heightOverrides.get(key)!);
      else if (isHigh(cell)) this.elevations.set(key, HIGH_ELEVATION);
      else if (!isSlope(cell)) this.elevations.set(key, semanticLowElevation(cell));
      else {
        const toHigh = highDistance.get(key) ?? Infinity;
        const toLow = lowDistance.get(key) ?? Infinity;
        const highWeight = Number.isFinite(toHigh) && Number.isFinite(toLow)
          ? toLow / Math.max(1, toHigh + toLow)
          : Number.isFinite(toHigh) ? 0.65 : 0.24;
        this.elevations.set(key, 0.12 + highWeight * (HIGH_ELEVATION - 0.12));
      }
    }
    // A dry neck adjoining the crest becomes a short ramp rather than a
    // vertical wall. Wet cells retain their semantic depression.
    const dryRamps = new Map<string, number>();
    for (const cell of field.tiles) {
      if (elevated(cell) || isSlope(cell) || isWet(cell) || isWater(cell)) continue;
      const highestNeighbour = Math.max(0, ...this.layout.neighbours(cell)
        .map(neighbour => this.cellElevation(neighbour.col, neighbour.row)));
      if (highestNeighbour > 1.5) dryRamps.set(this.key(cell.col, cell.row), Math.min(1.8, highestNeighbour * 0.30));
    }
    for (const [key, elevation] of dryRamps) this.elevations.set(key, elevation);
  }

  public cellElevation(col: number, row: number): number {
    return this.elevations.get(this.key(col, row)) ?? 0;
  }

  public elevationAt(x: number, z: number): number {
    let cell = this.field.cellAt(x, z);
    if (!cell) {
      let nearest: TerrainCell | null = null, nearestDistance = Infinity;
      for (const candidate of this.field.tiles) {
        const distance = (x - candidate.center.x) ** 2 + (z - candidate.center.z) ** 2;
        if (distance < nearestDistance) { nearest = candidate; nearestDistance = distance; }
      }
      cell = nearest;
    }
    if (!cell) return 0;
    const candidates = [cell, ...this.layout.neighbours(cell)
      .map(neighbour => this.field.getCell(neighbour.col, neighbour.row))
      .filter((candidate): candidate is TerrainCell => candidate !== null)];
    let weighted = 0, total = 0;
    for (const candidate of candidates) {
      const distance = Math.hypot(x - candidate.center.x, z - candidate.center.z) / this.field.hexRadius;
      const weight = Math.exp(-distance * distance * 2.35);
      weighted += this.cellElevation(candidate.col, candidate.row) * weight;
      total += weight;
    }
    const regionalElevation = total > 0 ? weighted / total : this.cellElevation(cell.col, cell.row);
    // Terrain-region weights are continuous at authored hex boundaries. They
    // keep the protected interior of water and mud low while easing their
    // banks into adjoining slopes instead of creating vertical hex walls.
    const terrainWeights = this.field.weightsAt(x, z);
    let lowWeight = 0, lowElevation = 0;
    for (const [terrain, weight] of Object.entries(terrainWeights)) {
      const target = semanticLowElevationForName(terrain);
      if (target === null) continue;
      lowWeight += weight;
      lowElevation += target * weight;
    }
    if (lowWeight <= 0) return regionalElevation;
    const target = lowElevation / lowWeight;
    return regionalElevation * (1 - lowWeight) + target * lowWeight;
  }

  private key(col: number, row: number): string { return `${col},${row}`; }
}
