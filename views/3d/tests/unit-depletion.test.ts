import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { HexLayout } from "../src/hex-coordinates.ts";
import { UnitPresentation } from "../src/units.ts";
import type { BattleSnapshot, UnitSnapshot } from "../src/types.ts";

const base: UnitSnapshot = { id: 1, type: "CEPNICI", name: "Flail infantry", faction: "hussites",
  unitClass: "infantry", col: 0, row: 0, health: 80, maxHealth: 80, morale: 70, maxMorale: 70,
  hasMoved: false, hasAttacked: false, isDefending: false, isRouting: false, formationClosed: false, marching: false };
const state = (unit: Partial<UnitSnapshot> = {}, rest: Partial<BattleSnapshot> = {}): BattleSnapshot => ({
  protocolVersion: 2, generation: 1, revision: 1, scenario: null, round: 1, faction: "hussites",
  state: "playing", busy: false, paused: false, aiRunning: false, tiles: [], units: [{ ...base, ...unit }],
  selectedUnitId: null, legalMoves: [], legalAttacks: [], marchTargets: [], visibleHexes: [], exploredHexes: [], events: [], ...rest,
});
const assets = {
  async load(name: string) {
    const result = new THREE.Group(); result.name = name;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1, 0.2), new THREE.MeshBasicMaterial());
    mesh.position.y = 0.5; result.add(mesh); return result;
  },
  async clone(name: string) { return this.load(name); },
};
function presenter() { return new UnitPresentation({ group: new THREE.Group(), interactiveMeshes: [], heightAt: () => 2 },
  new HexLayout(3, 3), assets); }
const figures = (units: UnitPresentation) => units.group.children[0]!.children.filter(child => child instanceof THREE.Group);

test("losses leave stable gaps and healing restores the same figures without changing rules", async () => {
  const units = presenter();
  await units.update(state());
  const original = figures(units);
  assert.equal(original.filter(figure => figure.visible).length, 5);
  const wounded = state({ health: 48 });
  const before = JSON.stringify(wounded);
  await units.update(wounded);
  assert.equal(JSON.stringify(wounded), before);
  assert.equal(figures(units).filter(figure => figure.visible).length, 3);
  assert.deepEqual(figures(units), original);
  await units.update(state({ health: 1 }));
  assert.equal(figures(units).filter(figure => figure.visible).length, 1);
  await units.update(state());
  assert.equal(figures(units).filter(figure => figure.visible).length, 5);
  assert.deepEqual(figures(units), original);
  units.dispose();
});

test("routing and defending do not remove healthy troops", async () => {
  const units = presenter();
  await units.update(state({ isRouting: true, morale: 0, isDefending: true }));
  assert.equal(figures(units).filter(figure => figure.visible).length, 5);
  const highest = Math.max(...figures(units).map(figure => new THREE.Box3().setFromObject(figure).max.y));
  assert.ok(units.markerPosition(1)!.y > highest);
  units.dispose();
});

test("guns, wagons, fortifications and commanders survive until their unit is eliminated", async () => {
  for (const [type, unitClass] of [["HOUFNICE", "artillery"], ["VOZOVA_HRADBA", "wagon"],
    ["POLNI_OPEVNENI", "fortification"], ["JAN_ZIZKA", "commander"]]) {
    const units = presenter();
    await units.update(state({ type, unitClass, health: 1 }));
    const visible = figures(units).filter(figure => figure.visible);
    if (unitClass === "artillery") {
      assert.equal(visible.filter(figure => figure.name === "artillery_houfnice").length, 1);
      assert.equal(visible.filter(figure => figure.name === "artillery_gunner").length, 1);
    } else assert.ok(visible.length > 0);
    await units.update(state({ type, unitClass, health: 0 }));
    assert.equal(units.group.children.length, 0);
    assert.equal(units.hitTargets.length, 0);
    assert.equal(units.markerPosition(1), null);
    units.dispose();
  }
});

test("enemy figures and their anchors disappear as soon as fog hides them", async () => {
  const units = presenter();
  await units.update(state({ faction: "crusaders" }, { fogOfWar: true, visibleHexes: ["0,0"] }));
  assert.equal(units.group.children.length, 1);
  await units.update(state({ faction: "crusaders" }, { fogOfWar: true, exploredHexes: ["0,0"] }));
  assert.equal(units.group.children.length, 0);
  assert.equal(units.hitTargets.length, 0);
  assert.equal(units.markerPosition(1), null);
  units.dispose();
});

test("dispose prevents a delayed asset load from reviving a unit", async () => {
  let release!: (group: THREE.Group) => void;
  const waiting = new Promise<THREE.Group>(resolve => { release = resolve; });
  const units = new UnitPresentation({ group: new THREE.Group(), interactiveMeshes: [], heightAt: () => 0 },
    new HexLayout(3, 3), { load: () => waiting, clone: () => waiting });
  const pending = units.update(state());
  units.dispose();
  release(await assets.load("infantry_flail"));
  await pending;
  assert.equal(units.group.children.length, 0);
  assert.equal(units.hitTargets.length, 0);
});
