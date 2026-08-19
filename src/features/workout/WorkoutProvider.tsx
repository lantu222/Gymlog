import React, { createContext, useContext, useEffect, useMemo, useReducer, useRef } from 'react';

import { CardioActivityType, UnitPreference } from '../../types/models';
import { ActiveCardioSession } from '../../lib/cardio';
import { CORE_WORKOUT_TEMPLATE_ID, WORKOUT_TEMPLATES_V1, getWorkoutTemplateById, getWorkoutTemplateSessions } from './workoutCatalog';
import { loadWorkoutBundle, saveWorkoutBundle } from './workoutPersistence';
import { GuidedResumeAnchor, WorkoutExerciseInsertInput, WorkoutHistoryStore, WorkoutPersistenceBundle, WorkoutProgressionOptions, WorkoutRuntimeTemplate, WorkoutSessionRuntime, WorkoutSetEffort } from './workoutTypes';
import {
  WorkoutFeatureState,
  workoutInitialState,
  workoutReducer,
  selectWorkoutSummary,
} from './workoutState';

interface WorkoutContextValue {
  hydrated: boolean;
  isRestoring: boolean;
  templates: typeof WORKOUT_TEMPLATES_V1;
  coreTemplateId: string;
  state: WorkoutFeatureState;
  activeSession: WorkoutSessionRuntime | null;
  history: WorkoutHistoryStore;
  completionSummary: ReturnType<typeof selectWorkoutSummary>;
  startWorkout: (
    templateId: string,
    unitPreference: UnitPreference,
    progression?: WorkoutProgressionOptions,
  ) => void;
  startCustomWorkout: (
    template: WorkoutRuntimeTemplate,
    unitPreference: UnitPreference,
    progression?: WorkoutProgressionOptions,
  ) => void;
  resumeWorkout: () => void;
  finishWorkout: (performedAt?: string) => void;
  discardWorkout: () => void;
  clearCompletedWorkout: () => void;
  clearRestTimer: () => void;
  pauseRestTimer: () => void;
  resumeRestTimer: () => void;
  setActiveExercise: (slotId: string, setIndex?: number) => void;
  expandExercise: (slotId: string) => void;
  collapseExercise: (slotId: string) => void;
  insertExerciseAfter: (afterSlotId: string, exercise: WorkoutExerciseInsertInput) => void;
  updateSetDraft: (slotId: string, setIndex: number, patch: { loadText?: string; repsText?: string }) => void;
  completeSet: (slotId: string, setIndex: number, unitPreference: UnitPreference) => void;
  repeatLastSet: (slotId: string, setIndex: number, unitPreference: UnitPreference) => void;
  undoSet: (slotId: string, setIndex: number) => void;
  addSet: (slotId: string) => void;
  skipExercise: (slotId: string, reason?: string) => void;
  swapExercise: (
    slotId: string,
    exerciseName: string,
    substitutionGroup: string,
    unitPreference: UnitPreference,
  ) => void;
  updateNotes: (slotId: string, notes: string) => void;
  setGuidedStep: (stepIndex: number, anchor?: GuidedResumeAnchor) => void;
  activeCardio: ActiveCardioSession | null;
  startCardio: (activityType: CardioActivityType) => void;
  pauseCardio: () => void;
  resumeCardio: () => void;
  clearCardio: () => void;
  tick: () => void;
}

const WorkoutContext = createContext<WorkoutContextValue | null>(null);

export function WorkoutProvider({ children }: React.PropsWithChildren) {
  const [state, dispatch] = useReducer(workoutReducer, workoutInitialState);
  const hydratedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      dispatch({ type: 'session/markRestoring', payload: { value: true } });
      const bundle = await loadWorkoutBundle();
      if (cancelled) {
        return;
      }
      dispatch({ type: 'session/hydrate', payload: bundle });
      hydratedRef.current = true;
    }

    hydrate();

    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * The clock runs only while something needs one.
   *
   * The condition was `hydratedRef.current` — true from the first load until the
   * app closes — so this dispatched a tick every second for the entire life of
   * the process. With no session running the reducer's only answer is a new
   * state object carrying a new `nowMs`, and a new state object re-renders every
   * child of this provider: the whole app, once a second, on every screen,
   * forever.
   *
   * It was invisible because nothing looked wrong — until a render counter put
   * timestamps on it and they came out exactly one second apart. It is also the
   * answer to the settings lag that survived three earlier fixes: theme and
   * language were never slow, the app was simply always busy.
   */
  const needsClock = state.activeSession?.status === 'active' || Boolean(state.activeCardio);

  useEffect(() => {
    if (!hydratedRef.current || !needsClock) {
      return;
    }

    const interval = setInterval(() => {
      dispatch({ type: 'session/tick', payload: { nowMs: Date.now() } });
    }, 1000);

    return () => clearInterval(interval);
  }, [state.hydrated, needsClock]);

  useEffect(() => {
    if (!state.hydrated) {
      return;
    }

    const bundle: WorkoutPersistenceBundle = {
      activeSession: state.activeSession,
      history: state.history,
      activeCardio: state.activeCardio,
    };
    saveWorkoutBundle(bundle).catch((error) => {
      console.error('Failed to persist workout bundle', error);
    });
  }, [state.activeSession, state.activeCardio, state.hydrated, state.history]);

  const completionSummary = selectWorkoutSummary(state);

  const value = useMemo<WorkoutContextValue>(
    () => ({
      hydrated: state.hydrated,
      isRestoring: state.isRestoring,
      templates: WORKOUT_TEMPLATES_V1,
      coreTemplateId: CORE_WORKOUT_TEMPLATE_ID,
      state,
      activeSession: state.activeSession,
      history: state.history,
      completionSummary,
      startWorkout(templateId, unitPreference, progression) {
        const template = getWorkoutTemplateById(templateId);
        if (!template) {
          return;
        }

        if (state.activeSession && state.activeSession.status === 'active') {
          return;
        }

        dispatch({
          type: 'session/startFromTemplate',
          payload: {
            templateId: template.id,
            sessionOrderIndex: state.history.sessions.length + 1,
            unitPreference,
            progression,
          },
        });
      },
      startCustomWorkout(template, unitPreference, progression) {
        if (state.activeSession && state.activeSession.status === 'active') {
          return;
        }

        dispatch({
          type: 'session/startFromRuntimeTemplate',
          payload: {
            template,
            sessionOrderIndex: state.history.sessions.length + 1,
            unitPreference,
            progression,
          },
        });
      },
      resumeWorkout() {
        if (!state.activeSession) {
          return;
        }
        dispatch({ type: 'session/resume', payload: { session: state.activeSession } });
      },
      finishWorkout(performedAt) {
        dispatch({ type: 'session/finishWorkout', payload: { performedAt } });
      },
      discardWorkout() {
        dispatch({ type: 'session/discardWorkout' });
      },
      clearCompletedWorkout() {
        dispatch({ type: 'session/clearCompletedSession' });
      },
      clearRestTimer() {
        dispatch({ type: 'timer/clear' });
      },
      pauseRestTimer() {
        dispatch({ type: 'timer/pause' });
      },
      resumeRestTimer() {
        dispatch({ type: 'timer/resume', payload: { nowMs: Date.now() } });
      },
      setActiveExercise(slotId, setIndex = 0) {
        dispatch({ type: 'exercise/setActive', payload: { slotId, setIndex } });
      },
      expandExercise(slotId) {
        dispatch({ type: 'exercise/expand', payload: { slotId } });
      },
      collapseExercise(slotId) {
        dispatch({ type: 'exercise/collapse', payload: { slotId } });
      },
      insertExerciseAfter(afterSlotId, exercise) {
        dispatch({ type: 'exercise/insertAfter', payload: { afterSlotId, exercise } });
      },
      updateSetDraft(slotId, setIndex, patch) {
        dispatch({ type: 'set/updateDraft', payload: { slotId, setIndex, patch } });
      },
      completeSet(slotId, setIndex, unitPreference) {
        dispatch({ type: 'set/complete', payload: { slotId, setIndex, nowMs: Date.now(), unitPreference } });
      },
      repeatLastSet(slotId, setIndex, unitPreference) {
        dispatch({ type: 'set/repeatLast', payload: { slotId, setIndex, nowMs: Date.now(), unitPreference } });
      },
      undoSet(slotId, setIndex) {
        dispatch({ type: 'set/undo', payload: { slotId, setIndex } });
      },
      addSet(slotId) {
        dispatch({ type: 'exercise/addSet', payload: { slotId } });
      },
      skipExercise(slotId, reason) {
        dispatch({ type: 'exercise/skip', payload: { slotId, reason } });
      },
      swapExercise(slotId, exerciseName, substitutionGroup, unitPreference) {
        dispatch({ type: 'exercise/swap', payload: { slotId, exerciseName, substitutionGroup, unitPreference } });
      },
      updateNotes(slotId, notes) {
        dispatch({ type: 'exercise/updateNotes', payload: { slotId, notes } });
      },
      setGuidedStep(stepIndex, anchor) {
        dispatch({ type: 'session/setGuidedStep', payload: { stepIndex, anchor } });
      },
      activeCardio: state.activeCardio,
      startCardio(activityType) {
        dispatch({ type: 'cardio/start', payload: { activityType, nowMs: Date.now() } });
      },
      pauseCardio() {
        dispatch({ type: 'cardio/pause', payload: { nowMs: Date.now() } });
      },
      resumeCardio() {
        dispatch({ type: 'cardio/resume', payload: { nowMs: Date.now() } });
      },
      clearCardio() {
        dispatch({ type: 'cardio/clear' });
      },
      tick() {
        dispatch({ type: 'session/tick', payload: { nowMs: Date.now() } });
      },
    }),
    [completionSummary, state],
  );

  return <WorkoutContext.Provider value={value}>{children}</WorkoutContext.Provider>;
}

export function useWorkoutContext() {
  const context = useContext(WorkoutContext);
  if (!context) {
    throw new Error('useWorkoutContext must be used inside WorkoutProvider');
  }
  return context;
}

export function useWorkoutTemplateCatalog() {
  return WORKOUT_TEMPLATES_V1;
}

export function useWorkoutTemplateSessions(templateId: string) {
  return getWorkoutTemplateSessions(templateId);
}
