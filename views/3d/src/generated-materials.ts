import * as THREE from "three";
import { MeshStandardNodeMaterial } from "three/webgpu";
import { attribute, cameraPosition, normalWorld, positionWorld, texture as textureNode, uv, vec3 } from "three/tsl";
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

/**
 * Per-vertex weights of the three ground textures (meadow, earth, grain).
 * Every dry-land material samples the same blend, so a change of terrain is a
 * soft transition of texture as well as colour, not a seam where the
 * triangle's material changes.
 */
export const GROUND_SPLAT = "groundSplat";

/** Which ground texture a terrain kind contributes to: 0 meadow, 1 earth, 2 grain. */
export function groundSplatChannel(kind: SurfaceMaterialKind): 0 | 1 | 2 {
  if (kind === "meadow" || kind === "slope") return 0;
  if (kind === "earth" || kind === "water") return 1;
  return 2;
}

type TslFactory = (...arguments_: any[]) => any;
const tsl = (factory: unknown): TslFactory => factory as TslFactory;

function loadTexture(baseUrl: string, path: string, repeat: number): THREE.Texture {
  const texture = new THREE.TextureLoader().load(new URL(path, baseUrl).href);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.MirroredRepeatWrapping;
  texture.repeat.setScalar(repeat);
  texture.anisotropy = 8;
  return texture;
}

/** Texture nodes ignore `repeat` unless asked to; scale the UV explicitly instead. */
function groundLayer(map: THREE.Texture | null): any {
  return map ? tsl(textureNode)(map, tsl(uv)().mul(map.repeat.x)).rgb : tsl(vec3)(1, 1, 1);
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
  const weights = tsl(attribute)(GROUND_SPLAT, "vec3");
  const blend = groundLayer(meadowMap).mul(weights.x)
    .add(groundLayer(earthMap).mul(weights.y))
    .add(groundLayer(slopeMap).mul(weights.z));
  const land = (name: SurfaceMaterialKind, map: THREE.Texture | null, roughness: number): THREE.MeshStandardMaterial => {
    const result = new MeshStandardNodeMaterial({ color: 0xffffff, vertexColors: true, roughness, metalness: 0,
      side: THREE.DoubleSide });
    result.colorNode = blend;
    // Kept for consumers that read a kind's own texture (the plinth reuses the rock grain).
    result.map = map;
    result.name = `Generated ${name} ground material`;
    return result as unknown as THREE.MeshStandardMaterial;
  };
  return { materials: [
    land("meadow", meadowMap, 0.96),
    land("earth", earthMap, 0.98),
    land("slope", meadowMap, 0.98),
    land("rock", slopeMap, 1),
    material("water", null, 0.34),
    material("road", slopeMap, 1),
  ], textures };
}

/**
 * Standing water in mud and swamp hollows: a thin, tinted film that lets the
 * dark soil show through from above, with a sky sheen that grows toward
 * grazing angles. Frozen and opaque on winter maps.
 */
export function createPuddleMaterial(winter: boolean): THREE.Material {
  const material = new MeshStandardNodeMaterial({
    color: winter ? 0xc3d2d4 : 0x1d2320, roughness: winter ? .38 : .04, metalness: 0,
    transparent: !winter, opacity: winter ? 1 : .72, depthWrite: winter,
  });
  if (!winter) {
    const view = (cameraPosition as any).sub(positionWorld).normalize();
    const facing = (normalWorld as any).dot(view).clamp(0, 1);
    const fresnel = facing.oneMinus().pow(4).mul(.55).add(.1);
    material.emissiveNode = tsl(vec3)(.5, .58, .62).mul(fresnel);
    // Grazing views see mostly reflection; from above, mostly the soil beneath.
    material.opacityNode = fresnel.mul(.8).add(.55).clamp(0, .92);
  }
  material.name = winter ? "Frozen puddles" : "Standing water";
  return material;
}
