/**
 * Light precipitation around the camera target. Flakes are one instanced
 * draw call; they fall in a column that follows the view, so density stays
 * constant at every zoom without covering the whole map.
 */
import * as THREE from "three";
import type { Precipitation } from "./atmosphere.ts";

const FLAKES = 1400;
const COLUMN_RADIUS = 70;
const COLUMN_HEIGHT = 46;
/** World units per second. */
const FALL_SPEED = 3.2;

export class BattleWeather {
  public readonly group = new THREE.Group();
  private readonly flakes: THREE.InstancedMesh;
  private readonly offsets = new Float32Array(FLAKES * 4);
  private readonly matrix = new THREE.Matrix4();
  private readonly centre = new THREE.Vector3();
  private precipitation: Precipitation = "none";
  private time = 0;
  private enabled = true;

  public constructor() {
    this.group.name = "Weather";
    const geometry = new THREE.IcosahedronGeometry(0.075, 0);
    const material = new THREE.MeshBasicMaterial({ color: 0xf4f6f8, transparent: true, opacity: 0.85, depthWrite: false, fog: true });
    this.flakes = new THREE.InstancedMesh(geometry, material, FLAKES);
    this.flakes.frustumCulled = false;
    this.flakes.castShadow = false;
    this.flakes.visible = false;
    // Deterministic scatter: x, z, starting height and a drift phase per flake.
    let seed = 0x9e3779b9;
    const random = (): number => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 0x100000000; };
    for (let index = 0; index < FLAKES; index += 1) {
      const angle = random() * Math.PI * 2, radius = Math.sqrt(random()) * COLUMN_RADIUS;
      this.offsets.set([Math.cos(angle) * radius, Math.sin(angle) * radius, random() * COLUMN_HEIGHT, random() * Math.PI * 2], index * 4);
    }
    this.group.add(this.flakes);
  }

  /** Whether flakes are falling and need further frames. */
  public get active(): boolean { return this.flakes.visible; }

  public setPrecipitation(precipitation: Precipitation): void {
    this.precipitation = precipitation;
    this.flakes.visible = this.enabled && precipitation === "snow";
  }

  /** The player's weather-effects preference. */
  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.setPrecipitation(this.precipitation);
  }

  /**
   * Move flakes by `deltaMs` around `target` (the orbit target at ground
   * level). A frozen step (paused, reduced motion) only re-centres them.
   */
  public advance(deltaMs: number, target: THREE.Vector3, frozen = false): void {
    if (!this.flakes.visible) return;
    if (!frozen) this.time += deltaMs / 1000;
    // Snap the column to a coarse grid so flakes do not slide with small pans.
    this.centre.set(Math.round(target.x / 8) * 8, target.y, Math.round(target.z / 8) * 8);
    for (let index = 0; index < FLAKES; index += 1) {
      const offset = index * 4;
      const phase = this.offsets[offset + 3]!;
      const fall = (this.offsets[offset + 2]! - this.time * FALL_SPEED * (0.8 + (phase % 0.4))) % COLUMN_HEIGHT;
      const height = fall < 0 ? fall + COLUMN_HEIGHT : fall;
      this.matrix.makeTranslation(
        this.centre.x + this.offsets[offset]! + Math.sin(this.time * 0.7 + phase) * 0.6,
        this.centre.y + height - 2,
        this.centre.z + this.offsets[offset + 1]! + Math.cos(this.time * 0.5 + phase) * 0.6,
      );
      this.flakes.setMatrixAt(index, this.matrix);
    }
    this.flakes.instanceMatrix.needsUpdate = true;
  }

  public dispose(): void {
    this.flakes.geometry.dispose();
    (this.flakes.material as THREE.Material).dispose();
    this.flakes.dispose();
    this.group.clear();
  }
}
