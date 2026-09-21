import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { GeneratedTerrain } from "../src/generated-terrain.ts";
import { TacticalOverlays } from "../src/overlays.ts";
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
