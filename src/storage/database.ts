import AsyncStorage from '@react-native-async-storage/async-storage';

import { createEmptyDatabase, createSeedDatabase } from '../data/seed';
import { normalizeExerciseLog } from '../lib/exerciseLog';
import { buildLegacyTemplateSessions, getLegacyTemplateSessionId } from '../lib/workoutTemplateSessions';
import { AppDatabase, ExerciseTemplate, MeasurementEntry, WorkoutTemplate, WorkoutTemplateSessionRecord } from '../types/models';

const STORAGE_KEY = '@gymlog/database/v1';

function normalizeJointSwapPreference(rawValue: unknown, fallbackValue: 'neutral' | 'prefer' | 'prioritize') {
  if (rawValue === 'neutral' || rawValue === 'prefer' || rawValue === 'prioritize') {
    return rawValue;
  }

  if (rawValue === true) {
    return 'prefer';
  }

  if (rawValue === false) {
    return 'neutral';
  }

  return fallbackValue;
}

function normalizeTemplateSessions(
  template: any,
  templateExercises: ExerciseTemplate[],
): WorkoutTemplateSessionRecord[] {
  const rawSessions = Array.isArray(template?.sessions) ? template.sessions : [];
  const fallbackSessions = buildLegacyTemplateSessions(
    { id: String(template?.id ?? ''), name: String(template?.name ?? 'Workout') },
    templateExercises,
  );

  const sessions = rawSessions.length ? rawSessions : fallbackSessions;

  return sessions
    .map((session: any, index: number) => ({
      id: typeof session?.id === 'string' && session.id.trim().length ? session.id : `${template.id}_session_${index + 1}`,
      name: typeof session?.name === 'string' && session.name.trim().length ? session.name.trim() : index === 0 ? String(template?.name ?? 'Workout') : `Session ${index + 1}`,
      orderIndex: typeof session?.orderIndex === 'number' ? session.orderIndex : index,
      exerciseIds: Array.isArray(session?.exerciseIds)
        ? session.exerciseIds.filter((value: unknown): value is string => typeof value === 'string')
        : [],
    }))
    .sort((left: WorkoutTemplateSessionRecord, right: WorkoutTemplateSessionRecord) => left.orderIndex - right.orderIndex);
}

function mergeExerciseLibrary(
  inputLibrary: AppDatabase['exerciseLibrary'] | null | undefined,
  fallbackLibrary: AppDatabase['exerciseLibrary'],
) {
  const merged = new Map<string, AppDatabase['exerciseLibrary'][number]>();

  fallbackLibrary.forEach((item) => {
    merged.set(item.id, item);
  });

  if (Array.isArray(inputLibrary)) {
    inputLibrary.forEach((item) => {
      if (!item || typeof item.id !== 'string' || !item.id.trim().length) {
        return;
      }

      merged.set(item.id, {
        ...merged.get(item.id),
        ...item,
      });
    });
  }

  return Array.from(merged.values());
}

function normalizeDatabase(input: Partial<AppDatabase> | null | undefined): AppDatabase {
  const fallback = createSeedDatabase();

  const rawExerciseTemplates: ExerciseTemplate[] = Array.isArray(input?.exerciseTemplates)
    ? input.exerciseTemplates.map((exercise: any) => ({
        id: String(exercise?.id ?? ''),
        workoutTemplateId: String(exercise?.workoutTemplateId ?? ''),
        workoutTemplateSessionId:
          typeof exercise?.workoutTemplateSessionId === 'string' ? exercise.workoutTemplateSessionId : '',
        name: typeof exercise?.name === 'string' ? exercise.name : 'Exercise',
        targetSets: typeof exercise?.targetSets === 'number' ? exercise.targetSets : 3,
        repMin: typeof exercise?.repMin === 'number' ? exercise.repMin : 6,
        repMax: typeof exercise?.repMax === 'number' ? exercise.repMax : 8,
        restSeconds: typeof exercise?.restSeconds === 'number' ? exercise.restSeconds : null,
        trackedDefault: typeof exercise?.trackedDefault === 'boolean' ? exercise.trackedDefault : true,
        orderIndex: typeof exercise?.orderIndex === 'number' ? exercise.orderIndex : 0,
        libraryItemId: typeof exercise?.libraryItemId === 'string' || exercise?.libraryItemId === null ? exercise.libraryItemId : null,
        persistedExerciseTemplateId:
          typeof exercise?.persistedExerciseTemplateId === 'string' || exercise?.persistedExerciseTemplateId === null
            ? exercise.persistedExerciseTemplateId
            : undefined,
      }))
    : [];

  const rawTemplates: WorkoutTemplate[] = Array.isArray(input?.workoutTemplates)
    ? input.workoutTemplates.map((template: any) => {
        const templateId = String(template?.id ?? '');
        const templateExercises = rawExerciseTemplates.filter((exercise) => exercise.workoutTemplateId === templateId);
        const sessions = normalizeTemplateSessions(template, templateExercises);

        return {
          id: templateId,
          name: typeof template?.name === 'string' && template.name.trim().length ? template.name.trim() : 'Workout',
          exerciseIds: Array.isArray(template?.exerciseIds)
            ? template.exerciseIds.filter((value: unknown): value is string => typeof value === 'string')
            : templateExercises.map((exercise) => exercise.id),
          sessions,
          createdAt: typeof template?.createdAt === 'string' ? template.createdAt : new Date().toISOString(),
          updatedAt: typeof template?.updatedAt === 'string' ? template.updatedAt : new Date().toISOString(),
        };
      })
    : [];

  const normalizedExerciseTemplates = rawExerciseTemplates.map((exercise) => {
    const template = rawTemplates.find((item) => item.id === exercise.workoutTemplateId);
    const resolvedSessionId =
      template?.sessions.find((session) => session.id === exercise.workoutTemplateSessionId)?.id ??
      template?.sessions.find((session) => session.exerciseIds.includes(exercise.id))?.id ??
      template?.sessions[0]?.id ??
      getLegacyTemplateSessionId(exercise.workoutTemplateId);

    return {
      ...exercise,
      workoutTemplateSessionId: resolvedSessionId,
    };
  });

  const normalizedTemplates = rawTemplates.map((template) => {
    const templateExercises = normalizedExerciseTemplates.filter((exercise) => exercise.workoutTemplateId === template.id);
    const sessions = template.sessions.map((session) => ({
      ...session,
      exerciseIds: templateExercises
        .filter((exercise) => exercise.workoutTemplateSessionId === session.id)
        .sort((left, right) => left.orderIndex - right.orderIndex)
        .map((exercise) => exercise.id),
    }));

    return {
      ...template,
      sessions,
      exerciseIds: sessions.flatMap((session) => session.exerciseIds),
    };
  });

  return {
    workoutTemplates: normalizedTemplates,
    exerciseTemplates: normalizedExerciseTemplates,
    workoutPlans: Array.isArray(input?.workoutPlans) ? input.workoutPlans : [],
    exerciseLibrary: mergeExerciseLibrary(input?.exerciseLibrary, fallback.exerciseLibrary),
    workoutSessions: Array.isArray(input?.workoutSessions)
      ? input.workoutSessions.map((session: any) => ({
          id: String(session?.id ?? ''),
          workoutTemplateId: String(session?.workoutTemplateId ?? ''),
          workoutNameSnapshot:
            typeof session?.workoutNameSnapshot === 'string' && session.workoutNameSnapshot.trim().length
              ? session.workoutNameSnapshot.trim()
              : 'Workout',
          sessionNotes:
            typeof session?.sessionNotes === 'string' && session.sessionNotes.trim().length
              ? session.sessionNotes.trim()
              : null,
          performedAt: typeof session?.performedAt === 'string' ? session.performedAt : new Date().toISOString(),
          startedAt: typeof session?.startedAt === 'string' ? session.startedAt : undefined,
          durationMinutes:
            typeof session?.durationMinutes === 'number' && Number.isFinite(session.durationMinutes)
              ? session.durationMinutes
              : undefined,
          setsCompleted:
            typeof session?.setsCompleted === 'number' && Number.isFinite(session.setsCompleted)
              ? session.setsCompleted
              : undefined,
          exercisesCompleted:
            typeof session?.exercisesCompleted === 'number' && Number.isFinite(session.exercisesCompleted)
              ? session.exercisesCompleted
              : undefined,
          exercisesSkipped:
            typeof session?.exercisesSkipped === 'number' && Number.isFinite(session.exercisesSkipped)
              ? session.exercisesSkipped
              : undefined,
          exercisesSwapped:
            typeof session?.exercisesSwapped === 'number' && Number.isFinite(session.exercisesSwapped)
              ? session.exercisesSwapped
              : undefined,
          totalVolumeKg:
            typeof session?.totalVolumeKg === 'number' && Number.isFinite(session.totalVolumeKg)
              ? session.totalVolumeKg
              : undefined,
          trackedExercisesUpdated:
            typeof session?.trackedExercisesUpdated === 'number' && Number.isFinite(session.trackedExercisesUpdated)
              ? session.trackedExercisesUpdated
              : undefined,
          noteCount:
            typeof session?.noteCount === 'number' && Number.isFinite(session.noteCount)
              ? session.noteCount
              : undefined,
          sessionInsertedCount:
            typeof session?.sessionInsertedCount === 'number' && Number.isFinite(session.sessionInsertedCount)
              ? session.sessionInsertedCount
              : undefined,
          legacyShapeMismatches: Array.isArray(session?.legacyShapeMismatches)
            ? session.legacyShapeMismatches.filter((value: unknown): value is string => typeof value === 'string')
            : undefined,
        }))
      : [],
    exerciseLogs: Array.isArray(input?.exerciseLogs)
      ? input.exerciseLogs
          .map((log) => normalizeExerciseLog(log))
          .filter((log): log is NonNullable<typeof log> => Boolean(log))
      : [],
    bodyweightEntries: Array.isArray(input?.bodyweightEntries) ? input.bodyweightEntries : [],
    measurementEntries: Array.isArray(input?.measurementEntries)
      ? input.measurementEntries
          .map((entry: any) => {
            const kind =
              entry?.kind === 'bodyfat' ||
              entry?.kind === 'shoulders' ||
              entry?.kind === 'chest' ||
              entry?.kind === 'waist' ||
              entry?.kind === 'hips' ||
              entry?.kind === 'thighs'
                ? entry.kind
                : null;
            const unit = entry?.unit === 'cm' || entry?.unit === 'in' || entry?.unit === '%' ? entry.unit : null;
            const value = typeof entry?.value === 'number' && Number.isFinite(entry.value) ? entry.value : null;
            const recordedAt = typeof entry?.recordedAt === 'string' ? entry.recordedAt : null;
            const id = typeof entry?.id === 'string' && entry.id.trim().length ? entry.id : null;

            if (!kind || !unit || value === null || !recordedAt || !id) {
              return null;
            }

            return {
              id,
              kind,
              unit,
              value,
              recordedAt,
            } satisfies MeasurementEntry;
          })
          .filter((entry): entry is MeasurementEntry => Boolean(entry))
      : [],
    preferences: {
      appLanguage:
        input?.preferences?.appLanguage === 'fi' || input?.preferences?.appLanguage === 'en'
          ? input.preferences.appLanguage
          : fallback.preferences.appLanguage,
      unitPreference: input?.preferences?.unitPreference === 'lb' ? 'lb' : 'kg',
      theme: 'dark',
      defaultRestSeconds:
        typeof input?.preferences?.defaultRestSeconds === 'number'
          ? input.preferences.defaultRestSeconds
          : fallback.preferences.defaultRestSeconds,
      autoFocusNextInput:
        typeof input?.preferences?.autoFocusNextInput === 'boolean'
          ? input.preferences.autoFocusNextInput
          : fallback.preferences.autoFocusNextInput,
      keepScreenAwakeDuringWorkout:
        typeof input?.preferences?.keepScreenAwakeDuringWorkout === 'boolean'
          ? input.preferences.keepScreenAwakeDuringWorkout
          : fallback.preferences.keepScreenAwakeDuringWorkout,
      adaptiveCoachPremiumUnlocked:
        typeof input?.preferences?.adaptiveCoachPremiumUnlocked === 'boolean'
          ? input.preferences.adaptiveCoachPremiumUnlocked
          : fallback.preferences.adaptiveCoachPremiumUnlocked,
      aiSetupCompleted:
        typeof input?.preferences?.aiSetupCompleted === 'boolean'
          ? input.preferences.aiSetupCompleted
          : fallback.preferences.aiSetupCompleted,
      hasOpenedAppBefore:
        typeof input?.preferences?.hasOpenedAppBefore === 'boolean'
          ? input.preferences.hasOpenedAppBefore
          : fallback.preferences.hasOpenedAppBefore,
      entryFlowCompleted:
        typeof input?.preferences?.entryFlowCompleted === 'boolean'
          ? input.preferences.entryFlowCompleted
          : fallback.preferences.entryFlowCompleted,
      trainingFirstRunDismissed:
        typeof input?.preferences?.trainingFirstRunDismissed === 'boolean'
          ? input.preferences.trainingFirstRunDismissed
          : fallback.preferences.trainingFirstRunDismissed,
      selectedSignInMethod:
        input?.preferences?.selectedSignInMethod === 'apple' ||
        input?.preferences?.selectedSignInMethod === 'email' ||
        input?.preferences?.selectedSignInMethod === null
          ? input.preferences.selectedSignInMethod
          : fallback.preferences.selectedSignInMethod,
      selectedAccessTier:
        input?.preferences?.selectedAccessTier === 'free' ||
        input?.preferences?.selectedAccessTier === 'premium' ||
        input?.preferences?.selectedAccessTier === null
          ? input.preferences.selectedAccessTier
          : fallback.preferences.selectedAccessTier,
      setupCurrentWeightKg:
        typeof input?.preferences?.setupCurrentWeightKg === 'number' || input?.preferences?.setupCurrentWeightKg === null
          ? input.preferences.setupCurrentWeightKg
          : fallback.preferences.setupCurrentWeightKg,
      bodyweightGoalKg:
        typeof input?.preferences?.bodyweightGoalKg === 'number' || input?.preferences?.bodyweightGoalKg === null
          ? input.preferences.bodyweightGoalKg
          : fallback.preferences.bodyweightGoalKg,
      onboardingCompleted:
        typeof input?.preferences?.onboardingCompleted === 'boolean'
          ? input.preferences.onboardingCompleted
          : fallback.preferences.onboardingCompleted,
      setupCompleted:
        typeof input?.preferences?.setupCompleted === 'boolean'
          ? input.preferences.setupCompleted
          : fallback.preferences.setupCompleted,
      setupGender:
        input?.preferences?.setupGender === 'male' ||
        input?.preferences?.setupGender === 'female' ||
        input?.preferences?.setupGender === 'unspecified' ||
        input?.preferences?.setupGender === null
          ? input.preferences.setupGender
          : fallback.preferences.setupGender,
      setupAge:
        typeof input?.preferences?.setupAge === 'number' && Number.isFinite(input.preferences.setupAge)
          ? Math.max(0, Math.min(100, Math.round(input.preferences.setupAge)))
          : fallback.preferences.setupAge,
      setupAgeRange:
        input?.preferences?.setupAgeRange === 'unspecified' ||
        input?.preferences?.setupAgeRange === '18' ||
        input?.preferences?.setupAgeRange === '19_25' ||
        input?.preferences?.setupAgeRange === '26_30' ||
        input?.preferences?.setupAgeRange === '31_40' ||
        input?.preferences?.setupAgeRange === '41_plus' ||
        input?.preferences?.setupAgeRange === null
          ? input.preferences.setupAgeRange
          : fallback.preferences.setupAgeRange,
      setupGoal:
        input?.preferences?.setupGoal === 'strength' ||
        input?.preferences?.setupGoal === 'muscle' ||
        input?.preferences?.setupGoal === 'general' ||
        input?.preferences?.setupGoal === 'run_mobility'
          ? input.preferences.setupGoal
          : fallback.preferences.setupGoal,
      setupGoals:
        Array.isArray(input?.preferences?.setupGoals) &&
        input.preferences.setupGoals.length > 0
          ? input.preferences.setupGoals.filter(
              (value: unknown): value is 'strength' | 'muscle' | 'general' | 'run_mobility' =>
                value === 'strength' || value === 'muscle' || value === 'general' || value === 'run_mobility',
            )
          : input?.preferences?.setupGoal === 'strength' ||
              input?.preferences?.setupGoal === 'muscle' ||
              input?.preferences?.setupGoal === 'general' ||
              input?.preferences?.setupGoal === 'run_mobility'
            ? [input.preferences.setupGoal]
            : fallback.preferences.setupGoals,
      setupLevel:
        input?.preferences?.setupLevel === 'beginner' || input?.preferences?.setupLevel === 'intermediate'
          ? input.preferences.setupLevel
          : fallback.preferences.setupLevel,
      setupDaysPerWeek:
        input?.preferences?.setupDaysPerWeek === 2 ||
        input?.preferences?.setupDaysPerWeek === 3 ||
        input?.preferences?.setupDaysPerWeek === 4 ||
        input?.preferences?.setupDaysPerWeek === 5
          ? input.preferences.setupDaysPerWeek
          : fallback.preferences.setupDaysPerWeek,
      setupEquipment:
        input?.preferences?.setupEquipment === 'gym' ||
        input?.preferences?.setupEquipment === 'minimal' ||
        input?.preferences?.setupEquipment === 'home'
          ? input.preferences.setupEquipment
          : fallback.preferences.setupEquipment,
      setupSecondaryOutcomes:
        Array.isArray(input?.preferences?.setupSecondaryOutcomes)
          ? input.preferences.setupSecondaryOutcomes.filter(
              (value: unknown): value is 'consistency' | 'mobility' | 'conditioning' | 'muscle' | 'strength' =>
                value === 'consistency' ||
                value === 'mobility' ||
                value === 'conditioning' ||
                value === 'muscle' ||
                value === 'strength',
            )
          : fallback.preferences.setupSecondaryOutcomes,
      setupFocusAreas:
        Array.isArray(input?.preferences?.setupFocusAreas)
          ? input.preferences.setupFocusAreas.filter(
              (
                value: unknown,
              ): value is
                | 'bodyweight'
                | 'glutes'
                | 'legs'
                | 'chest'
                | 'shoulders'
                | 'back'
                | 'arms'
                | 'core'
                | 'conditioning' =>
                value === 'bodyweight' ||
                value === 'glutes' ||
                value === 'legs' ||
                value === 'chest' ||
                value === 'shoulders' ||
                value === 'back' ||
                value === 'arms' ||
                value === 'core' ||
                value === 'conditioning',
            )
          : fallback.preferences.setupFocusAreas,
      setupGuidanceMode:
        input?.preferences?.setupGuidanceMode === 'done_for_me' ||
        input?.preferences?.setupGuidanceMode === 'guided_editable' ||
        input?.preferences?.setupGuidanceMode === 'self_directed'
          ? input.preferences.setupGuidanceMode
          : fallback.preferences.setupGuidanceMode,
      setupScheduleMode:
        input?.preferences?.setupScheduleMode === 'app_managed' ||
        input?.preferences?.setupScheduleMode === 'self_managed'
          ? input.preferences.setupScheduleMode
          : fallback.preferences.setupScheduleMode,
      setupWeeklyMinutes:
        typeof input?.preferences?.setupWeeklyMinutes === 'number' || input?.preferences?.setupWeeklyMinutes === null
          ? input.preferences.setupWeeklyMinutes
          : fallback.preferences.setupWeeklyMinutes,
      setupAvailableDays:
        Array.isArray(input?.preferences?.setupAvailableDays)
          ? input.preferences.setupAvailableDays.filter(
              (value: unknown): value is 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun' =>
                value === 'mon' ||
                value === 'tue' ||
                value === 'wed' ||
                value === 'thu' ||
                value === 'fri' ||
                value === 'sat' ||
                value === 'sun',
            )
          : fallback.preferences.setupAvailableDays,
      setupTrainingFeel:
        input?.preferences?.setupTrainingFeel === 'easy' ||
        input?.preferences?.setupTrainingFeel === 'steady' ||
        input?.preferences?.setupTrainingFeel === 'challenging' ||
        input?.preferences?.setupTrainingFeel === 'intense'
          ? input.preferences.setupTrainingFeel
          : fallback.preferences.setupTrainingFeel,
      setupWorkoutVariety:
        input?.preferences?.setupWorkoutVariety === 'stable' ||
        input?.preferences?.setupWorkoutVariety === 'balanced' ||
        input?.preferences?.setupWorkoutVariety === 'varied' ||
        input?.preferences?.setupWorkoutVariety === 'fresh'
          ? input.preferences.setupWorkoutVariety
          : fallback.preferences.setupWorkoutVariety,
      setupFreeWeightsPreference:
        input?.preferences?.setupFreeWeightsPreference === 'avoid' ||
        input?.preferences?.setupFreeWeightsPreference === 'neutral' ||
        input?.preferences?.setupFreeWeightsPreference === 'prefer' ||
        input?.preferences?.setupFreeWeightsPreference === 'love'
          ? input.preferences.setupFreeWeightsPreference
          : fallback.preferences.setupFreeWeightsPreference,
      setupBodyweightPreference:
        input?.preferences?.setupBodyweightPreference === 'avoid' ||
        input?.preferences?.setupBodyweightPreference === 'neutral' ||
        input?.preferences?.setupBodyweightPreference === 'prefer' ||
        input?.preferences?.setupBodyweightPreference === 'love'
          ? input.preferences.setupBodyweightPreference
          : fallback.preferences.setupBodyweightPreference,
      setupMachinesPreference:
        input?.preferences?.setupMachinesPreference === 'avoid' ||
        input?.preferences?.setupMachinesPreference === 'neutral' ||
        input?.preferences?.setupMachinesPreference === 'prefer' ||
        input?.preferences?.setupMachinesPreference === 'love'
          ? input.preferences.setupMachinesPreference
          : fallback.preferences.setupMachinesPreference,
      setupShoulderFriendlySwaps: normalizeJointSwapPreference(
        input?.preferences?.setupShoulderFriendlySwaps,
        fallback.preferences.setupShoulderFriendlySwaps,
      ),
      setupElbowFriendlySwaps: normalizeJointSwapPreference(
        input?.preferences?.setupElbowFriendlySwaps,
        fallback.preferences.setupElbowFriendlySwaps,
      ),
      setupKneeFriendlySwaps: normalizeJointSwapPreference(
        input?.preferences?.setupKneeFriendlySwaps,
        fallback.preferences.setupKneeFriendlySwaps,
      ),
      aiPlannerGoal:
        input?.preferences?.aiPlannerGoal === 'strength' ||
        input?.preferences?.aiPlannerGoal === 'muscle' ||
        input?.preferences?.aiPlannerGoal === 'fat_loss' ||
        input?.preferences?.aiPlannerGoal === 'fitness'
          ? input.preferences.aiPlannerGoal
          : fallback.preferences.aiPlannerGoal,
      aiPlannerDaysPerWeek:
        input?.preferences?.aiPlannerDaysPerWeek === 1 ||
        input?.preferences?.aiPlannerDaysPerWeek === 2 ||
        input?.preferences?.aiPlannerDaysPerWeek === 3 ||
        input?.preferences?.aiPlannerDaysPerWeek === 4
          ? input.preferences.aiPlannerDaysPerWeek
          : fallback.preferences.aiPlannerDaysPerWeek,
      aiPlannerExperience:
        input?.preferences?.aiPlannerExperience === 'beginner' ||
        input?.preferences?.aiPlannerExperience === 'intermediate' ||
        input?.preferences?.aiPlannerExperience === 'advanced'
          ? input.preferences.aiPlannerExperience
          : fallback.preferences.aiPlannerExperience,
      aiPlannerSessionMinutes:
        input?.preferences?.aiPlannerSessionMinutes === 30 ||
        input?.preferences?.aiPlannerSessionMinutes === 45 ||
        input?.preferences?.aiPlannerSessionMinutes === 60 ||
        input?.preferences?.aiPlannerSessionMinutes === 75 ||
        input?.preferences?.aiPlannerSessionMinutes === 90
          ? input.preferences.aiPlannerSessionMinutes
          : fallback.preferences.aiPlannerSessionMinutes,
      aiPlannerEquipment:
        input?.preferences?.aiPlannerEquipment === 'full_gym' ||
        input?.preferences?.aiPlannerEquipment === 'home_gym' ||
        input?.preferences?.aiPlannerEquipment === 'minimal' ||
        input?.preferences?.aiPlannerEquipment === 'bodyweight'
          ? input.preferences.aiPlannerEquipment
          : fallback.preferences.aiPlannerEquipment,
      aiPlannerRecovery:
        input?.preferences?.aiPlannerRecovery === 'low' ||
        input?.preferences?.aiPlannerRecovery === 'moderate' ||
        input?.preferences?.aiPlannerRecovery === 'high'
          ? input.preferences.aiPlannerRecovery
          : fallback.preferences.aiPlannerRecovery,
      aiPlannerMustInclude:
        typeof input?.preferences?.aiPlannerMustInclude === 'string'
          ? input.preferences.aiPlannerMustInclude
          : fallback.preferences.aiPlannerMustInclude,
      aiPlannerAvoid:
        typeof input?.preferences?.aiPlannerAvoid === 'string'
          ? input.preferences.aiPlannerAvoid
          : fallback.preferences.aiPlannerAvoid,
      aiPlannerLimitations:
        typeof input?.preferences?.aiPlannerLimitations === 'string'
          ? input.preferences.aiPlannerLimitations
          : fallback.preferences.aiPlannerLimitations,
      aiCoachTemplateId:
        typeof input?.preferences?.aiCoachTemplateId === 'string' || input?.preferences?.aiCoachTemplateId === null
          ? input.preferences.aiCoachTemplateId
          : fallback.preferences.aiCoachTemplateId,
      aiCoachSetupHash:
        typeof input?.preferences?.aiCoachSetupHash === 'string' || input?.preferences?.aiCoachSetupHash === null
          ? input.preferences.aiCoachSetupHash
          : fallback.preferences.aiCoachSetupHash,
      aiCoachPlanGeneratedAt:
        typeof input?.preferences?.aiCoachPlanGeneratedAt === 'string' || input?.preferences?.aiCoachPlanGeneratedAt === null
          ? input.preferences.aiCoachPlanGeneratedAt
          : fallback.preferences.aiCoachPlanGeneratedAt,
      recommendedProgramId:
        typeof input?.preferences?.recommendedProgramId === 'string' || input?.preferences?.recommendedProgramId === null
          ? input.preferences.recommendedProgramId
          : fallback.preferences.recommendedProgramId,
      trackedExerciseLibraryItemIds:
        Array.isArray(input?.preferences?.trackedExerciseLibraryItemIds)
          ? input.preferences.trackedExerciseLibraryItemIds.filter(
              (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0,
            )
          : fallback.preferences.trackedExerciseLibraryItemIds,
      dismissedTipIds:
        Array.isArray(input?.preferences?.dismissedTipIds)
          ? input.preferences.dismissedTipIds.filter((value: unknown): value is string => typeof value === 'string')
          : fallback.preferences.dismissedTipIds,
      activePlanId:
        typeof input?.preferences?.activePlanId === 'string' || input?.preferences?.activePlanId === null
          ? input.preferences.activePlanId
          : fallback.preferences.activePlanId,
    },
  };
}

export async function loadDatabase() {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);

  if (!raw) {
    const seeded = normalizeDatabase(createSeedDatabase());
    await saveDatabase(seeded);
    return seeded;
  }

  try {
    return normalizeDatabase(JSON.parse(raw) as Partial<AppDatabase>);
  } catch {
    const seeded = normalizeDatabase(createSeedDatabase());
    await saveDatabase(seeded);
    return seeded;
  }
}

export async function saveDatabase(database: AppDatabase) {
  await AsyncStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      ...database,
      exerciseLibrary: [],
    }),
  );
}

export async function resetDatabase() {
  const empty = normalizeDatabase(createEmptyDatabase());
  await saveDatabase(empty);
  return empty;
}
