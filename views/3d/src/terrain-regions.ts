import { HexLayout } from "./hex-coordinates.ts";
import { RoadCorridors, isRoadTerrain } from "./road-corridors.ts";

/**
 * Renderer-neutral terrain fields for odd-q, flat-top hex maps.
 *
 * The game still owns the discrete terrain assignment. This module turns that
 * assignment into a continuous field: the middle of every hex is guaranteed to
 * keep its assigned terrain, while the outside ring is blended with adjacent
 * cells using coherent, seeded noise. Consequently two cells of the same type
 * form one visual region instead of producing an outline around every hex.
 */

export type TerrainType = string;

export interface TerrainTile {
  col: number;
  row: number;
  terrain: TerrainType;
}

export interface TerrainRegionOptions {
  cols: number;
  rows: number;
  tiles: readonly TerrainTile[];
  /** Optional scenario identity. It is part of the seed, so scenarios do not share noise by accident. */
  scenario?: string;
  seed?: number | string;
  /** Distance from a hex centre to a vertex, in world units. */
  hexRadius?: number;
  /** Map origin. By default the complete map is centred around (0, 0). */
  origin?: { x: number; z: number };
  /** Required fraction of each hex that stays its assigned terrain. Defaults to 0.82. */
  coreCoverage?: number;
  /** Relative displacement of boundaries. Defaults to 0.18. */
  boundaryNoise?: number;
  /** Default spacing for area-coverage measurements. Defaults to 0.1 world units. */
  sampleStep?: number;
  /** Terrain used for omitted cells. Defaults to plains, or the first tile terrain. */
  defaultTerrain?: TerrainType;
}

export interface TerrainPoint {
  x: number;
  z: number;
}

export interface TerrainWeights {
  readonly [terrain: string]: number;
}

export interface TerrainHeightInput {
  /** Weighted low-frequency elevation before renderer-specific displacement. */
  base: number;
  /** Seeded local variation suitable for a vertex displacement input. */
  variation: number;
  /** Final suggested height, equal to base + variation. */
  height: number;
  /** Weighted surface roughness in the range [0, 1]. */
  roughness: number;
  /** Weighted wetness in the range [0, 1]. */
  wetness: number;
}

export interface TerrainCoverageCell {
  col: number;
  row: number;
  terrain: TerrainType;
  samples: number;
  matching: number;
  coverage: number;
}

export interface TerrainCoverage {
  minimum: number;
  sampleStep: number;
  cells: TerrainCoverageCell[];
}

export interface TerrainCell extends TerrainTile {
  center: TerrainPoint;
}

export interface TerrainRegionsInput extends TerrainRegionOptions {}

const ROOT3 = Math.sqrt(3);
const DEFAULT_RADIUS = 4;
const DEFAULT_CORE_COVERAGE = 0.82;
const DEFAULT_BOUNDARY_NOISE = 0.18;
const DEFAULT_SAMPLE_STEP = 0.1;
const EPSILON = 1e-9;
/** Squared (in hex radii) spread of each centre's say in the water share near a shore. */
const SHORE_SPREAD = 0.6;
/** Half-width of the water-share band over which a shore blends from land to water. */
const SHORE_BAND = 0.06;
/** Coherent displacement of the water share, so shorelines wander rather than run straight. */
const SHORE_NOISE = 0.16;
/** Distinct points remembered by `weightsAt`. */
const WEIGHTS_MEMO_SIZE = 4;

function smoothstep(value: number, edge0: number, edge1: number): number {
  return smooth(Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0))));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

function hashString(value: string): number {
  let hash = 2166136261 >>> 0;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function hashUint(seed: number, x: number, z: number): number {
  let hash = seed >>> 0;
  hash ^= Math.imul(x | 0, 0x9e3779b1);
  hash ^= Math.imul(z | 0, 0x85ebca6b);
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x7feb352d);
  hash ^= hash >>> 15;
  hash = Math.imul(hash, 0x846ca68b);
  return (hash ^ (hash >>> 16)) >>> 0;
}

function hashUnit(seed: number, x: number, z: number): number {
  return hashUint(seed, x, z) / 0xffffffff;
}

function valueNoise(seed: number, x: number, z: number): number {
  const x0 = Math.floor(x);
  const z0 = Math.floor(z);
  const tx = smooth(x - x0);
  const tz = smooth(z - z0);
  const top = lerp(hashUnit(seed, x0, z0), hashUnit(seed, x0 + 1, z0), tx);
  const bottom = lerp(hashUnit(seed, x0, z0 + 1), hashUnit(seed, x0 + 1, z0 + 1), tx);
  return lerp(top, bottom, tz) * 2 - 1;
}

export function fractalNoise(seed: number, x: number, z: number, octaves = 4): number {
  let amplitude = 0.5;
  let frequency = 1;
  let total = 0;
  let amplitudeTotal = 0;
  for (let octave = 0; octave < octaves; octave += 1) {
    total += valueNoise(seed + octave * 0x6d2b79f5, x * frequency, z * frequency) * amplitude;
    amplitudeTotal += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }
  return total / amplitudeTotal;
}

function seedFor(options: TerrainRegionOptions): number {
  const scenario = options.scenario ?? "";
  const seed = options.seed === undefined ? "0" : String(options.seed);
  return hashString(`${scenario}\u0000${seed}`);
}

function terrainKindNumber(terrain: TerrainType, salt: string): number {
  return hashString(`${salt}:${terrain.toLowerCase()}`) / 0xffffffff;
}

export function isFieldTerrain(terrain: TerrainType): boolean {
  return ["field", "fields", "farmland", "cropland"].includes(terrain.toLowerCase());
}

export function isWaterTerrain(terrain: TerrainType): boolean {
  return ["water", "river", "lake"].includes(terrain.toLowerCase());
}

function terrainBaseHeight(terrain: TerrainType): number {
  const name = terrain.toLowerCase();
  if (name === "water" || name === "river" || name === "lake") return -0.7;
  if (name === "mud" || name === "swamp" || name === "marsh") return -0.42;
  if (name === "dam" || name === "road" || name === "causeway") return 0.1;
  if (name === "plains" || name === "dry" || isFieldTerrain(name)) return 0;
  return lerp(-0.18, 0.22, terrainKindNumber(terrain, "height"));
}

function terrainRoughness(terrain: TerrainType): number {
  const name = terrain.toLowerCase();
  if (name === "water" || name === "river" || name === "lake") return 0.08;
  if (name === "mud" || name === "swamp" || name === "marsh") return 0.44;
  if (name === "dam" || name === "road" || name === "causeway") return 0.24;
  if (name === "plains" || name === "dry" || isFieldTerrain(name)) return 0.67;
  return lerp(0.2, 0.84, terrainKindNumber(terrain, "roughness"));
}

function terrainWetness(terrain: TerrainType): number {
  const name = terrain.toLowerCase();
  if (name === "water" || name === "river" || name === "lake") return 1;
  if (name === "mud" || name === "swamp" || name === "marsh") return 0.9;
  if (name === "dam" || name === "road" || name === "causeway") return 0.28;
  if (name === "plains" || name === "dry" || isFieldTerrain(name)) return 0.16;
  return lerp(0.08, 0.82, terrainKindNumber(terrain, "wetness"));
}

function validateOptions(options: TerrainRegionOptions): void {
  if (!Number.isInteger(options.cols) || options.cols < 1) throw new RangeError("cols must be a positive integer");
  if (!Number.isInteger(options.rows) || options.rows < 1) throw new RangeError("rows must be a positive integer");
  if (!Number.isFinite(options.hexRadius ?? DEFAULT_RADIUS) || (options.hexRadius ?? DEFAULT_RADIUS) <= 0) {
    throw new RangeError("hexRadius must be positive");
  }
  const coreCoverage = options.coreCoverage ?? DEFAULT_CORE_COVERAGE;
  if (!Number.isFinite(coreCoverage) || coreCoverage < 0.75 || coreCoverage >= 1) {
    throw new RangeError("coreCoverage must be in [0.75, 1)");
  }
  if (!Number.isFinite(options.boundaryNoise ?? DEFAULT_BOUNDARY_NOISE) || (options.boundaryNoise ?? DEFAULT_BOUNDARY_NOISE) < 0) {
    throw new RangeError("boundaryNoise must be non-negative");
  }
  if (!Number.isFinite(options.sampleStep ?? DEFAULT_SAMPLE_STEP) || (options.sampleStep ?? DEFAULT_SAMPLE_STEP) <= 0) {
    throw new RangeError("sampleStep must be positive");
  }
  if (options.origin && (!Number.isFinite(options.origin.x) || !Number.isFinite(options.origin.z))) {
    throw new RangeError("origin must contain finite x and z values");
  }
  for (const tile of options.tiles) {
    if (!Number.isInteger(tile.col) || !Number.isInteger(tile.row)) throw new RangeError("tile coordinates must be integers");
    if (tile.col < 0 || tile.col >= options.cols || tile.row < 0 || tile.row >= options.rows) {
      throw new RangeError(`tile ${tile.col},${tile.row} is outside the map`);
    }
    if (typeof tile.terrain !== "string" || tile.terrain.length === 0) throw new RangeError("tile terrain must be a non-empty string");
  }
}

/**
 * Continuous terrain field for a discrete odd-q map.
 *
 * The public methods are deliberately independent of Three.js so the same
 * field can drive meshes, decorations, collision hints, and tests.
 */
export class TerrainRegions {
  public readonly cols: number;
  public readonly rows: number;
  public readonly hexRadius: number;
  public readonly apothem: number;
  public readonly coreCoverage: number;
  public readonly boundaryNoise: number;
  public readonly sampleStep: number;
  public readonly seed: number;
  public readonly terrainTypes: readonly TerrainType[];
  public readonly tiles: readonly TerrainCell[];
  public readonly roads: RoadCorridors;

  /** Cells indexed col * rows + row: the hottest lookup of terrain generation. */
  private readonly cellGrid: TerrainCell[] = [];
  /** Recent `weightsAt` results; one vertex asks for the same point's weights several times. */
  private readonly weightsMemo: Array<{ x: number; z: number; weights: TerrainWeights }> = [];
  private readonly waterInfluenceMemo = { x: NaN, z: NaN, value: 0 };
  private readonly coverageCache = new Map<number, TerrainCoverage>();
  private readonly origin: TerrainPoint;
  private readonly coreInset: number;

  public constructor(options: TerrainRegionOptions) {
    validateOptions(options);
    this.cols = options.cols;
    this.rows = options.rows;
    this.hexRadius = options.hexRadius ?? DEFAULT_RADIUS;
    this.apothem = ROOT3 * this.hexRadius * 0.5;
    this.coreCoverage = options.coreCoverage ?? DEFAULT_CORE_COVERAGE;
    this.boundaryNoise = options.boundaryNoise ?? DEFAULT_BOUNDARY_NOISE;
    this.sampleStep = options.sampleStep ?? DEFAULT_SAMPLE_STEP;
    this.seed = seedFor(options);

    const maximumZ = this.apothem * 2 * ((this.rows - 1) + (this.cols > 1 ? 0.5 : 0));
    const defaultOrigin = {
      x: -1.5 * this.hexRadius * (this.cols - 1) * 0.5,
      z: -maximumZ * 0.5,
    };
    this.origin = options.origin ? { ...options.origin } : defaultOrigin;

    const firstTerrain = options.tiles[0]?.terrain ?? options.defaultTerrain ?? "plains";
    const terrainByKey = new Map<string, TerrainType>();
    for (const tile of options.tiles) terrainByKey.set(this.key(tile.col, tile.row), tile.terrain);
    const allTiles: TerrainCell[] = [];
    for (let col = 0; col < this.cols; col += 1) {
      for (let row = 0; row < this.rows; row += 1) {
        const terrain = terrainByKey.get(this.key(col, row)) ?? options.defaultTerrain ?? firstTerrain;
        const cell = { col, row, terrain, center: this.centerAt(col, row) };
        this.cellGrid[col * this.rows + row] = cell;
        allTiles.push(cell);
      }
    }
    this.tiles = allTiles;
    this.terrainTypes = [...new Set(allTiles.map((tile) => tile.terrain))];
    this.roads = new RoadCorridors(this.tiles, new HexLayout(this.cols,this.rows,this.hexRadius), this.seed);
    // Insetting every edge by this amount leaves a geometrically similar core
    // with area = coreCoverage * hex area, before discrete sample rounding.
    this.coreInset = this.apothem * (1 - Math.sqrt(this.coreCoverage));
  }

  public key(col: number, row: number): string {
    return `${col},${row}`;
  }

  public centerAt(col: number, row: number): TerrainPoint {
    return {
      x: this.origin.x + 1.5 * this.hexRadius * col,
      z: this.origin.z + this.apothem * 2 * (row + 0.5 * (col & 1)),
    };
  }

  public getCell(col: number, row: number): TerrainCell | null {
    if (!Number.isInteger(col) || !Number.isInteger(row) || col < 0 || col >= this.cols || row < 0 || row >= this.rows) return null;
    return this.cellGrid[col * this.rows + row] ?? null;
  }

  public pointInsideHex(x: number, z: number, col: number, row: number): boolean {
    const center = this.centerAt(col, row);
    return this.signedHexEdgeDistance(x - center.x, z - center.z) >= -EPSILON;
  }

  /** The minimum inward distance to a side of a containing flat-top hex. */
  public hexEdgeDistance(x: number, z: number, col: number, row: number): number {
    const center = this.centerAt(col, row);
    return this.signedHexEdgeDistance(x - center.x, z - center.z);
  }

  public cellAt(x: number, z: number): TerrainCell | null {
    const estimatedCol = Math.round((x - this.origin.x) / (1.5 * this.hexRadius));
    let best: TerrainCell | null = null;
    let bestDistance = Infinity;
    for (let col = Math.max(0, estimatedCol - 2); col <= Math.min(this.cols - 1, estimatedCol + 2); col += 1) {
      const estimatedRow = Math.round((z - this.centerAt(col, 0).z) / (this.apothem * 2));
      for (let row = Math.max(0, estimatedRow - 2); row <= Math.min(this.rows - 1, estimatedRow + 2); row += 1) {
        const tile = this.getCell(col, row);
        if (!tile || !this.pointInsideHex(x, z, col, row)) continue;
        const distance = Math.hypot(x - tile.center.x, z - tile.center.z);
        if (distance < bestDistance - EPSILON || (Math.abs(distance - bestDistance) <= EPSILON && (col < (best?.col ?? Infinity) || (col === best?.col && row < (best?.row ?? Infinity))))) {
          best = tile;
          bestDistance = distance;
        }
      }
    }
    return best;
  }

  /** Returns weights that sum to one. Outside the map it returns an empty object. The result is frozen and may be shared. */
  public weightsAt(x: number, z: number): TerrainWeights {
    for (const entry of this.weightsMemo) if (entry.x === x && entry.z === z) return entry.weights;
    const weights = Object.freeze(this.computeWeightsAt(x, z));
    this.weightsMemo.unshift({ x, z, weights });
    if (this.weightsMemo.length > WEIGHTS_MEMO_SIZE) this.weightsMemo.pop();
    return weights;
  }

  private computeWeightsAt(x: number, z: number): TerrainWeights {
    const cell = this.cellAt(x, z);
    if (!cell) return {};
    if (!this.roads.active) return this.baseWeightsAt(x,z,cell);
    const road=this.roads.sample(x,z);
    if(road && road.weight>=1-1e-9) return {[road.terrain]:1};
    const base=this.baseWeightsAt(x,z,cell);
    const ground:Record<string,number>={};
    let total=0;
    for(const [terrain,weight] of Object.entries(base)) if(!isRoadTerrain(terrain)) {
      ground[terrain]=weight;total+=weight;
    }
    if(total<1e-9) {
      // Outside a swept road, reveal the neighbouring landscape rather than
      // restoring a brown patch shaped like the source road hex.
      for(const neighbour of this.nearbyCells(x,z)) if(!isRoadTerrain(neighbour.terrain)) {
        const d=Math.hypot(x-neighbour.center.x,z-neighbour.center.z)/this.hexRadius;
        const weight=Math.exp(-d*d/1.5);
        ground[neighbour.terrain]=(ground[neighbour.terrain]??0)+weight;total+=weight;
      }
    }
    if(total<1e-9) { ground[this.terrainTypes.find(name=>!isRoadTerrain(name))!]=1;total=1; }
    const coverage=road?.weight??0;
    for(const name of Object.keys(ground)) ground[name]=ground[name]!/total*(1-coverage);
    if(road && coverage>0) ground[road.terrain]=coverage;
    return ground;
  }

  private baseWeightsAt(x:number,z:number,cell:TerrainCell):TerrainWeights {
    const candidates = this.nearbyCells(x, z);
    return candidates.some(candidate => isWaterTerrain(candidate.terrain))
      ? this.shoreWeightsAt(x, z, cell, candidates)
      : this.inlandWeightsAt(x, z, cell, candidates);
  }

  /** Dry-land blending: seeded noisy boundaries that ease into each protected cell core. */
  private inlandWeightsAt(x:number,z:number,cell:TerrainCell,candidates:readonly TerrainCell[]):TerrainWeights {
    const edgeDistance = this.hexEdgeDistance(x, z, cell.col, cell.row);
    if (edgeDistance >= this.coreInset - EPSILON) return { [cell.terrain]: 1 };
    const scores = new Map<TerrainType, number>();
    const temperature = 0.13;
    let maximum = -Infinity;
    for (const candidate of candidates) {
      const distance = Math.hypot(x - candidate.center.x, z - candidate.center.z) / this.hexRadius;
      if (distance > 2.3) continue;
      const localSeed = hashUint(this.seed, candidate.col + 101, candidate.row + 503);
      const offsetX = (localSeed & 255) * 0.037;
      const offsetZ = ((localSeed >>> 8) & 255) * 0.041;
      const noise = fractalNoise(localSeed, x / (this.hexRadius * 5.6) + offsetX, z / (this.hexRadius * 5.1) + offsetZ, 3);
      // Scores are normalized by radius, making the same API useful for
      // miniature and large maps. A shared terrain type is aggregated below,
      // so same-type neighbours never create a visible internal boundary.
      const score = -(distance * distance) + this.boundaryNoise * noise;
      scores.set(candidate.terrain, Math.max(scores.get(candidate.terrain) ?? -Infinity, score));
      maximum = Math.max(maximum, score);
    }
    if (scores.size === 0) return { [cell.terrain]: 1 };

    const weights: Record<string, number> = {};
    let total = 0;
    for (const [terrain, score] of scores) {
      const weight = Math.exp((score - maximum) / temperature);
      weights[terrain] = weight;
      total += weight;
    }
    for (const terrain of Object.keys(weights)) weights[terrain] = weights[terrain]! / total;
    // Ease into the protected cell interior. An abrupt switch to weight 1 at
    // coreInset made mud banks jump in height, producing tall triangular teeth.
    const coreBlend = smooth(Math.max(0, Math.min(1, edgeDistance / this.coreInset)));
    const current=weights[cell.terrain] ?? 0;
    const next=current+(1-current)*coreBlend;
    for (const terrain of Object.keys(weights)) weights[terrain]! *= current<1 ? (1-next)/(1-current) : 1;
    weights[cell.terrain] = next;
    return weights;
  }

  /**
   * Near water the shoreline is the half-way contour of a smooth, distance-
   * weighted share of water among the surrounding cell centres, displaced by
   * coherent noise. Water centres stay water and land centres stay land, but
   * the outline no longer follows hex edges: a single pond is round and a
   * chain of water hexes is one channel. The dry side keeps inland blending.
   */
  private shoreWeightsAt(x:number,z:number,cell:TerrainCell,candidates:readonly TerrainCell[]):TerrainWeights {
    let wet = 0, total = 0, nearestWater: TerrainCell | null = null, nearestDry: TerrainCell | null = null;
    let waterDistance = Infinity, dryDistance = Infinity;
    for (const candidate of candidates) {
      const distance = Math.hypot(x - candidate.center.x, z - candidate.center.z) / this.hexRadius;
      const water = isWaterTerrain(candidate.terrain);
      if (water && distance < waterDistance) { waterDistance = distance; nearestWater = candidate; }
      if (!water && distance < dryDistance) { dryDistance = distance; nearestDry = candidate; }
      if (distance > 2.3) continue;
      const weight = Math.exp(-distance * distance / SHORE_SPREAD);
      total += weight;
      if (water) wet += weight;
    }
    const noise = fractalNoise(this.seed, x / (this.hexRadius * 3.6), z / (this.hexRadius * 2.8), 3) * SHORE_NOISE
      + fractalNoise(this.seed ^ 0x3c6ef372, x / (this.hexRadius * .9), z / (this.hexRadius * .9), 2) * SHORE_NOISE * .35;
    const share = total > 0 ? wet / total : 0;
    const water = smoothstep(share + noise, .5 - SHORE_BAND, .5 + SHORE_BAND);
    const dryCandidates = candidates.filter(candidate => !isWaterTerrain(candidate.terrain));
    const dry = !nearestDry ? {} : this.inlandWeightsAt(x, z, isWaterTerrain(cell.terrain) ? nearestDry : cell, dryCandidates);
    const weights: Record<string, number> = {};
    for (const [terrain, weight] of Object.entries(dry)) weights[terrain] = weight * (1 - water);
    if (nearestWater && water > 0) weights[nearestWater.terrain] = (weights[nearestWater.terrain] ?? 0) + (nearestDry ? water : 1);
    if (!nearestDry && nearestWater) return { [nearestWater.terrain]: 1 };
    return weights;
  }

  /** Broad bank influence, independent of protected material cores. */
  public waterInfluenceAt(x: number, z: number): number {
    if (!this.terrainTypes.some(isWaterTerrain)) return 0;
    const memo = this.waterInfluenceMemo;
    if (memo.x === x && memo.z === z) return memo.value;
    let wet = 0, total = 0;
    for (const cell of this.nearbyCells(x, z)) {
      const distance = Math.hypot(x-cell.center.x, z-cell.center.z)/this.hexRadius;
      if (distance > 2.3) continue;
      const weight = Math.exp(-distance*distance/.65);
      total += weight;
      if (isWaterTerrain(cell.terrain)) wet += weight;
    }
    memo.x = x; memo.z = z; memo.value = total > 0 ? wet/total : 0;
    return memo.value;
  }

  public classify(x: number, z: number): TerrainType | null {
    const weights = this.weightsAt(x, z);
    if (Object.keys(weights).length === 0) return null;
    let result: TerrainType | null = null;
    let maximum = -Infinity;
    for (const terrain of this.terrainTypes) {
      const weight = weights[terrain] ?? 0;
      if (weight > maximum) {
        result = terrain;
        maximum = weight;
      }
    }
    return result;
  }

  public classifyTerrain(x: number, z: number): TerrainType | null {
    return this.classify(x, z);
  }

  public terrainAt(x: number, z: number): TerrainType | null {
    return this.classify(x, z);
  }

  public heightInputAt(x: number, z: number): TerrainHeightInput {
    const weights = this.weightsAt(x, z);
    let base = 0;
    let roughness = 0;
    let wetness = 0;
    for (const [terrain, weight] of Object.entries(weights)) {
      base += terrainBaseHeight(terrain) * weight;
      roughness += terrainRoughness(terrain) * weight;
      wetness += terrainWetness(terrain) * weight;
    }
    if (Object.keys(weights).length === 0) return { base: 0, variation: 0, height: 0, roughness: 0, wetness: 0 };

    const broad = fractalNoise(this.seed ^ 0x27d4eb2d, x / 28, z / 27, 4);
    const detail = fractalNoise(this.seed ^ 0x165667b1, x / 7.5, z / 8.5, 3);
    const variation = broad * (0.5 + roughness * 0.45) + detail * roughness * 0.12;
    return { base, variation, height: base + variation, roughness, wetness };
  }

  public heightAt(x: number, z: number): number {
    return this.heightInputAt(x, z).height;
  }

  public measureCoverage(sampleStep = this.sampleStep): TerrainCoverage {
    if (!Number.isFinite(sampleStep) || sampleStep <= 0) throw new RangeError("sampleStep must be positive");
    const cached = this.coverageCache.get(sampleStep);
    if (cached) return cached;
    const cells: TerrainCoverageCell[] = [];
    let minimum = 1;
    for (const cell of this.tiles) {
      const minX = cell.center.x - this.hexRadius;
      const maxX = cell.center.x + this.hexRadius;
      const minZ = cell.center.z - this.apothem;
      const maxZ = cell.center.z + this.apothem;
      let samples = 0;
      let matching = 0;
      for (let x = minX + sampleStep * 0.5; x < maxX; x += sampleStep) {
        for (let z = minZ + sampleStep * 0.5; z < maxZ; z += sampleStep) {
          if (!this.pointInsideHex(x, z, cell.col, cell.row)) continue;
          samples += 1;
          if (this.classify(x, z) === cell.terrain) matching += 1;
        }
      }
      const coverage = samples === 0 ? 0 : matching / samples;
      minimum = Math.min(minimum, coverage);
      cells.push({ col: cell.col, row: cell.row, terrain: cell.terrain, samples, matching, coverage });
    }
    const result = { minimum, sampleStep, cells };
    this.coverageCache.set(sampleStep, result);
    return result;
  }

  public coverageForCell(col: number, row: number, sampleStep = this.sampleStep): number {
    const coverage = this.measureCoverage(sampleStep).cells.find((cell) => cell.col === col && cell.row === row);
    if (!coverage) throw new RangeError(`cell ${col},${row} is outside the map`);
    return coverage.coverage;
  }

  private signedHexEdgeDistance(dx: number, dz: number): number {
    const absoluteX = Math.abs(dx);
    const absoluteZ = Math.abs(dz);
    return Math.min(
      this.hexRadius - absoluteX,
      this.apothem - absoluteZ,
      (ROOT3 * this.hexRadius - ROOT3 * absoluteX - absoluteZ) * 0.5,
    );
  }

  private nearbyCells(x: number, z: number): TerrainCell[] {
    const estimatedCol = Math.round((x - this.origin.x) / (1.5 * this.hexRadius));
    const result: TerrainCell[] = [];
    for (let col = Math.max(0, estimatedCol - 2); col <= Math.min(this.cols - 1, estimatedCol + 2); col += 1) {
      const estimatedRow = Math.round((z - this.centerAt(col, 0).z) / (this.apothem * 2));
      for (let row = Math.max(0, estimatedRow - 2); row <= Math.min(this.rows - 1, estimatedRow + 2); row += 1) {
        const cell = this.getCell(col, row);
        if (cell) result.push(cell);
      }
    }
    return result;
  }
}

export function createTerrainRegions(options: TerrainRegionOptions): TerrainRegions {
  return new TerrainRegions(options);
}

/** Alias kept short for renderer call sites. */
export const createTerrainField = createTerrainRegions;

export function classifyTerrain(field: TerrainRegions, x: number, z: number): TerrainType | null {
  return field.classify(x, z);
}

export function terrainWeights(field: TerrainRegions, x: number, z: number): TerrainWeights {
  return field.weightsAt(x, z);
}

export function terrainHeightInput(field: TerrainRegions, x: number, z: number): TerrainHeightInput {
  return field.heightInputAt(x, z);
}

export function measureTerrainCoverage(fieldOrOptions: TerrainRegions | TerrainRegionOptions, sampleStep?: number): TerrainCoverage {
  const field = fieldOrOptions instanceof TerrainRegions ? fieldOrOptions : createTerrainRegions(fieldOrOptions);
  return field.measureCoverage(sampleStep);
}
