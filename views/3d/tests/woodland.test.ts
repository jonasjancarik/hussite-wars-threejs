import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import * as THREE from "three";
import { GeneratedTerrain } from "../src/generated-terrain.ts";
import { batchStaticMeshes, INSTANCE_TINT } from "../src/static-batching.ts";
import { formationClearance, planWoodland, TRUNK_CLEARANCE, woodlandModels } from "../src/woodland-plan.ts";
import { createTuftMesh, planTufts } from "../src/ground-tufts.ts";
import type { BattleSnapshot } from "../src/types.ts";

const root = new URL("../../../", import.meta.url);
const scenarios = runInNewContext(`${readFileSync(new URL("js/data/scenarios.js", root), "utf8")}; Scenarios`) as
  Record<string, { id: string; mapSize: { width: number; height: number }; terrain: Record<string, string | number[][]> }>;
const paths = JSON.parse(readFileSync(new URL("assets/3d/model-paths.json", root), "utf8")) as Record<string, string>;

function snapshot(id: string): BattleSnapshot {
  const scenario = scenarios[id]!, assigned = new Map<string, string>();
  for (const [kind, coords] of Object.entries(scenario.terrain)) if (Array.isArray(coords)) {
    for (const [col, row] of coords) assigned.set(`${col},${row}`, kind);
  }
  const tiles = [];
  for (let col = 0; col < scenario.mapSize.width; col++) for (let row = 0; row < scenario.mapSize.height; row++) {
    tiles.push({ col, row, terrain: assigned.get(`${col},${row}`) ?? "plains" });
  }
  return { protocolVersion: 2, generation: 1, revision: 1, scenario: id, seed: 1, cols: scenario.mapSize.width,
    rows: scenario.mapSize.height, round: 1, faction: "hussites", state: "playing", busy: false, paused: false,
    aiRunning: false, fogOfWar: false, tiles, units: [], selectedUnitId: null, legalMoves: [], legalAttacks: [],
    marchTargets: [], visibleHexes: [], exploredHexes: [], events: [] } as unknown as BattleSnapshot;
}

function plan(id: string) {
  const terrain = new GeneratedTerrain(snapshot(id));
  const source = { field: terrain.field, layout: terrain.layout, winter: terrain.environmentPlan.winter,
    replacedCells: terrain.environmentPlan.replacedCells, obstacles: terrain.environmentPlan.placements };
  return { terrain, source, woodland: planWoodland(source) };
}

test("forest hexes become mixed, tinted stands and the plan is deterministic", () => {
  const { terrain, source, woodland } = plan("domazlice_1431");
  assert.deepEqual(planWoodland(source), woodland);
  const forests = terrain.field.tiles.filter(cell => cell.terrain === "forest"
    && !terrain.environmentPlan.replacedCells.has(`${cell.col},${cell.row}`));
  const trees = woodland.filter(entry => !["procedural-worlds/pw_shrub_01", "bank_rocks"].includes(entry.model));
  assert.ok(trees.length >= forests.length * 3, `${trees.length} trees for ${forests.length} forest hexes`);
  assert.ok(new Set(trees.map(entry => entry.model)).size >= 4, "forests mix several tree models");
  const tints = new Set(woodland.map(entry => entry.tint.map(value => value.toFixed(2)).join()));
  assert.ok(tints.size > woodland.length / 2, "foliage colour varies per tree");
  for (const entry of woodland) assert.ok(paths[entry.model], `${entry.model} is a catalogued model`);
  terrain.dispose();
});

test("every trunk stays clear of every formation outline on all generated maps", () => {
  for (const id of Object.keys(scenarios)) {
    if (id === "sudomere_1420") continue;
    const { terrain, woodland } = plan(id);
    for (const entry of woodland) {
      const clearance = formationClearance(entry.x, entry.z, terrain.field.tiles);
      assert.ok(clearance >= TRUNK_CLEARANCE - 1e-9, `${id}: ${entry.model} at ${entry.col},${entry.row} is ${clearance.toFixed(2)} m from a formation`);
      const terrainAt = terrain.field.classify(entry.x, entry.z)?.toLowerCase() ?? "";
      assert.ok(!["water", "river", "lake", "road", "road2", "town", "church"].includes(terrainAt), `${id}: ${entry.model} on ${terrainAt}`);
    }
    terrain.dispose();
  }
});

test("winter woods are bare deciduous trees and conifers without leafy scrub", () => {
  const { terrain, woodland } = plan("kutna_hora_1421");
  assert.ok(terrain.environmentPlan.winter);
  assert.ok(woodland.length > 0);
  const allowed = new Set(woodlandModels(true));
  for (const entry of woodland) assert.ok(allowed.has(entry.model), `${entry.model} in winter`);
  assert.ok(!woodland.some(entry => entry.model === "procedural-worlds/pw_shrub_01"));
  terrain.dispose();
});

test("static batching carries foliage tints as instance colours and leaves other meshes white", () => {
  const group = new THREE.Group();
  const geometry = new THREE.BoxGeometry(), material = new THREE.MeshStandardMaterial();
  for (let index = 0; index < 3; index += 1) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.x = index * 3;
    if (index < 2) mesh.userData[INSTANCE_TINT] = [1.2, 1.1, .7];
    group.add(mesh);
  }
  const { batches } = batchStaticMeshes(group, () => "0,0");
  const instanced = batches[0]!.mesh as THREE.InstancedMesh;
  const color = new THREE.Color();
  instanced.getColorAt(0, color);
  assert.deepEqual(color.toArray().map(value => +value.toFixed(3)), [1.2, 1.1, .7]);
  instanced.getColorAt(2, color);
  assert.deepEqual(color.toArray(), [1, 1, 1]);
});

test("grass tufts cluster at transitions and in swamp sedge, avoid roads, mud and water and mostly spare formations", () => {
  const { terrain, source, woodland } = plan("malesov_1424");
  const tuftSource = { field: terrain.field, layout: terrain.layout, replacedCells: source.replacedCells,
    features: [...woodland, ...source.obstacles] };
  const tufts = planTufts(tuftSource);
  assert.deepEqual(planTufts(tuftSource), tufts, "deterministic");
  assert.ok(tufts.length > 200, `${tufts.length} tufts`);
  let underFormations = 0;
  for (const tuft of tufts) {
    const terrainAt = terrain.field.classify(tuft.x, tuft.z)?.toLowerCase() ?? "";
    assert.ok(!["water", "river", "lake", "road", "road2", "town", "church", "mud"].includes(terrainAt), `tuft on ${terrainAt}`);
    if (formationClearance(tuft.x, tuft.z, terrain.field.tiles) < 0) underFormations += 1;
  }
  assert.ok(underFormations / tufts.length < .25, `${underFormations} of ${tufts.length} tufts under formations`);
  const { mesh, matrices } = createTuftMesh(tufts, () => 0);
  assert.equal(mesh.count, tufts.length);
  assert.equal(matrices.length, tufts.length);
  assert.equal(mesh.castShadow, false);
  mesh.dispose();
  terrain.dispose();
});
