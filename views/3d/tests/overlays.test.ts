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

test('winter grid contrasts with snow and ice while roads and action colours stay distinct', () => {
  const layout = new HexLayout(3, 1);
  const overlays = new TacticalOverlays({ heightAt: () => 0, group: new THREE.Group(), interactiveMeshes: [],
    environmentPlan: { winter: true } }, layout);
  const snapshot = {
    tiles: [{ col: 0, row: 0, terrain: 'plains' }, { col: 1, row: 0, terrain: 'water' }, { col: 2, row: 0, terrain: 'road' }],
    units: [], selectedUnitId: null, legalMoves: [], legalAttacks: [], marchTargets: [], exploredHexes: [], fogOfWar: false,
  } as unknown as import('../src/types.ts').BattleSnapshot;
  overlays.update(snapshot);
  const rings = overlays.group.children.filter(child => child.renderOrder === 10) as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>[];
  const luminance = (c: THREE.Color) => .2126*c.r + .7152*c.g + .0722*c.b;
  for (const [index, ground] of [[0, 0xe2e5dc], [1, 0xbad1d1]]) {
    const material = rings[index!]!.material, background = new THREE.Color(ground);
    const line = background.clone().lerp(material.color, material.opacity);
    assert.ok((luminance(background)+.05)/(luminance(line)+.05) > 1.8, 'grid must be visible on pale terrain');
    assert.equal(material.depthTest, true, 'grid must not show through units');
  }
  assert.notEqual(rings[0]!.material.color.getHex(), rings[2]!.material.color.getHex(), 'dark roads retain a light grid');
  overlays.setGridVisible(false);
  assert.ok(rings.every(ring => !ring.visible));
  overlays.update({ ...snapshot, legalMoves: [{ col: 0, row: 0 }] });
  assert.ok(rings[0]!.visible, 'movement remains visible with the base grid off');
  assert.equal(rings[0]!.material.color.getHex(), 0x72e0ab);
  for (const child of overlays.group.children as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>[]) {
    child.geometry.dispose(); child.material.dispose();
  }
});
