import * as THREE from "three";
import { BattleAssets } from "./assets.ts";
import { HexLayout } from "./hex-coordinates.ts";
import type { BattleSnapshot, TerrainSurface, UnitSnapshot } from "./types.ts";

interface UnitVisual { root: THREE.Group; hit: THREE.Mesh; revision: number }

function displayRecipe(unit: UnitSnapshot): { model: string; offsets: Array<[number, number]>; scale: number } {
  if (unit.type === "VOZOVA_HRADBA") return { model: "war_wagon", offsets: [[0, 0]], scale: 1.1 };
  if (["JIZDA_HUSITI", "TEZKY_RYTIR", "TEZKOODENCI"].includes(unit.type)) {
    return { model: "cavalry", offsets: [[-0.82, -0.34], [0.74, 0.38]], scale: 0.98 };
  }
  if (["JAN_ZIZKA", "BOHUSLAV_SVAMBERK"].includes(unit.type)) return { model: "infantry_shield", offsets: [[0, 0]], scale: 1.28 };
  if (unit.type === "VACLAV_KORANDA") return { model: "infantry_handgun", offsets: [[0, 0]], scale: 1.24 };
  const model = unit.type === "RUCNICARI" ? "infantry_handgun"
    : ["KUSINICI_HUSITI", "KUSNICI"].includes(unit.type) ? "infantry_shield"
      : "infantry_polearm";
  return { model, offsets: [[-1.02, 0.5], [0, -0.66], [1.02, 0.5], [-0.52, -0.1], [0.52, -0.1]], scale: 1.15 };
}

export class UnitPresentation {
  public readonly group = new THREE.Group();
  public readonly hitTargets: THREE.Object3D[] = [];
  private readonly visuals = new Map<number, UnitVisual>();
  private disposed = false;
  private updateRevision = 0;

  public constructor(private readonly terrain: TerrainSurface, private readonly layout: HexLayout, private readonly assets: BattleAssets) {
    this.group.name = "Visible battle formations";
  }

  public async update(snapshot: BattleSnapshot): Promise<void> {
    const revision = ++this.updateRevision;
    const visibleIds = new Set(snapshot.units.map(unit => unit.id));
    for (const [id, visual] of this.visuals) {
      if (!visibleIds.has(id)) {
        this.group.remove(visual.root);
        this.hitTargets.splice(this.hitTargets.indexOf(visual.hit), 1);
        this.visuals.delete(id);
      }
    }
    await Promise.all(snapshot.units.map(unit => this.updateUnit(unit, snapshot.selectedUnitId === unit.id, revision)));
  }

  public worldPosition(unitId: number): THREE.Vector3 | null {
    return this.visuals.get(unitId)?.root.position.clone() ?? null;
  }

  public unitIdFromHit(object: THREE.Object3D): number | null {
    const id = object.userData.unitId;
    return Number.isInteger(id) ? id : null;
  }

  public dispose(): void { this.disposed = true; this.updateRevision += 1; }

  private async updateUnit(unit: UnitSnapshot, selected: boolean, revision: number): Promise<void> {
    let visual = this.visuals.get(unit.id);
    if (!visual) {
      const root = new THREE.Group();
      root.name = `${unit.name} (${unit.id})`;
      const recipe = displayRecipe(unit);
      const prototype = await this.assets.load(recipe.model);
      if (this.disposed || revision !== this.updateRevision || this.visuals.has(unit.id)) return;
      const facing = unit.faction === "hussites" ? -Math.PI / 2 : Math.PI / 2;
      for (const [offsetX, offsetZ] of recipe.offsets) {
        const figure = prototype.clone(true);
        figure.position.set(offsetX, 0.08, offsetZ);
        figure.rotation.y = facing;
        figure.scale.setScalar(recipe.scale);
        root.add(figure);
        const contact = new THREE.Mesh(
          new THREE.CircleGeometry(recipe.model === "cavalry" ? 0.92 : recipe.model === "war_wagon" ? 1.6 : 0.58, 18),
          new THREE.MeshBasicMaterial({ color: 0x15120d, transparent: true, opacity: 0.24, depthWrite: false }),
        );
        contact.rotation.x = -Math.PI / 2;
        contact.position.set(offsetX, 0.035, offsetZ);
        root.add(contact);
      }
      if (unit.unitClass === "commander") {
        const banner = await this.assets.clone("banner");
        banner.position.set(-1.15, 0.05, -0.45);
        banner.scale.setScalar(0.7);
        root.add(banner);
      }
      const hit = new THREE.Mesh(
        new THREE.CylinderGeometry(2.15, 2.15, 4.5, 12),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
      );
      hit.position.y = 2;
      hit.userData.unitId = unit.id;
      root.add(hit);
      visual = { root, hit, revision };
      this.visuals.set(unit.id, visual);
      this.hitTargets.push(hit);
      this.group.add(root);
    }
    const center = this.layout.center(unit.col, unit.row);
    visual.root.position.set(center.x, this.terrain.heightAt(center.x, center.z) + 0.04, center.z);
    visual.root.scale.setScalar(unit.isRouting ? 0.92 : 1);
    visual.root.rotation.y = unit.marching ? 0.06 : 0;
    visual.root.traverse(object => {
      if (object instanceof THREE.Mesh && object.material instanceof THREE.MeshBasicMaterial && object.material.opacity > 0) {
        object.material.opacity = selected ? 0.38 : 0.24;
      }
    });
    visual.revision = revision;
  }
}
