import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import * as THREE from "three";
import { bridgeRelief } from "../src/environment-plan.ts";
import { GeneratedTerrain } from "../src/generated-terrain.ts";
import type { BattleSnapshot } from "../src/types.ts";

interface Scenario {
  mapSize: { width: number; height: number };
  mapRevision?: number;
  terrain: Record<string, string | number[][]>;
}

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

type Point = [number, number, number];

function surfaceMesh(terrain: GeneratedTerrain): THREE.Mesh {
  const mesh = terrain.interactiveMeshes.find(object => object instanceof THREE.Mesh);
  assert.ok(mesh instanceof THREE.Mesh, "generated terrain should expose its surface mesh");
  return mesh;
}

function materialTriangles(mesh: THREE.Mesh, materialIndex: number): Point[][] {
  const geometry = mesh.geometry;
  const index = geometry.index;
  assert.ok(index, "generated terrain should be indexed");
  const position = geometry.getAttribute("position") as THREE.BufferAttribute;
  const result: Point[][] = [];
  for (const group of geometry.groups) {
    if (group.materialIndex !== materialIndex) continue;
    for (let offset = group.start; offset < group.start + group.count; offset += 3) {
      result.push([0, 1, 2].map(vertex => {
        const item = Number(index.array[offset + vertex]!);
        return [position.getX(item), position.getY(item), position.getZ(item)] as Point;
      }));
    }
  }
  return result;
}

function polygonArea(points: readonly Point[]): number {
  return Math.abs(points.reduce((area, point, index) => {
    const next = points[(index + 1) % points.length]!;
    return area + point[0] * next[2] - next[0] * point[2];
  }, 0)) / 2;
}

function trianglesArea(points: readonly number[]): number {
  let result = 0;
  for (let offset = 0; offset + 8 < points.length; offset += 9) {
    result += polygonArea([
      [points[offset]!, points[offset + 1]!, points[offset + 2]!],
      [points[offset + 3]!, points[offset + 4]!, points[offset + 5]!],
      [points[offset + 6]!, points[offset + 7]!, points[offset + 8]!],
    ]);
  }
  return result;
}

function clip(points: readonly Point[], distance: (point: Point) => number): Point[] {
  const result: Point[] = [];
  for (let index = 0; index < points.length; index += 1) {
    const a = points[index]!, b = points[(index + 1) % points.length]!;
    const da = distance(a), db = distance(b), insideA = da <= 1e-8, insideB = db <= 1e-8;
    if (insideA) result.push(a);
    if (insideA !== insideB) {
      const t = da / (da - db);
      result.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]);
    }
  }
  return result;
}

function areaInsideHex(triangle: readonly Point[], terrain: GeneratedTerrain, col: number, row: number): number {
  const center = terrain.layout.center(col, row);
  const apothem = terrain.layout.radius * Math.sqrt(3) / 2;
  let polygon = [...triangle];
  for (let side = 0; side < 6 && polygon.length > 0; side += 1) {
    const angle = (side + .5) * Math.PI / 3;
    polygon = clip(polygon, point => (point[0] - center.x) * Math.cos(angle) + (point[2] - center.z) * Math.sin(angle) - apothem);
  }
  return polygonArea(polygon);
}

test("water mesh is flat, raycastable, and partitioned across every gameplay hex", () => {
  const terrain = new GeneratedTerrain(snapshot("nemecky_brod_1422"));
  const mesh = surfaceMesh(terrain);
  mesh.updateMatrixWorld(true);
  const water = materialTriangles(mesh, 4);
  assert.ok(water.length > 1_000, "Brod should contain a substantial water surface");

  const raycaster = new THREE.Raycaster();
  for (const triangle of water) {
    for (const point of triangle) assert.ok(Math.abs(point[1] + .7) < 2e-6, "water material must be flat at -0.7");
  }
  for (const triangle of [water[0]!, water[Math.floor(water.length / 2)]!, water.at(-1)!]) {
    const x = (triangle[0]![0] + triangle[1]![0] + triangle[2]![0]) / 3;
    const z = (triangle[0]![2] + triangle[1]![2] + triangle[2]![2]) / 3;
    raycaster.set(new THREE.Vector3(x, 20, z), new THREE.Vector3(0, -1, 0));
    const hit = raycaster.intersectObject(mesh, false)[0];
    assert.ok(hit, "water centroid should raycast to the rendered terrain mesh");
    assert.ok(Math.abs(hit.point.y - terrain.renderedHeightAt(x, z)) < 5e-5, "height oracle must use the split triangle");
    assert.equal(terrain.renderedTerrainAt(x, z), "water");
  }

  const expectedArea = water.reduce((area, triangle) => area + terrain.field.tiles.reduce((inside, cell) =>
    inside + areaInsideHex(triangle, terrain, cell.col, cell.row), 0), 0);
  const assignedArea = terrain.field.tiles.reduce((area, cell) => area + trianglesArea(terrain.waterTrianglesForCell(cell.col, cell.row)), 0);
  assert.ok(Math.abs(expectedArea - assignedArea) < expectedArea * .002,
    `water clips should cover the playable mesh once (${assignedArea} vs ${expectedArea})`);

  const bridge = terrain.environmentPlan.bridge!;
  assert.ok(bridge, "Brod retains its bridge");
  const bridgeBase = terrain.topography.elevationAt(bridge.x, bridge.z) + terrain.field.heightInputAt(bridge.x, bridge.z).variation * .24;
  for (const offset of [-5.4785, 0, 5.4785]) {
    const z = bridge.z + offset;
    assert.ok(Math.abs(terrain.heightAt(bridge.x, z) - (bridgeBase + bridgeRelief(bridge.x, z, bridge))) < 1e-9,
      `bridge centreline ${offset} must share its rigid deck datum`);
  }
  terrain.dispose();
});

test("outside-map rim inherits nearby dry terrain rather than becoming water", () => {
  const state: BattleSnapshot = {
    protocolVersion: 2, generation: 1, revision: 1, scenario: "rim-fixture", seed: 1, cols: 2, rows: 1,
    round: 1, faction: "hussites", state: "playing", busy: false, paused: false, aiRunning: false, fogOfWar: false,
    tiles: [{ col: 0, row: 0, terrain: "water" }, { col: 1, row: 0, terrain: "plains" }], units: [], selectedUnitId: null,
    legalMoves: [], legalAttacks: [], marchTargets: [], visibleHexes: [], exploredHexes: [], events: [],
  };
  const terrain = new GeneratedTerrain(state);
  const mesh = surfaceMesh(terrain);
  mesh.updateMatrixWorld(true);
  const x = terrain.bounds.maxX - .1;
  const z = terrain.layout.center(1, 0).z;
  assert.equal(terrain.layout.coordAt(x, z), null, "sample must be outside the playable map");
  const raycaster = new THREE.Raycaster(new THREE.Vector3(x, 20, z), new THREE.Vector3(0, -1, 0));
  const hit = raycaster.intersectObject(mesh, false)[0];
  assert.ok(hit);
  assert.notEqual(hit.face?.materialIndex, 4, "dry rim must not acquire water material from zero weights");
  assert.equal(terrain.renderedTerrainAt(x, z), "plains");
  terrain.dispose();
});
