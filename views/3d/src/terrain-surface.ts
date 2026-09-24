/**
 * The generated terrain's ground: its height and blend weights everywhere, and
 * the vertex data of its surface mesh. Nothing here needs a document or a GPU,
 * so the surface, most of a map's build, can be computed in a worker
 * (terrain-worker.ts) and handed back as plain arrays.
 */
import * as THREE from "three";
import { HexLayout } from "./hex-coordinates.ts";
import { createTerrainRegions, fractalNoise, isFieldTerrain, isWaterTerrain, type TerrainRegions, type TerrainCell, type TerrainWeights } from "./terrain-regions.ts";
import { TopographyPlan } from "./topography.ts";
import type { BattleSnapshot } from "./types.ts";
import { bridgeRelief, earthworkRelief, planEnvironment, type EnvironmentPlan } from "./environment-plan.ts";
import type { TownWallPlan } from "./town-wall-plan.ts";
import { isRoadTerrain } from "./road-corridors.ts";
import { nearestOnStreet } from "./settlement-plan.ts";
import { pointInPolygon } from "./geometry-utils.ts";

export type SurfaceMaterialKind = "meadow" | "earth" | "slope" | "rock" | "water" | "road";

const MATERIAL_ORDER: SurfaceMaterialKind[] = ["meadow", "earth", "slope", "rock", "water", "road"];

export function surfaceMaterialKind(terrain: string): SurfaceMaterialKind {
  const name = terrain.toLowerCase();
  if (["water", "river", "lake"].includes(name)) return "water";
  if (isRoadTerrain(name)) return "road";
  if (["slope", "steep_slope"].includes(name)) return "slope";
  if (["cliff", "rock"].includes(name)) return "rock";
  if (["mud", "swamp", "marsh", "road", "road2", "dam", "causeway", "trenches"].includes(name)
    || isFieldTerrain(name)) return "earth";
  return "meadow";
}

export function surfaceMaterialIndex(terrain: string): number {
  return MATERIAL_ORDER.indexOf(surfaceMaterialKind(terrain));
}

/** Which ground texture a terrain kind contributes to: 0 meadow, 1 earth, 2 grain. */
export function groundSplatChannel(kind: SurfaceMaterialKind): 0 | 1 | 2 {
  if (kind === "meadow" || kind === "slope") return 0;
  if (kind === "earth" || kind === "water") return 1;
  return 2;
}

export const COLORS: Record<string, number> = {
  plains: 0xdfe6b3, forest: 0xb3c68f, hills: 0xcfce98, water: 0x78aaa4,
  town: 0xd1b99d, road: 0xd9c7a0, road2: 0xc7b28f, dam: 0xdacaa2,
  mud: 0xd9b891, swamp: 0xb3bd8a, slope: 0xc3b59b, trenches: 0xa88972,
  church: 0xcab79e, field: 0xddc47d, fields: 0xddc47d, farmland: 0xddc47d, cropland: 0xddc47d,
};
export const FROST_COLOR = new THREE.Color(0xe2e5dc);
export const WETLAND = new Set(["mud", "swamp", "marsh"]);
/** Deepest puddle hollow in metres; the water sheet sits PUDDLE_FILL below the undipped ground. */
export const PUDDLE_DEPTH = .24;
const PUDDLE_FILL = .07;
/** Grassland drifts between cured straw and cooler sage, like late-summer pasture. */
const STRAW_TINT = new THREE.Color(0xffe3a2);
const SAGE_TINT = new THREE.Color(0xd3deae);
const GRASS_SCRATCH = new THREE.Color();
const GRASSLAND = new Set(["plains", "hills", "hill", "ridge", "highland", "slope", "steep_slope", "forest"]);

/** A generated map's layout, regions and environment: a small share of the build next to its meshes. */
export interface GeneratedTerrainPlan {
  layout: HexLayout;
  field: TerrainRegions;
  environmentPlan: EnvironmentPlan;
}

/** The parts of a snapshot the generated terrain is built from, small enough to post to a worker. */
export type TerrainInput = Pick<BattleSnapshot, "scenario" | "seed" | "cols" | "rows" | "tiles" | "features">;

export function terrainInput({ scenario, seed, cols, rows, tiles, features }: TerrainInput): TerrainInput {
  return { scenario, seed, cols, rows, tiles, features };
}

export function planGeneratedTerrain(snapshot: TerrainInput): GeneratedTerrainPlan {
  const cols = snapshot.cols ?? Math.max(...snapshot.tiles.map(tile => tile.col)) + 1;
  const rows = snapshot.rows ?? Math.max(...snapshot.tiles.map(tile => tile.row)) + 1;
  const layout = new HexLayout(cols, rows);
  const field = createTerrainRegions({ cols, rows, tiles: snapshot.tiles, scenario: snapshot.scenario ?? "battle",
    seed: snapshot.seed ?? 1, hexRadius: layout.radius, coreCoverage: 0.76, boundaryNoise: 0.75 });
  return { layout, field, environmentPlan: planEnvironment(snapshot.scenario, field.tiles, snapshot.features) };
}

/** Height, blend weights and colour inputs of the generated ground at any point. */
export class TerrainGround {
  public readonly field: TerrainRegions;
  public readonly layout: HexLayout;
  public readonly environmentPlan: EnvironmentPlan;
  public readonly topography: TopographyPlan;
  public readonly bounds: ReturnType<HexLayout["bounds"]>;
  private bridgeBaseHeight = 0;
  private readonly cityLoops: Array<{points:Array<[number,number]>;minX:number;maxX:number;minZ:number;maxZ:number}>;
  /** Wall loops around a fortified manor: everything inside is its packed-earth courtyard. */
  private readonly yardLoops: Array<{points:Array<[number,number]>;minX:number;maxX:number;minZ:number;maxZ:number}>;
  private readonly cityCells: readonly TerrainCell[];

  public constructor(plan: GeneratedTerrainPlan) {
    ({ layout: this.layout, field: this.field, environmentPlan: this.environmentPlan } = plan);
    const loopsOf=(walls:readonly TownWallPlan[])=>walls.flatMap(wall=>wall.loops.map(loop=>({
      points:loop.points.map(p=>[p.x,p.z] as [number,number]),minX:Math.min(...loop.points.map(p=>p.x)),maxX:Math.max(...loop.points.map(p=>p.x)),
      minZ:Math.min(...loop.points.map(p=>p.z)),maxZ:Math.max(...loop.points.map(p=>p.z)),
    })));
    this.cityLoops=loopsOf(this.environmentPlan.walls);
    this.yardLoops=loopsOf(this.environmentPlan.walls.filter(wall=>this.environmentPlan.fortifications.has(wall.id)));
    const enclosed=new Set(this.environmentPlan.walls.flatMap(wall=>wall.enclosedCells));
    this.cityCells=this.field.tiles.filter(cell=>enclosed.has(`${cell.col},${cell.row}`)&&["town","church"].includes(cell.terrain));
    this.topography = new TopographyPlan(this.field,this.environmentPlan.raisedCells);
    if(this.environmentPlan.bridge) {
      const {x,z}=this.environmentPlan.bridge;
      this.bridgeBaseHeight=this.topography.elevationAt(x,z)+this.field.heightInputAt(x,z).variation*.24;
    }
    this.bounds = this.layout.bounds();
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

  public insideCity(x:number,z:number):boolean {
    return this.cityLoops.some(loop=>x>=loop.minX&&x<=loop.maxX&&z>=loop.minZ&&z<=loop.maxZ&&pointInPolygon(x,z,loop.points));
  }

  public surfaceWeightsAt(x:number,z:number,source:TerrainWeights=this.field.weightsAt(x,z),inside=this.insideCity(x,z)):TerrainWeights {
    if(!inside) return source;
    if(this.yardLoops.some(loop=>x>=loop.minX&&x<=loop.maxX&&z>=loop.minZ&&z<=loop.maxZ&&pointInPolygon(x,z,loop.points))) return {town:1};
    const weights:Record<string,number>={...source};let water=0;
    for(const name of Object.keys(weights)) if(isWaterTerrain(name)) {water+=weights[name]!;weights[name]=0;}
    if(water>0) weights.town=(weights.town??0)+water;
    return weights;
  }

  /**
   * Broad straw and sage patches, drier on crests and greener in hollows.
   * Presentation only: the tint follows position and height, never rules.
   */
  public grasslandTint(x: number, z: number, height: number, base: THREE.Color): THREE.Color {
    const seed = this.field.seed ^ 0x51ed270b;
    const patch = THREE.MathUtils.smoothstep(fractalNoise(seed, x / 21, z / 19, 3), -0.32, 0.32);
    const dry = THREE.MathUtils.clamp(patch * 0.8 + THREE.MathUtils.smoothstep(height, 0.5, 5) * 0.35
      - THREE.MathUtils.smoothstep(-height, 0.05, 0.5) * 0.3, 0, 1);
    const tint = GRASS_SCRATCH.copy(SAGE_TINT).lerp(STRAW_TINT, dry);
    // Keep each terrain's own brightness so hills and forest stay distinct.
    const brightness = (base.r + base.g + base.b) / ((tint.r + tint.g + tint.b) || 1);
    return tint.multiplyScalar(THREE.MathUtils.lerp(1, brightness, 0.6));
  }
}

/** Vertex data of the surface mesh and the lookups built beside it, as arrays a worker can transfer. */
export interface SurfaceData {
  gridWidth: number;
  gridHeight: number;
  positions: Float32Array;
  normals: Float32Array;
  colors: Float32Array;
  uvs: Float32Array;
  splat: Float32Array;
  shore: Float32Array;
  /** Winter only. */
  roadTrack: Float32Array | null;
  index: Uint16Array | Uint32Array;
  /** Draw groups: the four dry-land materials first as one, then water, road and settlement ground. */
  groups: Array<{ start: number; count: number; materialIndex: number }>;
  /** The hex under each vertex, as "col,row". */
  vertexKeys: Array<string | null>;
  /** Each terrain's blend weight per vertex. */
  visualWeights: Map<string, Float64Array>;
  /** Grid triangles split at a shore or road contour, keyed by `triangleKey` of their corners. */
  surfaceTriangles: Map<number, number[][]>;
  waterIndices: number[];
  waterCellIndices: Map<string, number[]>;
}

/** The buffers to transfer, rather than copy, when posting surface data. */
export function surfaceTransferables(surface: SurfaceData): ArrayBuffer[] {
  const arrays = [surface.positions, surface.normals, surface.colors, surface.uvs, surface.splat, surface.shore,
    surface.roadTrack, surface.index, ...surface.visualWeights.values()];
  return arrays.filter(array => array !== null).map(array => array.buffer as ArrayBuffer);
}

/** Order-independent numeric key of a grid triangle; the grid has about 130k vertices, so it stays below 2^53. */
export function triangleKey(size: number, a: number, b: number, c: number): number {
  const low = Math.min(a, b, c), high = Math.max(a, b, c), middle = a + b + c - low - high;
  return (low * size + middle) * size + high;
}

export function buildSurface(ground: TerrainGround): SurfaceData {
  const area = (ground.bounds.maxX - ground.bounds.minX) * (ground.bounds.maxZ - ground.bounds.minZ);
  const step = Math.max(0.36, Math.sqrt(area * 2 / 260_000));
  const nx = Math.ceil((ground.bounds.maxX - ground.bounds.minX) / step) + 1;
  const nz = Math.ceil((ground.bounds.maxZ - ground.bounds.minZ) / step) + 1;
  const key = (a: number, b: number, c: number): number => triangleKey(nx * nz, a, b, c);
  const visualWeights = new Map<string, number[]>(), vertexKeys: Array<string | null> = [];
  const surfaceTriangles = new Map<number, number[][]>(), waterCellIndices = new Map<string, number[]>();
  for (const terrain of ground.field.terrainTypes) visualWeights.set(terrain, new Array<number>(nx * nz).fill(0));
  const positions: number[] = [];
  const colors: number[] = [];
  const uvs: number[] = [];
  const color = new THREE.Color();
  const sampleColor = new THREE.Color();
  for (let iz = 0; iz < nz; iz += 1) {
    for (let ix = 0; ix < nx; ix += 1) {
      const x = THREE.MathUtils.lerp(ground.bounds.minX, ground.bounds.maxX, ix / (nx - 1));
      const z = THREE.MathUtils.lerp(ground.bounds.minZ, ground.bounds.maxZ, iz / (nz - 1));
      positions.push(x, ground.heightAt(x, z), z);
      uvs.push(x / 34, z / 34);
      const coord = ground.layout.coordAt(x, z);
      vertexKeys.push(coord ? `${coord.col},${coord.row}` : null);
      let weights = ground.surfaceWeightsAt(x, z);
      if (Object.keys(weights).length === 0) {
        // Continue the nearest terrain to the diorama rim. An empty weight
        // vector must never count as water through a 0 >= 0 comparison.
        let nearest=ground.field.tiles[0]!, minimum=Infinity;
        for(const cell of ground.field.tiles) {
          const distance=(x-cell.center.x)**2+(z-cell.center.z)**2;
          if(distance<minimum) {minimum=distance;nearest=cell;}
        }
        weights={[nearest.terrain]:1};
        if(ground.field.roads.active && isRoadTerrain(nearest.terrain)) {
          const road=ground.field.roads.sample(x,z);
          const backdrop=ground.field.tiles.filter(cell=>!isRoadTerrain(cell.terrain)).sort((a,b)=>
            Math.hypot(x-a.center.x,z-a.center.z)-Math.hypot(x-b.center.x,z-b.center.z))[0]!;
          const coverage=road?.weight??0;
          weights={[backdrop.terrain]:1-coverage,[road?.terrain??nearest.terrain]:coverage};
        }
        if(isWaterTerrain(nearest.terrain)) positions[positions.length-2]=-.7;
      }
      const vertexIndex = iz * nx + ix;
      for (const terrain of ground.field.terrainTypes) {
        visualWeights.get(terrain)![vertexIndex] = weights[terrain] ?? 0;
      }
      color.set(0x000000);
      let total = 0;
      for (const [terrain, weight] of Object.entries(weights)) {
        sampleColor.setHex(COLORS[terrain.toLowerCase()] ?? 0x8d8b6a);
        if(ground.environmentPlan.frozenRiver && isWaterTerrain(terrain)) sampleColor.setHex(0xbad1d1);
        if (ground.environmentPlan.winter && !["water", "mud", "swamp", "road", "road2", "dam", "town", "church"].includes(terrain)) {
          sampleColor.lerp(FROST_COLOR, .79);
        }
        if (!ground.environmentPlan.winter && GRASSLAND.has(terrain.toLowerCase())) {
          sampleColor.copy(ground.grasslandTint(x, z, positions[positions.length - 2]!, sampleColor));
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
      const streets = ground.environmentPlan.settlement?.streets;
      if (streets?.length && (weights.town ?? 0) > 0) {
        const nearest = nearestOnStreet({ x, z }, streets);
        if (nearest) {
          const distance = Math.hypot(x-nearest.x, z-nearest.z);
          const worn = 1 - THREE.MathUtils.smoothstep(distance, .42, 1.05);
          sampleColor.setHex(ground.environmentPlan.winter ? 0xa49a86 : 0xbca183);
          color.lerp(sampleColor, worn * (weights.town ?? 0) * .8);
        }
      }
      // Soil darkens as it nears a waterline: puddles, and the banks of ponds and rivers.
      const puddleDamp = THREE.MathUtils.smoothstep(ground.puddleDip(x, z, weights), PUDDLE_FILL * .3, PUDDLE_FILL * 1.4);
      const water = Object.entries(weights).reduce((sum, [name, weight]) => sum + (isWaterTerrain(name) ? weight : 0), 0);
      const bankDamp = water > .5 ? 0 : THREE.MathUtils.smoothstep(ground.field.waterInfluenceAt(x, z), .02, .3);
      color.multiplyScalar(1 - .38 * puddleDamp - .26 * bankDamp);
      const grain = 0.96 + 0.04 * Math.sin(x * 0.19 + z * 0.13);
      colors.push(color.r * grain, color.g * grain, color.b * grain);
    }
  }
  const materialIndices: number[][] = [[], [], [], [], [], [], []];
  const waterTypes=ground.field.terrainTypes.filter(isWaterTerrain);
  const dryTypes=ground.field.terrainTypes.filter(name=>!isWaterTerrain(name));
  const roadTypes=ground.field.terrainTypes.filter(isRoadTerrain);
  const nonRoadTypes=dryTypes.filter(name=>!isRoadTerrain(name));
  const roadAt=(index:number):number=>roadTypes.reduce((total,name)=>total+visualWeights.get(name)![index]!,0);
  const waterAt=(index:number):number=>waterTypes.reduce((total,name)=>total+visualWeights.get(name)![index]!,0);
  const margin=(index:number,dry:string,road=false):number=>(road ? roadAt(index) : waterAt(index))-visualWeights.get(dry)![index]!;
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
    for(const weights of visualWeights.values()) weights.push(THREE.MathUtils.lerp(weights[a]!,weights[b]!,t));
    const coord=ground.layout.coordAt(x,z); vertexKeys.push(coord ? `${coord.col},${coord.row}` : null);
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
    const dry=[...dryTypes].sort((a,b)=>triangle.reduce((sum,v)=>sum+visualWeights.get(b)![v]!-visualWeights.get(a)![v]!,0))[0] ?? "plains";
    return dry==="town" && ground.environmentPlan.settlement ? 6 : surfaceMaterialIndex(dry);
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
    if(pieces.length!==1 || pieces[0]!==original) surfaceTriangles.set(key(original[0]!,original[1]!,original[2]!),pieces);
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
      surfaceTriangles.set(key(original[0]!,original[1]!,original[2]!),pieces);
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
  const waterIndices = materialIndices[4]!;
  for(let i=0;i<waterIndices.length;i+=3) {
    const triangle=waterIndices.slice(i,i+3);
    const x=triangle.reduce((sum,index)=>sum+positions[index*3]!,0)/3;
    const z=triangle.reduce((sum,index)=>sum+positions[index*3+2]!,0)/3;
    const cell=ground.layout.coordAt(x,z);
    if(!cell) continue;
    for(const coord of [cell,...ground.layout.neighbours(cell)]) {
      const key=`${coord.col},${coord.row}`, bucket=waterCellIndices.get(key) ?? [];
      bucket.push(...triangle); waterCellIndices.set(key,bucket);
    }
  }
  const indices = materialIndices.flat();
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  // The four dry-land materials share one colour node and differ only in a
  // hundredth of roughness: their triangles (contiguous at the start of the
  // index) are drawn as one group with the meadow material.
  const groups: SurfaceData["groups"] = [];
  const landCount = materialIndices.slice(0, 4).reduce((sum, bucket) => sum + bucket.length, 0);
  if (landCount > 0) groups.push({ start: 0, count: landCount, materialIndex: 0 });
  let groupStart = landCount;
  materialIndices.forEach((bucket, materialIndex) => {
    if (materialIndex < 4) return;
    if (bucket.length > 0) groups.push({ start: groupStart, count: bucket.length, materialIndex });
    groupStart += bucket.length;
  });
  return {
    gridWidth: nx, gridHeight: nz,
    positions: geometry.getAttribute("position").array as Float32Array,
    normals: geometry.getAttribute("normal").array as Float32Array,
    colors: Float32Array.from(colors), uvs: Float32Array.from(uvs),
    splat: groundSplat(ground.field, visualWeights, positions),
    shore: shoreDistances(positions, materialIndices),
    roadTrack: ground.environmentPlan.winter ? roadTrack(ground.field, positions, materialIndices[5]!) : null,
    index: geometry.index!.array as Uint16Array | Uint32Array,
    groups, vertexKeys,
    visualWeights: new Map([...visualWeights].map(([terrain, weights]) => [terrain, Float64Array.from(weights)])),
    surfaceTriangles, waterIndices, waterCellIndices,
  };
}

/**
 * Meadow/earth/grain texture weights per vertex. Region weights already ease
 * between terrains; noise then breaks up each transition so it does not
 * trace the hex it came from. Swamp is vegetated ground mottled with mud.
 */
function groundSplat(field: TerrainRegions, visualWeights: ReadonlyMap<string, number[]>, positions: readonly number[]): Float32Array {
  const count = positions.length / 3, splat = new Float32Array(count * 3);
  const seed = field.seed ^ 0x1f83d9ab;
  const channels = field.terrainTypes.map(terrain => ({
    weights: visualWeights.get(terrain)!,
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

/** Where each road vertex lies across its road and how rutted it is, for winter; the verge elsewhere. */
function roadTrack(field: TerrainRegions, positions: readonly number[], roadIndices: readonly number[]): Float32Array {
  const track = new Float32Array(positions.length / 3 * 2).fill(0);
  for (let index = 0; index < positions.length / 3; index += 1) track[index * 2] = 1;
  for (const index of new Set(roadIndices)) {
    const sample = field.roads.sample(positions[index * 3]!, positions[index * 3 + 2]!);
    track[index * 2] = sample?.across ?? 1;
    track[index * 2 + 1] = sample?.ruts ?? 0;
  }
  return track;
}

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
