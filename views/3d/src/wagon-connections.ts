import * as THREE from "three";
import { HexLayout } from "./hex-coordinates.ts";
import { visibleSnapshotUnits } from "./unit-visibility.ts";
import type { BattleSnapshot, TerrainSurface, UnitSnapshot } from "./types.ts";

interface WagonConnection {
  group: THREE.Group;
  stateKey: string;
}

const LINK_COUNT_CLOSED = 10;
const LINK_COUNT_MARCHING = 5;
const LINK_CENTER_OFFSET = 1.3;
const LINK_HEIGHT = 0.48;
const LINK_MAJOR_RADIUS = 0.24;
const LINK_TUBE_RADIUS = 0.065;

function coordKey(unit: UnitSnapshot): string {
  return `${unit.col},${unit.row}`;
}

function pairKey(first: UnitSnapshot, second: UnitSnapshot): string {
  return `${Math.min(first.id, second.id)}:${Math.max(first.id, second.id)}`;
}

/** Physical links between adjacent closed war wagons in the visible snapshot. */
export class WagonConnections {
  public readonly group = new THREE.Group();

  private readonly terrain: TerrainSurface;
  private readonly layout: HexLayout;
  private readonly linkGeometry = new THREE.TorusGeometry(
    LINK_MAJOR_RADIUS, LINK_TUBE_RADIUS, 8, 8,
  );
  private readonly closedMaterial = new THREE.MeshStandardMaterial({
    color: 0x5a4a1f,
    roughness: 0.88,
    metalness: 0.05,
    transparent: true,
    opacity: 0.75,
  });
  private readonly marchingMaterial = new THREE.MeshStandardMaterial({
    color: 0x968046,
    roughness: 0.92,
    metalness: 0.03,
    transparent: true,
    opacity: 0.55,
  });
  private readonly connections = new Map<string, WagonConnection>();
  private disposed = false;

  public constructor(terrain: TerrainSurface, layout: HexLayout) {
    this.terrain = terrain;
    this.layout = layout;
    this.group.name = "Wagon defense connections";
  }

  public update(snapshot: BattleSnapshot): void {
    if (this.disposed) return;

    const units = visibleSnapshotUnits(snapshot)
      .filter(unit => unit.unitClass === "wagon" && unit.formationClosed);
    const at = new Map(units.map(unit => [coordKey(unit), unit]));
    const nextKeys = new Set<string>();

    for (const unit of units) {
      for (const neighbourCoord of this.layout.neighbours(unit)) {
        const neighbour = at.get(`${neighbourCoord.col},${neighbourCoord.row}`);
        if (!neighbour || unit.faction !== neighbour.faction || unit.id >= neighbour.id) continue;
        const key = pairKey(unit, neighbour);
        nextKeys.add(key);
        const marching = unit.marching || neighbour.marching;
        const stateKey = `${key}|${unit.col},${unit.row}|${neighbour.col},${neighbour.row}|${marching ? "marching" : "closed"}`;
        const previous = this.connections.get(key);
        if (previous?.stateKey === stateKey) continue;
        if (previous) this.group.remove(previous.group);
        const connection = this.createConnection(unit, neighbour, marching);
        connection.stateKey = stateKey;
        this.connections.set(key, connection);
        this.group.add(connection.group);
      }
    }

    for (const [key, connection] of this.connections) {
      if (nextKeys.has(key)) continue;
      this.group.remove(connection.group);
      this.connections.delete(key);
    }
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.connections.clear();
    this.group.clear();
    this.linkGeometry.dispose();
    this.closedMaterial.dispose();
    this.marchingMaterial.dispose();
  }

  private createConnection(first: UnitSnapshot, second: UnitSnapshot, marching: boolean): WagonConnection {
    const a = this.layout.center(first.col, first.row);
    const b = this.layout.center(second.col, second.row);
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const distance = Math.hypot(dx, dz);
    const direction = new THREE.Vector3(dx / distance, 0, dz / distance);
    const perpendicular = new THREE.Vector3(-direction.z, 0, direction.x);
    const up = new THREE.Vector3(0, 1, 0);
    const span = Math.max(0, distance - LINK_CENTER_OFFSET * 2);
    const count = marching ? LINK_COUNT_MARCHING : LINK_COUNT_CLOSED;
    const material = marching ? this.marchingMaterial : this.closedMaterial;
    const group = new THREE.Group();
    group.name = `Wagon chain ${Math.min(first.id, second.id)}-${Math.max(first.id, second.id)}`;
    group.userData.wagonIds = [first.id, second.id];
    const heightAt = (x: number, z: number): number => this.terrain.renderedHeightAt?.(x, z) ?? this.terrain.heightAt(x, z);

    for (let index = 0; index < count; index += 1) {
      // Keep the first and last links inside each wagon's silhouette, with a
      // little more room between links while the wagons are marching.
      const fraction = (index + 1) / (count + 1);
      const distanceAlong = LINK_CENTER_OFFSET + span * fraction;
      const x = a.x + direction.x * distanceAlong;
      const z = a.z + direction.z * distanceAlong;
      const y = heightAt(x, z) + LINK_HEIGHT;
      const link = new THREE.Mesh(this.linkGeometry, material);
      const normal = index % 2 === 0 ? perpendicular : up;
      link.position.set(x, y, z);
      link.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
      link.castShadow = true;
      link.receiveShadow = true;
      link.userData.connectionLink = true;
      group.add(link);
    }

    return { group, stateKey: "" };
  }
}
