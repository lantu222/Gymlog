import { AppDatabase, SetupWeekday, WorkoutPlan, WorkoutTemplate } from '../types/models';
import { FitnessPhotoKey } from '../assets/fitnessPhotos';
import { formatWorkoutDisplayLabel } from './displayLabel';
import { pluralize } from './format';
import { getActivePlan } from './progression';
import { FirstRunSetupSelection, getWeekdayShortLabel, resolveProjectedTrainingDays } from './firstRunSetup';

export interface HomeQuickStat {
  label: string;
  value: string;
}

export interface HomeUpcomingSession {
  label: string;
  title: string;
  meta?: string;
}

export interface HomeHeroVisual {
  chips: string[];
  planLabel?: string;
  title: string;
  durationLabel?: string;
  detail?: string;
  photoKey: FitnessPhotoKey;
}

type ReadyLikeTemplate = {
  id: string;
  name: string;
  sessions: Array<{ id: string; name: string }>;
  daysPerWeek?: number;
  estimatedSessionDuration?: number;
  level?: string;
  goalType?: string;
};

const WEEKDAY_INDEX: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
  sunnuntai: 0,
  maanantai: 1,
  tiistai: 2,
  keskiviikko: 3,
  torstai: 4,
  perjantai: 5,
  lauantai: 6,
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
  su: 0,
  ma: 1,
  ti: 2,
  ke: 3,
  to: 4,
  pe: 5,
  la: 6,
};

function getWeekdayIndex(label: string) {
  const normalized = label.trim().toLowerCase();
  return WEEKDAY_INDEX[normalized] ?? 99;
}

function getGoalPhotoKey(template: { name: string; goalType?: string }): FitnessPhotoKey {
  const name = template.name.toLowerCase();
  if (name.includes('run') || name.includes('jog') || name.includes('cardio')) {
    return 'running';
  }
  if (name.includes('recovery') || name.includes('mobility') || name.includes('stretch')) {
    return 'recovery';
  }
  if (name.includes('hiit') || name.includes('conditioning')) {
    return 'hiit';
  }
  switch (template.goalType) {
    case 'strength':
      return 'strength';
    case 'hypertrophy':
      return 'strength';
    case 'general':
      return 'hiit';
    default:
      break;
  }
  return 'strength';
}

function sortPlanEntries(plan: WorkoutPlan) {
  return [...plan.entries].sort((left, right) => {
    const leftIndex = getWeekdayIndex(left.label);
    const rightIndex = getWeekdayIndex(right.label);
    return leftIndex - rightIndex || left.orderIndex - right.orderIndex;
  });
}

function resolveTemplate(
  templateId: string,
  readyTemplates: ReadyLikeTemplate[],
  customTemplates: WorkoutTemplate[],
) {
  return (
    readyTemplates.find((template) => template.id === templateId) ??
    customTemplates.find((template) => template.id === templateId) ??
    null
  );
}

export function buildHomeQuickStats(input: {
  sessionsThisWeek: number;
  streakValue: string;
  streakLabel: string;
  deltaValue?: string | null;
}) {
  const stats: HomeQuickStat[] = [
    {
      label: 'This week',
      value: `${input.sessionsThisWeek} sessions`,
    },
    {
      label: 'Streak',
      value: `${input.streakValue} wk`,
    },
  ];

  if (input.deltaValue) {
    stats.push({
      label: 'Progress',
      value: input.deltaValue,
    });
  }

  return stats;
}

export function buildHomeUpcomingSessions(input: {
  database: AppDatabase;
  readyTemplates: ReadyLikeTemplate[];
  customTemplates: WorkoutTemplate[];
  setupSelection: FirstRunSetupSelection | null;
  recommendedReadyTemplate: ReadyLikeTemplate | null;
  limit?: number;
}) {
  const { database, readyTemplates, customTemplates, setupSelection, recommendedReadyTemplate, limit = 3 } = input;
  const activePlan = getActivePlan(database);

  if (activePlan?.entries.length) {
    return sortPlanEntries(activePlan)
      .map((entry) => {
        const template = resolveTemplate(entry.workoutTemplateId, readyTemplates, customTemplates);
        if (!template) {
          return null;
        }

        return {
          label: entry.label.slice(0, 3),
          title: formatWorkoutDisplayLabel(template.sessions[0]?.name ?? template.name, 'Workout'),
          meta:
            formatWorkoutDisplayLabel(template.sessions[0]?.name ?? template.name, 'Workout') ===
            formatWorkoutDisplayLabel(template.name, 'Workout')
              ? undefined
              : formatWorkoutDisplayLabel(template.name, 'Workout'),
        } satisfies HomeUpcomingSession;
      })
      .filter(Boolean)
      .map((item) => item as HomeUpcomingSession)
      .slice(0, limit);
  }

  if (recommendedReadyTemplate && setupSelection) {
    const projectedDays = resolveProjectedTrainingDays(setupSelection, recommendedReadyTemplate.daysPerWeek ?? 3);
    return recommendedReadyTemplate.sessions.slice(0, limit).map((session, index) => ({
      label: getWeekdayShortLabel(projectedDays[index] ?? ('mon' as SetupWeekday)),
      title: formatWorkoutDisplayLabel(session.name, 'Workout'),
      meta:
        formatWorkoutDisplayLabel(session.name, 'Workout') ===
        formatWorkoutDisplayLabel(recommendedReadyTemplate.name, 'Workout')
          ? undefined
          : formatWorkoutDisplayLabel(recommendedReadyTemplate.name, 'Workout'),
    }));
  }

  if (recommendedReadyTemplate) {
    return recommendedReadyTemplate.sessions.slice(0, limit).map((session, index) => ({
      label: ['Mon', 'Thu', 'Sat'][index] ?? 'Day',
      title: formatWorkoutDisplayLabel(session.name, 'Workout'),
      meta:
        formatWorkoutDisplayLabel(session.name, 'Workout') ===
        formatWorkoutDisplayLabel(recommendedReadyTemplate.name, 'Workout')
          ? undefined
          : formatWorkoutDisplayLabel(recommendedReadyTemplate.name, 'Workout'),
    }));
  }

  return [];
}

export function buildHomeHeroVisual(input: {
  primaryCard: {
    mode: 'resume' | 'start' | 'empty';
    eyebrow: string;
    title: string;
    subtitle: string;
    meta?: string;
  };
  primaryTarget:
    | { type: 'resume_active' }
    | { type: 'open_program'; source: 'ready' | 'custom'; workoutTemplateId: string }
    | { type: 'open_ready_library' };
  readyTemplates: ReadyLikeTemplate[];
  customTemplates: WorkoutTemplate[];
}) {
  const metaParts = (input.primaryCard.meta ?? '')
    .split('|')
    .map((part) => part.trim())
    .filter(Boolean);

  if (input.primaryTarget.type === 'open_program') {
    const template = resolveTemplate(input.primaryTarget.workoutTemplateId, input.readyTemplates, input.customTemplates);
    if (template) {
      const readyTemplate = template as ReadyLikeTemplate;
      const nextSessionTitle = formatWorkoutDisplayLabel(template.sessions[0]?.name ?? template.name, 'Workout');
      return {
        chips: [],
        planLabel: undefined,
        title: 'Week rhythm',
        durationLabel:
          typeof readyTemplate.estimatedSessionDuration === 'number'
            ? `${readyTemplate.estimatedSessionDuration} min`
            : undefined,
        detail:
          formatWorkoutDisplayLabel(template.name, 'Workout') === nextSessionTitle
            ? 'Open the plan or adjust the week.'
            : `${formatWorkoutDisplayLabel(template.name, 'Workout')} is lined up next.`,
        photoKey: getGoalPhotoKey(readyTemplate),
      } satisfies HomeHeroVisual;
    }
  }

  return {
    chips: [],
    planLabel: undefined,
    title: 'Week rhythm',
    durationLabel: metaParts[1],
    detail: input.primaryCard.subtitle,
    photoKey: 'strength',
  } satisfies HomeHeroVisual;
}
