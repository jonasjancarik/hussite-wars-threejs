import assert from 'node:assert/strict';
import test from 'node:test';
import { overlayGeometry } from '../src/overlays.ts';

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
