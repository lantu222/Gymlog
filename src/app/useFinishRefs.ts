import { useRef } from 'react';

import type { AppRoute } from '../navigation/routes';

/**
 * The finish machine's refs: where the summary exits to, whether a summary is
 * on its way, a finish in flight, and the sessions already counted complete.
 *
 * Moved verbatim from VinhaApp in App.tsx in the phase-C split (2026-10-01).
 * A hook, not a helper: each is a useRef, and the object a ref hands back is
 * the same one for the component's life — which is what lets the route guard,
 * the back handler and the finish handlers, some above VinhaApp's early return
 * and some below it, share one flag. VinhaApp calls this exactly where the
 * lines stood (after exerciseBrowserItems, ahead of
 * workoutLogNavigationAllowedAtRef), so every hook keeps its slot, and passes
 * the four on to every reader. "See handleConfirmFinishWorkout" now points at
 * src/app/finishSaves.tsx.
 */
export function useFinishRefs() {
  const summaryExitRouteRef = useRef<AppRoute | null>(null);
  const summaryNavigationPendingRef = useRef(false);
  /** A finish that has started and not yet settled. See handleConfirmFinishWorkout. */
  const finishInFlightRef = useRef(false);
  /** Sessions whose `workout_completed` has been sent. See handleConfirmFinishWorkout. */
  const completionCountedRef = useRef(new Set<string>());

  return { summaryExitRouteRef, summaryNavigationPendingRef, finishInFlightRef, completionCountedRef };
}
