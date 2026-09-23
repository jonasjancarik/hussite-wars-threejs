import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { GeneratedTerrain } from "../src/generated-terrain.ts";
import { HexLayout } from "../src/hex-coordinates.ts";
import { TacticalOverlays } from "../src/overlays.ts";
import { SceneryVisibility } from "../src/scenery-visibility.ts";
import { batchStaticMeshes } from "../src/static-batching.ts";
import type { BattleSnapshot } from "../src/types.ts";

function snapshot(overrides: Partial<BattleSnapshot> = {}): BattleSnapshot {
  return {
    protocolVersion: 2, generation: 1, revision: 1, scenario: "fog-test", seed: 7,
    cols: 2, rows: 1, round: 1, faction: "hussites", state: "playing",
    busy: false, paused: false, aiRunning: false, fogOfWar: true,
    tiles: [{ col: 0, row: 0, terrain: "forest" }, { col: 1, row: 0, terrain: "town" }],
    units: [], selectedUnitId: null, legalMoves: [], legalAttacks: [], marchTargets: [],
    objectiveHexes: [{ col: 1, row: 0 }], objectiveKind: "objective",
    visibleHexes: ["0,0"], exploredHexes: ["0,0"], events: [], ...overrides,
  };
}

function nearestVertex(mesh: THREE.Mesh, x: number, z: number): number {
  const positions = mesh.geometry.getAttribute("position") as THREE.BufferAttribute;
  let nearest = 0, distance = Infinity;
  for (let index = 0; index < positions.count; index += 1) {
    const current = Math.hypot(positions.getX(index) - x, positions.getZ(index) - z);
    if (current < distance) { nearest = index; distance = current; }
  }
  return nearest;
}

function averageSurfaceColor(terrain: GeneratedTerrain): THREE.Color {
  const mesh = terrain.group.children[0] as THREE.Mesh;
  const colors = mesh.geometry.getAttribute("color") as THREE.BufferAttribute;
  const average = new THREE.Color(0, 0, 0);
  for (let index = 0; index < colors.count; index += 1) {
    average.r += colors.getX(index); average.g += colors.getY(index); average.b += colors.getZ(index);
  }
  return average.multiplyScalar(1 / colors.count);
}

test("a rules-level field hex receives cultivated ground instead of the plains palette", () => {
  const plains = new GeneratedTerrain(snapshot({ cols: 1, rows: 1,
    tiles: [{ col: 0, row: 0, terrain: "plains" }] }));
  const farmland = new GeneratedTerrain(snapshot({ cols: 1, rows: 1,
    tiles: [{ col: 0, row: 0, terrain: "farmland" }] }));
  assert.equal(farmland.renderedTerrainAt(0, 0), "farmland");
  const plainsColor = averageSurfaceColor(plains), fieldColor = averageSurfaceColor(farmland);
  const colorDistance = Math.hypot(fieldColor.r - plainsColor.r, fieldColor.g - plainsColor.g, fieldColor.b - plainsColor.b);
  assert.ok(colorDistance > 0.04 && fieldColor.b < plainsColor.b,
    `field ${fieldColor.getHexString()} should differ from plains ${plainsColor.getHexString()}`);
  plains.dispose(); farmland.dispose();
});

test("generated plinth sides follow elevated terrain at the map edge", () => {
  const terrain = new GeneratedTerrain(snapshot({ cols: 1, rows: 1,
    tiles: [{ col: 0, row: 0, terrain: "hills" }] }));
  const skirt = terrain.group.children[1] as THREE.Mesh;
  const positions = skirt.geometry.getAttribute("position") as THREE.BufferAttribute;
  let maximum = -Infinity, minimum = Infinity;
  for (let index = 0; index < positions.count; index += 1) {
    maximum = Math.max(maximum, positions.getY(index));
    minimum = Math.min(minimum, positions.getY(index));
  }
  assert.ok(maximum > 3, `plinth should meet the hill edge, got ${maximum}`);
  assert.ok(minimum <= -5.9);
  const surface = terrain.group.children[0] as THREE.Mesh;
  const surfacePositions = surface.geometry.getAttribute("position") as THREE.BufferAttribute;
  // Each column of the cut face starts at its rim; lower rows carry relief.
  const rims = skirt.geometry.getAttribute("rimTop") as THREE.BufferAttribute;
  const skirtTops = new Map<string, number>();
  for (let index = 0; index < positions.count; index += 1) {
    if (positions.getY(index) !== rims.getX(index)) continue;
    skirtTops.set(`${positions.getX(index).toFixed(6)},${positions.getZ(index).toFixed(6)}`, positions.getY(index));
  }
  const { minX, maxX, minZ, maxZ } = terrain.bounds;
  for (let index = 0; index < surfacePositions.count; index += 1) {
    const x = surfacePositions.getX(index), z = surfacePositions.getZ(index);
    if (Math.min(Math.abs(x - minX), Math.abs(x - maxX), Math.abs(z - minZ), Math.abs(z - maxZ)) > 1e-5) continue;
    const key = `${x.toFixed(6)},${z.toFixed(6)}`;
    assert.equal(skirtTops.get(key), surfacePositions.getY(index), `plinth seam at ${key}`);
  }
  terrain.dispose();
});

test("fog cover follows elevated hills instead of leaking terrain above it", () => {
  const hidden = snapshot({ cols: 1, rows: 1, tiles: [{ col: 0, row: 0, terrain: "hills" }],
    visibleHexes: [], exploredHexes: [], objectiveHexes: [] });
  const terrain = new GeneratedTerrain(hidden);
  const overlays = new TacticalOverlays(terrain, terrain.layout);
  overlays.update(hidden);
  const cover = overlays.fogCover;
  const positions = cover.geometry.getAttribute("position") as THREE.BufferAttribute;
  for (let index = 0; index < positions.count; index += 1) {
    const ground = terrain.heightAt(positions.getX(index), positions.getZ(index));
    assert.ok(positions.getY(index) >= ground + 0.39, `${index}: cover ${positions.getY(index)} ground ${ground}`);
  }
  terrain.dispose();
});

test("fog cover follows local peaks without lifting low neighbouring cells", () => {
  const group = new THREE.Group();
  const peak = new THREE.Mesh(new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute([
    -4, 0, -3, 4, 0, -3, 0, 5, 3,
  ], 3)), new THREE.MeshBasicMaterial());
  group.add(peak);
  const layout = new HexLayout(2, 1);
  const peakCenter = layout.center(0, 0), lowCenter = layout.center(1, 0);
  const heightAt = (x: number, z: number): number => Math.max(0, 5 - Math.hypot(x - peakCenter.x, z - peakCenter.z) * 2.5);
  const overlays = new TacticalOverlays({ group, interactiveMeshes: [peak], heightAt }, layout);
  overlays.update(snapshot({ cols: 2, rows: 1, tiles: [
    { col: 0, row: 0, terrain: "hills" }, { col: 1, row: 0, terrain: "plains" },
  ],
    visibleHexes: [], exploredHexes: [], objectiveHexes: [] }));
  // One merged cover: each cell's centre vertex is still its own nearest vertex.
  const highCover = overlays.fogCover;
  const lowCover = overlays.fogCover;
  const highPositions = highCover.geometry.getAttribute("position") as THREE.BufferAttribute;
  const lowPositions = lowCover.geometry.getAttribute("position") as THREE.BufferAttribute;
  const highCenterIndex = nearestVertex(highCover, peakCenter.x, peakCenter.z);
  const lowCenterIndex = nearestVertex(lowCover, lowCenter.x, lowCenter.z);
  assert.ok(highPositions.getY(highCenterIndex) >= 5.4);
  assert.ok(lowPositions.getY(lowCenterIndex) < 1, "lowland fog must not inherit the map-wide maximum");
  peak.geometry.dispose(); (peak.material as THREE.Material).dispose();
});

test("fog cover stays above a separately rendered authored water surface", () => {
  const layout = new HexLayout(1, 1);
  const group = new THREE.Group();
  const overlays = new TacticalOverlays({ group, interactiveMeshes: [], heightAt: () => -1.2 }, layout);
  overlays.update(snapshot({ cols: 1, rows: 1, tiles: [{ col: 0, row: 0, terrain: "water" }],
    visibleHexes: [], exploredHexes: [], objectiveHexes: [] }));
  const positions = overlays.fogCover.geometry.getAttribute("position") as THREE.BufferAttribute;
  for (let index = 0; index < positions.count; index += 1) {
    assert.ok(positions.getY(index) > -0.52, `${index}: fog ${positions.getY(index)} is below water`);
  }
});

test("unexplored 3D terrain is masked and restores when fog is disabled", () => {
  const terrain = new GeneratedTerrain(snapshot());
  const surface = terrain.group.children[0] as THREE.Mesh;
  const colors = surface.geometry.getAttribute("color") as THREE.BufferAttribute;
  const knownCenter = terrain.layout.center(0, 0), hiddenCenter = terrain.layout.center(1, 0);
  const knownIndex = nearestVertex(surface, knownCenter.x, knownCenter.z);
  const hiddenIndex = nearestVertex(surface, hiddenCenter.x, hiddenCenter.z);
  const originalKnown = [colors.getX(knownIndex), colors.getY(knownIndex), colors.getZ(knownIndex)];
  const originalHidden = [colors.getX(hiddenIndex), colors.getY(hiddenIndex), colors.getZ(hiddenIndex)];

  terrain.updateVisibility(snapshot());
  assert.deepEqual([colors.getX(knownIndex), colors.getY(knownIndex), colors.getZ(knownIndex)], originalKnown);
  assert.notDeepEqual([colors.getX(hiddenIndex), colors.getY(hiddenIndex), colors.getZ(hiddenIndex)], originalHidden);

  terrain.updateVisibility(snapshot({ fogOfWar: false, visibleHexes: [], exploredHexes: [] }));
  assert.deepEqual([colors.getX(hiddenIndex), colors.getY(hiddenIndex), colors.getZ(hiddenIndex)], originalHidden);
  terrain.dispose();
});

test("fog cover hides unknown cells while objective marker remains above it", () => {
  const terrain = new GeneratedTerrain(snapshot());
  const overlays = new TacticalOverlays(terrain, terrain.layout);
  overlays.update(snapshot());
  // Each cell contributes a ring and an action fill; all fog covers are one mesh.
  const hiddenRing = overlays.group.children[2] as THREE.Mesh;
  assert.equal(overlays.fogCovers(0, 0), false);
  assert.equal(overlays.fogCovers(1, 0), true);
  assert.equal(overlays.fogCover.visible, true);
  assert.equal(hiddenRing.visible, true, "scenario objective remains visible through fog");
  assert.ok(hiddenRing.renderOrder > overlays.fogCover.renderOrder);
  terrain.dispose();
});

test("the complete hex grid is visible by default and can be hidden", () => {
  const terrain = new GeneratedTerrain(snapshot({ fogOfWar: false, objectiveHexes: [] }));
  const overlays = new TacticalOverlays(terrain, terrain.layout);
  overlays.update(snapshot({ fogOfWar: false, objectiveHexes: [] }));
  const alphas = overlays.grid.geometry.getAttribute("gridColor");
  const everyOutlineDrawn = (): boolean => Array.from({ length: alphas.count }, (_, index) => alphas.getW(index)).every(alpha => alpha > 0);
  assert.ok(overlays.grid.visible && everyOutlineDrawn());
  overlays.setGridVisible(false);
  assert.equal(overlays.grid.visible, false);
  overlays.setGridVisible(true);
  assert.ok(overlays.grid.visible && everyOutlineDrawn());
  terrain.dispose();
});

test("authored scenery reveals explored cells after static batching", () => {
  const layout = new HexLayout(2, 1);
  const root = new THREE.Group();
  const visibility = new SceneryVisibility(layout);
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const material = new THREE.MeshBasicMaterial();
  const cells = [layout.center(0, 0), layout.center(1, 0), layout.center(1, 0)];
  for (const [index, center] of cells.entries()) {
    const decoration = new THREE.Mesh(geometry, material);
    decoration.name = `Decoration ${index}`;
    decoration.position.set(center.x, 0, center.z);
    root.add(decoration);
    visibility.trackObject(decoration, center.x, center.z);
  }
  const landmark = new THREE.Group();
  const hiddenCenter = layout.center(1, 0);
  root.add(landmark);
  visibility.trackObject(landmark, hiddenCenter.x, hiddenCenter.z);
  const result = batchStaticMeshes(root, object => visibility.keyForObject(object));
  assert.equal(result.batches.length, 1);
  visibility.trackBatches(result.batches);
  const fullBounds = result.batches[0]!.mesh.boundingSphere?.clone();
  assert.ok(fullBounds && fullBounds.radius > 1, "batch retains bounds for every authored instance");

  visibility.update(snapshot());
  assert.deepEqual(result.batches[0]!.mesh.boundingSphere, fullBounds,
    "fog changes do not shrink the culling bounds used by later reveals");
  assert.equal(landmark.visible, false);
  const matrix = new THREE.Matrix4();
  result.batches[0]!.mesh.getMatrixAt(0, matrix);
  assert.notEqual(matrix.determinant(), 0, "explored decoration remains visible");
  result.batches[0]!.mesh.getMatrixAt(1, matrix);
  assert.equal(matrix.determinant(), 0, "unexplored decoration is hidden inside its shared batch");

  visibility.update(snapshot({ fogOfWar: false, visibleHexes: [], exploredHexes: [] }));
  assert.equal(landmark.visible, true);
  for (let index = 0; index < result.batches[0]!.matrices.length; index += 1) {
    result.batches[0]!.mesh.getMatrixAt(index, matrix);
    assert.notEqual(matrix.determinant(), 0, `decoration ${index} restores when fog is disabled`);
  }
  visibility.clear();
  geometry.dispose();
  material.dispose();
});
