import assert from 'node:assert/strict';
import test from 'node:test';
import { overlayGeometry, TacticalOverlays } from '../src/overlays.ts';
import { HexLayout } from '../src/hex-coordinates.ts';
import * as THREE from 'three';

test('hover ring and fill face upwards and stay above the pond', () => {
  for (const fill of [false, true]) {
    const geometry = overlayGeometry({ col: 4, row: 4 }, { heightAt: () => -1.1 }, fill);
    const normals = geometry.getAttribute('normal');
    const positions = geometry.getAttribute('position');
    for (let i = 0; i < normals.count; i += 1) {
      assert.ok(normals.getY(i) > 0.99, `downward overlay vertex ${i}, fill=${fill}`);
      assert.ok(positions.getY(i) > -0.52);
    }
    geometry.dispose();
  }
});

test('grid and action overlays respect opaque unit depth', () => {
  const overlays = new TacticalOverlays({ heightAt: () => 0, group: new THREE.Group(), interactiveMeshes: [] }, new HexLayout(2, 1));
  for (const child of overlays.group.children) {
    const mesh = child as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
    assert.equal(mesh.material.depthTest, true);
    mesh.geometry.dispose();
    mesh.material.dispose();
  }
});

test('adjacent outlines meet at a single shared edge and follow rendered height', () => {
  const layout = new HexLayout(1, 2);
  const terrain = { heightAt: () => 9, renderedHeightAt: () => 1 };
  const geometries = [0, 1].map(row => overlayGeometry({ col: 0, row }, terrain, false, layout));
  const positions = geometries.map(geometry => geometry.getAttribute('position'));
  const sharedZ = (layout.center(0, 0).z + layout.center(0, 1).z) / 2;
  for (const position of positions) {
    assert.ok(Array.from({ length: position.count / 2 }, (_, i) => position.getZ(i))
      .some(z => Math.abs(z - sharedZ) < 1e-6));
    assert.ok(Math.abs(position.getY(0) - 1.04) < 1e-6);
  }
  geometries.forEach(geometry => geometry.dispose());
});
