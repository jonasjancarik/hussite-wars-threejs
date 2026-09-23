import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { MergedScenery, SOURCE_LAYER } from "../src/scenery-merge.ts";

function piece(material: THREE.Material, x: number, owner: THREE.Group): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
  mesh.position.x = x;
  owner.add(mesh);
  return mesh;
}

test("merged scenery draws pieces sharing a material once and follows their visibility", () => {
  const root = new THREE.Group(), stone = new THREE.MeshStandardMaterial(), wood = new THREE.MeshStandardMaterial();
  const cells = [new THREE.Group(), new THREE.Group(), new THREE.Group()];
  cells.forEach(cell => root.add(cell));
  const walls = cells.map((cell, index) => piece(stone, index * 3, cell));
  const lone = piece(wood, 20, cells[0]!);
  const glass = piece(new THREE.MeshStandardMaterial({ transparent: true }), 30, cells[1]!);
  const merged = new MergedScenery(root);
  const proxies = merged.group.children as THREE.Mesh[];
  assert.equal(proxies.length, 1, "one mesh for the three stone pieces; singles and transparent pieces stay as they are");
  assert.equal(merged.mergedPieces, 3);
  assert.ok(walls.every(wall => wall.layers.isEnabled(SOURCE_LAYER) && !wall.layers.isEnabled(0)), "sources leave the rendered layer");
  assert.equal(lone.layers.mask, 1);
  assert.equal(glass.layers.mask, 1);
  const proxy = proxies[0]!;
  assert.equal(proxy.geometry.index!.count, 36 * 3);
  const box = new THREE.Box3().setFromBufferAttribute(proxy.geometry.getAttribute("position") as THREE.BufferAttribute);
  assert.ok(Math.abs(box.min.x + .5) < 1e-6 && Math.abs(box.max.x - 6.5) < 1e-6, "pieces keep their world placement");

  cells[1]!.visible = false;
  merged.sync();
  assert.equal(proxy.geometry.index!.count, 36 * 2, "a hidden owner hides its piece");
  walls[0]!.visible = false; walls[2]!.visible = false;
  merged.sync();
  assert.equal(proxy.visible, false, "nothing left to draw");
  cells[1]!.visible = true; walls[0]!.visible = true; walls[2]!.visible = true;
  merged.sync();
  assert.equal(proxy.geometry.index!.count, 36 * 3);
  assert.equal(proxy.visible, true);

  let disposed = false;
  proxy.geometry.addEventListener("dispose", () => { disposed = true; });
  merged.dispose();
  assert.ok(disposed);
  assert.ok(!root.children.includes(merged.group));
});

test("mirrored pieces keep their outward winding", () => {
  const root = new THREE.Group(), material = new THREE.MeshStandardMaterial();
  const a = piece(material, 0, root), b = piece(material, 3, root);
  b.scale.x = -1;
  new MergedScenery(root);
  const proxy = root.children.find(child => child.userData.renderProxy)!.children[0] as THREE.Mesh;
  const positions = proxy.geometry.getAttribute("position") as THREE.BufferAttribute, index = proxy.geometry.index!;
  const triangle = new THREE.Triangle(), normal = new THREE.Vector3(), centroid = new THREE.Vector3();
  for (let corner = 0; corner < index.count; corner += 3) {
    triangle.setFromAttributeAndIndices(positions, index.getX(corner), index.getX(corner + 1), index.getX(corner + 2));
    triangle.getNormal(normal); triangle.getMidpoint(centroid);
    const centre = centroid.x > 1.5 ? 3 : 0;
    assert.ok(normal.dot(centroid.clone().sub(new THREE.Vector3(centre, 0, 0))) > 0, "faces point away from the box centre");
  }
  assert.ok(a && b);
});
