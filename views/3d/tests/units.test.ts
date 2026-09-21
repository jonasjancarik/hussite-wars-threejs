import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { HexLayout } from "../src/hex-coordinates.ts";
import { UnitPresentation } from "../src/units.ts";
import type { BattleSnapshot, UnitSnapshot } from "../src/types.ts";

class TestAssets {
  public async clone(): Promise<THREE.Group> { return this.load(); }
  public async load(): Promise<THREE.Group> {
    const model = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1, 0.2), new THREE.MeshStandardMaterial());
    mesh.position.y = 0.8; // Deliberately exported with its feet above the origin.
    model.add(mesh);
    return model;
  }
}

function snapshot(overrides: Partial<UnitSnapshot> = {}): BattleSnapshot {
  return {
    protocolVersion: 2, generation: 1, revision: 1, scenario: "grounding", cols: 3, rows: 2,
    round: 1, faction: "hussites", state: "playing", busy: false, paused: false, aiRunning: false,
    tiles: [], selectedUnitId: null, legalMoves: [], legalAttacks: [], marchTargets: [],
    visibleHexes: [], exploredHexes: [], events: [], units: [{
      id: 1, col: 0, row: 0, type: "KOPINICI", name: "Pikemen", faction: "hussites", unitClass: "infantry",
      health: 100, maxHealth: 100, morale: 100, maxMorale: 100, hasMoved: false, hasAttacked: false,
      isDefending: false, isRouting: false, formationClosed: false, marching: false, ...overrides,
    }],
  };
}

test("each figure rests on rendered terrain after movement, rotation and routing scale", async () => {
  const height = (x: number, z: number): number => 0.18 * x + 0.11 * z;
  const units = new UnitPresentation({ group: new THREE.Group(), interactiveMeshes: [],
    heightAt: () => 50, renderedHeightAt: height }, new HexLayout(3, 2), new TestAssets());
  for (const state of [snapshot(), snapshot({ col: 2, row: 1, marching: true, isRouting: true })]) {
    await units.update(state);
    const formation = units.group.children[0]!;
    const figures = formation.children.filter(child => child instanceof THREE.Group);
    assert.equal(figures.length, 5);
    for (const figure of figures) {
      const position = figure.getWorldPosition(new THREE.Vector3());
      const bottom = new THREE.Box3().setFromObject(figure).min.y;
      assert.ok(Math.abs(bottom - height(position.x, position.z)) < 1e-6,
        `feet ${bottom}, terrain ${height(position.x, position.z)}`);
    }
  }
});

test("selection cylinder is excluded from rendering but remains clickable", async () => {
  const units = new UnitPresentation({ group: new THREE.Group(), interactiveMeshes: [], heightAt: () => 0 },
    new HexLayout(3, 2), new TestAssets());
  await units.update(snapshot());
  const hit = units.hitTargets[0]!;
  assert.equal(hit.visible, false);
  const rendered: THREE.Object3D[] = [];
  units.group.traverseVisible(object => rendered.push(object));
  assert.ok(!rendered.includes(hit));
  const center = hit.getWorldPosition(new THREE.Vector3());
  const ray = new THREE.Raycaster(center.clone().add(new THREE.Vector3(0, 10, 0)), new THREE.Vector3(0, -1, 0));
  const intersection = ray.intersectObjects(units.hitTargets, false)[0];
  assert.ok(intersection);
  assert.equal(units.unitIdFromHit(intersection.object), 1);
  assert.ok(!rendered.some(object => object instanceof THREE.Mesh && object.geometry instanceof THREE.CircleGeometry));
});
