import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { HexLayout } from "../src/hex-coordinates.ts";
import { UnitPresentation } from "../src/units.ts";
import type { BattleSnapshot, UnitSnapshot } from "../src/types.ts";

class TestAssets {
  public readonly loaded: string[] = [];
  private readonly models: Record<string, THREE.Group>;

  public constructor(models: Record<string, THREE.Group> = {}) { this.models = models; }

  public async clone(name: string): Promise<THREE.Group> { return (await this.load(name)).clone(true); }
  public async load(name = "infantry_polearm"): Promise<THREE.Group> {
    this.loaded.push(name);
    if (this.models[name]) return this.models[name]!;
    const model = new THREE.Group();
    model.name = name;
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

function unit(id: number, type: string, faction: UnitSnapshot["faction"] = "hussites"): UnitSnapshot {
  return {
    id, col: id, row: 0, type, name: type, faction, unitClass: "infantry",
    health: 100, maxHealth: 100, morale: 100, maxMorale: 100, hasMoved: false, hasAttacked: false,
    isDefending: false, isRouting: false, formationClosed: false, marching: false,
  };
}

function snapshotWithUnits(units: UnitSnapshot[]): BattleSnapshot {
  return { ...snapshot(), units };
}

function taggedModel(materials: { cloth: THREE.MeshStandardMaterial; paint: THREE.MeshStandardMaterial; neutral: THREE.MeshStandardMaterial }): THREE.Group {
  const model = new THREE.Group();
  for (const material of [materials.cloth, materials.paint, materials.neutral]) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1, 0.2), material);
    mesh.position.y = 0.8;
    model.add(mesh);
  }
  return model;
}

function materialsIn(object: THREE.Object3D): THREE.Material[] {
  const materials: THREE.Material[] = [];
  object.traverse(child => {
    if (!(child as THREE.Mesh).isMesh) return;
    const mesh = child as THREE.Mesh;
    materials.push(...(Array.isArray(mesh.material) ? mesh.material : [mesh.material]));
  });
  return materials;
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

test("maps the first dedicated infantry batch and keeps five-figure formations", async () => {
  const assets = new TestAssets();
  const units = new UnitPresentation({ group: new THREE.Group(), interactiveMeshes: [], heightAt: () => 0 },
    new HexLayout(8, 2), assets);
  const types = [
    "CEPNICI", "CEPNICI_PRASKY", "KUSINICI_HUSITI", "KUSNICI", "KUSNICI_JANOV", "KUSINICI_PRASKY",
    "PAVEZNICI", "PAVEZNICI_KRIZACI",
  ];
  await units.update(snapshotWithUnits(types.map((type, index) => unit(index + 1, type))));
  assert.deepEqual(assets.loaded, ["infantry_flail", "infantry_crossbow", "infantry_pavise"]);
  assert.equal(units.group.children.length, types.length);
  for (const formation of units.group.children) {
    assert.equal(formation.children.filter(child => child instanceof THREE.Group).length, 5);
  }
});

test("maps artillery to one gun and two independently placed crew", async () => {
  const assets = new TestAssets();
  const units = new UnitPresentation({ group: new THREE.Group(), interactiveMeshes: [], heightAt: () => 0 },
    new HexLayout(6, 1), assets);
  const artillery = ["HOUFNICE", "HOUFNICE_PRASKY", "TARASNICE", "POLNI_DELO", "BOMBARDA"];
  await units.update(snapshotWithUnits(artillery.map((type, index) => unit(index + 1, type))));

  assert.deepEqual(new Set(assets.loaded), new Set(["artillery_houfnice", "artillery_tarasnice", "artillery_bombard", "artillery_gunner"]));
  for (const formation of units.group.children) {
    const pieces = formation.children.filter(child => child instanceof THREE.Group);
    assert.equal(pieces.length, 3);
    assert.equal(pieces.filter(piece => piece.name === "artillery_gunner").length, 2);
    assert.equal(pieces.filter(piece => piece.name.startsWith("artillery_") && piece.name !== "artillery_gunner").length, 1);
  }
});

test("maps both spearman definitions and archers without changing polearm infantry", async () => {
  const assets = new TestAssets();
  const units = new UnitPresentation({ group: new THREE.Group(), interactiveMeshes: [], heightAt: () => 0 },
    new HexLayout(6, 1), assets);
  await units.update(snapshotWithUnits([
    unit(1, "KOPINICI_HUSITI", "hussites"), unit(2, "KOPINICI", "crusaders"),
    unit(3, "LUCISTNICI", "crusaders"), unit(4, "SUDLICNICI", "hussites"), unit(5, "HALAPARTNICI", "crusaders"),
  ]));
  const expected = ["infantry_spear", "infantry_spear", "infantry_archer", "infantry_polearm", "infantry_polearm"];
  for (const [index, formation] of units.group.children.entries()) {
    const figures = formation.children.filter(child => child instanceof THREE.Group);
    assert.equal(figures.length, 5);
    assert.ok(figures.every(figure => figure.name === expected[index]));
  }
});

test("artillery gun and crew figures each follow rotated routing terrain", async () => {
  const height = (x: number, z: number): number => 0.16 * x + 0.09 * z;
  const units = new UnitPresentation({ group: new THREE.Group(), interactiveMeshes: [],
    heightAt: () => 50, renderedHeightAt: height }, new HexLayout(4, 2), new TestAssets());
  const artillery = unit(1, "TARASNICE", "crusaders");
  artillery.marching = true;
  artillery.isRouting = true;
  await units.update(snapshotWithUnits([artillery]));
  const formation = units.group.children[0]!;
  const pieces = formation.children.filter(child => child instanceof THREE.Group);
  assert.equal(pieces.length, 3);
  for (const piece of pieces) {
    const position = piece.getWorldPosition(new THREE.Vector3());
    const bottom = new THREE.Box3().setFromObject(piece).min.y;
    assert.ok(Math.abs(bottom - height(position.x, position.z)) < 1e-6,
      `feet ${bottom}, terrain ${height(position.x, position.z)}`);
  }
});

test("recolours tagged team materials per faction without changing prototypes or neutral materials", async () => {
  const cloth = new THREE.MeshStandardMaterial({ name: "team_cloth", color: 0x123456 });
  const paint = new THREE.MeshStandardMaterial({ name: "team_paint", color: 0x654321 });
  const neutral = new THREE.MeshStandardMaterial({ name: "leather", color: 0xaabbcc });
  const assets = new TestAssets({ infantry_flail: taggedModel({ cloth, paint, neutral }) });
  const units = new UnitPresentation({ group: new THREE.Group(), interactiveMeshes: [], heightAt: () => 0 },
    new HexLayout(4, 1), assets);
  await units.update(snapshotWithUnits([
    unit(1, "CEPNICI", "hussites"), unit(2, "CEPNICI", "hussites"), unit(3, "CEPNICI_PRASKY", "crusaders"),
  ]));

  const hussiteMaterials = materialsIn(units.group.children[0]!);
  const secondHussiteMaterials = materialsIn(units.group.children[1]!);
  const crusaderMaterials = materialsIn(units.group.children[2]!);
  const hussiteCloth = hussiteMaterials.find(material => material.name === "team_cloth")! as THREE.MeshStandardMaterial;
  const hussitePaint = hussiteMaterials.find(material => material.name === "team_paint")! as THREE.MeshStandardMaterial;
  const crusaderCloth = crusaderMaterials.find(material => material.name === "team_cloth")! as THREE.MeshStandardMaterial;
  const crusaderPaint = crusaderMaterials.find(material => material.name === "team_paint")! as THREE.MeshStandardMaterial;

  assert.equal(hussiteCloth.color.getHex(), 0x9b4f4f);
  assert.equal(hussitePaint.color.getHex(), 0x7f3f3b);
  assert.equal(crusaderCloth.color.getHex(), 0x587493);
  assert.equal(crusaderPaint.color.getHex(), 0x3f5872);
  assert.equal(new Set(hussiteMaterials.filter(material => material.name === "team_cloth")).size, 1);
  assert.equal(hussiteCloth, secondHussiteMaterials.find(material => material.name === "team_cloth"));
  assert.notEqual(hussiteCloth, crusaderCloth);
  assert.equal(cloth.color.getHex(), 0x123456);
  assert.equal(paint.color.getHex(), 0x654321);
  assert.equal(neutral.color.getHex(), 0xaabbcc);
  assert.equal(hussiteMaterials.find(material => material.name === "leather"), neutral);
});

test("artillery gunners use the faction palette on both sides", async () => {
  const cloth = new THREE.MeshStandardMaterial({ name: "team_cloth", color: 0x123456 });
  const gunner = new THREE.Group();
  gunner.name = "artillery_gunner";
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1, 0.2), cloth);
  mesh.position.y = 0.8;
  gunner.add(mesh);
  const assets = new TestAssets({ artillery_gunner: gunner });
  const units = new UnitPresentation({ group: new THREE.Group(), interactiveMeshes: [], heightAt: () => 0 },
    new HexLayout(4, 1), assets);
  await units.update(snapshotWithUnits([
    unit(1, "HOUFNICE", "hussites"), unit(2, "HOUFNICE_PRASKY", "crusaders"),
  ]));

  const hussiteGunner = units.group.children[0]!.children.find(child => child.name === "artillery_gunner")!;
  const crusaderGunner = units.group.children[1]!.children.find(child => child.name === "artillery_gunner")!;
  const hussiteCloth = materialsIn(hussiteGunner).find(material => material.name === "team_cloth")! as THREE.MeshStandardMaterial;
  const crusaderCloth = materialsIn(crusaderGunner).find(material => material.name === "team_cloth")! as THREE.MeshStandardMaterial;
  assert.equal(hussiteCloth.color.getHex(), 0x9b4f4f);
  assert.equal(crusaderCloth.color.getHex(), 0x587493);
  assert.notEqual(hussiteCloth, crusaderCloth);
  assert.equal(cloth.color.getHex(), 0x123456);
});

test("disposes presenter-owned faction material variants", async () => {
  const cloth = new THREE.MeshStandardMaterial({ name: "team_cloth", color: 0x123456 });
  const paint = new THREE.MeshStandardMaterial({ name: "team_paint", color: 0x654321 });
  const neutral = new THREE.MeshStandardMaterial({ name: "leather", color: 0xaabbcc });
  const assets = new TestAssets({ infantry_flail: taggedModel({ cloth, paint, neutral }) });
  const units = new UnitPresentation({ group: new THREE.Group(), interactiveMeshes: [], heightAt: () => 0 },
    new HexLayout(2, 1), assets);
  await units.update(snapshotWithUnits([unit(1, "CEPNICI")]));
  const owned = [...new Set(materialsIn(units.group.children[0]!).filter(material => material.name.startsWith("team_")))];
  let disposed = 0;
  for (const material of owned) {
    const originalDispose = material.dispose.bind(material);
    material.dispose = () => { disposed += 1; originalDispose(); };
  }
  let neutralDisposed = false;
  neutral.dispose = () => { neutralDisposed = true; };
  units.dispose();
  assert.equal(disposed, 2);
  assert.equal(neutralDisposed, false);
});
