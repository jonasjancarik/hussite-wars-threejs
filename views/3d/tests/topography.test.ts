import assert from "node:assert/strict";
import test from "node:test";
import { createTerrainRegions } from "../src/terrain-regions.ts";
import { TopographyPlan } from "../src/topography.ts";

test("mud banks have no height jump where the protected hex interior begins", () => {
  const field = createTerrainRegions({ cols: 3, rows: 1, seed: 11, coreCoverage: 0.76, boundaryNoise: 0.75, tiles: [
    { col: 0, row: 0, terrain: "hills" }, { col: 1, row: 0, terrain: "mud" },
    { col: 2, row: 0, terrain: "hills" },
  ] });
  const plan = new TopographyPlan(field);
  const mud = field.getCell(1, 0)!, hill = field.getCell(0, 0)!;
  const dx = hill.center.x - mud.center.x, dz = hill.center.z - mud.center.z;
  const distance = Math.hypot(dx, dz);
  const coreRadius = field.apothem * Math.sqrt(field.coreCoverage);
  const samples = [-0.0001, 0.0001].map(offset => plan.elevationAt(
    mud.center.x + dx / distance * (coreRadius + offset),
    mud.center.z + dz / distance * (coreRadius + offset)));
  assert.ok(Math.abs(samples[0]! - samples[1]!) < 0.001, `mud bank jump: ${samples}`);
});

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

test("hill flanks are even and ground ramps between centres without hex-edge steps", () => {
  // A 3-row hill block with a zigzag edge, like Malešov's.
  const tiles = [];
  for (let col = 0; col < 10; col++) for (let row = 0; row < 7; row++) {
    tiles.push({ col, row, terrain: row >= 2 && row <= 4 && col >= 2 && col <= 7 ? "hills" : "plains" });
  }
  const field = createTerrainRegions({ cols: 10, rows: 7, seed: 5, tiles });
  const topography = new TopographyPlan(field);
  const flank = [2, 3, 4, 5, 6, 7].map(col => topography.cellElevation(col, 1));
  assert.ok(Math.max(...flank) - Math.min(...flank) < .6, `uneven flank ${flank.map(value => value.toFixed(2))}`);
  assert.equal(topography.cellElevation(4, 3), 6, "hill interior keeps its height");
  // Sample a line across the hill: every step is bounded, so no cliff sits on a hex edge.
  const from = field.getCell(4, 0)!.center, to = field.getCell(4, 6)!.center;
  let previous = topography.elevationAt(from.x, from.z), steepest = 0;
  for (let step = 1; step <= 200; step++) {
    const t = step / 200, x = from.x + (to.x - from.x) * t, z = from.z + (to.z - from.z) * t;
    const height = topography.elevationAt(x, z);
    steepest = Math.max(steepest, Math.abs(height - previous) / (Math.hypot(to.x - from.x, to.z - from.z) / 200));
    previous = height;
  }
  assert.ok(steepest < 1.6, `steepest gradient ${steepest.toFixed(2)}`);
});

test("mud lies a shallow dip below the land around it, even up on a ridge", () => {
  const field = createTerrainRegions({ cols: 3, rows: 1, seed: 7, tiles: [
    { col: 0, row: 0, terrain: "hills" }, { col: 1, row: 0, terrain: "mud" }, { col: 2, row: 0, terrain: "hills" },
  ] });
  const topography = new TopographyPlan(field);
  assert.ok(Math.abs(topography.cellElevation(1, 0) - (6 - .36)) < 1e-9);
  const flat = new TopographyPlan(createTerrainRegions({ cols: 2, rows: 1, seed: 7, tiles: [
    { col: 0, row: 0, terrain: "plains" }, { col: 1, row: 0, terrain: "mud" },
  ] }));
  assert.ok(Math.abs(flat.cellElevation(1, 0) + .36) < 1e-9, "on flat ground mud keeps its familiar depth");
});
