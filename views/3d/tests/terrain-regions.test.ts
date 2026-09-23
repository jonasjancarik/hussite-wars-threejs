import assert from "node:assert/strict";
import test from "node:test";
import {
  createTerrainRegions,
  isFieldTerrain,
  measureTerrainCoverage,
  type TerrainRegionOptions,
  type TerrainTile,
} from "../src/terrain-regions.ts";

test("field terrain aliases remain distinct from ordinary plains", () => {
  for (const name of ["field", "fields", "farmland", "cropland", "FARMLAND"]) {
    assert.equal(isFieldTerrain(name), true, name);
  }
  assert.equal(isFieldTerrain("plains"), false);
  const regions = createTerrainRegions({ cols: 2, rows: 1, tiles: [
    { col: 0, row: 0, terrain: "plains" }, { col: 1, row: 0, terrain: "farmland" },
  ] });
  assert.equal(regions.classify(regions.getCell(0, 0)!.center.x, regions.getCell(0, 0)!.center.z), "plains");
  assert.equal(regions.classify(regions.getCell(1, 0)!.center.x, regions.getCell(1, 0)!.center.z), "farmland");
});

function sudomerTiles(): TerrainTile[] {
  const tiles: TerrainTile[] = [];
  for (let col = 0; col < 20; col += 1) {
    for (let row = 0; row < 12; row += 1) {
      const terrain = col >= 6 && col <= 13 && row <= 4
        ? "water"
        : col >= 6 && col <= 13 && row >= 7
          ? "mud"
          : col === 9 && (row === 5 || row === 6)
            ? "dam"
            : "plains";
      tiles.push({ col, row, terrain });
    }
  }
  return tiles;
}

function field(overrides: Partial<TerrainRegionOptions> = {}) {
  return createTerrainRegions({
    cols: 20,
    rows: 12,
    tiles: sudomerTiles(),
    scenario: "sudomere_1420",
    seed: 14200325,
    ...overrides,
  });
}

test("classification and height inputs are deterministic for a scenario seed", () => {
  const first = field();
  const second = field();
  const samples = [
    [-29.2, -20.1],
    [-1.5, -11.6],
    [4.4, 0.6],
    [33.7, 18.3],
  ];
  for (const [x, z] of samples) {
    assert.equal(first.classify(x, z), second.classify(x, z));
    assert.deepEqual(first.weightsAt(x, z), second.weightsAt(x, z));
    assert.deepEqual(first.heightInputAt(x, z), second.heightInputAt(x, z));
  }
  assert.notEqual(first.seed, field({ seed: 14200326 }).seed);
});
test("every cell retains at least 75 percent assigned terrain over area samples", () => {
  const result = field().measureCoverage(0.1);
  assert.equal(result.cells.length, 20 * 12);
  assert.ok(result.minimum >= 0.75, `minimum coverage ${(result.minimum * 100).toFixed(2)}%`);
  for (const cell of result.cells) {
    assert.ok(cell.samples > 1000, `${cell.col},${cell.row} should have area samples`);
    assert.ok(cell.coverage >= 0.75, `${cell.col},${cell.row} coverage ${(cell.coverage * 100).toFixed(2)}%`);
  }
  assert.deepEqual(measureTerrainCoverage(field(), 0.2).cells.map((cell) => cell.terrain), result.cells.map((cell) => cell.terrain));
});

test("same-terrain neighbours form one continuous region", () => {
  const regions = field();
  const left = regions.getCell(5, 5)!;
  const right = regions.getCell(5, 6)!;
  assert.equal(left.terrain, "plains");
  assert.equal(right.terrain, "plains");

  // Their shared edge is horizontal for this odd-q column. Samples straddling
  // the edge stay plains, rather than exposing the source hex outlines.
  const edgeZ = (left.center.z + right.center.z) * 0.5;
  for (let offset = -3.2; offset <= 3.2; offset += 0.4) {
    assert.equal(regions.classify(left.center.x + offset, edgeZ), "plains");
  }
});

test("different terrain boundaries are seeded, smooth, and not a straight hex edge", () => {
  const regions = createTerrainRegions({
    cols: 8,
    rows: 8,
    seed: 71,
    scenario: "irregular-boundary",
    tiles: Array.from({ length: 8 * 8 }, (_, index) => {
      const col = Math.floor(index / 8);
      const row = index % 8;
      return { col, row, terrain: col < 4 ? "plains" : "water" };
    }),
  });
  const left = regions.getCell(3, 3)!;
  const right = regions.getCell(4, 3)!;
  const midpointX = (left.center.x + right.center.x) * 0.5;
  const transitions: number[] = [];
  for (let row = 1; row < 7; row += 1) {
    const z = regions.getCell(3, row)!.center.z;
    let transition = 0;
    for (let offset = -3; offset <= 3; offset += 0.05) {
      if (regions.classify(midpointX + offset, z) === "water") {
        transition = offset;
        break;
      }
    }
    transitions.push(transition);
  }
  // At least one row is displaced from the unperturbed midpoint, and there
  // are several distinct transition positions (coherent noise, not zigzags).
  assert.ok(transitions.some((offset) => Math.abs(offset) > 0.1), transitions.join(", "));
  assert.ok(new Set(transitions.map((offset) => offset.toFixed(2))).size >= 3, transitions.join(", "));
  assert.ok(Math.abs(regions.heightAt(left.center.x, left.center.z) - regions.heightAt(right.center.x, right.center.z)) > 0.1);
});

test("arbitrary odd-q dimensions and omitted cells are supported", () => {
  const regions = createTerrainRegions({
    cols: 3,
    rows: 2,
    tiles: [{ col: 0, row: 0, terrain: "forest" }, { col: 2, row: 1, terrain: "water" }],
    defaultTerrain: "dry",
    hexRadius: 2,
  });
  assert.equal(regions.getCell(1, 0)?.terrain, "dry");
  assert.deepEqual(regions.weightsAt(regions.getCell(0, 0)!.center.x, regions.getCell(0, 0)!.center.z), { forest: 1 });
  assert.equal(regions.classify(10_000, 10_000), null);
  assert.equal(regions.coverageForCell(2, 1, 0.2) >= 0.75, true);
});

test("shorelines round off hex corners: a lone pond is round and its centre stays water", () => {
  const tiles = [];
  for (let col = 0; col < 5; col += 1) for (let row = 0; row < 5; row += 1) {
    tiles.push({ col, row, terrain: col === 2 && row === 2 ? "water" : "plains" });
  }
  const regions = createTerrainRegions({ cols: 5, rows: 5, seed: 4, tiles });
  const pond = regions.getCell(2, 2)!;
  assert.equal(regions.classify(pond.center.x, pond.center.z), "water");
  for (const neighbour of tiles.filter(tile => tile.terrain === "plains")) {
    const cell = regions.getCell(neighbour.col, neighbour.row)!;
    assert.equal(regions.classify(cell.center.x, cell.center.z), "plains", "land centres stay land");
  }
  // Radius of the pond's waterline in twelve directions. A hex-shaped pond
  // reaches about 0.2 m further toward its corners (every 60°) than toward its
  // edge midpoints; a rounded one reaches both about equally.
  const reach: number[] = [];
  for (let step = 0; step < 12; step += 1) {
    const angle = step * Math.PI / 6;
    let radius = 0;
    for (let r = 0; r <= 5; r += .02) {
      if (regions.classify(pond.center.x + Math.cos(angle) * r, pond.center.z + Math.sin(angle) * r) !== "water") break;
      radius = r;
    }
    reach.push(radius);
  }
  const corners = reach.filter((_, step) => step % 2 === 0), edges = reach.filter((_, step) => step % 2 === 1);
  const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
  assert.ok(mean(corners) < mean(edges) + .1, `corners ${mean(corners).toFixed(2)} vs edges ${mean(edges).toFixed(2)}: pond is still hexagonal`);
});
