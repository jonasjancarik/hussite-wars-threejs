import assert from "node:assert/strict";
import test from "node:test";
import {
  createTerrainRegions,
  measureTerrainCoverage,
  type TerrainRegionOptions,
  type TerrainTile,
} from "../src/terrain-regions.ts";

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
