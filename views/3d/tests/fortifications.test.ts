import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { planEnvironment } from "../src/environment-plan.ts";
import { pointInPolygon } from "../src/geometry-utils.ts";
import { GeneratedScenery } from "../src/generated-scenery.ts";
import { GeneratedTerrain } from "../src/generated-terrain.ts";
import { HexLayout } from "../src/hex-coordinates.ts";
import type { BattleSnapshot } from "../src/types.ts";

const root = new URL("../../../", import.meta.url);
const paths = JSON.parse(readFileSync(new URL("assets/3d/model-paths.json", root), "utf8")) as Record<string, string>;
const scenarios = runInNewContext(`${readFileSync(new URL("js/data/scenarios.js", root), "utf8")}; Scenarios`) as
  Record<string, { id: string; mapSize: { width: number; height: number };
    terrain: Record<string, string | number[][]>; mapLabels?: Array<{ hexes: number[][]; kind?: string }> }>;
const names = ["fort_wall", "fort_wall_corner", "fort_gatehouse", "fort_tower_square", "fort_tower_round", "fort_manor", "timber_palisade"];
const cache = new Map<string, Promise<THREE.Group>>();
async function load(name: string): Promise<THREE.Group> {
  let pending = cache.get(name);
  if (!pending) {
    assert.ok(paths[name], `${name}: missing catalog entry`);
    const bytes = readFileSync(new URL(`assets/3d/${paths[name]}`, root));
    pending = new GLTFLoader().parseAsync(new Uint8Array(bytes).buffer, "").then(model => {
      assert.equal(model.animations.length, 0);
      return model.scene;
    });
    cache.set(name, pending);
  }
  return pending;
}

function snapshot(id: string): BattleSnapshot {
  const scenario = scenarios[id]!;
  const assigned = new Map<string, string>();
  for (const [kind, coords] of Object.entries(scenario.terrain)) {
    if (Array.isArray(coords)) for (const [col, row] of coords) assigned.set(`${col},${row}`, kind);
  }
  const tiles = [];
  for (let col = 0; col < scenario.mapSize.width; col++) {
    for (let row = 0; row < scenario.mapSize.height; row++) {
      tiles.push({ col, row, terrain: assigned.get(`${col},${row}`) ?? "plains" });
    }
  }
  return { protocolVersion: 2, generation: 1, revision: 1, scenario: id,
    cols: scenario.mapSize.width, rows: scenario.mapSize.height, seed: 1,
    round: 1, faction: "hussites", state: "playing", busy: false, paused: false, aiRunning: false,
    fogOfWar: true, tiles, units: [], selectedUnitId: null, legalMoves: [], legalAttacks: [],
    marchTargets: [], visibleHexes: [], exploredHexes: [], events: [],
    features: (scenario.mapLabels ?? []).filter(label => label.kind)
      .map(label => ({ kind: label.kind!, hexes: label.hexes.map(([col, row]) => ({ col: col!, row: row! })) })) };
}

test("fortification exports stay grounded, static and compact; the gate passage is genuinely open", async () => {
  for (const name of names) {
    const model = await load(name);
    const bounds = new THREE.Box3().setFromObject(model);
    assert.ok(Math.abs(bounds.min.y) < .005, `${name}: base must meet ground`);
    assert.ok(bounds.max.y < 12, `${name}: miniature scale`);
    let triangles = 0;
    model.traverse(object => {
      assert.ok(!(object instanceof THREE.SkinnedMesh));
      if (!(object instanceof THREE.Mesh)) return;
      triangles += (object.geometry.index?.count ?? object.geometry.attributes.position!.count) / 3;
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        assert.equal(material.opacity, 1);
        assert.ok(!material.name.startsWith("team_"), `${name}: scenery must not inherit a universal faction`);
      }
    });
    assert.ok(triangles > 0 && triangles < 10000, `${name}: ${triangles} triangles`);
  }
  const gate = await load("fort_gatehouse");
  gate.updateMatrixWorld(true);
  for (const x of [-.9, 0, .9]) {
    for (const y of [.3, 1.5, 2.4]) {
      const ray = new THREE.Raycaster(new THREE.Vector3(x, y, 10), new THREE.Vector3(0, 0, -1));
      assert.equal(ray.intersectObject(gate, true).length, 0, `blocked gate at ${x},${y}`);
    }
  }
});

test("fortification labels become walled manors with a gate, a ditch outside and a manor inside", () => {
  const decorated: string[] = [];
  for (const id of Object.keys(scenarios)) {
    const state = snapshot(id);
    const layout = new HexLayout(state.cols!, state.rows!);
    const tiles = state.tiles.map(tile => ({ ...tile, center: layout.center(tile.col, tile.row) }));
    const plan = planEnvironment(id, tiles, state.features);
    if (!plan.fortifications.size) continue;
    decorated.push(id);
    const walls = plan.walls.find(wall => plan.fortifications.has(wall.id))!;
    const label = state.features!.find(feature => feature.kind === "fortification")!;
    for (const { col, row } of label.hexes) {
      assert.ok(walls.enclosedCells.includes(`${col},${row}`), `${id}: ${col},${row} inside the wall`);
      assert.ok(plan.replacedCells.has(`${col},${row}`), `${id}: no generic town houses in the tvrz`);
    }
    assert.ok(walls.gates.length >= 1, `${id}: the tvrz has a gate`);
    assert.ok(walls.segments.length > 4 && walls.issues.length === 0, `${id}: ${walls.issues.join("; ")}`);
    const loop = walls.loops[0]!.points.map(point => [point.x, point.z] as [number, number]);
    const ditches = plan.earthworks.filter(work => work.id.includes(":ditch:"));
    assert.ok(ditches.length > 4, `${id}: a ditch rings the wall`);
    for (const ditch of ditches) {
      const dx = ditch.bx - ditch.ax, dz = ditch.bz - ditch.az, length = Math.hypot(dx, dz);
      const x = (ditch.ax + ditch.bx) / 2 + dz / length * ditch.ditchOffset!, z = (ditch.az + ditch.bz) / 2 - dx / length * ditch.ditchOffset!;
      assert.ok(!pointInPolygon(x, z, loop), `${id}: ditch ${ditch.id} lies outside the wall`);
    }
    const manor = plan.placements.find(placement => placement.model === "fort_manor");
    assert.ok(manor && pointInPolygon(manor.x, manor.z, loop), `${id}: the manor stands inside`);
    // A label over edited terrain falls back instead of raising a misplaced manor.
    const flooded = tiles.map(tile => label.hexes.some(hex => hex.col === tile.col && hex.row === tile.row)
      ? { ...tile, terrain: "water" } : tile);
    assert.equal(planEnvironment(id, flooded, state.features).fortifications.size, 0);
    assert.equal(planEnvironment(id, tiles).fortifications.size, 0, "no label, no tvrz");
  }
  assert.deepEqual(decorated.sort(), ["malesov_1424", "nekmir_1419"]);
});

test("the tvrz replaces farmhouses, keeps hex centres open and respects explored fog", async () => {
  for (const id of ["nekmir_1419", "malesov_1424"]) {
    const state = snapshot(id);
    const terrain = new GeneratedTerrain(state);
    const placements = terrain.environmentPlan.placements.filter(placement => placement.role === "fortification");
    const yard = terrain.field.tiles.find(tile => tile.col === state.features![0]!.hexes[0]!.col && tile.row === state.features![0]!.hexes[0]!.row)!;
    assert.equal(terrain.renderedTerrainAt(yard.center.x, yard.center.z), "town", "the courtyard is packed earth");
    const assets = {
      async preload(requested: string[]) { await Promise.all(requested.map(load)); },
      async clone(name: string) { return (await load(name)).clone(true); },
    };
    const scenery = new GeneratedScenery(terrain, assets, id);
    await scenery.build();
    assert.ok(!scenery.group.children.some(object => object.name.startsWith("town ")));
    const fortifications = scenery.group.children.filter(object => object.userData.environmentPlacement?.role === "fortification");
    assert.equal(fortifications.length, placements.length);
    const centres = terrain.field.tiles;
    for (const object of fortifications) {
      const placement=object.userData.environmentPlacement;
      const prototype=(await load(placement.model)).clone(true);
      prototype.position.set(placement.x,terrain.renderedHeightAt(placement.x,placement.z),placement.z);
      prototype.scale.setScalar(placement.scale); prototype.rotation.y=placement.rotation;
      const box = new THREE.Box3().setFromObject(prototype);
      for (const cell of centres) {
        const dx = Math.max(box.min.x - cell.center.x, 0, cell.center.x - box.max.x);
        const dz = Math.max(box.min.z - cell.center.z, 0, cell.center.z - box.max.z);
        assert.ok(Math.hypot(dx, dz) >= 1.5, `${object.name} crowds hex ${cell.col},${cell.row}`);
      }
      assert.ok(object.children[0]!.position.y >= terrain.renderedHeightAt(placement.x,placement.z)-.03);
    }
    scenery.updateVisibility(state);
    // Wall pieces hide individually inside their container, like every other fog-owned part.
    const owned = (): THREE.Object3D[] => scenery.group.children.flatMap(object =>
      object.name === "Procedural town walls" ? object.children : [object]).filter(object => !(object instanceof THREE.InstancedMesh));
    assert.ok(owned().every(object => !object.visible));
    for(const object of scenery.group.children) if(object instanceof THREE.InstancedMesh) {
      const matrix=new THREE.Matrix4(); object.getMatrixAt(0,matrix);
      assert.equal(matrix.elements[0],0);
    }
    state.exploredHexes = [fortifications[0]!.userData.sceneryCell];
    scenery.updateVisibility(state);
    for (const object of owned()) {
      assert.equal(object.visible, state.exploredHexes.includes(object.userData.sceneryCell));
    }
    state.fogOfWar = false;
    scenery.updateVisibility(state);
    assert.ok(scenery.group.children.every(object => object.visible));
    scenery.dispose(); terrain.dispose();
    assert.equal(scenery.group.children.length, 0);
  }
});
