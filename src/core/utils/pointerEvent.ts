/**
 * Fabric hands handlers a `MouseEvent | TouchEvent`. Touch events carry no
 * `button` and no top-level coordinates, so every gesture handler needs this
 * normalisation rather than an unchecked cast to MouseEvent.
 */

export type AnyPointerEvent = MouseEvent | TouchEvent;

export interface NormalizedPointer {
  clientX: number;
  clientY: number;
  /** Mouse button index; touches report 0, matching "primary button". */
  button: number;
  isTouch: boolean;
}

export function normalizePointer(event: AnyPointerEvent): NormalizedPointer | null {
  if (isTouchEvent(event)) {
    const touch = event.touches[0] ?? event.changedTouches[0];
    if (!touch) return null;
    return { clientX: touch.clientX, clientY: touch.clientY, button: 0, isTouch: true };
  }
  return {
    clientX: event.clientX,
    clientY: event.clientY,
    button: event.button,
    isTouch: false,
  };
}

export function isTouchEvent(event: AnyPointerEvent): event is TouchEvent {
  return typeof TouchEvent !== 'undefined' && event instanceof TouchEvent;
}
