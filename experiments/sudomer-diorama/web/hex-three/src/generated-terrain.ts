import * as THREE from "three";
import { createGeneratedSurfaceMaterials, surfaceMaterialIndex } from "./generated-materials.ts";
import { HexLayout } from "./hex-coordinates.ts";
import { createTerrainRegions, isFieldTerrain, type TerrainRegions } from "./terrain-regions.ts";
import { TopographyPlan } from "./topography.ts";
import type { BattleSnapshot, BattleTerrain } from "./types.ts";

const COLORS: Record<string, number> = {
  plains: 0xdfe6b3, forest: 0xb3c68f, hills: 0xcfce98, water: 0x78aaa4,
  town: 0xd1b99d, road: 0xd9c7a0, road2: 0xc7b28f, dam: 0xdacaa2,
  mud: 0xb28f78, swamp: 0x9ba589, slope: 0xc3b59b, trenches: 0xa88972,
  church: 0xcab79e, field: 0xddc47d, fields: 0xddc47d, farmland: 0xddc47d, cropland: 0xddc47d,
};

export class GeneratedTerrain implements BattleTerrain {
  public readonly group = new THREE.Group();
  public readonly interactiveMeshes: THREE.Object3D[] = [];
  public readonly field: TerrainRegions;
  public readonly layout: HexLayout;
  public readonly bounds;
  public readonly topography: TopographyPlan;
  private surfaceMesh!: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial[]>;
  private readonly surfaceTextures: THREE.Texture[] = [];
  private basePositions!: Float32Array;
  private baseColors!: Float32Array;
  private vertexKeys: Array<string | null> = [];
  private visibilityKey = "";
  private gridWidth = 0;
  private gridHeight = 0;
  private readonly visualWeights = new Map<string, Float32Array>();

  public get terrainTypes(): readonly string[] { return this.field.terrainTypes; }

  public constructor(snapshot: BattleSnapshot, assetBase?: string) {
    const cols = snapshot.cols ?? Math.max(...snapshot.tiles.map(tile => tile.col)) + 1;
    const rows = snapshot.rows ?? Math.max(...snapshot.tiles.map(tile => tile.row)) + 1;
    this.layout = new HexLayout(cols, rows);
    this.field = createTerrainRegions({ cols, rows, tiles: snapshot.tiles, scenario: snapshot.scenario ?? "battle",
      seed: snapshot.seed ?? 1, hexRadius: this.layout.radius, coreCoverage: 0.76, boundaryNoise: 0.75 });
    this.topography = new TopographyPlan(this.field);
    this.bounds = this.layout.bounds();
    this.group.name = `Generated ${snapshot.scenario ?? "battle"} landscape`;
    this.createSurface(assetBase);
    this.createPlinth();
  }

  public heightAt(x: number, z: number): number {
    const input = this.field.heightInputAt(x, z);
    const terrain = this.field.classify(x, z);
    const elevation = this.topography.elevationAt(x, z);
    const weights = this.field.weightsAt(x, z);
    const waterWeight = Object.entries(weights).reduce((total, [name, weight]) =>
      total + (["water", "river", "lake"].includes(name.toLowerCase()) ? weight : 0), 0);
    if (waterWeight > 0) {
      const dryVariation = (0.42 + input.roughness * 0.34) * (1 - input.wetness * 0.45);
      return elevation + input.variation * THREE.MathUtils.lerp(dryVariation, 0.035, waterWeight);
    }
    if (terrain === "road" || terrain === "road2" || terrain === "dam") return elevation + input.variation * 0.24;
    return elevation + input.variation * (0.42 + input.roughness * 0.34) * (1 - input.wetness * 0.45);
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

  /** Dominant terrain after the same vertex interpolation used by the rendered mesh. */
  public renderedTerrainAt(x: number, z: number): string | null {
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
    let result: string | null = null, maximum = -Infinity;
    for (const terrain of this.field.terrainTypes) {
      const weights = this.visualWeights.get(terrain)!;
      const weight = weights[vertices[0]]! * barycentric[0]
        + weights[vertices[1]]! * barycentric[1]
        + weights[vertices[2]]! * barycentric[2];
      if (weight > maximum) { maximum = weight; result = terrain; }
    }
    return result;
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
    for (const terrain of this.field.terrainTypes) this.visualWeights.set(terrain, new Float32Array(nx * nz));
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
        const weights = this.field.weightsAt(x, z);
        const vertexIndex = iz * nx + ix;
        for (const terrain of this.field.terrainTypes) {
          this.visualWeights.get(terrain)![vertexIndex] = weights[terrain] ?? 0;
        }
        color.set(0x000000);
        let total = 0;
        for (const [terrain, weight] of Object.entries(weights)) {
          sampleColor.setHex(COLORS[terrain.toLowerCase()] ?? 0x8d8b6a);
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
        const grain = 0.96 + 0.04 * Math.sin(x * 0.19 + z * 0.13);
        colors.push(color.r * grain, color.g * grain, color.b * grain);
      }
    }
    const materialIndices: number[][] = [[], [], [], [], []];
    const addTriangle = (a: number, b: number, c: number): void => {
      const x = (positions[a * 3]! + positions[b * 3]! + positions[c * 3]!) / 3;
      const z = (positions[a * 3 + 2]! + positions[b * 3 + 2]! + positions[c * 3 + 2]!) / 3;
      const terrain = this.field.classify(x, z) ?? "plains";
      materialIndices[surfaceMaterialIndex(terrain)]!.push(a, b, c);
    };
    for (let iz = 0; iz < nz - 1; iz += 1) {
      for (let ix = 0; ix < nx - 1; ix += 1) {
        const a = iz * nx + ix, b = a + 1, c = a + nx, d = c + 1;
        if ((ix + iz) % 2 === 0) { addTriangle(a, c, b); addTriangle(b, c, d); }
        else { addTriangle(a, c, d); addTriangle(a, d, b); }
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
    const surface = createGeneratedSurfaceMaterials(assetBase);
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
    const positions: number[] = [], colors: number[] = [], indices: number[] = [];
    const topColor = new THREE.Color(0x79684b), bottomColor = new THREE.Color(0x46382d);
    for (let index = 0; index < edgeIndices.length; index += 1) {
      const sourceIndex = edgeIndices[index]!;
      const x = surfacePositions.getX(sourceIndex), top = surfacePositions.getY(sourceIndex);
      const z = surfacePositions.getZ(sourceIndex);
      positions.push(x, top, z, x, -5.9, z);
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
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const skirt = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
      color: 0xffffff, vertexColors: true, roughness: 1, side: THREE.DoubleSide,
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
