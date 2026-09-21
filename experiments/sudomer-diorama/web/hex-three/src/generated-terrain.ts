import * as THREE from "three";
import { HexLayout } from "./hex-coordinates.ts";
import { createTerrainRegions, type TerrainRegions } from "./terrain-regions.ts";
import type { BattleSnapshot, TerrainSurface } from "./types.ts";

const COLORS: Record<string, number> = {
  plains: 0xacb273, forest: 0x45633c, hills: 0x858453, water: 0x4f918c,
  town: 0xa68768, road: 0xb7a47c, road2: 0x9d8b69, dam: 0xb9aa7b,
  mud: 0x725443, swamp: 0x66705a, slope: 0x837b59, trenches: 0x665342,
  church: 0x96826b,
};

export class GeneratedTerrain implements TerrainSurface {
  public readonly group = new THREE.Group();
  public readonly interactiveMeshes: THREE.Object3D[] = [];
  public readonly field: TerrainRegions;
  public readonly layout: HexLayout;
  public readonly bounds;
  private surfaceMesh!: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  private basePositions!: Float32Array;
  private baseColors!: Float32Array;
  private vertexKeys: Array<string | null> = [];
  private visibilityKey = "";
  private gridWidth = 0;
  private gridHeight = 0;
  private readonly visualWeights = new Map<string, Float32Array>();

  public constructor(snapshot: BattleSnapshot) {
    const cols = snapshot.cols ?? Math.max(...snapshot.tiles.map(tile => tile.col)) + 1;
    const rows = snapshot.rows ?? Math.max(...snapshot.tiles.map(tile => tile.row)) + 1;
    this.layout = new HexLayout(cols, rows);
    this.field = createTerrainRegions({ cols, rows, tiles: snapshot.tiles, scenario: snapshot.scenario ?? "battle",
      seed: snapshot.seed ?? 1, hexRadius: this.layout.radius, coreCoverage: 0.76, boundaryNoise: 0.75 });
    this.bounds = this.layout.bounds();
    this.group.name = `Generated ${snapshot.scenario ?? "battle"} landscape`;
    this.createSurface();
    this.createPlinth();
  }

  public heightAt(x: number, z: number): number {
    const input = this.field.heightInputAt(x, z);
    const terrain = this.field.classify(x, z);
    if (terrain === "water") return -0.52 + input.variation * 0.035;
    if (terrain === "road" || terrain === "road2" || terrain === "dam") return input.base + input.variation * 0.24;
    return input.base + input.variation * (0.42 + input.roughness * 0.34) * (1 - input.wetness * 0.45);
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
  }

  private createSurface(): void {
    const area = (this.bounds.maxX - this.bounds.minX) * (this.bounds.maxZ - this.bounds.minZ);
    const step = Math.max(0.36, Math.sqrt(area * 2 / 260_000));
    const nx = Math.ceil((this.bounds.maxX - this.bounds.minX) / step) + 1;
    const nz = Math.ceil((this.bounds.maxZ - this.bounds.minZ) / step) + 1;
    this.gridWidth = nx;
    this.gridHeight = nz;
    for (const terrain of this.field.terrainTypes) this.visualWeights.set(terrain, new Float32Array(nx * nz));
    const positions: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];
    const color = new THREE.Color();
    const sampleColor = new THREE.Color();
    for (let iz = 0; iz < nz; iz += 1) {
      for (let ix = 0; ix < nx; ix += 1) {
        const x = THREE.MathUtils.lerp(this.bounds.minX, this.bounds.maxX, ix / (nx - 1));
        const z = THREE.MathUtils.lerp(this.bounds.minZ, this.bounds.maxZ, iz / (nz - 1));
        positions.push(x, this.heightAt(x, z), z);
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
          sampleColor.setHex(COLORS[terrain] ?? 0x8d8b6a);
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
    for (let iz = 0; iz < nz - 1; iz += 1) {
      for (let ix = 0; ix < nx - 1; ix += 1) {
        const a = iz * nx + ix, b = a + 1, c = a + nx, d = c + 1;
        if ((ix + iz) % 2 === 0) indices.push(a, c, b, b, c, d);
        else indices.push(a, c, d, a, d, b);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
      color: 0xffffff, vertexColors: true, roughness: 0.9, metalness: 0, side: THREE.DoubleSide,
    }));
    mesh.name = `Continuous terrain regions: ${this.field.terrainTypes.join(", ")}`;
    mesh.receiveShadow = true;
    this.surfaceMesh = mesh;
    this.basePositions = Float32Array.from(positions);
    this.baseColors = Float32Array.from(colors);
    this.group.add(mesh);
    this.interactiveMeshes.push(mesh);
  }

  private createPlinth(): void {
    const width = this.bounds.maxX - this.bounds.minX;
    const depth = this.bounds.maxZ - this.bounds.minZ;
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(width + 0.8, 5.6, depth + 0.8),
      new THREE.MeshStandardMaterial({ color: 0x665540, roughness: 1 }));
    plinth.position.y = -3.2;
    plinth.name = "Layered battlefield soil plinth";
    plinth.receiveShadow = true;
    this.group.add(plinth);
  }
}
