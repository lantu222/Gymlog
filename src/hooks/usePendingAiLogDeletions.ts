/**
 * Finishes the coach-log deletes this install still owes.
 *
 * Asks when the app has loaded and every time it comes back to the
 * foreground — the two moments a network that was down is likely to be up
 * again — and hands back the runner, so Reset can ask for its own label at
 * once and learn whether it went. Silent on a retry that fails: the label is
 * still owed and the next foreground asks again.
 */
import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { forgetAiCoachLog, isAiCoachLiveConfigured } from '../lib/aiCoachClient';
import { createAiLogDeletionRunner } from '../lib/aiLogDeletion';

export function usePendingAiLogDeletions(input: {
  hydrated: boolean;
  pending: readonly string[];
  clear: (deleted: readonly string[]) => Promise<void>;
}) {
  const pendingRef = useRef(input.pending);
  pendingRef.current = input.pending;
  const clearRef = useRef(input.clear);
  clearRef.current = input.clear;

  const [run] = useState(() =>
    createAiLogDeletionRunner({
      live: isAiCoachLiveConfigured(),
      forget: forgetAiCoachLog,
      onDeleted: (deleted) => clearRef.current(deleted),
    }),
  );

  useEffect(() => {
    if (!input.hydrated) {
      return undefined;
    }
    const retry = () => {
      if (pendingRef.current.length > 0) {
        void run(pendingRef.current);
      }
    };
    retry();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        retry();
      }
    });
    return () => subscription.remove();
  }, [input.hydrated, run]);

  return run;
}
