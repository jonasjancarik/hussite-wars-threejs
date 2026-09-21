import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { UnitPresentation } from "../src/units.ts";
import { unitRecipe } from "../src/unit-recipes.ts";
import { HexLayout } from "../src/hex-coordinates.ts";
import type { BattleSnapshot, UnitSnapshot } from "../src/types.ts";

const root = new URL("../../../", import.meta.url);
const paths = JSON.parse(readFileSync(new URL("assets/3d/model-paths.json", root), "utf8")) as Record<string, string>;
const roster = runInNewContext(`${readFileSync(new URL("js/data/unitTypes.js", root), "utf8")}; UnitTypes`) as
  Record<string, { name: string; faction: UnitSnapshot["faction"]; unitClass: string; maxHealth: number }>;

class ExportedAssets {
  readonly cache = new Map<string, Promise<THREE.Group>>();
  load(name: string): Promise<THREE.Group> {
    let pending = this.cache.get(name);
    if (!pending) {
      assert.ok(paths[name], `${name}: missing catalog entry`);
      const bytes = readFileSync(new URL(`assets/3d/${paths[name]}`, root));
      pending = new GLTFLoader().parseAsync(new Uint8Array(bytes).buffer, "").then(result => {
        assert.equal(result.animations.length, 0, `${name}: active unit models must remain static`);
        result.scene.name = name;
        return result.scene;
      });
      this.cache.set(name, pending);
    }
    return pending;
  }
  async clone(name: string): Promise<THREE.Group> { return (await this.load(name)).clone(true); }
}

function snapshot(units: UnitSnapshot[], revision = 1): BattleSnapshot {
  return { protocolVersion: 2, generation: 1, revision, scenario: "complete-roster", cols: 10, rows: 6,
    round: 1, faction: "hussites", state: "playing", busy: false, paused: false, aiRunning: false, fogOfWar: false,
    tiles: [], units, selectedUnitId: null, legalMoves: [], legalAttacks: [], marchTargets: [],
    visibleHexes: [], exploredHexes: [], events: [] };
}

const units: UnitSnapshot[] = Object.entries(roster).map(([type, data], index) => ({
  id: index + 1, type, name: data.name, faction: data.faction, unitClass: data.unitClass,
  col: index % 10, row: Math.floor(index / 10), health: data.maxHealth, maxHealth: data.maxHealth,
  morale: 100, maxMorale: 100, hasMoved: false, hasAttacked: false, isDefending: false,
  isRouting: false, formationClosed: false, marching: false, dismounted: false,
}));

function verifyFigures(presentation: UnitPresentation, unit: UnitSnapshot): void {
  const formation = presentation.group.children.find(child => child.name === `${unit.name} (${unit.id})`)!;
  assert.ok(formation, unit.type);
  const figures = formation.children.filter(child => child instanceof THREE.Group);
  const expected = unitRecipe(unit).reduce((sum, recipe) => sum + recipe.offsets.length, 0) + (unit.unitClass === "commander" ? 1 : 0);
  assert.equal(figures.length, expected, `${unit.type}: missing or reparented figures`);
  const hit = presentation.hitTargets.find(object => object.userData.unitId === unit.id) as THREE.Mesh<THREE.CylinderGeometry>;
  assert.ok(hit && !hit.visible, unit.type);
  const radius = hit.geometry.parameters.radiusTop;
  assert.ok(radius < 4 * Math.sqrt(3) / 2, `${unit.type}: hit target crosses the hex inradius`);
  let measuredRadius = 0;
  for (const figure of figures) {
    assert.equal(figure.parent, formation);
    assert.ok(Math.abs(new THREE.Box3().setFromObject(figure).min.y) < 0.005, `${unit.type}: figure floats`);
    figure.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      const positions = object.geometry.attributes.position!;
      for (let i = 0; i < positions.count; i += 1) {
        const point = new THREE.Vector3().fromBufferAttribute(positions, i).applyMatrix4(object.matrixWorld);
        measuredRadius = Math.max(measuredRadius, Math.hypot(point.x - formation.position.x, point.z - formation.position.z));
        assert.ok(point.y < 4.25, `${unit.type}: exported geometry exceeds the picking height`);
      }
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        assert.ok(!/^team_(cloth|paint)\.\d+$/.test(material.name), `${unit.type}: duplicated uncoloured material slot`);
      }
    });
  }
  assert.ok(measuredRadius <= radius + .005, `${unit.type}: radius ${measuredRadius.toFixed(3)} exceeds picking radius ${radius}`);
}

test("all 59 roster definitions load real static assets and fit the selectable hex", async () => {
  assert.equal(units.length, 59);
  const assets = new ExportedAssets();
  const presentation = new UnitPresentation({ group: new THREE.Group(), interactiveMeshes: [], heightAt: () => 0 }, new HexLayout(10, 6), assets);
  await presentation.update(snapshot(units));
  assert.equal(presentation.group.children.length, units.length);
  const problems: string[] = [];
  for (const unit of units) {
    try { verifyFigures(presentation, unit); } catch (error) { problems.push(String(error)); }
  }
  assert.deepEqual(problems, []);
  const pilots = units.filter(unit => ["cavalry", "heavyCavalry"].includes(unit.unitClass));
  const dismounted = pilots.map(unit => ({ ...unit, dismounted: true }));
  await presentation.update(snapshot(dismounted, 2));
  for (const unit of dismounted) verifyFigures(presentation, unit);
  presentation.dispose();
});
