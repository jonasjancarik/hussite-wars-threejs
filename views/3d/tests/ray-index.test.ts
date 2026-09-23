import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import * as THREE from "three";
import { GeneratedTerrain } from "../src/generated-terrain.ts";
import { intersectMeshes } from "../src/ray-index.ts";
import type { BattleSnapshot } from "../src/types.ts";

interface Scenario { mapSize: { width: number; height: number }; mapRevision?: number; terrain: Record<string, string | number[][]> }

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

function random(seed: number): () => number {
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
}

test("grid-indexed terrain picking finds the same nearest point as a full raycast", () => {
  for (const id of ["vitkov_1420", "malesov_1424", "nemecky_brod_1422"]) {
    const terrain = new GeneratedTerrain(snapshot(id));
    const { minX, maxX, minZ, maxZ } = terrain.bounds;
    const next = random(7);
    const raycaster = new THREE.Raycaster();
    let hits = 0;
    for (let sample = 0; sample < 300; sample += 1) {
      // Cameras from overhead down to grazing views, some outside the board.
      const target = new THREE.Vector3(THREE.MathUtils.lerp(minX - 8, maxX + 8, next()), 0, THREE.MathUtils.lerp(minZ - 8, maxZ + 8, next()));
      const origin = target.clone().add(new THREE.Vector3().setFromSphericalCoords(20 + next() * 120,
        THREE.MathUtils.lerp(0.02, 1.45, next()), next() * Math.PI * 2));
      raycaster.set(origin, target.clone().sub(origin).normalize());
      const expected = raycaster.intersectObjects(terrain.interactiveMeshes, false)[0];
      const actual = intersectMeshes(raycaster.ray, terrain.interactiveMeshes);
      assert.equal(Boolean(actual), Boolean(expected), `${id} sample ${sample}`);
      if (!expected || !actual) continue;
      hits += 1;
      assert.ok(actual.point.distanceTo(expected.point) < 1e-3, `${id} sample ${sample}: ${actual.point.toArray()} vs ${expected.point.toArray()}`);
    }
    assert.ok(hits > 200, `${id}: ${hits} rays hit`);
    terrain.dispose();
  }
});

test("grid-indexed picking honours the mesh transform and rebuilds after positions change", () => {
  const geometry = new THREE.PlaneGeometry(10, 10, 8, 8).rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
  mesh.position.set(5, 2, -3);
  mesh.rotation.y = 0.7;
  const ray = new THREE.Ray(new THREE.Vector3(5.5, 20, -3.2), new THREE.Vector3(0, -1, 0));
  assert.ok(Math.abs(intersectMeshes(ray, [mesh])!.point.y - 2) < 1e-6);
  const position = geometry.getAttribute("position") as THREE.BufferAttribute;
  for (let index = 0; index < position.count; index += 1) position.setY(index, 1.5);
  position.needsUpdate = true;
  assert.ok(Math.abs(intersectMeshes(ray, [mesh])!.point.y - 3.5) < 1e-6);
  assert.equal(intersectMeshes(new THREE.Ray(new THREE.Vector3(40, 20, 40), new THREE.Vector3(0, -1, 0)), [mesh]), null);
});
