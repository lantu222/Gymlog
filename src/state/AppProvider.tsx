import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { createEmptyDatabase } from '../data/seed';
import { resolveDeviceLanguage } from '../storage/deviceLocale';
import { createId } from '../lib/ids';
import { isProUnlocked } from '../lib/proEntitlement';
import {
  countAuthoredPrograms,
  FREE_CUSTOM_PROGRAM_LIMIT,
  ProgramLimitReachedError,
  ProgramSlots,
  resolveProgramSlots,
} from '../lib/programSlots';
import { rememberName } from '../lib/exerciseNameBook';
import { createSerialTaskQueue, RunExclusive } from '../lib/serialTaskQueue';
import { buildWorkoutTemplateSessions } from '../lib/workoutTemplateSessions';
import { persistCompletedWorkoutSessionToDatabase, PersistCompletedWorkoutInput, SessionSaveSummary } from './completedWorkoutPersistence';
import type { HevyImportedWorkout } from '../lib/hevyImport';
import {
  getBodyweightProgress,
  getLatestLogForTemplateExercise,
  getTrackedExerciseProgress,
} from '../lib/progression';
import { loadDatabase, normalizeDatabase, resetDatabase, saveDatabase, savePreferences } from '../storage/database';
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
  CardioActivityType,
  CardioFeel,
  CardioSession,
  ExerciseLogDraft,
  ExerciseTemplate,
  MeasurementEntry,
  MeasurementKind,
  MeasurementUnit,
  SessionFeel,
  UnitPreference,
  WorkoutPlan,
  WorkoutTemplateDraft,
  WorkoutTemplateSessionDraft,
  WorkoutTemplateSessionWithExercises,
} from '../types/models';

/**
 * What one edit decided to do with a template's days: write them, or stop
 * without writing and say why, so the screen can explain itself.
 */
export type WorkoutTemplateSessionsEdit =
  | { kind: 'save'; sessions: WorkoutTemplateSessionDraft[] }
  | { kind: 'skip'; reason: string };

export interface WorkoutTemplateSessionsEditResult {
  saved: boolean;
  /** 'templateMissing' when the programme was gone, otherwise the edit's own. */
  reason?: string;
}

export interface UpsertWorkoutTemplateOptions {
  /**
   * The plan this new programme takes the place of.
   *
   * Granted only when that plan is actually one the reader is running, checked
   * inside the provider — a screen cannot talk its way past the cap by passing
   * an id. A ready programme is immutable, so changing one lift in the one you
   * train means storing a copy; that copy replaces the original rather than
   * joining it, so the reader keeps the same number of programmes and the cap
   * has nothing to count.
   */
  replacesPlanId?: string;
}

interface AppContextValue {
  database: AppDatabase;
  hydrated: boolean;
  preferences: AppPreferences;
  /** Free-tier program budget, so a screen can show it rather than hit it. */
  programSlots: ProgramSlots;
  unitPreference: UnitPreference;
  workoutTemplates: AppDatabase['workoutTemplates'];
  workoutPlans: AppDatabase['workoutPlans'];
  exerciseLibrary: AppDatabase['exerciseLibrary'];
  workoutSessions: AppDatabase['workoutSessions'];
  cardioSessions: AppDatabase['cardioSessions'];
  bodyweightEntries: AppDatabase['bodyweightEntries'];
  measurementEntries: AppDatabase['measurementEntries'];
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
  upsertWorkoutTemplate: (draft: WorkoutTemplateDraft, options?: UpsertWorkoutTemplateOptions) => Promise<string>;
  upsertWorkoutPlan: (plan: WorkoutPlan) => Promise<void>;
  /** Onboarding's whole result — preferences, template and plan — in one save. */
  saveOnboardingResult: (input: {
    preferences: Partial<AppPreferences>;
    templateDraft: WorkoutTemplateDraft;
    buildPlan: (workoutTemplateId: string, sessionIds: string[]) => WorkoutPlan;
    activate: (planId: string) => Partial<AppPreferences>;
  }) => Promise<{ workoutTemplateId: string; planId: string }>;
  renameWorkoutTemplate: (workoutTemplateId: string, nextName: string) => Promise<void>;
  /**
   * The only safe way to change what a template's days hold: the days are read
   * inside the same write slot, so an edit can never be built on a snapshot an
   * earlier edit has already moved past.
   */
  editWorkoutTemplateSessions: (
    workoutTemplateId: string,
    edit: (sessions: WorkoutTemplateSessionWithExercises[]) => WorkoutTemplateSessionsEdit,
  ) => Promise<WorkoutTemplateSessionsEditResult>;
  findWorkoutTemplateIdBySource: (sourceTemplateId: string) => Promise<string | null>;
  getWorkoutTemplateSessionsFresh: (
    workoutTemplateId: string,
  ) => Promise<WorkoutTemplateSessionWithExercises[]>;
  deleteWorkoutTemplate: (workoutTemplateId: string) => Promise<void>;
  saveWorkoutSession: (
    workoutTemplateId: string,
    logs: ExerciseLogDraft[],
    startedAt?: string,
  ) => Promise<SessionSaveSummary>;
  saveCompletedWorkoutSession: (input: PersistCompletedWorkoutInput) => Promise<SessionSaveSummary>;
  updateCompletedWorkoutSession: (
    sessionId: string,
    patch: {
      workoutNameSnapshot?: string;
      sessionNotes?: string | null;
      feel?: SessionFeel | null;
    },
  ) => Promise<void>;
  /** Removes a saved workout and the sets logged in it. */
  deleteCompletedWorkoutSession: (sessionId: string) => Promise<void>;
  /** Entry has a second half: what you typed in, you can take back. */
  deleteMeasurementEntry: (entryId: string) => Promise<void>;
  deleteBodyweightEntry: (entryId: string) => Promise<void>;
  deleteCardioSession: (sessionId: string) => Promise<void>;
  /**
   * Replaces local data with a cloud backup, through the same normalizer a
   * stored database goes through on load — an old backup gets defaults, not a
   * crash, and the exercise library is reseeded exactly like on load.
   */
  restoreDatabaseFromBackup: (input: Partial<AppDatabase>) => Promise<void>;
  /**
   * Writes a parsed Hevy export into the history, through the same
   * persistence path a finished live workout takes. Session ids are
   * derived from the Hevy start time, so importing the same file twice
   * reports duplicates instead of doubling the history.
   */
  importWorkoutHistory: (
    workouts: HevyImportedWorkout[],
  ) => Promise<{ imported: number; duplicates: number }>;
  saveCardioSession: (input: {
    activityType: CardioActivityType;
    startedAt: string;
    durationSec: number;
    distanceKm?: number | null;
    feel?: CardioFeel | null;
  }) => Promise<CardioSession>;
  /** The reader's own lift names, learned one import correction at a time. */
  exerciseNameBook: AppDatabase['exerciseNameBook'];
  /** Teach the book one spelling. Re-teaching replaces the previous answer. */
  teachExerciseName: (
    wrote: string,
    exercise: { name: string; libraryItemId: string | null },
  ) => Promise<void>;
  addBodyweightEntry: (weightKg: number, recordedAt?: string) => Promise<void>;
  addMeasurementEntry: (kind: MeasurementKind, value: number, unit: MeasurementUnit, recordedAt?: string) => Promise<void>;
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
    cardioSessions: [],
    exerciseLogs: [],
    bodyweightEntries: [],
    measurementEntries: [],
    exerciseNameBook: [],
    preferences: {
      appLanguage: resolveDeviceLanguage(),
      unitPreference: 'kg',
      defaultRestSeconds: 120,
      autoFocusNextInput: true,
      keepScreenAwakeDuringWorkout: true,
      soundCuesEnabled: true,
      darkThemeEnabled: false,
      ratingPrompt: { lastAskedAt: null, askCount: 0, rated: false },
      hapticsEnabled: true,
      homeStatCardKeys: null,
      notificationPrefs: {
        pushEnabled: false,
        level: 'normal',
        personalRecords: true,
        weeklySummary: true,
        comebackNudge: true,
        sessionReminders: false,
        reminderTime: '17:30',
        weighInReminder: false,
        restAlerts: true,
        restWarning: true,
        sessionOngoing: true,
        idleNudge: true,
        restAlertsAsked: false,
      },
      trainingBreak: null,
      promoProUntil: null,
      mockSubscriptionTerm: 'yearly',
      mockSubscriptionCancelled: false,
      mockSubscriptionPurchasedAt: null,
      cancelSurveyAnswer: null,
      featureVotedIds: [],
      aiCoachProQuota: null,
      firstLaunchAt: null,
      coachDemoMomentsUsed: [],
      adaptiveCoachPremiumUnlocked: false,
      automatedProgressionEnabled: true,
      aiSetupCompleted: false,
      hasOpenedAppBefore: false,
      homeWidgetPromptDismissed: false,
      accountBackupPromptDismissed: false,
      aiOnlineNoticeAcknowledged: false,
      coachGoals: [],
      primaryGoalId: null,
      coachSuggestionState: {},
      setupHandoffCompleted: false,
      entryFlowCompleted: false,
      trainingFirstRunDismissed: false,
      selectedSignInMethod: null,
      selectedAccessTier: null,
      profileName: null,
      setupCurrentWeightKg: null,
      bodyweightGoalKg: null,
      onboardingCompleted: false,
      setupCompleted: false,
      setupGender: null,
      setupAge: null,
      setupAgeRange: null,
      setupHeightCm: null,
      setupGoal: null,
      setupGoals: [],
      setupLevel: null,
      setupDaysPerWeek: null,
      setupEquipment: null,
      setupTrainingEnvironment: null,
      setupEquipmentItems: [],
      setupSecondaryOutcomes: [],
      setupFocusAreas: [],
      setupCautionFlags: [],
      setupGuidanceMode: null,
      setupScheduleMode: null,
      setupWeeklyMinutes: null,
      setupAvailableDays: [],
      trainingCycle: null,
      routineDrillOverrides: {},
      todaySession: null,
      setupTrainingFeel: 'challenging',
      setupWorkoutVariety: 'balanced',
      setupFreeWeightsPreference: 'neutral',
      setupBodyweightPreference: 'neutral',
      setupMachinesPreference: 'neutral',
      setupShoulderFriendlySwaps: 'neutral',
      setupElbowFriendlySwaps: 'neutral',
      setupKneeFriendlySwaps: 'neutral',
      aiPlannerGoal: null,
      aiPlannerDaysPerWeek: null,
      aiPlannerExperience: null,
      aiPlannerSessionMinutes: null,
      aiPlannerEquipment: null,
      aiPlannerRecovery: null,
      aiPlannerMustInclude: '',
      aiPlannerAvoid: '',
      aiPlannerLimitations: '',
      aiCoachTemplateId: null,
      aiCoachSetupHash: null,
      aiCoachPlanGeneratedAt: null,
      recommendedProgramId: null,
      learnedExerciseLibraryItemIds: [],
      exerciseTechniqueChecks: {},
      strengthGoals: [],
    seasonEnrolments: [],
      dismissedTipIds: [],
      dismissedCompletionPlanIds: [],
      dismissedCardSuggestionKeys: [],
      lastInsightSessionId: null,
      lastInsightType: null,
      activePlanId: null,
      activePlanIds: [],
      programsTabEnabled: true,
    },
  });
  const [hydrated, setHydrated] = useState(false);
  // The single source of truth for WRITERS. Only commit(), hydrate() and
  // resetAllData assign it — never an effect. A [database] effect used to sync
  // it from render state, and that was the onboarding data-loss bug: an
  // earlier render's effect could run right after commit() had advanced the
  // ref and shove it back to a stale snapshot, so the next queued write
  // rebuilt the whole database from a state where the template (or plan) had
  // never existed.
  const databaseRef = useRef(database);

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

        const fallbackDatabase = createEmptyDatabase(resolveDeviceLanguage());
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

  /**
   * Every mutation below is a read-modify-write of the whole database blob.
   * Two of them in flight at once both snapshot the same state, and whichever
   * commits last erases the other's work — the onboarding save chain lost its
   * freshly created programme exactly this way. The queue makes each
   * read-modify-write atomic: a mutation only reads databaseRef.current after
   * the previous mutation has finished writing it.
   *
   * Composite helpers (setUnitPreference, completeOnboarding,
   * saveWorkoutSession) intentionally stay unwrapped: they mutate only through
   * these primitives, and wrapping them too would deadlock the queue.
   */
  const runExclusiveRef = useRef<RunExclusive | null>(null);
  if (runExclusiveRef.current === null) {
    runExclusiveRef.current = createSerialTaskQueue();
  }
  const runExclusive = runExclusiveRef.current;

  /**
   * Preferences are the one mutation that does not pay for the whole database.
   *
   * This used to go through commit, which serializes every session, set and
   * measurement the reader owns before the write lands — so changing the theme
   * or the language cost the price of the entire training history, on the JS
   * thread, and got slower with every workout logged. They have their own key
   * now; the in-memory database stays the single source of truth, and the next
   * full save carries the same values into the blob.
   */
  function updatePreferences(patch: Partial<AppPreferences>) {
    return runExclusive(async () => {
      const current = databaseRef.current;
      const next = {
        ...current,
        preferences: {
          ...current.preferences,
          ...patch,
        },
      };
      databaseRef.current = next;
      setDatabase(next);
      await savePreferences(next.preferences);
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

  function upsertWorkoutTemplate(draft: WorkoutTemplateDraft, options?: UpsertWorkoutTemplateOptions) {
    return runExclusive(() => upsertWorkoutTemplateExclusive(draft, options));
  }

  async function upsertWorkoutTemplateExclusive(
    draft: WorkoutTemplateDraft,
    options?: UpsertWorkoutTemplateOptions,
  ) {
    const built = buildTemplateUpsert(draft, options);
    await commit(built.database);
    return built.workoutTemplateId;
  }

  /**
   * The template write with no commit of its own, so a caller writing more than
   * one thing can carry the result forward and land it all in a single save.
   */
  function buildTemplateUpsert(draft: WorkoutTemplateDraft, options?: UpsertWorkoutTemplateOptions) {
    const trimmedName = draft.name.trim();
    const nextName = trimmedName || 'Untitled workout';
    const current = databaseRef.current;
    const existingTemplate = draft.id ? workoutTemplateRepository.findById(current, draft.id) : undefined;

    // The cap is checked here, at the one place a program of your own comes
    // into existence, rather than at the five screens that can ask for one. A
    // screen that forgets the check would quietly hand out a paid slot; this
    // cannot be forgotten. Editing is never blocked — only a NEW program past
    // the limit, so a user who is already over it keeps everything they built.
    // Freestyle logging is exempt: it is not authoring, and throwing here
    // would mean a user at the cap could not save a workout they had already
    // performed.
    //
    // One exemption, verified here rather than claimed by the caller: a copy
    // that REPLACES a ready programme the reader is currently running. Changing
    // one lift in the programme you already train is using what you have, not
    // acquiring another — you end with the same number of programmes you
    // started with. Charging a slot for it would price the act of editing,
    // which the paragraph above says is never blocked. Copying a SECOND ready
    // programme still counts, because that one adds.
    const replacesRunningPlan =
      typeof options?.replacesPlanId === 'string' &&
      current.preferences.activePlanIds.includes(options.replacesPlanId);
    if (!existingTemplate && draft.origin !== 'freestyle' && !replacesRunningPlan) {
      const slots = resolveProgramSlots(
        countAuthoredPrograms(current.workoutTemplates),
        isProUnlocked(current.preferences),
      );
      if (!slots.canCreate) {
        throw new ProgramLimitReachedError(slots.limit ?? FREE_CUSTOM_PROGRAM_LIMIT);
      }
    }
    const workoutTemplateId = existingTemplate?.id ?? createId('workout');
    const timestamp = new Date().toISOString();
    const draftSessions = normalizeDraftSessions(draft);

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
      // An edit never changes what a template is: a freestyle log opened in the
      // editor stays freestyle, and vice versa.
      origin: existingTemplate?.origin ?? draft.origin ?? 'authored',
      // Nor does it change where it came from. The link is written once, by
      // the copy that created the template, and every later edit carries it —
      // otherwise the second edit would look for a copy and not find the one
      // it is editing.
      sourceTemplateId: existingTemplate?.sourceTemplateId ?? draft.sourceTemplateId ?? null,
    };

    let nextDatabase = workoutTemplateRepository.upsert(current, nextTemplate);
    nextDatabase = exerciseTemplateRepository.replaceForWorkoutTemplate(
      nextDatabase,
      workoutTemplateId,
      exercises,
    );
    nextDatabase = {
      ...nextDatabase,
      preferences: {
        ...nextDatabase.preferences,
        trainingFirstRunDismissed: true,
      },
    };
    return { database: nextDatabase, workoutTemplateId, sessions };
  }

  /**
   * Everything onboarding produces, written once.
   *
   * The finish used to be four awaited mutations in a row — preferences, the
   * template, the plan, then preferences again for the active plan id — and
   * each one is a read-modify-write of the whole database through the same
   * serial queue. Four full serializations for one moment, at the end of the
   * flow where a new reader is least willing to wait.
   *
   * The template id is why this cannot simply be reordered: the plan needs the
   * id the template upsert generates. So the whole thing happens inside one
   * lock, the plan is built from the id once it exists, and a single commit
   * carries preferences, template, exercises and plan together.
   */
  function saveOnboardingResult(input: {
    preferences: Partial<AppPreferences>;
    templateDraft: WorkoutTemplateDraft;
    buildPlan: (workoutTemplateId: string, sessionIds: string[]) => WorkoutPlan;
    activate: (planId: string) => Partial<AppPreferences>;
  }) {
    return runExclusive(async () => {
      const built = buildTemplateUpsert(input.templateDraft);
      const plan = input.buildPlan(
        built.workoutTemplateId,
        built.sessions.map((session) => session.id),
      );

      const withPlan = workoutPlanRepository.upsert(
        {
          ...built.database,
          workoutPlans: built.database.workoutPlans.map((item) => ({ ...item, isActive: false })),
        },
        { ...plan, isActive: true },
      );

      await commit({
        ...withPlan,
        preferences: {
          ...withPlan.preferences,
          ...input.preferences,
          ...input.activate(plan.id),
        },
      });
      return { workoutTemplateId: built.workoutTemplateId, planId: plan.id };
    });
  }

  function upsertWorkoutPlan(plan: WorkoutPlan) {
    return runExclusive(async () => {
      const current = databaseRef.current;
      const currentWithoutActivePlans = {
        ...current,
        workoutPlans: current.workoutPlans.map((item) => ({ ...item, isActive: false })),
      };

      await commit(
        workoutPlanRepository.upsert(currentWithoutActivePlans, {
          ...plan,
          isActive: true,
        }),
      );
    });
  }

  function renameWorkoutTemplate(workoutTemplateId: string, nextName: string) {
    return runExclusive(async () => {
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
    });
  }

  /**
   * Change what a template's days hold, reading and writing in one queue slot.
   *
   * The read half matters as much as the write half, and this is the lesson
   * that cost a morning. Callers used to rebuild the whole template from
   * `getWorkoutTemplateSessions` — which reads the RENDERED database — and
   * hand the result to `upsertWorkoutTemplate`, whose queue then made the
   * *write* atomic against a snapshot that was already stale. Two edits closer
   * together than a render (add a lift, add another before React had painted,
   * which on a laggy screen is easy) both started from the same days, and the
   * second wrote the first one out of existence. The reader was sure they had
   * added lifts and the lifts were gone — and they were right (#bugs
   * 2026-08-27, "mielestäni lisäsin nämä jo" / "liikkeet olivat hävinneet").
   *
   * Here the read happens inside the same exclusive slot as the write, from
   * databaseRef.current, so every edit builds on the one before it. Note the
   * call to `upsertWorkoutTemplateExclusive` rather than `upsertWorkoutTemplate`:
   * queueing from inside the queue would deadlock.
   */
  /**
   * The days of a stored programme, read from stored data.
   *
   * `getWorkoutTemplateSessions` reads the RENDERED database, which is the
   * right thing for a screen and the wrong thing immediately after a write:
   * the closure that just awaited an upsert still holds the render from
   * before it, so a template created a moment ago is not there yet. Copying a
   * ready programme did exactly that — read the copy's days back to build its
   * plan, got nothing, and `buildProgramWorkoutPlan` floors the count at one.
   * Every reader who edited a lift in a three-day programme was handed a
   * one-day plan pointing at no session (verified in stored data on the
   * emulator 2026-08-27: FIT's copy, three days, one entry).
   */
  function getWorkoutTemplateSessionsFresh(
    workoutTemplateId: string,
  ): Promise<WorkoutTemplateSessionWithExercises[]> {
    return runExclusive(async () => {
      const current = databaseRef.current;
      const template = workoutTemplateRepository.findById(current, workoutTemplateId);
      return template ? buildWorkoutTemplateSessions(template, current.exerciseTemplates) : [];
    });
  }

  /**
   * "Do I already have a copy of this catalog programme?" — asked of stored
   * data, not of the screen.
   *
   * The caller used to answer this from the rendered `workoutTemplates` array,
   * which is one render behind the database. That was survivable while an edit
   * was a deliberate press every few seconds. It stopped being survivable when
   * the day screen grew a stepper: three quick taps on "+" are three edits
   * inside one render, all three see no copy, and all three make one — which
   * is the copy-accumulation bug back again, from the other end (verified on
   * the emulator 2026-08-27, two "HOME Starter" rows from a single adjustment).
   */
  function findWorkoutTemplateIdBySource(sourceTemplateId: string): Promise<string | null> {
    return runExclusive(async () =>
      databaseRef.current.workoutTemplates.find(
        (template) => template.sourceTemplateId === sourceTemplateId,
      )?.id ?? null,
    );
  }

  function editWorkoutTemplateSessions(
    workoutTemplateId: string,
    edit: (sessions: WorkoutTemplateSessionWithExercises[]) => WorkoutTemplateSessionsEdit,
  ): Promise<WorkoutTemplateSessionsEditResult> {
    return runExclusive(async () => {
      const current = databaseRef.current;
      const template = workoutTemplateRepository.findById(current, workoutTemplateId);
      if (!template) {
        return { saved: false, reason: 'templateMissing' as const };
      }

      const outcome = edit(buildWorkoutTemplateSessions(template, current.exerciseTemplates));
      if (outcome.kind === 'skip') {
        return { saved: false, reason: outcome.reason };
      }

      await upsertWorkoutTemplateExclusive({
        id: template.id,
        name: template.name,
        sessions: outcome.sessions,
      });
      return { saved: true };
    });
  }

  function deleteWorkoutTemplate(workoutTemplateId: string) {
    return runExclusive(async () => {
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
    });
  }

  function persistCompletedWorkoutSession(input: PersistCompletedWorkoutInput) {
    return runExclusive(async () => {
      const current = databaseRef.current;
      const result = persistCompletedWorkoutSessionToDatabase(current, input, createId);

      if (result.didPersist) {
        await commit(result.database);
      }

      return result.summary;
    });
  }

  function updateCompletedWorkoutSession(
    sessionId: string,
    patch: {
      workoutNameSnapshot?: string;
      sessionNotes?: string | null;
      /** The post-workout verdict, written after the save (feel sheet). */
      feel?: SessionFeel | null;
    },
  ) {
    return runExclusive(async () => {
      const current = databaseRef.current;
      const nextDatabase = workoutSessionRepository.update(current, sessionId, patch);
      await commit(nextDatabase);
    });
  }

  function teachExerciseName(
    wrote: string,
    exercise: { name: string; libraryItemId: string | null },
  ) {
    return runExclusive(async () => {
      const current = databaseRef.current;
      await commit({
        ...current,
        exerciseNameBook: rememberName(current.exerciseNameBook, wrote, exercise),
      });
    });
  }

  function deleteCompletedWorkoutSession(sessionId: string) {
    return runExclusive(async () => {
      const current = databaseRef.current;
      await commit(workoutSessionRepository.remove(current, sessionId));
    });
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

  function addBodyweightEntry(weightKg: number, recordedAt = new Date().toISOString()) {
    return runExclusive(async () => {
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
    });
  }

  function addMeasurementEntry(
    kind: MeasurementKind,
    value: number,
    unit: MeasurementUnit,
    recordedAt = new Date().toISOString(),
  ) {
    return runExclusive(async () => {
      const current = databaseRef.current;
      if (value <= 0) {
        return;
      }

      const entry: MeasurementEntry = {
        id: createId('measurement'),
        kind,
        recordedAt,
        value,
        unit,
      };

      await commit({
        ...current,
        measurementEntries: [...current.measurementEntries, entry].sort(
          (left, right) => new Date(left.recordedAt).getTime() - new Date(right.recordedAt).getTime(),
        ),
      });
    });
  }

  /**
   * The three things the reader could enter and then not take back.
   *
   * The app could delete a programme and a logged workout, and nothing else —
   * so a mistyped measurement, a stray weigh-in and a run that was really a
   * walk all became permanent the moment they were saved, and stayed in every
   * chart and every calendar that reads them (#bugs 2026-08-26: "mittaa ei saa
   * poistettua", "sama kalenteri moka", "juoksuja ei voi poistaa mutta treenit
   * voi"). Delete is not a feature here; it is the other half of entry.
   *
   * Same queue as every other write, so a delete cannot race the save that
   * put the entry there.
   */
  function deleteMeasurementEntry(entryId: string) {
    return runExclusive(async () => {
      const current = databaseRef.current;
      const next = current.measurementEntries.filter((entry) => entry.id !== entryId);
      if (next.length === current.measurementEntries.length) {
        return;
      }
      await commit({ ...current, measurementEntries: next });
    });
  }

  function deleteBodyweightEntry(entryId: string) {
    return runExclusive(async () => {
      const current = databaseRef.current;
      const next = bodyweightRepository.list(current).filter((entry) => entry.id !== entryId);
      if (next.length === bodyweightRepository.list(current).length) {
        return;
      }
      await commit({ ...current, bodyweightEntries: next });
    });
  }

  function deleteCardioSession(sessionId: string) {
    return runExclusive(async () => {
      const current = databaseRef.current;
      const sessions = current.cardioSessions ?? [];
      const next = sessions.filter((session) => session.id !== sessionId);
      if (next.length === sessions.length) {
        return;
      }
      await commit({ ...current, cardioSessions: next });
    });
  }

  function saveCardioSession(input: {
    activityType: CardioActivityType;
    startedAt: string;
    durationSec: number;
    distanceKm?: number | null;
    feel?: CardioFeel | null;
  }): Promise<CardioSession> {
    return runExclusive(async () => {
      const current = databaseRef.current;
      const session: CardioSession = {
        id: createId('cardio_session'),
        activityType: input.activityType,
        startedAt: input.startedAt,
        performedAt: new Date().toISOString(),
        durationSec: Math.max(0, Math.round(input.durationSec)),
        distanceKm: input.distanceKm && input.distanceKm > 0 ? input.distanceKm : null,
        feel: input.feel ?? null,
      };

      await commit({
        ...current,
        cardioSessions: [session, ...(current.cardioSessions ?? [])],
      });
      return session;
    });
  }

  function resetAllData() {
    return runExclusive(async () => {
      const cleared = await resetDatabase();
      databaseRef.current = cleared;
      setDatabase(cleared);
    });
  }

  function importWorkoutHistory(workouts: HevyImportedWorkout[]) {
    return runExclusive(async () => {
      let current = databaseRef.current;
      let imported = 0;
      let duplicates = 0;
      for (const workout of workouts) {
        const startedMs = Date.parse(workout.startedAt);
        const result = persistCompletedWorkoutSessionToDatabase(current, {
          sessionId: `hevy_${startedMs}`,
          // Not a template that exists, and does not need to be: ready
          // programme sessions reference ids outside the database too, and
          // every history surface reads the snapshots.
          workoutTemplateId: 'hevy_import',
          workoutTemplateSessionId: null,
          workoutNameSnapshot: workout.name,
          startedAt: workout.startedAt,
          performedAt: workout.endedAt ?? workout.startedAt,
          logs: workout.exercises.map((exercise, orderIndex) => ({
            exerciseTemplateId: null,
            exerciseNameSnapshot: exercise.name,
            weight: Math.max(0, ...exercise.sets.map((set) => set.weightKg)),
            repsPerSet: exercise.sets.map((set) => set.reps),
            sets: exercise.sets.map((set, setIndex) => ({
              orderIndex: setIndex,
              weight: set.weightKg,
              reps: set.reps,
              kind: set.kind,
              outcome: 'completed' as const,
              status: 'completed' as const,
            })),
            tracked: false,
            orderIndex,
          })),
        });
        if (result.didPersist) {
          imported += 1;
          current = result.database;
        } else {
          duplicates += 1;
        }
      }
      if (imported > 0) {
        await commit(current);
      }
      return { imported, duplicates };
    });
  }

  function restoreDatabaseFromBackup(input: Partial<AppDatabase>) {
    return runExclusive(async () => {
      const restored = normalizeDatabase(input);
      await commit(restored);
      // The preferences split-key would otherwise override the restored ones
      // on the next load — the exact stale-copy bug the split invites.
      await savePreferences(restored.preferences);
    });
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
      cardioSessions: database.cardioSessions ?? [],
      bodyweightEntries: bodyweightRepository.list(database),
      measurementEntries: database.measurementEntries,
      exerciseNameBook: database.exerciseNameBook,
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
      programSlots: resolveProgramSlots(
        countAuthoredPrograms(database.workoutTemplates),
        isProUnlocked(database.preferences),
      ),
      upsertWorkoutTemplate,
      upsertWorkoutPlan,
      saveOnboardingResult,
      renameWorkoutTemplate,
      editWorkoutTemplateSessions,
      findWorkoutTemplateIdBySource,
      getWorkoutTemplateSessionsFresh,
      deleteWorkoutTemplate,
      saveWorkoutSession,
      saveCompletedWorkoutSession: persistCompletedWorkoutSession,
      updateCompletedWorkoutSession,
      deleteCompletedWorkoutSession,
      deleteMeasurementEntry,
      deleteBodyweightEntry,
      deleteCardioSession,
      saveCardioSession,
      addBodyweightEntry,
      teachExerciseName,
      addMeasurementEntry,
      resetAllData,
      restoreDatabaseFromBackup,
      importWorkoutHistory,
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
