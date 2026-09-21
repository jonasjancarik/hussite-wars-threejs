import * as THREE from "three";
import { HexLayout } from "./hex-coordinates.ts";
import type { HexCoord } from "./types.ts";

export class BattlePicker {
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();

  public constructor(private readonly canvas: HTMLCanvasElement, private readonly camera: THREE.Camera,
    private readonly layout = new HexLayout(20, 12)) {}

  public unitAt(clientX: number, clientY: number, targets: THREE.Object3D[]): THREE.Object3D | null {
    this.setPointer(clientX, clientY);
    return this.raycaster.intersectObjects(targets, false)[0]?.object ?? null;
  }

  public hexAt(clientX: number, clientY: number, terrainTargets: THREE.Object3D[]): HexCoord | null {
    const hit = this.worldHitAt(clientX, clientY, terrainTargets);
    return hit ? this.layout.coordAt(hit.point.x, hit.point.z) : null;
  }

  public worldPointAt(clientX: number, clientY: number, targets: THREE.Object3D[]): THREE.Vector3 | null {
    return this.worldHitAt(clientX, clientY, targets)?.point.clone() ?? null;
  }

  private worldHitAt(clientX: number, clientY: number, targets: THREE.Object3D[]): THREE.Intersection | null {
    this.setPointer(clientX, clientY);
    return this.raycaster.intersectObjects(targets, false)[0] ?? null;
  }

  private setPointer(clientX: number, clientY: number): void {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.set(
      ((clientX - rect.left) / Math.max(rect.width, 1)) * 2 - 1,
      -((clientY - rect.top) / Math.max(rect.height, 1)) * 2 + 1,
    );
    this.raycaster.setFromCamera(this.pointer, this.camera);
  }
}
