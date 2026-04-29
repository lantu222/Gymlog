import { getWorkoutTemplateById } from '../features/workout/workoutCatalog';
import { formatLiftDisplayLabel } from './displayLabel';
import {
  FirstRunSetupSelection,
  getWeekdayShortLabel,
  resolveProjectedTrainingDays,
} from './firstRunSetup';

export type RecommendationWeeklyStructureDaySource = 'template' | 'suggested';

export interface RecommendationWeeklyStructureDay {
  id: string;
  weekdayLabel: string;
  name: string;
  meta: string;
  keyLifts: string[];
  source: RecommendationWeeklyStructureDaySource;
  note: string | null;
}

export interface RecommendationWeeklyStructure {
  programDaysPerWeek: number;
  requestedDaysPerWeek: number;
  totalEstimatedMinutes: number;
  hasSupplementalDays: boolean;
  summary: string;
  days: RecommendationWeeklyStructureDay[];
}

function pluralize(count: number, label: string) {
  return `${count} ${label}${count === 1 ? '' : 's'}`;
}

function getSuggestedDayMeta(minutes: number) {
  return `${minutes} min - optional`;
}

function buildStrengthSupplementalDay(index: number): Omit<RecommendationWeeklyStructureDay, 'id' | 'weekdayLabel'> {
  return {
    name: index === 0 ? 'Accessory Strength Day' : 'Recovery Strength Day',
    meta: getSuggestedDayMeta(index === 0 ? 30 : 25),
    keyLifts: index === 0 ? ['Arms', 'Core', 'Upper back'] : ['Mobility', 'Easy carries'],
    source: 'suggested',
    note: index === 0 ? 'Optional 5th day for accessories without replacing the strength base.' : 'Keep this easy so the main lifts recover.',
  };
}

function buildEnduranceSupplementalDay(index: number): Omit<RecommendationWeeklyStructureDay, 'id' | 'weekdayLabel'> {
  if (index === 0) {
    return {
      name: 'Easy Run Add-On',
      meta: getSuggestedDayMeta(30),
      keyLifts: ['Easy run', 'Strides'],
      source: 'suggested',
      note: 'Keep the pace conversational.',
    };
  }

  return {
    name: 'Long Run Add-On',
    meta: getSuggestedDayMeta(45),
    keyLifts: ['Long run', 'Mobility'],
    source: 'suggested',
    note: 'Build distance gradually and keep it easier than tempo day.',
  };
}

function buildHomeMuscleSupplementalDay(index: number): Omit<RecommendationWeeklyStructureDay, 'id' | 'weekdayLabel'> {
  if (index === 0) {
    return {
      name: 'Bodyweight Volume Day',
      meta: getSuggestedDayMeta(25),
      keyLifts: ['Push-ups', 'Split squats', 'Core'],
      source: 'suggested',
      note: 'Adds muscle-friendly volume without needing full-gym equipment.',
    };
  }

  return {
    name: 'Conditioning + Mobility Day',
    meta: getSuggestedDayMeta(25),
    keyLifts: ['Intervals', 'Mobility'],
    source: 'suggested',
    note: 'Keeps the week active without adding heavy fatigue.',
  };
}

function buildDefaultSupplementalDay(index: number): Omit<RecommendationWeeklyStructureDay, 'id' | 'weekdayLabel'> {
  return {
    name: index === 0 ? 'Recovery + Mobility Day' : 'Easy Conditioning Day',
    meta: getSuggestedDayMeta(25),
    keyLifts: index === 0 ? ['Mobility', 'Core'] : ['Easy cardio', 'Stretching'],
    source: 'suggested',
    note: 'Optional day to fill the selected weekly rhythm.',
  };
}

function buildSupplementalDay(
  selection: FirstRunSetupSelection,
  programId: string,
  index: number,
): Omit<RecommendationWeeklyStructureDay, 'id' | 'weekdayLabel'> {
  if (selection.goal === 'strength') {
    return buildStrengthSupplementalDay(index);
  }

  if (selection.goal === 'run_mobility' || programId === 'tpl_3_day_run_mobility_v1') {
    return buildEnduranceSupplementalDay(index);
  }

  if (selection.equipment === 'home' && selection.goal === 'muscle') {
    return buildHomeMuscleSupplementalDay(index);
  }

  return buildDefaultSupplementalDay(index);
}

function parseMinutes(meta: string) {
  const match = meta.match(/^(\d+)/);
  return match ? Number(match[1]) : 0;
}

function buildSummary(selection: FirstRunSetupSelection, programDaysPerWeek: number, supplementalCount: number) {
  if (supplementalCount <= 0) {
    return `Matches your ${programDaysPerWeek}-day weekly structure.`;
  }

  if (selection.goal === 'strength') {
    return `Uses the ${programDaysPerWeek}-day strength plan as the base with an optional ${selection.daysPerWeek}th accessory day.`;
  }

  if (selection.goal === 'run_mobility') {
    return `Uses the ${programDaysPerWeek}-day run + mobility base with ${supplementalCount} optional concrete add-on ${supplementalCount === 1 ? 'day' : 'days'}.`;
  }

  if (selection.equipment === 'home' && selection.goal === 'muscle') {
    return `Uses the ${programDaysPerWeek}-day home-friendly base with ${supplementalCount} optional extra ${supplementalCount === 1 ? 'day' : 'days'}.`;
  }

  return `Uses the ${programDaysPerWeek}-day base with ${supplementalCount} optional extra ${supplementalCount === 1 ? 'day' : 'days'}.`;
}

export function buildRecommendationWeeklyStructure(
  selection: FirstRunSetupSelection,
  recommendedProgramId: string,
): RecommendationWeeklyStructure | null {
  const template = getWorkoutTemplateById(recommendedProgramId);
  if (!template) {
    return null;
  }

  const requestedDaysPerWeek = selection.daysPerWeek;
  const programDaysPerWeek = template.daysPerWeek;
  const plannedDaysPerWeek = Math.max(programDaysPerWeek, requestedDaysPerWeek);
  const rhythm = resolveProjectedTrainingDays(selection, plannedDaysPerWeek).map((day) => getWeekdayShortLabel(day));
  const templateDays = [...template.sessions]
    .sort((left, right) => left.orderIndex - right.orderIndex)
    .map((session, index): RecommendationWeeklyStructureDay => ({
      id: session.id,
      weekdayLabel: rhythm[index] ?? `Day ${index + 1}`,
      name: session.name,
      meta: `${template.estimatedSessionDuration} min - ${pluralize(session.exercises.length, 'exercise')}`,
      keyLifts: session.exercises.slice(0, 2).map((exercise) => formatLiftDisplayLabel(exercise.exerciseName)),
      source: 'template',
      note: null,
    }));
  const supplementalCount = Math.max(0, plannedDaysPerWeek - templateDays.length);
  const supplementalDays = Array.from({ length: supplementalCount }, (_, index): RecommendationWeeklyStructureDay => {
    const supplemental = buildSupplementalDay(selection, template.id, index);
    const dayIndex = templateDays.length + index;

    return {
      id: `${template.id}-suggested-${index + 1}`,
      weekdayLabel: rhythm[dayIndex] ?? `Day ${dayIndex + 1}`,
      ...supplemental,
    };
  });
  const days = [...templateDays, ...supplementalDays].slice(0, plannedDaysPerWeek);
  const totalEstimatedMinutes = days.reduce((total, day) => total + parseMinutes(day.meta), 0);

  return {
    programDaysPerWeek,
    requestedDaysPerWeek,
    totalEstimatedMinutes,
    hasSupplementalDays: supplementalDays.length > 0,
    summary: buildSummary(selection, programDaysPerWeek, supplementalDays.length),
    days,
  };
}
