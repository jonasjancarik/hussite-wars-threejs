import assert from "node:assert/strict";
import test from "node:test";
import { createMeadowMesh, createMeadowPlacements, decorationSeed } from "../src/generated-meadow.ts";
import { surfaceMaterialKind } from "../src/generated-materials.ts";
import { HexLayout } from "../src/hex-coordinates.ts";
import { createTerrainRegions } from "../src/terrain-regions.ts";

function source() {
  const layout = new HexLayout(3, 2);
  const field = createTerrainRegions({ cols: 3, rows: 2, scenario: "meadow-fixture", seed: 73, tiles: [
    { col: 0, row: 0, terrain: "plains" }, { col: 0, row: 1, terrain: "hills" },
    { col: 1, row: 0, terrain: "mud" }, { col: 1, row: 1, terrain: "slope" },
    { col: 2, row: 0, terrain: "forest" }, { col: 2, row: 1, terrain: "water" },
  ] });
  return { layout, field };
}

test("generated meadow placement is deterministic, semantic and keeps unit centres clear", () => {
  const terrain = source();
  const first = createMeadowPlacements(terrain);
  const second = createMeadowPlacements(terrain);
  assert.deepEqual(first, second);
  assert.ok(first.length > 20);
  for (const placement of first) {
    assert.equal(terrain.layout.contains(placement.x, placement.z, placement.col, placement.row), true);
    const cell = terrain.field.getCell(placement.col, placement.row)!;
    assert.ok(Math.hypot(placement.x - cell.center.x, placement.z - cell.center.z) >= 1.45);
    assert.ok(["plains", "hills", "slope", "forest"].includes(cell.terrain));
  }
  assert.notEqual(decorationSeed(73, 0, 0, "meadow-grass"), decorationSeed(73, 0, 0, "terrain-models"));
  const built = createMeadowMesh(first, () => 0);
  assert.equal(built.mesh.count, first.length);
  assert.equal(built.matrices.length, first.length);
  assert.equal(built.mesh.castShadow, false);
  built.mesh.geometry.dispose();
  (built.mesh.material as import("three").Material).dispose();
});

test("terrain materials distinguish meadow, earth, rock and water without scenario branches", () => {
  assert.equal(surfaceMaterialKind("plains"), "meadow");
  assert.equal(surfaceMaterialKind("hills"), "meadow");
  assert.equal(surfaceMaterialKind("farmland"), "earth");
  assert.equal(surfaceMaterialKind("mud"), "earth");
  assert.equal(surfaceMaterialKind("slope"), "slope");
  assert.equal(surfaceMaterialKind("rock"), "rock");
  assert.equal(surfaceMaterialKind("water"), "water");
});
