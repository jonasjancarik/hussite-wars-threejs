import assert from "node:assert/strict";
import test from "node:test";
import { layoutUnitMarkers, markerAt } from "../src/unit-marker-layout.ts";

test("nearby banners do not overlap and remain inside the viewport", () => {
  const anchors = Array.from({ length: 6 }, (_, id) => ({ id, x: 130 + id * 20, y: 250, selected: id === 3 }));
  const placements = layoutUnitMarkers(anchors, 420, 400);
  assert.equal(placements.length, anchors.length);
  for (const a of placements) {
    assert.ok(a.left >= 0 && a.top >= 0 && a.left + a.width <= 420 && a.top + a.height <= 400);
    for (const b of placements) if (a.id !== b.id) {
      assert.ok(a.left + a.width <= b.left || b.left + b.width <= a.left
        || a.top + a.height <= b.top || b.top + b.height <= a.top);
    }
  }
});

test("selected banner stays present in a crowd, independent of snapshot order", () => {
  const anchors = Array.from({ length: 30 }, (_, id) => ({ id, x: 160, y: 140, selected: id === 29 }));
  const result = layoutUnitMarkers(anchors, 320, 250);
  assert.ok(result.some(marker => marker.id === 29));
  assert.deepEqual(layoutUnitMarkers(anchors.reverse(), 320, 250), result);
});

test("clicks select only the visible marker at the displayed position", () => {
  const result = layoutUnitMarkers([{ id: 7, x: 100, y: 180, selected: false }], 320, 250);
  const marker = result[0]!;
  assert.equal(markerAt(result, marker.left + 10, marker.top + 10), 7);
  assert.equal(markerAt(result, 300, 240), null);
  assert.equal(markerAt([], marker.left + 10, marker.top + 10), null);
});

test("small or empty surfaces never produce invalid positions", () => {
  const anchors = [{ id: 1, x: 0, y: 0, selected: true }];
  assert.deepEqual(layoutUnitMarkers(anchors, 0, 0), []);
  assert.deepEqual(layoutUnitMarkers(anchors, 50, 50), []);
});

test("markers avoid camera controls without changing their click target", () => {
  const toolbar = { left: 50, top: 0, width: 350, height: 64 };
  const result = layoutUnitMarkers([{ id: 1, x: 200, y: 110, selected: false }], 480, 360, [toolbar]);
  assert.equal(result.length, 1);
  const marker = result[0]!;
  assert.ok(marker.top >= toolbar.top + toolbar.height || marker.left + marker.width <= toolbar.left
    || marker.left >= toolbar.left + toolbar.width);
  assert.equal(markerAt(result, marker.left + 15, marker.top + 15), 1);
});
