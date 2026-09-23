import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import * as THREE from "three";
import { earthworkRelief } from "../src/environment-plan.ts";
import { GROUND_SPLAT, SHORE_DISTANCE } from "../src/generated-materials.ts";
import { GeneratedTerrain, PUDDLE_DEPTH } from "../src/generated-terrain.ts";
import type { BattleSnapshot } from "../src/types.ts";

const root = new URL("../../../", import.meta.url);
const scenarios = runInNewContext(`${readFileSync(new URL("js/data/scenarios.js", root), "utf8")}; Scenarios`) as
  Record<string, { mapSize: { width: number; height: number }; terrain: Record<string, string | number[][]> }>;

function terrain(id: string): GeneratedTerrain {
  const scenario = scenarios[id]!, assigned = new Map<string, string>();
  for (const [kind, coords] of Object.entries(scenario.terrain)) if (Array.isArray(coords)) {
    for (const [col, row] of coords) assigned.set(`${col},${row}`, kind);
  }
  const tiles = [];
  for (let col = 0; col < scenario.mapSize.width; col++) for (let row = 0; row < scenario.mapSize.height; row++) {
    tiles.push({ col, row, terrain: assigned.get(`${col},${row}`) ?? "plains" });
  }
  return new GeneratedTerrain({ scenario: id, seed: 1, cols: scenario.mapSize.width, rows: scenario.mapSize.height,
    tiles } as unknown as BattleSnapshot);
}

function surface(ground: GeneratedTerrain): THREE.Mesh {
  return ground.interactiveMeshes[0] as THREE.Mesh;
}

test("dry land blends ground textures per vertex; swamp mixes meadow with mud", () => {
  const ground = terrain("malesov_1424");
  const geometry = surface(ground).geometry;
  const splat = geometry.getAttribute(GROUND_SPLAT);
  const positions = geometry.getAttribute("position");
  assert.equal(splat.count, positions.count);
  let swampMeadow = 0, swampEarth = 0, swampSamples = 0;
  for (let index = 0; index < splat.count; index += 1) {
    const sum = splat.getX(index) + splat.getY(index) + splat.getZ(index);
    assert.ok(Math.abs(sum - 1) < 1e-5, `vertex ${index} weights sum to ${sum}`);
    const weights = ground.field.weightsAt(positions.getX(index), positions.getZ(index));
    if ((weights.swamp ?? 0) > .99) {
      swampMeadow += splat.getX(index); swampEarth += splat.getY(index); swampSamples += 1;
    }
  }
  assert.ok(swampSamples > 100);
  assert.ok(swampMeadow / swampSamples > .4, "swamp stays mostly vegetated");
  assert.ok(swampEarth / swampSamples > .1, "swamp is mottled with mud");
  const materials = surface(ground).material as Array<THREE.Material & { colorNode?: unknown }>;
  for (const index of [0, 1, 2, 3]) assert.ok(materials[index]!.colorNode, `land material ${index} samples the blend`);
  ground.dispose();
});

test("wetlands hold shallow puddles that stay off earthworks", () => {
  const swamp = terrain("malesov_1424");
  const puddles = swamp.group.children.find(child => child.name === "Wetland puddles") as THREE.Mesh | undefined;
  assert.ok(puddles, "swamp map has standing water");
  const sheet = puddles.geometry.getAttribute("position");
  assert.ok(sheet.count > 100);
  // The sheet shares the terrain grid: every vertex sits over a rendered ground vertex.
  const ground = surface(swamp).geometry.getAttribute("position");
  const columns = new Set(Array.from({ length: ground.count }, (_, index) => ground.getX(index).toFixed(4)));
  for (let index = 0; index < sheet.count; index += 97) assert.ok(columns.has(sheet.getX(index).toFixed(4)));
  swamp.dispose();

  const neck = terrain("vitkov_1420");
  let wetSamples = 0;
  for (const cell of neck.field.tiles.filter(tile => tile.terrain === "mud")) {
    for (let dx = -3; dx <= 3; dx += .5) for (let dz = -3; dz <= 3; dz += .5) {
      const x = cell.center.x + dx, z = cell.center.z + dz;
      const dip = neck.puddleDip(x, z);
      assert.ok(dip >= 0 && dip <= PUDDLE_DEPTH + 1e-9);
      const relief = Math.abs(earthworkRelief(x, z, neck.environmentPlan.earthworks));
      // Hollows ease out over the first 6 cm of a bank or ditch and are absent beyond.
      if (relief >= .06) assert.equal(dip, 0, "no puddle on a bank or ditch");
      else assert.ok(dip <= PUDDLE_DEPTH * (1 - relief / .06) + 1e-9);
      wetSamples += 1;
    }
  }
  assert.ok(wetSamples > 0);
  assert.equal(terrain("zivohost_1419").group.children.some(child => child.name === "Wetland puddles"), false,
    "maps without mud or swamp get no puddles");
  neck.dispose();
});

test("open water knows how far it is from the shore; land and the waterline are zero", () => {
  const ground = terrain("malesov_1424");
  const geometry = surface(ground).geometry;
  const shore = geometry.getAttribute(SHORE_DISTANCE);
  const index = geometry.getIndex()!;
  const water = new Set<number>(), land = new Set<number>();
  for (const group of geometry.groups) {
    for (let i = group.start; i < group.start + group.count; i += 1) {
      (group.materialIndex === 4 ? water : land).add(index.getX(i));
    }
  }
  let deepest = 0;
  for (const vertex of land) assert.equal(shore.getX(vertex), 0, "land and shoreline vertices have no depth");
  for (const vertex of water) deepest = Math.max(deepest, shore.getX(vertex));
  assert.ok(deepest > 1.5, `open water reaches ${deepest.toFixed(2)} m from shore`);
  assert.ok(deepest <= 6, "distance is capped where all water counts as open");
  const materials = surface(ground).material as Array<THREE.Material & { colorNode?: unknown; normalNode?: unknown }>;
  assert.ok(materials[4]!.colorNode && materials[4]!.normalNode, "water shades by depth and ripples");
  ground.dispose();
});

test("the diorama's cut face knows its rim and stands on a walnut base", () => {
  const ground = terrain("malesov_1424");
  const skirt = ground.group.children[1] as THREE.Mesh;
  const rims = skirt.geometry.getAttribute("rimTop");
  const positions = skirt.geometry.getAttribute("position");
  for (let index = 0; index < positions.count; index += 2) {
    assert.equal(rims.getX(index), positions.getY(index), "the rim is the top of its column");
    assert.equal(rims.getX(index + 1), positions.getY(index), "and is shared by the column's foot");
  }
  const base = ground.group.children.find(child => child.name === "Battlefield plinth base") as THREE.Mesh;
  const box = new THREE.Box3().setFromObject(base);
  assert.ok(Math.abs(box.max.y - -5.9) < 1e-6, "base top meets the soil face");
  assert.ok(box.max.x > ground.bounds.maxX + .5 && box.min.z < ground.bounds.minZ - .5, "base forms a ledge around the board");
  ground.dispose();
});
