import assert from "node:assert/strict";
import test from "node:test";
import { createTerrainRegions } from "../src/terrain-regions.ts";
import { TopographyPlan } from "../src/topography.ts";

test("semantic hills form a plateau and slope cells rise toward it", () => {
  const field = createTerrainRegions({ cols: 6, rows: 1, scenario: "ridge-fixture", seed: 3, tiles: [
    { col: 0, row: 0, terrain: "plains" }, { col: 1, row: 0, terrain: "plains" },
    { col: 2, row: 0, terrain: "slope" }, { col: 3, row: 0, terrain: "slope" },
    { col: 4, row: 0, terrain: "hills" }, { col: 5, row: 0, terrain: "hills" },
  ] });
  const topography = new TopographyPlan(field);
  assert.ok(topography.cellElevation(0, 0) < 0.1);
  assert.ok(topography.cellElevation(2, 0) > 0.5);
  assert.ok(topography.cellElevation(3, 0) > topography.cellElevation(2, 0));
  assert.equal(topography.cellElevation(4, 0), topography.cellElevation(5, 0));
  assert.ok(topography.cellElevation(4, 0) >= 5.8);
  const slope = field.getCell(3, 0)!, plateau = field.getCell(4, 0)!;
  const midpoint = { x: (slope.center.x + plateau.center.x) / 2, z: (slope.center.z + plateau.center.z) / 2 };
  const middleHeight = topography.elevationAt(midpoint.x, midpoint.z);
  assert.ok(middleHeight > topography.cellElevation(3, 0));
  assert.ok(middleHeight < topography.cellElevation(4, 0));
});

test("a flat plains map stays flat and wet terrain stays depressed", () => {
  const field = createTerrainRegions({ cols: 3, rows: 1, seed: 9, tiles: [
    { col: 0, row: 0, terrain: "plains" }, { col: 1, row: 0, terrain: "mud" },
    { col: 2, row: 0, terrain: "water" },
  ] });
  const topography = new TopographyPlan(field);
  assert.equal(topography.cellElevation(0, 0), 0);
  assert.ok(topography.cellElevation(1, 0) < 0);
  assert.ok(topography.cellElevation(2, 0) < topography.cellElevation(1, 0));
});

test("wet terrain stays level in its core, blends at the bank, and exterior interpolation stays smooth", () => {
  const wetField = createTerrainRegions({ cols: 3, rows: 1, seed: 11, tiles: [
    { col: 0, row: 0, terrain: "hills" }, { col: 1, row: 0, terrain: "water" },
    { col: 2, row: 0, terrain: "hills" },
  ] });
  const wetTopography = new TopographyPlan(wetField), water = wetField.getCell(1, 0)!;
  assert.equal(wetTopography.elevationAt(water.center.x, water.center.z), -0.7);
  const hill = wetField.getCell(0, 0)!;
  const bank = { x: (water.center.x + hill.center.x) / 2, z: (water.center.z + hill.center.z) / 2 };
  const dx = (water.center.x - hill.center.x) * 0.000001;
  const dz = (water.center.z - hill.center.z) * 0.000001;
  const eitherSide = [wetTopography.elevationAt(bank.x - dx, bank.z - dz),
    wetTopography.elevationAt(bank.x + dx, bank.z + dz)];
  assert.ok(Math.abs(eitherSide[1]! - eitherSide[0]!) < 0.02, `wet bank jump ${eitherSide.join(" -> ")}`);

  const edgeField = createTerrainRegions({ cols: 2, rows: 1, seed: 13, tiles: [
    { col: 0, row: 0, terrain: "plains" }, { col: 1, row: 0, terrain: "hills" },
  ] });
  const edgeTopography = new TopographyPlan(edgeField), edgeZ = edgeField.apothem + 1.5;
  const left = edgeTopography.elevationAt(-0.05, edgeZ), right = edgeTopography.elevationAt(0.05, edgeZ);
  assert.ok(Math.abs(right - left) < 0.2, `exterior jump ${left} -> ${right}`);
});
