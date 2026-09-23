/**
 * Faceted grass tufts placed the way a diorama builder places static-grass
 * tufts: in small clusters, gathered where things meet (wood edges, road
 * verges, banks, rocks) and only sparsely out on open ground. They receive
 * shadows but cast none. Presentation only.
 */
import * as THREE from "three";
import { decorationSeed } from "./generated-meadow.ts";
import { mulberry32 } from "./geometry-utils.ts";
import type { HexLayout } from "./hex-coordinates.ts";
import { fractalNoise, isWaterTerrain, type TerrainRegions } from "./terrain-regions.ts";
import { formationClearance } from "./woodland-plan.ts";

export interface TuftPlacement {
  x: number;
  z: number;
  rotation: number;
  scale: number;
  height: number;
  /** Linear RGB. */
  color: [number, number, number];
}

export interface TuftSource {
  field: TerrainRegions;
  layout: HexLayout;
  replacedCells: ReadonlySet<string>;
  /** Trees, shrubs and rocks tufts gather around. */
  features: ReadonlyArray<{ x: number; z: number }>;
}

const GRASSY = new Set(["plains", "hills", "hill", "ridge", "highland", "slope", "steep_slope", "forest", "field", "fields"]);
/** Lush sage-to-olive, a little deeper and greener than the ground so tufts read as growth, not specks. */
const PALETTE: Array<[number, number, number]> = [
  [.10, .14, .045], [.14, .17, .055], [.18, .18, .06], [.22, .20, .075], [.09, .12, .05],
];
/** Cluster attempts per hex before attraction thins them; the result is deliberately patchy. */
const SEEDS_PER_HEX = 18;

export function planTufts(source: TuftSource): TuftPlacement[] {
  const { field, layout } = source;
  const placements: TuftPlacement[] = [];
  const featureBuckets = new Map<string, Array<{ x: number; z: number }>>();
  const bucket = (x: number, z: number): string => `${Math.floor(x / 4)},${Math.floor(z / 4)}`;
  for (const feature of source.features) {
    const key = bucket(feature.x, feature.z);
    featureBuckets.set(key, [...featureBuckets.get(key) ?? [], feature]);
  }
  const nearFeature = (x: number, z: number): number => {
    let best = Infinity;
    for (let dx = -1; dx <= 1; dx += 1) for (let dz = -1; dz <= 1; dz += 1) {
      const [bx, bz] = bucket(x, z).split(",").map(Number) as [number, number];
      for (const feature of featureBuckets.get(`${bx + dx},${bz + dz}`) ?? []) {
        best = Math.min(best, Math.hypot(x - feature.x, z - feature.z));
      }
    }
    return best;
  };

  // How strongly a spot invites a cluster: transitions score high, open meadow low.
  const attraction = (x: number, z: number): number => {
    const terrain = field.classify(x, z)?.toLowerCase();
    if (!terrain || !GRASSY.has(terrain)) return 0;
    const road = field.roads.active ? field.roads.sample(x, z) : null;
    if ((road?.weight ?? 0) > .08) return 0;
    const water = field.waterInfluenceAt(x, z);
    if (water > .45) return 0;
    let score = .12;
    const feature = nearFeature(x, z);
    if (feature < 2.6) score += .75 * (1 - feature / 2.6);
    if (road && road.weight <= .08 && road.distance < layout.radius * .81 + 1.4) score += .6;
    if (water > .04) score += .7;
    const weights = field.weightsAt(x, z);
    if (Object.keys(weights).length > 1) score += .25;
    // Broad patches: some meadows are lusher than others.
    score *= .55 + .9 * THREE.MathUtils.smoothstep(fractalNoise(field.seed ^ 0x6a09e667, x / 13, z / 13, 2), -.3, .45);
    return score;
  };

  for (const cell of field.tiles) {
    if (source.replacedCells.has(`${cell.col},${cell.row}`)) continue;
    if (isWaterTerrain(cell.terrain) || !GRASSY.has(cell.terrain.toLowerCase())) continue;
    const random = mulberry32(decorationSeed(field.seed, cell.col, cell.row, "ground-tufts"));
    for (let seed = 0; seed < SEEDS_PER_HEX; seed += 1) {
      const angle = random() * Math.PI * 2, reach = Math.sqrt(random()) * layout.radius;
      const cx = cell.center.x + Math.cos(angle) * reach, cz = cell.center.z + Math.sin(angle) * reach;
      if (!layout.contains(cx, cz, cell.col, cell.row)) continue;
      if (random() > attraction(cx, cz)) continue;
      // Keep the ground under formations mostly clean; tufts would poke through feet and hooves.
      const underFormation = formationClearance(cx, cz, [cell]) < 0;
      if (underFormation && random() > .2) continue;
      const tone = PALETTE[Math.floor(random() * PALETTE.length)]!;
      const members = 4 + Math.floor(random() * 6);
      for (let member = 0; member < members; member += 1) {
        const spread = .1 + random() * .45;
        const theta = random() * Math.PI * 2;
        const x = cx + Math.cos(theta) * spread, z = cz + Math.sin(theta) * spread;
        const terrain = field.classify(x, z)?.toLowerCase();
        if (!terrain || !GRASSY.has(terrain) || (field.roads.active ? field.roads.sample(x, z)?.weight ?? 0 : 0) > .08) continue;
        const shade = .85 + random() * .3;
        placements.push({ x, z, rotation: random() * Math.PI * 2, scale: 1 + random() * .7, height: .75 + random() * .6,
          color: [tone[0] * shade, tone[1] * shade, tone[2] * shade] });
      }
    }
  }
  return placements;
}

/** One faceted tuft: six folded blades leaning outward, darker at the root. */
export function createTuftGeometry(): THREE.BufferGeometry {
  const positions: number[] = [], colors: number[] = [];
  const blades = 6;
  for (let blade = 0; blade < blades; blade += 1) {
    const angle = blade / blades * Math.PI * 2 + (blade % 2) * .35;
    const lean = .16 + (blade % 3) * .05, height = .34 + (blade % 3) * .07, half = .05;
    const dx = Math.cos(angle), dz = Math.sin(angle), px = -dz, pz = dx;
    const root = [dx * .04, 0, dz * .04];
    const left = [root[0]! + px * half, 0, root[2]! + pz * half];
    const right = [root[0]! - px * half, 0, root[2]! - pz * half];
    const ridge = [dx * (lean * .5) - dx * .015, height * .55, dz * (lean * .5) - dz * .015];
    const tip = [dx * lean, height, dz * lean];
    // Two triangles per side of the fold give the blade a lit and a shaded face.
    for (const [a, b, c] of [[left, ridge, tip], [ridge, right, tip], [left, right, ridge]] as const) {
      positions.push(...a, ...b, ...c);
      for (const vertex of [a, b, c]) {
        const t = vertex[1]! / height;
        colors.push(.55 + .45 * t, .55 + .45 * t, .55 + .45 * t);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

export function createTuftMesh(placements: readonly TuftPlacement[], heightAt: (x: number, z: number) => number): {
  mesh: THREE.InstancedMesh; matrices: THREE.Matrix4[];
} {
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff, vertexColors: true, flatShading: true, roughness: 1, metalness: 0, side: THREE.DoubleSide,
  });
  material.name = "Faceted grass tuft";
  const mesh = new THREE.InstancedMesh(createTuftGeometry(), material, Math.max(1, placements.length));
  mesh.name = "Generated grass tufts";
  mesh.count = placements.length;
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  const dummy = new THREE.Object3D(), color = new THREE.Color(), matrices: THREE.Matrix4[] = [];
  placements.forEach((placement, index) => {
    dummy.position.set(placement.x, heightAt(placement.x, placement.z) - .02, placement.z);
    dummy.rotation.set(0, placement.rotation, 0);
    dummy.scale.set(placement.scale, placement.scale * placement.height, placement.scale);
    dummy.updateMatrix();
    mesh.setMatrixAt(index, dummy.matrix);
    mesh.setColorAt(index, color.setRGB(...placement.color));
    matrices.push(dummy.matrix.clone());
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  return { mesh, matrices };
}
