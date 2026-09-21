import assert from "node:assert/strict";
import test from "node:test";
import { PerformanceTracker, rendererCounters } from "../src/performance.ts";

test("performance diagnostics preserve raw stalls and independent timing percentiles", () => {
  const tracker = new PerformanceTracker();
  tracker.record(10, 2, 4, 6);
  tracker.record(20, 3, 5, 8);
  tracker.record(30, 7, 9, 16);
  tracker.record(400, 260, 280, 540);
  const snapshot = tracker.snapshot();
  assert.equal(snapshot.sampleCount, 3);
  assert.equal(snapshot.medianFrameMs, 20);
  assert.equal(snapshot.p95FrameMs, 30);
  assert.equal(snapshot.longestFrameMs, 400);
  assert.equal(snapshot.stallCount, 1);
  assert.equal(snapshot.medianPreparationMs, 3);
  assert.equal(snapshot.p95PreparationMs, 7);
  assert.equal(snapshot.preparationStallCount, 1);
  assert.equal(snapshot.medianRendererMs, 5);
  assert.equal(snapshot.p95RendererMs, 9);
  assert.equal(snapshot.rendererStallCount, 1);
  assert.equal(snapshot.renderStallCount, 1);
});

test("resume skips only the suspended frame interval and reset clears every metric", () => {
  const tracker = new PerformanceTracker();
  tracker.skipNextFrameInterval();
  tracker.record(900, 3, 4, 7);
  let snapshot = tracker.snapshot();
  assert.equal(snapshot.sampleCount, 0);
  assert.equal(snapshot.longestFrameMs, 0);
  assert.equal(snapshot.medianPreparationMs, 3);
  tracker.record(16, 2, 3, 5);
  assert.equal(tracker.snapshot().sampleCount, 1);
  tracker.reset();
  snapshot = tracker.snapshot();
  assert.deepEqual(Object.values(snapshot), Object.values(snapshot).map(() => 0));
});

test("renderer counters use public Three info and leave unavailable values absent", () => {
  assert.deepEqual(rendererCounters({ info: {
    render: { calls: 7, triangles: 123 }, memory: { geometries: 4, textures: 3 }, programs: [{}, {}],
  } }), { drawCalls: 7, triangles: 123, geometries: 4, textures: 3, programs: 2 });
  assert.deepEqual(rendererCounters({ info: { render: { drawCalls: 5 }, memory: {} } }), { drawCalls: 5 });
});
