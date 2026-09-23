export type WheelIntent = "pan" | "zoom";

/** Events closer together than this belong to one swipe or one wheel spin. */
export const WHEEL_GESTURE_GAP_MS = 220;

export type WheelSample = Pick<WheelEvent, "ctrlKey" | "deltaMode" | "deltaX" | "deltaY"> & { wheelDeltaY?: number };

/**
 * Trackpads and mouse wheels share one event type. A trackpad pinch arrives
 * with ctrlKey and zooms; a two-finger swipe pans. A notched mouse wheel keeps
 * zooming. `previous` is the intent of the ongoing gesture, so a swipe that
 * happens to report a bare vertical delta mid-stream does not flip to zoom.
 */
export function classifyWheel(event: WheelSample, previous: WheelIntent | null): WheelIntent {
  if (event.ctrlKey) return "zoom";
  if (event.deltaMode !== 0) return "zoom"; // line/page deltas only come from wheels
  if (previous) return previous;
  if (event.deltaX !== 0) return "pan";
  // WebKit/Blink report trackpad pixels as exactly -3× the legacy delta;
  // wheel notches use multiples of 120 instead.
  if (event.wheelDeltaY) return event.wheelDeltaY === -3 * event.deltaY ? "pan" : "zoom";
  return Number.isInteger(event.deltaY) ? "zoom" : "pan";
}
