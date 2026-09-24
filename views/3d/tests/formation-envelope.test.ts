import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import * as THREE from "three";
import { FORMATION_FOOTPRINT, FORMATION_HEIGHT, FORMATION_TRAVEL_FOOTPRINT, formationSupport } from "../src/formation-envelope.ts";
import { BROADSIDE_YAW, unitRecipe } from "../src/unit-recipes.ts";
import type { UnitSnapshot } from "../src/types.ts";

const ROOT = path.resolve(import.meta.dirname, "../../..");
const MODEL_ROOT = path.join(ROOT, "assets/3d/models");
const MODEL_MANIFEST = JSON.parse(fs.readFileSync(path.join(MODEL_ROOT, "manifest.json"), "utf8")) as Record<string, { file: string }>;
const RECIPE_SOURCE = fs.readFileSync(path.join(ROOT, "views/3d/src/unit-recipes.ts"), "utf8");

interface XzPoint { x: number; z: number }
interface GlbDocument {
  nodes?: Array<{ matrix?: number[]; translation?: number[]; rotation?: number[]; scale?: number[]; mesh?: number; children?: number[] }>;
  meshes?: Array<{ primitives?: Array<{ attributes: { POSITION?: number } }> }>;
  accessors?: Array<{ bufferView: number; byteOffset?: number; count: number; componentType: number }>;
  bufferViews?: Array<{ byteOffset?: number; byteStride?: number }>;
  scenes?: Array<{ nodes?: number[] }>;
  scene?: number;
}

const modelVertices = new Map<string, THREE.Vector3[]>();
function verticesForModel(name: string): THREE.Vector3[] {
  const cached = modelVertices.get(name);
  if (cached) return cached;
  const model = MODEL_MANIFEST[name];
  assert.ok(model, `model ${name} is present in the checked-in manifest`);
  const buffer = fs.readFileSync(path.join(MODEL_ROOT, model.file));
  let cursor = 12;
  let document: GlbDocument | undefined;
  let binary: Buffer | undefined;
  while (cursor < buffer.length) {
    const length = buffer.readUInt32LE(cursor);
    const type = buffer.readUInt32LE(cursor + 4);
    cursor += 8;
    const chunk = buffer.subarray(cursor, cursor + length);
    if (type === 0x4e4f534a) document = JSON.parse(chunk.toString("utf8")) as GlbDocument;
    if (type === 0x004e4942) binary = chunk;
    cursor += length;
  }
  assert.ok(document && binary, `${name} GLB contains JSON and BIN chunks`);
  const nodes = document.nodes ?? [];
  const meshes = document.meshes ?? [];
  const accessors = document.accessors ?? [];
  const bufferViews = document.bufferViews ?? [];
  const result: THREE.Vector3[] = [];

  const nodeMatrix = (node: NonNullable<GlbDocument["nodes"]>[number]): THREE.Matrix4 => {
    if (node.matrix) return new THREE.Matrix4().fromArray(node.matrix);
    const position = new THREE.Vector3(...(node.translation ?? [0, 0, 0]) as [number, number, number]);
    const rotation = new THREE.Quaternion(...(node.rotation ?? [0, 0, 0, 1]) as [number, number, number, number]);
    const scale = new THREE.Vector3(...(node.scale ?? [1, 1, 1]) as [number, number, number]);
    return new THREE.Matrix4().compose(position, rotation, scale);
  };
  const visit = (index: number, parent: THREE.Matrix4): void => {
    const node = nodes[index]!;
    const world = parent.clone().multiply(nodeMatrix(node));
    if (node.mesh !== undefined) {
      for (const primitive of meshes[node.mesh]?.primitives ?? []) {
        const positionIndex = primitive.attributes.POSITION;
        if (positionIndex === undefined) continue;
        const accessor = accessors[positionIndex]!;
        assert.equal(accessor.componentType, 5126, `${name} POSITION accessors use Float32`);
        const view = bufferViews[accessor.bufferView]!;
        const base = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
        const stride = view.byteStride ?? 12;
        for (let i = 0; i < accessor.count; i += 1) {
          const offset = base + i * stride;
          result.push(new THREE.Vector3(binary!.readFloatLE(offset), binary!.readFloatLE(offset + 4), binary!.readFloatLE(offset + 8)).applyMatrix4(world));
        }
      }
    }
    for (const child of node.children ?? []) visit(child, world);
  };
  const roots = document.scenes?.[document.scene ?? 0]?.nodes
    ?? nodes.map((_node, index) => index).filter(index => !nodes.some(node => node.children?.includes(index)));
  const identity = new THREE.Matrix4();
  for (const root of roots) visit(root, identity);
  modelVertices.set(name, result);
  return result;
}

function recipeTypes(): { types: string[]; commanders: Set<string> } {
  const cases = [...RECIPE_SOURCE.matchAll(/case "([A-Z0-9_]+)"/g)].map(match => match[1]!);
  const commanders = new Set([...RECIPE_SOURCE.matchAll(/const (?:CLERIC|CAPTAIN|NOBLE)_COMMANDERS = new Set\(\[([\s\S]*?)\]\);/g)]
    .flatMap(match => [...match[1]!.matchAll(/"([A-Z0-9_]+)"/g)].map(value => value[1]!)));
  return { types: [...new Set([...cases, ...commanders])], commanders };
}

function rotate(x: number, z: number, radians: number): XzPoint {
  return { x: Math.cos(radians) * x + Math.sin(radians) * z, z: -Math.sin(radians) * x + Math.cos(radians) * z };
}

/** Standing poses turn wagons broadside; travelling poses keep them pole first. */
function actualFormationPoints(standing: boolean): XzPoint[] {
  const { types, commanders } = recipeTypes();
  assert.equal(types.length, 59, "all 59 current UnitTypes have a recipe or commander recipe");
  const points: XzPoint[] = [];
  const seen = new Set<string>();
  const facings = ["hussites", "crusaders"] as const;
  for (const type of types) for (const dismounted of [false, true]) for (const faction of facings) for (const formationClosed of [true, false]) {
    const unit = { type, dismounted, faction, formationClosed } as UnitSnapshot;
    const recipes = unitRecipe(unit);
    for (const marching of [0, 0.06]) for (const routeScale of [0.92, 1]) {
      const poseKey = JSON.stringify({ type, dismounted, faction, marching, routeScale, recipes });
      if (seen.has(poseKey)) continue;
      seen.add(poseKey);
      const facing = (faction === "hussites" ? -Math.PI / 2 : Math.PI / 2)
        + (standing && recipes.some(recipe => recipe.broadside) ? BROADSIDE_YAW : 0);
      for (const recipe of recipes) {
        const offsets = recipe.offsets.map(([offsetX, offsetZ]) => recipe.rotateOffsetsWithFacing
          ? rotate(offsetX, offsetZ, facing) : { x: offsetX, z: offsetZ });
        const vertices = verticesForModel(recipe.model);
        for (const offset of offsets) for (const vertex of vertices) {
          const figure = rotate(vertex.x * recipe.scale, vertex.z * recipe.scale, facing);
          const root = rotate((figure.x + offset.x) * routeScale, (figure.z + offset.z) * routeScale, marching);
          points.push(root);
        }
      }
      if (commanders.has(type)) for (const vertex of verticesForModel("commander_standard")) {
        const root = rotate((vertex.x * 0.7 - 1.15) * routeScale, (vertex.z * 0.7 - 0.45) * routeScale, marching);
        points.push(root);
      }
    }
  }
  return points;
}

type Footprint = typeof FORMATION_FOOTPRINT;

function insideFootprint(point: XzPoint, footprint: Footprint, epsilon = 0.00001): boolean {
  for (let i = 0; i < footprint.length; i += 1) {
    const [ax, az] = footprint[i]!;
    const [bx, bz] = footprint[(i + 1) % footprint.length]!;
    const cross = (bx - ax) * (point.z - az) - (bz - az) * (point.x - ax);
    if (cross < -epsilon) return false;
  }
  return true;
}

for (const [name, footprint, standing, corners] of [
  ["standing", FORMATION_FOOTPRINT, true, 24], ["travel", FORMATION_TRAVEL_FOOTPRINT, false, 21],
] as const) test(`${name} footprint contains every current GLB vertex and roster pose`, () => {
  assert.equal(footprint.length, corners);
  for (let i = 0; i < footprint.length; i += 1) {
    const [ax, az] = footprint[i]!;
    const [bx, bz] = footprint[(i + 1) % footprint.length]!;
    assert.ok((bx - ax) !== 0 || (bz - az) !== 0, "hull edges are nonzero");
  }
  const points = actualFormationPoints(standing);
  assert.ok(points.length > 100_000, "verification covered the actual model mesh vertices");
  const outside = points.find(point => !insideFootprint(point, footprint));
  assert.equal(outside, undefined, outside && `mesh vertex escaped footprint at (${outside.x}, ${outside.z})`);
});

test("formation support returns the hull's directional extent", () => {
  for (let degrees = 0; degrees < 360; degrees += 3) {
    const angle = degrees * Math.PI / 180;
    const nx = Math.cos(angle), nz = Math.sin(angle);
    const expected = Math.max(...FORMATION_FOOTPRINT.map(([x, z]) => x * nx + z * nz));
    assert.ok(Math.abs(formationSupport(nx, nz) - expected) < 1e-12, `support at ${degrees} degrees`);
  }
  assert.ok(formationSupport(1, 0) >= 3.2974);
  assert.ok(formationSupport(-1, 0) >= 3.2974);
  assert.ok(formationSupport(0, 1) >= 1.8943);
  assert.ok(formationSupport(0, -1) >= 1.9929);
  // Pole-first wagons are narrow across a gate but long along the route.
  assert.ok(formationSupport(1, 0, FORMATION_TRAVEL_FOOTPRINT) >= 1.7535);
  assert.ok(formationSupport(0, 1, FORMATION_TRAVEL_FOOTPRINT) >= 3.3183);
});

test("formation height safely covers every current recipe mesh above its grounded origin", () => {
  const { types, commanders } = recipeTypes();
  let maximumHeight = 0;
  const seen = new Set<string>();
  const includeModel = (name: string, scale: number): void => {
    const key = `${name}:${scale}`;
    if (seen.has(key)) return;
    seen.add(key);
    let minY = Infinity, maxY = -Infinity;
    for (const vertex of verticesForModel(name)) {
      minY = Math.min(minY, vertex.y);
      maxY = Math.max(maxY, vertex.y);
    }
    maximumHeight = Math.max(maximumHeight, (maxY - minY) * scale);
  };
  for (const type of types) for (const dismounted of [false, true]) for (const formationClosed of [true, false]) {
    for (const recipe of unitRecipe({ type, dismounted, faction: "hussites", formationClosed } as UnitSnapshot)) {
      includeModel(recipe.model, recipe.scale);
    }
    if (commanders.has(type)) includeModel("commander_standard", 0.7);
  }
  assert.ok(maximumHeight >= 4.1265, `measured maximum was ${maximumHeight}`);
  assert.ok(FORMATION_HEIGHT >= maximumHeight, `metadata ${FORMATION_HEIGHT} is below measured ${maximumHeight}`);
});
