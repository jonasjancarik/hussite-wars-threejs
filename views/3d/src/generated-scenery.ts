import * as THREE from "three";
import type { BattleAssets } from "./assets.ts";
import { EnvironmentDetails } from "./environment-details.ts";
import type { GeneratedTerrain } from "./generated-terrain.ts";
import { SceneryVisibility } from "./scenery-visibility.ts";
import type { BattleScenery, BattleSnapshot } from "./types.ts";
import { TownWallScenery } from "./town-wall-scenery.ts";
import { batchStaticMeshes, INSTANCE_TINT } from "./static-batching.ts";
import { planWoodland } from "./woodland-plan.ts";
import { createTuftMesh, planTufts } from "./ground-tufts.ts";

const FOLIAGE_MATERIALS = new Set(["olive", "olive_light", "gold", "cypress"]);
/** Leaf meshes of the shared tree kit; trunks and branches are left untinted. */
function isFoliage(mesh: THREE.Mesh): boolean {
  if (mesh.name.startsWith("tree-batch-") || mesh.name.startsWith("shrub-batch-")) return true;
  const material = mesh.material as THREE.Material | THREE.Material[];
  return !Array.isArray(material) && FOLIAGE_MATERIALS.has(material.name);
}

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
    const woodland = planWoodland({ field: this.terrain.field, layout: this.terrain.layout, winter: plan.winter,
      replacedCells: plan.replacedCells, obstacles: plan.placements });
    for (const placement of woodland) needed.add(placement.model);
    await this.assets.preload([...needed]);
    if (this.disposed) return;
    for (const [index, placement] of woodland.entries()) {
      const model = await this.assets.clone(placement.model);
      if (this.disposed) return;
      const bare: THREE.Object3D[] = [];
      model.traverse(object => {
        if (!(object instanceof THREE.Mesh)) return;
        if (plan.winter && (object.name.startsWith("tree-batch-") || object.name === "vegetation-ground-tufts-baked")) {
          bare.push(object);
        } else if (isFoliage(object)) object.userData[INSTANCE_TINT] = placement.tint;
      });
      bare.forEach(object => object.removeFromParent());
      // Sink the root flare slightly so trunks meet sloping ground.
      model.position.set(placement.x, this.terrain.heightAt(placement.x, placement.z) - .06, placement.z);
      model.rotation.y = placement.rotation;
      model.scale.setScalar(placement.scale);
      model.name = `${placement.model} ${placement.col},${placement.row} woodland ${index + 1}`;
      this.group.add(model);
      this.visibility.trackObject(model, placement.x, placement.z);
    }
    if (!plan.winter) {
      const tufts = planTufts({ field: this.terrain.field, layout: this.terrain.layout, replacedCells: plan.replacedCells,
        features: [...woodland, ...plan.placements] });
      if (tufts.length) {
        const { mesh, matrices } = createTuftMesh(tufts, (x, z) => this.terrain.heightAt(x, z));
        this.group.add(mesh);
        this.visibility.trackInstances(mesh, matrices);
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
