import { getWorkoutTemplateById } from '../features/workout/workoutCatalog';
import { formatWorkoutDisplayLabel } from './displayLabel';
import { getRecommendationProgrammeSummary } from './recommendationProgramme';
import { buildRecommendationWeeklyStructure, RecommendationWeeklyStructureDaySource } from './recommendationWeeklyStructure';
import {
  buildFirstRunHelperPrompt,
  buildFirstRunRecommendationReasons,
  buildScheduleFitNote,
  FirstRunSetupSelection,
  getEffectiveWeeklyMinutes,
  getScheduleModeLabel,
  resolveFirstRunRecommendation,
} from './firstRunSetup';

export type StartingWeekSource = 'first_run' | 'edit' | 'active';

export interface StartingWeekSessionPreview {
  id: string;
  weekdayLabel: string;
  name: string;
  meta: string;
  keyLifts: string[];
  source?: RecommendationWeeklyStructureDaySource;
  note?: string | null;
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
  programmeSummary: string | null;
  weeklyStructureSummary: string;
  hasSupplementalDays: boolean;
  rhythm: string[];
  reasons: string[];
  sessions: StartingWeekSessionPreview[];
  helperPrompt: string;
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
  const weeklyStructure = buildRecommendationWeeklyStructure(selection, recommendedProgramId);
  if (!weeklyStructure) {
    return null;
  }

  const projectedDaysPerWeek = template.daysPerWeek;
  const rhythm = weeklyStructure.days.map((day) => day.weekdayLabel);
  const weeklyMinutes = weeklyStructure.hasSupplementalDays
    ? weeklyStructure.totalEstimatedMinutes
    : getEffectiveWeeklyMinutes(selection, projectedDaysPerWeek, template.estimatedSessionDuration ?? null);
  const programmeSummary = getRecommendationProgrammeSummary(template.id);
  const reasons = buildFirstRunRecommendationReasons(selection, {
    projectedDaysPerWeek,
    estimatedSessionDuration: template.estimatedSessionDuration ?? null,
    mismatchNote,
  });
  const sessions = weeklyStructure.days.map((day) => ({
    id: day.id,
    weekdayLabel: day.weekdayLabel,
    name: day.name,
    meta: day.meta,
    keyLifts: day.keyLifts,
    source: day.source,
    note: day.note,
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
    daysPerWeek: weeklyStructure.days.length,
    weeklyMinutes,
    scheduleModeLabel: getScheduleModeLabel(selection.scheduleMode),
    scheduleFitNote: buildScheduleFitNote(selection, projectedDaysPerWeek, template.estimatedSessionDuration ?? null),
    programmeSummary,
    weeklyStructureSummary: weeklyStructure.summary,
    hasSupplementalDays: weeklyStructure.hasSupplementalDays,
    rhythm,
    reasons: reasons.slice(0, 3),
    sessions,
    helperPrompt: buildFirstRunHelperPrompt('recommendation', selection, template.name),
  };
}
