import { formatWorkoutDisplayLabel } from '../lib/displayLabel';
import {
  buildFirstRunCustomProgramName,
  DEFAULT_FIRST_RUN_SELECTION,
  DEFAULT_RHYTHM_BY_DAYS,
  FirstRunSetupSelection,
} from '../lib/firstRunSetup';
import { composeProgramWeekForSelection } from '../lib/programDayComposer';
import { WorkoutRuntimeTemplate } from '../features/workout/workoutTypes';
import {
  AppLanguage,
  AppPreferences,
  SetupEquipment,
  SetupTrainingEnvironment,
  WorkoutTemplateDraft,
} from '../types/models';

/**
 * How a finished questionnaire becomes preferences, a saved programme and a
 * plan — and how stored preferences become a questionnaire again when the
 * reader re-opens setup. Moved out of App.tsx in the phase-A split
 * (2026-08-26): these are pure builders, not wiring.
 */

function getDefaultTrainingEnvironment(equipment: SetupEquipment): SetupTrainingEnvironment {
  switch (equipment) {
    case 'gym':
      return 'full_gym';
    case 'home':
      return 'home_gym';
    case 'minimal':
    default:
      return 'minimal_equipment';
  }
}

export function buildSetupSelectionFromPreferences(preferences: AppPreferences): FirstRunSetupSelection | null {
  if (
    !preferences.setupCompleted ||
    !preferences.setupGoal ||
    !preferences.setupDaysPerWeek ||
    !preferences.setupEquipment
  ) {
    return null;
  }

  return {
    profileName: preferences.profileName,
    gender: preferences.setupGender ?? DEFAULT_FIRST_RUN_SELECTION.gender,
    age: preferences.setupAge ?? DEFAULT_FIRST_RUN_SELECTION.age,
    ageRange: preferences.setupAgeRange ?? DEFAULT_FIRST_RUN_SELECTION.ageRange,
    heightCm: preferences.setupHeightCm,
    goal: preferences.setupGoal,
    goals:
      preferences.setupGoals.length > 0
        ? preferences.setupGoals
        : [preferences.setupGoal],
    level: preferences.setupLevel ?? DEFAULT_FIRST_RUN_SELECTION.level,
    daysPerWeek: preferences.setupDaysPerWeek,
    equipment: preferences.setupEquipment,
    trainingEnvironment:
      preferences.setupTrainingEnvironment ?? getDefaultTrainingEnvironment(preferences.setupEquipment),
    equipmentItems: preferences.setupEquipmentItems,
    secondaryOutcomes:
      preferences.setupSecondaryOutcomes.length > 0
        ? preferences.setupSecondaryOutcomes
        : DEFAULT_FIRST_RUN_SELECTION.secondaryOutcomes,
    focusAreas: preferences.setupFocusAreas.length > 0 ? preferences.setupFocusAreas : DEFAULT_FIRST_RUN_SELECTION.focusAreas,
    cautionFlags: preferences.setupCautionFlags,
    guidanceMode: preferences.setupGuidanceMode ?? DEFAULT_FIRST_RUN_SELECTION.guidanceMode,
    scheduleMode: preferences.setupScheduleMode ?? DEFAULT_FIRST_RUN_SELECTION.scheduleMode,
    automatedProgression: preferences.automatedProgressionEnabled,
    weeklyMinutes: preferences.setupWeeklyMinutes,
    availableDays:
      preferences.setupAvailableDays.length > 0
        ? preferences.setupAvailableDays
        : DEFAULT_FIRST_RUN_SELECTION.availableDays,
    trainingCyclePattern: preferences.trainingCycle?.pattern ?? null,
    currentWeightKg: preferences.setupCurrentWeightKg,
    targetWeightKg: preferences.bodyweightGoalKg,
    unitPreference: preferences.unitPreference,
  };
}

/** Local midnight, the anchor a training cycle counts from. */
function localTodayStart(): number {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}

export function buildSetupPreferencePatch(
  selection: FirstRunSetupSelection,
  recommendedProgramId: string | null,
  // The cycle already in preferences, so an unchanged pattern keeps its
  // anchor: re-anchoring "2 on, 1 off" to today would silently shift which
  // day of the rhythm today is for a reader who only re-ran the questions.
  previousCycle: AppPreferences['trainingCycle'] = null,
): Partial<AppPreferences> {
  const cyclePattern = selection.trainingCyclePattern ?? null;
  return {
    trainingCycle: cyclePattern
      ? previousCycle && previousCycle.pattern.join(',') === cyclePattern.join(',')
        ? previousCycle
        : { pattern: cyclePattern, anchorDayStart: localTodayStart() }
      : null,
    onboardingCompleted: true,
    setupCompleted: true,
    profileName: selection.profileName?.trim() ? selection.profileName.trim().slice(0, 32) : null,
    setupGender: selection.gender,
    setupAge: selection.age ?? null,
    setupAgeRange: selection.ageRange ?? null,
    setupHeightCm: selection.heightCm ?? null,
    setupGoal: selection.goal,
    setupGoals: selection.goals?.length ? selection.goals : [selection.goal],
    setupLevel: selection.level,
    setupDaysPerWeek: selection.daysPerWeek,
    setupEquipment: selection.equipment,
    setupTrainingEnvironment: selection.trainingEnvironment,
    setupEquipmentItems: selection.equipmentItems ?? [],
    setupSecondaryOutcomes: selection.secondaryOutcomes,
    setupFocusAreas: selection.focusAreas,
    setupCautionFlags: selection.cautionFlags ?? [],
    setupGuidanceMode: selection.guidanceMode,
    setupScheduleMode: selection.scheduleMode,
    automatedProgressionEnabled: selection.automatedProgression ?? true,
    setupWeeklyMinutes: selection.weeklyMinutes ?? null,
    setupAvailableDays: selection.scheduleMode === 'self_managed' ? selection.availableDays : [],
    setupCurrentWeightKg: selection.currentWeightKg ?? null,
    bodyweightGoalKg: selection.targetWeightKg ?? null,
    recommendedProgramId,
    activePlanId: null,
    unitPreference: selection.unitPreference,
  };
}

export function buildSavedOnboardingPlan(
  selection: FirstRunSetupSelection,
  recommendedProgramId: string,
  // The name is written into the template at creation time, so it has to be
  // written in the reader's language. Omitting this defaulted to English and
  // put "Strong Chest Advanced" on a Finnish Home screen.
  language: AppLanguage,
  savedTemplateId?: string,
) {
  // Single source of truth with the onboarding previews (days-per-week truth):
  // the same composed week the picker and plan overview showed is what saves.
  const composedWeek = composeProgramWeekForSelection(selection, recommendedProgramId);
  const sessions = (composedWeek?.sessions ?? []).map((session) => ({
    id: session.id,
    name: formatWorkoutDisplayLabel(session.name, 'Workout'),
    orderIndex: session.orderIndex,
    exercises: session.exercises,
  }));
  const draft: WorkoutTemplateDraft = {
    name: buildFirstRunCustomProgramName(selection, language),
    sessions: sessions.map((session) => ({
      id: session.id,
      name: session.name,
      exercises: session.exercises.map((exercise) => ({
        id: exercise.id,
        name: exercise.exerciseName,
        targetSets: exercise.sets,
        repMin: exercise.repsMin,
        repMax: exercise.repsMax,
        restSeconds: exercise.restSecondsMax,
        trackedDefault: true,
      })),
    })),
  };
  const runtimeTemplate: WorkoutRuntimeTemplate = {
    id: savedTemplateId ?? recommendedProgramId,
    name: draft.name,
    defaultScheduleMode: 'rolling_sequence',
    sessions,
  };

  return { draft, runtimeTemplate, firstSessionId: sessions[0]?.id ?? null };
}

export function buildSavedOnboardingWorkoutPlan(
  selection: FirstRunSetupSelection,
  workoutTemplateId: string,
  sessionIds: string[],
  language: AppLanguage,
) {
  const days = selection.scheduleMode === 'self_managed' && selection.availableDays.length > 0
    ? selection.availableDays
    : DEFAULT_RHYTHM_BY_DAYS[selection.daysPerWeek] ?? DEFAULT_RHYTHM_BY_DAYS[3];
  const timestamp = new Date().toISOString();
  const planId = `onboarding_plan_${workoutTemplateId}`;

  return {
    id: planId,
    name: buildFirstRunCustomProgramName(selection, language),
    mode: 'rotation' as const,
    entries: Array.from({ length: Math.max(1, sessionIds.length) }, (_, index) => ({
      id: `${planId}_entry_${index + 1}`,
      workoutTemplateId,
      workoutTemplateSessionId: sessionIds[index] ?? null,
      label: days[index % days.length] ?? `Day ${index + 1}`,
      orderIndex: index,
    })),
    isActive: true,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}
