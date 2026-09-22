import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import modelPaths from "../../../assets/3d/model-paths.json" with { type: "json" };

export class BattleAssets {
  private readonly loader = new GLTFLoader();
  private readonly cache = new Map<string, Promise<THREE.Group>>();
  private readonly prototypes = new Set<THREE.Group>();
  private disposed = false;

  public constructor(private readonly baseUrl = new URL("assets/", document.baseURI).href) {}

  public load(name: string): Promise<THREE.Group> {
    if (this.disposed) return Promise.reject(new Error("Battlefield asset library has been disposed"));
    let asset = this.cache.get(name);
    if (!asset) {
      const modelPath = (modelPaths as Record<string, string>)[name];
      if (!modelPath) throw new Error(`Unknown battlefield model: ${name}`);
      const url = new URL(modelPath, this.baseUrl).href;
      asset = this.loader.loadAsync(url).then(({ scene }) => {
        if (this.disposed) { this.release(scene); return scene; }
        this.prototypes.add(scene);
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

  public dispose(): void {
    this.disposed = true;
    this.prototypes.forEach(scene => this.release(scene));
    this.prototypes.clear(); this.cache.clear();
  }

  private release(scene: THREE.Group): void {
    const geometry = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
    scene.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      geometry.add(object.geometry);
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
    });
    geometry.forEach(value => value.dispose()); materials.forEach(value => value.dispose());
  }
}
