import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import { HexLayout } from "../src/hex-coordinates.ts";
import { planSettlement, nearestOnStreet, type SettlementAuthoring, type SettlementEdit, type SettlementLandmark } from "../src/settlement-plan.ts";
import { terrainHash } from "../src/scenario-art.ts";
import type { TerrainCell } from "../src/terrain-regions.ts";

const root = new URL("../../../", import.meta.url);
const scenarios = runInNewContext(`${readFileSync(new URL("js/data/scenarios.js", root), "utf8")}; Scenarios`) as
  Record<string, { mapSize: { width: number; height: number }; terrain: Record<string, string | number[][]> }>;

function field(id: string): { tiles: TerrainCell[]; layout: HexLayout } {
  const scenario = scenarios[id]!;
  const assigned = new Map<string, string>();
  for (const [terrain, coordinates] of Object.entries(scenario.terrain)) {
    if (Array.isArray(coordinates)) for (const [col, row] of coordinates) assigned.set(`${col},${row}`, terrain);
  }
  const layout = new HexLayout(scenario.mapSize.width, scenario.mapSize.height);
  const tiles: TerrainCell[] = [];
  for (let col = 0; col < scenario.mapSize.width; col += 1) for (let row = 0; row < scenario.mapSize.height; row += 1) {
    tiles.push({ col, row, terrain: assigned.get(`${col},${row}`) ?? "plains", center: layout.center(col, row) });
  }
  return { tiles, layout };
}

function authoring(tiles: TerrainCell[], changes: Partial<SettlementAuthoring> = {}): SettlementAuthoring {
  return { version: 1, sourceTerrainHash: terrainHash(tiles), seed: 1, edits: [], openAreas: [], landmarks: [], ...changes };
}

function houseId(scenario: string, cell: TerrainCell): string {
  return `${scenario}:settlement:${cell.col},${cell.row}:house`;
}

function anchorAt(cell: TerrainCell, x: number, z: number): [number, number] {
  return [x - cell.center.x, z - cell.center.z];
}

test("real scenario settlement layouts are deterministic for shuffled terrain", () => {
  const scenario = "most_1421";
  const { tiles, layout } = field(scenario);
  const expected = planSettlement(scenario, tiles, layout);
  assert.ok(expected.placements.length > 0);
  assert.deepEqual(planSettlement(scenario, [...tiles].reverse(), layout), expected);
});

test("adding a distant town keeps existing generated settlement identities", () => {
  const scenario = "zatec_1421";
  const { tiles, layout } = field(scenario);
  const before = planSettlement(scenario, tiles, layout);
  const towns = tiles.filter(cell => cell.terrain === "town");
  const extra = tiles.filter(cell => cell.terrain === "plains")
    .sort((a, b) => Math.min(...towns.map(town => Math.hypot(b.center.x - town.center.x, b.center.z - town.center.z))) -
      Math.min(...towns.map(town => Math.hypot(a.center.x - town.center.x, a.center.z - town.center.z))))[0]!;
  const after = planSettlement(scenario, tiles.map(cell => cell === extra ? { ...cell, terrain: "town" } : cell), layout);
  const afterIds = new Set(after.placements.map(placement => placement.id));
  for (const placement of before.placements) assert.ok(afterIds.has(placement.id), `lost ${placement.id}`);
});

test("authored pins, open areas, removals, moves, and replacements persist across regeneration", () => {
  const scenario = "zatec_1421";
  const { tiles, layout } = field(scenario);
  const base = planSettlement(scenario, tiles, layout);
  const houses = base.placements.filter(placement => placement.id.endsWith(":house"));
  assert.ok(houses.length >= 5);
  const baseCell = (id: string): TerrainCell => {
    const match = id.match(/:(\d+),(\d+):house$/)!;
    return tiles.find(cell => cell.col === Number(match[1]) && cell.row === Number(match[2]))!;
  };
  const [removed, moved, replaced, pinned, opened] = houses.slice(0, 5);
  const removedCell = baseCell(removed!.id);
  const moveCell = baseCell(moved!.id);
  const replaceCell = baseCell(replaced!.id);
  const pinCell = baseCell(pinned!.id);
  const openCell = baseCell(opened!.id);
  const moveEdit: SettlementEdit = {
    id: moved!.id, cell: [moveCell.col, moveCell.row],
    offset: anchorAt(moveCell, moved!.x + 0.05, moved!.z), model: moved!.model,
    rotation: moved!.rotation, scale: moved!.scale,
  };
  const replaceEdit: SettlementEdit = {
    id: replaced!.id, cell: [replaceCell.col, replaceCell.row],
    offset: anchorAt(replaceCell, replaced!.x, replaced!.z), model: "house_timber",
    rotation: replaced!.rotation, scale: 0.48,
  };
  const pin: SettlementLandmark = {
    id: "author-pin-well", cell: [pinCell.col, pinCell.row],
    offset: anchorAt(pinCell, pinned!.x, pinned!.z), model: "well", rotation: pinned!.rotation, scale: 0.55,
  };
  const changes = authoring(tiles, {
    edits: [
      { id: removed!.id, cell: [removedCell.col, removedCell.row], remove: true },
      moveEdit,
      replaceEdit,
    ],
    openAreas: [{ id: "village-green", cell: [openCell.col, openCell.row], offset: anchorAt(openCell, opened!.x, opened!.z), radius: 0.5 }],
    landmarks: [pin],
  });
  const actual = planSettlement(scenario, tiles, layout, [], changes);
  const repeated = planSettlement(scenario, tiles, layout, [], changes);
  assert.deepEqual(repeated, actual);
  assert.ok(!actual.placements.some(placement => placement.id === removed!.id));
  const movedPlacement = actual.placements.find(placement => placement.id === moved!.id);
  assert.ok(movedPlacement, "moved house was not retained");
  assert.ok(Math.abs(movedPlacement.x - moved!.x - 0.05) < 1e-6);
  const replacement = actual.placements.find(placement => placement.id === replaced!.id);
  assert.equal(replacement?.model, "house_timber");
  assert.equal(actual.placements.find(placement => placement.id === pin.id)?.model, "well");
  const areaPlacement = actual.placements.find(placement => placement.id === opened!.id);
  assert.ok(areaPlacement, "open area removed the stable generated identity instead of relocating it");
  assert.ok(Math.hypot(areaPlacement.x - opened!.x, areaPlacement.z - opened!.z) > 1,
    "open area did not move the generated structure away from its original location");
});

test("authoring with a mismatched terrain hash is ignored and reported", () => {
  const scenario = "most_1421";
  const { tiles, layout } = field(scenario);
  const expected = planSettlement(scenario, tiles, layout);
  const stale = authoring(tiles, {
    sourceTerrainHash: "stale-terrain-hash",
    edits: [{ id: "invalid", cell: [0, 0], remove: true }],
  });
  const actual = planSettlement(scenario, tiles, layout, [], stale);
  assert.deepEqual(actual.placements, expected.placements);
  assert.ok(actual.issues.some(issue => issue.includes("do not match this map")));
});

test("water and town-centre edits are rejected as unsafe", () => {
  const scenario = "zatec_1421";
  const { tiles, layout } = field(scenario);
  const base = planSettlement(scenario, tiles, layout);
  const town = tiles.find(cell => cell.terrain === "town")!;
  const water = tiles.find(cell => cell.terrain === "water")!;
  const changes = authoring(tiles, {
    edits: [
      { id: `${scenario}:settlement:${water.col},${water.row}:house`, cell: [water.col, water.row], model: "house_timber" },
      { id: houseId(scenario, town), cell: [town.col, town.row], offset: [0, 0], model: "house_timber" },
    ],
  });
  const actual = planSettlement(scenario, tiles, layout, [], changes);
  assert.ok(actual.issues.some(issue => issue.includes("Unknown settlement anchor")));
  assert.ok(actual.issues.some(issue => issue.includes("cannot fit safely")));
  assert.ok(!actual.placements.some(placement => placement.id.includes(`:${water.col},${water.row}:`)));
  assert.deepEqual(actual.placements.map(placement => placement.id), base.placements.map(placement => placement.id));
});

test("generated house fronts face the nearest street from the documented +Z direction", () => {
  const scenario = "most_1421";
  const { tiles, layout } = field(scenario);
  const plan = planSettlement(scenario, tiles, layout);
  const placement = plan.placements.find(item => item.id.endsWith(":house"))!;
  const nearest = nearestOnStreet(placement, plan.streets);
  assert.ok(nearest);
  const dx = nearest.x - placement.x;
  const dz = nearest.z - placement.z;
  const length = Math.hypot(dx, dz);
  assert.ok(length > 0);
  assert.ok(Math.abs(Math.sin(placement.rotation) - dx / length) < 1e-6);
  assert.ok(Math.abs(Math.cos(placement.rotation) - dz / length) < 1e-6);
});

test("committed profiles apply without rejected adjustments and preserve bridge access", async () => {
  const { planEnvironment } = await import("../src/environment-plan.ts");
  for (const scenario of ["nemecky_brod_1422", "zatec_1421"]) {
    const { tiles } = field(scenario);
    const plan = planEnvironment(scenario, tiles);
    assert.deepEqual(plan.settlement?.issues, []);
    assert.ok(plan.settlement!.placements.length > 0);
    assert.equal(new Set(plan.placements.map(p=>p.id)).size, plan.placements.length);
    if (scenario === "nemecky_brod_1422") {
      assert.equal(plan.settlement!.placements.find(p=>p.id.endsWith(":9,9:house"))?.model,"townhouse");
      assert.ok(plan.settlement!.placements.some(p=>p.id==="brod-town-well"));
      assert.ok(!plan.settlement!.placements.some(p=>p.id.endsWith(":8,11:shed")));
      const street=plan.settlement!.streets[0]!;
      assert.ok(street.points.every(p=>Math.abs(p.x-plan.bridge!.x)<1e-6),"street stays aligned with bridge");
    }
  }
});

test("malformed authoring data fails validation instead of entering the renderer", async () => {
  const { parseSettlementAuthoring }=await import("../src/settlement-authoring.ts");
  const { tiles }=field("nemecky_brod_1422");
  const valid=authoring(tiles);
  assert.deepEqual(parseSettlementAuthoring(valid),valid);
  for(const invalid of [null,{...valid,seed:NaN},{...valid,edits:[{id:"bad",cell:[1]}]},
    {...valid,edits:[{id:"bad",cell:[1,1],scale:-1}]},
    {...valid,landmarks:[{id:"bad",cell:[1,1],model:"well"}]},
    {...valid,openAreas:[{id:"bad",cell:[1,1],radius:-2}]}]) {
    assert.throws(()=>parseSettlementAuthoring(invalid),/Invalid settlement/);
  }
});
