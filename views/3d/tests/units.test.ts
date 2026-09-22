import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import * as THREE from "three";
import { HexLayout } from "../src/hex-coordinates.ts";
import { unitRecipe } from "../src/unit-recipes.ts";
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

function facingOf(formation: THREE.Object3D): THREE.Vector3 {
  const figure = formation.children.find(child => child instanceof THREE.Group)!;
  return new THREE.Vector3(1, 0, 0).applyQuaternion(figure.getWorldQuaternion(new THREE.Quaternion()));
}

function formationFor(units: UnitPresentation, id: number): THREE.Object3D {
  return units.group.children.find(child => child.name.endsWith(`(${id})`))!;
}

async function settleFacing(units: UnitPresentation): Promise<void> {
  for (let step = 0; step < 24; step += 1) units.advance(64);
}

test("formations turn toward movement, attacks and visible threats without changing the snapshot", async () => {
  const units = new UnitPresentation({ group: new THREE.Group(), interactiveMeshes: [], heightAt: () => 0 },
    new HexLayout(4, 3), new TestAssets());
  const hussite = unit(1, "KOPINICI_HUSITI", "hussites"); hussite.col = 0; hussite.row = 0;
  const crusader = unit(2, "KOPINICI", "crusaders"); crusader.col = 1; crusader.row = 0;
  const threatened = snapshotWithUnits([hussite, crusader]);
  const before = JSON.stringify(threatened);
  await units.update(threatened);
  await settleFacing(units);
  const idleFacing = facingOf(formationFor(units, hussite.id));
  assert.ok(idleFacing.x > 0.8, `idle unit faces its visible enemy: ${idleFacing.toArray()}`);
  assert.equal(JSON.stringify(threatened), before, "facing is presentation-only");

  const moving = snapshotWithUnits([{ ...hussite, col: 1, row: 0 }, { ...crusader, col: 1, row: 2 }]);
  moving.movement = { unitId: hussite.id, from: { col: 0, row: 0 }, to: { col: 1, row: 0 }, progress: 0.5 };
  await units.update(moving);
  await settleFacing(units);
  assert.ok(facingOf(formationFor(units, hussite.id)).x > 0.8, "moving unit faces along its route");

  const attacking = snapshotWithUnits([{ ...hussite, col: 0, row: 0 }, { ...crusader, col: 0, row: 2 }]);
  attacking.events = [{ id: "attack-east", type: "attack", col: 1, row: 0, fromCol: 0, fromRow: 0 }];
  await units.update(attacking);
  await settleFacing(units);
  assert.ok(facingOf(formationFor(units, hussite.id)).x > 0.8, "attack direction temporarily overrides idle threat facing");
});

test("routing formations turn away from the nearest visible enemy", async () => {
  const units = new UnitPresentation({ group: new THREE.Group(), interactiveMeshes: [], heightAt: () => 0 },
    new HexLayout(4, 2), new TestAssets());
  const routing = { ...unit(1, "KOPINICI_HUSITI", "hussites"), col: 1, row: 0, isRouting: true };
  const enemy = { ...unit(2, "KOPINICI", "crusaders"), col: 2, row: 0 };
  await units.update(snapshotWithUnits([routing, enemy]));
  await settleFacing(units);
  const routingFacing = facingOf(formationFor(units, routing.id));
  assert.ok(routingFacing.x < -0.8, routingFacing.toArray().join(","));
});

test("adjacent idle troops share a local threat direction", async () => {
  const units = new UnitPresentation({ group: new THREE.Group(), interactiveMeshes: [], heightAt: () => 0 },
    new HexLayout(5, 3), new TestAssets());
  const first = { ...unit(1, "KOPINICI_HUSITI", "hussites"), col: 0, row: 1 };
  const second = { ...unit(2, "CEPNICI", "hussites"), col: 1, row: 1 };
  const enemy = { ...unit(3, "KOPINICI", "crusaders"), col: 4, row: 1 };
  await units.update(snapshotWithUnits([first, second, enemy]));
  await settleFacing(units);
  assert.ok(facingOf(formationFor(units, first.id)).dot(facingOf(formationFor(units, second.id))) > 0.999);
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

test("maps the cavalry batch to two-mount formations", async () => {
  const assets = new TestAssets();
  const units = new UnitPresentation({ group: new THREE.Group(), interactiveMeshes: [], heightAt: () => 0 },
    new HexLayout(8, 1), assets);
  const cavalry = [
    "JIZDA_HUSITI", "LEHKA_JIZDA", "JIZDA_PRASKY", "ZVED", "ZVED_KRIZACI",
    "SLECHTICKA_JIZDA_HUSITI", "TEZKY_RYTIR", "TEZKOODENCI",
  ];
  await units.update(snapshotWithUnits(cavalry.map((type, index) => unit(index + 1, type))));

  assert.deepEqual(new Set(assets.loaded), new Set(["cavalry_light", "cavalry_scout", "cavalry_heavy"]));
  for (const formation of units.group.children) {
    assert.equal(formation.children.filter(child => child instanceof THREE.Group).length, 2);
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
  const expected = ["infantry_spear", "infantry_spear", "infantry_archer", "infantry_polearm", "infantry_halberd"];
  for (const [index, formation] of units.group.children.entries()) {
    const figures = formation.children.filter(child => child instanceof THREE.Group);
    assert.equal(figures.length, 5);
    assert.ok(figures.every(figure => figure.name === expected[index]));
  }
});

test("maps every current game roster definition to an explicit, meaningful recipe", () => {
  const source = readFileSync(new URL("../../../js/data/unitTypes.js", import.meta.url), "utf8");
  const roster = Object.keys(runInNewContext(`${source}; UnitTypes`) as Record<string, unknown>);
  const expectedPrimaryModels: Record<string, string> = {
    CEPNICI: "infantry_flail", SUDLICNICI: "infantry_polearm", PAVEZNICI: "infantry_pavise", KOPINICI_HUSITI: "infantry_spear",
    KUSINICI_HUSITI: "infantry_crossbow", RUCNICARI: "infantry_handgun", HOUFNICE: "artillery_houfnice", TARASNICE: "artillery_tarasnice",
    POLNI_OPEVNENI: "field_blockhouse", VOZOVA_HRADBA: "war_wagon", JIZDA_HUSITI: "cavalry_light", SLECHTICKA_JIZDA_HUSITI: "cavalry_heavy",
    POUTNICI: "civilian_adult", ZVED: "cavalry_scout", TEZKY_RYTIR: "cavalry_heavy", TEZKOODENCI: "cavalry_heavy",
    LEHKA_JIZDA: "cavalry_light", ZVED_KRIZACI: "cavalry_scout", KOPINICI: "infantry_spear", HALAPARTNICI: "infantry_halberd",
    PAVEZNICI_KRIZACI: "infantry_pavise", KUSNICI_JANOV: "infantry_crossbow", KUSNICI: "infantry_crossbow", LUCISTNICI: "infantry_archer",
    BOMBARDA: "artillery_bombard", POLNI_DELO: "artillery_tarasnice", ZOLDNERI: "infantry_shield",
    JAN_ZIZKA: "commander_captain", PROKOP_HOLY: "commander_cleric", JAN_ZELIVSKY: "commander_cleric", VACLAV_KORANDA: "commander_cleric",
    ZATECKY_HEJTMAN: "commander_captain", JAN_ROHAC: "commander_noble", FRIDRICH_MISNENSKY: "commander_noble", BOHUSLAV_SVAMBERK: "commander_noble",
    ZIKMUND: "commander_noble", FILIPPO_SCOLARI: "commander_noble", HEINRICH_ISENBURG: "commander_noble", ERKINGER_SEINSHEIM: "commander_noble",
    FRIDRICH_SASKY: "commander_noble", BOSO_VITZTHUM: "commander_noble", PETR_STERNBERK: "commander_noble", VILEM_SVIHOVSKY: "commander_noble",
    BRENEK_SVIHOVSKY: "commander_noble", HYNEK_NEKMIRE: "commander_noble", HYNEK_KRUSINA: "commander_noble", JINDRICH_PLUMOV: "commander_noble",
    DIVIS_BOREK: "commander_noble", CENEK_VARTENBERK: "commander_noble", ARNOST_FLASKA: "commander_noble", JINDRICH_BERKA: "commander_noble",
    JAN_HVEZDA: "commander_captain", HYNEK_PODEBRADY: "commander_noble", VIKTORIN_BOCEK: "commander_noble", VOZOVA_HRADBA_PRASKY: "war_wagon",
    CEPNICI_PRASKY: "infantry_flail", KUSINICI_PRASKY: "infantry_crossbow", HOUFNICE_PRASKY: "artillery_houfnice", JIZDA_PRASKY: "cavalry_light",
  };
  assert.equal(roster.length, 59);
  assert.deepEqual(new Set(Object.keys(expectedPrimaryModels)), new Set(roster));
  for (const type of roster) {
    const recipe = unitRecipe(unit(1, type));
    assert.ok(recipe.length > 0, `${type} has no figures`);
    assert.equal(recipe[0]!.model, expectedPrimaryModels[type], type);
  }
  assert.deepEqual(unitRecipe(unit(1, "POUTNICI")).flatMap(recipe => recipe.offsets).length, 5);
});

test("uses recipe-specific pick radii for fieldworks and both wagon variants", async () => {
  const assets = new TestAssets();
  const units = new UnitPresentation({ group: new THREE.Group(), interactiveMeshes: [], heightAt: () => 0 },
    new HexLayout(5, 1), assets);
  await units.update(snapshotWithUnits([
    unit(1, "CEPNICI"), unit(2, "POLNI_OPEVNENI"), unit(3, "VOZOVA_HRADBA"), unit(4, "VOZOVA_HRADBA_PRASKY", "crusaders"),
  ]));
  const radii = units.hitTargets.map(hit => (hit as THREE.Mesh<THREE.CylinderGeometry>).geometry.parameters.radiusTop);
  assert.deepEqual(radii, [2.25, 2.35, 3.4, 3.4]);
  assert.equal(unitRecipe(unit(1, "VOZOVA_HRADBA"))[0]!.scale, 1.05);
  assert.equal(unitRecipe(unit(1, "VOZOVA_HRADBA_PRASKY"))[0]!.scale, 1.05);
});

test("poutníci use five civilian figures that deplete with health", async () => {
  const assets = new TestAssets();
  const pilgrims = unit(1, "POUTNICI");
  pilgrims.health = 40;
  pilgrims.maxHealth = 100;
  const units = new UnitPresentation({ group: new THREE.Group(), interactiveMeshes: [], heightAt: () => 0 },
    new HexLayout(3, 1), assets);
  await units.update(snapshotWithUnits([pilgrims]));
  const figures = units.group.children[0]!.children.filter(child => child instanceof THREE.Group);
  assert.equal(figures.length, 5);
  assert.equal(figures.filter(figure => figure.visible).length, 2);
  assert.deepEqual(new Set(assets.loaded), new Set(["civilian_adult", "civilian_woman", "civilian_child"]));
});

test("rebuilds a same-ID cavalry visual after explicit dismount", async () => {
  const assets = new TestAssets();
  const units = new UnitPresentation({ group: new THREE.Group(), interactiveMeshes: [], heightAt: () => 0 },
    new HexLayout(3, 1), assets);
  const cavalry = unit(1, "TEZKY_RYTIR", "crusaders");
  await units.update(snapshotWithUnits([cavalry]));
  assert.equal(units.group.children[0]!.children.filter(child => child instanceof THREE.Group).length, 2);
  await units.update(snapshotWithUnits([{ ...cavalry, dismounted: true }]));
  const figures = units.group.children[0]!.children.filter(child => child instanceof THREE.Group);
  assert.equal(figures.length, 5);
  assert.ok(figures.every(figure => figure.name === "infantry_dismounted"));
  assert.deepEqual(new Set(assets.loaded), new Set(["cavalry_heavy", "infantry_dismounted"]));
  assert.equal(units.casualties.group.children.length, 0, "changing appearance is not a casualty");
  await units.update(snapshotWithUnits([cavalry]));
  assert.equal(units.group.children[0]!.children.filter(child => child instanceof THREE.Group).length, 2);
  assert.equal(units.hitTargets.length, 1);
  assert.equal(units.casualties.group.children.length, 0);
});

test("commanders own cloned standards while sharing each faction's material variant", async () => {
  const cloth = new THREE.MeshStandardMaterial({ name: "team_cloth", color: 0x123456 });
  const standard = taggedModel({ cloth, paint: cloth, neutral: cloth });
  standard.name = "commander_standard";
  const assets = new TestAssets({ commander_captain: new THREE.Group(), commander_standard: standard });
  const units = new UnitPresentation({ group: new THREE.Group(), interactiveMeshes: [], heightAt: () => 0 },
    new HexLayout(5, 1), assets);
  const hussite = { ...unit(1, "JAN_ZIZKA", "hussites"), unitClass: "commander", special: "commander" };
  const secondHussite = { ...unit(2, "ZATECKY_HEJTMAN", "hussites"), unitClass: "commander", special: "commander" };
  const crusader = { ...unit(3, "JAN_ZIZKA", "crusaders"), unitClass: "commander", special: "commander" };
  await units.update(snapshotWithUnits([hussite, secondHussite, crusader]));
  const standards = units.group.children.map(formation => formation.children.find(child => child.name === "commander_standard")!);
  assert.equal(new Set(standards).size, 3);
  assert.ok(standards.every((banner, index) => banner.parent === units.group.children[index]));
  const material = (banner: THREE.Object3D) => materialsIn(banner).find(item => item.name === "team_cloth")! as THREE.MeshStandardMaterial;
  const hussiteCloth = material(standards[0]!);
  assert.equal(hussiteCloth, material(standards[1]!));
  assert.notEqual(hussiteCloth, material(standards[2]!));
  assert.deepEqual(standards.map(banner => material(banner).color.getHex()), [0x9b4f4f, 0x9b4f4f, 0x587493]);
  const variants = (units as unknown as { variants: Map<string, Promise<THREE.Group>> }).variants;
  const cachedHussiteStandard = await variants.get("commander_standard:hussites")!;
  assert.equal(cachedHussiteStandard.parent, null);
  assert.deepEqual(cachedHussiteStandard.position.toArray(), [0, 0, 0]);
  assert.deepEqual(cachedHussiteStandard.scale.toArray(), [1, 1, 1]);
  assert.equal(cloth.color.getHex(), 0x123456);
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
