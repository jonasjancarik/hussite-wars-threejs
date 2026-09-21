import * as THREE from "three";
import { distanceToPolygon, distanceToPolyline, mulberry32, pointInPolygon } from "./geometry-utils.ts";
import { SceneryVisibility } from "./scenery-visibility.ts";
import type { AuthoredTerrain } from "./terrain.ts";

/** Small, seeded accents follow the landscape, leaving the battle corridor clear. */
export function addLandscapeDetails(group: THREE.Group, terrain: AuthoredTerrain,
  visibility: SceneryVisibility): void {
  const data = terrain.data;
  const random = mulberry32(data.artSeed + 83);
  const dummy = new THREE.Object3D();
  const blade = new THREE.BufferGeometry();
  blade.setAttribute("position", new THREE.Float32BufferAttribute([
    -0.20, 0, 0, 0.08, 0.68, 0.04, 0.16, 0, 0,
    0, 0, -0.18, -0.06, 0.49, 0.08, 0, 0, 0.18,
    -0.15, 0, -0.10, -0.24, 0.37, -0.16, 0.15, 0, 0.10,
  ], 3));
  blade.computeVertexNormals();
  const grass = new THREE.InstancedMesh(blade, new THREE.MeshStandardMaterial({
    color: 0xffffff, roughness: 1, side: THREE.DoubleSide,
  }), 4200);
  grass.name = "Meadow tussocks and golden field stubble";
  grass.receiveShadow = true;
  const palette = [0x838849, 0x9c9c60, 0xb8ac70, 0x727c42];
  const grassMatrices: THREE.Matrix4[] = [];
  let count = 0;
  for (let attempt = 0; attempt < 16000 && count < grass.count; attempt += 1) {
    const x = THREE.MathUtils.lerp(data.bounds.minX + 1, data.bounds.maxX - 1, random());
    const z = THREE.MathUtils.lerp(data.bounds.minZ + 1, data.bounds.maxZ - 1, random());
    if (pointInPolygon(x, z, data.pond.points) || pointInPolygon(x, z, data.mudBasin.points)) continue;
    if (distanceToPolyline(x, z, data.causeway.points) < 6) continue;
    if (data.landmarks.some(p => Math.hypot(x - p.position[0], z - p.position[1]) < 4)) continue;
    const field = data.fields.find(f => pointInPolygon(x, z, f.points));
    if (field?.tone === "earth") continue;
    // Gaps between clustered patches keep the ground painting visible.
    if (!field && Math.sin(x * 0.39 + Math.sin(z * 0.21)) * Math.cos(z * 0.32) < -0.12) continue;
    const size = 0.55 + random() * 0.9;
    dummy.position.set(x, terrain.heightAt(x, z) + 0.03, z);
    dummy.rotation.set(0, random() * Math.PI * 2, 0);
    dummy.scale.set(size, size * (field ? 1.2 : 0.7), size);
    dummy.updateMatrix();
    grass.setMatrixAt(count, dummy.matrix);
    grassMatrices.push(dummy.matrix.clone());
    grass.setColorAt(count, new THREE.Color(field ? 0xc0aa69 : palette[Math.floor(random() * palette.length)]!));
    count += 1;
  }
  grass.count = count;
  group.add(grass);
  visibility.trackInstances(grass, grassMatrices);

  const stones = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.38, 0),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 }), 800);
  stones.name = "Weathered field-edge stone walls";
  stones.castShadow = stones.receiveShadow = true;
  const stoneMatrices: THREE.Matrix4[] = [];
  count = 0;
  for (const field of data.fields) {
    // Two sides of each field suggest old enclosures without fencing in play.
    for (let edge = 0; edge < 2; edge += 1) {
      const a = field.points[edge]!;
      const b = field.points[edge + 1]!;
      const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
      for (let t = 0; t < length && count < stones.count; t += 0.65) {
        const x = THREE.MathUtils.lerp(a[0], b[0], t / length);
        const z = THREE.MathUtils.lerp(a[1], b[1], t / length);
        if (distanceToPolyline(x, z, data.causeway.points) < 8) continue;
        const size = 0.75 + random() * 0.5;
        dummy.position.set(x, terrain.heightAt(x, z) + 0.25, z);
        dummy.rotation.set(random() * 0.3, random() * Math.PI, random() * 0.3);
        dummy.scale.set(size * 1.3, size * 0.8, size);
        dummy.updateMatrix();
        stones.setMatrixAt(count, dummy.matrix);
        stoneMatrices.push(dummy.matrix.clone());
        stones.setColorAt(count, new THREE.Color().setHSL(0.12, 0.12, 0.38 + random() * 0.17));
        count += 1;
      }
    }
  }
  stones.count = count;
  group.add(stones);
  visibility.trackInstances(stones, stoneMatrices);

  const flowers = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.10, 0),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }), 220);
  flowers.name = "Small meadow wildflowers";
  const flowerMatrices: THREE.Matrix4[] = [];
  count = 0;
  for (let attempt = 0; attempt < 4000 && count < flowers.count; attempt += 1) {
    const x = THREE.MathUtils.lerp(-69, 69, random());
    const z = THREE.MathUtils.lerp(-49, 49, random());
    if (pointInPolygon(x, z, data.pond.points) || pointInPolygon(x, z, data.mudBasin.points)
      || distanceToPolyline(x, z, data.causeway.points) < 9
      || data.fields.some(f => pointInPolygon(x, z, f.points))) continue;
    if (distanceToPolygon(x, z, data.pond.points) > 7 && Math.sin(x * 0.2) * Math.cos(z * 0.2) < 0.65) continue;
    dummy.position.set(x, terrain.heightAt(x, z) + 0.34, z);
    dummy.rotation.set(0, random() * Math.PI, 0);
    dummy.scale.set(1, 0.55, 1);
    dummy.updateMatrix();
    flowers.setMatrixAt(count, dummy.matrix);
    flowerMatrices.push(dummy.matrix.clone());
    flowers.setColorAt(count, new THREE.Color(random() < 0.7 ? 0xe7d9a4 : 0xb3a1ba));
    count += 1;
  }
  flowers.count = count;
  group.add(flowers);
  visibility.trackInstances(flowers, flowerMatrices);
}

/** A periodic normal field gives the pond soft ripples without a flat painted overlay. */
export function createPondNormal(): THREE.DataTexture {
  const size = 128;
  const bytes = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = x / size * Math.PI * 2;
      const v = y / size * Math.PI * 2;
      const phase = u + v * 3 + 0.7 * Math.sin(u * 2 - v);
      const nx = Math.cos(phase) * 0.12 + Math.cos(u * 4 - v * 2) * 0.025;
      const ny = Math.cos(phase) * 0.25 - Math.cos(u * 4 - v * 2) * 0.04;
      const normal = new THREE.Vector3(nx, ny, 1).normalize();
      const index = (y * size + x) * 4;
      bytes[index] = Math.round((normal.x * 0.5 + 0.5) * 255);
      bytes[index + 1] = Math.round((normal.y * 0.5 + 0.5) * 255);
      bytes[index + 2] = Math.round((normal.z * 0.5 + 0.5) * 255);
      bytes[index + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(bytes, size, size);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(0.035, 0.035);
  texture.magFilter = texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}
