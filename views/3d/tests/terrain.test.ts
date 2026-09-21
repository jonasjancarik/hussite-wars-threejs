import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { distanceToPolyline, pointInPolygon } from "../src/geometry-utils.ts";
import { COLS, ROWS, HexLayout, hexCenter, terrainFor, pointInsideHex } from "../src/hex-coordinates.ts";
import { loadScenarioArt, terrainHash } from "../src/scenario-art.ts";
import type { BattleSnapshot, ScenarioArtManifest } from "../src/types.ts";

const landscape = JSON.parse(readFileSync(new URL("../../../assets/3d/scenarios/sudomer-landscape.json", import.meta.url), "utf8")) as ScenarioArtManifest;

function sudomerSnapshot(): BattleSnapshot {
  const tiles = [];
  for (let col = 0; col < COLS; col += 1) for (let row = 0; row < ROWS; row += 1) {
    tiles.push({ col, row, terrain: terrainFor(col, row) });
  }
  return { protocolVersion: 2, generation: 1, revision: 1, scenario: "sudomere_1420",
    cols: COLS, rows: ROWS, round: 1, faction: "hussites", state: "playing", busy: false,
    paused: false, aiRunning: false, tiles, units: [], selectedUnitId: null, legalMoves: [],
    legalAttacks: [], marchTargets: [], visibleHexes: [], exploredHexes: [], events: [] };
}

test("Sudomer art manifest is pinned to the authoritative terrain layout", async () => {
  const snapshot = sudomerSnapshot();
  assert.equal(landscape.sourceTerrainHash, terrainHash(snapshot.tiles));
  assert.equal(landscape.renderer, "authored-sudomer-v1");
  const originalFetch = globalThis.fetch;
  const originalWarn = console.warn;
  globalThis.fetch = async () => new Response(JSON.stringify(landscape), { status: 200 });
  console.warn = () => {};
  try {
    assert.deepEqual(await loadScenarioArt(snapshot, "https://example.invalid/"), landscape);
    const changed = structuredClone(snapshot);
    changed.tiles[0]!.terrain = "water";
    assert.equal(await loadScenarioArt(changed, "https://example.invalid/"), null);
  } finally {
    globalThis.fetch = originalFetch;
    console.warn = originalWarn;
  }
});

test("Sudomer keeps generated 3D terrain when authored art cannot load", async () => {
  const snapshot = sudomerSnapshot();
  const originalFetch = globalThis.fetch;
  const originalWarn = console.warn;
  const warnings: string[] = [];
  console.warn = message => warnings.push(String(message));
  try {
    globalThis.fetch = async () => new Response("missing", { status: 404 });
    assert.equal(await loadScenarioArt(snapshot, "https://example.invalid/"), null);
    globalThis.fetch = async () => new Response("not json", { status: 200 });
    assert.equal(await loadScenarioArt(snapshot, "https://example.invalid/"), null);
    globalThis.fetch = async () => { throw new Error("offline"); };
    assert.equal(await loadScenarioArt(snapshot, "https://example.invalid/"), null);
    assert.equal(warnings.length, 3);
    assert.ok(warnings.every(warning => warning.includes("using generated terrain")));
  } finally {
    globalThis.fetch = originalFetch;
    console.warn = originalWarn;
  }
});

test("at least 75 percent of every hex matches its water, mud or dry terrain", () => {
  let minimum = 1;
  for (let col = 0; col < COLS; col += 1) {
    for (let row = 0; row < ROWS; row += 1) {
      const expected = terrainFor(col, row);
      const center = hexCenter(col, row);
      let total = 0;
      let matching = 0;
      // Uniform area sampling, not a center-point or perimeter-only check.
      for (let ix = 0; ix < 80; ix += 1) {
        for (let iz = 0; iz < 70; iz += 1) {
          const x = center.x - 4 + (ix + 0.5) * 0.1;
          const z = center.z - 3.5 + (iz + 0.5) * 0.1;
          if (!pointInsideHex(x, z, col, row)) continue;
          const water = pointInPolygon(x, z, landscape.pond.points);
          const mud = pointInPolygon(x, z, landscape.mudBasin.points);
          total += 1;
          if (expected === "water" ? water : expected === "mud" ? mud : !water && !mud) matching += 1;
        }
      }
      const coverage = matching / total;
      minimum = Math.min(minimum, coverage);
      assert.ok(coverage >= 0.75, `${col},${row} ${expected}: ${(coverage * 100).toFixed(1)}% coverage`);
    }
  }
  console.info(`Minimum terrain area coverage: ${(minimum * 100).toFixed(1)}%`);
});

test("authored organic regions agree with all rules anchors", () => {
  const violations: string[] = [];
  for (let col = 0; col < COLS; col += 1) {
    for (let row = 0; row < ROWS; row += 1) {
      const terrain = terrainFor(col, row);
      const center = hexCenter(col, row);
      const inWater = pointInPolygon(center.x, center.z, landscape.pond.points);
      const inMud = pointInPolygon(center.x, center.z, landscape.mudBasin.points);
      if (terrain === "water" && !inWater) violations.push(`${col},${row} water anchor outside pond`);
      if (terrain === "mud" && !inMud) violations.push(`${col},${row} mud anchor outside basin`);
      if (terrain === "dam" && distanceToPolyline(center.x, center.z, landscape.causeway.points) > landscape.causeway.width) violations.push(`${col},${row} dam anchor outside causeway`);
      if (terrain === "plains" && (inWater || inMud)) violations.push(`${col},${row} plains anchor in basin`);
    }
  }
  assert.deepEqual(violations, []);
});

test("decorative fields and landmarks stay outside Sudomer's playable plains", () => {
  const layout = new HexLayout(COLS, ROWS);
  for (const landmark of landscape.landmarks) {
    assert.equal(layout.coordAt(...landmark.position), null, `${landmark.id} is inside a playable hex`);
  }
  for (const field of landscape.fields) {
    const xs = field.points.map(([x]) => x), zs = field.points.map(([, z]) => z);
    for (let x = Math.min(...xs); x <= Math.max(...xs); x += 0.4) {
      for (let z = Math.min(...zs); z <= Math.max(...zs); z += 0.4) {
        if (!pointInPolygon(x, z, field.points)) continue;
        assert.equal(layout.coordAt(x, z), null, `${field.id} overlaps playable hexes at ${x},${z}`);
      }
    }
  }
});

test("the causeway remains continuous across the authored board", () => {
  assert.equal(landscape.causeway.points[0]![0] < landscape.bounds.minX + 5, true);
  assert.equal(landscape.causeway.points.at(-1)![0] > landscape.bounds.maxX - 5, true);
  for (let i = 1; i < landscape.causeway.points.length; i += 1) {
    const previous = landscape.causeway.points[i - 1]!;
    const current = landscape.causeway.points[i]!;
    assert.ok(Math.hypot(current[0] - previous[0], current[1] - previous[1]) < 22);
  }
});

test("formation footprints fit inside the playable inradius", () => {
  const manifest = JSON.parse(readFileSync(new URL("../../../assets/3d/models/manifest.json", import.meta.url), "utf8"));
  const recipes = [
    ["war_wagon", 1.1, 0], ["cavalry", 0.98, 0.82],
    ["infantry_polearm", 1.15, 1.02], ["infantry_handgun", 1.15, 1.02], ["infantry_shield", 1.28, 0],
  ] as const;
  for (const [model, scale, offset] of recipes) {
    const dimensions = manifest[model].dimensions_gltf_xyz_m as number[];
    const halfFootprint = Math.max(dimensions[0]!, dimensions[2]!) * scale * 0.5;
    assert.ok(offset + halfFootprint < 4 * Math.sqrt(3) / 2, `${model} footprint exceeds cell`);
  }
});
