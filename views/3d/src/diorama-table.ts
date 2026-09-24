/**
 * The surface the diorama stands on. It is invisible apart from the board's
 * shadow, so the painted sky and its lower haze run on below the board, like
 * a model photographed against a seamless backdrop, while the shadow still
 * sets it down on something. Received shadow eases out toward the rim of the
 * sun's shadow map, whose edge would otherwise draw a line across it.
 */
import * as THREE from "three";
import { ShadowNodeMaterial } from "three/webgpu";
import { abs, Fn, float, max, mix, positionWorld, smoothstep, uniform, vec4 } from "three/tsl";

type TslFactory = (...arguments_: any[]) => any;
const tsl = (factory: unknown): TslFactory => factory as TslFactory;

/** A cool shade, so the shadow reads as shade on a pale backdrop rather than a grey stain. */
const SHADE = 0x27343a;
const SHADE_OPACITY = .32;

export class DioramaTable {
  public readonly mesh: THREE.Mesh;

  /**
   * @param centre board centre on the table plane
   * @param extent the board's larger side
   * @param height table surface height, just below the base
   * @param shadowFrame the sun's view-projection (BattleLights.shadowFrame)
   */
  public constructor(centre: THREE.Vector2, extent: number, height: number, shadowFrame?: THREE.Matrix4) {
    const material = new ShadowNodeMaterial({ color: SHADE, opacity: SHADE_OPACITY, fog: false, depthWrite: false });
    if (shadowFrame) {
      const clip = (tsl(uniform)(shadowFrame) as any).mul(tsl(vec4)(positionWorld, 1));
      const rim = tsl(float)(1).sub(tsl(max)(tsl(abs)(clip.x), tsl(abs)(clip.y)));
      // 0 at the map's edge, 1 well inside the margin around the board's casters.
      const keep = tsl(smoothstep)(.01, .06, rim);
      (material as any).receivedShadowNode = tsl(Fn)(([shadow]: any[]) => tsl(mix)(tsl(float)(1), shadow, keep));
    }
    material.name = "Diorama table";
    const geometry = new THREE.CircleGeometry(extent * 4, 64);
    geometry.rotateX(-Math.PI / 2);
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.set(centre.x, height, centre.y);
    this.mesh.name = "Diorama table";
    this.mesh.receiveShadow = true;
  }

  public dispose(): void {
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
