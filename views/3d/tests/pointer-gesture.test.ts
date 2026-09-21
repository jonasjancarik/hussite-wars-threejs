import assert from "node:assert/strict";
import test from "node:test";
import { beginPointerGesture, pointerGestureIsClick, recordPointerGestureMovement } from "../src/pointer-gesture.ts";

test("tap stays a command while drag and cancellation do not", () => {
  const tap = beginPointerGesture({ button: 0, clientX: 20, clientY: 30, pointerId: 1, pointerType: "touch" });
  recordPointerGestureMovement(tap, { clientX: 22, clientY: 32 } as PointerEvent);
  assert.equal(pointerGestureIsClick(tap, { button: 0, clientX: 22, clientY: 32, pointerId: 1 } as PointerEvent), true);
  recordPointerGestureMovement(tap, { clientX: 40, clientY: 50 } as PointerEvent);
  assert.equal(pointerGestureIsClick(tap, { button: 0, clientX: 40, clientY: 50, pointerId: 1 } as PointerEvent), false);
  assert.equal(pointerGestureIsClick(tap, { button: 0, clientX: 22, clientY: 32, pointerId: 2 } as PointerEvent), false);
});
