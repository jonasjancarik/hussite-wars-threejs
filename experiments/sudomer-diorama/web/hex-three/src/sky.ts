/**
 * Daylight-only extraction of procedural-worlds' three-painted-sky.ts at
 * commit bada861a8d5c8cb7275a1b3d6e6a3f4ea4844cf4. The battle does not need
 * the town's time-of-day transitions, but retains its equirectangular painted
 * sky setup, rotation, color-space handling and restrained background grade.
 */
import * as THREE from "three";

export class BattlePaintedSky {
  private texture: THREE.Texture | null = null;
  private readonly lowerVeil: THREE.Mesh;

  public constructor(private readonly scene: THREE.Scene) {
    const radius = 318;
    const geometry = new THREE.SphereGeometry(radius, 64, 32);
    const positions = geometry.getAttribute("position");
    const colors = new Float32Array(positions.count * 4);
    for (let index = 0; index < positions.count; index += 1) {
      const downward = -positions.getY(index) / radius;
      const fade = THREE.MathUtils.smoothstep(downward, 0.12, 0.92);
      const alpha = Math.pow(fade, 1.35) * 0.88;
      const offset = index * 4;
      colors[offset] = 1;
      colors[offset + 1] = 1;
      colors[offset + 2] = 1;
      colors[offset + 3] = alpha;
    }
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 4));
    this.lowerVeil = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
      color: 0xbdccc8,
      side: THREE.BackSide,
      depthTest: true,
      depthWrite: false,
      fog: false,
      toneMapped: true,
      transparent: true,
      vertexColors: true,
    }));
    this.lowerVeil.name = "lower-sky-atmospheric-veil";
    this.lowerVeil.renderOrder = -999;
    this.lowerVeil.frustumCulled = false;
    scene.add(this.lowerVeil);
  }

  public async load(): Promise<void> {
    const texture = await new THREE.TextureLoader().loadAsync(
      new URL("assets/textures/sky/sudomer-painted-day.webp", document.baseURI).href,
    );
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.mapping = THREE.EquirectangularReflectionMapping;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    this.texture = texture;
    this.scene.background = texture;
    this.scene.environment = texture;
    this.scene.environmentIntensity = 0.28;
    this.scene.backgroundRotation.set(0, Math.PI * 0.3, 0);
    this.scene.backgroundIntensity = 1.05;
    this.scene.backgroundBlurriness = 0.025;
  }

  public update(camera: THREE.Camera): void { this.lowerVeil.position.copy(camera.position); }

  public dispose(): void {
    this.texture?.dispose();
    this.texture = null;
    this.lowerVeil.removeFromParent();
    this.lowerVeil.geometry.dispose();
    (this.lowerVeil.material as THREE.Material).dispose();
  }
}
