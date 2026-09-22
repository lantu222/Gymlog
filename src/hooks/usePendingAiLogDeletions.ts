/**
 * Finishes the coach-log deletes this install still owes.
 *
 * Asks when the app has loaded and every time it comes back to the
 * foreground — the two moments a network that was down is likely to be up
 * again — and hands back the runner, so Reset can ask for its own label at
 * once and learn whether it went. Silent on a retry that fails: the label is
 * still owed and the next foreground asks again.
 *
 * And once more when a label was filed while a request carrying it could
 * still be writing its copy: the delete that ran then missed that copy, and
 * the next foreground may be days away (server audit, 2026-09-21).
 */
import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { forgetAiCoachLog, isAiCoachLiveConfigured, lastAiLogCarriedAt } from '../lib/aiCoachClient';
import { aiLogRetryAt, createAiLogDeletionRunner } from '../lib/aiLogDeletion';

/** Past the moment itself, so a timer that fires a little early still finds the delete final. */
const SETTLE_MARGIN_MS = 1000;

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
      lastCarriedAt: lastAiLogCarriedAt,
      now: () => Date.now(),
    }),
  );

  useEffect(() => {
    if (!input.hydrated) {
      return undefined;
    }
    const at = aiLogRetryAt(input.pending, lastAiLogCarriedAt, Date.now());
    if (at === null) {
      return undefined;
    }
    // The owed list as it stands then: a label taken back into use since is
    // no longer on it, and its copies are the reader's again.
    const timer = setTimeout(() => {
      if (pendingRef.current.length > 0) {
        void run(pendingRef.current);
      }
    }, at - Date.now() + SETTLE_MARGIN_MS);
    return () => clearTimeout(timer);
  }, [input.hydrated, input.pending, run]);

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
