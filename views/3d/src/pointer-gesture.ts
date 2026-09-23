export const CLICK_MOVEMENT_THRESHOLD = 5;

export interface PointerGesture {
  button: number;
  /** A context menu was requested during this press (right button, or Ctrl-click on a Mac). */
  context: boolean;
  dragged: boolean;
  pointerId: number;
  pointerType: string;
  x: number;
  y: number;
}

export function beginPointerGesture(event: Pick<PointerEvent, "button" | "clientX" | "clientY" | "pointerId" | "pointerType">): PointerGesture {
  return {
    button: event.button,
    context: false,
    dragged: false,
    pointerId: event.pointerId,
    pointerType: event.pointerType,
    x: event.clientX,
    y: event.clientY,
  };
}

export function recordPointerGestureMovement(gesture: PointerGesture, event: Pick<PointerEvent, "clientX" | "clientY">): void {
  if (Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > CLICK_MOVEMENT_THRESHOLD) gesture.dragged = true;
}

export function pointerGestureIsClick(gesture: PointerGesture, event: Pick<PointerEvent, "button" | "clientX" | "clientY" | "pointerId">): boolean {
  return gesture.pointerId === event.pointerId
    && gesture.button === event.button
    && !gesture.dragged
    && Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) <= CLICK_MOVEMENT_THRESHOLD;
}
