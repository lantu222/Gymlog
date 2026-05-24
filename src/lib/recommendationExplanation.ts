import { buildTailoringRecommendationNote, TailoringPreferencesInput } from './tailoringFit';
import type { FirstRunSetupSelection } from './firstRunSetup';
import type { RecommendationCandidate, RecommendationScoreBreakdown } from '../types/recommendation';
import type { SetupEquipment, SetupFocusArea, SetupGoal, SetupSecondaryOutcome, SetupWeekday } from '../types/models';

export interface RecommendationReasonOptions {
  projectedDaysPerWeek: number;
  estimatedSessionDuration?: number | null;
  mismatchNote?: string | null;
}

const DEFAULT_RHYTHM_BY_DAYS: Record<number, SetupWeekday[]> = {
  2: ['mon', 'thu'],
  3: ['mon', 'wed', 'fri'],
  4: ['mon', 'tue', 'thu', 'sat'],
  5: ['mon', 'tue', 'thu', 'fri', 'sat'],
};

const WEEKDAY_ORDER: SetupWeekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

const TRADEOFF_GAIN_LABELS: Record<keyof RecommendationScoreBreakdown, string> = {
  goalAlignment: 'Sharper main-goal match',
  scheduleFit: 'Easier week fit',
  equipmentFit: 'Cleaner equipment match',
  experienceFit: 'Safer readiness fit',
  genderFit: 'Better program-style match',
  preferenceFit: 'Better secondary preference fit',
  focusFit: 'More focus-area emphasis',
  contentFit: 'Cleaner workout-content match',
};

const TRADEOFF_LOSS_LABELS: Record<keyof RecommendationScoreBreakdown, string> = {
  goalAlignment: 'main-goal match',
  scheduleFit: 'week fit',
  equipmentFit: 'equipment match',
  experienceFit: 'readiness fit',
  genderFit: 'program-style match',
  preferenceFit: 'secondary preference fit',
  focusFit: 'focus-area alignment',
  contentFit: 'workout-content fit',
};

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

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function getGoalLabel(selection: Pick<FirstRunSetupSelection, 'goal' | 'currentWeightKg' | 'targetWeightKg'>) {
  switch (selection.goal) {
    case 'strength':
      return 'strength';
    case 'muscle':
      if (isNumber(selection.currentWeightKg) && isNumber(selection.targetWeightKg) && selection.targetWeightKg > selection.currentWeightKg) {
        return 'muscle gain';
      }
      return 'muscle-building';
    case 'general':
      if (isNumber(selection.currentWeightKg) && isNumber(selection.targetWeightKg) && selection.targetWeightKg < selection.currentWeightKg) {
        return 'fat-loss support';
      }
      return 'general fitness';
    case 'lean_athletic':
      return 'lean athletic training';
    case 'general_fitness':
      return 'general fitness';
    case 'run_mobility':
      return 'run + mobility';
    default:
      return 'training';
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

function getSecondaryOutcomeLabel(outcome: SetupSecondaryOutcome) {
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

function getFocusAreaTitle(area: SetupFocusArea) {
  switch (area) {
    case 'bodyweight':
      return 'Bodyweight';
    case 'arms':
      return 'Arms';
    case 'glutes':
      return 'Glutes';
    case 'quads':
      return 'Quads';
    case 'hamstrings':
      return 'Hamstrings';
    case 'calves':
      return 'Calves';
    case 'legs':
      return 'Legs';
    case 'chest':
      return 'Pecs';
    case 'shoulders':
      return 'Shoulders';
    case 'back':
      return 'Back';
    case 'core':
      return 'Abs';
    case 'mobility':
      return 'Mobility';
    case 'conditioning':
      return 'Conditioning';
    default:
      return 'Focus';
  }
}

function getWeekdayShortLabel(day: SetupWeekday) {
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

function formatWeekdayList(days: SetupWeekday[]) {
  return formatList(days.map((day) => getWeekdayShortLabel(day)));
}

function formatSecondaryOutcomeList(outcomes: SetupSecondaryOutcome[]) {
  return formatList(outcomes.map((outcome) => getSecondaryOutcomeLabel(outcome)));
}

function formatFocusAreaList(focusAreas: SetupFocusArea[]) {
  return formatList(focusAreas.map((area) => getFocusAreaTitle(area)));
}

function roundToNearestTen(value: number) {
  return Math.round(value / 10) * 10;
}

function formatWeightKg(value: number) {
  return `${Math.round(value)} kg`;
}

function buildWeightTargetReason(selection: Pick<FirstRunSetupSelection, 'goal' | 'currentWeightKg' | 'targetWeightKg'>) {
  const currentWeight = selection.currentWeightKg;
  const targetWeight = selection.targetWeightKg;

  if (!isNumber(currentWeight) || !isNumber(targetWeight) || currentWeight === targetWeight) {
    return null;
  }

  const weightRange = `${formatWeightKg(currentWeight)} to ${formatWeightKg(targetWeight)}`;

  if ((selection.goal === 'general' || selection.goal === 'lean_athletic') && targetWeight < currentWeight) {
    return `Supports a ${weightRange} fat-loss target.`;
  }

  if (selection.goal === 'muscle' && targetWeight > currentWeight) {
    return `Supports a ${weightRange} gain target.`;
  }

  if (selection.goal === 'strength') {
    return `Keeps strength primary for your ${weightRange} target.`;
  }

  return `Uses your ${weightRange} bodyweight target.`;
}

function buildGoalSpecificReason(selection: Pick<FirstRunSetupSelection, 'goal' | 'secondaryOutcomes'>) {
  if (selection.goal === 'strength' && selection.secondaryOutcomes.includes('muscle')) {
    return 'Heavy compounds with enough volume.';
  }

  if (selection.goal === 'muscle' && selection.secondaryOutcomes.includes('strength')) {
    return 'Volume with strength work kept in.';
  }

  if (selection.goal === 'strength') {
    return 'Heavy compounds first.';
  }

  if (selection.goal === 'muscle') {
    return 'Volume for size.';
  }

  if (selection.goal === 'general') {
    return 'Sustainable and low friction.';
  }

  if (selection.goal === 'lean_athletic') {
    return 'Balanced strength and conditioning.';
  }

  if (selection.goal === 'general_fitness') {
    return 'Sustainable and flexible.';
  }

  if (selection.goal === 'run_mobility') {
    return 'Run work with mobility.';
  }

  return null;
}

function shouldPreferGoalSpecificReason(selection: Pick<FirstRunSetupSelection, 'goal' | 'secondaryOutcomes'>) {
  return (
    (selection.goal === 'strength' && selection.secondaryOutcomes.includes('muscle')) ||
    (selection.goal === 'muscle' && selection.secondaryOutcomes.includes('strength'))
  );
}

function getRecommendedWeeklyMinutes(daysPerWeek: number, estimatedSessionDuration?: number | null) {
  const fallbackSessionDuration = daysPerWeek >= 4 ? 55 : daysPerWeek === 2 ? 45 : 50;
  return roundToNearestTen(Math.max(60, daysPerWeek * (estimatedSessionDuration ?? fallbackSessionDuration)));
}

function getEffectiveWeeklyMinutes(
  selection: Pick<FirstRunSetupSelection, 'weeklyMinutes'>,
  daysPerWeek: number,
  estimatedSessionDuration?: number | null,
) {
  return typeof selection.weeklyMinutes === 'number' && selection.weeklyMinutes > 0
    ? selection.weeklyMinutes
    : getRecommendedWeeklyMinutes(daysPerWeek, estimatedSessionDuration);
}

function normalizeWeekdays(days: SetupWeekday[]) {
  return [...new Set(days)].sort((left, right) => WEEKDAY_ORDER.indexOf(left) - WEEKDAY_ORDER.indexOf(right));
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

function resolveProjectedTrainingDays(
  selection: Pick<FirstRunSetupSelection, 'scheduleMode' | 'availableDays'>,
  daysPerWeek: number,
) {
  const defaultRhythm = DEFAULT_RHYTHM_BY_DAYS[daysPerWeek] ?? DEFAULT_RHYTHM_BY_DAYS[3];
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

function findStrongestDimensionDelta(
  primary: RecommendationCandidate,
  alternative: RecommendationCandidate,
  predicate: (delta: number) => boolean,
) {
  return (Object.keys(primary.breakdown) as Array<keyof RecommendationScoreBreakdown>)
    .map((dimension) => ({
      dimension,
      delta: alternative.breakdown[dimension] - primary.breakdown[dimension],
    }))
    .filter(({ delta }) => predicate(delta))
    .sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta))[0] ?? null;
}

export function buildRecommendationReasonLines(
  selection: FirstRunSetupSelection,
  options: RecommendationReasonOptions,
  tailoringPreferences?: TailoringPreferencesInput | null,
) {
  const reasons: string[] = [];
  const projectedDays = options.projectedDaysPerWeek;
  const weeklyMinutes = getEffectiveWeeklyMinutes(selection, projectedDays, options.estimatedSessionDuration ?? null);
  const scheduleDays =
    selection.scheduleMode === 'self_managed' && selection.availableDays.length > 0
      ? formatWeekdayList(resolveProjectedTrainingDays(selection, projectedDays))
      : null;
  const outcomeSummary = formatSecondaryOutcomeList(
    selection.secondaryOutcomes.filter((outcome) => outcome !== 'consistency'),
  );
  const focusSummary = formatFocusAreaList(selection.focusAreas);
  const weightTargetReason = buildWeightTargetReason(selection);
  const goalSpecificReason = buildGoalSpecificReason(selection);

  reasons.push(`${projectedDays} days for ${getGoalLabel(selection)}.`);

  if (selection.equipment !== 'gym') {
    reasons.push(`Built for ${getEquipmentLabel(selection.equipment)}.`);
  } else if (selection.scheduleMode === 'self_managed' && scheduleDays) {
    reasons.push(`${weeklyMinutes} min across ${scheduleDays}.`);
  } else {
    reasons.push(`About ${weeklyMinutes} min this week.`);
  }

  if (focusSummary) {
    reasons.push(`Extra focus: ${focusSummary}.`);
  } else if (weightTargetReason) {
    reasons.push(weightTargetReason);
  } else if (goalSpecificReason && shouldPreferGoalSpecificReason(selection)) {
    reasons.push(goalSpecificReason);
  } else if (outcomeSummary) {
    reasons.push(`Also keeps ${outcomeSummary}.`);
  } else if (goalSpecificReason) {
    reasons.push(goalSpecificReason);
  } else if (selection.guidanceMode === 'self_directed') {
    reasons.push('Easy to turn into custom.');
  } else if (selection.guidanceMode === 'done_for_me') {
    reasons.push('Simple start.');
  } else {
    reasons.push('Easy to edit later.');
  }

  if (options.mismatchNote) {
    reasons.push(options.mismatchNote.replace('This is the closest match right now.', 'Closest match.'));
  }

  const tailoringNote = buildTailoringRecommendationNote(tailoringPreferences);
  if (tailoringNote) {
    reasons.push(tailoringNote);
  }

  return reasons.slice(0, 4);
}

export function buildRecommendationTradeoffLabel(
  primaryCandidate: RecommendationCandidate,
  alternativeCandidate: RecommendationCandidate,
) {
  const strongestGain = findStrongestDimensionDelta(primaryCandidate, alternativeCandidate, (delta) => delta > 0);
  const strongestLoss = findStrongestDimensionDelta(primaryCandidate, alternativeCandidate, (delta) => delta < 0);

  if (!strongestGain && !strongestLoss) {
    return 'Very close overall, with a slightly different training feel.';
  }

  if (strongestGain && strongestLoss) {
    return `${TRADEOFF_GAIN_LABELS[strongestGain.dimension]}, but a softer ${TRADEOFF_LOSS_LABELS[strongestLoss.dimension]}.`;
  }

  if (strongestGain) {
    return `${TRADEOFF_GAIN_LABELS[strongestGain.dimension]} if that tradeoff matters more to you.`;
  }

  return `Very close overall, but with a softer ${TRADEOFF_LOSS_LABELS[strongestLoss.dimension]}.`;
}
