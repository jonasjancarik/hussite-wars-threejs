import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { SETTLEMENT_MODELS } from "../src/settlement-models.ts";

const root = new URL("../../../", import.meta.url);
const assetRoot = new URL("assets/3d/models/", root);
const manifest = JSON.parse(readFileSync(new URL("manifest.json", assetRoot), "utf8")) as Record<string, {
  file: string;
  dimensions_gltf_xyz_m: [number, number, number];
  forward_axis: string;
}>;

test("settlement placement dimensions match manifest and exported GLB bounds", async () => {
  const expectedNames = [
    "house_timber", "house_plaster", "townhouse", "barn", "shed", "well", "church",
    "church_gothic", "fence_gate", "haystack", "timber_pile",
  ];
  assert.deepEqual(Object.keys(SETTLEMENT_MODELS).sort(), expectedNames.sort());

  for (const [name, model] of Object.entries(SETTLEMENT_MODELS)) {
    const entry = manifest[name]!;
    assert.ok(entry, `${name}: missing from the model manifest`);
    assert.ok(Math.abs(model.width - entry.dimensions_gltf_xyz_m[0]) <= 0.001, `${name}: width differs from manifest`);
    assert.ok(Math.abs(model.depth - entry.dimensions_gltf_xyz_m[2]) <= 0.001, `${name}: depth differs from manifest`);

    const bytes = readFileSync(new URL(entry.file, assetRoot));
    const gltf = await new GLTFLoader().parseAsync(new Uint8Array(bytes).buffer, "");
    gltf.scene.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(gltf.scene);
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    assert.ok(Math.abs(size.x - model.width) <= 0.003, `${name}: GLB X extent differs from metadata`);
    assert.ok(Math.abs(size.z - model.depth) <= 0.003, `${name}: GLB Z extent differs from metadata`);
    assert.ok(Math.abs(size.y - entry.dimensions_gltf_xyz_m[1]) <= 0.003, `${name}: GLB height differs from manifest`);
    assert.ok(Math.abs(center.x - (model.centerX ?? 0)) <= 0.003, `${name}: GLB X center differs from metadata`);
    assert.ok(Math.abs(center.z - (model.centerZ ?? 0)) <= 0.003, `${name}: GLB Z center differs from metadata`);

    const frontAngle = entry.forward_axis === "+Z" ? 0 : entry.forward_axis === "+X" ? Math.PI / 2 : NaN;
    assert.ok(Number.isFinite(frontAngle), `${name}: unsupported forward axis ${entry.forward_axis}`);
    assert.equal(model.frontAngle, frontAngle, `${name}: front angle does not match documented model axis`);
  }
});

test("settlement front angles follow the authored glTF axis conventions", () => {
  const settlementDocs = readFileSync(new URL("tools/art/blender/settlement-references.md", root), "utf8");
  const campDocs = readFileSync(new URL("tools/art/blender/camp-references.md", root), "utf8");
  const kitDocs = readFileSync(new URL("tools/art/blender/README.md", root), "utf8");
  assert.match(settlementDocs, /Fronts face Blender -Y, exported as glTF \+Z/);
  assert.match(campDocs, /Blender -Y is the presentation front, which exports as glTF \+Z/);
  assert.match(kitDocs, /original kit and units face \+X where facing matters/);
  assert.equal(SETTLEMENT_MODELS.church!.frontAngle, Math.PI / 2);
  for (const name of ["house_timber", "house_plaster", "townhouse", "barn", "shed", "well", "church_gothic", "fence_gate", "haystack", "timber_pile"]) {
    assert.equal(SETTLEMENT_MODELS[name]!.frontAngle, 0, name);
  }
});
