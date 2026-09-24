import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { createGeneratedSurfaceMaterials, surfaceMaterialIndex, surfaceMaterialKind } from "../src/generated-materials.ts";
import { GeneratedTerrain } from "../src/generated-terrain.ts";
import { createTerrainRegions, type TerrainCell, type TerrainType } from "../src/terrain-regions.ts";
import type { BattleSnapshot } from "../src/types.ts";

const cols = 5, rows = 7;
type Coord = readonly [number, number];

function key(col: number, row: number): string { return `${col},${row}`; }

function sourceTiles(roads: readonly Coord[], overrides: Record<string, TerrainType> = {}) {
  const roadLabels = new Map(roads.map(([col, row]) => [key(col, row), overrides[key(col, row)] ?? "road"]));
  return Array.from({ length: cols * rows }, (_, index) => {
    const col = Math.floor(index / rows), row = index % rows;
    return { col, row, terrain: roadLabels.get(key(col, row)) ?? overrides[key(col, row)] ?? "plains" };
  });
}

function field(roads: readonly Coord[], overrides: Record<string, TerrainType> = {}) {
  const tiles = sourceTiles(roads, overrides);
  return createTerrainRegions({ cols, rows, tiles, scenario: "road-corridor-fixture", seed: 17,
    coreCoverage: .76, boundaryNoise: .75 });
}

function coverage(fieldResult: ReturnType<typeof field>, col: number, row: number): number {
  return fieldResult.measureCoverage(.1).cells.find(cell => cell.col === col && cell.row === row)!.coverage;
}

/** Where the road's weight drops through one half, walking from `x` in `direction`. */
function roadEdge(fieldResult: ReturnType<typeof field>, x: number, z: number, direction: 1 | -1): number {
  let result = 0;
  for (let offset = 0; offset <= 4.5; offset += .02) {
    if ((fieldResult.weightsAt(x + offset * direction, z).road ?? 0) >= .5) result = offset;
  }
  return x + result * direction;
}

type Point = [number, number, number];

function generatedRoadTerrain(): GeneratedTerrain {
  const tiles = sourceTiles([[2, 1], [2, 2], [2, 3], [2, 4]]);
  const snapshot: BattleSnapshot = {
    protocolVersion: 2, generation: 1, revision: 1, scenario: null, seed: 17, cols, rows,
    round: 1, faction: "hussites", state: "playing", busy: false, paused: false, aiRunning: false, fogOfWar: false,
    tiles, units: [], selectedUnitId: null, legalMoves: [], legalAttacks: [], marchTargets: [],
    visibleHexes: [], exploredHexes: [], events: [],
  };
  return new GeneratedTerrain(snapshot);
}

function surfaceMesh(terrain: GeneratedTerrain): THREE.Mesh {
  const mesh = terrain.interactiveMeshes.find(object => object instanceof THREE.Mesh);
  assert.ok(mesh instanceof THREE.Mesh);
  return mesh;
}

function materialTriangles(mesh: THREE.Mesh, materialIndex: number): Point[][] {
  const index = mesh.geometry.index;
  assert.ok(index);
  const position = mesh.geometry.getAttribute("position") as THREE.BufferAttribute;
  const triangles: Point[][] = [];
  for (const group of mesh.geometry.groups) {
    if (group.materialIndex !== materialIndex) continue;
    for (let offset = group.start; offset < group.start + group.count; offset += 3) {
      triangles.push([0, 1, 2].map(vertex => {
        const item = Number(index.array[offset + vertex]!);
        return [position.getX(item), position.getY(item), position.getZ(item)] as Point;
      }));
    }
  }
  return triangles;
}

function rightMaterialEdge(triangles: readonly Point[][], centerX: number, z: number): number {
  let edge = -Infinity;
  for (const triangle of triangles) for (let index = 0; index < 3; index += 1) {
    const a = triangle[index]!, b = triangle[(index + 1) % 3]!;
    if ((a[2] <= z && b[2] > z) || (b[2] <= z && a[2] > z)) {
      const x = a[0] + (b[0] - a[0]) * (z - a[2]) / (b[2] - a[2]);
      if (x >= centerX) edge = Math.max(edge, x);
    }
  }
  return edge;
}

test("connected corridors keep an unbroken road of gently varying width through hex joins", () => {
  const fieldResult = field([[2, 1], [2, 2], [2, 3], [2, 4]]);
  const x = fieldResult.centerAt(2, 2).x;
  const z1 = fieldResult.centerAt(2, 1).z;
  const z3 = fieldResult.centerAt(2, 3).z;
  const samples = Array.from({ length: 17 }, (_, index) => z1 + (z3 - z1) * index / 16);
  for (const z of samples) {
    assert.equal(fieldResult.weightsAt(x, z).road, 1, `road axis has a gap at ${z}`);
  }
  const widths = samples.map(z => roadEdge(fieldResult, x, z, 1) - roadEdge(fieldResult, x, z, -1));
  // A worn track: the width wanders a little, but never pinches at a join or balloons.
  assert.ok(widths.every(width => width > 5.7 && width < 7.2), widths.join(", "));
  assert.ok(Math.max(...widths) - Math.min(...widths) > .1, `road is ruler-straight: ${widths.join(", ")}`);
  const axes = samples.map(z => (roadEdge(fieldResult, x, z, 1) + roadEdge(fieldResult, x, z, -1)) / 2 - x);
  assert.ok(axes.every(axis => Math.abs(axis) < .6), axes.join(", "));
});

test("wheel ruts run the road's length and fade out past a dead end", () => {
  const fieldResult = field([[2, 1], [2, 2], [2, 3], [2, 4]]);
  const middle = fieldResult.centerAt(2, 2), end = fieldResult.centerAt(2, 1);
  const along = fieldResult.roads.sample(middle.x, middle.z)!;
  assert.equal(along.ruts, 1);
  assert.ok(along.across < .35, `axis sits ${along.across} of the way to the verge`);
  // Row 1 stops short of the board's edge: the ruts end instead of curling round the cap.
  assert.ok(fieldResult.roads.sample(end.x, end.z - 2.4)!.ruts < .05);
  const lone = field([[2, 3]]), centre = lone.centerAt(2, 3);
  assert.equal(lone.roads.sample(centre.x, centre.z)!.ruts, 0);
});

test("rendered road material follows the swept edge and shares the height oracle", () => {
  const terrain = generatedRoadTerrain();
  const mesh = surfaceMesh(terrain);
  mesh.updateMatrixWorld(true);
  const road = materialTriangles(mesh, 5);
  assert.ok(road.length > 0, "the road material must have its own triangles");
  const center = terrain.layout.center(2, 2);
  const z1 = terrain.layout.center(2, 1).z;
  const z2 = terrain.layout.center(2, 2).z;
  const z3 = terrain.layout.center(2, 3).z;
  const samples = [z1, (z1 + z2) / 2, z2, (z2 + z3) / 2, z3];
  const edges = samples.map(z => rightMaterialEdge(road, center.x, z) - center.x);
  // The material is cut where the swept road's weight crosses one half.
  const swept = samples.map(z => {
    let edge = 0;
    for (let offset = 0; offset <= 4.5; offset += .02) {
      const weights = terrain.field.weightsAt(center.x + offset, z);
      if ((weights.road ?? 0) >= (weights.plains ?? 0)) edge = offset;
    }
    return edge;
  });
  assert.ok(edges.every((edge, index) => Number.isFinite(edge) && Math.abs(edge - swept[index]!) < .12),
    `${edges.join(", ")} vs ${swept.join(", ")}`);
  assert.ok(edges.every(edge => edge > 2.8 && edge < 3.8), edges.join(", "));

  const z = (z1 + z2) / 2;
  const x = center.x + edges[1]! - .04;
  const raycaster = new THREE.Raycaster(new THREE.Vector3(x, 20, z), new THREE.Vector3(0, -1, 0));
  const hit = raycaster.intersectObject(mesh, false)[0];
  assert.ok(hit, "road edge should still be raycastable after splitting");
  assert.equal(hit.face?.materialIndex, 5, "inside edge sample must hit the road material");
  assert.equal(terrain.renderedTerrainAt(x, z), "road");
  assert.ok(Math.abs(hit.point.y - terrain.renderedHeightAt(x, z)) < 5e-5, "road split must update the height oracle");
  terrain.dispose();
});

test("road endpoints, isolated roads, and a road-surrounded dry cell keep required area", () => {
  const isolated = field([[2, 3]]);
  assert.ok(coverage(isolated, 2, 3) >= .75, `isolated road coverage ${coverage(isolated, 2, 3)}`);

  const connected = field([[2, 1], [2, 2], [2, 3], [2, 4]]);
  assert.ok(coverage(connected, 2, 1) >= .75, `road endpoint coverage ${coverage(connected, 2, 1)}`);

  // Odd-q neighbours of the interior cell 2,3: every surrounding source tile is a road.
  const surrounded = field([[3, 3], [3, 2], [2, 2], [1, 2], [1, 3], [2, 4]]);
  assert.equal(surrounded.getCell(2, 3)?.terrain, "plains");
  assert.ok(coverage(surrounded, 2, 3) >= .75, `surrounded dry coverage ${coverage(surrounded, 2, 3)}`);
});

test("disconnected roads do not bridge and generation preserves tile labels", () => {
  const disconnected = field([[1, 2], [3, 2]]);
  const left = disconnected.getCell(1, 2)!.center;
  const right = disconnected.getCell(3, 2)!.center;
  const midpoint = { x: (left.x + right.x) / 2, z: (left.z + right.z) / 2 };
  assert.ok((disconnected.weightsAt(midpoint.x, midpoint.z).road ?? 0) < .01, "separate endpoints must not create a connector");

  const roads: Coord[] = [[2, 1], [2, 2], [2, 3]];
  const labels = { [key(2, 1)]: "road2", [key(2, 2)]: "dam", [key(2, 3)]: "road" };
  const source = sourceTiles(roads, labels);
  const unchanged = structuredClone(source);
  const first = createTerrainRegions({ cols, rows, tiles: source, scenario: "road-corridor-fixture", seed: 17,
    coreCoverage: .76, boundaryNoise: .75 });
  const second = field(roads, labels);
  const expected = source.map(cell => [cell.col, cell.row, cell.terrain]);
  assert.deepEqual(source, unchanged, "corridor generation must not mutate source labels");
  assert.deepEqual(second.tiles.map((cell: TerrainCell) => [cell.col, cell.row, cell.terrain]), expected);
  assert.deepEqual(first.tiles.map((cell: TerrainCell) => [cell.col, cell.row, cell.terrain]), expected,
    "corridor generation must not mutate source labels");
  for (const point of [first.centerAt(2, 2), first.centerAt(2, 3), first.centerAt(1, 3)]) {
    assert.deepEqual(first.weightsAt(point.x, point.z), second.weightsAt(point.x, point.z));
  }
});

test("road uses a distinct dry material from pond mud", () => {
  assert.equal(surfaceMaterialKind("road"), "road");
  assert.equal(surfaceMaterialKind("mud"), "earth");
  assert.notEqual(surfaceMaterialIndex("road"), surfaceMaterialIndex("mud"));
  const surface = createGeneratedSurfaceMaterials();
  assert.equal(surface.materials[surfaceMaterialIndex("road")]!.name, "Generated road ground material");
  assert.equal(surface.materials[surfaceMaterialIndex("mud")]!.name, "Generated earth ground material");
  surface.materials.forEach(material => material.dispose());
});
