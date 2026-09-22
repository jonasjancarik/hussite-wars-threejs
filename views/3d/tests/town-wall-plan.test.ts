import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import { ENVIRONMENT_SCENARIOS, planEnvironment } from "../src/environment-plan.ts";
import { pointInPolygon } from "../src/geometry-utils.ts";
import { HexLayout } from "../src/hex-coordinates.ts";
import { WALL_THICKNESS, planTownWalls, wallRouteSegmentClear, type TownWallPlan, type WallSegment } from "../src/town-wall-plan.ts";
import { TownWallRoutes } from "../src/town-wall-routes.ts";
import type { TerrainCell, TerrainPoint } from "../src/terrain-regions.ts";

interface Scenario { mapSize: { width: number; height: number }; terrain: Record<string, string | number[][]>; }
const root = new URL("../../../", import.meta.url);
const scenarios = runInNewContext(`${readFileSync(new URL("js/data/scenarios.js", root), "utf8")}; Scenarios`) as Record<string, Scenario>;
const key = (cell: { col: number; row: number }): string => `${cell.col},${cell.row}`;
const distance = (a: TerrainPoint, b: TerrainPoint): number => Math.hypot(a.x - b.x, a.z - b.z);

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

function plan(id: string): { walls: TownWallPlan; tiles: TerrainCell[]; layout: HexLayout } {
  const { tiles, layout } = field(id);
  return { tiles, layout, walls: planTownWalls(id, tiles.filter(cell => cell.terrain === "town"), tiles, layout, id === "nemecky_brod_1422") };
}

function routeObstacles(walls: TownWallPlan): WallSegment[] {
  const result = [...walls.segments];
  for (const gate of walls.gates) {
    const length = distance(gate.a, gate.b), dx = (gate.b.x - gate.a.x) / length, dz = (gate.b.z - gate.a.z) / length;
    result.push({ id: `${gate.id}:left-pier`, a: gate.a, b: { x: gate.a.x - dx * (gate.pierLength??WALL_THICKNESS * 1.45), z: gate.a.z - dz * (gate.pierLength??WALL_THICKNESS * 1.45) }, owner: gate.owner, thickness: gate.depth },
      { id: `${gate.id}:right-pier`, a: gate.b, b: { x: gate.b.x + dx * (gate.pierLength??WALL_THICKNESS * 1.45), z: gate.b.z + dz * (gate.pierLength??WALL_THICKNESS * 1.45) }, owner: gate.owner, thickness: gate.depth });
  }
  for (const tower of walls.towers) for (let index = 0; index < 12; index += 1) {
    const point = (i: number): TerrainPoint => ({ x: tower.centre.x + Math.cos(i * Math.PI / 6) * tower.radius, z: tower.centre.z + Math.sin(i * Math.PI / 6) * tower.radius });
    result.push({ id: `${tower.id}:${index}`, a: point(index), b: point(index + 1), owner: tower.owner });
  }
  return result;
}

test("Žatec and Brod generate deterministic organic loops and expected entrances", () => {
  const zatec = plan("zatec_1421"), brod = plan("nemecky_brod_1422");
  assert.deepEqual(zatec.walls.issues, []); assert.deepEqual(brod.walls.issues, []);
  assert.equal(zatec.walls.loops.length, 1); assert.equal(brod.walls.loops.length, 1);
  assert.ok(zatec.walls.gates.length > 0); assert.ok(brod.walls.gates.length > 0);
  for (const result of [zatec, brod]) {
    const rawVertices = new Set(result.tiles.filter(cell => cell.terrain === "town").flatMap(cell =>
      Array.from({ length: 6 }, (_, index) => `${(cell.center.x + Math.cos(index * Math.PI / 3) * result.layout.radius).toFixed(6)},${(cell.center.z + Math.sin(index * Math.PI / 3) * result.layout.radius).toFixed(6)}`)));
    for (const loop of result.walls.loops) {
      assert.ok(loop.points.length >= 3);
      for (let index = 0; index < loop.points.length; index += 1) assert.ok(distance(loop.points[index]!, loop.points[(index + 1) % loop.points.length]!) > 1e-6);
      assert.ok(loop.points.some(point => !rawVertices.has(`${point.x.toFixed(6)},${point.z.toFixed(6)}`)), "rounded outline must not be the raw hex vertex chain");
    }
  }
  const brodGate = (inside: string, outside: string): boolean => brod.walls.gates.some(gate =>
    key(brod.layout.coordAt(gate.inside.x, gate.inside.z)!) === inside && key(brod.layout.coordAt(gate.outside.x, gate.outside.z)!) === outside);
  assert.ok(brodGate("8,11", "8,12"), "bridgeward gate follows the road");
  assert.ok(brodGate("8,9", "8,8"), "northern road gate remains present");
  const shuffled = planTownWalls("nemecky_brod_1422", [...brod.tiles].filter(cell => cell.terrain === "town").reverse(), [...brod.tiles].reverse(), brod.layout, true);
  assert.deepEqual(shuffled, brod.walls, "source ordering cannot affect a wall plan");
});

test("wall bodies, towers, and gate piers clear every passable formation centre", () => {
  for (const id of ["zatec_1421", "nemecky_brod_1422"]) {
    const result = plan(id), obstacles = routeObstacles(result.walls);
    for (const cell of result.tiles) {
      if (cell.terrain === "water" && id !== "nemecky_brod_1422") continue;
      assert.ok(wallRouteSegmentClear(cell.center, cell.center, obstacles), `${id}: ${key(cell)} formation intersects enclosure`);
    }
  }
});

test("the complete uncut enclosure also clears every standing formation", () => {
  for (const id of ["zatec_1421", "nemecky_brod_1422"]) {
    const result = plan(id), frozen = id === "nemecky_brod_1422";
    const fullOutline = result.walls.loops.flatMap(loop => loop.points.map((a, index) => ({
      id: `${loop.id}:uncut:${index}`, a, b: loop.points[(index + 1) % loop.points.length]!, owner: "",
    })));
    for (const cell of result.tiles) {
      if (cell.terrain === "water" && !frozen) continue;
      assert.ok(wallRouteSegmentClear(cell.center, cell.center, fullOutline), `${id}: uncut loop crowds ${key(cell)}`);
    }
  }
});

test("every legal cross-enclosure step has a clear visual route", () => {
  for (const id of ["zatec_1421", "nemecky_brod_1422"]) {
    const result = plan(id), frozen = id === "nemecky_brod_1422";
    const routes = new TownWallRoutes(result.tiles, result.layout, [result.walls], frozen);
    const enclosed = new Set(result.walls.enclosedCells), obstacles = routeObstacles(result.walls);
    let crossings = 0;
    for (const cell of result.tiles) for (const neighbour of result.layout.neighbours(cell)) {
      const next = result.tiles.find(candidate => candidate.col === neighbour.col && candidate.row === neighbour.row)!;
      if ((cell.terrain === "water" || next.terrain === "water") && !frozen) continue;
      if (enclosed.has(key(cell)) === enclosed.has(key(next))) continue;
      crossings += 1;
      const path = routes.route(cell, next);
      assert.ok(path, `${id}: ${key(cell)} -> ${key(next)} has no visual route`);
      assert.deepEqual(path![0], cell.center); assert.deepEqual(path!.at(-1), next.center);
      for (let index = 1; index < path!.length; index += 1) assert.ok(wallRouteSegmentClear(path![index - 1]!, path![index]!, obstacles));
    }
    assert.ok(crossings > 0, `${id}: expected cross-enclosure movement`);
  }
});

test("long routes preserve endpoints and progress while impossible water gaps return null", () => {
  const brod = plan("nemecky_brod_1422");
  const routes = new TownWallRoutes(brod.tiles, brod.layout, [brod.walls], true);
  const from = { col: 0, row: 0 }, to = { col: 15, row: 15 };
  const path = routes.route(from, to);
  assert.ok(path && path.length > 10);
  assert.deepEqual(routes.position(from, to, 0), brod.layout.center(from.col, from.row));
  const end = routes.position(from, to, 1)!, expected = brod.layout.center(to.col, to.row);
  assert.ok(Math.hypot(end.x - expected.x, end.z - expected.z) < 1e-9, "progress 1 reaches the exact visual endpoint");

  const layout = new HexLayout(3, 1);
  const tiles: TerrainCell[] = [0, 1, 2].map(col => ({ col, row: 0, terrain: col === 1 ? "water" : "plains", center: layout.center(col, 0) }));
  assert.equal(new TownWallRoutes(tiles, layout, []).route({ col: 0, row: 0 }, { col: 2, row: 0 }), null);
});

test("wall pieces own the hex that contains all sampled points and plans preserve terrain", () => {
  for (const id of ["zatec_1421", "nemecky_brod_1422"]) {
    const result = plan(id);
    for (const segment of result.walls.segments) {
      const [col, row] = segment.owner.split(",").map(Number);
      for (const t of [0, .25, .5, .75, 1]) {
        const point = { x: segment.a.x + (segment.b.x - segment.a.x) * t, z: segment.a.z + (segment.b.z - segment.a.z) * t };
        assert.ok(result.layout.contains(point.x, point.z, col!, row!), `${id}: ${segment.id} sample ${t} leaks from owner ${segment.owner}`);
      }
    }
    const before = JSON.stringify(result.tiles);
    const environment = planEnvironment(id, result.tiles);
    assert.equal(JSON.stringify(result.tiles), before, `${id}: environment planning changed source terrain`);
    assert.ok(environment.walls.length > 0);
  }
});

test("campaign environment plans report no wall-planning issues", () => {
  for (const id of ENVIRONMENT_SCENARIOS) {
    const { tiles } = field(id);
    const environment = planEnvironment(id, tiles);
    for (const walls of environment.walls) {
      assert.deepEqual(walls.issues, [], `${id}: ${walls.id}`);
      for (const water of tiles.filter(cell => cell.terrain === "water")) {
        assert.ok(!walls.loops.some(loop => pointInPolygon(water.center.x, water.center.z, loop.points.map(point => [point.x, point.z]))),
          `${id}: ${walls.id} encloses water centre ${key(water)}`);
      }
    }
  }
});

test("all generated enclosure crossings retain a cosmetic route", () => {
  for (const id of ENVIRONMENT_SCENARIOS) {
    const { tiles, layout } = field(id);
    const environment = planEnvironment(id, tiles);
    if (environment.walls.length === 0) continue;
    const routes = new TownWallRoutes(tiles, layout, environment.walls, environment.frozenRiver);
    for (const walls of environment.walls) {
      const enclosed = new Set(walls.enclosedCells);
      for (const cell of tiles) for (const neighbour of layout.neighbours(cell)) {
        const next = tiles.find(candidate => candidate.col === neighbour.col && candidate.row === neighbour.row)!;
        if ((cell.terrain === "water" || next.terrain === "water") && !environment.frozenRiver) continue;
        if (enclosed.has(key(cell)) === enclosed.has(key(next))) continue;
        assert.ok(routes.route(cell, next), `${id}: ${walls.id} crossing ${key(cell)} -> ${key(next)} lost its route`);
      }
    }
  }
});
