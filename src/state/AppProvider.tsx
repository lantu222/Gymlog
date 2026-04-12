import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { createEmptyDatabase } from '../data/seed';
import { createId } from '../lib/ids';
import { buildWorkoutTemplateSessions } from '../lib/workoutTemplateSessions';
import { persistCompletedWorkoutSessionToDatabase, PersistCompletedWorkoutInput, SessionSaveSummary } from './completedWorkoutPersistence';
import {
  getBodyweightProgress,
  getLatestLogForTemplateExercise,
  getTrackedExerciseProgress,
} from '../lib/progression';
import { loadDatabase, resetDatabase, saveDatabase } from '../storage/database';
import {
  bodyweightRepository,
  exerciseLogRepository,
  exerciseTemplateRepository,
  workoutPlanRepository,
  workoutSessionRepository,
  workoutTemplateRepository,
} from '../storage/repositories';
import {
  AppDatabase,
  AppPreferences,
  BodyweightEntry,
  ExerciseLogDraft,
  ExerciseTemplate,
  UnitPreference,
  WorkoutTemplateDraft,
  WorkoutTemplateSessionDraft,
  WorkoutTemplateSessionWithExercises,
} from '../types/models';

interface AppContextValue {
  database: AppDatabase;
  hydrated: boolean;
  preferences: AppPreferences;
  unitPreference: UnitPreference;
  workoutTemplates: AppDatabase['workoutTemplates'];
  workoutPlans: AppDatabase['workoutPlans'];
  exerciseLibrary: AppDatabase['exerciseLibrary'];
  workoutSessions: AppDatabase['workoutSessions'];
  bodyweightEntries: AppDatabase['bodyweightEntries'];
  trackedProgress: ReturnType<typeof getTrackedExerciseProgress>;
  bodyweightProgress: ReturnType<typeof getBodyweightProgress>;
  getWorkoutExercises: (workoutTemplateId: string) => ExerciseTemplate[];
  getWorkoutTemplateSessions: (workoutTemplateId: string) => WorkoutTemplateSessionWithExercises[];
  getWorkoutLastCompletedAt: (workoutTemplateId: string) => string | undefined;
  getLatestTemplateLog: (exerciseTemplateId: string) => ReturnType<typeof getLatestLogForTemplateExercise>;
  getSessionLogs: (sessionId: string) => AppDatabase['exerciseLogs'];
  setUnitPreference: (nextUnit: UnitPreference) => Promise<void>;
  updatePreferences: (patch: Partial<AppPreferences>) => Promise<void>;
  completeOnboarding: (patch?: Partial<AppPreferences>) => Promise<void>;
  upsertWorkoutTemplate: (draft: WorkoutTemplateDraft) => Promise<string>;
  renameWorkoutTemplate: (workoutTemplateId: string, nextName: string) => Promise<void>;
  deleteWorkoutTemplate: (workoutTemplateId: string) => Promise<void>;
  saveWorkoutSession: (
    workoutTemplateId: string,
    logs: ExerciseLogDraft[],
    startedAt?: string,
  ) => Promise<SessionSaveSummary>;
  saveCompletedWorkoutSession: (input: PersistCompletedWorkoutInput) => Promise<SessionSaveSummary>;
  addBodyweightEntry: (weightKg: number, recordedAt?: string) => Promise<void>;
  resetAllData: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

function normalizeDraftSessions(draft: WorkoutTemplateDraft): WorkoutTemplateSessionDraft[] {
  if (Array.isArray(draft.sessions) && draft.sessions.length > 0) {
    return draft.sessions;
  }

  return [
    {
      name: draft.name.trim() || 'Session 1',
      exercises: Array.isArray(draft.exercises) ? draft.exercises : [],
    },
  ];
}

export function AppProvider({ children }: React.PropsWithChildren) {
  const [database, setDatabase] = useState<AppDatabase>({
    workoutTemplates: [],
    exerciseTemplates: [],
    workoutPlans: [],
    exerciseLibrary: [],
    workoutSessions: [],
    exerciseLogs: [],
    bodyweightEntries: [],
    preferences: {
      appLanguage: 'en',
      unitPreference: 'kg',
      theme: 'dark',
      defaultRestSeconds: 120,
      autoFocusNextInput: true,
      keepScreenAwakeDuringWorkout: false,
      adaptiveCoachPremiumUnlocked: false,
      entryFlowCompleted: false,
      selectedSignInMethod: null,
      selectedAccessTier: null,
      bodyweightGoalKg: null,
      onboardingCompleted: false,
      setupCompleted: false,
      setupGender: null,
      setupAge: null,
      setupAgeRange: null,
      setupGoal: null,
      setupLevel: null,
      setupDaysPerWeek: null,
      setupEquipment: null,
      setupSecondaryOutcomes: [],
      setupFocusAreas: [],
      setupGuidanceMode: null,
      setupScheduleMode: null,
      setupWeeklyMinutes: null,
      setupAvailableDays: [],
      setupTrainingFeel: 'challenging',
      setupWorkoutVariety: 'balanced',
      setupFreeWeightsPreference: 'neutral',
      setupBodyweightPreference: 'neutral',
      setupMachinesPreference: 'neutral',
      setupShoulderFriendlySwaps: 'neutral',
      setupElbowFriendlySwaps: 'neutral',
      setupKneeFriendlySwaps: 'neutral',
      recommendedProgramId: null,
      dismissedTipIds: [],
      activePlanId: null,
    },
  });
  const [hydrated, setHydrated] = useState(false);
  const databaseRef = useRef(database);

  useEffect(() => {
    databaseRef.current = database;
  }, [database]);

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      try {
        const nextDatabase = await loadDatabase();
        if (cancelled) {
          return;
        }

        databaseRef.current = nextDatabase;
        setDatabase(nextDatabase);
      } catch (error) {
        console.error('Failed to hydrate database', error);

        const fallbackDatabase = createEmptyDatabase();
        if (cancelled) {
          return;
        }

        databaseRef.current = fallbackDatabase;
        setDatabase(fallbackDatabase);
      } finally {
        if (!cancelled) {
          setHydrated(true);
        }
      }
    }

    hydrate();

    return () => {
      cancelled = true;
    };
  }, []);

  async function commit(nextDatabase: AppDatabase) {
    databaseRef.current = nextDatabase;
    setDatabase(nextDatabase);
    await saveDatabase(nextDatabase);
  }

  async function updatePreferences(patch: Partial<AppPreferences>) {
    const current = databaseRef.current;
    await commit({
      ...current,
      preferences: {
        ...current.preferences,
        ...patch,
      },
    });
  }

  async function setUnitPreference(nextUnit: UnitPreference) {
    const current = databaseRef.current;
    if (current.preferences.unitPreference === nextUnit) {
      return;
    }

    await updatePreferences({ unitPreference: nextUnit });
  }

  async function completeOnboarding(patch: Partial<AppPreferences> = {}) {
    await updatePreferences({
      onboardingCompleted: true,
      ...patch,
    });
  }

  async function upsertWorkoutTemplate(draft: WorkoutTemplateDraft) {
    const trimmedName = draft.name.trim();
    const nextName = trimmedName || 'Untitled workout';
    const current = databaseRef.current;
    const existingTemplate = draft.id ? workoutTemplateRepository.findById(current, draft.id) : undefined;
    const workoutTemplateId = existingTemplate?.id ?? createId('workout');
    const timestamp = new Date().toISOString();
    const draftSessions = normalizeDraftSessions(draft).filter((session) => session.exercises.length > 0);

    const sessions = draftSessions.map((session, sessionIndex) => {
      const workoutTemplateSessionId = session.id ?? createId('workout_template_session');
      const exercises = session.exercises.map((exercise, exerciseIndex) => ({
        id: exercise.id ?? createId('exercise'),
        workoutTemplateId,
        workoutTemplateSessionId,
        name: exercise.name.trim() || `Exercise ${exerciseIndex + 1}`,
        targetSets: Math.max(1, exercise.targetSets),
        repMin: Math.max(1, exercise.repMin),
        repMax: Math.max(Math.max(1, exercise.repMin), exercise.repMax),
        restSeconds: exercise.restSeconds && exercise.restSeconds > 0 ? exercise.restSeconds : null,
        trackedDefault: exercise.trackedDefault,
        orderIndex: exerciseIndex,
        libraryItemId: exercise.libraryItemId ?? null,
      }));

      return {
        id: workoutTemplateSessionId,
        name: session.name.trim() || (sessionIndex === 0 ? nextName : `Session ${sessionIndex + 1}`),
        orderIndex: sessionIndex,
        exerciseIds: exercises.map((exercise) => exercise.id),
        exercises,
      };
    });

    const exercises = sessions.flatMap((session) => session.exercises);

    const nextTemplate = {
      id: workoutTemplateId,
      name: nextName,
      exerciseIds: exercises.map((exercise) => exercise.id),
      sessions: sessions.map(({ exercises: _, ...session }) => session),
      createdAt: existingTemplate?.createdAt ?? timestamp,
      updatedAt: timestamp,
    };

    let nextDatabase = workoutTemplateRepository.upsert(current, nextTemplate);
    nextDatabase = exerciseTemplateRepository.replaceForWorkoutTemplate(
      nextDatabase,
      workoutTemplateId,
      exercises,
    );
    await commit(nextDatabase);
    return workoutTemplateId;
  }

  async function renameWorkoutTemplate(workoutTemplateId: string, nextName: string) {
    const current = databaseRef.current;
    const template = workoutTemplateRepository.findById(current, workoutTemplateId);

    if (!template) {
      return;
    }

    const trimmedName = nextName.trim();
    if (!trimmedName) {
      return;
    }

    await commit(
      workoutTemplateRepository.upsert(current, {
        ...template,
        name: trimmedName,
        updatedAt: new Date().toISOString(),
      }),
    );
  }

  async function deleteWorkoutTemplate(workoutTemplateId: string) {
    const current = databaseRef.current;
    const nextDatabase = workoutTemplateRepository.remove(current, workoutTemplateId);
    const nextActivePlanId = nextDatabase.preferences.activePlanId
      ? workoutPlanRepository.findById(nextDatabase, nextDatabase.preferences.activePlanId)?.id ?? null
      : null;

    await commit({
      ...nextDatabase,
      preferences: {
        ...nextDatabase.preferences,
        activePlanId: nextActivePlanId,
      },
    });
  }

  async function persistCompletedWorkoutSession(input: PersistCompletedWorkoutInput) {
    const current = databaseRef.current;
    const result = persistCompletedWorkoutSessionToDatabase(current, input, createId);

    if (result.didPersist) {
      await commit(result.database);
    }

    return result.summary;
  }

  async function saveWorkoutSession(
    workoutTemplateId: string,
    logs: ExerciseLogDraft[],
    startedAt?: string,
  ) {
    const current = databaseRef.current;
    const template = workoutTemplateRepository.findById(current, workoutTemplateId);

    if (!template) {
      return {
        sessionId: null,
        performedAt: null,
        exercisesLogged: 0,
        trackedExercisesUpdated: 0,
        exercisesSwapped: 0,
        notesSaved: 0,
        sessionInsertedExercises: 0,
        entriesSaved: 0,
        setsCompleted: 0,
        totalVolume: 0,
        durationMinutes: 0,
      };
    }

    return persistCompletedWorkoutSession({
      sessionId: createId('session'),
      workoutTemplateId,
      workoutNameSnapshot: template.name,
      logs,
      startedAt,
    });
  }

  async function addBodyweightEntry(weightKg: number, recordedAt = new Date().toISOString()) {
    const current = databaseRef.current;
    if (weightKg <= 0) {
      return;
    }

    const entry: BodyweightEntry = {
      id: createId('bodyweight'),
      recordedAt,
      weight: weightKg,
    };

    await commit(bodyweightRepository.append(current, entry));
  }

  async function resetAllData() {
    const cleared = await resetDatabase();
    databaseRef.current = cleared;
    setDatabase(cleared);
  }

  const value = useMemo<AppContextValue>(
    () => ({
      database,
      hydrated,
      preferences: database.preferences,
      unitPreference: database.preferences.unitPreference,
      workoutTemplates: workoutTemplateRepository.list(database),
      workoutPlans: workoutPlanRepository.list(database),
      exerciseLibrary: database.exerciseLibrary,
      workoutSessions: workoutSessionRepository.list(database),
      bodyweightEntries: bodyweightRepository.list(database),
      trackedProgress: getTrackedExerciseProgress(database),
      bodyweightProgress: getBodyweightProgress(database),
      getWorkoutExercises(workoutTemplateId: string) {
        return exerciseTemplateRepository.listByWorkoutTemplateId(database, workoutTemplateId);
      },
      getWorkoutTemplateSessions(workoutTemplateId: string) {
        const template = workoutTemplateRepository.findById(database, workoutTemplateId);
        if (!template) {
          return [];
        }

        return buildWorkoutTemplateSessions(template, database.exerciseTemplates);
      },
      getWorkoutLastCompletedAt(workoutTemplateId: string) {
        return workoutSessionRepository
          .list(database)
          .find((session) => session.workoutTemplateId === workoutTemplateId)?.performedAt;
      },
      getLatestTemplateLog(exerciseTemplateId: string) {
        return getLatestLogForTemplateExercise(database, exerciseTemplateId);
      },
      getSessionLogs(sessionId: string) {
        return exerciseLogRepository.listBySessionId(database, sessionId);
      },
      setUnitPreference,
      updatePreferences,
      completeOnboarding,
      upsertWorkoutTemplate,
      renameWorkoutTemplate,
      deleteWorkoutTemplate,
      saveWorkoutSession,
      saveCompletedWorkoutSession: persistCompletedWorkoutSession,
      addBodyweightEntry,
      resetAllData,
    }),
    [database, hydrated],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext() {
  const context = useContext(AppContext);

  if (!context) {
    throw new Error('useAppContext must be used inside AppProvider');
  }

  return context;
}
