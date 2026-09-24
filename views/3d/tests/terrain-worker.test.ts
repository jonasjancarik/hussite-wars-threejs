import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import * as THREE from "three";
import { GeneratedTerrain } from "../src/generated-terrain.ts";
import { buildSurface, planGeneratedTerrain, surfaceTransferables, TerrainGround, terrainInput } from "../src/terrain-surface.ts";
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

function buffers(terrain: GeneratedTerrain): unknown[] {
  const result: unknown[] = [];
  terrain.group.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    const geometry = object.geometry as THREE.BufferGeometry;
    result.push(object.name, Object.keys(geometry.attributes), geometry.groups);
    for (const attribute of Object.values(geometry.attributes)) result.push(Array.from(attribute.array as ArrayLike<number>));
    result.push(Array.from((geometry.index?.array ?? []) as ArrayLike<number>));
  });
  return result;
}

// Vítkov has a river and a bridge; Kutná Hora is a winter map with road ruts.
for (const id of ["vitkov_1420", "kutna_hora_1421"]) {
  test(`${id}: a surface built as the worker builds it gives the same terrain`, () => {
    const battle = snapshot(id);
    const inline = new GeneratedTerrain(battle);
    // As the worker does: plan from the posted input alone, then copy the result
    // the way postMessage does, taking the transferred buffers along.
    const input = structuredClone(terrainInput(battle));
    const built = buildSurface(new TerrainGround(planGeneratedTerrain(input)));
    const posted = structuredClone(built, { transfer: surfaceTransferables(built) });
    assert.equal(built.positions.length, 0, "the vertex buffers are transferred, not copied");
    const worker = new GeneratedTerrain(battle, undefined, undefined, posted);
    assert.deepEqual(buffers(worker), buffers(inline));
    const { minX, maxX, minZ, maxZ } = inline.bounds;
    for (let i = 0; i < 400; i += 1) {
      const x = minX + (maxX - minX) * ((i * 0.6180339887) % 1), z = minZ + (maxZ - minZ) * ((i * 0.7548776662) % 1);
      assert.equal(worker.renderedHeightAt(x, z), inline.renderedHeightAt(x, z));
      assert.equal(worker.renderedTerrainAt(x, z), inline.renderedTerrainAt(x, z));
    }
    for (const cell of inline.field.tiles) {
      assert.deepEqual(worker.waterTrianglesForCell(cell.col, cell.row), inline.waterTrianglesForCell(cell.col, cell.row));
    }
    inline.dispose(); worker.dispose();
  });
}
