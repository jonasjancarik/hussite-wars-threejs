import * as THREE from "three";
import { isFieldTerrain } from "./terrain-regions.ts";
import { isRoadTerrain } from "./road-corridors.ts";

export type SurfaceMaterialKind = "meadow" | "earth" | "slope" | "rock" | "water" | "road";

const MATERIAL_ORDER: SurfaceMaterialKind[] = ["meadow", "earth", "slope", "rock", "water", "road"];

export function surfaceMaterialKind(terrain: string): SurfaceMaterialKind {
  const name = terrain.toLowerCase();
  if (["water", "river", "lake"].includes(name)) return "water";
  if (isRoadTerrain(name)) return "road";
  if (["slope", "steep_slope"].includes(name)) return "slope";
  if (["cliff", "rock"].includes(name)) return "rock";
  if (["mud", "swamp", "marsh", "road", "road2", "dam", "causeway", "trenches"].includes(name)
    || isFieldTerrain(name)) return "earth";
  return "meadow";
}

export function surfaceMaterialIndex(terrain: string): number {
  return MATERIAL_ORDER.indexOf(surfaceMaterialKind(terrain));
}

function loadTexture(baseUrl: string, path: string, repeat: number): THREE.Texture {
  const texture = new THREE.TextureLoader().load(new URL(path, baseUrl).href);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.MirroredRepeatWrapping;
  texture.repeat.setScalar(repeat);
  texture.anisotropy = 8;
  return texture;
}

export function createGeneratedSurfaceMaterials(assetBase?: string, winter = false): {
  materials: THREE.MeshStandardMaterial[];
  textures: THREE.Texture[];
} {
  const textures: THREE.Texture[] = [];
  const texture = (path: string, repeat: number): THREE.Texture | null => {
    if (!assetBase) return null;
    const result = loadTexture(assetBase, path, repeat);
    textures.push(result);
    return result;
  };
  const meadowMap = winter ? null : texture("textures/procedural-worlds/T_ConceptBGroundCalm.webp", 1.0);
  const earthMap = texture("textures/sudomer-pond-mud.png", 1.25);
  const slopeMap = texture("textures/earth-grain.png", 2.8);
  const material = (name: SurfaceMaterialKind, map: THREE.Texture | null, roughness: number): THREE.MeshStandardMaterial => {
    const result = new THREE.MeshStandardMaterial({
      color: 0xffffff, vertexColors: true, map, roughness, metalness: 0, side: THREE.DoubleSide,
    });
    result.name = `Generated ${name} ground material`;
    return result;
  };
  return { materials: [
    material("meadow", meadowMap, 0.96),
    material("earth", earthMap, 0.98),
    material("slope", meadowMap, 0.98),
    material("rock", slopeMap, 1),
    material("water", null, 0.34),
    material("road", slopeMap, 1),
  ], textures };
}
