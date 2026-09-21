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
  // Each cell contributes ring, action fill, then fog cover.
  const knownCover = overlays.group.children[2] as THREE.Mesh;
  const hiddenRing = overlays.group.children[3] as THREE.Mesh;
  const hiddenCover = overlays.group.children[5] as THREE.Mesh;
  assert.equal(knownCover.visible, false);
  assert.equal(hiddenCover.visible, true);
  assert.equal(hiddenRing.visible, true, "scenario objective remains visible through fog");
  assert.ok(hiddenRing.renderOrder > hiddenCover.renderOrder);
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
