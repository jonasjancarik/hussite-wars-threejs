import * as THREE from "three";
import type { BattleAssets } from "./assets.ts";
import { HexLayout } from "./hex-coordinates.ts";
import type { BattleSnapshot, TerrainSurface, UnitSnapshot } from "./types.ts";

interface GroundedFigure { object: THREE.Object3D; bottom: number }
interface UnitVisual { root: THREE.Group; hit: THREE.Mesh; figures: GroundedFigure[]; revision: number }

const TEAM_MATERIAL_COLORS = {
  hussites: { team_cloth: 0x9b4f4f, team_paint: 0x7f3f3b },
  crusaders: { team_cloth: 0x587493, team_paint: 0x3f5872 },
} as const;
const TEAM_MATERIAL_NAMES = new Set(["team_cloth", "team_paint"]);

function displayRecipe(unit: UnitSnapshot): { model: string; offsets: Array<[number, number]>; scale: number } {
  if (unit.type === "VOZOVA_HRADBA") return { model: "war_wagon", offsets: [[0, 0]], scale: 1.1 };
  if (["JIZDA_HUSITI", "TEZKY_RYTIR", "TEZKOODENCI"].includes(unit.type)) {
    return { model: "cavalry", offsets: [[-0.82, -0.34], [0.74, 0.38]], scale: 0.98 };
  }
  if (["JAN_ZIZKA", "BOHUSLAV_SVAMBERK"].includes(unit.type)) return { model: "infantry_shield", offsets: [[0, 0]], scale: 1.28 };
  if (unit.type === "VACLAV_KORANDA") return { model: "infantry_handgun", offsets: [[0, 0]], scale: 1.24 };
  const model = unit.type === "RUCNICARI" ? "infantry_handgun"
    : ["CEPNICI", "CEPNICI_PRASKY"].includes(unit.type) ? "infantry_flail"
      : ["KUSINICI_HUSITI", "KUSNICI", "KUSNICI_JANOV", "KUSINICI_PRASKY"].includes(unit.type) ? "infantry_crossbow"
        : ["PAVEZNICI", "PAVEZNICI_KRIZACI"].includes(unit.type) ? "infantry_pavise"
      : "infantry_polearm";
  return { model, offsets: [[-1.02, 0.5], [0, -0.66], [1.02, 0.5], [-0.52, -0.1], [0.52, -0.1]], scale: 1.15 };
}

export class UnitPresentation {
  public readonly group = new THREE.Group();
  public readonly hitTargets: THREE.Object3D[] = [];
  private readonly visuals = new Map<number, UnitVisual>();
  private disposed = false;
  private updateRevision = 0;
  private readonly terrain: TerrainSurface;
  private readonly layout: HexLayout;
  private readonly assets: Pick<BattleAssets, "load" | "clone">;
  private readonly variants = new Map<string, Promise<THREE.Group>>();
  private readonly ownedMaterials = new Set<THREE.Material>();

  public constructor(terrain: TerrainSurface, layout: HexLayout, assets: Pick<BattleAssets, "load" | "clone">) {
    this.terrain = terrain;
    this.layout = layout;
    this.assets = assets;
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
    await Promise.all(snapshot.units.map(unit => this.updateUnit(unit, revision)));
  }

  public worldPosition(unitId: number): THREE.Vector3 | null {
    return this.visuals.get(unitId)?.root.position.clone() ?? null;
  }

  public unitIdFromHit(object: THREE.Object3D): number | null {
    const id = object.userData.unitId;
    return Number.isInteger(id) ? id : null;
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.updateRevision += 1;
    for (const material of this.ownedMaterials) material.dispose();
    this.ownedMaterials.clear();
    this.variants.clear();
  }

  private async updateUnit(unit: UnitSnapshot, revision: number): Promise<void> {
    let visual = this.visuals.get(unit.id);
    if (!visual) {
      const root = new THREE.Group();
      root.name = `${unit.name} (${unit.id})`;
      const recipe = displayRecipe(unit);
      const prototype = await this.variant(recipe.model, unit.faction);
      if (this.disposed || revision !== this.updateRevision || this.visuals.has(unit.id)) return;
      const facing = unit.faction === "hussites" ? -Math.PI / 2 : Math.PI / 2;
      const figures: GroundedFigure[] = [];
      for (const [offsetX, offsetZ] of recipe.offsets) {
        const figure = prototype.clone(true);
        figure.position.set(offsetX, 0, offsetZ);
        figure.rotation.y = facing;
        figure.scale.setScalar(recipe.scale);
        figures.push({ object: figure, bottom: new THREE.Box3().setFromObject(figure).min.y });
        root.add(figure);
      }
      if (unit.unitClass === "commander") {
        const banner = await this.assets.clone("banner");
        banner.position.set(-1.15, 0, -0.45);
        banner.scale.setScalar(0.7);
        figures.push({ object: banner, bottom: new THREE.Box3().setFromObject(banner).min.y });
        root.add(banner);
      }
      const hit = new THREE.Mesh(
        new THREE.CylinderGeometry(2.15, 2.15, 4.5, 12),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
      );
      hit.position.y = 2;
      // Raycaster still intersects invisible meshes. Keep the picking volume
      // out of every render attachment, including the post-processing normals.
      hit.visible = false;
      hit.userData.unitId = unit.id;
      root.add(hit);
      visual = { root, hit, figures, revision };
      this.visuals.set(unit.id, visual);
      this.hitTargets.push(hit);
      this.group.add(root);
    }
    const center = this.layout.center(unit.col, unit.row);
    const heightAt = (x: number, z: number): number => this.terrain.renderedHeightAt?.(x, z) ?? this.terrain.heightAt(x, z);
    visual.root.position.set(center.x, heightAt(center.x, center.z), center.z);
    visual.root.scale.setScalar(unit.isRouting ? 0.92 : 1);
    visual.root.rotation.y = unit.marching ? 0.06 : 0;
    visual.root.updateMatrixWorld(true);
    for (const { object, bottom } of visual.figures) {
      const world = visual.root.localToWorld(new THREE.Vector3(object.position.x, 0, object.position.z));
      object.position.y = (heightAt(world.x, world.z) - visual.root.position.y) / visual.root.scale.y - bottom;
    }
    visual.root.updateMatrixWorld(true);
    visual.revision = revision;
  }

  private variant(model: string, faction: UnitSnapshot["faction"]): Promise<THREE.Group> {
    const key = `${model}:${faction}`;
    let variant = this.variants.get(key);
    if (!variant) {
      variant = this.assets.load(model).then(prototype => {
        const materials = new Map<THREE.Material, THREE.Material>();
        const result = prototype.clone(true);
        result.traverse(object => {
          const mesh = object as THREE.Mesh;
          if (!mesh.isMesh) return;
          const sourceMaterials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          const mappedMaterials = sourceMaterials.map(source => {
            if (!TEAM_MATERIAL_NAMES.has(source.name)) return source;
            let recolored = materials.get(source);
            if (!recolored) {
              recolored = source.clone();
              const color = (recolored as THREE.Material & { color?: THREE.Color }).color;
              if (color) color.setHex(TEAM_MATERIAL_COLORS[faction][source.name as "team_cloth" | "team_paint"]);
              materials.set(source, recolored);
              if (this.disposed) recolored.dispose();
              else this.ownedMaterials.add(recolored);
            }
            return recolored;
          });
          mesh.material = Array.isArray(mesh.material) ? mappedMaterials : mappedMaterials[0]!;
        });
        return result;
      });
      this.variants.set(key, variant);
    }
    return variant;
  }
}
