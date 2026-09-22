import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { HexLayout } from "../src/hex-coordinates.ts";
import { UnitPresentation } from "../src/units.ts";
import type { BattleSnapshot, UnitSnapshot } from "../src/types.ts";

class TestAssets {
  public async clone(name: string): Promise<THREE.Group> { return (await this.load(name)).clone(true); }
  public async load(name: string): Promise<THREE.Group> {
    const model = new THREE.Group();
    model.name = name;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1, 0.4), new THREE.MeshStandardMaterial());
    mesh.position.y = 0.7;
    model.add(mesh);
    return model;
  }
}

const movingUnit: UnitSnapshot = {
  id: 17, col: 1, row: 1, type: "JAN_ZIZKA", name: "Jan Žižka", faction: "hussites", unitClass: "commander",
  health: 100, maxHealth: 100, morale: 100, maxMorale: 100, hasMoved: false, hasAttacked: false,
  isDefending: false, isRouting: false, formationClosed: false, marching: false,
};

function battleSnapshot(movement?: NonNullable<BattleSnapshot["movement"]>): BattleSnapshot {
  return {
    protocolVersion: 2, generation: 1, revision: 1, scenario: "movement-test", cols: 3, rows: 2,
    round: 1, faction: "hussites", state: "playing", busy: false, paused: false, aiRunning: false,
    tiles: [], units: [movingUnit], selectedUnitId: movingUnit.id, legalMoves: [], legalAttacks: [], marchTargets: [],
    visibleHexes: [], exploredHexes: [], events: [], ...(movement ? { movement } : {}),
  };
}

test("movement callback places the whole formation at its routed point and grounds it there", async () => {
  const layout = new HexLayout(3, 2);
  const terrainHeight = (x: number, z: number): number => 0.12 * x + 0.08 * z;
  const terrain = { group: new THREE.Group(), interactiveMeshes: [], heightAt: terrainHeight, renderedHeightAt: terrainHeight };
  let callbackInput: BattleSnapshot["movement"];
  const routedPoint = { x: 2.75, z: -1.4 };
  const units = new UnitPresentation(terrain, layout, new TestAssets(), movement => {
    callbackInput = movement;
    return routedPoint;
  });
  const movement = { unitId: movingUnit.id, from: { col: 0, row: 0 }, to: { col: 1, row: 1 }, progress: 0.42 };
  await units.update(battleSnapshot(movement));

  const formation = units.group.children[0]!;
  assert.deepEqual(callbackInput, movement);
  assert.ok(Math.abs(formation.position.x - routedPoint.x) < 1e-9);
  assert.ok(Math.abs(formation.position.z - routedPoint.z) < 1e-9);
  assert.ok(Math.abs(formation.position.y - terrainHeight(routedPoint.x, routedPoint.z)) < 1e-9);
  const banner = formation.children.find(child => child.name === "commander_standard");
  assert.ok(banner, "commander banner remains attached to its moving formation root");
  assert.equal(banner.parent, formation);
  for (const figure of formation.children.filter(child => child instanceof THREE.Group)) {
    const worldPosition = figure.getWorldPosition(new THREE.Vector3());
    const bottom = new THREE.Box3().setFromObject(figure).min.y;
    assert.ok(Math.abs(bottom - terrainHeight(worldPosition.x, worldPosition.z)) < 1e-6,
      `figure bottom ${bottom} should follow terrain at its routed location`);
  }
});

test("a missing or cancelled route snaps to the authoritative target tile", async () => {
  const layout = new HexLayout(3, 2);
  const target = layout.center(movingUnit.col, movingUnit.row);
  let calls = 0;
  const units = new UnitPresentation({ group: new THREE.Group(), interactiveMeshes: [], heightAt: () => 0 },
    layout, new TestAssets(), () => { calls += 1; return null; });
  const movement = { unitId: movingUnit.id, from: { col: 0, row: 0 }, to: { col: 1, row: 1 }, progress: 0.8 };
  await units.update(battleSnapshot(movement));
  const formation = units.group.children[0]!;
  assert.equal(calls, 1);
  assert.ok(Math.abs(formation.position.x - target.x) < 1e-9);
  assert.ok(Math.abs(formation.position.z - target.z) < 1e-9);

  await units.update(battleSnapshot());
  assert.ok(Math.abs(formation.position.x - target.x) < 1e-9);
  assert.ok(Math.abs(formation.position.z - target.z) < 1e-9);
  assert.equal(calls, 1, "cleared movement cannot leave a stale routed position");
});
