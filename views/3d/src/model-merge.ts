import * as THREE from "three";
import { MeshStandardNodeMaterial } from "three/webgpu";
import { attribute } from "three/tsl";

/**
 * The low-poly GLB models carry one mesh per flat-coloured material (a house
 * is 8–14, a soldier 7–14), none textured. Each figure or building therefore
 * cost a dozen draw calls in the main pass and again in the shadow pass.
 * `mergeModel` bakes a model into one mesh per face side (and per foliage /
 * winter role, which the scenery tints or removes), carrying the base colour,
 * roughness and metalness per vertex. Every merged model shares the same two
 * materials, so they also share one shader.
 */

/** Per-vertex roughness (x) and metalness (y) of a merged model. */
export const MODEL_PBR = "modelPbr";
/** Faction-coloured parts: 0 none, 1 team cloth, 2 team paint (CPU-side, in geometry.userData). */
export const TEAM_SLOT_KEY = "teamSlots";
export const TEAM_SLOTS = { team_cloth: 1, team_paint: 2 } as const;
/** Roughness floor the loader has always applied to model materials. */
export const MODEL_MIN_ROUGHNESS = 0.72;

export interface MergedModelMaterials {
  get(side: THREE.Side): THREE.Material;
  owns(material: THREE.Material): boolean;
  dispose(): void;
}

type TslFactory = (...arguments_: any[]) => any;
const tslAttribute = attribute as unknown as TslFactory;

export function createMergedModelMaterials(): MergedModelMaterials {
  const materials = new Map<THREE.Side, THREE.Material>();
  return {
    get(side) {
      let material = materials.get(side);
      if (!material) {
        const node = new MeshStandardNodeMaterial({ color: 0xffffff, vertexColors: true, side });
        const pbr = tslAttribute(MODEL_PBR, "vec2");
        node.roughnessNode = pbr.x;
        node.metalnessNode = pbr.y;
        node.name = `Merged model parts (${side === THREE.DoubleSide ? "double" : "front"}-sided)`;
        materials.set(side, node);
        material = node;
      }
      return material;
    },
    owns(material) { return [...materials.values()].includes(material); },
    dispose() { materials.forEach(material => material.dispose()); materials.clear(); },
  };
}

/** Mesh names and material names the scenery code gives a role to. */
const ROLE_PREFIXES = ["tree-batch-", "shrub-batch-", "vegetation-ground-tufts-baked"];
export const FOLIAGE_MATERIALS = new Set(["olive", "olive_light", "gold", "cypress"]);

function role(mesh: THREE.Mesh, material: THREE.Material): string {
  const prefix = ROLE_PREFIXES.find(value => mesh.name.startsWith(value));
  if (prefix) return prefix;
  return FOLIAGE_MATERIALS.has(material.name) ? "foliage" : "";
}

interface Bucket {
  side: THREE.Side;
  role: string;
  positions: number[];
  normals: number[];
  colors: number[];
  pbr: number[];
  teams: number[];
  indices: number[];
}

/** Whether a model can be merged: static, untextured, opaque meshes only. */
function mergeable(scene: THREE.Object3D): boolean {
  let ok = true;
  scene.traverse(object => {
    if (!ok || !(object instanceof THREE.Mesh)) return;
    if (object instanceof THREE.SkinnedMesh || object instanceof THREE.InstancedMesh || object.morphTargetInfluences) { ok = false; return; }
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      const standard = material as THREE.MeshStandardMaterial;
      if (!standard.isMeshStandardMaterial || standard.transparent || standard.map || standard.emissiveMap
        || standard.normalMap || standard.roughnessMap || standard.metalnessMap || standard.alphaMap || standard.aoMap
        || (standard.emissive && standard.emissive.getHex() !== 0)) { ok = false; return; }
    }
  });
  return ok;
}

/**
 * A copy of `scene` with its meshes merged by face side and role. Returns the
 * scene itself when something in it can't be merged (textures, skinning).
 */
export function mergeModel(scene: THREE.Group, materials: MergedModelMaterials): THREE.Group {
  if (!mergeable(scene)) return scene;
  scene.updateMatrixWorld(true);
  const toRoot = scene.matrixWorld.clone().invert();
  const buckets = new Map<string, Bucket>();
  const matrix = new THREE.Matrix4(), normalMatrix = new THREE.Matrix3();
  const point = new THREE.Vector3(), normal = new THREE.Vector3(), color = new THREE.Color();
  scene.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    const geometry = object.geometry as THREE.BufferGeometry;
    const position = geometry.getAttribute("position") as THREE.BufferAttribute | undefined;
    if (!position) return;
    const normals = geometry.getAttribute("normal") as THREE.BufferAttribute | undefined;
    const vertexColors = geometry.getAttribute("color") as THREE.BufferAttribute | undefined;
    matrix.multiplyMatrices(toRoot, object.matrixWorld);
    normalMatrix.getNormalMatrix(matrix);
    const mirrored = matrix.determinant() < 0;
    const index = geometry.index;
    const vertexCount = index ? index.count : position.count;
    const groups = geometry.groups.length ? geometry.groups : [{ start: 0, count: vertexCount, materialIndex: 0 }];
    const meshMaterials = Array.isArray(object.material) ? object.material : [object.material];
    for (const group of groups) {
      const material = meshMaterials[group.materialIndex ?? 0] as THREE.MeshStandardMaterial | undefined;
      if (!material) continue;
      const key = `${material.side}|${role(object, material)}`;
      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = { side: material.side, role: role(object, material), positions: [], normals: [], colors: [], pbr: [], teams: [], indices: [] };
        buckets.set(key, bucket);
      }
      const team = TEAM_SLOTS[material.name as keyof typeof TEAM_SLOTS] ?? 0;
      const roughness = Math.max(material.roughness, MODEL_MIN_ROUGHNESS), metalness = material.metalness;
      // Vertices are copied per group corner through a remap, so shared vertices stay shared.
      const remap = new Map<number, number>();
      const end = Math.min(group.start + group.count, vertexCount);
      const corners: number[] = [];
      for (let corner = group.start; corner < end; corner += 1) {
        const source = index ? index.getX(corner) : corner;
        let target = remap.get(source);
        if (target === undefined) {
          target = bucket.positions.length / 3;
          remap.set(source, target);
          point.fromBufferAttribute(position, source).applyMatrix4(matrix);
          bucket.positions.push(point.x, point.y, point.z);
          if (normals) normal.fromBufferAttribute(normals, source).applyMatrix3(normalMatrix).normalize();
          else normal.set(0, 1, 0);
          bucket.normals.push(normal.x, normal.y, normal.z);
          color.copy(material.color);
          if (material.vertexColors && vertexColors) {
            color.r *= vertexColors.getX(source); color.g *= vertexColors.getY(source); color.b *= vertexColors.getZ(source);
          }
          bucket.colors.push(color.r, color.g, color.b);
          bucket.pbr.push(roughness, metalness);
          bucket.teams.push(team);
        }
        corners.push(target);
      }
      for (let corner = 0; corner + 2 < corners.length; corner += 3) {
        if (mirrored) bucket.indices.push(corners[corner]!, corners[corner + 2]!, corners[corner + 1]!);
        else bucket.indices.push(corners[corner]!, corners[corner + 1]!, corners[corner + 2]!);
      }
    }
  });
  const merged = new THREE.Group();
  merged.name = scene.name;
  merged.position.copy(scene.position); merged.quaternion.copy(scene.quaternion); merged.scale.copy(scene.scale);
  merged.userData = { ...scene.userData };
  for (const bucket of buckets.values()) {
    if (!bucket.indices.length) continue;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(bucket.positions, 3));
    geometry.setAttribute("normal", new THREE.Float32BufferAttribute(bucket.normals, 3));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(bucket.colors, 3));
    geometry.setAttribute(MODEL_PBR, new THREE.Float32BufferAttribute(bucket.pbr, 2));
    geometry.setIndex(bucket.indices);
    if (bucket.teams.some(slot => slot !== 0)) geometry.userData[TEAM_SLOT_KEY] = Uint8Array.from(bucket.teams);
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    const mesh = new THREE.Mesh(geometry, materials.get(bucket.side));
    // Role meshes keep a name the scenery recognises (winter strips tree batches and baked tufts).
    mesh.name = bucket.role === "vegetation-ground-tufts-baked" ? bucket.role
      : bucket.role && bucket.role !== "foliage" ? `${bucket.role}merged` : `${scene.name || "model"} merged`;
    if (bucket.role && bucket.role !== "vegetation-ground-tufts-baked") mesh.userData.foliage = true;
    mesh.castShadow = mesh.receiveShadow = true;
    merged.add(mesh);
  }
  return merged;
}

/**
 * A copy of a merged mesh's geometry with its team-slot vertices recoloured
 * (linear RGB). Returns null when the geometry has no team slots.
 */
export function recolorTeamSlots(geometry: THREE.BufferGeometry, colors: Record<1 | 2, THREE.Color>): THREE.BufferGeometry | null {
  const slots = geometry.userData[TEAM_SLOT_KEY] as Uint8Array | undefined;
  if (!slots) return null;
  const copy = geometry.clone();
  const attributeColors = copy.getAttribute("color") as THREE.BufferAttribute;
  for (let vertex = 0; vertex < slots.length; vertex += 1) {
    const slot = slots[vertex] as 0 | 1 | 2;
    if (slot) attributeColors.setXYZ(vertex, colors[slot].r, colors[slot].g, colors[slot].b);
  }
  return copy;
}
