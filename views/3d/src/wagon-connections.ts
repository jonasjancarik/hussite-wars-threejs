import * as THREE from "three";
import { HexLayout } from "./hex-coordinates.ts";
import { visibleSnapshotUnits } from "./unit-visibility.ts";
import type { BattleSnapshot, TerrainSurface, UnitSnapshot } from "./types.ts";

interface WagonConnection {
  group: THREE.Group;
  stateKey: string;
}

// Spacing along the chain: ten links across flat neighbours when closed, five when marching.
const LINK_PITCH_CLOSED = 0.39;
const LINK_PITCH_MARCHING = 0.72;
const LINK_CENTER_OFFSET = 1.3;
const LINK_HEIGHT = 0.48;
const LINK_MAJOR_RADIUS = 0.24;
const LINK_TUBE_RADIUS = 0.065;
const LINK_CLEARANCE = LINK_MAJOR_RADIUS + LINK_TUBE_RADIUS;
const PATH_SAMPLES = 32;

function coordKey(unit: UnitSnapshot): string {
  return `${unit.col},${unit.row}`;
}

function pairKey(first: UnitSnapshot, second: UnitSnapshot): string {
  return `${Math.min(first.id, second.id)}:${Math.max(first.id, second.id)}`;
}

/**
 * Physical links between adjacent closed war wagons in the visible snapshot,
 * drawn only where the wagon-line bonus applies (game.isInWagonLine): at least
 * one wagon of the pair has two or more closed neighbours and no breach.
 */
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
    const chainedNeighbours = (unit: UnitSnapshot): UnitSnapshot[] => this.layout.neighbours(unit)
      .map(coord => at.get(`${coord.col},${coord.row}`))
      .filter((neighbour): neighbour is UnitSnapshot => neighbour?.faction === unit.faction);
    const holdsLine = (unit: UnitSnapshot): boolean => !unit.breached && chainedNeighbours(unit).length >= 2;
    const nextKeys = new Set<string>();

    for (const unit of units) {
      for (const neighbour of chainedNeighbours(unit)) {
        if (unit.id >= neighbour.id || !(holdsLine(unit) || holdsLine(neighbour))) continue;
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
    const ux = dx / distance, uz = dz / distance;
    const span = Math.max(0, distance - LINK_CENTER_OFFSET * 2);
    const pitch = marching ? LINK_PITCH_MARCHING : LINK_PITCH_CLOSED;
    const material = marching ? this.marchingMaterial : this.closedMaterial;
    const group = new THREE.Group();
    group.name = `Wagon chain ${Math.min(first.id, second.id)}-${Math.max(first.id, second.id)}`;
    group.userData.wagonIds = [first.id, second.id];
    const heightAt = (x: number, z: number): number => this.terrain.renderedHeightAt?.(x, z) ?? this.terrain.heightAt(x, z);

    // The chain hangs taut from each wagon's body at its hex centre height and
    // stretches over any brow between them: the upper hull of the ground it
    // must clear. Sampling the ground under every link instead stacked links
    // up a steep flank.
    const clearAt = (along: number): number => heightAt(a.x + ux * along, a.z + uz * along) + LINK_CLEARANCE;
    const profile: Array<{ along: number; y: number }> = [];
    for (let index = 0; index <= PATH_SAMPLES; index += 1) {
      const along = LINK_CENTER_OFFSET + span * index / PATH_SAMPLES;
      const anchor = index === 0 ? heightAt(a.x, a.z) + LINK_HEIGHT : index === PATH_SAMPLES ? heightAt(b.x, b.z) + LINK_HEIGHT : -Infinity;
      const point = { along, y: Math.max(anchor, clearAt(along)) };
      while (profile.length >= 2) {
        const o = profile[profile.length - 2]!, m = profile[profile.length - 1]!;
        if ((m.along - o.along) * (point.y - o.y) - (m.y - o.y) * (point.along - o.along) < 0) break;
        profile.pop();
      }
      profile.push(point);
    }
    const path = profile.map(point => new THREE.Vector3(a.x + ux * point.along, point.y, a.z + uz * point.along));
    const lengths = [0];
    for (let index = 1; index < path.length; index += 1) lengths.push(lengths[index - 1]! + path[index]!.distanceTo(path[index - 1]!));
    const length = lengths[lengths.length - 1]!;
    const count = Math.max(1, Math.round(length / pitch) - 1);

    const up = new THREE.Vector3(0, 1, 0);
    const tangent = new THREE.Vector3();
    const side = new THREE.Vector3();
    const lift = new THREE.Vector3();
    let segment = 1;
    for (let index = 0; index < count; index += 1) {
      const target = length * (index + 1) / (count + 1);
      while (segment < path.length - 1 && lengths[segment]! < target) segment += 1;
      const from = path[segment - 1]!, to = path[segment]!;
      const segmentLength = lengths[segment]! - lengths[segment - 1]!;
      const fraction = segmentLength > 0 ? (target - lengths[segment - 1]!) / segmentLength : 0;
      tangent.subVectors(to, from).normalize();
      side.crossVectors(tangent, up).normalize();
      // Alternate links turn a quarter about the chain, as real links interlock.
      const normal = index % 2 === 0 ? side : lift.crossVectors(side, tangent).normalize();
      const link = new THREE.Mesh(this.linkGeometry, material);
      link.position.lerpVectors(from, to, fraction);
      link.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
      link.castShadow = true;
      link.receiveShadow = true;
      link.userData.connectionLink = true;
      group.add(link);
    }

    return { group, stateKey: "" };
  }
}
