import * as THREE from "three";
import type { BattleSnapshot, HexCoord, UnitSnapshot } from "./types.ts";
import { visibleSnapshotUnits } from "./unit-visibility.ts";

export const CASUALTY_FADE_MS = 460;

interface Casualty extends HexCoord {
  unitId: number;
  faction: UnitSnapshot["faction"];
  object: THREE.Object3D;
  materials: Map<THREE.Material, number>;
  age: number;
  initialY: number;
}

/** Short-lived visual copies. Geometry/textures stay owned by BattleAssets. */
export class CasualtyFades {
  public readonly group = new THREE.Group();
  private readonly fading = new Set<Casualty>();
  private enabled = true;

  public constructor() { this.group.name = "Casualty fades"; }

  public get active(): boolean { return this.fading.size > 0; }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.clear();
  }

  public add(source: THREE.Object3D, unit: Pick<UnitSnapshot, "id" | "faction" | "col" | "row">): void {
    if (!this.enabled || !source.visible) return;
    source.updateWorldMatrix(true, true);
    const object = source.clone(true);
    source.matrixWorld.decompose(object.position, object.quaternion, object.scale);
    const clones = new Map<THREE.Material, THREE.Material>();
    const materials = new Map<THREE.Material, number>();
    object.traverse(child => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      const cloneMaterial = (original: THREE.Material): THREE.Material => {
        let material = clones.get(original);
        if (!material) {
          material = original.clone();
          material.transparent = true;
          material.depthWrite = false;
          materials.set(material, original.opacity);
          clones.set(original, material);
        }
        return material;
      };
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map(cloneMaterial) : cloneMaterial(mesh.material);
      mesh.castShadow = false;
    });
    // Never add these copies to unit picking targets or the living formation.
    this.group.add(object);
    this.fading.add({ unitId: unit.id, faction: unit.faction, col: unit.col, row: unit.row,
      object, materials, age: 0, initialY: object.position.y });
  }

  public retainVisible(snapshot: BattleSnapshot): void {
    const retained = new Set([...visibleSnapshotUnits(snapshot).map(unit => unit.id), ...(snapshot.eliminatedUnitIds ?? [])]);
    const visibleHexes = new Set(snapshot.visibleHexes);
    for (const fade of this.fading) {
      if (!retained.has(fade.unitId) || (snapshot.fogOfWar && fade.faction !== "hussites"
        && !visibleHexes.has(`${fade.col},${fade.row}`))) this.remove(fade);
    }
  }

  public cancelUnit(unitId: number): void {
    for (const fade of this.fading) if (fade.unitId === unitId) this.remove(fade);
  }

  public advance(deltaMs: number, paused = false): void {
    if (paused || !Number.isFinite(deltaMs) || deltaMs <= 0) return;
    for (const fade of this.fading) {
      fade.age += deltaMs;
      const t = Math.min(1, fade.age / CASUALTY_FADE_MS);
      // Settle only a little, keeping the loss grounded rather than flying away.
      fade.object.position.y = fade.initialY - t * 0.18;
      for (const [material, originalOpacity] of fade.materials) material.opacity = originalOpacity * (1 - t);
      if (t === 1) this.remove(fade);
    }
  }

  public clear(): void { for (const fade of this.fading) this.remove(fade); }

  private remove(fade: Casualty): void {
    this.group.remove(fade.object);
    for (const material of fade.materials.keys()) material.dispose();
    this.fading.delete(fade);
  }
}
