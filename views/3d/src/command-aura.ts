import * as THREE from "three";
import type { HexLayout } from "./hex-coordinates.ts";
import type { HexCoord, TerrainSurface } from "./types.ts";

/** Rim-to-centre width of the ground band, in hex radii. */
export const AURA_BAND_WIDTH = 0.26;
/** Ground clearance, just above the tactical grid (0.04). */
const LIFT = 0.07;
/** Points per hex edge, so the band follows the terrain. */
const EDGE_STEPS = 8;
/** Across the band: fraction of its width → opacity. A crisp rim easing to nothing inward. */
const BAND_PROFILE: ReadonlyArray<readonly [number, number]> = [[-0.05, 0], [0, 1], [0.07, 0.85], [0.3, 0.32], [0.62, 0.08], [1, 0]];

interface Point { x: number; z: number }
export interface AuraEdge { a: Point; b: Point; /** Unit normal pointing into the aura. */ inward: Point }

function hexDistance(from: HexCoord, to: HexCoord): number {
  const dq = to.col - from.col;
  const dr = to.row - Math.floor(to.col / 2) - (from.row - Math.floor(from.col / 2));
  return Math.max(Math.abs(dq), Math.abs(dr), Math.abs(dq + dr));
}

/** Hexes within `range` of the commander, clipped to the map (the same rule as the game's aura). */
export function commandAuraCells(layout: HexLayout, commander: HexCoord, range: number): HexCoord[] {
  const cells: HexCoord[] = [];
  for (let col = Math.max(0, commander.col - range); col <= Math.min(layout.cols - 1, commander.col + range); col += 1) {
    for (let row = Math.max(0, commander.row - range - 1); row <= Math.min(layout.rows - 1, commander.row + range + 1); row += 1) {
      if (hexDistance(commander, { col, row }) <= range) cells.push({ col, row });
    }
  }
  return cells;
}

/** Outer hex edges of the aura, each with the direction into the covered area. */
export function commandAuraEdges(layout: HexLayout, commander: HexCoord, range: number): AuraEdge[] {
  const edges: AuraEdge[] = [];
  for (const cell of commandAuraCells(layout, commander, range)) {
    const center = layout.center(cell.col, cell.row);
    for (let side = 0; side < 6; side += 1) {
      const a = { x: center.x + Math.cos(side * Math.PI / 3) * layout.radius, z: center.z + Math.sin(side * Math.PI / 3) * layout.radius };
      const b = { x: center.x + Math.cos((side + 1) * Math.PI / 3) * layout.radius,
        z: center.z + Math.sin((side + 1) * Math.PI / 3) * layout.radius };
      const mid = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };
      const neighbour = layout.coordAt(center.x + (mid.x - center.x) * 2, center.z + (mid.z - center.z) * 2);
      if (neighbour && hexDistance(commander, neighbour) <= range) continue;
      const length = Math.hypot(center.x - mid.x, center.z - mid.z);
      edges.push({ a, b, inward: { x: (center.x - mid.x) / length, z: (center.z - mid.z) / length } });
    }
  }
  return edges;
}

const vertexKey = (point: Point): string => `${point.x.toFixed(3)},${point.z.toFixed(3)}`;

/**
 * The aura's ground band: bright at the rim, fading toward the commander, with
 * per-vertex opacity for a material with `vertexColors`.
 */
export function commandAuraGeometry(layout: HexLayout, terrain: Pick<TerrainSurface, "heightAt" | "renderedHeightAt">,
  commander: HexCoord, range: number, offset: Point = { x: 0, z: 0 }): THREE.BufferGeometry {
  const edges = commandAuraEdges(layout, commander, range);
  // Every boundary vertex joins exactly two boundary edges on a hex grid, so a
  // mitred inward direction per vertex keeps neighbouring strips seamless.
  const normals = new Map<string, Point[]>();
  for (const edge of edges) {
    for (const point of [edge.a, edge.b]) {
      const key = vertexKey(point);
      normals.set(key, [...normals.get(key) ?? [], edge.inward]);
    }
  }
  const width = layout.radius * AURA_BAND_WIDTH;
  const inset = (point: Point): Point => {
    const around = normals.get(vertexKey(point)) ?? [];
    const sum = around.reduce((total, normal) => ({ x: total.x + normal.x, z: total.z + normal.z }), { x: 0, z: 0 });
    const length = Math.hypot(sum.x, sum.z);
    if (length < 1e-6 || !around[0]) return { x: 0, z: 0 };
    const direction = { x: sum.x / length, z: sum.z / length };
    const miter = Math.min(2, 1 / Math.max(0.2, direction.x * around[0].x + direction.z * around[0].z));
    return { x: direction.x * miter, z: direction.z * miter };
  };
  const ground = (x: number, z: number): number => Math.max(terrain.renderedHeightAt?.(x, z) ?? terrain.heightAt(x, z), -0.52);

  const band = { positions: [] as number[], colors: [] as number[], indices: [] as number[] };
  const strip = (target: typeof band, columns: number, rows: number): void => {
    const base = target.positions.length / 3 - (columns + 1) * rows;
    for (let column = 0; column < columns; column += 1) {
      for (let row = 0; row < rows - 1; row += 1) {
        const a = base + column * rows + row, b = a + rows, c = a + 1, d = b + 1;
        target.indices.push(a, b, c, b, d, c);
      }
    }
  };
  for (const edge of edges) {
    const insetA = inset(edge.a), insetB = inset(edge.b);
    for (let step = 0; step <= EDGE_STEPS; step += 1) {
      const t = step / EDGE_STEPS;
      const x = THREE.MathUtils.lerp(edge.a.x, edge.b.x, t) + offset.x;
      const z = THREE.MathUtils.lerp(edge.a.z, edge.b.z, t) + offset.z;
      const inX = THREE.MathUtils.lerp(insetA.x, insetB.x, t), inZ = THREE.MathUtils.lerp(insetA.z, insetB.z, t);
      for (const [across, alpha] of BAND_PROFILE) {
        const px = x + inX * width * across, pz = z + inZ * width * across;
        band.positions.push(px, ground(px, pz) + LIFT, pz);
        band.colors.push(1, 1, 1, alpha);
      }
    }
    strip(band, EDGE_STEPS, BAND_PROFILE.length);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(band.positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(band.colors, 4));
  geometry.setIndex(band.indices);
  geometry.computeBoundingSphere();
  return geometry;
}
