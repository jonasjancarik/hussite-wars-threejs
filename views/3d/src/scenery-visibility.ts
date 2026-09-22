import * as THREE from "three";
import { HexLayout } from "./hex-coordinates.ts";
import type { BattleSnapshot } from "./types.ts";

export interface SceneryInstanceBatch {
  mesh: THREE.InstancedMesh;
  matrices: THREE.Matrix4[];
  keys: string[];
}

interface SceneryObject {
  object: THREE.Object3D;
  key: string;
}

const HIDDEN_MATRIX = new THREE.Matrix4().makeScale(0, 0, 0);

/** Retains per-cell reveal ownership without splitting scenery into many draw calls. */
export class SceneryVisibility {
  private readonly layout: HexLayout;
  private readonly objects: SceneryObject[] = [];
  private readonly batches: SceneryInstanceBatch[] = [];
  private visibilityKey: string | null = null;

  public constructor(layout: HexLayout) { this.layout = layout; }

  public trackObject(object: THREE.Object3D, x: number, z: number): void {
    this.trackCell(object, this.keyAt(x, z));
  }

  /** Track geometry whose ownership is supplied by a semantic planner. */
  public trackCell(object: THREE.Object3D, key: string): void {
    object.userData.sceneryCell = key;
    this.objects.push({ object, key });
    this.visibilityKey = null;
  }

  public trackInstances(mesh: THREE.InstancedMesh, matrices: THREE.Matrix4[]): void {
    const originals = matrices.map(matrix => matrix.clone());
    const keys = originals.map(matrix => this.keyAt(matrix.elements[12]!, matrix.elements[14]!));
    this.batches.push({ mesh, matrices: originals, keys });
    mesh.computeBoundingBox();
    mesh.computeBoundingSphere();
    this.visibilityKey = null;
  }

  public trackBatches(batches: SceneryInstanceBatch[]): void {
    for (const batch of batches) {
      batch.mesh.computeBoundingBox();
      batch.mesh.computeBoundingSphere();
    }
    this.batches.push(...batches);
    this.visibilityKey = null;
  }

  public keyForObject(object: THREE.Object3D): string | null {
    let current: THREE.Object3D | null = object;
    while (current) {
      if (typeof current.userData.sceneryCell === "string") return current.userData.sceneryCell;
      current = current.parent;
    }
    return null;
  }

  public update(snapshot: BattleSnapshot): void {
    const explored = new Set(snapshot.exploredHexes);
    const nextKey = snapshot.fogOfWar ? `fog:${[...explored].sort().join("|")}` : "clear";
    if (nextKey === this.visibilityKey) return;
    this.visibilityKey = nextKey;
    for (const placement of this.objects) {
      placement.object.visible = !snapshot.fogOfWar || explored.has(placement.key);
    }
    for (const batch of this.batches) {
      for (let index = 0; index < batch.matrices.length; index += 1) {
        const visible = !snapshot.fogOfWar || explored.has(batch.keys[index]!);
        batch.mesh.setMatrixAt(index, visible ? batch.matrices[index]! : HIDDEN_MATRIX);
      }
      batch.mesh.instanceMatrix.needsUpdate = true;
    }
  }

  public clear(): void {
    this.objects.length = 0;
    this.batches.length = 0;
    this.visibilityKey = null;
  }

  private keyAt(x: number, z: number): string {
    const direct = this.layout.coordAt(x, z);
    if (direct) return `${direct.col},${direct.row}`;
    let nearest = { col: 0, row: 0 };
    let nearestDistance = Infinity;
    for (let col = 0; col < this.layout.cols; col += 1) {
      for (let row = 0; row < this.layout.rows; row += 1) {
        const center = this.layout.center(col, row);
        const distance = (x - center.x) ** 2 + (z - center.z) ** 2;
        if (distance < nearestDistance) { nearest = { col, row }; nearestDistance = distance; }
      }
    }
    return `${nearest.col},${nearest.row}`;
  }
}
