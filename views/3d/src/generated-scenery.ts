import * as THREE from "three";
import type { BattleAssets } from "./assets.ts";
import { decorationSeed } from "./generated-meadow.ts";
import { EnvironmentDetails } from "./environment-details.ts";
import { mulberry32 } from "./geometry-utils.ts";
import type { GeneratedTerrain } from "./generated-terrain.ts";
import { SceneryVisibility } from "./scenery-visibility.ts";
import type { BattleScenery, BattleSnapshot } from "./types.ts";
import { TownWallScenery } from "./town-wall-scenery.ts";
import { batchStaticMeshes } from "./static-batching.ts";

export class GeneratedScenery implements BattleScenery {
  public readonly group = new THREE.Group();
  private disposed = false;
  private walls: TownWallScenery | null = null;
  private readonly visibility: SceneryVisibility;
  private readonly terrain: GeneratedTerrain;
  private readonly assets: Pick<BattleAssets, "preload" | "clone">;
  private readonly details = new EnvironmentDetails();
  private readonly phaseObjects: Array<{ object: THREE.Object3D; fromRound: number }> = [];

  public constructor(terrain: GeneratedTerrain, assets: Pick<BattleAssets, "preload" | "clone">, scenario: string | null = null) {
    this.terrain = terrain;
    this.assets = assets;
    this.group.name = `Terrain-derived scenery ${scenario ?? "battle"}`;
    this.visibility = new SceneryVisibility(terrain.layout);
  }

  public async build(): Promise<void> {
    const plan = this.terrain.environmentPlan;
    const needed = new Set(plan.placements.map(placement => placement.model));
    for (const cell of this.terrain.field.tiles) {
      if (cell.terrain === "forest") needed.add("procedural-worlds/pw_deciduous_02");
    }
    await this.assets.preload([...needed]);
    if (this.disposed) return;
    for (const cell of this.terrain.field.tiles) {
      if (this.disposed) return;
      if (plan.replacedCells.has(`${cell.col},${cell.row}`)) continue;
      const random = mulberry32(decorationSeed(this.terrain.field.seed, cell.col, cell.row, "terrain-models"));
      const placements = cell.terrain === "forest" ? 3 : 0;
      for (let index = 0; index < placements; index += 1) {
        const modelName = "procedural-worlds/pw_deciduous_02";
        const model = await this.assets.clone(modelName);
        if (this.disposed) return;
        if (plan.winter) {
          const leaves: THREE.Object3D[]=[];
          model.traverse(object=>{
            if(object.name.startsWith("tree-batch-") || object.name==="vegetation-ground-tufts-baked") leaves.push(object);
          });
          leaves.forEach(object=>object.removeFromParent());
        }
        const jitter = cell.terrain === "forest" ? 1.45 : 0.45;
        const x = cell.center.x + (random() - 0.5) * jitter * 2;
        const z = cell.center.z + (random() - 0.5) * jitter * 2;
        if (plan.placements.some(placement => Math.hypot(x-placement.x,z-placement.z)<2.7)) continue;
        model.position.set(x, this.terrain.heightAt(x, z), z);
        model.rotation.y = random() * Math.PI * 2;
        const scale = cell.terrain === "forest" ? 0.48 + random() * 0.16 : cell.terrain === "town" ? 0.62 : 0.72;
        model.scale.setScalar(scale);
        model.name = `${cell.terrain} ${cell.col},${cell.row} decoration ${index + 1}`;
        this.group.add(model);
        this.visibility.trackObject(model, x, z);
      }
    }
    for (const placement of plan.placements) {
      const model = await this.assets.clone(placement.model);
      if (this.disposed) return;
      let height=this.terrain.renderedHeightAt(placement.x, placement.z)+(placement.heightOffset ?? 0);
      if (placement.model === "bridge_approach" && plan.bridge) {
        height=this.terrain.renderedHeightAt(plan.bridge.x,plan.bridge.z)-1.15+(placement.heightOffset ?? 0);
      }
      model.position.set(placement.x,height,placement.z);
      model.rotation.y = placement.rotation;
      model.scale.set(placement.scale,placement.scale*(placement.heightScale ?? 1),placement.scale);
      model.name = placement.model;
      if (!placement.heightOffset) {
        if (placement.role === "fortification") this.details.seatModel(model,this.terrain);
        else if (/house|barn|shed|church|wing|shelter|platform/.test(placement.model)
          && !this.details.seatModel(model,this.terrain,.75)) continue;
      }
      const anchor=new THREE.Group(); anchor.name=placement.id;
      anchor.userData.environmentPlacement=placement;
      anchor.add(model); this.group.add(anchor);
      this.visibility.trackObject(anchor, placement.x, placement.z);
      if (placement.fromRound && placement.fromRound>1) {
        anchor.userData.dynamicEnvironment=true;
        this.phaseObjects.push({object:model,fromRound:placement.fromRound});
      }
    }
    if(plan.walls.length) {
      this.walls=new TownWallScenery(plan.walls,this.terrain,this.visibility);
      this.group.add(this.walls.group);
    }
    for(const wall of plan.walls) for(const issue of wall.issues) console.warn(`[Hussite 3D] ${issue}`);
    const batches=batchStaticMeshes(this.group,object=>{
      for(let parent:THREE.Object3D|null=object;parent;parent=parent.parent) {
        if(parent.userData.dynamicEnvironment) return null;
      }
      return this.visibility.keyForObject(object);
    });
    this.visibility.trackBatches(batches.batches);
    this.details.addIce(this.group,this.terrain,this.visibility);
  }

  public updateVisibility(snapshot: BattleSnapshot): void {
    this.visibility.update(snapshot);
    this.details.update(snapshot);
    for(const entry of this.phaseObjects) entry.object.visible=snapshot.round>=entry.fromRound;
  }

  public dispose(): void {
    this.disposed = true;
    this.visibility.clear();
    this.details.dispose();
    this.walls?.dispose();this.walls=null;
    this.phaseObjects.length=0;
    this.group.traverse(object=>{if(object instanceof THREE.InstancedMesh) object.dispose();});
    this.group.clear();
  }
}
