import * as THREE from "three";
import { BattleAssets } from "./assets.ts";
import { distanceToPolygon, distanceToPolyline, mulberry32, pointInPolygon } from "./geometry-utils.ts";
import { addLandscapeDetails } from "./landscape-details.ts";
import { SceneryVisibility } from "./scenery-visibility.ts";
import { AuthoredTerrain } from "./terrain.ts";
import type { BattleScenery, BattleSnapshot, ScenarioArtManifest } from "./types.ts";
import { batchStaticMeshes } from "./static-batching.ts";

export class AuthoredScenery implements BattleScenery {
  public readonly group = new THREE.Group();
  private disposed = false;
  private readonly visibility: SceneryVisibility;

  public constructor(
    private readonly data: ScenarioArtManifest,
    private readonly terrain: AuthoredTerrain,
    private readonly assets: BattleAssets,
  ) {
    this.group.name = "Authored scenery";
    this.visibility = new SceneryVisibility(terrain.layout);
  }

  public async build(): Promise<void> {
    await this.assets.preload([
      "broadleaf_olive", "broadleaf_gold", "cypress", "church", "farmhouse", "bridge",
      "procedural-worlds/pw_deciduous_01", "procedural-worlds/pw_deciduous_02",
      "procedural-worlds/pw_deciduous_03", "procedural-worlds/pw_shrub_01",
    ]);
    if (this.disposed) return;
    await Promise.all([this.addWoodland(), this.addLandmarks()]);
    if (this.disposed) return;
    this.addReeds();
    this.addStones();
    addLandscapeDetails(this.group, this.terrain, this.visibility);
    const result = batchStaticMeshes(this.group, object => this.visibility.keyForObject(object));
    this.visibility.trackBatches(result.batches);
    console.info(`[Sudomer] batched static scenery (${result.savedMeshes} meshes removed)`);
  }

  public updateVisibility(snapshot: BattleSnapshot): void {
    this.visibility.update(snapshot);
  }

  public dispose(): void { this.disposed = true; this.visibility.clear(); this.group.clear(); }

  private async addWoodland(): Promise<void> {
    const random = mulberry32(this.data.artSeed);
    for (const mass of this.data.woodlandMasses) {
      const xs = mass.points.map(([x]) => x);
      const zs = mass.points.map(([, z]) => z);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minZ = Math.min(...zs);
      const maxZ = Math.max(...zs);
      const area = Math.max(1, (maxX - minX) * (maxZ - minZ));
      const count = Math.round(area * mass.density * 0.075);
      for (let index = 0, attempts = 0; index < count && attempts < count * 20; attempts += 1) {
        const x = THREE.MathUtils.lerp(minX, maxX, random());
        const z = THREE.MathUtils.lerp(minZ, maxZ, random());
        if (!pointInPolygon(x, z, mass.points)) continue;
        if (this.data.clearings.some(clearing => pointInPolygon(x, z, clearing.points))) continue;
        if (distanceToPolyline(x, z, this.data.causeway.points) < 5.5) continue;
        const pick = random();
        const name = pick < 0.30 ? "procedural-worlds/pw_deciduous_01"
          : pick < 0.55 ? "procedural-worlds/pw_deciduous_02"
            : pick < 0.72 ? "procedural-worlds/pw_deciduous_03"
              : pick < 0.87 ? "broadleaf_olive"
                : pick < 0.96 ? "broadleaf_gold" : "cypress";
        const tree = await this.assets.clone(name);
        if (this.disposed) return;
        const scale = name.includes("pw_deciduous_01") ? THREE.MathUtils.lerp(0.64, 0.88, random())
          : name.includes("pw_deciduous_02") ? THREE.MathUtils.lerp(0.54, 0.72, random())
            : name.includes("pw_deciduous_03") ? THREE.MathUtils.lerp(0.44, 0.60, random())
              : name === "cypress" ? THREE.MathUtils.lerp(1.15, 1.65, random())
                : THREE.MathUtils.lerp(1.08, 1.55, random());
        tree.position.set(x, this.terrain.heightAt(x, z) - 0.06, z);
        tree.rotation.y = random() * Math.PI * 2;
        tree.scale.set(scale * THREE.MathUtils.lerp(0.9, 1.1, random()), scale, scale * THREE.MathUtils.lerp(0.9, 1.1, random()));
        tree.name = `${mass.id} tree ${index + 1}`;
        this.group.add(tree);
        this.visibility.trackObject(tree, x, z);
        index += 1;
      }
      const shrubCount = Math.max(6, Math.round(count * 0.42));
      for (let index = 0, attempts = 0; index < shrubCount && attempts < shrubCount * 20; attempts += 1) {
        const x = THREE.MathUtils.lerp(minX, maxX, random());
        const z = THREE.MathUtils.lerp(minZ, maxZ, random());
        if (!pointInPolygon(x, z, mass.points)
          || this.data.clearings.some(clearing => pointInPolygon(x, z, clearing.points))
          || distanceToPolyline(x, z, this.data.causeway.points) < 4.8) continue;
        const shrub = await this.assets.clone("procedural-worlds/pw_shrub_01");
        if (this.disposed) return;
        const scale = THREE.MathUtils.lerp(0.72, 1.18, random());
        shrub.position.set(x, this.terrain.heightAt(x, z), z);
        shrub.rotation.y = random() * Math.PI * 2;
        shrub.scale.setScalar(scale);
        shrub.name = `${mass.id} shrub ${index + 1}`;
        this.group.add(shrub);
        this.visibility.trackObject(shrub, x, z);
        index += 1;
      }
    }
  }

  private async addLandmarks(): Promise<void> {
    for (const placement of this.data.landmarks) {
      const model = await this.assets.clone(placement.kind);
      if (this.disposed) return;
      const [x, z] = placement.position;
      model.position.set(x, this.terrain.heightAt(x, z), z);
      model.rotation.y = placement.rotation ?? 0;
      model.scale.setScalar(placement.scale ?? 1);
      model.name = placement.id;
      this.group.add(model);
      this.visibility.trackObject(model, x, z);
    }
  }

  private addReeds(): void {
    const random = mulberry32(this.data.artSeed + 17);
    const geometry = new THREE.ConeGeometry(0.055, 1.2, 4);
    const material = new THREE.MeshStandardMaterial({ color: 0x7a783e, roughness: 1 });
    const reeds = new THREE.InstancedMesh(geometry, material, 420);
    reeds.name = "Pond and basin reeds";
    reeds.castShadow = true;
    const matrix = new THREE.Matrix4();
    const matrices: THREE.Matrix4[] = [];
    let instance = 0;
    for (let attempts = 0; attempts < 8000 && instance < reeds.count; attempts += 1) {
      const polygon = random() < 0.62 ? this.data.pond.points : this.data.mudBasin.points;
      const xs = polygon.map(([x]) => x);
      const zs = polygon.map(([, z]) => z);
      const x = THREE.MathUtils.lerp(Math.min(...xs), Math.max(...xs), random());
      const z = THREE.MathUtils.lerp(Math.min(...zs), Math.max(...zs), random());
      if (!pointInPolygon(x, z, polygon)) continue;
      if (distanceToPolygon(x, z, polygon) > (polygon === this.data.pond.points ? 1.7 : 2.5)) continue;
      const y = polygon === this.data.pond.points ? -0.48 : this.terrain.heightAt(x, z);
      const scale = THREE.MathUtils.lerp(0.55, 1.35, random());
      matrix.compose(new THREE.Vector3(x, y + 0.5 * scale, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), random() * Math.PI), new THREE.Vector3(scale, scale, scale));
      reeds.setMatrixAt(instance, matrix);
      matrices.push(matrix.clone());
      instance += 1;
    }
    reeds.count = instance;
    reeds.instanceMatrix.needsUpdate = true;
    this.group.add(reeds);
    this.visibility.trackInstances(reeds, matrices);
  }

  private addStones(): void {
    const random = mulberry32(this.data.artSeed + 41);
    const geometry = new THREE.DodecahedronGeometry(0.32, 0);
    const material = new THREE.MeshStandardMaterial({ color: 0x716b55, roughness: 1 });
    const stones = new THREE.InstancedMesh(geometry, material, 72);
    stones.name = "Scattered stones";
    stones.castShadow = true;
    stones.receiveShadow = true;
    const matrix = new THREE.Matrix4();
    const matrices: THREE.Matrix4[] = [];
    for (let i = 0; i < stones.count; i += 1) {
      const x = THREE.MathUtils.lerp(-66, 66, random());
      const z = THREE.MathUtils.lerp(-46, 47, random());
      const scale = THREE.MathUtils.lerp(0.55, 1.65, random());
      matrix.compose(new THREE.Vector3(x, this.terrain.heightAt(x, z) + 0.13 * scale, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(random(), random() * Math.PI, random())), new THREE.Vector3(scale * 1.3, scale * 0.65, scale));
      stones.setMatrixAt(i, matrix);
      matrices.push(matrix.clone());
    }
    stones.instanceMatrix.needsUpdate = true;
    this.group.add(stones);
    this.visibility.trackInstances(stones, matrices);
  }
}
