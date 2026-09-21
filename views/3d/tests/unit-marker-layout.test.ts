import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { completeDetailMarkerPlacements, layoutUnitMarkers, separateUnitMarkers, markerAt, unitMarkerDimensions } from "../src/unit-marker-layout.ts";

test("detail cards use their own compact visual and hit rectangles on desktop and small viewports", () => {
  const compact = unitMarkerDimensions();
  const details = unitMarkerDimensions(true);
  assert.deepEqual(compact, { width: 64, height: 58 });
  assert.deepEqual(details, { width: 152, height: 114 });
  const anchor = { id: 7, x: 160, y: 140, selected: false };
  const [desktop] = layoutUnitMarkers([anchor], 640, 420, details);
  assert.deepEqual({ left: desktop!.left, top: desktop!.top, width: desktop!.width, height: desktop!.height },
    { left: 84, top: 20, width: 152, height: 114 });
  assert.equal(markerAt([desktop!], 235, 133), 7, "the right edge of the detail card remains selectable");
  assert.equal(markerAt([desktop!], 237, 133), null);
  const [small] = layoutUnitMarkers([anchor], 320, 240, details);
  assert.deepEqual(small, desktop, "a small viewport clips instead of moving the anchored card");
  assert.equal(markerAt([small!], 160, 29), 7);
  assert.equal(markerAt([small!], 85, 29), null, "empty space beside the flag must not intercept map clicks");
});

test("detail mode restores labels that optional separation cannot place", () => {
  const details = unitMarkerDimensions(true);
  const anchors = Array.from({ length: 8 }, (_, id) => ({ id, x: 90, y: 80, selected: id === 5 }));
  const direct = layoutUnitMarkers(anchors, 320, 240, details);
  const separated = separateUnitMarkers(anchors, 320, 240, [], details);
  assert.ok(separated.length < direct.length, "the constrained viewport exhausts nearby detail-card slots");
  assert.equal(completeDetailMarkerPlacements(separated, direct, true).length, anchors.length);
  assert.equal(completeDetailMarkerPlacements(separated, direct, false).length, separated.length);
});

test("camera-near banners paint and receive clicks above far banners as the camera rotates", () => {
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  const anchors = () => [
    { id: 1, x: 100, y: 150, selected: false, depth: new THREE.Vector3(0, 0, 4).project(camera).z },
    { id: 99, x: 100, y: 150, selected: false, depth: new THREE.Vector3(0, 0, -4).project(camera).z },
  ];
  camera.position.set(0, 0, 10); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
  const before = layoutUnitMarkers(anchors(), 320, 250);
  assert.equal(before.at(-1)!.id, 1, "nearer unit wins despite its lower id");
  assert.equal(markerAt(before, 100, 120), 1);
  const selectedFar = layoutUnitMarkers(anchors().map(a => ({ ...a, selected: a.id === 99 })), 320, 250);
  assert.equal(markerAt(selectedFar, 100, 120), 99, "selection remains the explicit exception");
  camera.position.set(0, 0, -10); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
  const after = layoutUnitMarkers(anchors(), 320, 250);
  assert.equal(markerAt(after, 100, 120), 99, "rotation reverses near/far stacking");
  for (const a of before) {
    const b = after.find(b => b.id === a.id)!;
    assert.equal(a.left, b.left);
    assert.equal(a.top, b.top);
  }
});

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
