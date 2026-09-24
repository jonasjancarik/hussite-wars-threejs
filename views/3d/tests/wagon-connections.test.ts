import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { HexLayout } from "../src/hex-coordinates.ts";
import { WagonConnections } from "../src/wagon-connections.ts";
import type { BattleSnapshot, UnitSnapshot } from "../src/types.ts";

function unit(id: number, col: number, row: number, overrides: Partial<UnitSnapshot> = {}): UnitSnapshot {
  return {
    id, col, row, type: "VOZOVA_HRADBA", name: `Wagon ${id}`, faction: "hussites", unitClass: "wagon",
    health: 100, maxHealth: 100, morale: 100, maxMorale: 100, hasMoved: false, hasAttacked: false,
    isDefending: false, isRouting: false, formationClosed: true, marching: false, ...overrides,
  };
}

function snapshot(units: UnitSnapshot[], overrides: Partial<BattleSnapshot> = {}): BattleSnapshot {
  return {
    protocolVersion: 2, generation: 1, revision: 1, scenario: "wagon-connections", cols: 4, rows: 3,
    round: 1, faction: "hussites", state: "playing", busy: false, paused: false, aiRunning: false,
    fogOfWar: false, tiles: [], units, selectedUnitId: null, inspection: null,
    legalMoves: [], legalAttacks: [], marchTargets: [], visibleHexes: [], exploredHexes: [], events: [],
    ...overrides,
  };
}

function links(connection: WagonConnections): THREE.Mesh[] {
  const pair = connection.group.children[0];
  return pair ? pair.children.filter((child): child is THREE.Mesh => child instanceof THREE.Mesh) : [];
}

// A straight three-wagon line: the middle wagon holds the line bonus, so both pairs chain.
function line(overrides: Partial<Record<1 | 2 | 3, Partial<UnitSnapshot>>> = {}): UnitSnapshot[] {
  return [unit(1, 0, 0, overrides[1]), unit(2, 1, 0, overrides[2]), unit(3, 2, 0, overrides[3])];
}

test("connects each odd-q adjacent closed wagon pair once and reuses unchanged visuals", () => {
  const layout = new HexLayout(4, 3);
  assert.ok(layout.neighbours({ col: 0, row: 0 }).some(coord => coord.col === 1 && coord.row === 0));
  const connection = new WagonConnections({
    group: new THREE.Group(), interactiveMeshes: [], heightAt: () => 9, renderedHeightAt: () => 2,
  }, layout);
  const first = snapshot(line());

  connection.update(first);
  assert.equal(connection.group.children.length, 2);
  assert.ok(links(connection).length >= 8);
  assert.ok(links(connection).every(link => Math.abs(link.position.y - 2.48) < 1e-6));
  const pair = connection.group.children[0]!;
  const geometry = links(connection)[0]!.geometry;

  connection.update({ ...first, revision: 2 });
  assert.equal(connection.group.children[0], pair);
  assert.equal(links(connection)[0]!.geometry, geometry);
  connection.dispose();
});

test("marching wagons use fewer, lighter links while closed wagons use the fixed chain", () => {
  const connection = new WagonConnections({ group: new THREE.Group(), interactiveMeshes: [], heightAt: () => 0 }, new HexLayout(4, 3));
  const closed = snapshot(line());
  connection.update(closed);
  const closedPair = connection.group.children[0]!;
  const closedMaterial = links(connection)[0]!.material as THREE.MeshStandardMaterial;
  const closedLinkCount = links(connection).length;
  assert.ok(closedLinkCount >= 8);
  assert.equal(closedMaterial.opacity, 0.75);

  connection.update(snapshot(line({ 1: { marching: true }, 2: { marching: true }, 3: { marching: true } })));
  assert.equal(connection.group.children.length, 2);
  assert.notEqual(connection.group.children[0], closedPair);
  const marchingMaterial = links(connection)[0]!.material as THREE.MeshStandardMaterial;
  assert.ok(links(connection).length < closedLinkCount);
  assert.equal(marchingMaterial.opacity, 0.55);
  connection.dispose();
});

test("chains only wagons that hold the line bonus", () => {
  const connection = new WagonConnections({ group: new THREE.Group(), interactiveMeshes: [], heightAt: () => 0 }, new HexLayout(4, 3));
  const crusaders = { faction: "crusaders" as const };
  const cases: BattleSnapshot[] = [
    snapshot([unit(1, 0, 0), unit(2, 1, 0)]),
    snapshot(line({ 2: { health: 0 } })),
    snapshot(line({ 2: { formationClosed: false } })),
    snapshot(line({ 2: { breached: true } })),
    snapshot(line({ 3: crusaders })),
    snapshot([unit(1, 0, 0), unit(2, 2, 0), unit(3, 2, 2)]),
    snapshot(line({ 1: crusaders, 2: crusaders, 3: crusaders }), { fogOfWar: true, visibleHexes: ["0,0", "1,0"] }),
  ];

  for (const candidate of cases) {
    connection.update(candidate);
    assert.equal(connection.group.children.length, 0);
  }
  connection.dispose();
});

test("removes stale pairs and releases owned link resources", () => {
  const connection = new WagonConnections({ group: new THREE.Group(), interactiveMeshes: [], heightAt: () => 0 }, new HexLayout(4, 3));
  connection.update(snapshot(line()));
  const mesh = links(connection)[0]!;
  const geometry = mesh.geometry;
  const material = mesh.material as THREE.Material;
  let geometryDisposed = 0;
  let materialDisposed = 0;
  const originalGeometryDispose = geometry.dispose.bind(geometry);
  const originalMaterialDispose = material.dispose.bind(material);
  geometry.dispose = () => { geometryDisposed += 1; originalGeometryDispose(); };
  material.dispose = () => { materialDisposed += 1; originalMaterialDispose(); };

  connection.update(snapshot(line({ 3: { formationClosed: false } })));
  assert.equal(connection.group.children.length, 0);
  connection.dispose();
  assert.equal(geometryDisposed, 1);
  assert.equal(materialDisposed, 1);
  connection.dispose();
  assert.equal(geometryDisposed, 1);
  assert.equal(materialDisposed, 1);
});

test("hangs the chain from wagon to wagon instead of stacking links down a steep flank", () => {
  const layout = new HexLayout(4, 3);
  const brow = (layout.center(0, 0).x + layout.center(1, 0).x) / 2 - 1;
  const heightAt = (x: number): number => x < brow ? 4 : 0;
  const connection = new WagonConnections({ group: new THREE.Group(), interactiveMeshes: [], heightAt }, layout);
  connection.update(snapshot(line()));
  const pair = connection.group.children.find(child => (child.userData.wagonIds as number[]).includes(1))!;
  const chain = pair.children as THREE.Mesh[];
  const flatCount = 10;

  assert.ok(chain.length > flatCount, "a longer drop takes more links");
  for (let index = 1; index < chain.length; index += 1) {
    const gap = chain[index]!.position.distanceTo(chain[index - 1]!.position);
    assert.ok(gap > 0.2 && gap < 0.6, `links stay evenly spaced, got ${gap}`);
    assert.ok(chain[index]!.position.y <= chain[index - 1]!.position.y + 1e-6, "the chain only descends");
  }
  for (const link of chain) assert.ok(link.position.y >= heightAt(link.position.x) + 0.3 - 1e-6);
  connection.dispose();
});
