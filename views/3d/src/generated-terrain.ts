import * as THREE from "three";
import { createGeneratedSurfaceMaterials, surfaceMaterialIndex } from "./generated-materials.ts";
import { HexLayout } from "./hex-coordinates.ts";
import { createTerrainRegions, isFieldTerrain, isWaterTerrain, type TerrainRegions } from "./terrain-regions.ts";
import { TopographyPlan } from "./topography.ts";
import type { BattleSnapshot, BattleTerrain } from "./types.ts";
import { bridgeRelief, earthworkRelief, planEnvironment, type EnvironmentPlan } from "./environment-plan.ts";
import { nearestOnStreet } from "./settlement-plan.ts";
import { clipPolygon, triangulatePolygon } from "./water-geometry.ts";

const COLORS: Record<string, number> = {
  plains: 0xdfe6b3, forest: 0xb3c68f, hills: 0xcfce98, water: 0x78aaa4,
  town: 0xd1b99d, road: 0xd9c7a0, road2: 0xc7b28f, dam: 0xdacaa2,
  mud: 0xb28f78, swamp: 0x9ba589, slope: 0xc3b59b, trenches: 0xa88972,
  church: 0xcab79e, field: 0xddc47d, fields: 0xddc47d, farmland: 0xddc47d, cropland: 0xddc47d,
};
const FROST_COLOR = new THREE.Color(0xe2e5dc);

export class GeneratedTerrain implements BattleTerrain {
  public readonly group = new THREE.Group();
  public readonly interactiveMeshes: THREE.Object3D[] = [];
  public readonly field: TerrainRegions;
  public readonly layout: HexLayout;
  public readonly bounds;
  public readonly topography: TopographyPlan;
  public readonly environmentPlan: EnvironmentPlan;
  private bridgeBaseHeight = 0;
  private surfaceMesh!: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial[]>;
  private readonly surfaceTextures: THREE.Texture[] = [];
  private basePositions!: Float32Array;
  private baseColors!: Float32Array;
  private vertexKeys: Array<string | null> = [];
  private visibilityKey = "";
  private gridWidth = 0;
  private gridHeight = 0;
  private readonly visualWeights = new Map<string, number[]>();
  private readonly shorelineTriangles = new Map<string, number[][]>();
  private waterIndices: number[] = [];
  private readonly waterCellIndices = new Map<string, number[]>();

  public get terrainTypes(): readonly string[] { return this.field.terrainTypes; }

  public constructor(snapshot: BattleSnapshot, assetBase?: string) {
    const cols = snapshot.cols ?? Math.max(...snapshot.tiles.map(tile => tile.col)) + 1;
    const rows = snapshot.rows ?? Math.max(...snapshot.tiles.map(tile => tile.row)) + 1;
    this.layout = new HexLayout(cols, rows);
    this.field = createTerrainRegions({ cols, rows, tiles: snapshot.tiles, scenario: snapshot.scenario ?? "battle",
      seed: snapshot.seed ?? 1, hexRadius: this.layout.radius, coreCoverage: 0.76, boundaryNoise: 0.75 });
    this.environmentPlan = planEnvironment(snapshot.scenario, this.field.tiles);
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
  }

  public heightAt(x: number, z: number): number {
    const input = this.field.heightInputAt(x, z);
    const terrain = this.field.classify(x, z);
    const elevation = this.topography.elevationAt(x, z);
    const relief = earthworkRelief(x, z, this.environmentPlan.earthworks);
    const weights = this.field.weightsAt(x, z);
    const waterWeight = Object.entries(weights).reduce((total, [name, weight]) =>
      total + (["water", "river", "lake"].includes(name.toLowerCase()) ? weight : 0), 0);
    const dryWeight = Math.max(0, ...Object.entries(weights).filter(([name])=>!isWaterTerrain(name)).map(([,weight])=>weight));
    if (waterWeight > 0 && waterWeight >= dryWeight) return -.7;
    const crossing = terrain === "road" || terrain === "road2" || terrain === "dam";
    const variation = crossing ? .24 : (0.42 + input.roughness * 0.34) * (1 - input.wetness * 0.45);
    const bank = THREE.MathUtils.smoothstep(Math.max(waterWeight, crossing ? 0 : this.field.waterInfluenceAt(x,z)), 0, .5);
    const ground=THREE.MathUtils.lerp(elevation + input.variation * variation, -.7, bank) + relief;
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

  public updateVisibility(snapshot: BattleSnapshot): void {
    const signature = snapshot.fogOfWar
      ? `fog:${[...snapshot.exploredHexes].sort().join("|")}:${[...snapshot.visibleHexes].sort().join("|")}`
      : "clear";
    if (signature === this.visibilityKey) return;
    this.visibilityKey = signature;
    const positions = this.surfaceMesh.geometry.getAttribute("position") as THREE.BufferAttribute;
    const colors = this.surfaceMesh.geometry.getAttribute("color") as THREE.BufferAttribute;
    const explored = new Set(snapshot.exploredHexes);
    const visible = new Set(snapshot.visibleHexes);
    const fog = new THREE.Color(0xa5a58f);
    const shaded = new THREE.Color();
    for (let index = 0; index < positions.count; index += 1) {
      const offset = index * 3;
      const key = this.vertexKeys[index];
      let r = this.baseColors[offset]!, g = this.baseColors[offset + 1]!, b = this.baseColors[offset + 2]!;
      if (snapshot.fogOfWar && (!key || !explored.has(key))) {
        r = fog.r; g = fog.g; b = fog.b;
      } else if (snapshot.fogOfWar && key && !visible.has(key)) {
        shaded.setRGB(r, g, b).lerp(fog, 0.45);
        r = shaded.r; g = shaded.g; b = shaded.b;
      }
      positions.setY(index, this.basePositions[offset + 1]!);
      colors.setXYZ(index, r, g, b);
    }
    positions.needsUpdate = true;
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
    const shoreline = this.shorelineTriangles.get([...vertices].sort((a,b)=>a-b).join(","));
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
    if (!sample) return this.heightAt(x, z);
    return sample.vertices.reduce((height, vertex, index) =>
      height + this.basePositions[vertex * 3 + 1]! * sample.barycentric[index]!, 0);
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
    this.shorelineTriangles.clear();
    this.waterIndices.length=0;
    this.waterCellIndices.clear();
    for (const texture of this.surfaceTextures) texture.dispose();
    this.surfaceTextures.length = 0;
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
        let weights = this.field.weightsAt(x, z);
        if (Object.keys(weights).length === 0) {
          // Continue the nearest terrain to the diorama rim. An empty weight
          // vector must never count as water through a 0 >= 0 comparison.
          let nearest=this.field.tiles[0]!, minimum=Infinity;
          for(const cell of this.field.tiles) {
            const distance=(x-cell.center.x)**2+(z-cell.center.z)**2;
            if(distance<minimum) {minimum=distance;nearest=cell;}
          }
          weights={[nearest.terrain]:1};
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
        const grain = 0.96 + 0.04 * Math.sin(x * 0.19 + z * 0.13);
        colors.push(color.r * grain, color.g * grain, color.b * grain);
      }
    }
    const materialIndices: number[][] = [[], [], [], [], [], []];
    const waterTypes=this.field.terrainTypes.filter(isWaterTerrain);
    const dryTypes=this.field.terrainTypes.filter(name=>!isWaterTerrain(name));
    const waterAt=(index:number):number=>waterTypes.reduce((total,name)=>total+this.visualWeights.get(name)![index]!,0);
    const margin=(index:number,dry:string):number=>waterAt(index)-this.visualWeights.get(dry)![index]!;
    const crossings=new Map<string,number>();
    const intersect=(a:number,b:number,dry:string):number=>{
      const key=`${dry}:${[a,b].sort((a,b)=>a-b).join(",")}`;
      const known=crossings.get(key); if(known!==undefined) return known;
      const t=margin(a,dry)/(margin(a,dry)-margin(b,dry)), index=positions.length/3;
      const x=THREE.MathUtils.lerp(positions[a*3]!,positions[b*3]!,t);
      const z=THREE.MathUtils.lerp(positions[a*3+2]!,positions[b*3+2]!,t);
      positions.push(x,-.7,z);
      for(let axis=0;axis<3;axis++) colors.push(THREE.MathUtils.lerp(colors[a*3+axis]!,colors[b*3+axis]!,t));
      for(let axis=0;axis<2;axis++) uvs.push(THREE.MathUtils.lerp(uvs[a*2+axis]!,uvs[b*2+axis]!,t));
      for(const weights of this.visualWeights.values()) weights.push(THREE.MathUtils.lerp(weights[a]!,weights[b]!,t));
      const coord=this.layout.coordAt(x,z); this.vertexKeys.push(coord ? `${coord.col},${coord.row}` : null);
      crossings.set(key,index); return index;
    };
    const cut=(polygon:number[],dry:string,keepWater:boolean):number[]=>{
      const result:number[]=[];
      for(let i=0;i<polygon.length;i++) {
        const a=polygon[i]!,b=polygon[(i+1)%polygon.length]!;
        const insideA=margin(a,dry)>=0,insideB=margin(b,dry)>=0;
        if(insideA===keepWater) result.push(a);
        if(insideA!==insideB) result.push(intersect(a,b,dry));
      }
      return result;
    };
    const dryMaterial=(triangle:number[]):number=>{
      const dry=[...dryTypes].sort((a,b)=>triangle.reduce((sum,v)=>sum+this.visualWeights.get(b)![v]!-this.visualWeights.get(a)![v]!,0))[0] ?? "plains";
      return dry==="town" && this.environmentPlan.settlement ? 5 : surfaceMaterialIndex(dry);
    };
    const addTriangle = (a: number, b: number, c: number): void => {
      const original=[a,b,c];
      if(original.every(index=>waterAt(index)<=1e-12)) { materialIndices[dryMaterial(original)]!.push(a,b,c);return; }
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
            materialIndices[water ? 4 : dryMaterial(triangle)]!.push(...triangle); pieces.push(triangle);
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
        this.shorelineTriangles.set([...original].sort((a,b)=>a-b).join(","),pieces);
        return;
      }
      materialIndices[dryMaterial(original)]!.push(a,b,c);
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
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    let groupStart = 0;
    materialIndices.forEach((bucket, materialIndex) => {
      if (bucket.length > 0) geometry.addGroup(groupStart, bucket.length, materialIndex);
      groupStart += bucket.length;
    });
    geometry.computeVertexNormals();
    const surface = createGeneratedSurfaceMaterials(assetBase, this.environmentPlan.winter);
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
    const positions: number[] = [], colors: number[] = [], indices: number[] = [], uvs: number[] = [];
    const topColor = new THREE.Color(0xc7b492), bottomColor = new THREE.Color(0x9b8266);
    let perimeterDistance = 0;
    for (let index = 0; index < edgeIndices.length; index += 1) {
      const sourceIndex = edgeIndices[index]!;
      const x = surfacePositions.getX(sourceIndex), top = surfacePositions.getY(sourceIndex);
      const z = surfacePositions.getZ(sourceIndex);
      if (index > 0) {
        const previous = edgeIndices[index - 1]!;
        perimeterDistance += Math.hypot(x - surfacePositions.getX(previous), z - surfacePositions.getZ(previous));
      }
      positions.push(x, top, z, x, -5.9, z);
      uvs.push(perimeterDistance / 8, top / 8, perimeterDistance / 8, -5.9 / 8);
      const variation = 0.94 + 0.06 * Math.sin(index * 0.43);
      colors.push(topColor.r * variation, topColor.g * variation, topColor.b * variation,
        bottomColor.r * variation, bottomColor.g * variation, bottomColor.b * variation);
      if (index < edgeIndices.length - 1) {
        const a = index * 2, b = a + 2;
        indices.push(a, a + 1, b, b, a + 1, b + 1);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const skirt = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
      color: 0xffffff, vertexColors: true, roughness: 1, side: THREE.DoubleSide,
      map: this.surfaceMesh.material[3]!.map,
    }));
    skirt.name = "Topography-following layered battlefield soil plinth";
    skirt.receiveShadow = true;
    const width = maxX - minX, depth = maxZ - minZ;
    const base = new THREE.Mesh(new THREE.BoxGeometry(width + 0.8, 0.5, depth + 0.8),
      new THREE.MeshStandardMaterial({ color: 0x46382d, roughness: 1 }));
    base.position.y = -6.1;
    base.name = "Battlefield plinth base";
    base.receiveShadow = true;
    this.group.add(skirt, base);
  }
}
