import assert from 'node:assert/strict';
import test from 'node:test';
import { GRID_FAR_FACTOR, overlayGeometry, TacticalOverlays } from '../src/overlays.ts';
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
  assert.ok(overlays.group.children.includes(overlays.grid));
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
  const colors = overlays.grid.geometry.getAttribute('gridColor');
  const outline = (col: number) => {
    // Grid vertices are laid out column-major, one ring of equal size per hex.
    const index = col * colors.count / 3;
    return { color: new THREE.Color(colors.getX(index), colors.getY(index), colors.getZ(index)), opacity: colors.getW(index) };
  };
  assert.ok(rings.every(ring => !ring.visible), 'plain outlines come from the shared grid');
  for (const [col, ground] of [[0, 0xe2e5dc], [1, 0xbad1d1]]) {
    const { color, opacity } = outline(col!), background = new THREE.Color(ground);
    // Far from the cursor the grid keeps GRID_FAR_FACTOR of its strength.
    const line = background.clone().lerp(color, opacity * GRID_FAR_FACTOR);
    assert.ok((luminance(background)+.05)/(luminance(line)+.05) > 1.15, 'distant grid must stay visible on pale terrain');
    const near = background.clone().lerp(color, opacity);
    assert.ok((luminance(background)+.05)/(luminance(near)+.05) > 1.8, 'grid must be visible on pale terrain');
  }
  assert.equal((overlays.grid.material as THREE.Material).depthTest, true, 'grid must not show through units');
  assert.notEqual(outline(0).color.getHex(), outline(2).color.getHex(), 'dark roads retain a light grid');
  overlays.setGridVisible(false);
  assert.equal(overlays.grid.visible, false);
  assert.ok(rings.every(ring => !ring.visible));
  overlays.update({ ...snapshot, legalMoves: [{ col: 0, row: 0 }] });
  assert.equal(outline(0).opacity, 0, 'a highlighted hex is not drawn twice');
  assert.ok(rings[0]!.visible, 'movement remains visible with the base grid off');
  assert.equal(rings[0]!.material.color.getHex(), 0x72e0ab);
  for (const child of overlays.group.children as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>[]) {
    child.geometry.dispose(); child.material.dispose();
  }
});

test('the plain grid fades with distance from its focus but highlights do not', () => {
  const layout = new HexLayout(2, 1);
  const overlays = new TacticalOverlays({ heightAt: () => 0, group: new THREE.Group(), interactiveMeshes: [] }, layout);
  const snapshot = {
    tiles: [{ col: 0, row: 0, terrain: 'plains' }, { col: 1, row: 0, terrain: 'plains' }],
    units: [], selectedUnitId: null, legalMoves: [], legalAttacks: [], marchTargets: [], exploredHexes: [], fogOfWar: false,
  } as unknown as import('../src/types.ts').BattleSnapshot;
  overlays.update(snapshot);
  const material = overlays.grid.material as THREE.Material & { opacityNode: unknown };
  assert.ok(material.opacityNode, 'grid opacity depends on the focus distance');
  assert.equal(overlays.setGridFocus(3, 4), true, 'moving the focus asks for a frame');
  assert.equal(overlays.setGridFocus(3, 4), false, 'an unchanged focus does not');
  overlays.setGridVisible(false);
  assert.equal(overlays.setGridFocus(9, 9), false, 'a hidden grid needs no frame for focus changes');
  overlays.update({ ...snapshot, legalMoves: [{ col: 1, row: 0 }] });
  const ring = overlays.group.children.find(child => child.renderOrder === 10 && child.visible) as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  assert.ok(ring && ring.material.opacity > 0.9, 'movement highlight keeps its own full-strength ring');
  overlays.dispose();
});
