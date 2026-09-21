import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import { GeneratedTerrain } from "../src/generated-terrain.ts";
import { createTerrainRegions, type TerrainTile } from "../src/terrain-regions.ts";
import type { BattleSnapshot } from "../src/types.ts";

interface Scenario {
  id: string;
  mapSize: { width: number; height: number };
  terrain: Record<string, string | Array<[number, number]>>;
  mapRevision?: number;
}

function loadScenarios(): Record<string, Scenario> {
  const source = readFileSync(new URL("../../../js/data/scenarios.js", import.meta.url), "utf8");
  const context: Record<string, unknown> = {};
  vm.runInNewContext(`${source}\n;globalThis.__scenarios = Scenarios;`, context);
  return context.__scenarios as Record<string, Scenario>;
}

function tilesFor(scenario: Scenario): TerrainTile[] {
  const assigned = new Map<string, string>();
  for (const [terrain, positions] of Object.entries(scenario.terrain)) {
    if (terrain === "plains" || !Array.isArray(positions)) continue;
    for (const [col, row] of positions) assigned.set(`${col},${row}`, terrain);
  }
  const tiles: TerrainTile[] = [];
  for (let col = 0; col < scenario.mapSize.width; col += 1) {
    for (let row = 0; row < scenario.mapSize.height; row += 1) {
      tiles.push({ col, row, terrain: assigned.get(`${col},${row}`) ?? "plains" });
    }
  }
  return tiles;
}

test("every campaign scenario preserves at least 75 percent of every assigned terrain cell", () => {
  const scenarios = loadScenarios();
  assert.equal(Object.keys(scenarios).length, 18);
  let overallMinimum = 1;
  let renderedMinimum = 1;
  let checkedCells = 0;
  for (const scenario of Object.values(scenarios)) {
    const tiles = tilesFor(scenario);
    const field = createTerrainRegions({ cols: scenario.mapSize.width, rows: scenario.mapSize.height,
      tiles, scenario: scenario.id, seed: scenario.mapRevision ?? 1, coreCoverage: 0.76, boundaryNoise: 0.75 });
    const coverage = field.measureCoverage(0.2);
    checkedCells += coverage.cells.length;
    overallMinimum = Math.min(overallMinimum, coverage.minimum);
    assert.ok(coverage.minimum >= 0.75,
      `${scenario.id} minimum ${(coverage.minimum * 100).toFixed(2)}%`);
    assert.deepEqual(new Set(field.terrainTypes), new Set(tiles.map(tile => tile.terrain)),
      `${scenario.id} silently collapsed a terrain type`);
    for (const tile of field.tiles) {
      assert.equal(field.classify(tile.center.x, tile.center.z), tile.terrain,
        `${scenario.id} ${tile.col},${tile.row} centre`);
    }
    const rendered = new GeneratedTerrain({
      protocolVersion: 2, generation: 1, revision: 1, scenario: scenario.id,
      seed: scenario.mapRevision ?? 1, cols: scenario.mapSize.width, rows: scenario.mapSize.height,
      round: 1, faction: "hussites", state: "playing", busy: false, paused: false, aiRunning: false,
      tiles, units: [], selectedUnitId: null, legalMoves: [], legalAttacks: [], marchTargets: [],
      visibleHexes: [], exploredHexes: [], events: [],
    } satisfies BattleSnapshot);
    for (const cell of field.tiles) {
      let samples = 0, matching = 0;
      for (let x = cell.center.x - field.hexRadius + 0.1; x < cell.center.x + field.hexRadius; x += 0.2) {
        for (let z = cell.center.z - field.apothem + 0.1; z < cell.center.z + field.apothem; z += 0.2) {
          if (!field.pointInsideHex(x, z, cell.col, cell.row)) continue;
          samples += 1;
          if (rendered.renderedTerrainAt(x, z) === cell.terrain) matching += 1;
        }
      }
      const cellCoverage = matching / samples;
      renderedMinimum = Math.min(renderedMinimum, cellCoverage);
      assert.ok(cellCoverage >= 0.75,
        `${scenario.id} rendered ${cell.col},${cell.row} ${cell.terrain}: ${(cellCoverage * 100).toFixed(2)}%`);
    }
    rendered.dispose();
  }
  console.info(`Campaign terrain coverage: ${Object.keys(scenarios).length} scenarios, ${checkedCells} cells, field minimum ${(overallMinimum * 100).toFixed(1)}%, rendered minimum ${(renderedMinimum * 100).toFixed(1)}%`);
});
