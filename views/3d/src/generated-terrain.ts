import * as THREE from "three";
import { createGeneratedSurfaceMaterials, createPuddleMaterial, createWoodMaterial, GROUND_SPLAT, RIM_TOP, RIM_WATER, ROAD_TRACK, SHORE_DISTANCE } from "./generated-materials.ts";
import type { HexLayout } from "./hex-coordinates.ts";
import { fractalNoise, isWaterTerrain, type TerrainRegions, type TerrainWeights } from "./terrain-regions.ts";
import type { TopographyPlan } from "./topography.ts";
import type { BattleSnapshot, BattleTerrain } from "./types.ts";
import type { EnvironmentPlan } from "./environment-plan.ts";
import { BRIDGE_DECK_LIFT, bridgeDeckAt, type BridgeDeck } from "./fortification-plan.ts";
import { clipPolygon, triangulatePolygon } from "./water-geometry.ts";
import { buildSurface, COLORS, FROST_COLOR, planGeneratedTerrain, terrainInput, TerrainGround, triangleKey, WETLAND, type SurfaceData } from "./terrain-surface.ts";

/** Cool grey the remembered (explored, not visible) terrain is pulled toward. */
const MEMORY_TINT = new THREE.Color(0.62, 0.66, 0.72);

const PUDDLE_FILL = .07;

export { PUDDLE_DEPTH, planGeneratedTerrain, type GeneratedTerrainPlan } from "./terrain-surface.ts";

/**
 * Computes the surface of a generated map in a worker, so the main thread
 * stays free while it builds. Null where a worker cannot run; the terrain
 * then builds its surface itself.
 */
export function buildSurfaceOffThread(snapshot: BattleSnapshot): Promise<SurfaceData | null> {
  let worker: Worker;
  try {
    worker = new Worker(new URL("./terrain-worker.ts", import.meta.url), { type: "module" });
  } catch {
    return Promise.resolve(null);
  }
  return new Promise(resolve => {
    const finish = (surface: SurfaceData | null): void => { worker.terminate(); resolve(surface); };
    worker.onmessage = (event: MessageEvent<SurfaceData>) => finish(event.data);
    worker.onerror = event => {
      event.preventDefault();
      console.warn(`[Hussite 3D] terrain worker failed, building on the main thread: ${event.message}`);
      finish(null);
    };
    worker.postMessage(terrainInput(snapshot));
  });
}

export class GeneratedTerrain implements BattleTerrain {
  public readonly group = new THREE.Group();
  public readonly interactiveMeshes: THREE.Object3D[] = [];
  public readonly field: TerrainRegions;
  public readonly layout: HexLayout;
  public readonly bounds: TerrainGround["bounds"];
  public readonly topography: TopographyPlan;
  /** Explored-but-unseen hexes are shaded in the vertex colours; overlays need not tint them. */
  public readonly shadesRememberedHexes = true;
  public readonly environmentPlan: EnvironmentPlan;
  /** Tvrz gate bridges with their deck heights; figures and overlays stand on the deck, not in the ditch below. */
  public moatBridges: BridgeDeck[] = [];
  private readonly ground: TerrainGround;
  private surfaceMesh!: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial[]>;
  private soilMaterial!: THREE.Material;
  private readonly surfaceTextures: THREE.Texture[] = [];
  private basePositions!: Float32Array;
  private baseColors!: Float32Array;
  private vertexKeys: Array<string | null> = [];
  private visibilityKey = "";
  private gridWidth = 0;
  private gridHeight = 0;
  private visualWeights = new Map<string, Float64Array>();
  /** Grid triangles split at a shore or road contour, keyed by `triangleKey` of their corners. */
  private surfaceTriangles = new Map<number, number[][]>();
  private waterIndices: number[] = [];
  private waterCellIndices = new Map<string, number[]>();

  public get terrainTypes(): readonly string[] { return this.field.terrainTypes; }

  public constructor(snapshot: BattleSnapshot, assetBase?: string, plan = planGeneratedTerrain(snapshot), surface?: SurfaceData | null) {
    this.ground = new TerrainGround(plan);
    ({ layout: this.layout, field: this.field, environmentPlan: this.environmentPlan, topography: this.topography,
      bounds: this.bounds } = this.ground);
    for (const issue of this.environmentPlan.settlement?.issues ?? []) console.warn(`[Hussite 3D] ${issue}`);
    this.group.name = `Generated ${snapshot.scenario ?? "battle"} landscape`;
    this.createSurface(surface ?? buildSurface(this.ground), assetBase);
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
    return this.ground.heightAt(x, z);
  }

  /** Depth of the wetland hollow at a point (see TerrainGround.puddleDip). */
  public puddleDip(x: number, z: number, weights?: TerrainWeights): number {
    return this.ground.puddleDip(x, z, weights);
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

  private triangleKey(a: number, b: number, c: number): number {
    return triangleKey(this.gridWidth * this.gridHeight, a, b, c);
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

  private createSurface(surface: SurfaceData, assetBase?: string): void {
    this.gridWidth = surface.gridWidth;
    this.gridHeight = surface.gridHeight;
    this.vertexKeys = surface.vertexKeys;
    this.visualWeights = surface.visualWeights;
    this.surfaceTriangles = surface.surfaceTriangles;
    this.waterIndices = surface.waterIndices;
    this.waterCellIndices = surface.waterCellIndices;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(surface.positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(surface.colors, 3));
    geometry.setAttribute(GROUND_SPLAT, new THREE.BufferAttribute(surface.splat, 3));
    geometry.setAttribute(SHORE_DISTANCE, new THREE.BufferAttribute(surface.shore, 1));
    geometry.setAttribute("uv", new THREE.BufferAttribute(surface.uvs, 2));
    if (surface.roadTrack) geometry.setAttribute(ROAD_TRACK, new THREE.BufferAttribute(surface.roadTrack, 2));
    geometry.setIndex(new THREE.BufferAttribute(surface.index, 1));
    for (const group of surface.groups) geometry.addGroup(group.start, group.count, group.materialIndex);
    geometry.setAttribute("normal", new THREE.BufferAttribute(surface.normals, 3));
    const snow = new THREE.Color(COLORS.plains).lerp(FROST_COLOR, .79);
    const look = createGeneratedSurfaceMaterials(assetBase, this.environmentPlan.winter, snow);
    this.soilMaterial = look.soil;
    if (this.environmentPlan.settlement) look.materials.push(new THREE.MeshStandardMaterial({
      name: "Settlement packed ground", color: 0xffffff, vertexColors: true, roughness: 1, side: THREE.DoubleSide,
    }));
    this.surfaceTextures.push(...look.textures);
    const mesh = new THREE.Mesh(geometry, look.materials);
    mesh.name = `Continuous terrain regions: ${this.field.terrainTypes.join(", ")}`;
    mesh.receiveShadow = true;
    this.surfaceMesh = mesh;
    this.basePositions = surface.positions.slice();
    this.baseColors = surface.colors.slice();
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
