import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { EnvironmentDetails } from "../src/environment-details.ts";
import { HexLayout } from "../src/hex-coordinates.ts";
import { SceneryVisibility } from "../src/scenery-visibility.ts";
import type { GeneratedTerrain } from "../src/generated-terrain.ts";
import type { BattleSnapshot } from "../src/types.ts";

function waterHex(layout: HexLayout, col: number, row: number): number[] {
  const center = layout.center(col, row);
  const yAt = (x: number, z: number): number => -.7 + .035 * x + .018 * z + .0015 * x * z;
  const vertices = Array.from({ length: 6 }, (_, index) => {
    const angle = index * Math.PI / 3;
    const x = center.x + Math.cos(angle) * layout.radius;
    const z = center.z + Math.sin(angle) * layout.radius;
    return { x, y: yAt(x, z), z };
  });
  const origin = { x: center.x, y: yAt(center.x, center.z), z: center.z };
  const triangles: number[] = [];
  for (let index = 0; index < vertices.length; index += 1) {
    for (const point of [origin, vertices[index]!, vertices[(index + 1) % vertices.length]!]) {
      triangles.push(point.x, point.y, point.z);
    }
  }
  return triangles;
}

function fixture(frozenRiver = true, includeDrySpill = false) {
  const layout = new HexLayout(includeDrySpill ? 3 : 2, 1);
  const tiles = [0, 1].map(col => ({ col, row: 0, terrain: "water", center: layout.center(col, 0) }));
  if (includeDrySpill) tiles.push({ col: 2, row: 0, terrain: "plains", center: layout.center(2, 0) });
  const triangles = new Map(tiles.filter(tile => tile.terrain === "water")
    .map(tile => [`${tile.col},${tile.row}`, waterHex(layout, tile.col, 0)]));
  if (includeDrySpill) {
    const center = layout.center(2, 0), points = [
      { x: center.x - 3.7, z: center.z - .3 },
      { x: center.x - 2.8, z: center.z - .25 },
      { x: center.x - 3.3, z: center.z + .55 },
    ];
    triangles.set("2,0", points.flatMap(point => [point.x, -.7 + .035 * point.x + .018 * point.z + .0015 * point.x * point.z, point.z]));
  }
  const calls: string[] = [];
  const terrain = {
    layout,
    field: { tiles },
    environmentPlan: { frozenRiver },
    waterTrianglesForCell: (col: number, row: number) => {
      calls.push(`${col},${row}`);
      return triangles.get(`${col},${row}`) ?? [];
    },
  } as unknown as GeneratedTerrain;
  const group = new THREE.Group();
  const visibility = new SceneryVisibility(layout);
  const details = new EnvironmentDetails();
  details.addIce(group, terrain, visibility);
  return { details, group, layout, tiles, visibility, calls };
}

function snapshot(overrides: Partial<BattleSnapshot> = {}): BattleSnapshot {
  return {
    protocolVersion: 2, generation: 1, revision: 1, scenario: "river-test", seed: 1,
    cols: 2, rows: 1, round: 1, faction: "hussites", state: "playing", busy: false,
    paused: false, aiRunning: false, fogOfWar: false, tiles: [], units: [], selectedUnitId: null,
    legalMoves: [], legalAttacks: [], marchTargets: [], visibleHexes: [], exploredHexes: [], events: [],
    ...overrides,
  };
}

function descendants(root: THREE.Object3D): THREE.Object3D[] {
  const objects: THREE.Object3D[] = [];
  root.traverse(object => objects.push(object));
  return objects;
}

function positions(mesh: THREE.Mesh): number[] {
  return Array.from((mesh.geometry.getAttribute("position") as THREE.BufferAttribute).array as ArrayLike<number>);
}

function sourceHeightAt(point: { x: number; z: number }, source: number[]): number | null {
  for (let offset = 0; offset + 8 < source.length; offset += 9) {
    const triangle = [0, 1, 2].map(index => ({ x: source[offset + index * 3]!, y: source[offset + index * 3 + 1]!, z: source[offset + index * 3 + 2]! }));
    const [a, b, c] = triangle;
    const denominator = (b!.z - c!.z) * (a!.x - c!.x) + (c!.x - b!.x) * (a!.z - c!.z);
    const wa = ((b!.z - c!.z) * (point.x - c!.x) + (c!.x - b!.x) * (point.z - c!.z)) / denominator;
    const wb = ((c!.z - a!.z) * (point.x - c!.x) + (a!.x - c!.x) * (point.z - c!.z)) / denominator;
    const wc = 1 - wa - wb;
    if (wa >= -1e-4 && wb >= -1e-4 && wc >= -1e-4) return wa * a!.y + wb * b!.y + wc * c!.y;
  }
  return null;
}

function onSharedEdge(point: { x: number; z: number }, left: { x: number; z: number }, right: { x: number; z: number }): boolean {
  const cross = (right.x - left.x) * (point.z - left.z) - (right.z - left.z) * (point.x - left.x);
  const dot = (point.x - left.x) * (right.x - left.x) + (point.z - left.z) * (right.z - left.z);
  const lengthSquared = (right.x - left.x) ** 2 + (right.z - left.z) ** 2;
  return Math.abs(cross) < 1e-5 && dot >= -1e-5 && dot <= lengthSquared + 1e-5;
}

test("ice follows clipped water triangles and joins neighboring cell edges without a perimeter outline", () => {
  const { group, layout, tiles, details } = fixture();
  assert.equal(group.children.length, 2);
  const roots = group.children as THREE.Group[];
  assert.deepEqual(roots.map(root => root.name), ["River ice 0,0", "River ice 1,0"]);
  for (const root of roots) {
    assert.equal(root.children.length, 4);
    assert.equal(root.children[0]!.name, "Ice around breakable centre");
    assert.equal(root.children[1]!.name, "Breakable centre ice");
    assert.equal(root.children[2]!.name, "Water beneath breakable centre");
    assert.equal(root.children[3]!.name, "Ice cracks");
    const ring = root.children[0] as THREE.Mesh;
    const centre = root.children[1] as THREE.Mesh;
    const crackValues = positions(root.children[3] as THREE.Mesh);
    assert.ok(crackValues.length > 0, "cracks remain visible on ice");
    const col = Number(root.name.split(" ")[2]!.split(",")[0]);
    const source = waterHex(layout, col, 0);
    for (let index = 0; index < crackValues.length; index += 3) {
      const sourceY = sourceHeightAt({ x: crackValues[index]!, z: crackValues[index + 2]! }, source);
      assert.notEqual(sourceY, null, "crack endpoints lie on their source water triangle");
      assert.ok(Math.abs(crackValues[index + 1]! - (sourceY! + .057)) < .002,
        "cracks follow sloped, nonzero water elevations");
    }
    assert.equal((ring.material as THREE.MeshStandardMaterial).color.getHex(), 0xbad1d1);
    assert.equal((centre.material as THREE.MeshStandardMaterial).color.getHex(), 0xbad1d1);
    for (const mesh of [ring, centre]) {
      const values = positions(mesh);
      assert.ok(values.length > 0);
      for (let index = 0; index < values.length; index += 3) {
        const point = { x: values[index]!, z: values[index + 2]! };
        const col = Number(root.name.split(" ")[2]!.split(",")[0]);
        const center = layout.center(col, 0), dx = Math.abs(point.x - center.x), dz = Math.abs(point.z - center.z);
        assert.ok(dx <= layout.radius + .002 && dz <= Math.sqrt(3) * layout.radius / 2 + .002
          && Math.sqrt(3) * dx + dz <= Math.sqrt(3) * layout.radius + .004,
        `ice remains inside its hex: ${root.name} @ ${point.x},${point.z}`);
      }
    }
    const holeValues = positions(centre);
    const center = tiles[roots.indexOf(root)]!.center;
    for (let index = 0; index < holeValues.length; index += 3) {
      assert.ok(Math.hypot(holeValues[index]! - center.x, holeValues[index + 2]! - center.z) <= .901,
        "breakable patch stays within the small central hole");
    }
  }

  // Both cells receive the very same elevations at the shared odd-q edge endpoints.
  const leftCenter = tiles[0]!.center;
  const sharedA = { x: leftCenter.x + 2, z: leftCenter.z + Math.sqrt(12) };
  const sharedB = { x: leftCenter.x + 4, z: leftCenter.z };
  for (const endpoint of [sharedA, sharedB]) {
    const sourceY = -.7 + .035 * endpoint.x + .018 * endpoint.z + .0015 * endpoint.x * endpoint.z;
    const iceY = sourceY + .045;
    for (const root of roots) {
      const ring = root.children[0] as THREE.Mesh;
      const values = positions(ring);
      assert.ok(Array.from({ length: values.length / 3 }, (_, index) => ({
        x: values[index * 3]!, y: values[index * 3 + 1]!, z: values[index * 3 + 2]!,
      })).some(point => onSharedEdge(point, sharedA, sharedB) && Math.hypot(point.x - endpoint.x, point.z - endpoint.z) < 1e-5 && Math.abs(point.y - iceY) < 1e-5),
      "each neighboring ice mesh contains the same shared-edge endpoint at the water elevation");
    }
  }
  details.dispose();
});

test("centre ice breaks independently while water, fog ownership, and disposal remain intact", () => {
  const { group, details, visibility, tiles } = fixture();
  const roots = group.children as THREE.Group[];
  details.update(snapshot({ brokenIceHexes: ["1,0"] }));
  assert.equal(roots[0]!.children[1]!.visible, true);
  assert.equal(roots[1]!.children[1]!.visible, false);
  assert.equal(roots[1]!.children[2]!.visible, true);

  visibility.update(snapshot({ fogOfWar: true, exploredHexes: ["0,0"] }));
  assert.equal(roots[0]!.visible, true);
  assert.equal(roots[1]!.visible, false);
  visibility.update(snapshot());
  assert.ok(roots.every(root => root.visible));

  const geometryDisposals = new Set<THREE.BufferGeometry>();
  const materialDisposals = new Set<THREE.Material>();
  for (const object of descendants(group)) {
    if (!(object instanceof THREE.Mesh || object instanceof THREE.LineSegments)) continue;
    geometryDisposals.add(object.geometry);
    object.geometry.addEventListener("dispose", () => geometryDisposals.delete(object.geometry));
    const material = Array.isArray(object.material) ? object.material : [object.material];
    for (const item of material) {
      materialDisposals.add(item);
      item.addEventListener("dispose", () => materialDisposals.delete(item));
    }
  }
  details.dispose();
  assert.equal(geometryDisposals.size, 0);
  assert.equal(materialDisposals.size, 0);
  assert.equal(group.children.length, 2, "the details owner disposes resources but leaves scene ownership to its parent");
  assert.equal(tiles.length, 2);
});

test("water surface spill adds edge ice and fog ownership to dry neighboring cells", () => {
  const { group, details, visibility, layout, calls } = fixture(true, true);
  assert.deepEqual(calls, ["0,0", "1,0", "2,0"], "query every cell so shoreline spill can cross into dry terrain");
  const roots = group.children as THREE.Group[];
  assert.deepEqual(roots.map(root => root.name), ["River ice 0,0", "River ice 1,0", "River ice 2,0"]);
  const dryRoot = roots[2]!;
  assert.ok(positions(dryRoot.children[0] as THREE.Mesh).length > 0, "dry edge receives clipped water ice");
  visibility.update(snapshot({ fogOfWar: true, exploredHexes: ["0,0", "1,0"] }));
  assert.equal(dryRoot.visible, false, "dry edge ice follows its own cell fog");
  visibility.update(snapshot({ fogOfWar: true, exploredHexes: ["2,0"] }));
  assert.equal(dryRoot.visible, true);
  assert.equal(visibility.keyForObject(dryRoot), "2,0");
  details.dispose();
  assert.equal(layout.cols, 3);
});

test("non-frozen environments do not add ice", () => {
  const { group, details } = fixture(false);
  assert.equal(group.children.length, 0);
  details.dispose();
});
