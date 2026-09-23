import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { createMergedModelMaterials, MODEL_MIN_ROUGHNESS, MODEL_PBR, mergeModel, recolorTeamSlots, TEAM_SLOT_KEY } from "../src/model-merge.ts";

const root = new URL("../../../", import.meta.url);
const paths = JSON.parse(readFileSync(new URL("assets/3d/model-paths.json", root), "utf8")) as Record<string, string>;

async function load(name: string): Promise<THREE.Group> {
  const bytes = readFileSync(new URL(`assets/3d/${paths[name]}`, root));
  const { scene } = await new GLTFLoader().parseAsync(new Uint8Array(bytes).buffer, "");
  scene.name = name;
  return scene;
}

function triangles(object: THREE.Object3D): number {
  let count = 0;
  object.traverse(child => {
    if (!(child instanceof THREE.Mesh)) return;
    const geometry = child.geometry as THREE.BufferGeometry;
    count += (geometry.index?.count ?? geometry.getAttribute("position").count) / 3;
  });
  return count;
}

function meshes(object: THREE.Object3D): THREE.Mesh[] {
  const result: THREE.Mesh[] = [];
  object.traverse(child => { if (child instanceof THREE.Mesh) result.push(child); });
  return result;
}

test("every catalogued model merges into a few meshes with the same shape", async () => {
  const materials = createMergedModelMaterials();
  let before = 0, after = 0;
  for (const name of Object.keys(paths)) {
    const source = await load(name);
    const merged = mergeModel(source, materials);
    assert.notEqual(merged, source, `${name} could not be merged`);
    assert.equal(triangles(merged), triangles(source), name);
    const a = new THREE.Box3().setFromObject(source, true), b = new THREE.Box3().setFromObject(merged, true);
    assert.ok(a.min.distanceTo(b.min) < 1e-4 && a.max.distanceTo(b.max) < 1e-4, `${name} bounds moved`);
    before += meshes(source).length; after += meshes(merged).length;
    for (const mesh of meshes(merged)) {
      assert.ok(materials.owns(mesh.material as THREE.Material), name);
      assert.ok(mesh.castShadow && mesh.receiveShadow, name);
      const pbr = mesh.geometry.getAttribute(MODEL_PBR) as THREE.BufferAttribute;
      for (let vertex = 0; vertex < pbr.count; vertex += 1) assert.ok(pbr.getX(vertex) >= MODEL_MIN_ROUGHNESS - 1e-6, name);
    }
  }
  assert.ok(after * 4 < before, `${before} meshes became ${after}`);
  materials.dispose();
});

test("merged soldiers keep their colours and take faction colours on their team parts", async () => {
  const materials = createMergedModelMaterials();
  const source = await load("infantry_polearm");
  const colours = new Set<string>();
  source.traverse(child => {
    if (child instanceof THREE.Mesh) colours.add((child.material as THREE.MeshStandardMaterial).color.getHexString());
  });
  const merged = mergeModel(source, materials);
  const mesh = meshes(merged).find(candidate => candidate.geometry.userData[TEAM_SLOT_KEY])!;
  assert.ok(mesh, "team slots were kept");
  const seen = new Set<string>();
  const colour = mesh.geometry.getAttribute("color") as THREE.BufferAttribute;
  for (let vertex = 0; vertex < colour.count; vertex += 1) {
    seen.add(new THREE.Color(colour.getX(vertex), colour.getY(vertex), colour.getZ(vertex)).getHexString());
  }
  for (const hex of seen) assert.ok(colours.has(hex), `${hex} is not one of the model's colours`);
  const red = new THREE.Color(0x9b4f4f);
  const recolored = recolorTeamSlots(mesh.geometry, { 1: red, 2: red })!;
  const slots = mesh.geometry.userData[TEAM_SLOT_KEY] as Uint8Array;
  const recoloredColours = recolored.getAttribute("color") as THREE.BufferAttribute;
  const vertex = slots.findIndex(slot => slot !== 0);
  assert.ok(vertex >= 0);
  assert.ok(Math.abs(recoloredColours.getX(vertex) - red.r) < 1e-6);
  assert.notEqual(recolored.getAttribute("color"), mesh.geometry.getAttribute("color"), "the shared prototype is not recoloured");
  materials.dispose();
});

test("tree kit roles survive merging for tinting and winter", async () => {
  const materials = createMergedModelMaterials();
  const tree = mergeModel(await load("procedural-worlds/pw_deciduous_01"), materials);
  const names = meshes(tree).map(mesh => mesh.name);
  assert.ok(meshes(tree).some(mesh => mesh.userData.foliage === true), names.join(", "));
  const source = await load("procedural-worlds/pw_deciduous_01");
  const hadBatches = meshes(source).some(mesh => mesh.name.startsWith("tree-batch-"));
  assert.equal(meshes(tree).some(mesh => mesh.name.startsWith("tree-batch-")), hadBatches);
  materials.dispose();
});
