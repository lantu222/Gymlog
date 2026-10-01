import type { Dispatch, MutableRefObject, SetStateAction } from 'react';

import { trackEvent } from '../features/analytics/analyticsClient';
import { adaptCompletedWorkoutSessionForAppDatabase } from '../features/workout/workoutAppAdapter';
import type { useWorkoutContext } from '../features/workout/WorkoutProvider';
import type { FreestyleFinishSummary } from '../lib/emptyWorkoutSession';
import { t } from '../lib/i18n';
import { createId } from '../lib/ids';
import { computePostSessionInsight } from '../lib/postSessionInsight';
import { buildMuscleFocus, getVolumeDeltaVsPrevious } from '../lib/workoutCompleteView';
import { ROOT_ROUTES } from '../navigation/routes';
import type { AppRoute } from '../navigation/routes';
import type { useAppContext } from '../state/AppProvider';
import type { WorkoutTemplateDraft } from '../types/models';
import {
  buildCompletionCardsFromAdaptedSession,
  buildExerciseLogsForCompletedSession,
  buildSessionMovement,
  CompletionSummaryState,
} from './workoutCompletionState';
import type { FinishSaveState } from './useFinishState';

type AppContextValue = ReturnType<typeof useAppContext>;
type WorkoutContextValue = ReturnType<typeof useWorkoutContext>;

/**
 * The finish saves: the guided session's Finish and its discard, and the
 * logged (freestyle and editor) session's save. Each writes first and only
 * then shows the summary — CLAUDE.md's "a success state must follow the
 * resolved write".
 *
 * Moved verbatim from VinhaApp in App.tsx in the phase-C split (2026-10-01),
 * each with its comments. A per-render factory, not a hook: it holds no state
 * and calls no hook (the refs it reads are VinhaApp's, from useFinishRefs).
 * VinhaApp calls it on every render where finishLoggedWorkoutSave stood, just
 * below the launch screen's early return, so each handler is still a fresh
 * closure over that render's values. handleDiscardWorkout and
 * handleConfirmFinishWorkout were function declarations further up; they come
 * down to this call because handleConfirmFinishWorkout reads exercisePrLookup,
 * which VinhaApp declares after their old place. Nothing in App.tsx above the
 * call names either: their one use is the workout tab's render, below it.
 *
 * .tsx only because the context types come from src/state/AppProvider.tsx and
 * src/features/workout/WorkoutProvider.tsx; no .ts module imports this file.
 */
export interface FinishSavesDeps {
  workout: Pick<
    WorkoutContextValue,
    'activeSession' | 'discardWorkout' | 'finishWorkout' | 'clearCompletedWorkout' | 'recordLoggedWorkout'
  >;
  database: AppContextValue['database'];
  preferences: AppContextValue['preferences'];
  unitPreference: AppContextValue['unitPreference'];
  exerciseLibrary: AppContextValue['exerciseLibrary'];
  updatePreferences: AppContextValue['updatePreferences'];
  saveCompletedWorkoutSession: AppContextValue['saveCompletedWorkoutSession'];
  upsertWorkoutTemplate: AppContextValue['upsertWorkoutTemplate'];
  deleteWorkoutTemplate: AppContextValue['deleteWorkoutTemplate'];
  /** From useCustomProgramViews: each lift's best so far, for the summary's record cards. */
  exercisePrLookup: Parameters<typeof buildCompletionCardsFromAdaptedSession>[0]['exercisePrLookup'];
  setCompletionSummary: Dispatch<SetStateAction<CompletionSummaryState | null>>;
  setFinishSaveState: Dispatch<SetStateAction<FinishSaveState>>;
  finishInFlightRef: MutableRefObject<boolean>;
  completionCountedRef: MutableRefObject<Set<string>>;
  summaryNavigationPendingRef: MutableRefObject<boolean>;
  summaryExitRouteRef: MutableRefObject<AppRoute | null>;
  /** VinhaApp's hoisted helpers. */
  getWorkoutLoggerFallbackRoute: () => AppRoute;
  navigateBack: (fallback?: AppRoute | null) => void;
  replaceRoute: (nextRoute: AppRoute) => void;
  showToast: (message: string) => void;
}

export function createFinishSaves(deps: FinishSavesDeps) {
  const {
    workout,
    database,
    preferences,
    unitPreference,
    exerciseLibrary,
    updatePreferences,
    saveCompletedWorkoutSession,
    upsertWorkoutTemplate,
    deleteWorkoutTemplate,
    exercisePrLookup,
    setCompletionSummary,
    setFinishSaveState,
    finishInFlightRef,
    completionCountedRef,
    summaryNavigationPendingRef,
    summaryExitRouteRef,
    getWorkoutLoggerFallbackRoute,
    navigateBack,
    replaceRoute,
    showToast,
  } = deps;

  async function handleDiscardWorkout() {
    if (!workout.activeSession) {
      return;
    }

    const fallbackRoute = getWorkoutLoggerFallbackRoute();
    await updatePreferences({ trainingFirstRunDismissed: true });
    workout.discardWorkout();
    setFinishSaveState({ status: 'idle', sessionId: null, message: null });
    navigateBack(fallbackRoute);
  }

  async function handleConfirmFinishWorkout() {
    const activeSession = workout.activeSession;
    // A ref, not `finishSaveState`: two taps inside one render both read the
    // state as idle, and each went on to save and finish.
    if (!activeSession || finishInFlightRef.current) {
      return;
    }

    const adaptedSession = adaptCompletedWorkoutSessionForAppDatabase(activeSession);
    if (adaptedSession.logs.length === 0) {
      await handleDiscardWorkout();
      return;
    }

    finishInFlightRef.current = true;
    setFinishSaveState({
      status: 'saving',
      sessionId: adaptedSession.sessionId,
      message: null,
    });

    try {
      const summary = await saveCompletedWorkoutSession({
        ...adaptedSession,
        performedAt: adaptedSession.performedAt,
      });
      if (!summary.sessionId || !summary.performedAt) {
        throw new Error('Workout save did not produce a valid summary');
      }
      // Once per session. A write after this one can fail — the preferences
      // below — and the retry saves again, which hands back the session
      // already stored: counted on every pass, one workout was two
      // (analytics audit, 2026-09-21).
      if (!completionCountedRef.current.has(adaptedSession.sessionId)) {
        completionCountedRef.current.add(adaptedSession.sessionId);
        trackEvent('workout_completed');
      }

      // Only after the database save is verified: finishing flips the session
      // to 'completed' and stamps slot history. Doing it before the save meant
      // a failed save stranded the session in a state resume would not pick up
      // — the logged sets were gone on the next launch (launch-scope Risk 1).
      workout.finishWorkout(adaptedSession.performedAt);

      const sessionExerciseLogs = buildExerciseLogsForCompletedSession(adaptedSession.sessionId, adaptedSession.logs);
      const insight = computePostSessionInsight(
        {
          completedSession: {
            id: adaptedSession.sessionId,
            performedAt: summary.performedAt,
            totalVolumeKg: summary.totalVolume,
            setsCompleted: summary.setsCompleted,
          },
          sessionExerciseLogs,
          allPriorSessions: database.workoutSessions,
          allPriorExerciseLogs: database.exerciseLogs,
          lastInsightSessionId: preferences.lastInsightSessionId,
          lastInsightType: preferences.lastInsightType,
          unitPreference,
        },
        new Date(summary.performedAt),
      );

      await updatePreferences({
        trainingFirstRunDismissed: true,
        ...(insight
          ? {
              lastInsightSessionId: adaptedSession.sessionId,
              lastInsightType: insight.type,
            }
          : {}),
      });
      const completionCards = buildCompletionCardsFromAdaptedSession({
        exercises: adaptedSession.exercises,
        exerciseTemplates: database.exerciseTemplates,
        exerciseLibrary,
        exercisePrLookup,
        language: preferences.appLanguage,
      });
      setCompletionSummary({
        sessionId: adaptedSession.sessionId,
        workoutName: adaptedSession.workoutNameSnapshot,
        performedAt: summary.performedAt,
        durationMinutes: summary.durationMinutes,
        setsCompleted: summary.setsCompleted,
        totalVolume: summary.totalVolume,
        // The tile counts lifts that were done: the save's own count, by the
        // rule History reads the same logs with (lib/sessionTotals), so this
        // tile and the session's History row cannot disagree. The cards below
        // agree too — a card with a completed set is a log the rule counts.
        // Not summary.exercisesLogged, which is every persisted entry, skipped
        // included: "6 LIIKETTÄ" above five rows of "0 sarjaa" was that number.
        exercisesLogged: summary.exercisesCompleted,
        volumeDeltaKg: getVolumeDeltaVsPrevious(
          {
            sessionId: adaptedSession.sessionId,
            workoutName: adaptedSession.workoutNameSnapshot,
            performedAt: summary.performedAt,
            totalVolumeKg: summary.totalVolume,
          },
          database.workoutSessions,
        ),
        muscles: buildMuscleFocus(adaptedSession.exercises, exerciseLibrary),
        exerciseCards: completionCards.exerciseCards,
        prCards: completionCards.prCards,
        // Read from the persisted logs. The builder excludes this session by
        // id, so "last time" cannot mean today whether or not the save has
        // already landed in the snapshot this closure holds.
        ...buildSessionMovement({
          exercises: adaptedSession.exercises,
          exerciseLogs: database.exerciseLogs,
          workoutSessions: database.workoutSessions,
          sessionId: adaptedSession.sessionId,
          language: preferences.appLanguage,
          unitPreference,
        }),
        insight,
      });
      summaryNavigationPendingRef.current = true;
      // Finish on the completion screen returns Home. Set the exit route so the
      // summary-dismiss effect can't race onDone's navigation to WORKOUT_PLAN_ROUTE.
      summaryExitRouteRef.current = ROOT_ROUTES.home;
      workout.clearCompletedWorkout();
      replaceRoute({ tab: 'workout', screen: 'summary' });
      setFinishSaveState({ status: 'idle', sessionId: null, message: null });
    } catch (error) {
      console.error('Failed to save completed workout', error);
      setFinishSaveState({
        status: 'error',
        sessionId: adaptedSession.sessionId,
        message: 'Could not save this workout. Try again before leaving the screen.',
      });
      showToast(t(preferences.appLanguage, 'toast.saveWorkoutFailed'));
    } finally {
      finishInFlightRef.current = false;
    }
  }

  // Shared finish path for logged one-off sessions (freestyle + editor):
  // template first, then the completed session, and only then the summary
  // screen — a failed save must leave the logger open with its sets intact.
  const finishLoggedWorkoutSave = async (draft: WorkoutTemplateDraft, summary: FreestyleFinishSummary) => {
    const workoutTemplateId = await upsertWorkoutTemplate(draft);
    const sessionId = createId('session');
    try {
      await saveCompletedWorkoutSession({
        sessionId,
        workoutTemplateId,
        workoutNameSnapshot: summary.workoutName,
        logs: summary.logs,
        startedAt: summary.startedAt,
        performedAt: summary.performedAt,
      });
    } catch (error) {
      // The template is written first so the session can name it. A session
      // that did not land must not leave the template behind — the retry made
      // a second one (audit round 4, 2026-09-20). Best effort: the failure
      // the reader hears about is the save.
      await deleteWorkoutTemplate(workoutTemplateId).catch(() => undefined);
      throw error;
    }
    // Counted once it is on disk, as the guided path counts it.
    trackEvent('workout_completed');
    /**
     * Remembered for the next time these lifts come up.
     *
     * The weight a set opens on is read from the workout provider's slot
     * history, and the only thing that ever wrote to it was the guided
     * player's own finish — so a lift done here left no trace, and opened at
     * nothing next time even though the numbers had just been written to the
     * database ("paino automaattisesti siihen mitä on viimeksi tehnyt", #bugs
     * 2026-08-27). Only completed sets with both numbers: a row that was put
     * on the board and not done is not a weight.
     */
    workout.recordLoggedWorkout({
      performedAt: summary.performedAt,
      sessionId,
      templateName: summary.workoutName,
      exercises: summary.logs.map((log) => ({
        exerciseName: log.exerciseNameSnapshot,
        sets: log.sets
          .filter((set) => set.outcome === 'completed' && set.reps > 0)
          .map((set, setIndex) => ({
            setIndex,
            loadKg: set.weight,
            reps: set.reps,
            completedAt: set.completedAt ?? summary.performedAt,
          })),
      })),
    });
    setCompletionSummary({
      sessionId,
      ...summary,
      // Freestyle sessions have no plan identity: no previous-session
      // comparison, and muscle focus comes from the logged drafts.
      volumeDeltaKg: null,
      muscles: buildMuscleFocus(
        summary.logs.map((log) => ({
          exerciseName: log.exerciseNameSnapshot,
          sets: log.sets.map((set) => ({
            status: set.outcome === 'completed' ? ('completed' as const) : ('skipped' as const),
            weightKg: set.weight,
            reps: set.reps,
          })),
        })),
        exerciseLibrary,
      ),
      // A freestyle session has no plan identity, and the comparison this
      // screen makes is "against the last time you trained this lift" — a
      // claim the empty-workout flow does not gather the history for.
      whatMoved: [],
      movementById: {},
      insight: null,
    });
    summaryExitRouteRef.current = ROOT_ROUTES.home;
    replaceRoute({ tab: 'workout', screen: 'summary' });
  };

  return { handleDiscardWorkout, handleConfirmFinishWorkout, finishLoggedWorkoutSave };
}
