import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { HexLayout } from "../src/hex-coordinates.ts";
import { SceneryVisibility } from "../src/scenery-visibility.ts";
import { TownWallScenery } from "../src/town-wall-scenery.ts";
import { WALL_THICKNESS, type TownWallPlan } from "../src/town-wall-plan.ts";
import type { BattleSnapshot } from "../src/types.ts";

function snapshot(exploredHexes: string[]): BattleSnapshot {
  return {
    protocolVersion: 2, generation: 1, revision: 1, scenario: "wall-fixture", seed: 1, cols: 6, rows: 6,
    round: 1, faction: "hussites", state: "playing", busy: false, paused: false, aiRunning: false, fogOfWar: true,
    tiles: [], units: [], selectedUnitId: null, legalMoves: [], legalAttacks: [], marchTargets: [], visibleHexes: [], exploredHexes, events: [],
  };
}

function meshes(root: THREE.Object3D): THREE.Mesh[] {
  const result: THREE.Mesh[] = [];
  root.traverse(object => { if (object instanceof THREE.Mesh) result.push(object); });
  return result;
}

test("town walls are terrain-fitted, fog-owned, and leave the planned gate opening clear", () => {
  const layout = new HexLayout(6, 6);
  const center = layout.center(2, 2);
  const terrain = { renderedHeightAt: (x: number, z: number): number => .08 * x - .03 * z };
  const visibility = new SceneryVisibility(layout);
  const plan: TownWallPlan = {
    id: "fixture", loops: [], enclosedCells: ["2,2"], issues: [],
    segments: [{ id: "south", a: { x: center.x - 2.8, z: center.z - 2.3 }, b: { x: center.x + 2.8, z: center.z - 2.3 }, owner: "4,4" }],
    gates: [{ id: "north-gate", a: { x: center.x - 2.5, z: center.z + 2.2 }, b: { x: center.x + 2.5, z: center.z + 2.2 },
      centre: { x: center.x, z: center.z + 2.2 }, normal: { x: 1, z: 0 }, inside: center,
      outside: { x: center.x, z: center.z + 5 }, width: 5, clearance: 2.8, owner: "4,4" }],
    towers: [{ id: "tower", centre: { x: center.x + .8, z: center.z }, radius: .72, owner: "4,4" }],
  };
  const walls = new TownWallScenery([plan], terrain as never, visibility);
  const rendered = meshes(walls.group);
  assert.ok(rendered.length >= 5, "joined wall, open gate, and tower meshes should be present");
  assert.ok(rendered.every(mesh => mesh.geometry.getAttribute("position").count > 0));
  assert.ok(walls.group.children.every(root => root.userData.sceneryCell === "4,4"));
  const masonry = rendered.find(mesh => mesh.name === "Joined masonry wall")!;
  const positions = masonry.geometry.getAttribute("position") as THREE.BufferAttribute;
  for (const point of [
    { x: center.x - 2.8, z: center.z - 2.3 - WALL_THICKNESS / 2 }, { x: center.x - 2.8, z: center.z - 2.3 + WALL_THICKNESS / 2 },
    { x: center.x + 2.8, z: center.z - 2.3 - WALL_THICKNESS / 2 }, { x: center.x + 2.8, z: center.z - 2.3 + WALL_THICKNESS / 2 },
  ]) {
    const expected = terrain.renderedHeightAt(point.x, point.z);
    assert.ok(Array.from({ length: positions.count }, (_, index) => positions.getX(index)).some((x, index) =>
      Math.abs(x - point.x) < 2e-5 && Math.abs(positions.getZ(index) - point.z) < 2e-5
        && Math.abs(positions.getY(index) - expected) < 2e-5), "wall base follows the rendered terrain at every corner");
  }

  walls.group.updateMatrixWorld(true);
  const gate = walls.group.children.find(root => root.name.includes("north-gate"))!;
  const gateY = terrain.renderedHeightAt(center.x, center.z + 2.2) + 1.4;
  const gateBounds = new THREE.Box3().setFromObject(gate);
  const gateGround = Math.max(...Array.from({ length: 9 }, (_, index) => [-3.4,0,3.4].map(offset=>
    terrain.renderedHeightAt(center.x - 2.5 + index * 5 / 8, center.z + 2.2+offset))).flat());
  assert.ok(gateBounds.max.z - gateBounds.min.z > .45, "gate depth follows the a-b perpendicular, not routing normal");
  assert.ok(gateBounds.max.y < gateGround + 2.8 + 2.5, "shallow arch, gatehouse and roof stay within their height budget");
  const raycaster = new THREE.Raycaster(new THREE.Vector3(center.x, gateY, center.z + 8), new THREE.Vector3(0, 0, -1));
  assert.equal(raycaster.intersectObject(gate, true).length, 0, "gate opening has no floor, lintel, or pier below clearance");

  visibility.update(snapshot([]));
  assert.ok(walls.group.children.every(root => !root.visible), "unexplored wall owners remain hidden");
  visibility.update(snapshot(["4,4"]));
  assert.ok(walls.group.children.every(root => root.visible), "exploring the owner reveals its geometry");

  const remainingGeometry = new Set<THREE.BufferGeometry>();
  const remainingMaterials = new Set<THREE.Material>();
  for (const mesh of rendered) {
    remainingGeometry.add(mesh.geometry);
    mesh.geometry.addEventListener("dispose", () => remainingGeometry.delete(mesh.geometry));
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      remainingMaterials.add(material);
      material.addEventListener("dispose", () => remainingMaterials.delete(material));
    }
  }
  walls.dispose();
  assert.equal(remainingGeometry.size, 0);
  assert.equal(remainingMaterials.size, 0);
  assert.equal(walls.group.children.length, 0);
});
