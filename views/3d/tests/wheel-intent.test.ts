import assert from "node:assert/strict";
import test from "node:test";
import { classifyWheel } from "../src/wheel-intent.ts";

const sample = (overrides: Partial<Parameters<typeof classifyWheel>[0]>) =>
  ({ ctrlKey: false, deltaMode: 0, deltaX: 0, deltaY: 0, ...overrides });

test("trackpad pinch zooms and two-finger swipe pans", () => {
  assert.equal(classifyWheel(sample({ ctrlKey: true, deltaY: 2.5 }), "pan"), "zoom");
  assert.equal(classifyWheel(sample({ deltaX: 3, deltaY: 7 }), null), "pan");
  assert.equal(classifyWheel(sample({ deltaY: 4, wheelDeltaY: -12 }), null), "pan");
  assert.equal(classifyWheel(sample({ deltaY: 1.5 }), null), "pan");
});

test("mouse wheel notches keep zooming", () => {
  assert.equal(classifyWheel(sample({ deltaY: 100, wheelDeltaY: -120 }), null), "zoom");
  assert.equal(classifyWheel(sample({ deltaY: 4.000244140625, wheelDeltaY: -120 }), null), "zoom");
  assert.equal(classifyWheel(sample({ deltaMode: 1, deltaY: 3 }), "pan"), "zoom");
  assert.equal(classifyWheel(sample({ deltaY: 100 }), null), "zoom");
});

test("an ongoing gesture keeps its intent", () => {
  assert.equal(classifyWheel(sample({ deltaY: 100, wheelDeltaY: -120 }), "pan"), "pan");
  assert.equal(classifyWheel(sample({ deltaX: 5 }), "zoom"), "zoom");
});
