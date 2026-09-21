import assert from "node:assert/strict";
import test from "node:test";
import { layoutUnitMarkers, separateUnitMarkers, markerAt } from "../src/unit-marker-layout.ts";

test("small camera changes move every banner by exactly its anchor movement", () => {
  const anchors = Array.from({ length: 12 }, (_, id) => ({ id, x: 150 + id, y: 200 + id, selected: id === 3 }));
  const before = layoutUnitMarkers(anchors, 420, 400);
  const after = layoutUnitMarkers(anchors.map(a => ({ ...a, x: a.x + .25, y: a.y - .4 })), 420, 400);
  for (const a of before) {
    const b = after.find(b => b.id === a.id)!;
    assert.ok(Math.abs(b.left - a.left - .25) < 1e-9);
    assert.ok(Math.abs(b.top - a.top + .4) < 1e-9);
  }
});

test("overlapping banners remain visible and selection only changes stacking", () => {
  const anchors = Array.from({ length: 30 }, (_, id) => ({ id, x: 160, y: 140, selected: id === 4 }));
  const result = layoutUnitMarkers(anchors, 320, 250);
  assert.equal(result.length, 30);
  assert.equal(result.at(-1)!.id, 4);
  assert.equal(markerAt(result, 160, 100), 4);
  const changed = layoutUnitMarkers(anchors.map(a => ({ ...a, selected: a.id === 9 })), 320, 250);
  for (const a of result) {
    const b = changed.find(b => b.id === a.id)!;
    assert.equal(b.left, a.left);
    assert.equal(b.top, a.top);
  }
  assert.equal(markerAt(changed, 160, 100), 9);
  assert.deepEqual(layoutUnitMarkers(anchors.reverse(), 320, 250), result);
});

test("crossing screen rows does not shuffle banners or their overlap priority", () => {
  const a = { id: 1, x: 150, y: 200, selected: false };
  const b = { id: 2, x: 151, y: 200.1, selected: false };
  const before = layoutUnitMarkers([a, b], 320, 250);
  const after = layoutUnitMarkers([a, { ...b, y: 199.9 }], 320, 250);
  assert.deepEqual(after[0], before[0]);
  assert.equal(markerAt(before, 150, 180), 2);
  assert.equal(markerAt(after, 150, 180), 2);
});

test("viewport edges clip banners instead of relocating them", () => {
  const anchors = [{ id: 1, x: 10, y: 20, selected: true }];
  const [marker] = layoutUnitMarkers(anchors, 320, 250);
  assert.equal(marker!.left, -22);
  assert.equal(marker!.top, -44);
  assert.deepEqual(layoutUnitMarkers(anchors, 0, 0), []);
  assert.equal(markerAt([], 10, 10), null);
});

test("optional separation avoids overlaps and controls without changing the default anchors", () => {
  const anchors = Array.from({ length: 5 }, (_, id) => ({ id, x: 130 + id * 20, y: 250, selected: id === 3 }));
  const direct = layoutUnitMarkers(anchors, 420, 400);
  const separated = separateUnitMarkers(anchors, 420, 400, [{ left: 0, top: 0, width: 420, height: 60 }]);
  assert.equal(separated.length, anchors.length);
  assert.equal(separated.at(-1)!.id, 3);
  for (const a of separated) {
    assert.ok(a.top >= 60);
    for (const b of separated) if (a.id !== b.id) {
      assert.ok(a.left + a.width <= b.left || b.left + b.width <= a.left
        || a.top + a.height <= b.top || b.top + b.height <= a.top);
    }
  }
  assert.deepEqual(layoutUnitMarkers(anchors, 420, 400), direct);
});
