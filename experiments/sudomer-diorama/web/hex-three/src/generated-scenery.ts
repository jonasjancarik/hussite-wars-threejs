import * as THREE from "three";
import { BattleAssets } from "./assets.ts";
import { mulberry32 } from "./geometry-utils.ts";
import { GeneratedTerrain } from "./generated-terrain.ts";
import type { BattleSnapshot } from "./types.ts";

export class GeneratedScenery {
  public readonly group = new THREE.Group();
  private disposed = false;
  private readonly placements: Array<{ object: THREE.Object3D; key: string }> = [];

  public constructor(private readonly terrain: GeneratedTerrain, private readonly assets: BattleAssets) {
    this.group.name = "Terrain-derived scenery";
  }

  public async build(): Promise<void> {
    const needed = new Set<string>();
    for (const cell of this.terrain.field.tiles) {
      if (cell.terrain === "forest") needed.add("procedural-worlds/pw_deciduous_02");
      if (cell.terrain === "town") needed.add("farmhouse");
      if (cell.terrain === "church") needed.add("church");
      if (cell.terrain === "trenches") needed.add("stakes");
    }
    await this.assets.preload([...needed]);
    if (this.disposed) return;
    const random = mulberry32(this.terrain.field.seed ^ 0x51f15e);
    for (const cell of this.terrain.field.tiles) {
      if (this.disposed) return;
      const placements = cell.terrain === "forest" ? 3 : ["town", "church", "trenches"].includes(cell.terrain) ? 1 : 0;
      for (let index = 0; index < placements; index += 1) {
        const modelName = cell.terrain === "forest" ? "procedural-worlds/pw_deciduous_02"
          : cell.terrain === "church" ? "church" : cell.terrain === "trenches" ? "stakes" : "farmhouse";
        const model = await this.assets.clone(modelName);
        if (this.disposed) return;
        const jitter = cell.terrain === "forest" ? 1.45 : 0.45;
        const x = cell.center.x + (random() - 0.5) * jitter * 2;
        const z = cell.center.z + (random() - 0.5) * jitter * 2;
        model.position.set(x, this.terrain.heightAt(x, z), z);
        model.rotation.y = random() * Math.PI * 2;
        const scale = cell.terrain === "forest" ? 0.48 + random() * 0.16 : cell.terrain === "town" ? 0.62 : 0.72;
        model.scale.setScalar(scale);
        model.name = `${cell.terrain} ${cell.col},${cell.row} decoration ${index + 1}`;
        this.group.add(model);
        this.placements.push({ object: model, key: `${cell.col},${cell.row}` });
      }
    }
  }

  public updateVisibility(snapshot: BattleSnapshot): void {
    const explored = new Set(snapshot.exploredHexes);
    for (const placement of this.placements) {
      placement.object.visible = !snapshot.fogOfWar || explored.has(placement.key);
    }
  }

  public dispose(): void { this.disposed = true; this.placements.length = 0; this.group.clear(); }
}
