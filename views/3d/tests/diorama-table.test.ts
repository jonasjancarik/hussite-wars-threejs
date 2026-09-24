import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { DioramaTable } from "../src/diorama-table.ts";

test("the table lies flat under the board and shows nothing but the board's shadow", () => {
  const table = new DioramaTable(new THREE.Vector2(3, -2), 80, -7);
  assert.equal(table.mesh.position.y, -7);
  assert.deepEqual([table.mesh.position.x, table.mesh.position.z], [3, -2]);
  assert.equal(table.mesh.receiveShadow, true);
  const box = new THREE.Box3().setFromObject(table.mesh);
  assert.ok(box.max.y - box.min.y < 1e-6, "flat");
  assert.ok(box.max.x - box.min.x > 80 * 4, "reaches well past the board");
  assert.equal((table.mesh.material as THREE.Material).type, "ShadowNodeMaterial", "the sky shows through");
  table.dispose();
  assert.equal(table.mesh.parent, null);
});
