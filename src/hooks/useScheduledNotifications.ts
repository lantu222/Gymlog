/**
 * Keeps the OS's pending notifications in step with the app's data.
 *
 * Re-plans whenever anything the plan depends on moves — a preference, a saved
 * session, a language switch — and again whenever the app comes back to the
 * foreground, which rolls the reminder horizon forward and drops anything the
 * user has since trained through.
 *
 * Syncs are serialised through a promise chain: two overlapping runs would both
 * read the pending list before either had written, and the loser would leave
 * duplicates behind.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import {
  getLastActivityTimestamp,
  getSessionsThisWeek,
  getVolumeThisWeekKg,
} from '../lib/completedSessions';
import { buildNotificationPlan } from '../lib/notificationPlan';
import { findLatestSessionPr } from '../lib/workoutCompletionSummary';
import { AppDatabase } from '../types/models';
import { syncPlannedNotifications } from '../utils/appNotifications';

export function useScheduledNotifications(database: AppDatabase) {
  const { notificationPrefs, appLanguage, setupAvailableDays, trainingBreak } = database.preferences;
  const [foregroundTick, setForegroundTick] = useState(0);
  const queueRef = useRef<Promise<unknown>>(Promise.resolve());

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        setForegroundTick((tick) => tick + 1);
      }
    });
    return () => subscription.remove();
  }, []);

  const signals = useMemo(
    () => ({
      lastSessionAtMs: getLastActivityTimestamp(database),
      weekSessionCount: getSessionsThisWeek(database),
      weekVolumeKg: getVolumeThisWeekKg(database),
      latestPr: findLatestSessionPr({
        workoutSessions: database.workoutSessions,
        exerciseLogs: database.exerciseLogs,
        exerciseTemplates: database.exerciseTemplates,
      }),
      // So this morning's nudge disappears once the scale has been used.
      lastBodyweightAtMs: database.bodyweightEntries.reduce<number | null>((latest, entry) => {
        const at = new Date(entry.recordedAt).getTime();
        return Number.isFinite(at) && (latest === null || at > latest) ? at : latest;
      }, null),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      database.workoutSessions,
      database.cardioSessions,
      database.exerciseLogs,
      database.exerciseTemplates,
      database.bodyweightEntries,
      foregroundTick,
    ],
  );

  const trainingDaysKey = setupAvailableDays.join(',');
  const onTrainingBreak = trainingBreak !== null;
  const prKey = signals.latestPr
    ? `${signals.latestPr.exerciseName}|${signals.latestPr.weightKg}|${signals.latestPr.reps}|${signals.latestPr.achievedAtMs}`
    : '';

  useEffect(() => {
    const plan = buildNotificationPlan({
      nowMs: Date.now(),
      prefs: notificationPrefs,
      language: appLanguage,
      trainingDays: setupAvailableDays,
      onTrainingBreak,
      ...signals,
    });

    queueRef.current = queueRef.current
      .then(() => syncPlannedNotifications(plan))
      .catch(() => undefined);
    // Primitive deps only: the preference object is rebuilt on every save, and
    // depending on its identity would re-arm the alarms for no reason.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    notificationPrefs.pushEnabled,
    notificationPrefs.level,
    notificationPrefs.personalRecords,
    notificationPrefs.weeklySummary,
    notificationPrefs.comebackNudge,
    notificationPrefs.sessionReminders,
    notificationPrefs.reminderTime,
    notificationPrefs.weighInReminder,
    appLanguage,
    trainingDaysKey,
    onTrainingBreak,
    signals.lastSessionAtMs,
    signals.lastBodyweightAtMs,
    signals.weekSessionCount,
    signals.weekVolumeKg,
    prKey,
    foregroundTick,
  ]);
}
