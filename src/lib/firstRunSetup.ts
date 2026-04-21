import { getWorkoutTemplateById } from '../features/workout/workoutCatalog';
import { buildRecommendationReasonLines } from './recommendationExplanation';
import { buildRecommendationInput } from './recommendationInput';
import { getRecommendationProgramDefinition } from './recommendationCatalog';
import { recommendPrograms } from './recommendationScoring';
import { buildTailoringRecommendationNote, TailoringPreferencesInput } from './tailoringFit';
import {
  SetupDaysPerWeek,
  SetupEquipment,
  SetupAgeRange,
  SetupGender,
  SetupGuidanceMode,
  SetupScheduleMode,
  SetupWeekday,
  SetupGoal,
  SetupLevel,
  SetupFocusArea,
  SetupSecondaryOutcome,
  UnitPreference,
} from '../types/models';
import type { RecommendationCandidate, RecommendationConfidence, TemplateFamilyId } from '../types/recommendation';
import { AICoachTrainingContext } from '../types/vallu';

export interface FirstRunSetupSelection {
  gender: SetupGender;
  age?: number | null;
  ageRange?: SetupAgeRange;
  goal: SetupGoal;
  goals?: SetupGoal[];
  level: SetupLevel;
  daysPerWeek: SetupDaysPerWeek;
  equipment: SetupEquipment;
  secondaryOutcomes: SetupSecondaryOutcome[];
  focusAreas: SetupFocusArea[];
  guidanceMode: SetupGuidanceMode;
  scheduleMode: SetupScheduleMode;
  weeklyMinutes?: number | null;
  availableDays: SetupWeekday[];
  currentWeightKg?: number | null;
  targetWeightKg?: number | null;
  unitPreference: UnitPreference;
}

export interface FirstRunRecommendation {
  featuredProgramId: string;
  secondaryProgramId: string | null;
  alternativeProgramIds: string[];
  confidence: RecommendationConfidence;
  primaryFamilyId: TemplateFamilyId;
  scoredCandidates: RecommendationCandidate[];
  mismatchNote: string | null;
}

export type FirstRunStep =
  | 'location'
  | 'goal'
  | 'profile'
  | 'focus'
  | 'review'
  | 'gender'
  | 'planning'
  | 'about'
  | 'recommendation';

const PROGRAM_IDS = {
  minimal: 'tpl_2_day_minimal_full_body_v1',
  beginnerStrength: 'tpl_2_day_beginner_strength_v1',
  strengthBase: 'tpl_3_day_strength_base_v1',
  strengthSize: 'tpl_4_day_strength_size_v1',
  upperLowerLite: 'tpl_3_day_upper_lower_lite_v1',
  pushPullLegs: 'tpl_3_day_push_pull_legs_v1',
  muscleBuilder: 'tpl_4_day_muscle_builder_v1',
  powerbuilding: 'tpl_4_day_powerbuilding_v1',
  mobilityReset: 'tpl_2_day_mobility_reset_v1',
  yogaRecovery: 'tpl_2_day_yoga_recovery_v1',
  runMobility: 'tpl_3_day_run_mobility_v1',
} as const;

export const DEFAULT_RHYTHM_BY_DAYS: Record<SetupDaysPerWeek, SetupWeekday[]> = {
  2: ['mon', 'thu'],
  3: ['mon', 'wed', 'fri'],
  4: ['mon', 'tue', 'thu', 'sat'],
  5: ['mon', 'tue', 'thu', 'fri', 'sat'],
};

const WEEKDAY_ORDER: SetupWeekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

export const DEFAULT_FIRST_RUN_SELECTION: FirstRunSetupSelection = {
  gender: 'unspecified',
  age: 25,
  ageRange: '19_25',
  goal: 'strength',
  goals: ['strength'],
  level: 'beginner',
  daysPerWeek: 3,
  equipment: 'gym',
  secondaryOutcomes: [],
  focusAreas: [],
  guidanceMode: 'guided_editable',
  scheduleMode: 'app_managed',
  weeklyMinutes: null,
  availableDays: [],
  currentWeightKg: null,
  targetWeightKg: null,
  unitPreference: 'kg',
};

function getGoalLabel(goal: SetupGoal) {
  switch (goal) {
    case 'strength':
      return 'strength';
    case 'muscle':
      return 'muscle-building';
    case 'general':
      return 'general fitness';
    case 'run_mobility':
      return 'run + mobility';
    default:
      return 'training';
  }
}

export function getSetupGoalTitle(goal: SetupGoal) {
  switch (goal) {
    case 'strength':
      return 'Strength';
    case 'muscle':
      return 'Build muscle';
    case 'general':
      return 'Lose weight';
    case 'run_mobility':
      return 'Endurance / cardio';
    default:
      return 'Training';
  }
}

function getEquipmentLabel(equipment: SetupEquipment) {
  switch (equipment) {
    case 'gym':
      return 'a full gym';
    case 'minimal':
      return 'minimal equipment';
    case 'home':
      return 'a home setup';
    default:
      return 'your equipment';
  }
}

export function getSetupEquipmentTitle(equipment: SetupEquipment) {
  switch (equipment) {
    case 'gym':
      return 'Full gym';
    case 'home':
      return 'Home setup';
    case 'minimal':
      return 'Minimal setup';
    default:
      return 'Equipment';
  }
}

export function getSecondaryOutcomeLabel(outcome: SetupSecondaryOutcome) {
  switch (outcome) {
    case 'consistency':
      return 'consistency';
    case 'mobility':
      return 'mobility';
    case 'conditioning':
      return 'conditioning';
    case 'muscle':
      return 'muscle';
    case 'strength':
      return 'strength';
    default:
      return 'progress';
  }
}

export function getSecondaryOutcomeTitle(outcome: SetupSecondaryOutcome) {
  switch (outcome) {
    case 'consistency':
      return 'Stay consistent';
    case 'mobility':
      return 'Move better';
    case 'conditioning':
      return 'Keep conditioning up';
    case 'muscle':
      return 'Add muscle';
    case 'strength':
      return 'Keep strength moving';
    default:
      return 'Keep progressing';
  }
}

export function getGuidanceModeLabel(mode: SetupGuidanceMode) {
  switch (mode) {
    case 'done_for_me':
      return 'Keep it simple';
    case 'guided_editable':
      return 'Recommend, then edit';
    case 'self_directed':
      return 'Build my own';
    default:
      return 'Guided';
  }
}

export function getGuidanceModeDescription(mode: SetupGuidanceMode) {
  switch (mode) {
    case 'done_for_me':
      return 'One ready plan.';
    case 'guided_editable':
      return 'Recommend, then edit.';
    case 'self_directed':
      return 'Start from a base.';
    default:
      return 'Start with a base.';
  }
}

export function getScheduleModeLabel(mode: SetupScheduleMode) {
  switch (mode) {
    case 'app_managed':
      return 'Plan it for me';
    case 'self_managed':
      return "I'll manage the days";
    default:
      return 'Manage the schedule';
  }
}

export function getScheduleModeDescription(mode: SetupScheduleMode) {
  switch (mode) {
    case 'app_managed':
      return 'Gymlog places the week.';
    case 'self_managed':
      return 'You pick the days.';
    default:
      return 'Pick the week style.';
  }
}

export function getWeekdayShortLabel(day: SetupWeekday) {
  switch (day) {
    case 'mon':
      return 'Mon';
    case 'tue':
      return 'Tue';
    case 'wed':
      return 'Wed';
    case 'thu':
      return 'Thu';
    case 'fri':
      return 'Fri';
    case 'sat':
      return 'Sat';
    case 'sun':
      return 'Sun';
    default:
      return 'Day';
  }
}

export function formatWeekdayList(days: SetupWeekday[]) {
  return formatList(days.map((day) => getWeekdayShortLabel(day)));
}

export function getFocusAreaTitle(area: SetupFocusArea) {
  switch (area) {
    case 'bodyweight':
      return 'Bodyweight';
    case 'arms':
      return 'Arms';
    case 'glutes':
      return 'Glutes';
    case 'legs':
      return 'Legs';
    case 'chest':
      return 'Pecs';
    case 'shoulders':
      return 'Shoulders';
    case 'back':
      return 'Back';
    case 'core':
      return 'Core';
    case 'conditioning':
      return 'Conditioning';
    default:
      return 'Focus';
  }
}

export function getFocusAreaDescription(area: SetupFocusArea) {
  switch (area) {
    case 'bodyweight':
      return 'Bodyweight focus.';
    case 'arms':
      return 'Arm focus.';
    case 'glutes':
      return 'Glute focus.';
    case 'legs':
      return 'Leg focus.';
    case 'chest':
      return 'Chest focus.';
    case 'shoulders':
      return 'Shoulder focus.';
    case 'back':
      return 'Back focus.';
    case 'core':
      return 'Core focus.';
    case 'conditioning':
      return 'Conditioning focus.';
    default:
      return 'Extra focus.';
  }
}

function formatList(items: string[]) {
  if (items.length === 0) {
    return '';
  }

  if (items.length === 1) {
    return items[0];
  }

  if (items.length === 2) {
    return `${items[0]} and ${items[1]}`;
  }

  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

export function formatSecondaryOutcomeList(outcomes: SetupSecondaryOutcome[]) {
  return formatList(outcomes.map((outcome) => getSecondaryOutcomeLabel(outcome)));
}

export function formatFocusAreaList(focusAreas: SetupFocusArea[]) {
  return formatList(focusAreas.map((area) => getFocusAreaTitle(area)));
}

function normalizeWeekdays(days: SetupWeekday[]) {
  return [...new Set(days)].sort((left, right) => WEEKDAY_ORDER.indexOf(left) - WEEKDAY_ORDER.indexOf(right));
}

function roundToNearestTen(value: number) {
  return Math.round(value / 10) * 10;
}

function buildCombinationList(days: SetupWeekday[], targetSize: number): SetupWeekday[][] {
  if (targetSize <= 0) {
    return [[]];
  }

  if (days.length < targetSize) {
    return [];
  }

  if (targetSize === 1) {
    return days.map((day) => [day]);
  }

  const combinations: SetupWeekday[][] = [];
  days.forEach((day, index) => {
    const tail = buildCombinationList(days.slice(index + 1), targetSize - 1);
    tail.forEach((combination) => {
      combinations.push([day, ...combination]);
    });
  });
  return combinations;
}

function scoreWeekdayCombination(days: SetupWeekday[]) {
  const indexes = normalizeWeekdays(days).map((day) => WEEKDAY_ORDER.indexOf(day));
  const gaps = indexes.map((current, index) => {
    const next = indexes[(index + 1) % indexes.length];
    return index === indexes.length - 1 ? next + 7 - current : next - current;
  });
  const minGap = Math.min(...gaps);
  const maxGap = Math.max(...gaps);
  const gapSpread = maxGap - minGap;
  const weekdayBias = indexes.reduce((sum, value) => sum + value, 0);
  return minGap * 100 - gapSpread * 10 - weekdayBias;
}

function resolveDefaultRhythm(daysPerWeek: number) {
  if (daysPerWeek === 2 || daysPerWeek === 3 || daysPerWeek === 4 || daysPerWeek === 5) {
    return DEFAULT_RHYTHM_BY_DAYS[daysPerWeek];
  }

  return DEFAULT_RHYTHM_BY_DAYS[DEFAULT_FIRST_RUN_SELECTION.daysPerWeek];
}

export function getRecommendedWeeklyMinutes(daysPerWeek: number, estimatedSessionDuration?: number | null) {
  const fallbackSessionDuration = daysPerWeek >= 4 ? 55 : daysPerWeek === 2 ? 45 : 50;
  return roundToNearestTen(Math.max(60, daysPerWeek * (estimatedSessionDuration ?? fallbackSessionDuration)));
}

export function getWeeklyMinuteOptions(daysPerWeek: number, estimatedSessionDuration?: number | null) {
  const baseline = getRecommendedWeeklyMinutes(daysPerWeek, estimatedSessionDuration);
  const step = daysPerWeek >= 4 ? 40 : 30;
  return [...new Set([Math.max(60, baseline - step), baseline, Math.min(360, baseline + step)])];
}

export function getEffectiveWeeklyMinutes(
  selection: Pick<FirstRunSetupSelection, 'weeklyMinutes'>,
  daysPerWeek: number,
  estimatedSessionDuration?: number | null,
) {
  return typeof selection.weeklyMinutes === 'number' && selection.weeklyMinutes > 0
    ? selection.weeklyMinutes
    : getRecommendedWeeklyMinutes(daysPerWeek, estimatedSessionDuration);
}

export function resolveProjectedTrainingDays(
  selection: Pick<FirstRunSetupSelection, 'scheduleMode' | 'availableDays'>,
  daysPerWeek: number,
) {
  const defaultRhythm = resolveDefaultRhythm(daysPerWeek);
  if (selection.scheduleMode !== 'self_managed') {
    return defaultRhythm;
  }

  const normalizedDays = normalizeWeekdays(selection.availableDays);
  if (normalizedDays.length < defaultRhythm.length) {
    return defaultRhythm;
  }

  if (normalizedDays.length === defaultRhythm.length) {
    return normalizedDays;
  }

  const combinations = buildCombinationList(normalizedDays, defaultRhythm.length);
  if (combinations.length === 0) {
    return defaultRhythm;
  }

  return combinations.reduce((best, current) =>
    scoreWeekdayCombination(current) > scoreWeekdayCombination(best) ? current : best,
  );
}

export function buildScheduleFitNote(
  selection: Pick<FirstRunSetupSelection, 'scheduleMode' | 'weeklyMinutes' | 'availableDays'>,
  daysPerWeek: number,
  estimatedSessionDuration?: number | null,
) {
  const effectiveWeeklyMinutes = getEffectiveWeeklyMinutes(selection, daysPerWeek, estimatedSessionDuration);
  const recommendedWeeklyMinutes = getRecommendedWeeklyMinutes(daysPerWeek, estimatedSessionDuration);
  const requiredDays = resolveDefaultRhythm(daysPerWeek).length;

  if (selection.scheduleMode === 'self_managed' && selection.availableDays.length < requiredDays) {
    return `Pick ${requiredDays} days.`;
  }

  if (effectiveWeeklyMinutes < recommendedWeeklyMinutes - 20) {
    return 'Tight week. Shorter sessions.';
  }

  if (effectiveWeeklyMinutes > recommendedWeeklyMinutes + 40) {
    return 'Extra room this week.';
  }

  return 'This week fits well.';
}

export function buildFirstRunRecommendationReasons(
  selection: FirstRunSetupSelection,
  options: {
    projectedDaysPerWeek: number;
    estimatedSessionDuration?: number | null;
    mismatchNote?: string | null;
  },
  tailoringPreferences?: TailoringPreferencesInput | null,
) {
  return buildRecommendationReasonLines(selection, options, tailoringPreferences);
}

function buildFocusAreasPromptFragment(selection: FirstRunSetupSelection) {
  const focusAreas = formatFocusAreaList(selection.focusAreas);
  return focusAreas ? ` I also want extra focus on ${focusAreas}.` : '';
}

function buildSchedulePromptFragment(selection: FirstRunSetupSelection) {
  const scheduleMode = selection.scheduleMode ?? DEFAULT_FIRST_RUN_SELECTION.scheduleMode;
  const availableDays = Array.isArray(selection.availableDays) ? selection.availableDays : [];
  const fragments: string[] = [];

  fragments.push(
    scheduleMode === 'self_managed'
      ? 'I want to manage the training days myself'
      : 'I am happy to let Gymlog place the weekly rhythm for me',
  );

  if (typeof selection.weeklyMinutes === 'number' && selection.weeklyMinutes > 0) {
    fragments.push(`I can train about ${selection.weeklyMinutes} minutes per week`);
  }

  if (scheduleMode === 'self_managed' && availableDays.length > 0) {
    fragments.push(`the days that usually work are ${formatWeekdayList(availableDays)}`);
  }

  return fragments.length ? ` ${fragments.join(', ')}.` : '';
}

function buildGuidancePromptFragment(mode: SetupGuidanceMode) {
  switch (mode) {
    case 'done_for_me':
      return 'Gymlog to keep the path simple and mostly done for me';
    case 'guided_editable':
      return 'Gymlog to recommend the path but still leave room to edit';
    case 'self_directed':
      return 'a strong starting point before I build my own split';
    default:
      return 'a clear starting path';
  }
}

function buildWeightPromptFragment(selection: FirstRunSetupSelection) {
  const currentWeight = selection.currentWeightKg;
  const targetWeight = selection.targetWeightKg;

  if (typeof currentWeight === 'number' && typeof targetWeight === 'number') {
    return ` I am currently ${Math.round(currentWeight)} kg and aiming for ${Math.round(targetWeight)} kg.`;
  }

  if (typeof currentWeight === 'number') {
    return ` I currently weigh about ${Math.round(currentWeight)} kg.`;
  }

  if (typeof targetWeight === 'number') {
    return ` I am aiming for about ${Math.round(targetWeight)} kg.`;
  }

  return '';
}

function buildLowEquipmentMismatchNote(selection: FirstRunSetupSelection) {
  const base =
    selection.daysPerWeek === 2
      ? 'You picked a lighter equipment setup, so this is the cleanest low-equipment starting point.'
      : 'You picked a lighter equipment setup, so Gymlog recommends the closest low-equipment starting point even though the weekly rhythm is lighter than your target.';

  return selection.guidanceMode === 'self_directed'
    ? `${base} You can still use it as the base for your own custom split.`
    : base;
}

export function resolveFirstRunRecommendation(selection: FirstRunSetupSelection): FirstRunRecommendation {
  return resolveFirstRunRecommendationWithTailoring(selection, null);
}

function buildRecommendationMismatchNote(
  selection: FirstRunSetupSelection,
  featuredProgramId: string,
  tailoringPreferences?: TailoringPreferencesInput | null,
) {
  const featuredDefinition = getRecommendationProgramDefinition(featuredProgramId);
  const featuredDays = featuredDefinition?.daysPerWeek ?? getWorkoutTemplateById(featuredProgramId)?.daysPerWeek ?? selection.daysPerWeek;

  if (selection.goal === 'run_mobility' && featuredProgramId === PROGRAM_IDS.runMobility && selection.daysPerWeek > featuredDays) {
    return 'Gymlog closest match is a 3-day run + mobility split. Add Yoga Recovery as an optional 4th session if you want extra movement.';
  }

  if (selection.equipment !== 'gym' && featuredDefinition?.equipmentTier === 'low_equipment') {
    return buildLowEquipmentMismatchNote(selection);
  }

  if (featuredDays !== selection.daysPerWeek) {
    return `Gymlog closest match keeps this start at ${featuredDays} days so the week stays coherent.`;
  }

  return buildTailoringRecommendationNote(tailoringPreferences);
}

export function resolveFirstRunRecommendationWithTailoring(
  selection: FirstRunSetupSelection,
  tailoringPreferences?: TailoringPreferencesInput | null,
): FirstRunRecommendation {
  const recommendation = recommendPrograms(buildRecommendationInput(selection), tailoringPreferences);

  return {
    ...recommendation,
    mismatchNote: buildRecommendationMismatchNote(selection, recommendation.featuredProgramId, tailoringPreferences),
  };
}

export function buildFirstRunPromptSuggestions(
  selection: FirstRunSetupSelection,
  recommendationProgramName?: string | null,
) {
  const goalLabel = getGoalLabel(selection.goal);
  const recommendationLabel = recommendationProgramName ?? 'this plan';
  return [
    `Best ${selection.daysPerWeek}-day ${goalLabel} start?`,
    `${recommendationLabel} or another plan?`,
    selection.guidanceMode === 'self_directed'
      ? 'Turn this into custom?'
      : `How should I start with ${selection.daysPerWeek} days?`,
  ];
}

export function buildFirstRunHelperPrompt(
  step: FirstRunStep,
  selection: FirstRunSetupSelection,
  recommendationProgramName?: string | null,
) {
  if (step === 'location') {
    return `Best start for ${getEquipmentLabel(selection.equipment)}?`;
  }

  if (step === 'gender') {
    return 'Does gender need to change the setup?';
  }

  if (step === 'goal') {
    return `Right goal for ${selection.level} ${getGoalLabel(selection.goal)}?`;
  }

  if (step === 'profile') {
    return `Best ${selection.daysPerWeek}-day setup for me?`;
  }

  if (step === 'focus') {
    return 'Which focus should get the extra work?';
  }

  if (step === 'review') {
    return `${recommendationProgramName ?? 'This plan'} or another plan?`;
  }

  if (step === 'planning') {
    return `Best ${selection.daysPerWeek}-day setup?`;
  }

  if (step === 'about') {
    return 'Should bodyweight change the start?';
  }

  return `${recommendationProgramName ?? 'This plan'} or another plan?`;
}

export function buildFirstRunAiCoachContext(
  selection: FirstRunSetupSelection,
  readyProgramCount: number,
): AICoachTrainingContext {
  return {
    unitPreference: selection.unitPreference,
    activeSession: null,
    recentCompletedSessions: [],
    trackedLifts: [],
    latestTopSets: [],
    sessionsThisWeek: 0,
    sessionsLast30Days: 0,
    rhythm: [],
    readyProgramCount,
    recommendedProgramId: null,
    recommendedProgramTitle: null,
    customProgramTitle: null,
    plannerSetup: null,
  };
}

export function buildFirstRunCustomProgramName(selection: FirstRunSetupSelection) {
  const goalLabel =
    selection.goal === 'run_mobility'
      ? 'Run + Mobility'
      : selection.goal === 'general'
        ? 'General'
        : selection.goal === 'muscle'
          ? 'Muscle'
          : 'Strength';
  const focusLabel =
    selection.focusAreas.length > 0
      ? ` + ${selection.focusAreas
          .slice(0, 2)
          .map((area) => getFocusAreaTitle(area))
          .join(' & ')}`
      : '';

  return `My ${selection.daysPerWeek}-Day ${goalLabel}${focusLabel} Split`;
}

export function getRecommendedProgramName(programId: string | null) {
  if (!programId) {
    return null;
  }

  return getWorkoutTemplateById(programId)?.name ?? null;
}
