import { getWorkoutTemplateById } from '../features/workout/workoutCatalog';
import { formatLiftDisplayLabel, formatWorkoutDisplayLabel } from './displayLabel';
import {
  buildFirstRunHelperPrompt,
  buildFirstRunRecommendationReasons,
  buildScheduleFitNote,
  FirstRunSetupSelection,
  getEffectiveWeeklyMinutes,
  getScheduleModeLabel,
  getWeekdayShortLabel,
  resolveFirstRunRecommendation,
  resolveProjectedTrainingDays,
} from './firstRunSetup';

export type StartingWeekSource = 'first_run' | 'edit' | 'active';

export interface StartingWeekSessionPreview {
  id: string;
  weekdayLabel: string;
  name: string;
  meta: string;
  keyLifts: string[];
}

export interface StartingWeekViewModel {
  source: StartingWeekSource;
  title: string;
  subtitle: string;
  programId: string;
  programName: string;
  daysPerWeek: number;
  weeklyMinutes: number;
  scheduleModeLabel: string;
  scheduleFitNote: string;
  rhythm: string[];
  reasons: string[];
  sessions: StartingWeekSessionPreview[];
  helperPrompt: string;
}

function pluralize(count: number, label: string) {
  return `${count} ${label}${count === 1 ? '' : 's'}`;
}

export function buildStartingWeekView(
  selection: FirstRunSetupSelection,
  recommendedProgramId: string,
  source: StartingWeekSource = 'first_run',
): StartingWeekViewModel | null {
  const template = getWorkoutTemplateById(recommendedProgramId);
  if (!template) {
    return null;
  }

  const recommendation = resolveFirstRunRecommendation(selection);
  const mismatchNote = recommendation.featuredProgramId === recommendedProgramId ? recommendation.mismatchNote : null;
  const projectedDaysPerWeek = template.daysPerWeek;
  const rhythm = resolveProjectedTrainingDays(selection, projectedDaysPerWeek).map((day) => getWeekdayShortLabel(day));
  const weeklyMinutes = getEffectiveWeeklyMinutes(selection, projectedDaysPerWeek, template.estimatedSessionDuration ?? null);
  const reasons = buildFirstRunRecommendationReasons(selection, {
    projectedDaysPerWeek,
    estimatedSessionDuration: template.estimatedSessionDuration ?? null,
    mismatchNote,
  });
  const sessions = [...template.sessions]
    .sort((left, right) => left.orderIndex - right.orderIndex)
    .slice(0, 3)
    .map((session, index) => ({
      id: session.id,
      weekdayLabel: rhythm[index] ?? `Day ${index + 1}`,
      name: session.name,
      meta: `${template.estimatedSessionDuration} min · ${pluralize(session.exercises.length, 'exercise')}`,
      keyLifts: session.exercises.slice(0, 2).map((exercise) => formatLiftDisplayLabel(exercise.exerciseName)),
    }));

  return {
    source,
    title:
      source === 'edit'
        ? 'Your updated week'
        : source === 'active'
          ? 'Your week right now'
          : 'Your starting week',
    subtitle:
      source === 'edit'
        ? 'This is where your setup changes point now.'
        : source === 'active'
          ? 'This live session belongs to this week.'
          : 'This is the first week Gymlog would run with you.',
    programId: template.id,
    programName: formatWorkoutDisplayLabel(template.name, 'Ready program'),
    daysPerWeek: template.daysPerWeek,
    weeklyMinutes,
    scheduleModeLabel: getScheduleModeLabel(selection.scheduleMode),
    scheduleFitNote: buildScheduleFitNote(selection, projectedDaysPerWeek, template.estimatedSessionDuration ?? null),
    rhythm,
    reasons: reasons.slice(0, 3),
    sessions,
    helperPrompt: buildFirstRunHelperPrompt('recommendation', selection, template.name),
  };
}
