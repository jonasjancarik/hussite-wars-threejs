import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

export class BattleAssets {
  private readonly loader = new GLTFLoader();
  private readonly cache = new Map<string, Promise<THREE.Group>>();

  public constructor(private readonly baseUrl = new URL("assets/", document.baseURI).href) {}

  public load(name: string): Promise<THREE.Group> {
    let asset = this.cache.get(name);
    if (!asset) {
      const url = new URL(`models/${name}.glb`, this.baseUrl).href;
      asset = this.loader.loadAsync(url).then(({ scene }) => {
        scene.traverse((object) => {
          const mesh = object as THREE.Mesh;
          if (!mesh.isMesh) return;
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          for (const material of materials) {
            if (material instanceof THREE.MeshStandardMaterial) {
              material.roughness = Math.max(material.roughness, 0.72);
            }
          }
        });
        return scene;
      });
      this.cache.set(name, asset);
    }
    return asset;
  }

  public async clone(name: string): Promise<THREE.Group> {
    return (await this.load(name)).clone(true);
  }

  public async preload(names: string[]): Promise<void> {
    await Promise.all(names.map(name => this.load(name)));
  }
}
