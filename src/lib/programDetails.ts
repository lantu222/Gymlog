import { WorkoutRole, WorkoutRuntimeTemplate, WorkoutTemplateSession, WorkoutTemplateV1 } from '../features/workout/workoutTypes';
import { ProgramInsightSummary } from './programInsights';
import { getRecommendationProgrammeSummary } from './recommendationProgramme';
import { getReadyProgramContent, ReadyProgramContentSection } from './readyProgramContent';

export type ProgramDetailSource = 'ready' | 'custom';

export interface ProgramDetailHighlightItem {
  label: string;
  value: string;
  detail?: string | null;
}

export interface ProgramDetailExerciseItem {
  id: string;
  name: string;
  role: WorkoutRole;
  prescription: string;
}

export interface ProgramDetailSessionItem {
  id: string;
  name: string;
  orderIndex: number;
  exerciseCount: number;
  preview: string;
  focus: string | null;
  statusLine: string | null;
  exercises: ProgramDetailExerciseItem[];
}

export interface ProgramDetailViewModel {
  id: string;
  source: ProgramDetailSource;
  title: string;
  subtitle: string;
  description: string;
  badges: string[];
  tailoringBadges: string[];
  highlights: ProgramDetailHighlightItem[];
  infoSections: ReadyProgramContentSection[];
  progressionSummary: string | null;
  primaryActionLabel: string;
  sessionActionLabel: string;
  sessions: ProgramDetailSessionItem[];
}

function titleCase(value: string) {
  return value
    .split('_')
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(' ');
}

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return count === 1 ? singular : plural;
}

function buildPrescription(repsMin: number, repsMax: number, sets: number) {
  return `${sets} ${pluralize(sets, 'set')} x ${repsMin}-${repsMax} reps`;
}

function buildSessionPreview(exercises: Array<{ exerciseName: string }>) {
  return exercises.slice(0, 3).map((exercise) => exercise.exerciseName).join(' | ');
}

function buildSessionItems(
  sessions: WorkoutTemplateSession[],
  sessionFocusById: Record<string, string> = {},
  sessionStatusById: Record<string, string> = {},
): ProgramDetailSessionItem[] {
  return [...sessions]
    .sort((left, right) => left.orderIndex - right.orderIndex)
    .map((session) => ({
      id: session.id,
      name: session.name,
      orderIndex: session.orderIndex,
      exerciseCount: session.exercises.length,
      preview: buildSessionPreview(session.exercises),
      focus: sessionFocusById[session.id] ?? null,
      statusLine: sessionStatusById[session.id] ?? null,
      exercises: session.exercises.map((exercise) => ({
        id: exercise.id,
        name: exercise.exerciseName,
        role: exercise.role,
        prescription: buildPrescription(exercise.repsMin, exercise.repsMax, exercise.sets),
      })),
    }));
}

export function buildReadyProgramDetail(
  template: WorkoutTemplateV1,
  insights?: ProgramInsightSummary,
  fitExplanation?: string | null,
  tailoringBadges: string[] = [],
): ProgramDetailViewModel {
  const goal = titleCase(template.goalType);
  const level = titleCase(template.level);
  const content = getReadyProgramContent(template.id);
  const programmeSummary = getRecommendationProgrammeSummary(template.id);

  return {
    id: template.id,
    source: 'ready',
    title: template.name,
    subtitle: `${goal} | ${level} | ${template.daysPerWeek} ${pluralize(template.daysPerWeek, 'day')} / week`,
    description:
      content?.summary ??
      `${titleCase(template.splitType)} program with ${template.sessions.length} sessions and repeatable progression rules for consistent logging.`,
    badges: [
      goal,
      level,
      `${template.daysPerWeek} ${pluralize(template.daysPerWeek, 'day')}`,
      `${template.estimatedSessionDuration} min`,
    ],
    tailoringBadges,
    highlights: insights?.highlights ?? [],
    infoSections: content
      ? [
          ...(fitExplanation ? [{ kicker: 'Why it fits', body: fitExplanation }] : []),
          { kicker: 'Who it fits', body: content.audience },
          { kicker: 'Equipment', body: content.equipmentProfile },
          { kicker: 'Why it works', body: content.whyItWorks },
        ]
      : fitExplanation
        ? [{ kicker: 'Why it fits', body: fitExplanation }]
        : [],
    progressionSummary: [programmeSummary, template.progressionRules.primary].filter(Boolean).join(' '),
    primaryActionLabel: 'Start first session',
    sessionActionLabel: 'Start session',
    sessions: buildSessionItems(template.sessions, content?.sessionFocusById, insights?.sessionStatusById),
  };
}

export function buildCustomProgramDetail(
  template: WorkoutRuntimeTemplate,
  insights?: ProgramInsightSummary,
): ProgramDetailViewModel {
  const sessionCount = template.sessions.length;
  const exerciseCount = template.sessions.reduce((sum, session) => sum + session.exercises.length, 0);
  const hasExercises = exerciseCount > 0;

  return {
    id: template.id,
    source: 'custom',
    title: template.name,
    subtitle: `Custom program | ${sessionCount} ${pluralize(sessionCount, 'session')} | ${exerciseCount} ${pluralize(exerciseCount, 'exercise')}`,
    description: 'Built from your own sessions and set ranges. Open it to edit, or start the exact session you want to log.',
    badges: ['Custom', `${sessionCount} ${pluralize(sessionCount, 'session')}`, `${exerciseCount} ${pluralize(exerciseCount, 'exercise')}`],
    tailoringBadges: [],
    highlights: insights?.highlights ?? [],
    infoSections: [],
    progressionSummary: null,
    primaryActionLabel: hasExercises ? 'Start first session' : 'Edit template',
    sessionActionLabel: hasExercises ? 'Start session' : 'Open session',
    sessions: buildSessionItems(template.sessions, {}, insights?.sessionStatusById),
  };
}

export function buildReadySessionRuntimeTemplate(template: WorkoutTemplateV1, sessionId: string): WorkoutRuntimeTemplate {
  const session = template.sessions.find((item) => item.id === sessionId) ?? template.sessions[0];
  if (!session) {
    throw new Error(`Ready template ${template.id} has no sessions.`);
  }

  return {
    id: template.id,
    name: `${template.name} - ${session.name}`,
    defaultScheduleMode: template.defaultScheduleMode,
    sessions: [
      {
        ...session,
        exercises: session.exercises.map((exercise) => ({ ...exercise })),
      },
    ],
  };
}

export function buildCustomSessionRuntimeTemplate(template: WorkoutRuntimeTemplate, sessionId: string): WorkoutRuntimeTemplate {
  const session = template.sessions.find((item) => item.id === sessionId) ?? template.sessions[0];
  if (!session) {
    throw new Error(`Custom template ${template.id} has no sessions.`);
  }

  return {
    ...template,
    name: `${template.name} - ${session.name}`,
    sessions: [
      {
        ...session,
        exercises: session.exercises.map((exercise) => ({ ...exercise })),
      },
    ],
  };
}
