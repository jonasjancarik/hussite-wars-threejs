/**
 * Narrow opaque-instance batching adaptation of procedural-worlds
 * static-batching.ts at commit bada861a8d5c8cb7275a1b3d6e6a3f4ea4844cf4.
 * Battle units remain independent; only authored static scenery is collapsed.
 */
import * as THREE from "three";
import type { SceneryInstanceBatch } from "./scenery-visibility.ts";

interface BatchEntry {
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.Material>;
  matrix: THREE.Matrix4;
  key: string;
}

export interface StaticBatchResult {
  savedMeshes: number;
  batches: SceneryInstanceBatch[];
}

export function batchStaticMeshes(root: THREE.Group,
  keyForObject: (object: THREE.Object3D) => string | null): StaticBatchResult {
  root.updateWorldMatrix(true, true);
  const inverseRoot = root.matrixWorld.clone().invert();
  const groups = new Map<string, BatchEntry[]>();
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh)
      || object instanceof THREE.InstancedMesh
      || object instanceof THREE.SkinnedMesh
      || Array.isArray(object.material)
      || object.material.transparent
      || object.morphTargetInfluences) return;
    const key = [object.geometry.uuid, object.material.uuid, object.castShadow, object.receiveShadow, object.renderOrder].join(":");
    const sceneryKey = keyForObject(object);
    if (!sceneryKey) return;
    const entries = groups.get(key) ?? [];
    entries.push({ mesh: object, matrix: inverseRoot.clone().multiply(object.matrixWorld), key: sceneryKey });
    groups.set(key, entries);
  });

  let savedMeshes = 0;
  const batches: SceneryInstanceBatch[] = [];
  for (const entries of groups.values()) {
    if (entries.length < 3) continue;
    const first = entries[0]!.mesh;
    const instanced = new THREE.InstancedMesh(first.geometry, first.material, entries.length);
    instanced.name = `Batched ${first.name || "scenery"}`;
    instanced.castShadow = first.castShadow;
    instanced.receiveShadow = first.receiveShadow;
    instanced.renderOrder = first.renderOrder;
    entries.forEach((entry, index) => {
      instanced.setMatrixAt(index, entry.matrix);
      entry.mesh.removeFromParent();
    });
    instanced.instanceMatrix.needsUpdate = true;
    root.add(instanced);
    batches.push({ mesh: instanced, matrices: entries.map(entry => entry.matrix), keys: entries.map(entry => entry.key) });
    savedMeshes += entries.length - 1;
  }
  return { savedMeshes, batches };
}
