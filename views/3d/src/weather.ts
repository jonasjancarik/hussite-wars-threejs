/**
 * Light precipitation around the camera target. Flakes are one instanced
 * draw call; they fall in a column that follows the view, so density stays
 * constant at every zoom without covering the whole map. Each flake's fall
 * and drift is computed in the vertex shader from a time uniform, so a snowy
 * frame uploads two uniforms rather than 1,400 matrices.
 */
import * as THREE from "three";
import { MeshBasicNodeMaterial } from "three/webgpu";
import { cos, float, instancedBufferAttribute, mod, positionLocal, sin, uniform, vec3 } from "three/tsl";
import type { Precipitation } from "./atmosphere.ts";

type TslFactory = (...arguments_: any[]) => any;
const tsl = (factory: unknown): TslFactory => factory as TslFactory;

const FLAKES = 1400;
const COLUMN_RADIUS = 70;
const COLUMN_HEIGHT = 46;
/** World units per second. */
const FALL_SPEED = 3.2;

export class BattleWeather {
  public readonly group = new THREE.Group();
  private readonly flakes: THREE.Mesh<THREE.InstancedBufferGeometry, THREE.Material>;
  private readonly time = tsl(uniform)(0);
  private readonly centre = tsl(uniform)(new THREE.Vector3());
  private precipitation: Precipitation = "none";
  private elapsed = 0;
  private enabled = true;

  public constructor() {
    this.group.name = "Weather";
    const geometry = new THREE.InstancedBufferGeometry().copy(new THREE.IcosahedronGeometry(0.075, 0) as never);
    geometry.instanceCount = FLAKES;
    // Deterministic scatter: x, z, starting height and a drift phase per flake.
    const offsets = new Float32Array(FLAKES * 4);
    let seed = 0x9e3779b9;
    const random = (): number => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 0x100000000; };
    for (let index = 0; index < FLAKES; index += 1) {
      const angle = random() * Math.PI * 2, radius = Math.sqrt(random()) * COLUMN_RADIUS;
      offsets.set([Math.cos(angle) * radius, Math.sin(angle) * radius, random() * COLUMN_HEIGHT, random() * Math.PI * 2], index * 4);
    }
    const offset = tsl(instancedBufferAttribute)(new THREE.InstancedBufferAttribute(offsets, 4));
    const phase = offset.w;
    const height = tsl(mod)(offset.z.sub(this.time.mul(FALL_SPEED).mul(tsl(mod)(phase, 0.4).add(0.8))), COLUMN_HEIGHT);
    const material = new MeshBasicNodeMaterial({ color: 0xf4f6f8, transparent: true, opacity: 0.85, depthWrite: false, fog: true });
    material.positionNode = (positionLocal as any).add(tsl(vec3)(
      this.centre.x.add(offset.x).add(tsl(sin)(this.time.mul(0.7).add(phase)).mul(0.6)),
      this.centre.y.add(height).sub(tsl(float)(2)),
      this.centre.z.add(offset.y).add(tsl(cos)(this.time.mul(0.5).add(phase)).mul(0.6)),
    ));
    material.name = "Falling snow";
    this.flakes = new THREE.Mesh(geometry, material);
    this.flakes.name = "Snowflakes";
    this.flakes.frustumCulled = false;
    this.flakes.castShadow = false;
    this.flakes.visible = false;
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
    if (!frozen) this.elapsed += deltaMs / 1000;
    this.time.value = this.elapsed;
    // Snap the column to a coarse grid so flakes do not slide with small pans.
    (this.centre.value as THREE.Vector3).set(Math.round(target.x / 8) * 8, target.y, Math.round(target.z / 8) * 8);
  }

  public dispose(): void {
    this.flakes.geometry.dispose();
    this.flakes.material.dispose();
    this.group.clear();
  }
}
