import * as THREE from "three";
import { createGeneratedSurfaceMaterials, createPuddleMaterial, createWoodMaterial, GROUND_SPLAT, RIM_TOP, RIM_WATER, SHORE_DISTANCE, groundSplatChannel, surfaceMaterialIndex, surfaceMaterialKind } from "./generated-materials.ts";
import { HexLayout } from "./hex-coordinates.ts";
import { createTerrainRegions, fractalNoise, isFieldTerrain, isWaterTerrain, type TerrainRegions, type TerrainCell, type TerrainWeights } from "./terrain-regions.ts";
import { TopographyPlan } from "./topography.ts";
import type { BattleSnapshot, BattleTerrain } from "./types.ts";
import { bridgeRelief, earthworkRelief, planEnvironment, type EnvironmentPlan } from "./environment-plan.ts";
import type { TownWallPlan } from "./town-wall-plan.ts";
import { BRIDGE_DECK_LIFT, bridgeDeckAt, type BridgeDeck } from "./fortification-plan.ts";
import { isRoadTerrain } from "./road-corridors.ts";
import { nearestOnStreet } from "./settlement-plan.ts";
import { clipPolygon, triangulatePolygon } from "./water-geometry.ts";
import { pointInPolygon } from "./geometry-utils.ts";

/** Cool grey the remembered (explored, not visible) terrain is pulled toward. */
const MEMORY_TINT = new THREE.Color(0.62, 0.66, 0.72);

const COLORS: Record<string, number> = {
  plains: 0xdfe6b3, forest: 0xb3c68f, hills: 0xcfce98, water: 0x78aaa4,
  town: 0xd1b99d, road: 0xd9c7a0, road2: 0xc7b28f, dam: 0xdacaa2,
  mud: 0xd9b891, swamp: 0xb3bd8a, slope: 0xc3b59b, trenches: 0xa88972,
  church: 0xcab79e, field: 0xddc47d, fields: 0xddc47d, farmland: 0xddc47d, cropland: 0xddc47d,
};
const FROST_COLOR = new THREE.Color(0xe2e5dc);
const WETLAND = new Set(["mud", "swamp", "marsh"]);
/** Deepest puddle hollow in metres; the water sheet sits PUDDLE_FILL below the undipped ground. */
export const PUDDLE_DEPTH = .24;
const PUDDLE_FILL = .07;
/** Grassland drifts between cured straw and cooler sage, like late-summer pasture. */
const STRAW_TINT = new THREE.Color(0xffe3a2);
const SAGE_TINT = new THREE.Color(0xd3deae);
const GRASS_SCRATCH = new THREE.Color();
const GRASSLAND = new Set(["plains", "hills", "hill", "ridge", "highland", "slope", "steep_slope", "forest"]);

export class GeneratedTerrain implements BattleTerrain {
  public readonly group = new THREE.Group();
  public readonly interactiveMeshes: THREE.Object3D[] = [];
  public readonly field: TerrainRegions;
  public readonly layout: HexLayout;
  public readonly bounds;
  public readonly topography: TopographyPlan;
  /** Explored-but-unseen hexes are shaded in the vertex colours; overlays need not tint them. */
  public readonly shadesRememberedHexes = true;
  public readonly environmentPlan: EnvironmentPlan;
  /** Tvrz gate bridges with their deck heights; figures and overlays stand on the deck, not in the ditch below. */
  public moatBridges: BridgeDeck[] = [];
  private bridgeBaseHeight = 0;
  private readonly cityLoops: Array<{points:Array<[number,number]>;minX:number;maxX:number;minZ:number;maxZ:number}>;
  /** Wall loops around a fortified manor: everything inside is its packed-earth courtyard. */
  private readonly yardLoops: Array<{points:Array<[number,number]>;minX:number;maxX:number;minZ:number;maxZ:number}>;
  private readonly cityCells: readonly TerrainCell[];
  private surfaceMesh!: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial[]>;
  private soilMaterial!: THREE.Material;
  private readonly surfaceTextures: THREE.Texture[] = [];
  private basePositions!: Float32Array;
  private baseColors!: Float32Array;
  private vertexKeys: Array<string | null> = [];
  private visibilityKey = "";
  private gridWidth = 0;
  private gridHeight = 0;
  private readonly visualWeights = new Map<string, number[]>();
  /** Grid triangles split at a shore or road contour, keyed by `triangleKey` of their corners. */
  private readonly surfaceTriangles = new Map<number, number[][]>();
  private waterIndices: number[] = [];
  private readonly waterCellIndices = new Map<string, number[]>();

  public get terrainTypes(): readonly string[] { return this.field.terrainTypes; }

  public constructor(snapshot: BattleSnapshot, assetBase?: string) {
    const cols = snapshot.cols ?? Math.max(...snapshot.tiles.map(tile => tile.col)) + 1;
    const rows = snapshot.rows ?? Math.max(...snapshot.tiles.map(tile => tile.row)) + 1;
    this.layout = new HexLayout(cols, rows);
    this.field = createTerrainRegions({ cols, rows, tiles: snapshot.tiles, scenario: snapshot.scenario ?? "battle",
      seed: snapshot.seed ?? 1, hexRadius: this.layout.radius, coreCoverage: 0.76, boundaryNoise: 0.75 });
    this.environmentPlan = planEnvironment(snapshot.scenario, this.field.tiles, snapshot.features);
    const loopsOf=(walls:readonly TownWallPlan[])=>walls.flatMap(wall=>wall.loops.map(loop=>({
      points:loop.points.map(p=>[p.x,p.z] as [number,number]),minX:Math.min(...loop.points.map(p=>p.x)),maxX:Math.max(...loop.points.map(p=>p.x)),
      minZ:Math.min(...loop.points.map(p=>p.z)),maxZ:Math.max(...loop.points.map(p=>p.z)),
    })));
    this.cityLoops=loopsOf(this.environmentPlan.walls);
    this.yardLoops=loopsOf(this.environmentPlan.walls.filter(wall=>this.environmentPlan.fortifications.has(wall.id)));
    const enclosed=new Set(this.environmentPlan.walls.flatMap(wall=>wall.enclosedCells));
    this.cityCells=this.field.tiles.filter(cell=>enclosed.has(`${cell.col},${cell.row}`)&&["town","church"].includes(cell.terrain));
    for (const issue of this.environmentPlan.settlement?.issues ?? []) console.warn(`[Hussite 3D] ${issue}`);
    this.topography = new TopographyPlan(this.field,this.environmentPlan.raisedCells);
    if(this.environmentPlan.bridge) {
      const {x,z}=this.environmentPlan.bridge;
      this.bridgeBaseHeight=this.topography.elevationAt(x,z)+this.field.heightInputAt(x,z).variation*.24;
    }
    this.bounds = this.layout.bounds();
    this.group.name = `Generated ${snapshot.scenario ?? "battle"} landscape`;
    this.createSurface(assetBase);
    this.createPlinth();
    this.createPuddles();
    this.moatBridges = this.environmentPlan.gateBridges.map(bridge => {
      // Level with the highest ground across each end, so no plank end is buried.
      const end = (along: number): number => Math.max(...[-1, -.5, 0, .5, 1].map(share => {
        const across = share * bridge.halfWidth;
        return this.renderedHeightAt(bridge.x + bridge.dx * along - bridge.dz * across, bridge.z + bridge.dz * along + bridge.dx * across);
      })) + BRIDGE_DECK_LIFT;
      return { ...bridge, y0: end(bridge.from), y1: end(bridge.to) };
    });
  }

  /**
   * Standing water in the wetland hollows. The sheet reuses the rendered
   * terrain's own grid vertices and diagonals, raised by each vertex's dip
   * less PUDDLE_FILL, so the waterline is the exact crossing of two surfaces
   * sharing one triangulation: a smooth contour around each hollow.
   */
  private createPuddles(): void {
    const wetCells = this.field.tiles.filter(cell => WETLAND.has(cell.terrain.toLowerCase())
      && !this.environmentPlan.replacedCells.has(`${cell.col},${cell.row}`));
    if (!wetCells.length) return;
    const nx = this.gridWidth, nz = this.gridHeight, reach = this.layout.radius + 1.5;
    const near = (x: number, z: number): boolean => wetCells.some(cell =>
      Math.abs(x - cell.center.x) < reach && Math.abs(z - cell.center.z) < reach);
    const dips = new Float32Array(nx * nz);
    for (let index = 0; index < nx * nz; index += 1) {
      const x = this.basePositions[index * 3]!, z = this.basePositions[index * 3 + 2]!;
      dips[index] = near(x, z) ? this.puddleDip(x, z) : 0;
    }
    const positions: number[] = [];
    const push = (index: number): void => {
      positions.push(this.basePositions[index * 3]!, this.basePositions[index * 3 + 1]! + dips[index]! - PUDDLE_FILL,
        this.basePositions[index * 3 + 2]!);
    };
    for (let iz = 0; iz < nz - 1; iz += 1) for (let ix = 0; ix < nx - 1; ix += 1) {
      const a = iz * nx + ix, b = a + 1, c = a + nx, d = c + 1;
      // Only quads where some corner rises above the ground can show water.
      if (Math.max(dips[a]!, dips[b]!, dips[c]!, dips[d]!) <= PUDDLE_FILL) continue;
      const triangles = (ix + iz) % 2 === 0 ? [a, c, b, b, c, d] : [a, c, d, a, d, b];
      triangles.forEach(push);
    }
    if (!positions.length) return;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(geometry, createPuddleMaterial(this.environmentPlan.winter));
    mesh.name = "Wetland puddles";
    mesh.receiveShadow = true;
    mesh.renderOrder = 2;
    this.group.add(mesh);
  }

  public heightAt(x: number, z: number): number {
    const input = this.field.heightInputAt(x, z);
    const terrain = this.field.classify(x, z);
    let elevation = this.topography.elevationAt(x, z);
    const relief = earthworkRelief(x, z, this.environmentPlan.earthworks);
    const originalWeights = this.field.weightsAt(x, z);
    const insideCity=this.insideCity(x,z);
    const weights = this.surfaceWeightsAt(x,z,originalWeights,insideCity);
    if(insideCity && Object.entries(originalWeights).some(([name,weight])=>isWaterTerrain(name)&&weight>0)) {
      let closest:TerrainCell|undefined,minimum=Infinity;
      for(const cell of this.cityCells) {
        const d=(x-cell.center.x)**2+(z-cell.center.z)**2;
        if(d<minimum) {minimum=d;closest=cell;}
      }
      if(closest) elevation=this.topography.cellElevation(closest.col,closest.row);
    }
    const waterWeight = Object.entries(weights).reduce((total, [name, weight]) =>
      total + (["water", "river", "lake"].includes(name.toLowerCase()) ? weight : 0), 0);
    const dryWeight = Math.max(0, ...Object.entries(weights).filter(([name])=>!isWaterTerrain(name)).map(([,weight])=>weight));
    if (waterWeight > 0 && waterWeight >= dryWeight) return -.7;
    const crossing = terrain === "road" || terrain === "road2" || terrain === "dam";
    const variation = crossing ? .24 : (0.42 + input.roughness * 0.34) * (1 - input.wetness * 0.45);
    const bank = THREE.MathUtils.smoothstep(Math.max(waterWeight, crossing||insideCity ? 0 : this.field.waterInfluenceAt(x,z)), 0, .5);
    const ground=THREE.MathUtils.lerp(elevation + input.variation * variation, -.7, bank) + relief
      - (insideCity ? 0 : this.puddleDip(x, z, weights));
    const bridge=this.environmentPlan.bridge;
    if(!bridge) return ground;
    const across=Math.abs(x-bridge.x), along=Math.abs(z-bridge.z);
    const blend=(1-THREE.MathUtils.smoothstep(across,1.35,2.4))*(1-THREE.MathUtils.smoothstep(along,7,10));
    // The rigid deck and both approach models share one vertical datum. Ease
    // the surrounding bank into that profile instead of adding terrain noise
    // independently beneath each end of the bridge.
    const deck=this.bridgeBaseHeight+bridgeRelief(bridge.x,z,bridge);
    return THREE.MathUtils.lerp(ground,deck,blend);
  }

  /**
   * Shallow hollows in mud and swamp where standing water collects. The dip is
   * visual only and never deeper than PUDDLE_DEPTH, so units stay ankle-deep.
   */
  public puddleDip(x: number, z: number, weights: TerrainWeights = this.field.weightsAt(x, z)): number {
    let wet = 0;
    for (const [terrain, weight] of Object.entries(weights)) if (WETLAND.has(terrain.toLowerCase())) wet += weight;
    if (wet <= 0) return 0;
    // Earthwork banks and ditches are too steep to hold water; hollows ease out toward them.
    const relief = Math.abs(earthworkRelief(x, z, this.environmentPlan.earthworks));
    if (relief >= .06) return 0;
    const hollow = THREE.MathUtils.smoothstep(fractalNoise(this.field.seed ^ 0x5be0cd19, x / 2.3, z / 2.3, 2), .24, .55);
    return PUDDLE_DEPTH * hollow * THREE.MathUtils.smoothstep(wet, .35, .85) * (1 - relief / .06);
  }

  private insideCity(x:number,z:number):boolean {
    return this.cityLoops.some(loop=>x>=loop.minX&&x<=loop.maxX&&z>=loop.minZ&&z<=loop.maxZ&&pointInPolygon(x,z,loop.points));
  }

  private surfaceWeightsAt(x:number,z:number,source:TerrainWeights=this.field.weightsAt(x,z),inside=this.insideCity(x,z)):TerrainWeights {
    if(!inside) return source;
    if(this.yardLoops.some(loop=>x>=loop.minX&&x<=loop.maxX&&z>=loop.minZ&&z<=loop.maxZ&&pointInPolygon(x,z,loop.points))) return {town:1};
    const weights:Record<string,number>={...source};let water=0;
    for(const name of Object.keys(weights)) if(isWaterTerrain(name)) {water+=weights[name]!;weights[name]=0;}
    if(water>0) weights.town=(weights.town??0)+water;
    return weights;
  }

  /** Anisotropic filtering of the ground textures, set by the graphics quality tier. */
  public setAnisotropy(level: number): void {
    for (const texture of this.surfaceTextures) {
      if (texture.anisotropy === level) continue;
      texture.anisotropy = level;
      texture.needsUpdate = true;
    }
  }

  public updateVisibility(snapshot: BattleSnapshot): void {
    const signature = snapshot.fogOfWar
      ? `fog:${[...snapshot.exploredHexes].sort().join("|")}:${[...snapshot.visibleHexes].sort().join("|")}`
      : "clear";
    if (signature === this.visibilityKey) return;
    this.visibilityKey = signature;
    // Only colours change with fog; positions are static and not re-uploaded.
    const colors = this.surfaceMesh.geometry.getAttribute("color") as THREE.BufferAttribute;
    const explored = new Set(snapshot.exploredHexes);
    const visible = new Set(snapshot.visibleHexes);
    const fog = new THREE.Color(0xa5a58f);
    const shaded = new THREE.Color(), tint = new THREE.Color();
    // Per-hex fog state, looked up once per key rather than per vertex.
    const states = new Map<string | null, 0 | 1 | 2>();
    const stateOf = (key: string | null): 0 | 1 | 2 => {
      let state = states.get(key);
      if (state === undefined) {
        state = !snapshot.fogOfWar ? 0 : !key || !explored.has(key) ? 2 : !visible.has(key) ? 1 : 0;
        states.set(key, state);
      }
      return state;
    };
    for (let index = 0; index < colors.count; index += 1) {
      const offset = index * 3;
      let r = this.baseColors[offset]!, g = this.baseColors[offset + 1]!, b = this.baseColors[offset + 2]!;
      const state = stateOf(this.vertexKeys[index] ?? null);
      if (state === 2) {
        r = fog.r; g = fog.g; b = fog.b;
      } else if (state === 1) {
        // Remembered but unobserved ground: desaturated and dimmed, so it
        // reads as the last known state rather than as live terrain.
        shaded.setRGB(r, g, b);
        const grey = shaded.r * 0.3 + shaded.g * 0.59 + shaded.b * 0.11;
        shaded.lerp(tint.copy(MEMORY_TINT).multiplyScalar(grey * 1.6), 0.72).multiplyScalar(0.74);
        r = shaded.r; g = shaded.g; b = shaded.b;
      }
      colors.setXYZ(index, r, g, b);
    }
    colors.needsUpdate = true;
  }

  private surfaceSampleAt(x: number, z: number): { vertices: [number, number, number]; barycentric: [number, number, number] } | null {
    const { minX, maxX, minZ, maxZ } = this.bounds;
    if (x < minX || x > maxX || z < minZ || z > maxZ) return null;
    const gridX = (x - minX) / (maxX - minX) * (this.gridWidth - 1);
    const gridZ = (z - minZ) / (maxZ - minZ) * (this.gridHeight - 1);
    const ix = Math.min(this.gridWidth - 2, Math.max(0, Math.floor(gridX)));
    const iz = Math.min(this.gridHeight - 2, Math.max(0, Math.floor(gridZ)));
    const tx = gridX - ix, tz = gridZ - iz;
    const a = iz * this.gridWidth + ix, b = a + 1, c = a + this.gridWidth, d = c + 1;
    let vertices: [number, number, number], barycentric: [number, number, number];
    if ((ix + iz) % 2 === 0) {
      if (tx + tz <= 1) { vertices = [a, b, c]; barycentric = [1 - tx - tz, tx, tz]; }
      else { vertices = [d, c, b]; barycentric = [tx + tz - 1, 1 - tx, 1 - tz]; }
    } else if (tz >= tx) {
      vertices = [a, c, d]; barycentric = [1 - tz, tz - tx, tx];
    } else {
      vertices = [a, d, b]; barycentric = [1 - tx, tz, tx - tz];
    }
    const shoreline = this.surfaceTriangles.get(this.triangleKey(vertices[0], vertices[1], vertices[2]));
    if (shoreline) for (const triangle of shoreline) {
      const [a,b,c]=triangle as [number,number,number];
      const ax=this.basePositions[a*3]!,az=this.basePositions[a*3+2]!;
      const bx=this.basePositions[b*3]!,bz=this.basePositions[b*3+2]!;
      const cx=this.basePositions[c*3]!,cz=this.basePositions[c*3+2]!;
      const denominator=(bz-cz)*(ax-cx)+(cx-bx)*(az-cz);
      if(Math.abs(denominator)<1e-10) continue;
      const u=((bz-cz)*(x-cx)+(cx-bx)*(z-cz))/denominator;
      const v=((cz-az)*(x-cx)+(ax-cx)*(z-cz))/denominator;
      if(u>=-1e-6 && v>=-1e-6 && u+v<=1+1e-6) return {vertices:[a,b,c],barycentric:[u,v,1-u-v]};
    }
    return { vertices, barycentric };
  }

  /** Order-independent numeric key of a grid triangle; the grid has about 130k vertices, so it stays below 2^53. */
  private triangleKey(a: number, b: number, c: number): number {
    const size = this.gridWidth * this.gridHeight;
    const low = Math.min(a, b, c), high = Math.max(a, b, c), middle = a + b + c - low - high;
    return (low * size + middle) * size + high;
  }

  /** Actual continuous water mesh, partitioned only for ice state and explored-cell fog. */
  public waterTrianglesForCell(col: number, row: number): readonly number[] {
    const centre=this.layout.center(col,row), apothem=this.layout.radius*Math.sqrt(3)/2;
    const result:number[]=[];
    const indices=this.waterCellIndices.get(`${col},${row}`) ?? [];
    for(let i=0;i<indices.length;i+=3) {
      let polygon=indices.slice(i,i+3).map(index=>Array.from(this.basePositions.slice(index*3,index*3+3)));
      if(polygon.every(p=>p[0]!<centre.x-this.layout.radius) || polygon.every(p=>p[0]!>centre.x+this.layout.radius)
        || polygon.every(p=>p[2]!<centre.z-apothem) || polygon.every(p=>p[2]!>centre.z+apothem)) continue;
      for(let side=0;side<6 && polygon.length;side++) {
        const angle=(side+.5)*Math.PI/3;
        polygon=clipPolygon(polygon,p=>(p[0]!-centre.x)*Math.cos(angle)+(p[2]!-centre.z)*Math.sin(angle)-apothem);
      }
      result.push(...triangulatePolygon(polygon));
    }
    return result;
  }

  /** Project overlays onto the actual triangles rather than the unsampled height function. */
  public renderedHeightAt(x: number, z: number): number {
    const sample = this.surfaceSampleAt(x, z);
    const ground = !sample ? this.heightAt(x, z) : sample.vertices.reduce((height, vertex, index) =>
      height + this.basePositions[vertex * 3 + 1]! * sample.barycentric[index]!, 0);
    for (const bridge of this.moatBridges) {
      const deck = bridgeDeckAt(bridge, x, z);
      if (deck !== null) return Math.max(ground, deck);
    }
    return ground;
  }

  /** Dominant terrain after the same vertex interpolation used by the rendered mesh. */
  public renderedTerrainAt(x: number, z: number): string | null {
    const sample = this.surfaceSampleAt(x, z);
    if (!sample) return null;
    const { vertices, barycentric } = sample;
    let result: string | null = null, maximum = -Infinity;
    let waterWeight=0, waterName: string | null=null, largestWater=0;
    for (const terrain of this.field.terrainTypes) {
      const weights = this.visualWeights.get(terrain)!;
      const weight = weights[vertices[0]]! * barycentric[0]
        + weights[vertices[1]]! * barycentric[1]
        + weights[vertices[2]]! * barycentric[2];
      if(isWaterTerrain(terrain)) {
        waterWeight+=weight;
        if(weight>largestWater) {largestWater=weight;waterName=terrain;}
        continue;
      }
      if (weight > maximum) { maximum = weight; result = terrain; }
    }
    return waterName && waterWeight>=maximum ? waterName : result;
  }

  public dispose(): void {
    this.group.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) material.dispose();
    });
    this.group.clear();
    this.interactiveMeshes.length = 0;
    this.vertexKeys.length = 0;
    this.visualWeights.clear();
    this.surfaceTriangles.clear();
    this.waterIndices.length=0;
    this.waterCellIndices.clear();
    for (const texture of this.surfaceTextures) texture.dispose();
    this.surfaceTextures.length = 0;
  }

  /**
   * Broad straw and sage patches, drier on crests and greener in hollows.
   * Presentation only: the tint follows position and height, never rules.
   */
  private grasslandTint(x: number, z: number, height: number, base: THREE.Color): THREE.Color {
    const seed = this.field.seed ^ 0x51ed270b;
    const patch = THREE.MathUtils.smoothstep(fractalNoise(seed, x / 21, z / 19, 3), -0.32, 0.32);
    const dry = THREE.MathUtils.clamp(patch * 0.8 + THREE.MathUtils.smoothstep(height, 0.5, 5) * 0.35
      - THREE.MathUtils.smoothstep(-height, 0.05, 0.5) * 0.3, 0, 1);
    const tint = GRASS_SCRATCH.copy(SAGE_TINT).lerp(STRAW_TINT, dry);
    // Keep each terrain's own brightness so hills and forest stay distinct.
    const brightness = (base.r + base.g + base.b) / ((tint.r + tint.g + tint.b) || 1);
    return tint.multiplyScalar(THREE.MathUtils.lerp(1, brightness, 0.6));
  }

  /**
   * Meadow/earth/grain texture weights per vertex. Region weights already ease
   * between terrains; noise then breaks up each transition so it does not
   * trace the hex it came from. Swamp is vegetated ground mottled with mud.
   */
  private groundSplat(positions: readonly number[]): Float32Array {
    const count = positions.length / 3, splat = new Float32Array(count * 3);
    const seed = this.field.seed ^ 0x1f83d9ab;
    const channels = this.field.terrainTypes.map(terrain => ({
      weights: this.visualWeights.get(terrain)!,
      channel: groundSplatChannel(surfaceMaterialKind(terrain)),
      marsh: ["swamp", "marsh"].includes(terrain.toLowerCase()),
    }));
    for (let index = 0; index < count; index += 1) {
      const x = positions[index * 3]!, z = positions[index * 3 + 2]!;
      const mix = [0, 0, 0];
      for (const { weights, channel, marsh } of channels) {
        const weight = weights[index] ?? 0;
        if (weight <= 0) continue;
        if (marsh) {
          const mud = THREE.MathUtils.smoothstep(fractalNoise(seed + 7, x / 5.5, z / 5.5, 3), -.05, .4) * .75;
          mix[0] += weight * (1 - mud); mix[1] += weight * mud;
        } else mix[channel] += weight;
      }
      let total = mix[0]! + mix[1]! + mix[2]!;
      if (total <= 0) { splat[index * 3] = 1; continue; }
      for (let channel = 0; channel < 3; channel += 1) {
        const share = mix[channel]! / total;
        // Only partial shares move: interiors stay pure, borders become ragged.
        const breakup = fractalNoise(seed + channel * 101, x / 2.6, z / 2.6, 3) * .55 * 4 * share * (1 - share);
        mix[channel] = Math.max(0, share + breakup) ** 1.6;
      }
      total = mix[0]! + mix[1]! + mix[2]! || 1;
      for (let channel = 0; channel < 3; channel += 1) splat[index * 3 + channel] = mix[channel]! / total;
    }
    return splat;
  }

  private createSurface(assetBase?: string): void {
    const area = (this.bounds.maxX - this.bounds.minX) * (this.bounds.maxZ - this.bounds.minZ);
    const step = Math.max(0.36, Math.sqrt(area * 2 / 260_000));
    const nx = Math.ceil((this.bounds.maxX - this.bounds.minX) / step) + 1;
    const nz = Math.ceil((this.bounds.maxZ - this.bounds.minZ) / step) + 1;
    this.gridWidth = nx;
    this.gridHeight = nz;
    for (const terrain of this.field.terrainTypes) this.visualWeights.set(terrain, new Array<number>(nx * nz).fill(0));
    const positions: number[] = [];
    const colors: number[] = [];
    const uvs: number[] = [];
    const color = new THREE.Color();
    const sampleColor = new THREE.Color();
    for (let iz = 0; iz < nz; iz += 1) {
      for (let ix = 0; ix < nx; ix += 1) {
        const x = THREE.MathUtils.lerp(this.bounds.minX, this.bounds.maxX, ix / (nx - 1));
        const z = THREE.MathUtils.lerp(this.bounds.minZ, this.bounds.maxZ, iz / (nz - 1));
        positions.push(x, this.heightAt(x, z), z);
        uvs.push(x / 34, z / 34);
        const coord = this.layout.coordAt(x, z);
        this.vertexKeys.push(coord ? `${coord.col},${coord.row}` : null);
        let weights = this.surfaceWeightsAt(x, z);
        if (Object.keys(weights).length === 0) {
          // Continue the nearest terrain to the diorama rim. An empty weight
          // vector must never count as water through a 0 >= 0 comparison.
          let nearest=this.field.tiles[0]!, minimum=Infinity;
          for(const cell of this.field.tiles) {
            const distance=(x-cell.center.x)**2+(z-cell.center.z)**2;
            if(distance<minimum) {minimum=distance;nearest=cell;}
          }
          weights={[nearest.terrain]:1};
          if(this.field.roads.active && isRoadTerrain(nearest.terrain)) {
            const road=this.field.roads.sample(x,z);
            const backdrop=this.field.tiles.filter(cell=>!isRoadTerrain(cell.terrain)).sort((a,b)=>
              Math.hypot(x-a.center.x,z-a.center.z)-Math.hypot(x-b.center.x,z-b.center.z))[0]!;
            const coverage=road?.weight??0;
            weights={[backdrop.terrain]:1-coverage,[road?.terrain??nearest.terrain]:coverage};
          }
          if(isWaterTerrain(nearest.terrain)) positions[positions.length-2]=-.7;
        }
        const vertexIndex = iz * nx + ix;
        for (const terrain of this.field.terrainTypes) {
          this.visualWeights.get(terrain)![vertexIndex] = weights[terrain] ?? 0;
        }
        color.set(0x000000);
        let total = 0;
        for (const [terrain, weight] of Object.entries(weights)) {
          sampleColor.setHex(COLORS[terrain.toLowerCase()] ?? 0x8d8b6a);
          if(this.environmentPlan.frozenRiver && isWaterTerrain(terrain)) sampleColor.setHex(0xbad1d1);
          if (this.environmentPlan.winter && !["water", "mud", "swamp", "road", "road2", "dam", "town", "church"].includes(terrain)) {
            sampleColor.lerp(FROST_COLOR, .79);
          }
          if (!this.environmentPlan.winter && GRASSLAND.has(terrain.toLowerCase())) {
            sampleColor.copy(this.grasslandTint(x, z, positions[positions.length - 2]!, sampleColor));
          }
          if (isFieldTerrain(terrain)) {
            const furrow = 0.86 + 0.14 * (0.5 + 0.5 * Math.sin((x + z * 0.18) * 2.3));
            sampleColor.multiplyScalar(furrow);
          }
          color.r += sampleColor.r * weight;
          color.g += sampleColor.g * weight;
          color.b += sampleColor.b * weight;
          total += weight;
        }
        if (total === 0) color.setHex(COLORS.plains!);
        const streets = this.environmentPlan.settlement?.streets;
        if (streets?.length && (weights.town ?? 0) > 0) {
          const nearest = nearestOnStreet({ x, z }, streets);
          if (nearest) {
            const distance = Math.hypot(x-nearest.x, z-nearest.z);
            const worn = 1 - THREE.MathUtils.smoothstep(distance, .42, 1.05);
            sampleColor.setHex(this.environmentPlan.winter ? 0xa49a86 : 0xbca183);
            color.lerp(sampleColor, worn * (weights.town ?? 0) * .8);
          }
        }
        // Soil darkens as it nears a waterline: puddles, and the banks of ponds and rivers.
        const puddleDamp = THREE.MathUtils.smoothstep(this.puddleDip(x, z, weights), PUDDLE_FILL * .3, PUDDLE_FILL * 1.4);
        const water = Object.entries(weights).reduce((sum, [name, weight]) => sum + (isWaterTerrain(name) ? weight : 0), 0);
        const bankDamp = water > .5 ? 0 : THREE.MathUtils.smoothstep(this.field.waterInfluenceAt(x, z), .02, .3);
        color.multiplyScalar(1 - .38 * puddleDamp - .26 * bankDamp);
        const grain = 0.96 + 0.04 * Math.sin(x * 0.19 + z * 0.13);
        colors.push(color.r * grain, color.g * grain, color.b * grain);
      }
    }
    const materialIndices: number[][] = [[], [], [], [], [], [], []];
    const waterTypes=this.field.terrainTypes.filter(isWaterTerrain);
    const dryTypes=this.field.terrainTypes.filter(name=>!isWaterTerrain(name));
    const roadTypes=this.field.terrainTypes.filter(isRoadTerrain);
    const nonRoadTypes=dryTypes.filter(name=>!isRoadTerrain(name));
    const roadAt=(index:number):number=>roadTypes.reduce((total,name)=>total+this.visualWeights.get(name)![index]!,0);
    const waterAt=(index:number):number=>waterTypes.reduce((total,name)=>total+this.visualWeights.get(name)![index]!,0);
    const margin=(index:number,dry:string,road=false):number=>(road ? roadAt(index) : waterAt(index))-this.visualWeights.get(dry)![index]!;
    const crossings=new Map<string,number>();
    const intersect=(a:number,b:number,dry:string,road=false):number=>{
      const key=`${road}:${dry}:${[a,b].sort((a,b)=>a-b).join(",")}`;
      const known=crossings.get(key); if(known!==undefined) return known;
      const t=margin(a,dry,road)/(margin(a,dry,road)-margin(b,dry,road)), index=positions.length/3;
      const x=THREE.MathUtils.lerp(positions[a*3]!,positions[b*3]!,t);
      const z=THREE.MathUtils.lerp(positions[a*3+2]!,positions[b*3+2]!,t);
      positions.push(x,road ? THREE.MathUtils.lerp(positions[a*3+1]!,positions[b*3+1]!,t) : -.7,z);
      for(let axis=0;axis<3;axis++) colors.push(THREE.MathUtils.lerp(colors[a*3+axis]!,colors[b*3+axis]!,t));
      for(let axis=0;axis<2;axis++) uvs.push(THREE.MathUtils.lerp(uvs[a*2+axis]!,uvs[b*2+axis]!,t));
      for(const weights of this.visualWeights.values()) weights.push(THREE.MathUtils.lerp(weights[a]!,weights[b]!,t));
      const coord=this.layout.coordAt(x,z); this.vertexKeys.push(coord ? `${coord.col},${coord.row}` : null);
      crossings.set(key,index); return index;
    };
    const cut=(polygon:number[],dry:string,keepWater:boolean,road=false):number[]=>{
      const result:number[]=[];
      for(let i=0;i<polygon.length;i++) {
        const a=polygon[i]!,b=polygon[(i+1)%polygon.length]!;
        const insideA=margin(a,dry,road)>=0,insideB=margin(b,dry,road)>=0;
        if(insideA===keepWater) result.push(a);
        if(insideA!==insideB) result.push(intersect(a,b,dry,road));
      }
      return result;
    };
    const dryMaterial=(triangle:number[]):number=>{
      const dry=[...dryTypes].sort((a,b)=>triangle.reduce((sum,v)=>sum+this.visualWeights.get(b)![v]!-this.visualWeights.get(a)![v]!,0))[0] ?? "plains";
      return dry==="town" && this.environmentPlan.settlement ? 6 : surfaceMaterialIndex(dry);
    };
    const emitLand=(original:number[]):number[][]=>{
      if(roadTypes.length && original.every(index=>roadAt(index)>0 && nonRoadTypes.every(dry=>margin(index,dry,true)>=0))) {
        materialIndices[5]!.push(...original);return [original];
      }
      if(!roadTypes.length || original.every(index=>roadAt(index)<=1e-12)
        || nonRoadTypes.some(dry=>original.every(index=>margin(index,dry,true)<0))) {
        materialIndices[dryMaterial(original)]!.push(...original); return [original];
      }
      const pieces:number[][]=[];
      const emit=(polygon:number[],road:boolean):void=>{
        for(let i=1;i<polygon.length-1;i++) {
          const triangle=[polygon[0]!,polygon[i]!,polygon[i+1]!];
          const [a,b,c]=triangle as [number,number,number];
          if(Math.abs((positions[b*3]!-positions[a*3]!)*(positions[c*3+2]!-positions[a*3+2]!)
            -(positions[c*3]!-positions[a*3]!)*(positions[b*3+2]!-positions[a*3+2]!))<1e-10) continue;
          materialIndices[road ? 5 : dryMaterial(triangle)]!.push(...triangle);pieces.push(triangle);
        }
      };
      let polygon=original;
      for(const dry of nonRoadTypes) {
        emit(cut(polygon,dry,false,true),false);
        polygon=cut(polygon,dry,true,true);
        if(polygon.length<3) break;
      }
      emit(polygon,true);
      return pieces;
    };
    const addLand=(original:number[]):void=>{
      const pieces=emitLand(original);
      if(pieces.length!==1 || pieces[0]!==original) this.surfaceTriangles.set(this.triangleKey(original[0]!,original[1]!,original[2]!),pieces);
    };
    const addTriangle = (a: number, b: number, c: number): void => {
      const original=[a,b,c];
      if(original.every(index=>waterAt(index)<=1e-12)) { addLand(original);return; }
      if(waterTypes.length && original.every(index=>dryTypes.every(dry=>margin(index,dry)>=0))) {
        materialIndices[4]!.push(a,b,c);return;
      }
      if(waterTypes.length && !dryTypes.some(dry=>original.every(index=>margin(index,dry)<0))) {
        const pieces:number[][]=[];
        const emit=(polygon:number[],water:boolean):void=>{
          for(let i=1;i<polygon.length-1;i++) {
            const triangle=[polygon[0]!,polygon[i]!,polygon[i+1]!];
            const [a,b,c]=triangle as [number,number,number];
            if(Math.abs((positions[b*3]!-positions[a*3]!)*(positions[c*3+2]!-positions[a*3+2]!)
              -(positions[c*3]!-positions[a*3]!)*(positions[b*3+2]!-positions[a*3+2]!))<1e-10) continue;
            if(water) {materialIndices[4]!.push(...triangle);pieces.push(triangle);}
            else pieces.push(...emitLand(triangle));
          }
        };
        let polygon=original;
        // Water must outweigh every dry kind, not their sum: clip all of those
        // linear constraints, including a water pocket inside three dry corners.
        for(const dry of dryTypes) {
          emit(cut(polygon,dry,false),false);
          polygon=cut(polygon,dry,true);
          if(polygon.length<3) break;
        }
        emit(polygon,true);
        this.surfaceTriangles.set(this.triangleKey(original[0]!,original[1]!,original[2]!),pieces);
        return;
      }
      addLand(original);
    };
    for (let iz = 0; iz < nz - 1; iz += 1) {
      for (let ix = 0; ix < nx - 1; ix += 1) {
        const a = iz * nx + ix, b = a + 1, c = a + nx, d = c + 1;
        if ((ix + iz) % 2 === 0) { addTriangle(a, c, b); addTriangle(b, c, d); }
        else { addTriangle(a, c, d); addTriangle(a, d, b); }
      }
    }
    this.waterIndices = materialIndices[4]!;
    for(let i=0;i<this.waterIndices.length;i+=3) {
      const triangle=this.waterIndices.slice(i,i+3);
      const x=triangle.reduce((sum,index)=>sum+positions[index*3]!,0)/3;
      const z=triangle.reduce((sum,index)=>sum+positions[index*3+2]!,0)/3;
      const cell=this.layout.coordAt(x,z);
      if(!cell) continue;
      for(const coord of [cell,...this.layout.neighbours(cell)]) {
        const key=`${coord.col},${coord.row}`, bucket=this.waterCellIndices.get(key) ?? [];
        bucket.push(...triangle); this.waterCellIndices.set(key,bucket);
      }
    }
    const indices = materialIndices.flat();
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geometry.setAttribute(GROUND_SPLAT, new THREE.Float32BufferAttribute(this.groundSplat(positions), 3));
    geometry.setAttribute(SHORE_DISTANCE, new THREE.Float32BufferAttribute(shoreDistances(positions, materialIndices), 1));
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    // The four dry-land materials share one colour node and differ only in a
    // hundredth of roughness: their triangles (contiguous at the start of the
    // index) are drawn as one group with the meadow material.
    const landCount = materialIndices.slice(0, 4).reduce((sum, bucket) => sum + bucket.length, 0);
    if (landCount > 0) geometry.addGroup(0, landCount, 0);
    let groupStart = landCount;
    materialIndices.forEach((bucket, materialIndex) => {
      if (materialIndex < 4) return;
      if (bucket.length > 0) geometry.addGroup(groupStart, bucket.length, materialIndex);
      groupStart += bucket.length;
    });
    geometry.computeVertexNormals();
    const surface = createGeneratedSurfaceMaterials(assetBase, this.environmentPlan.winter);
    this.soilMaterial = surface.soil;
    if (this.environmentPlan.settlement) surface.materials.push(new THREE.MeshStandardMaterial({
      name: "Settlement packed ground", color: 0xffffff, vertexColors: true, roughness: 1, side: THREE.DoubleSide,
    }));
    this.surfaceTextures.push(...surface.textures);
    const mesh = new THREE.Mesh(geometry, surface.materials);
    mesh.name = `Continuous terrain regions: ${this.field.terrainTypes.join(", ")}`;
    mesh.receiveShadow = true;
    this.surfaceMesh = mesh;
    this.basePositions = Float32Array.from(positions);
    this.baseColors = Float32Array.from(colors);
    this.group.add(mesh);
    this.interactiveMeshes.push(mesh);
  }

  private createPlinth(): void {
    const { minX, maxX, minZ, maxZ } = this.bounds;
    const surfacePositions = this.surfaceMesh.geometry.getAttribute("position") as THREE.BufferAttribute;
    const edgeIndices: number[] = [];
    for (let x = 0; x < this.gridWidth; x += 1) edgeIndices.push(x);
    for (let z = 1; z < this.gridHeight; z += 1) edgeIndices.push(z * this.gridWidth + this.gridWidth - 1);
    for (let x = this.gridWidth - 2; x >= 0; x -= 1) edgeIndices.push((this.gridHeight - 1) * this.gridWidth + x);
    for (let z = this.gridHeight - 2; z > 0; z -= 1) edgeIndices.push(z * this.gridWidth);
    edgeIndices.push(edgeIndices[0]!);
    // The cut face is a clean section with a slight turf lip overhanging the
    // topsoil; everything below is drawn by the soil material. Rows sit at fixed depths below the rim near the top, then
    // spread evenly down to the base.
    const seed = this.field.seed ^ 0x2545f491;
    const columns: Array<{ x: number; z: number; top: number; outX: number; outZ: number; along: number; water: number }> = [];
    const waterVertices = new Set(this.waterIndices);
    let along = 0;
    for (let index = 0; index < edgeIndices.length; index += 1) {
      const source = edgeIndices[index]!;
      const x = surfacePositions.getX(source), z = surfacePositions.getZ(source);
      if (index > 0) {
        const previous = edgeIndices[index - 1]!;
        along += Math.hypot(x - surfacePositions.getX(previous), z - surfacePositions.getZ(previous));
      }
      let outX = x <= minX + 1e-6 ? -1 : x >= maxX - 1e-6 ? 1 : 0;
      let outZ = z <= minZ + 1e-6 ? -1 : z >= maxZ - 1e-6 ? 1 : 0;
      const length = Math.hypot(outX, outZ) || 1;
      outX /= length; outZ /= length;
      // Only real water shows a water band on the face; a ditch or hollow at the rim is still soil.
      columns.push({ x, z, top: surfacePositions.getY(source), outX, outZ, along, water: waterVertices.has(source) ? 1 : 0 });
    }
    const positions: number[] = [], indices: number[] = [], rims: number[] = [], wet: number[] = [];
    for (const column of columns) {
      const reach = column.top - PLINTH_BOTTOM;
      const depths = SOIL_ROWS.filter(depth => depth < reach - .3);
      const last = depths.at(-1)!, remaining = SOIL_ROW_COUNT - depths.length;
      for (let step = 1; step <= remaining; step += 1) depths.push(last + (reach - last) * step / remaining);
      for (const [row, depth] of depths.entries()) {
        const offset = row === 0 || row === SOIL_ROW_COUNT - 1 ? 0 : soilRelief(seed, column.along, depth);
        positions.push(column.x + column.outX * offset, column.top - depth, column.z + column.outZ * offset);
        rims.push(column.top);
        wet.push(column.water);
      }
    }
    for (let index = 0; index < columns.length - 1; index += 1) {
      for (let row = 0; row < SOIL_ROW_COUNT - 1; row += 1) {
        const a = index * SOIL_ROW_COUNT + row, b = a + SOIL_ROW_COUNT;
        indices.push(a, a + 1, b, b, a + 1, b + 1);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute(RIM_TOP, new THREE.Float32BufferAttribute(rims, 1));
    geometry.setAttribute(RIM_WATER, new THREE.Float32BufferAttribute(wet, 1));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const skirt = new THREE.Mesh(geometry, this.soilMaterial);
    skirt.name = "Topography-following layered battlefield soil plinth";
    skirt.receiveShadow = true;
    // A walnut base with a chamfered top edge frames the board like a model's plinth.
    const width = maxX - minX + BASE_MARGIN * 2, depth = maxZ - minZ + BASE_MARGIN * 2, chamfer = .22;
    const outline = new THREE.Shape();
    outline.moveTo(-width / 2, -depth / 2); outline.lineTo(width / 2, -depth / 2);
    outline.lineTo(width / 2, depth / 2); outline.lineTo(-width / 2, depth / 2);
    const baseGeometry = new THREE.ExtrudeGeometry(outline, { depth: BASE_HEIGHT - chamfer, bevelEnabled: true,
      bevelThickness: chamfer, bevelSize: chamfer, bevelSegments: 1 });
    baseGeometry.rotateX(-Math.PI / 2);
    baseGeometry.translate((minX + maxX) / 2, PLINTH_BOTTOM - BASE_HEIGHT, (minZ + maxZ) / 2);
    const base = new THREE.Mesh(baseGeometry, createWoodMaterial());
    base.name = "Battlefield plinth base";
    base.castShadow = base.receiveShadow = true;
    this.group.add(skirt, base);
  }
}

/** Depths below the rim of the cut face's upper rows: turf lip, topsoil, subsoil, bedrock top. */
const SOIL_ROWS = [0, .14, .45, .9, 1.35, 2, 2.7, 3.35, 3.8];
/** Every column of the cut face has the same number of rows, so it forms one quad strip. */
const SOIL_ROW_COUNT = 16;

/** Outward relief of the cut face at a depth below the rim. */
function soilRelief(seed: number, along: number, depth: number): number {
  if (depth < .3) return -.12 + fractalNoise(seed, along / 1.1, depth, 2) * .03;
  // Below the lip the face is a clean cut, as in a textbook section: only a
  // faint unevenness, with the stones drawn into it rather than standing out.
  const soft = fractalNoise(seed + 1, along / 2.2, depth / 1.5, 2) * .03 - .02;
  const rock = latticeRelief(seed + 2, along / 1.7, depth / 1.2) * .05;
  return THREE.MathUtils.lerp(soft, rock, THREE.MathUtils.smoothstep(depth, 3.3, 3.9));
}

/** Bilinear value noise in [-1, 1] on an integer lattice. */
function latticeRelief(seed: number, x: number, y: number): number {
  const corner = (cx: number, cy: number): number => {
    let hash = Math.imul(cx, 0x27d4eb2d) ^ Math.imul(cy, 0x165667b1) ^ seed;
    hash = Math.imul(hash ^ hash >>> 15, 0x2c1b3c6d);
    return ((hash ^ hash >>> 13) >>> 0) / 0xffffffff * 2 - 1;
  };
  const x0 = Math.floor(x), y0 = Math.floor(y), tx = x - x0, ty = y - y0;
  const top = THREE.MathUtils.lerp(corner(x0, y0), corner(x0 + 1, y0), tx);
  const bottom = THREE.MathUtils.lerp(corner(x0, y0 + 1), corner(x0 + 1, y0 + 1), tx);
  return THREE.MathUtils.lerp(top, bottom, ty);
}

/** Where the cut soil face meets the wooden base. */
const PLINTH_BOTTOM = -5.9;
/** The walnut base: its ledge beyond the soil, and its thickness. */
const BASE_MARGIN = .9;
const BASE_HEIGHT = 1.1;

/** Water vertices farther than this from the shore all count as open water. */
const SHORE_REACH = 6;

/**
 * Metres from each water vertex to the nearest shoreline vertex (one that a
 * land triangle shares); zero on land. The water shader deepens its colour and
 * places foam with it, since the flat water surface has no bed beneath it.
 */
function shoreDistances(positions: readonly number[], materialIndices: readonly number[][]): Float32Array {
  const count = positions.length / 3, distances = new Float32Array(count);
  const water = new Set(materialIndices[4]);
  if (!water.size) return distances;
  const land = new Set<number>();
  materialIndices.forEach((bucket, material) => { if (material !== 4) for (const index of bucket) land.add(index); });
  const cell = 2, buckets = new Map<string, number[]>();
  for (const index of water) {
    if (!land.has(index)) continue;
    const key = `${Math.floor(positions[index * 3]! / cell)},${Math.floor(positions[index * 3 + 2]! / cell)}`;
    const bucket = buckets.get(key) ?? [];
    bucket.push(index); buckets.set(key, bucket);
  }
  const reach = Math.ceil(SHORE_REACH / cell);
  for (const index of water) {
    if (land.has(index)) continue;
    const x = positions[index * 3]!, z = positions[index * 3 + 2]!;
    const cx = Math.floor(x / cell), cz = Math.floor(z / cell);
    let nearest = SHORE_REACH;
    for (let dx = -reach; dx <= reach; dx += 1) for (let dz = -reach; dz <= reach; dz += 1) {
      for (const shore of buckets.get(`${cx + dx},${cz + dz}`) ?? []) {
        nearest = Math.min(nearest, Math.hypot(x - positions[shore * 3]!, z - positions[shore * 3 + 2]!));
      }
    }
    distances[index] = nearest;
  }
  return distances;
}
