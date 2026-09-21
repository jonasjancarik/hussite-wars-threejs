import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { UnitPresentation } from "../src/units.ts";
import { HexLayout } from "../src/hex-coordinates.ts";
import type { BattleSnapshot, UnitSnapshot } from "../src/types.ts";

const root = new URL("../../../", import.meta.url);
const assetRoot = new URL("assets/3d/", root);
const paths = JSON.parse(readFileSync(new URL("model-paths.json", assetRoot), "utf8")) as Record<string, string>;

function files(directory: URL, prefix = ""): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const name = `${prefix}${entry.name}`;
    return entry.isDirectory() ? files(new URL(`${entry.name}/`, directory), `${name}/`) : [name];
  });
}

test("every shared model is catalogued once and points to an actual GLB", () => {
  const catalogued = Object.values(paths).sort();
  const actual = files(new URL("models/", assetRoot), "models/").filter(name => name.endsWith(".glb")).sort();
  assert.deepEqual(catalogued, actual);
  assert.equal(new Set(catalogued).size, catalogued.length);
  for (const path of catalogued) {
    assert.match(path, /^models\/(units|buildings|props|vegetation)\//);
    assert.ok(!path.split("/").includes(".."));
    const bytes = readFileSync(new URL(path, assetRoot));
    assert.equal(bytes.toString("ascii", 0, 4), "glTF", path);
    assert.equal(bytes.readUInt32LE(8), bytes.length, path);
  }
});

test("kit metadata and authored placements resolve through the shared catalog", () => {
  const manifest = JSON.parse(readFileSync(new URL("models/manifest.json", assetRoot), "utf8"));
  for (const [name, entry] of Object.entries(manifest) as Array<[string, { file: string }]>) {
    assert.equal(paths[name], `models/${entry.file}`, name);
  }
  const landscape = JSON.parse(readFileSync(new URL("scenarios/sudomer-landscape.json", assetRoot), "utf8"));
  for (const landmark of landscape.landmarks) assert.ok(paths[landmark.kind], landmark.kind);
});

test("campaign loads both supported views without experiment dependencies", () => {
  const html = readFileSync(new URL("index.html", root), "utf8");
  assert.match(html, /src="views\/2d\/WoodcutRenderer\.js/);
  assert.match(html, /src="views\/3d\/ThreeBattleMapView\.js/);
  const adapter = readFileSync(new URL("views/3d/ThreeBattleMapView.js", root), "utf8");
  assert.ok(!adapter.includes("experiments/"));
  for (const key of ["assetBase", "artManifestBase"]) {
    const relative = adapter.match(new RegExp(`${key}: '([^']+)'`))![1]!;
    assert.ok(readdirSync(new URL(relative, root)).length > 0, relative);
  }
});

test("new infantry GLBs load as grounded static miniatures with isolated colour slots", async () => {
  for (const name of ["infantry_flail", "infantry_crossbow", "infantry_pavise"]) {
    const bytes = readFileSync(new URL(paths[name]!, assetRoot));
    const { scene, animations } = await new GLTFLoader().parseAsync(new Uint8Array(bytes).buffer, "");
    const bounds = new THREE.Box3().setFromObject(scene);
    const size = bounds.getSize(new THREE.Vector3());
    assert.ok(Math.abs(bounds.min.y) < 0.005, `${name}: exported feet must meet ground`);
    assert.ok(size.y >= 1.75 && size.y <= 2.6, `${name}: miniature scale including raised weapons`);
    assert.ok(size.x < 1.5 && size.z < 1.5, `${name}: footprint must fit a formation`);
    assert.equal(animations.length, 0, `${name}: this batch is static`);
    const materials = new Set<string>();
    let triangles = 0;
    scene.traverse(object => {
      assert.ok(!(object instanceof THREE.SkinnedMesh));
      if (!(object instanceof THREE.Mesh)) return;
      triangles += (object.geometry.index?.count ?? object.geometry.attributes.position!.count) / 3;
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        materials.add(material.name);
      }
    });
    assert.ok(triangles > 0 && triangles <= 2500, `${name}: keep the low-poly figure budget`);
    assert.ok(materials.has("team_cloth"));
    assert.ok(materials.has("skin") && materials.has("leather") && materials.has("steel"));
    if (name === "infantry_pavise") assert.ok(materials.has("team_paint") && materials.has("oak"));
  }
});

test("artillery exports have open muzzles, static geometry and ground-level supports", async () => {
  for (const [name, height, slope, rearLimit] of [
    ["artillery_houfnice", .97, .055, -.3],
    ["artillery_tarasnice", .70, .023, -.4],
    ["artillery_bombard", .87, .075, -.4],
  ] as const) {
    const bytes = readFileSync(new URL(paths[name]!, assetRoot));
    const { scene, animations } = await new GLTFLoader().parseAsync(new Uint8Array(bytes).buffer, "");
    const bounds = new THREE.Box3().setFromObject(scene);
    const size = bounds.getSize(new THREE.Vector3());
    assert.ok(Math.abs(bounds.min.y) < 0.005, `${name}: supports must meet ground`);
    assert.ok(size.x < 3.3 && size.z < 1.8 && size.y < 1.6, `${name}: gun must fit its cell`);
    assert.equal(animations.length, 0);
    const ray = new THREE.Raycaster(new THREE.Vector3(5, height + slope * 5, 0),
      new THREE.Vector3(-1, -slope, 0).normalize());
    const hit = ray.intersectObject(scene, true)[0];
    assert.ok(hit && hit.point.x < rearLimit, `${name}: a muzzle cap blocks the recessed bore`);
  }
});

test("actual gun and crew assemblies fit the existing picking footprint on either side", async () => {
  const prototypes = new Map<string, THREE.Group>();
  for (const name of ["artillery_houfnice", "artillery_tarasnice", "artillery_bombard", "artillery_gunner"]) {
    const bytes = readFileSync(new URL(paths[name]!, assetRoot));
    const model = await new GLTFLoader().parseAsync(new Uint8Array(bytes).buffer, "");
    assert.equal(model.animations.length, 0);
    prototypes.set(name, model.scene);
  }
  const assets = {
    async load(name: string) { return prototypes.get(name)!; },
    async clone(name: string) { return prototypes.get(name)!.clone(true); },
  };
  for (const faction of ["hussites", "crusaders"] as const) {
    const units = new UnitPresentation({ group: new THREE.Group(), interactiveMeshes: [], heightAt: () => 0 },
      new HexLayout(1, 1), assets);
    for (const type of ["HOUFNICE", "TARASNICE", "BOMBARDA"]) {
      const unit: UnitSnapshot = { id: 1, type, name: type, col: 0, row: 0, faction, unitClass: "artillery",
        health: 100, maxHealth: 100, morale: 100, maxMorale: 100, hasMoved: false, hasAttacked: false,
        isDefending: false, isRouting: false, formationClosed: false, marching: false };
      const snapshot: BattleSnapshot = { protocolVersion: 2, generation: 1, revision: 1, scenario: "artillery-test",
        round: 1, faction, state: "playing", busy: false, paused: false, aiRunning: false,
        tiles: [], units: [unit], selectedUnitId: null, legalMoves: [], legalAttacks: [], marchTargets: [],
        visibleHexes: [], exploredHexes: [], events: [] };
      await units.update({ ...snapshot, units: [] });
      await units.update(snapshot);
      const formation = units.group.children[0]!;
      const center = formation.position;
      for (const piece of formation.children.filter(object => object instanceof THREE.Group)) {
        assert.ok(Math.abs(new THREE.Box3().setFromObject(piece).min.y) < 0.005);
        piece.traverse(object => {
          if (!(object instanceof THREE.Mesh)) return;
          const positions = object.geometry.attributes.position!;
          for (let index = 0; index < positions.count; index += 1) {
            const point = new THREE.Vector3().fromBufferAttribute(positions, index).applyMatrix4(object.matrixWorld);
            assert.ok(Math.hypot(point.x - center.x, point.z - center.z) < 2.15,
              `${type}/${faction}: visible geometry extends outside its selectable footprint`);
          }
        });
      }
    }
    units.dispose();
  }
});
