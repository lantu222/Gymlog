import { useState } from 'react';

import type { CompletionSummaryState } from './workoutCompletionState';

/**
 * Where a finished workout is in its last steps: the save's own state (idle,
 * saving, failed) on the way to the summary, the summary itself once the save
 * has landed, and the rating sheet the way out may raise.
 *
 * Moved verbatim from VinhaApp in App.tsx in the phase-C split (2026-10-01),
 * the interface from App.tsx's top level with it. A hook, not a helper: these
 * are state, and VinhaApp calls this exactly where the lines stood — after
 * historyScrollOffsetRef, ahead of cardioSaving — so every hook keeps its slot.
 * The setters are React's own, stable for the component's life, and the rest
 * of the finish machine reads them from VinhaApp as before.
 */
interface FinishSaveState {
  status: 'idle' | 'saving' | 'error';
  sessionId: string | null;
}

export type { FinishSaveState };

export function useFinishState() {
  const [completionSummary, setCompletionSummary] = useState<CompletionSummaryState | null>(null);
  const [ratingSheetVisible, setRatingSheetVisible] = useState(false);
  const [finishSaveState, setFinishSaveState] = useState<FinishSaveState>({
    status: 'idle',
    sessionId: null,
  });

  return {
    completionSummary,
    setCompletionSummary,
    ratingSheetVisible,
    setRatingSheetVisible,
    finishSaveState,
    setFinishSaveState,
  };
}
