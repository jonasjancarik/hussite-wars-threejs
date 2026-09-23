import * as THREE from "three";
import { MeshStandardNodeMaterial } from "three/webgpu";
import { attribute, cameraPosition, mix, mx_noise_float, normalWorld, normalWorldGeometry, positionWorld, smoothstep, texture as textureNode, transformNormalToView, uv, vec3, vertexColor } from "three/tsl";
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
/** Per-vertex metres from open water to the shore (zero on land). */
export const SHORE_DISTANCE = "shoreDistance";

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

/** Ground whose normal is steeper than this starts to show rock (about 34°)... */
const CLIFF_FLAT_NORMAL_Y = .83;
/** ...and is all rock from about 52°. */
const CLIFF_STEEP_NORMAL_Y = .62;
const CLIFF_TILE_METRES = 5.5;
const CLIFF_BRIGHTNESS = 1.15;

/** World-space triplanar sample, blended by the geometric normal. */
function triplanar(map: THREE.Texture, tileMetres: number): any {
  const position = (positionWorld as any).div(tileMetres);
  const axes = (normalWorldGeometry as any).abs().pow(4);
  const share = axes.div(axes.x.add(axes.y).add(axes.z));
  const sample = (coordinates: any): any => tsl(textureNode)(map, coordinates).rgb;
  return sample(position.zy).mul(share.x).add(sample(position.xz).mul(share.y)).add(sample(position.xy).mul(share.z));
}

/** Texture nodes ignore `repeat` unless asked to; scale the UV explicitly instead. */
function groundLayer(map: THREE.Texture | null): any {
  return map ? tsl(textureNode)(map, tsl(uv)().mul(map.repeat.x)).rgb : tsl(vec3)(1, 1, 1);
}

export function createGeneratedSurfaceMaterials(assetBase?: string, winter = false): {
  materials: THREE.MeshStandardMaterial[];
  textures: THREE.Texture[];
  /** The diorama's cut face: soil strata over bedrock. */
  soil: THREE.Material;
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
  const cliffMap = texture("textures/procedural-worlds/T_ConceptBCliff.webp", 1);
  const weights = tsl(attribute)(GROUND_SPLAT, "vec3");
  const tint = tsl(vertexColor)();
  const blend = groundLayer(meadowMap).mul(weights.x)
    .add(groundLayer(earthMap).mul(weights.y))
    .add(groundLayer(slopeMap).mul(weights.z)).mul(tint);
  // Steep ground turns to rock. The rock is projected from all three axes, so
  // it never smears down a bank the way the top-down ground textures would.
  const steep = tsl(smoothstep)(CLIFF_FLAT_NORMAL_Y, CLIFF_STEEP_NORMAL_Y, (normalWorldGeometry as any).y);
  const rock = cliffMap ? triplanar(cliffMap, CLIFF_TILE_METRES) : tsl(vec3)(.42, .40, .37);
  // Rock keeps only a trace of the grass tint so hillsides do not turn olive.
  const ground = tsl(mix)(blend, rock.mul(tsl(mix)(tint, tsl(vec3)(1, 1, 1), .7)).mul(CLIFF_BRIGHTNESS), steep);
  const land = (name: SurfaceMaterialKind, map: THREE.Texture | null, roughness: number): THREE.MeshStandardMaterial => {
    // Vertex colours are applied inside the colour node, not by the material.
    const result = new MeshStandardNodeMaterial({ color: 0xffffff, vertexColors: false, roughness, metalness: 0,
      side: THREE.DoubleSide });
    result.colorNode = ground;
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
    createWaterMaterial(),
    material("road", slopeMap, 1),
  ], textures, soil: createSoilMaterial(earthMap, cliffMap, winter) };
}

/** Per-vertex height of the terrain rim above a point of the diorama's cut face. */
export const RIM_TOP = "rimTop";

/** Linear-light colours of the soil profile, top to bottom. */
const SOIL = {
  turf: new THREE.Color(0x5d6a2c), snow: new THREE.Color(0xe4e8e2), topsoil: new THREE.Color(0x3a2a1e),
  subsoil: new THREE.Color(0xa47a4a), gravel: new THREE.Color(0x7c7263), stone: new THREE.Color(0x8d8474),
  water: new THREE.Color(0x1f3d44),
};
const colourNode = (colour: THREE.Color): any => tsl(vec3)(colour.r, colour.g, colour.b);

/**
 * The cut face around the board, shaded by depth below its rim: a turf lip
 * (snow in winter), dark topsoil, ochre subsoil studded with stones, gravel,
 * then faceted bedrock. Layer boundaries wander along the face; where the rim
 * is water, a band of water shows above the silt.
 */
function createSoilMaterial(earthMap: THREE.Texture | null, cliffMap: THREE.Texture | null, winter: boolean): THREE.Material {
  const material = new MeshStandardNodeMaterial({ color: 0xffffff, roughness: 1, metalness: 0, side: THREE.DoubleSide });
  const world = positionWorld as any;
  const rim = tsl(attribute)(RIM_TOP, "float");
  const along = world.x.add(world.z);
  const wander = (scale: number, amount: number, offset: number): any =>
    tsl(mx_noise_float)(tsl(vec3)(along.mul(scale), offset, 0).xy).mul(amount);
  const depth = rim.sub(world.y);
  const layer = (from: number, width: number, offset: number): any => tsl(smoothstep)(from - width, from + width,
    depth.add(wander(.22, .28, offset)).add(wander(.9, .06, offset + 3)));
  // The mud texture lends grain, not its darkness.
  const earth = earthMap ? tsl(mix)(tsl(vec3)(1, 1, 1), tsl(textureNode)(earthMap, tsl(vec3)(along.div(4), world.y.div(4), 0).xy).rgb.mul(2.2), .55)
    : tsl(vec3)(1, 1, 1);
  const rock = cliffMap ? triplanar(cliffMap, 3.2).mul(1.1) : colourNode(SOIL.gravel);
  const pebbles = tsl(smoothstep)(.6, .66, tsl(mx_noise_float)(tsl(vec3)(along.mul(2.3), world.y.mul(2.3), 0).xy));
  const subsoil = tsl(mix)(colourNode(SOIL.subsoil).mul(earth), colourNode(SOIL.stone), pebbles.mul(.7));
  let colour = tsl(mix)(colourNode(winter ? SOIL.snow : SOIL.turf), colourNode(SOIL.topsoil).mul(earth), layer(.14, .03, 0));
  colour = tsl(mix)(colour, subsoil, layer(1.0, .12, 11));
  colour = tsl(mix)(colour, colourNode(SOIL.gravel).mul(earth), layer(2.9, .15, 23));
  colour = tsl(mix)(colour, rock, layer(3.6, .2, 37));
  // Water at the rim: the face shows its depth before the silt below.
  const wet = tsl(smoothstep)(-.62, -.68, rim).mul(tsl(smoothstep)(.95, .8, depth));
  material.colorNode = tsl(mix)(colour, colourNode(winter ? SOIL.snow : SOIL.water), wet);
  material.roughnessNode = tsl(mix)(1, .25, wet);
  material.name = "Diorama soil strata";
  return material;
}

/** Stained walnut for the diorama's base, with a grain running along its length. */
export function createWoodMaterial(): THREE.Material {
  const material = new MeshStandardNodeMaterial({ color: 0xffffff, roughness: .55, metalness: 0 });
  const world = positionWorld as any;
  const grain = tsl(mx_noise_float)(tsl(vec3)(world.x.mul(.08), world.z.mul(2.4).add(world.y.mul(2.4)), 0).xy)
    .add(tsl(mx_noise_float)(tsl(vec3)(world.x.mul(.5), world.z.mul(9).add(world.y.mul(9)), 0).xy).mul(.3));
  material.colorNode = tsl(mix)(colourNode(new THREE.Color(0x2a1a10)), colourNode(new THREE.Color(0x4a3020)),
    tsl(smoothstep)(-.4, .5, grain));
  material.name = "Walnut diorama base";
  return material;
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

/** Linear-light colours of the open water, by depth (distance from the shore). */
const SHALLOW_WATER = new THREE.Color(0x4d7568);
const DEEP_WATER = new THREE.Color(0x16323a);
const SHORE_FOAM = new THREE.Color(0xd8ddd0);
/** Vertex colour the generator gives water; fog-of-war memory shading departs from it. */
const WATER_VERTEX = new THREE.Color(0x78aaa4);

/**
 * Still water: shallow and greener by the shore, deep blue-green further out,
 * a broken foam line at the waterline, a sky sheen at grazing angles and a
 * static ripple in the normal for the sun to glint on. Nothing animates, so an
 * idle battle still renders no frames.
 */
function createWaterMaterial(): THREE.MeshStandardMaterial {
  const material = new MeshStandardNodeMaterial({ color: 0xffffff, roughness: .28, metalness: 0, side: THREE.DoubleSide });
  const shore = tsl(attribute)(SHORE_DISTANCE, "float");
  const world = positionWorld as any;
  const depth = tsl(smoothstep)(.2, 2.6, shore);
  const colour = tsl(mix)(tsl(vec3)(SHALLOW_WATER.r, SHALLOW_WATER.g, SHALLOW_WATER.b),
    tsl(vec3)(DEEP_WATER.r, DEEP_WATER.g, DEEP_WATER.b), depth);
  const breakup = tsl(mx_noise_float)(world.xz.mul(.9)).mul(.5).add(.5);
  const foam = tsl(smoothstep)(.32, .02, shore).mul(tsl(smoothstep)(.3, .75, breakup)).mul(.5);
  // Remembered (explored, unseen) water is shaded through its vertex colour like the land.
  const memory = tsl(vertexColor)().div(tsl(vec3)(WATER_VERTEX.r, WATER_VERTEX.g, WATER_VERTEX.b)).clamp(0, 1.2);
  material.colorNode = tsl(mix)(colour, tsl(vec3)(SHORE_FOAM.r, SHORE_FOAM.g, SHORE_FOAM.b), foam).mul(memory);
  // Ripples: tilt the flat normal by the gradient of two octaves of noise.
  const step = .08, strength = .1;
  const h = (x: number, z: number): any => {
    const at = world.xz.add(tsl(vec3)(x, z, 0).xy);
    return tsl(mx_noise_float)(at.mul(.8)).add(tsl(mx_noise_float)(at.mul(2.2).add(7)).mul(.35));
  };
  const slopeX = h(step, 0).sub(h(-step, 0)).div(step * 2), slopeZ = h(0, step).sub(h(0, -step)).div(step * 2);
  const rippled = tsl(vec3)(slopeX.mul(-strength), 1, slopeZ.mul(-strength)).normalize();
  material.normalNode = tsl(transformNormalToView)(rippled);
  const view = (cameraPosition as any).sub(positionWorld).normalize();
  const facing = rippled.dot(view).clamp(0, 1);
  const fresnel = facing.oneMinus().pow(4).mul(.3).add(.03);
  material.emissiveNode = tsl(vec3)(.5, .58, .62).mul(fresnel).mul(tsl(smoothstep)(.3, 0, foam)).mul(memory);
  material.name = "Generated water ground material";
  return material as unknown as THREE.MeshStandardMaterial;
}
