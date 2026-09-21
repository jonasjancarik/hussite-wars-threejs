#!/usr/bin/env node
/**
 * Export the actual Procedural Worlds vegetation assemblies as static GLBs.
 *
 * Usage:
 *   node --experimental-strip-types tools/art/vegetation/export-procedural-worlds.mjs
 *
 * Set PROCEDURAL_WORLDS_WEB_DIR when the source checkout lives elsewhere.
 * The source project remains read-only: this script imports its authoritative
 * seeded assembly functions and writes only battle-game assets.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const sourceWebRoot = resolve(
  process.env.PROCEDURAL_WORLDS_WEB_DIR
    ?? "/Users/janca/projects/procedural-worlds/web",
);
const sourceRepositoryRoot = resolve(sourceWebRoot, "..");
const outputDirectory = join(repositoryRoot, "assets/3d/models/vegetation/procedural-worlds");

const sourceFile = (path) => pathToFileURL(join(sourceWebRoot, path)).href;
const [THREE, { GLTFExporter }, { GLTFLoader }, { mergeGeometries }, vegetation] = await Promise.all([
  import(sourceFile("node_modules/three/build/three.module.js")),
  import(sourceFile("node_modules/three/examples/jsm/exporters/GLTFExporter.js")),
  import(sourceFile("node_modules/three/examples/jsm/loaders/GLTFLoader.js")),
  import(sourceFile("node_modules/three/examples/jsm/utils/BufferGeometryUtils.js")),
  import(sourceFile("src/world/vegetation.ts")),
]);

// Three's browser exporter uses FileReader for the final Blob. Node provides
// Blob but not FileReader, so this small compatibility adapter keeps the
// source generator and the official Three exporter usable without a package.
if (globalThis.FileReader === undefined) {
  globalThis.FileReader = class FileReader {
    result = null;
    onloadend = null;

    readAsArrayBuffer(blob) {
      blob.arrayBuffer().then((value) => {
        this.result = value;
        this.onloadend?.();
      });
    }
  };
}

const sourceRevision = execFileSync(
  "git",
  ["-C", sourceRepositoryRoot, "rev-parse", "HEAD"],
  { encoding: "utf8" },
).trim();

const sourceFiles = [
  "web/src/world/vegetation.ts",
  "web/src/world/canopy-geometry.ts",
  "web/src/world/mesh-data.ts",
  "web/src/dev/three-mesh-data.ts",
];
const sourceFileBlobIds = Object.fromEntries(sourceFiles.map((path) => [
  path,
  execFileSync("git", ["-C", sourceRepositoryRoot, "rev-parse", `${sourceRevision}:${path}`], {
    encoding: "utf8",
  }).trim(),
]));
const sourceWorkingFileSha256 = Object.fromEntries(await Promise.all(sourceFiles.map(async (path) => [
  path,
  createHash("sha256").update(await readFile(join(sourceRepositoryRoot, path))).digest("hex"),
])));

const exporterMaterialPalette = {
  material: "MeshStandardMaterial",
  flat_shading: true,
  roughness: 0.92,
  metalness: 0,
  trunk: "#4c3322",
  birch: "#c8b79a",
  leaves: ["#3d6b30", "#668343", "#91a34e"],
  soil: "#51442c",
  litter: "#75643e",
  rocks: ["#777060", "#958a70"],
};

function fixed(value) {
  return Number(value.toFixed(4));
}

function roundedBounds(box) {
  return {
    min: [fixed(box.min.x), fixed(box.min.y), fixed(box.min.z)],
    max: [fixed(box.max.x), fixed(box.max.y), fixed(box.max.z)],
    dimensions: [
      fixed(box.max.x - box.min.x),
      fixed(box.max.y - box.min.y),
      fixed(box.max.z - box.min.z),
    ],
  };
}

function countGeometry(root) {
  let meshes = 0;
  let vertices = 0;
  let triangles = 0;
  root.traverse((object) => {
    if (!object.isMesh) return;
    meshes += 1;
    const position = object.geometry.getAttribute("position");
    if (!position) throw new Error(`${object.name || "unnamed mesh"} has no positions`);
    vertices += position.count * (object.isInstancedMesh ? object.count : 1);
    const indexCount = object.geometry.index?.count ?? position.count;
    triangles += (indexCount / 3) * (object.isInstancedMesh ? object.count : 1);
  });
  return { meshes, vertices, triangles };
}

function assertFiniteBounds(box, label) {
  const values = [...box.min.toArray(), ...box.max.toArray()];
  if (!values.every(Number.isFinite)) throw new Error(`${label} has non-finite bounds`);
  if (box.max.y - box.min.y <= 0) throw new Error(`${label} has no vertical extent`);
}

/** Replaces GPU instancing with ordinary merged mesh geometry for Bevy glTF. */
function bakeInstancedMeshes(root) {
  const instances = [];
  root.traverse((object) => {
    if (object.isInstancedMesh) instances.push(object);
  });
  const matrix = new THREE.Matrix4();
  for (const instance of instances) {
    if (instance.instanceColor !== null) {
      throw new Error(`${instance.name} uses unsupported per-instance colors`);
    }
    const parts = [];
    for (let index = 0; index < instance.count; index += 1) {
      instance.getMatrixAt(index, matrix);
      parts.push(instance.geometry.clone().applyMatrix4(matrix));
    }
    const geometry = mergeGeometries(parts, false);
    parts.forEach((part) => part.dispose());
    if (!geometry) throw new Error(`Could not bake ${instance.name}`);
    const baked = new THREE.Mesh(geometry, instance.material);
    baked.name = `${instance.name}-baked`;
    baked.position.copy(instance.position);
    baked.quaternion.copy(instance.quaternion);
    baked.scale.copy(instance.scale);
    baked.matrixAutoUpdate = instance.matrixAutoUpdate;
    if (!baked.matrixAutoUpdate) baked.matrix.copy(instance.matrix);
    baked.castShadow = instance.castShadow;
    baked.receiveShadow = instance.receiveShadow;
    baked.frustumCulled = instance.frustumCulled;
    baked.renderOrder = instance.renderOrder;
    baked.layers.mask = instance.layers.mask;
    baked.visible = instance.visible;
    baked.userData = { ...instance.userData, bakedFromInstancedMesh: true };
    const parent = instance.parent;
    if (!parent) throw new Error(`${instance.name} has no parent`);
    parent.remove(instance);
    parent.add(baked);
  }
  return instances.length;
}

function readGlbDocument(bytes, label) {
  if (bytes.toString("ascii", 0, 4) !== "glTF") throw new Error(`${label} is not a GLB`);
  const jsonLength = bytes.readUInt32LE(12);
  if (bytes.toString("ascii", 16, 20) !== "JSON") throw new Error(`${label} has no JSON chunk`);
  return JSON.parse(bytes.toString("utf8", 20, 20 + jsonLength).trim());
}

function sourceMaterials() {
  const standard = (color) => new THREE.MeshStandardMaterial({
    color,
    roughness: 0.92,
    metalness: 0,
    flatShading: true,
  });
  return {
    trunk: standard(exporterMaterialPalette.trunk),
    birch: standard(exporterMaterialPalette.birch),
    leaves: exporterMaterialPalette.leaves.map(standard),
    soil: standard(exporterMaterialPalette.soil),
    litter: standard(exporterMaterialPalette.litter),
    rocks: exporterMaterialPalette.rocks.map(standard),
  };
}

async function loadAndMeasure(bytes, label) {
  const binary = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const loader = new GLTFLoader();
  const gltf = await new Promise((resolveLoaded, rejectLoaded) => {
    loader.parse(binary, "", resolveLoaded, rejectLoaded);
  });
  gltf.scene.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(gltf.scene);
  assertFiniteBounds(bounds, `${label} exported GLB`);
  return { ...countGeometry(gltf.scene), bounds: roundedBounds(bounds) };
}

async function exportAssembly(definition) {
  const materials = sourceMaterials();
  const placement = {
    id: `battle-game:${definition.id}`,
    archetype: definition.kind === "tree" ? "tree-deciduous" : "shrub",
    position: [0, 0, 0],
    yaw: 0,
    scale: 1,
    variation: definition.seed,
    layer: "local",
  };
  const assembly = definition.kind === "tree"
    ? vegetation.createTreeAssembly(placement, materials, "summer").object
    : vegetation.createShrubAssembly(placement, materials).object;
  assembly.name = definition.id;
  assembly.userData.provenance = {
    source: "procedural-worlds",
    revision: sourceRevision,
    generator: definition.kind === "tree" ? "createTreeAssembly" : "createShrubAssembly",
    variation: definition.seed,
    targetHeightMetres: definition.targetHeightMetres,
  };

  const sourceBox = new THREE.Box3().setFromObject(assembly);
  assertFiniteBounds(sourceBox, `${definition.id} source assembly`);
  const scale = definition.targetHeightMetres / sourceBox.getSize(new THREE.Vector3()).y;
  assembly.scale.setScalar(scale);
  assembly.updateMatrixWorld(true);
  const scaledBox = new THREE.Box3().setFromObject(assembly);
  assembly.position.y -= scaledBox.min.y;
  assembly.updateMatrixWorld(true);
  const groundedBox = new THREE.Box3().setFromObject(assembly);
  assertFiniteBounds(groundedBox, `${definition.id} grounded assembly`);
  if (Math.abs(groundedBox.min.y) > 1e-5) {
    throw new Error(`${definition.id} did not land at Y=0: ${groundedBox.min.y}`);
  }

  const scene = new THREE.Scene();
  scene.name = `${definition.id}-scene`;
  scene.add(assembly);
  scene.updateMatrixWorld(true);
  const sourceCounts = countGeometry(scene);
  const bakedInstanceMeshes = bakeInstancedMeshes(scene);
  scene.updateMatrixWorld(true);
  const bakedCounts = countGeometry(scene);
  let bakedBox = new THREE.Box3().setFromObject(scene);
  if (
    bakedCounts.vertices !== sourceCounts.vertices
    || bakedCounts.triangles !== sourceCounts.triangles
  ) {
    throw new Error(`${definition.id} changed geometry while baking instances`);
  }
  // InstancedMesh bounds are not equivalent to the merged-geometry bounds for
  // every source variation. Size and ground the actual mesh data to export.
  assembly.scale.multiplyScalar(
    definition.targetHeightMetres / bakedBox.getSize(new THREE.Vector3()).y,
  );
  scene.updateMatrixWorld(true);
  bakedBox = new THREE.Box3().setFromObject(scene);
  assembly.position.y -= bakedBox.min.y;
  scene.updateMatrixWorld(true);
  bakedBox = new THREE.Box3().setFromObject(scene);
  if (Math.abs(bakedBox.min.y) > 1e-5) {
    throw new Error(`${definition.id} baked asset did not land at Y=0: ${bakedBox.min.y}`);
  }
  const exporter = new GLTFExporter();
  const exported = await exporter.parseAsync(scene, {
    binary: true,
    onlyVisible: true,
    includeCustomExtensions: true,
  });
  if (!(exported instanceof ArrayBuffer)) {
    throw new Error(`${definition.id} exporter did not return a GLB ArrayBuffer`);
  }
  const bytes = Buffer.from(exported);
  const gltfDocument = readGlbDocument(bytes, definition.id);
  const requiredExtensions = gltfDocument.extensionsRequired ?? [];
  const usedExtensions = gltfDocument.extensionsUsed ?? [];
  if (
    requiredExtensions.includes("EXT_mesh_gpu_instancing")
    || usedExtensions.includes("EXT_mesh_gpu_instancing")
  ) {
    throw new Error(`${definition.id} still exports EXT_mesh_gpu_instancing`);
  }
  const destination = join(outputDirectory, definition.file);
  await writeFile(destination, bytes);
  const exportedCounts = await loadAndMeasure(bytes, definition.id);
  if (exportedCounts.triangles !== sourceCounts.triangles) {
    throw new Error(
      `${definition.id} triangle mismatch: source ${sourceCounts.triangles}, exported ${exportedCounts.triangles}`,
    );
  }
  if (Math.abs(exportedCounts.bounds.min[1]) > 1e-4) {
    throw new Error(`${definition.id} exported GLB is not grounded: ${exportedCounts.bounds.min[1]}`);
  }
  return {
    file: definition.file,
    kind: definition.kind,
    seed: definition.seed,
    source_generator: definition.kind === "tree" ? "createTreeAssembly" : "createShrubAssembly",
    target_height_m: definition.targetHeightMetres,
    bounds_y_up_m: exportedCounts.bounds,
    meshes: exportedCounts.meshes,
    vertices: exportedCounts.vertices,
    triangles: exportedCounts.triangles,
    baked_instanced_meshes: bakedInstanceMeshes,
    gltf_extensions_required: requiredExtensions,
    gltf_extensions_used: usedExtensions,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
}

const definitions = [
  { id: "pw_deciduous_01", file: "pw_deciduous_01.glb", kind: "tree", seed: 1103, targetHeightMetres: 10.8 },
  { id: "pw_deciduous_02", file: "pw_deciduous_02.glb", kind: "tree", seed: 4009, targetHeightMetres: 14.2 },
  { id: "pw_deciduous_03", file: "pw_deciduous_03.glb", kind: "tree", seed: 92017, targetHeightMetres: 17.5 },
  { id: "pw_shrub_01", file: "pw_shrub_01.glb", kind: "shrub", seed: 414, targetHeightMetres: 1.35 },
];

await mkdir(outputDirectory, { recursive: true });
const assets = [];
for (const definition of definitions) assets.push(await exportAssembly(definition));

const manifest = {
  format: "glTF 2.0 binary (.glb)",
  coordinate_system: "right-handed, Y-up; each whole asset is translated so its global lowest vertex is Y=0; 1 unit = 1 metre",
  provenance: {
    source_repository: sourceRepositoryRoot,
    source_revision: sourceRevision,
    source_files: sourceFiles,
    source_file_blob_ids: sourceFileBlobIds,
    source_working_file_sha256: sourceWorkingFileSha256,
    export_script: relative(repositoryRoot, fileURLToPath(import.meta.url)),
  },
  export_settings: {
    tree_assembly_season: "summer",
    material_palette: exporterMaterialPalette,
  },
  assets,
};
await writeFile(join(outputDirectory, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify(manifest, null, 2));
