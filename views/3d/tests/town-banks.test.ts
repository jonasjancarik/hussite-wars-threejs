import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import * as THREE from "three";
import { GeneratedTerrain } from "../src/generated-terrain.ts";
import type { BattleSnapshot } from "../src/types.ts";

interface Scenario {
  mapSize: { width: number; height: number };
  mapRevision?: number;
  terrain: Record<string, string | number[][]>;
}
interface XZ { x: number; z: number }
type Point3 = [number, number, number];

const root = new URL("../../../", import.meta.url);
const scenarios = runInNewContext(`${readFileSync(new URL("js/data/scenarios.js", root), "utf8")}; Scenarios`) as Record<string, Scenario>;

function snapshot(id: string): BattleSnapshot {
  const scenario = scenarios[id]!;
  const assigned = new Map<string, string>();
  for (const [terrain, coordinates] of Object.entries(scenario.terrain)) {
    if (Array.isArray(coordinates)) for (const [col, row] of coordinates) assigned.set(`${col},${row}`, terrain);
  }
  const tiles = [];
  for (let col = 0; col < scenario.mapSize.width; col += 1) for (let row = 0; row < scenario.mapSize.height; row += 1) {
    tiles.push({ col, row, terrain: assigned.get(`${col},${row}`) ?? "plains" });
  }
  return {
    protocolVersion: 2, generation: 1, revision: 1, scenario: id, seed: scenario.mapRevision ?? 1,
    cols: scenario.mapSize.width, rows: scenario.mapSize.height, round: 1, faction: "hussites", state: "playing",
    busy: false, paused: false, aiRunning: false, fogOfWar: false, tiles, units: [], selectedUnitId: null,
    legalMoves: [], legalAttacks: [], marchTargets: [], visibleHexes: [], exploredHexes: [], events: [],
  };
}

function waterTriangles(terrain: GeneratedTerrain): Point3[][] {
  const mesh = terrain.interactiveMeshes.find(object => object instanceof THREE.Mesh);
  assert.ok(mesh instanceof THREE.Mesh, "generated terrain should expose its surface mesh");
  const geometry = mesh.geometry, index = geometry.index;
  assert.ok(index, "generated terrain surface should be indexed");
  const positions = geometry.getAttribute("position") as THREE.BufferAttribute;
  const result: Point3[][] = [];
  for (const group of geometry.groups) {
    if (group.materialIndex !== 4) continue;
    for (let offset = group.start; offset < group.start + group.count; offset += 3) {
      result.push([0, 1, 2].map(vertex => {
        const item = Number(index.array[offset + vertex]!);
        return [positions.getX(item), positions.getY(item), positions.getZ(item)] as Point3;
      }));
    }
  }
  return result;
}

function inside(point: XZ, polygon: readonly XZ[]): boolean {
  let insidePolygon = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]!, b = polygon[j]!;
    if ((a.z > point.z) !== (b.z > point.z)
      && point.x < (b.x - a.x) * (point.z - a.z) / (b.z - a.z) + a.x) insidePolygon = !insidePolygon;
  }
  return insidePolygon;
}

function segmentDistance(point: XZ, a: XZ, b: XZ): number {
  const dx = b.x - a.x, dz = b.z - a.z;
  const lengthSq = dx * dx + dz * dz;
  const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.z - a.z) * dz) / lengthSq));
  return Math.hypot(point.x - (a.x + dx * t), point.z - (a.z + dz * t));
}

function distanceToPolygon(point: XZ, polygon: readonly XZ[]): number {
  let minimum = Infinity;
  for (let i = 0; i < polygon.length; i += 1) minimum = Math.min(minimum,
    segmentDistance(point, polygon[i]!, polygon[(i + 1) % polygon.length]!));
  return minimum;
}

function waterSampleFraction(terrain: GeneratedTerrain, sourceTiles: BattleSnapshot["tiles"]): { water: number; total: number; fraction: number } {
  const spacing = .25;
  let water = 0, total = 0;
  for (const cell of sourceTiles) {
    if (!/^(water|river|lake)$/i.test(cell.terrain)) continue;
    const centre = terrain.layout.center(cell.col, cell.row);
    const radius = terrain.layout.radius, apothem = radius * Math.sqrt(3) / 2;
    for (let x = centre.x - radius; x <= centre.x + radius + 1e-8; x += spacing) {
      for (let z = centre.z - apothem; z <= centre.z + apothem + 1e-8; z += spacing) {
        let inHex = true;
        for (let side = 0; side < 6; side += 1) {
          const angle = (side + .5) * Math.PI / 3;
          if ((x - centre.x) * Math.cos(angle) + (z - centre.z) * Math.sin(angle) > apothem + 1e-8) {
            inHex = false;
            break;
          }
        }
        if (!inHex) continue;
        total += 1;
        if (terrain.renderedTerrainAt(x, z) === "water") water += 1;
      }
    }
  }
  return { water, total, fraction: total ? water / total : 0 };
}

test("Žatec and Německý Brod keep rendered water outside enclosed town banks", () => {
  for (const id of ["zatec_1421", "nemecky_brod_1422"]) {
    const state = snapshot(id);
    const originalTiles = state.tiles.map(tile => ({ ...tile }));
    const terrain = new GeneratedTerrain(state);
    try {
      const loops = terrain.environmentPlan.walls.flatMap(wall => wall.loops.map(loop => loop.points.map(point => ({ x: point.x, z: point.z }))));
      assert.ok(loops.length > 0, `${id} should generate town wall loops`);

      let offending: { point: XZ; loop: number; triangle: Point3[]; distance: number } | undefined;
      for (const triangle of waterTriangles(terrain)) {
        const point = {
          x: (triangle[0]![0] + triangle[1]![0] + triangle[2]![0]) / 3,
          z: (triangle[0]![2] + triangle[1]![2] + triangle[2]![2]) / 3,
        };
        for (let loop = 0; loop < loops.length; loop += 1) {
          const polygon = loops[loop]!;
          const distance = distanceToPolygon(point, polygon);
          if (distance > .22 && inside(point, polygon)) {
            offending = { point, loop, triangle, distance };
            break;
          }
        }
        if (offending) break;
      }
      assert.equal(offending, undefined, offending
        ? `${id} water triangle centroid is inside wall loop ${offending.loop}, ${offending.distance.toFixed(3)} from wall at (${offending.point.x.toFixed(3)}, ${offending.point.z.toFixed(3)}): ${JSON.stringify(offending.triangle)}`
        : undefined);

      const fraction = waterSampleFraction(terrain, originalTiles);
      assert.ok(fraction.total > 0, `${id} should have gameplay water cells to sample`);
      assert.ok(fraction.fraction >= .75,
        `${id} should render water across at least 75% of gameplay water-cell samples at 0.25 spacing (${fraction.water}/${fraction.total} = ${(fraction.fraction * 100).toFixed(1)}%)`);
      assert.deepEqual(state.tiles, originalTiles, `${id} visual bank correction must not modify source gameplay tiles`);
    } finally {
      terrain.dispose();
    }
  }
});
