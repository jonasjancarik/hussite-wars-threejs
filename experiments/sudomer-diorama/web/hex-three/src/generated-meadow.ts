import * as THREE from "three";
import { mulberry32 } from "./geometry-utils.ts";
import { HexLayout } from "./hex-coordinates.ts";
import type { TerrainRegions } from "./terrain-regions.ts";

export interface MeadowPlacement {
  col: number;
  row: number;
  x: number;
  z: number;
  rotation: number;
  scale: number;
  verticalScale: number;
  color: number;
}

interface MeadowSource {
  field: TerrainRegions;
  layout: HexLayout;
}

export function decorationSeed(seed: number, col: number, row: number, feature: string): number {
  let value = seed ^ Math.imul(col + 1, 0x9e3779b1) ^ Math.imul(row + 1, 0x85ebca6b);
  for (let index = 0; index < feature.length; index += 1) {
    value ^= feature.charCodeAt(index);
    value = Math.imul(value, 0x01000193);
  }
  return value >>> 0;
}

function densityFor(terrain: string): number {
  const name = terrain.toLowerCase();
  if (name === "hills") return 16;
  if (name === "plains" || name === "dry") return 14;
  if (name === "forest") return 7;
  if (name === "slope") return 4;
  return 0;
}

export function createMeadowPlacements(source: MeadowSource): MeadowPlacement[] {
  const placements: MeadowPlacement[] = [];
  const palette = [0x7f884c, 0x92945b, 0xaaa36a, 0x707a43];
  for (const cell of source.field.tiles) {
    const count = densityFor(cell.terrain);
    if (count === 0) continue;
    const random = mulberry32(decorationSeed(source.field.seed, cell.col, cell.row, "meadow-grass"));
    for (let instance = 0, attempts = 0; instance < count && attempts < count * 12; attempts += 1) {
      const angle = random() * Math.PI * 2;
      const radius = THREE.MathUtils.lerp(1.45, source.layout.radius * 0.84, Math.sqrt(random()));
      const x = cell.center.x + Math.cos(angle) * radius;
      const z = cell.center.z + Math.sin(angle) * radius;
      if (!source.layout.contains(x, z, cell.col, cell.row)) continue;
      const classified = source.field.classify(x, z)?.toLowerCase();
      if (!classified || densityFor(classified) === 0) continue;
      const patch = Math.sin(x * 0.47 + source.field.seed * 0.001) * Math.cos(z * 0.39 - cell.col * 0.31);
      if (patch < -0.34 && random() < 0.72) continue;
      placements.push({ col: cell.col, row: cell.row, x, z,
        rotation: random() * Math.PI * 2,
        scale: THREE.MathUtils.lerp(0.50, 1.0, random()),
        verticalScale: THREE.MathUtils.lerp(0.92, 1.45, random()),
        color: palette[Math.floor(random() * palette.length)]!,
      });
      instance += 1;
    }
  }
  return placements;
}

export function createMeadowMesh(placements: MeadowPlacement[], heightAt: (x: number, z: number) => number): {
  mesh: THREE.InstancedMesh;
  matrices: THREE.Matrix4[];
} {
  const blade = new THREE.BufferGeometry();
  blade.setAttribute("position", new THREE.Float32BufferAttribute([
    -0.16, 0, 0, 0.04, 0.62, 0.03, 0.14, 0, 0,
    0, 0, -0.14, -0.04, 0.48, 0.08, 0, 0, 0.14,
  ], 3));
  blade.computeVertexNormals();
  const material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, side: THREE.DoubleSide });
  material.name = "Generated meadow grass material";
  const mesh = new THREE.InstancedMesh(blade, material, placements.length);
  mesh.name = "Generated terrain-derived meadow grass";
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  const dummy = new THREE.Object3D();
  const matrices: THREE.Matrix4[] = [];
  placements.forEach((placement, index) => {
    dummy.position.set(placement.x, heightAt(placement.x, placement.z) + 0.025, placement.z);
    dummy.rotation.set(0, placement.rotation, 0);
    dummy.scale.set(placement.scale, placement.scale * placement.verticalScale, placement.scale);
    dummy.updateMatrix();
    mesh.setMatrixAt(index, dummy.matrix);
    mesh.setColorAt(index, new THREE.Color(placement.color));
    matrices.push(dummy.matrix.clone());
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  return { mesh, matrices };
}
