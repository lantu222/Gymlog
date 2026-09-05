import { useEffect, useRef } from 'react';

import { haptics } from '../utils/haptics';

/** How long the grip must be held before the row is picked up. */
export const DRAG_HOLD_MS = 250;
/** Movement this big before the hold lands means the finger was scrolling. */
export const DRAG_HOLD_SLOP = 8;

/**
 * A grip that has to be HELD before it picks anything up.
 *
 * Both reorderable lists — days on the programme page, lifts inside a day —
 * armed on touch. A finger that landed on a grip while scrolling reordered the
 * list instead: "liian helppo vaihtaa päivien järjestystä, tein sen
 * vahingossa" (#bugs 2026-09-05). A quarter of a second is what every other
 * list on the phone asks for, and the haptic tap makes the pickup something
 * you feel rather than something you discover afterwards.
 *
 * Movement before the hold lands CANCELS it rather than starting the drag
 * late: the finger was travelling, so it was a scroll, and the gesture ends in
 * nothing. That costs the scroll — the responder is already captured, and
 * nothing can hand it back mid-gesture — and it buys back an edit nobody meant
 * to make. The two lists share this so they cannot drift apart again; the day
 * list was built to be identical to the lift list in the first place.
 */
export function useDragHold() {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const armed = useRef(false);
  const startY = useRef(0);

  const cancel = () => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };

  // A screen left mid-hold must not pick anything up afterwards.
  useEffect(() => cancel, []);

  return {
    /** Touch landed on the grip. Nothing moves until the hold completes. */
    begin(pageY: number, onPickUp: () => void) {
      startY.current = pageY;
      armed.current = false;
      cancel();
      timer.current = setTimeout(() => {
        timer.current = null;
        armed.current = true;
        haptics.impactLight();
        onPickUp();
      }, DRAG_HOLD_MS);
    },
    /**
     * The finger moved. Returns the travel when the drag is live, and null
     * while it is not — the caller does nothing in that case.
     */
    move(pageY: number): number | null {
      const dy = pageY - startY.current;
      if (armed.current) {
        return dy;
      }
      if (Math.abs(dy) > DRAG_HOLD_SLOP) {
        cancel();
      }
      return null;
    },
    /** Finger lifted or the gesture was taken away. True if it was ever held. */
    end(): boolean {
      cancel();
      const wasArmed = armed.current;
      armed.current = false;
      return wasArmed;
    },
  };
}
