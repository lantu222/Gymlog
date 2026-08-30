import {
  isTimedTrackingMode,
  WorkoutRole,
  WorkoutRuntimeTemplate,
  WorkoutTemplateSession,
  WorkoutTemplateV1,
  WorkoutTrackingMode,
} from '../features/workout/workoutTypes';
import { t } from './i18n';
import { ComposedProgramWeek } from './programDayComposer';
import { ProgramInsightSummary } from './programInsights';
import { getRecommendationProgrammeSummary } from './recommendationProgramme';
import { getReadyProgramContent, ReadyProgramContentSection } from './readyProgramContent';
import { buildSessionGuidance, SessionGuidance } from './sessionGuidance';
import type { AppLanguage } from '../types/models';
import { removeTrailingZeros } from './format';

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
  sets: number;
  /**
   * The numbers behind `prescription`, carried so the day screen can offer a
   * stepper on them. The string is for reading; these are for editing.
   */
  repMin: number;
  repMax: number;
  /** A hold is prescribed in seconds, and its stepper has to say so. */
  timed: boolean;
  prescription: string;
  /** "tauko"-less rest range, e.g. "45–105 s" or "1,5–2,5 min". */
  restLabel: string;
  /** The lower bound in seconds — what the dose sheet's rest stepper edits. */
  restSeconds: number;
  /** Carried so the day view can offer the same swap the session honours. */
  slotId?: string;
  substitutionGroup?: string;
}

export interface ProgramDetailSessionItem {
  id: string;
  name: string;
  orderIndex: number;
  exerciseCount: number;
  totalSets: number;
  preview: string;
  guidance: SessionGuidance | null;
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

/**
 * "4 × 3–5", the way a program is written down.
 *
 * It read "4 sets x 3-5 reps", which is two English words on every row of a
 * Finnish screen — and longer than the thing it describes. The design writes
 * it in numbers, which needs no language at all.
 */
function buildPrescription(
  repsMin: number,
  repsMax: number,
  sets: number,
  trackingMode: WorkoutTrackingMode,
) {
  const reps = repsMin === repsMax ? `${repsMin}` : `${repsMin}–${repsMax}`;
  // A hold's numbers are seconds. Without the unit the catalog's own
  // "Plank 3x30-60" read as sixty repetitions.
  return isTimedTrackingMode(trackingMode) ? `${sets} × ${reps} s` : `${sets} × ${reps}`;
}

/**
 * "tauko 45–105 s" / "tauko 1,5–2,5 min" — seconds until the minute reads
 * cleaner, matching the design's day view.
 */
function buildRestLabel(minSeconds: number, maxSeconds: number): string {
  const lo = Math.max(0, minSeconds);
  const hi = Math.max(lo, maxSeconds);
  if (hi < 120) {
    return lo === hi ? `${lo} s` : `${lo}–${hi} s`;
  }
  const toMin = (value: number) => {
    const minutes = value / 60;
    return Number.isInteger(minutes) ? `${minutes}` : removeTrailingZeros(Number(minutes.toFixed(1)));
  };
  return lo === hi ? `${toMin(lo)} min` : `${toMin(lo)}–${toMin(hi)} min`;
}

function buildSessionPreview(exercises: Array<{ exerciseName: string }>) {
  return exercises.slice(0, 3).map((exercise) => exercise.exerciseName).join(' | ');
}

function buildSessionItems(
  sessions: WorkoutTemplateSession[],
  sessionStatusById: Record<string, string> = {},
  template?: WorkoutTemplateV1,
): ProgramDetailSessionItem[] {
  return [...sessions]
    .sort((left, right) => left.orderIndex - right.orderIndex)
    .map((session) => ({
      id: session.id,
      name: session.name,
      orderIndex: session.orderIndex,
      exerciseCount: session.exercises.length,
      preview: buildSessionPreview(session.exercises),
      guidance: template ? buildSessionGuidance(template, session) : null,
      statusLine: sessionStatusById[session.id] ?? null,
      totalSets: session.exercises.reduce((sum, exercise) => sum + exercise.sets, 0),
      exercises: session.exercises.map((exercise) => ({
        id: exercise.id,
        name: exercise.exerciseName,
        role: exercise.role,
        sets: exercise.sets,
        repMin: exercise.repsMin,
        repMax: exercise.repsMax,
        timed: isTimedTrackingMode(exercise.trackingMode),
        prescription: buildPrescription(exercise.repsMin, exercise.repsMax, exercise.sets, exercise.trackingMode),
        restLabel: buildRestLabel(exercise.restSecondsMin, exercise.restSecondsMax),
        restSeconds: exercise.restSecondsMin,
        slotId: exercise.slotId,
        substitutionGroup: exercise.substitutionGroup,
      })),
    }));
}

export function buildReadyProgramDetail(
  template: WorkoutTemplateV1,
  insights?: ProgramInsightSummary,
  fitExplanation?: string | null,
  tailoringBadges: string[] = [],
  /**
   * The user's composed week for this program, when it is their active plan.
   * The detail must describe the plan they actually run — composed day count
   * and composed sessions — not the raw catalog template (truth-plan rule).
   */
  composedWeek?: ComposedProgramWeek | null,
  /**
   * The reader's language.
   *
   * This was omitted, so every program's summary came back in English and the
   * detail screen could not show it in a Finnish app — the description simply
   * was not rendered, which is a worse fix than passing the argument.
   */
  language: AppLanguage = 'en',
  /**
   * Whether this programme is the one the reader is already running.
   *
   * The button said "Ota ohjelma käyttöön" whatever the state, so opening your
   * own programme offered to adopt it again — and adoption returns early for a
   * programme already active, leaving a button that reads like a decision and
   * does nothing but send you Home.
   */
  isActivePlan = false,
  /** Held, but some other programme is the one Home leads with. */
  isHeldNotLeading = false,
): ProgramDetailViewModel {
  const goal = titleCase(template.goalType);
  const level = titleCase(template.level);
  const content = getReadyProgramContent(template.id, language);
  const programmeSummary = getRecommendationProgrammeSummary(template.id);
  const composed = composedWeek && composedWeek.sessions.length > 0 ? composedWeek : null;
  const daysPerWeek = composed ? composed.days : template.daysPerWeek;
  const detailSessions: WorkoutTemplateSession[] = composed
    ? composed.sessions.map((session) => ({
        id: session.id,
        name: session.name,
        orderIndex: session.orderIndex,
        exercises: session.exercises,
      }))
    : template.sessions;

  return {
    id: template.id,
    source: 'ready',
    title: template.name,
    subtitle: `${goal} | ${level} | ${daysPerWeek} ${pluralize(daysPerWeek, 'day')} / week`,
    description:
      content?.summary ??
      `${titleCase(template.splitType)} program with ${template.sessions.length} sessions and repeatable progression rules for consistent logging.`,
    badges: [
      goal,
      level,
      `${daysPerWeek} ${pluralize(daysPerWeek, 'day')}`,
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
    // Was the hardcoded English "Start first session" — and it never reached a
    // screen, so nothing showed it was untranslated.
    primaryActionLabel: t(
      language,
      isActivePlan ? 'detail.startNext' : isHeldNotLeading ? 'detail.lead' : 'detail.adopt',
    ),
    sessionActionLabel: 'Start session',
    sessions: buildSessionItems(detailSessions, insights?.sessionStatusById, template),
  };
}

/**
 * `language` is not optional here either. Every string this returned was an
 * English literal, and the description is rendered as the lead paragraph of the
 * detail screen — so a Finnish user's OWN program was introduced to them in
 * English, on the screen that exists to describe it.
 */
/**
 * @param isActivePlan whether this program is one of the plans Home reads. The
 *   button used to say "start the first session" whatever the answer, because
 *   adopting a program of your own was not a thing the app could do — so the
 *   one route onto the home screen was the catalog or onboarding, neither of
 *   which knows about a program the reader imported.
 */
export function buildCustomProgramDetail(
  template: WorkoutRuntimeTemplate,
  insights?: ProgramInsightSummary,
  language: AppLanguage = 'en',
  isActivePlan = false,
  /** Held, but some other programme is the one Home leads with. */
  isHeldNotLeading = false,
): ProgramDetailViewModel {
  const sessionCount = template.sessions.length;
  const exerciseCount = template.sessions.reduce((sum, session) => sum + session.exercises.length, 0);
  const hasExercises = exerciseCount > 0;
  const counts = t(language, sessionCount === 1 ? 'prog.custom.countsOne' : 'prog.custom.counts', {
    sessions: sessionCount,
    exercises: exerciseCount,
  });

  return {
    id: template.id,
    source: 'custom',
    title: template.name,
    subtitle: `${t(language, 'prog.custom.badge')} | ${counts}`,
    description: t(language, 'prog.custom.detail.description'),
    // badges[1] is read as a level slug by the detail screen; a custom program
    // has no level, so it stays a count and simply does not match.
    badges: [t(language, 'prog.custom.badge'), counts],
    tailoringBadges: [],
    highlights: insights?.highlights ?? [],
    infoSections: [],
    progressionSummary: null,
    primaryActionLabel: t(
      language,
      !hasExercises
        ? 'prog.custom.detail.editTemplate'
        : isActivePlan
          ? 'detail.startNext'
          : isHeldNotLeading
            ? 'detail.lead'
            : 'detail.adopt',
    ),
    sessionActionLabel: t(language, hasExercises ? 'prog.custom.detail.startSession' : 'prog.custom.detail.openSession'),
    sessions: buildSessionItems(template.sessions, insights?.sessionStatusById),
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
