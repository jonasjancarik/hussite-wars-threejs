import { HexLayout } from "./hex-coordinates.ts";
import type { TerrainCell, TerrainRegions } from "./terrain-regions.ts";

const HIGH_ELEVATION = 6.0;
/**
 * Exponent on barycentric weights between hex centres: 1 is a plain linear
 * ramp; higher flattens each centre more and steepens the ramp between.
 */
const LATTICE_SHARPNESS = 1.25;
/** Share of the gap to its neighbours' mean that a lower dry cell is lifted by. */
const FLANK_FILL = 0.55;

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

/** Water keeps one absolute level so every pond and river shares a surface. */
function waterLevelForName(terrain: string): number | null {
  return ["water", "river", "lake"].includes(terrain.toLowerCase()) ? -0.7 : null;
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
    // Hex edges zigzag, so a hill's flank alternates protruding cells with
    // notches. Lift each lower dry cell toward the ground around it, more so
    // the more it is enclosed, so the flank reads as one slope rather than a
    // row of lobes. Hill tops keep their height; nothing is ever lowered.
    const fills = new Map<string, number>();
    const flank = new Set<string>();
    for (const cell of field.tiles) {
      const key = this.key(cell.col, cell.row);
      if (heightOverrides.has(key) || elevated(cell) || isWet(cell) || isWater(cell)) continue;
      const neighbours = this.layout.neighbours(cell).map(neighbour => field.getCell(neighbour.col, neighbour.row))
        .filter((neighbour): neighbour is TerrainCell => neighbour !== null && !isWater(neighbour));
      // Only the hill's own flank: open ground further out stays where it is.
      if (!neighbours.some(elevated)) continue;
      flank.add(key);
      const around = neighbours.map(neighbour => this.cellElevation(neighbour.col, neighbour.row));
      const mean = around.reduce((sum, value) => sum + value, 0) / around.length;
      const own = this.cellElevation(cell.col, cell.row);
      if (mean > own) fills.set(key, own + (mean - own) * FLANK_FILL);
    }
    for (const [key, elevation] of fills) this.elevations.set(key, elevation);
    // The zigzag still leaves flank cells alternating high and low; average
    // each with the flank cells beside it so the foot of the hill is even.
    const evened = new Map<string, number>();
    for (const key of flank) {
      const [col, row] = key.split(",").map(Number) as [number, number];
      const beside = this.layout.neighbours({ col, row }).map(neighbour => this.key(neighbour.col, neighbour.row))
        .filter(neighbour => flank.has(neighbour));
      if (!beside.length) continue;
      const mean = beside.reduce((sum, neighbour) => sum + this.elevations.get(neighbour)!, 0) / beside.length;
      evened.set(key, (this.elevations.get(key)! + mean) / 2);
    }
    for (const [key, elevation] of evened) this.elevations.set(key, elevation);
    // Mud, swamp and trenches are a shallow dip in the land they lie on, not
    // an absolute level: a muddy saddle on a ridge stays up on the ridge
    // instead of becoming a pit. On flat ground this is the same -0.36/-0.14.
    const dips = new Map<string, number>();
    for (const cell of field.tiles) {
      const key = this.key(cell.col, cell.row);
      if (heightOverrides.has(key) || (!isWet(cell) && nameOf(cell) !== "trenches")) continue;
      const dry = this.layout.neighbours(cell).map(neighbour => field.getCell(neighbour.col, neighbour.row))
        .filter((neighbour): neighbour is TerrainCell => neighbour !== null
          && !isWet(neighbour) && !isWater(neighbour) && nameOf(neighbour) !== "trenches");
      if (!dry.length) continue;
      const ground = dry.reduce((sum, neighbour) => sum + this.cellElevation(neighbour.col, neighbour.row), 0) / dry.length;
      dips.set(key, ground + semanticLowElevation(cell));
    }
    for (const [key, elevation] of dips) this.elevations.set(key, elevation);
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
    const regionalElevation = this.latticeElevation(x, z, cell);
    // Terrain-region weights are continuous at authored hex boundaries. They
    // keep the protected interior of water at its level while easing its
    // banks into adjoining slopes instead of creating vertical hex walls.
    const terrainWeights = this.field.weightsAt(x, z);
    let lowWeight = 0, lowElevation = 0;
    for (const [terrain, weight] of Object.entries(terrainWeights)) {
      const target = waterLevelForName(terrain);
      if (target === null) continue;
      lowWeight += weight;
      lowElevation += target * weight;
    }
    if (lowWeight <= 0) return regionalElevation;
    const target = lowElevation / lowWeight;
    return regionalElevation * (1 - lowWeight) + target * lowWeight;
  }

  /**
   * Hex centres form an equilateral triangular lattice. Interpolate between
   * the three centres around a point with sharpened barycentric weights: each
   * centre keeps its exact elevation and a gently flat top where its formation
   * stands, and the ground ramps smoothly between centres instead of stepping
   * at hex edges.
   */
  private latticeElevation(x: number, z: number, cell: TerrainCell): number {
    const candidates = [cell, ...this.layout.neighbours(cell)
      .map(neighbour => this.field.getCell(neighbour.col, neighbour.row))
      .filter((candidate): candidate is TerrainCell => candidate !== null)]
      .map(candidate => ({ candidate, distance: (x - candidate.center.x) ** 2 + (z - candidate.center.z) ** 2 }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 3).map(entry => entry.candidate);
    const elevation = (index: number): number => this.cellElevation(candidates[index]!.col, candidates[index]!.row);
    if (candidates.length === 1) return elevation(0);
    const [a, b] = candidates as [TerrainCell, TerrainCell];
    const c = candidates[2];
    const area = c ? (b.center.x - a.center.x) * (c.center.z - a.center.z) - (c.center.x - a.center.x) * (b.center.z - a.center.z) : 0;
    let weights: number[];
    if (c && Math.abs(area) > 1e-6) {
      const wb = ((x - a.center.x) * (c.center.z - a.center.z) - (c.center.x - a.center.x) * (z - a.center.z)) / area;
      const wc = ((b.center.x - a.center.x) * (z - a.center.z) - (x - a.center.x) * (b.center.z - a.center.z)) / area;
      weights = [1 - wb - wc, wb, wc];
    } else {
      // Two centres (a one-row map, or beyond its edge): project onto the segment.
      const dx = b.center.x - a.center.x, dz = b.center.z - a.center.z;
      const t = ((x - a.center.x) * dx + (z - a.center.z) * dz) / (dx * dx + dz * dz);
      weights = [1 - t, t];
    }
    let weighted = 0, total = 0;
    weights.forEach((weight, index) => {
      const sharpened = Math.max(0, weight) ** LATTICE_SHARPNESS;
      weighted += sharpened * elevation(index);
      total += sharpened;
    });
    return total > 0 ? weighted / total : elevation(0);
  }

  private key(col: number, row: number): string { return `${col},${row}`; }
}
