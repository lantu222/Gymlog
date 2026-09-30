import { useEffect, useMemo, useRef } from 'react';
import * as Notifications from 'expo-notifications';

import { emitRestAction } from '../hooks/useRestEndAlert';
import { IDLE_NUDGE_MINUTES, idleNudgeAtMs } from '../lib/restSchedule';
import {
  ACTION_EXTEND_30,
  ACTION_EXTEND_60,
  ACTION_FINISH,
  ACTION_SKIP_REST,
  ACTION_STILL_GOING,
  SESSION_NOTIFICATION_MARKER,
  cancelIdleNudge,
  clearAllSessionNotifications,
  scheduleIdleNudge,
  setupSessionNotifications,
} from '../utils/sessionNotifications';
import { formatWorkoutDisplayLabel } from '../lib/displayLabel';
import { t } from '../lib/i18n';
import { localizeSessionName } from '../lib/sessionNameLabel';
import type { WorkoutFeatureState } from '../features/workout/workoutState';
import type { AppPreferences } from '../types/models';

/**
 * The background timer's app-level half: the lock-screen action listener,
 * clearing the shade when a session ends, the session's buttons in the
 * reader's language, the idle nudge, and the one toast for a session restored
 * after a cold start.
 *
 * Moved verbatim from VinhaApp in App.tsx in the phase-B split (2026-09-30).
 * A hook, not a helper: these are effects with the app shell's lifetime, and
 * VinhaApp calls this exactly where the lines stood — after
 * useScheduledNotifications, before usePendingAiLogDeletions — so every hook
 * keeps its slot and the five effects register in the same order as before,
 * the lock-screen listener still ahead of the planner-tap listener further
 * down App.tsx.
 *
 * In the moved comments below, "here", "this file", "above" and "below" mean
 * App.tsx. The two refs start as no-ops and are returned for VinhaApp to fill
 * on every render, where navigateToActiveWorkout exists.
 */
export interface SessionNotificationsDeps {
  /** The workout context: the live session, and whether its store has loaded. */
  workout: Pick<WorkoutFeatureState, 'activeSession' | 'hydrated'>;
  /** The reader's preferences: the app language and the idle-nudge switch. */
  preferences: AppPreferences;
  /** VinhaApp's showToast: a hoisted function declaration, so it exists at the call. */
  showToast: (message: string) => void;
}

export function useSessionNotifications(deps: SessionNotificationsDeps) {
  const { workout, preferences, showToast } = deps;

  /* ---------------- Background timer: the app-level half ---------------- */
  // The rest ladder and the ongoing card are owned by the screen that holds the
  // rest (useRestEndAlert). What belongs here is everything that outlives a
  // screen: lock-screen action responses, the idle nudge, cleanup when the
  // session ends, and the truth about a session restored after a cold start.

  const activeSessionId = workout.activeSession?.sessionId ?? null;
  const activeSessionStatus = workout.activeSession?.status ?? null;
  const navigateToActiveWorkoutRef = useRef<() => boolean>(() => false);
  const finishFromNotificationRef = useRef<() => void>(() => {});

  // Lock-screen actions. Every action opens the app; the running rest is then
  // told over the bus, because it lives in screen state.
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data ?? {};
      if (data[SESSION_NOTIFICATION_MARKER] !== true) {
        return;
      }
      const action = response.actionIdentifier;
      // Bring the session to the front first; the screen that owns the rest
      // mounts its bus listener on render.
      navigateToActiveWorkoutRef.current();
      setTimeout(() => {
        if (action === ACTION_EXTEND_30) {
          emitRestAction({ kind: 'extend', seconds: 30 });
        } else if (action === ACTION_EXTEND_60) {
          emitRestAction({ kind: 'extend', seconds: 60 });
        } else if (action === ACTION_SKIP_REST) {
          emitRestAction({ kind: 'skip' });
        } else if (action === ACTION_FINISH) {
          finishFromNotificationRef.current();
        } else if (action === ACTION_STILL_GOING) {
          // Handled by the idle effect below: opening the app counts as activity.
        }
      }, 350);
    });
    return () => subscription.remove();
  }, []);

  // Session ended or was discarded: nothing of ours stays in the shade.
  useEffect(() => {
    if (!activeSessionId || activeSessionStatus !== 'active') {
      void clearAllSessionNotifications();
    }
  }, [activeSessionId, activeSessionStatus]);

  // The session's buttons in the reader's language, from here as well as from
  // the workout screens: the idle nudge is armed here, and its buttons were
  // whatever language the player last registered — or the one the app had
  // started in, before the registration learned to follow a switch.
  useEffect(() => {
    if (activeSessionId && activeSessionStatus === 'active') {
      void setupSessionNotifications(preferences.appLanguage);
    }
  }, [activeSessionId, activeSessionStatus, preferences.appLanguage]);

  // The idle nudge: 25 minutes after the last logged set, one question. Keyed
  // on the count of completed sets so every logged set pushes it forward, and
  // on the app coming to the foreground, which also counts as being there.
  //
  // Its own switch and the OS permission decide it, and nothing else: the
  // phone's Notifications switch governs the scheduled reminders (user
  // 2026-09-17), and a training break silences only those — a reader who is
  // in a session is training, and wants its alerts.
  const completedSetCount = useMemo(
    () =>
      (workout.activeSession?.exercises ?? []).reduce(
        (sum, exercise) => sum + exercise.sets.filter((set) => set.status === 'completed').length,
        0,
      ),
    [workout.activeSession?.exercises],
  );
  useEffect(() => {
    if (!activeSessionId || activeSessionStatus !== 'active' || !preferences.notificationPrefs.idleNudge) {
      void cancelIdleNudge();
      return;
    }
    const language = preferences.appLanguage;
    const sessionName = localizeSessionName(
      formatWorkoutDisplayLabel(workout.activeSession?.templateName ?? ''),
      language,
    );
    void scheduleIdleNudge({
      atMs: idleNudgeAtMs(Date.now()),
      title: t(language, 'rest.notify.idleTitle', { minutes: IDLE_NUDGE_MINUTES }),
      body: t(language, 'rest.notify.idleBody', { session: sessionName, done: completedSetCount }),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSessionId, activeSessionStatus, completedSetCount, preferences.notificationPrefs.idleNudge, preferences.appLanguage]);

  // After a cold start the session comes back from stored timestamps: elapsed
  // is real and a rest that expired meanwhile is already resolved. Say so once.
  const restoredToastShownRef = useRef(false);
  useEffect(() => {
    if (!workout.hydrated || restoredToastShownRef.current) {
      return;
    }
    restoredToastShownRef.current = true;
    if (workout.activeSession?.status === 'active') {
      showToast(t(preferences.appLanguage, 'rest.notify.restoredToast'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workout.hydrated]);

  return { navigateToActiveWorkoutRef, finishFromNotificationRef };
}
