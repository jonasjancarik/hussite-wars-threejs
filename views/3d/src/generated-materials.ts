import * as THREE from "three";
import { MeshStandardNodeMaterial } from "three/webgpu";
import { attribute, cameraPosition, dFdx, dFdy, Fn, If, mix, mx_noise_float, mx_worley_noise_vec2, normalWorld, normalWorldGeometry, positionWorld, smoothstep, texture as textureNode, transformNormalToView, uv, vec3, vertexColor } from "three/tsl";
import type { SurfaceMaterialKind } from "./terrain-surface.ts";

export { groundSplatChannel, surfaceMaterialIndex, surfaceMaterialKind, type SurfaceMaterialKind } from "./terrain-surface.ts";

/**
 * Per-vertex weights of the three ground textures (meadow, earth, grain).
 * Every dry-land material samples the same blend, so a change of terrain is a
 * soft transition of texture as well as colour, not a seam where the
 * triangle's material changes.
 */
export const GROUND_SPLAT = "groundSplat";
/** Per-vertex metres from open water to the shore (zero on land). */
export const SHORE_DISTANCE = "shoreDistance";
/**
 * Per-vertex place on a road: x is the distance from its axis as a share of
 * its half-width (0 on the axis, 1 at the verge), y how worn into ruts it is.
 */
export const ROAD_TRACK = "roadTrack";

type TslFactory = (...arguments_: any[]) => any;
const tsl = (factory: unknown): TslFactory => factory as TslFactory;

/** Anisotropic filtering of the ground textures at the High tier; lower tiers use less. */
export const GROUND_ANISOTROPY = 8;

function loadTexture(baseUrl: string, path: string, repeat: number): THREE.Texture {
  const texture = new THREE.TextureLoader().load(new URL(path, baseUrl).href);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.MirroredRepeatWrapping;
  texture.repeat.setScalar(repeat);
  texture.anisotropy = GROUND_ANISOTROPY;
  return texture;
}

/** Ground whose normal is steeper than this starts to show rock (about 34°)... */
const CLIFF_FLAT_NORMAL_Y = .83;
/** ...and is all rock from about 52°. */
const CLIFF_STEEP_NORMAL_Y = .62;
const CLIFF_TILE_METRES = 5.5;
const CLIFF_BRIGHTNESS = 1.15;

/**
 * World-space triplanar sample, blended by the geometric normal, taken only
 * where `weight` is above zero: most of the board is flat and would discard
 * all three samples. Inside the branch the texture is sampled with gradients
 * computed outside it, since WGSL allows implicit-derivative sampling only
 * in uniform control flow.
 */
function triplanar(map: THREE.Texture, tileMetres: number, weight: any): any {
  return tsl(Fn)(() => {
    const position = (positionWorld as any).div(tileMetres);
    const axes = (normalWorldGeometry as any).abs().pow(4);
    const share = axes.div(axes.x.add(axes.y).add(axes.z));
    const projections = [position.zy, position.xz, position.xy].map(coordinates =>
      ({ coordinates, dx: tsl(dFdx)(coordinates), dy: tsl(dFdy)(coordinates) }));
    const result = tsl(vec3)(0, 0, 0).toVar();
    tsl(If)(weight.greaterThan(0), () => {
      const [x, y, z] = projections.map(({ coordinates, dx, dy }) => tsl(textureNode)(map, coordinates).grad(dx, dy).rgb);
      result.assign(x!.mul(share.x).add(y!.mul(share.y)).add(z!.mul(share.z)));
    });
    return result;
  })();
}

/** Texture nodes ignore `repeat` unless asked to; scale the UV explicitly instead. */
function groundLayer(map: THREE.Texture | null): any {
  return map ? tsl(textureNode)(map, tsl(uv)().mul(map.repeat.x)).rgb : tsl(vec3)(1, 1, 1);
}

/**
 * @param snow colour of the snow-covered ground around a winter road, so its
 *   verges drift over without a seam.
 */
export function createGeneratedSurfaceMaterials(assetBase?: string, winter = false, snow?: THREE.Color): {
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
  const earthMap = texture("textures/sudomer-pond-mud.webp", 1.25);
  const slopeMap = texture("textures/earth-grain.webp", 2.8);
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
  const rock = cliffMap ? triplanar(cliffMap, CLIFF_TILE_METRES, steep) : tsl(vec3)(.42, .40, .37);
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
    winter ? createWinterRoadMaterial(slopeMap, snow ?? SOIL.snow) : material("road", slopeMap, 1),
  ], textures, soil: createSoilMaterial(winter) };
}

/**
 * A snowbound road: frozen mud worn into two wheel ruts, packed snow between
 * and around them in drifting patches, and snow creeping in raggedly from each
 * verge, so the road reads as a used track rather than a ruled brown band.
 */
function createWinterRoadMaterial(map: THREE.Texture | null, snow: THREE.Color): THREE.MeshStandardMaterial {
  const track = tsl(attribute)(ROAD_TRACK, "vec2");
  const across = track.x;
  const at = (positionWorld as any).xz;
  const broad = tsl(mx_noise_float)(at.mul(.21));
  const fine = tsl(mx_noise_float)(at.mul(1.15).add(5.3));
  const speckle = tsl(mx_noise_float)(at.mul(4.2).add(11.7));
  const mud = groundLayer(map).mul(tsl(vertexColor)()).mul(.82);
  // Two ruts either side of the axis: darker, wetter-looking frozen mud.
  const rut = tsl(smoothstep)(.1, .03, across.sub(.29).abs().add(fine.mul(.025))).mul(track.y);
  // Packed snow lies in drifting patches wherever wheels have not cut through.
  const packed = tsl(smoothstep)(.1, .5, broad.mul(.8).add(fine.mul(.35)).add(speckle.mul(.12))).mul(rut.oneMinus()).mul(.7);
  // The verges fray: snow reaches in unevenly from each side.
  const verge = tsl(smoothstep)(.7, .98, across.add(broad.mul(.14)).add(fine.mul(.08)));
  const snowColour = colourNode(snow);
  const packedColour = snowColour.mul(tsl(vec3)(.84, .81, .76));
  let colour = tsl(mix)(mud, mud.mul(tsl(vec3)(.62, .6, .6)), rut);
  colour = tsl(mix)(colour, packedColour, packed);
  colour = tsl(mix)(colour, snowColour, verge);
  const result = new MeshStandardNodeMaterial({ color: 0xffffff, vertexColors: false, roughness: 1, metalness: 0,
    side: THREE.DoubleSide });
  result.colorNode = colour;
  result.map = map;
  result.name = "Generated road ground material";
  return result as unknown as THREE.MeshStandardMaterial;
}

/** Per-vertex height of the terrain rim above a point of the diorama's cut face. */
export const RIM_TOP = "rimTop";
/** 1 where the rim above a point of the cut face is open water, else 0. */
export const RIM_WATER = "rimWater";

/** Linear-light colours of the soil profile, top to bottom. */
const SOIL = {
  turf: new THREE.Color(0x5d6a2c), snow: new THREE.Color(0xe4e8e2), topsoil: new THREE.Color(0x3a2a1e),
  subsoil: new THREE.Color(0xa47a4a), gravel: new THREE.Color(0x8a7458), bedrock: new THREE.Color(0x857c6e),
  pebble: new THREE.Color(0x9f927a), joint: new THREE.Color(0x3b3129),
  water: new THREE.Color(0x1f3d44),
};
const colourNode = (colour: THREE.Color): any => tsl(vec3)(colour.r, colour.g, colour.b);

/**
 * The cut face around the board, drawn like a textbook cross-section and
 * coloured by depth below its rim: a turf lip (snow in winter), dark topsoil,
 * ochre subsoil with faint sediment bands and scattered outlined pebbles, a
 * band of gravel, then a sheet of bedrock stones with dark joints. The stones
 * come from cell noise across the face, so nothing tiles or repeats. Where
 * the rim is water, a band of water shows above the silt.
 */
function createSoilMaterial(winter: boolean): THREE.Material {
  const material = new MeshStandardNodeMaterial({ color: 0xffffff, roughness: 1, metalness: 0, side: THREE.DoubleSide });
  const world = positionWorld as any;
  const rim = tsl(attribute)(RIM_TOP, "float");
  const along = world.x.add(world.z);
  const depth = rim.sub(world.y);
  const noise = (x: any, y: any): any => tsl(mx_noise_float)(tsl(vec3)(x, y, 0).xy);
  const cells = (x: any, y: any): any => tsl(mx_worley_noise_vec2)(tsl(vec3)(x, y, 0).xy, .9);
  const wander = (offset: number): any => noise(along.mul(.22), offset).mul(.28).add(noise(along.mul(.9), offset + 3).mul(.06));
  const layer = (from: number, width: number, offset: number): any =>
    tsl(smoothstep)(from - width, from + width, depth.add(wander(offset)));
  // Slow tonal drift along the face; faint sediment bands in the subsoil.
  const drift = noise(along.mul(.15), depth.mul(.5)).mul(.1).add(1);
  const bands = noise(along.mul(.25), depth.mul(3.2)).mul(.07).add(1);
  // Pebbles: a sparse scatter of small outlined stones in the subsoil.
  const grit = cells(along.div(.45), depth.div(.38));
  // Pebbles gather in flat lenses, as sediment settles, not in vertical runs.
  const scatter = tsl(smoothstep)(.35, .55, noise(along.mul(.45), depth.mul(1.6)));
  const pebble = tsl(smoothstep)(.24, .18, grit.x).mul(scatter);
  const outline = tsl(smoothstep)(.18, .22, grit.x).mul(tsl(smoothstep)(.27, .22, grit.x)).mul(scatter);
  const subsoil = tsl(mix)(tsl(mix)(colourNode(SOIL.subsoil).mul(bands), colourNode(SOIL.pebble), pebble),
    colourNode(SOIL.joint), outline.mul(.45));
  // Gravel: small, close-packed stones; bedrock: broad stones laid in courses.
  const gravelCells = cells(along.div(.35), depth.div(.28));
  const gravel = tsl(mix)(colourNode(SOIL.gravel), colourNode(SOIL.joint),
    tsl(smoothstep)(.12, .02, gravelCells.y.sub(gravelCells.x)).mul(.7));
  // Bedrock blocks, only a little wider than tall so they read as rock, not stretched paving.
  const stoneCells = cells(along.div(1.5), depth.div(1.15));
  const stoneTone = noise(along.div(1.5).floor(), depth.div(1.15).floor()).mul(.12)
    .add(noise(along.mul(.6), depth.mul(.6)).mul(.08)).add(1);
  const joint = tsl(smoothstep)(.07, .015, stoneCells.y.sub(stoneCells.x));
  const bedrock = tsl(mix)(colourNode(SOIL.bedrock).mul(stoneTone), colourNode(SOIL.joint), joint.mul(.75));
  let colour = tsl(mix)(colourNode(winter ? SOIL.snow : SOIL.turf), colourNode(SOIL.topsoil), layer(.2, .03, 0));
  colour = tsl(mix)(colour, subsoil, layer(1.0, .15, 11));
  colour = tsl(mix)(colour, gravel, layer(3.0, .12, 23));
  colour = tsl(mix)(colour, bedrock, layer(3.6, .1, 37));
  // Water at the rim: the face shows its depth before the silt below.
  const wet = tsl(attribute)(RIM_WATER, "float").mul(tsl(smoothstep)(.95, .8, depth));
  material.colorNode = tsl(mix)(colour.mul(drift), colourNode(winter ? SOIL.snow : SOIL.water), wet);
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
  // Forward differences: three height samples (six noise calls) instead of four.
  const centre = h(0, 0);
  const slopeX = h(step, 0).sub(centre).div(step), slopeZ = h(0, step).sub(centre).div(step);
  const rippled = tsl(vec3)(slopeX.mul(-strength), 1, slopeZ.mul(-strength)).normalize();
  material.normalNode = tsl(transformNormalToView)(rippled);
  const view = (cameraPosition as any).sub(positionWorld).normalize();
  const facing = rippled.dot(view).clamp(0, 1);
  const fresnel = facing.oneMinus().pow(4).mul(.3).add(.03);
  material.emissiveNode = tsl(vec3)(.5, .58, .62).mul(fresnel).mul(tsl(smoothstep)(.3, 0, foam)).mul(memory);
  material.name = "Generated water ground material";
  return material as unknown as THREE.MeshStandardMaterial;
}
