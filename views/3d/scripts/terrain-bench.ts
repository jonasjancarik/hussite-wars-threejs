/**
 * Builds the generated terrain of campaign scenarios in Node, printing the
 * build time and a fingerprint of every vertex and index buffer.
 *
 *   npm --prefix views/3d run bench:terrain                     all generated maps
 *   npm --prefix views/3d run bench:terrain -- vitkov_1420      named maps only
 *   ... -- --save /tmp/before.json   then   ... -- --compare /tmp/before.json
 *
 * A refactor meant to leave the terrain unchanged must keep every fingerprint.
 * Add --cpu-prof to the node command line (see the 3d-performance skill) to
 * find hot spots.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import * as THREE from "three";
import { GeneratedTerrain } from "../src/generated-terrain.ts";
import type { BattleSnapshot } from "../src/types.ts";

interface Scenario { mapSize: { width: number; height: number }; mapRevision?: number; terrain: Record<string, string | number[][]> }

const root = new URL("../../../", import.meta.url);
const scenarios = runInNewContext(`${readFileSync(new URL("js/data/scenarios.js", root), "utf8")}; Scenarios`) as Record<string, Scenario>;
const args = process.argv.slice(2);
const option = (name: string): string | undefined => { const index = args.indexOf(name); return index >= 0 ? args.splice(index, 2)[1] : undefined; };
const save = option("--save"), compare = option("--compare");
// Sudoměř is hand-authored and bypasses the generator.
const ids = args.length ? args : Object.keys(scenarios).filter(id => id !== "sudomere_1420");

function snapshot(id: string): BattleSnapshot {
  const scenario = scenarios[id];
  if (!scenario) throw new Error(`Unknown scenario ${id}`);
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

function fingerprint(group: THREE.Object3D): number {
  let hash = 0;
  group.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    const geometry = object.geometry as THREE.BufferGeometry;
    for (const attribute of Object.values(geometry.attributes)) {
      for (const value of attribute.array as ArrayLike<number>) hash = (Math.imul(hash, 31) + Math.round(value * 1e4)) | 0;
    }
    for (const value of (geometry.index?.array ?? []) as ArrayLike<number>) hash = (Math.imul(hash, 31) + value) | 0;
  });
  return hash;
}

const expected = compare ? JSON.parse(readFileSync(compare, "utf8")) as Record<string, number> : null;
const results: Record<string, number> = {};
let total = 0, changed = 0;
for (const id of ids) {
  const started = performance.now();
  const terrain = new GeneratedTerrain(snapshot(id));
  const elapsed = performance.now() - started;
  total += elapsed;
  results[id] = fingerprint(terrain.group);
  const verdict = !expected || expected[id] === undefined ? "" : expected[id] === results[id] ? "  same" : "  CHANGED";
  if (verdict === "  CHANGED") changed += 1;
  console.log(`${id.padEnd(22)} ${elapsed.toFixed(0).padStart(6)} ms  ${results[id]}${verdict}`);
  terrain.dispose();
}
console.log(`${"total".padEnd(22)} ${total.toFixed(0).padStart(6)} ms`);
if (save) writeFileSync(save, JSON.stringify(results, null, 1));
if (expected) {
  console.log(changed ? `${changed} map(s) changed` : "every map builds to the same buffers");
  process.exitCode = changed ? 1 : 0;
}
