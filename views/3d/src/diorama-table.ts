/**
 * The table the diorama stands on. Near the board it is lit linen that
 * catches the board's shadow; further out it gives way to the colour of the
 * lower sky, so the board sits on something without a visible table edge.
 * Received shadow eases out toward the rim of the sun's shadow map, whose
 * edge would otherwise draw a line across the table.
 */
import * as THREE from "three";
import { MeshStandardNodeMaterial } from "three/webgpu";
import { abs, Fn, float, max, mix, positionWorld, smoothstep, uniform, vec2, vec3, vec4 } from "three/tsl";

type TslFactory = (...arguments_: any[]) => any;
const tsl = (factory: unknown): TslFactory => factory as TslFactory;

const LINEN = new THREE.Color(0x857a6b);

export class DioramaTable {
  public readonly mesh: THREE.Mesh;
  private readonly horizon = tsl(uniform)(new THREE.Color(0xbdccc8));

  /**
   * @param centre board centre on the table plane
   * @param extent the board's larger side, which scales the lit pool
   * @param height table surface height, just below the base
   * @param shadowFrame the sun's view-projection (BattleLights.shadowFrame)
   */
  public constructor(centre: THREE.Vector2, extent: number, height: number, shadowFrame?: THREE.Matrix4) {
    const material = new MeshStandardNodeMaterial({ color: 0xffffff, roughness: .95, metalness: 0, fog: false });
    const distance = (positionWorld as any).xz.distance(tsl(vec2)(centre.x, centre.y));
    // 0 in the lit pool around the board, 1 where the table meets the sky.
    const fade = tsl(smoothstep)(extent * .75, extent * 2.4, distance);
    material.colorNode = tsl(mix)(tsl(vec3)(LINEN.r, LINEN.g, LINEN.b), tsl(vec3)(0, 0, 0), fade);
    material.emissiveNode = (this.horizon as any).mul(fade);
    if (shadowFrame) {
      const clip = (tsl(uniform)(shadowFrame) as any).mul(tsl(vec4)(positionWorld, 1));
      const rim = tsl(float)(1).sub(tsl(max)(tsl(abs)(clip.x), tsl(abs)(clip.y)));
      // 0 at the map's edge, 1 well inside the margin around the board's casters.
      const keep = tsl(smoothstep)(.01, .06, rim);
      (material as any).receivedShadowNode = tsl(Fn)(([shadow]: any[]) => tsl(mix)(tsl(float)(1), shadow, keep));
    }
    material.name = "Diorama table";
    const geometry = new THREE.CircleGeometry(extent * 8, 64);
    geometry.rotateX(-Math.PI / 2);
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.set(centre.x, height, centre.y);
    this.mesh.name = "Diorama table";
    this.mesh.receiveShadow = true;
  }

  /** Follow the lower sky as light and weather change. */
  public setHorizon(colour: THREE.Color): void { (this.horizon.value as THREE.Color).copy(colour); }

  public dispose(): void {
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
