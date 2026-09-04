/**
 * The session overview's rows (design: workout session flow, screen 1).
 *
 * The overview listed what a session contains — names and set counts — which
 * is the one thing the reader already knows by the time they are standing in
 * the gym holding the phone. The two things that are actually new every week
 * were missing: what the app changed since last time, and which of today's
 * lifts touches a body part the reader flagged in setup.
 *
 * Both are decided here rather than in the player so they can be tested
 * without mounting a 4000-line screen. Nothing in this file reaches storage,
 * React or the clock.
 */
import { exerciseHitsCautionArea } from './cautionExerciseFilter';
import { getSessionDurationMinutes } from './dashboard';
import { formatGroupedVolume, formatWeight } from './format';
import { t } from './i18n';
import { AppLanguage, SetupCautionArea, SetupCautionFlag, UnitPreference } from '../types/models';

/** The levels that colour a row. `info` is grey by design — it is not a warning. */
export type OverviewCautionLevel = 'careful' | 'avoid';

export interface OverviewCaution {
  area: SetupCautionArea;
  level: OverviewCautionLevel;
  /** Lead plus advice, one line: "Lower back flagged: be careful — keep the back flat…". */
  note: string;
}

export interface OverviewExerciseInput {
  /**
   * The library name, untranslated. The caution matcher reads English
   * patterns, so a localized label here would silently flag nothing.
   */
  exerciseName: string;
  setCount: number;
  /** Already formatted: "7", "6–8", or the seconds of a hold. */
  repsLabel: string;
  /** A hold logs seconds, so its scheme carries the unit and never a weight. */
  timed: boolean;
  loadKg: number | null;
}

/**
 * Which flag this lift trips, or null.
 *
 * `avoid` outranks `careful` when a lift hits two flagged areas: the stronger
 * claim is the one worth making, and the row has room for one line.
 */
export function resolveOverviewCaution(
  exerciseName: string,
  flags: ReadonlyArray<SetupCautionFlag> | null | undefined,
  language: AppLanguage,
): OverviewCaution | null {
  if (!flags || flags.length === 0) {
    return null;
  }

  const hits = flags
    .filter((flag) => flag.level === 'careful' || flag.level === 'avoid')
    .filter((flag) => exerciseHitsCautionArea(exerciseName, flag.area));
  if (hits.length === 0) {
    return null;
  }

  const chosen = hits.find((flag) => flag.level === 'avoid') ?? hits[0];
  const level: OverviewCautionLevel = chosen.level === 'avoid' ? 'avoid' : 'careful';
  const areaLabel = t(language, `onb.area.${chosen.area}` as 'onb.area.neck');

  return {
    area: chosen.area,
    level,
    /*
     * Area-level advice, not lift-level. The app has hand-written cautions for
     * seven lifts (exerciseTeaching.ts) and a programme can hold thirty — a
     * line that is specific for seven rows and absent for the rest reads as a
     * bug. The specific text belongs on the how-to sheet, where there is room
     * to be specific and a reason to be reading.
     */
    note: t(
      language,
      level === 'avoid' ? 'guided.entry.caution.avoid' : 'guided.entry.caution.careful',
      {
        area: areaLabel,
        advice: t(language, `guided.entry.caution.note.${chosen.area}` as 'guided.entry.caution.note.neck'),
      },
    ),
  };
}

/**
 * The right-hand half of an overview row: "4 × 7 · 62,5 kg".
 *
 * The weight is the half that changes week to week, and it was the half the
 * row did not show — so the screen that promises automated progression proved
 * it nowhere until the reader was already mid-set.
 */
export function buildOverviewScheme(
  input: OverviewExerciseInput,
  language: AppLanguage,
  unitPreference: UnitPreference = 'kg',
): string {
  const plan = `${input.setCount} × ${input.repsLabel}${input.timed ? ' s' : ''}`;
  if (input.timed || input.loadKg === null || !Number.isFinite(input.loadKg) || input.loadKg <= 0) {
    return plan;
  }
  return `${plan} · ${formatWeight(input.loadKg, unitPreference)}`;
}

export interface LastTimeSessionLike {
  performedAt: string;
  workoutTemplateId: string;
  workoutTemplateSessionId?: string | null;
  durationMinutes?: number;
  startedAt?: string;
  totalVolumeKg?: number;
}

/**
 * The newest finished run of this same session, or null.
 *
 * Matched on the template's session id when the caller knows it, so a push day
 * compares against push days rather than against whatever was trained last.
 * Falls back to the programme when the session id is absent — an older save,
 * or a programme with one session.
 */
export function findLastTimeSession<T extends LastTimeSessionLike>(
  sessions: ReadonlyArray<T>,
  workoutTemplateId: string,
  workoutTemplateSessionId: string | null,
): T | null {
  const sameProgram = sessions.filter((session) => session.workoutTemplateId === workoutTemplateId);
  const scoped = workoutTemplateSessionId
    ? sameProgram.filter((session) => session.workoutTemplateSessionId === workoutTemplateSessionId)
    : sameProgram;
  const candidates = scoped.length > 0 ? scoped : sameProgram;

  let newest: T | null = null;
  let newestAt = Number.NEGATIVE_INFINITY;
  candidates.forEach((session) => {
    const at = new Date(session.performedAt).getTime();
    if (!Number.isFinite(at)) {
      return;
    }
    if (at > newestAt) {
      newest = session;
      newestAt = at;
    }
  });

  return newest;
}

/**
 * "48 min · 12 340 kg", or the half that is known, or null.
 *
 * A session saved before durations were stored has neither number; printing
 * "0 min" for it would be the screen inventing a fact.
 */
export function buildLastTimeLine(
  session: LastTimeSessionLike | null,
  language: AppLanguage,
  unitPreference: UnitPreference = 'kg',
): string | null {
  if (!session) {
    return null;
  }

  const minutes = getSessionDurationMinutes(session as Parameters<typeof getSessionDurationMinutes>[0]);
  const volumeKg =
    typeof session.totalVolumeKg === 'number' && Number.isFinite(session.totalVolumeKg)
      ? session.totalVolumeKg
      : 0;

  const parts: string[] = [];
  if (minutes > 0) {
    parts.push(t(language, 'guided.entry.lastTime.minutes', { count: minutes }));
  }
  if (volumeKg > 0) {
    parts.push(formatGroupedVolume(volumeKg, unitPreference));
  }

  return parts.length > 0 ? parts.join(' · ') : null;
}

export interface ProgressionMove {
  /** Today's number, and the one the gate raised it from. */
  loadKg: number | null;
  autoProgressedFromKg: number | null;
  reps: number;
  autoProgressedFromReps: number | null;
}

/**
 * The pill that says the app moved something today, or null when it did not.
 *
 * Deliberately one pill for the whole session rather than a delta per row: the
 * overview is read in three seconds on the way to the rack, and the per-lift
 * breakdown already exists twice — on the set screen's AUTO badge and on the
 * finish screen's WHAT MOVED.
 *
 * Loads win over reps when both moved. A kilo on the bar is the headline; the
 * rep gate is what runs on the lifts that have no bar.
 */
export function buildProgressionPill(
  moves: ReadonlyArray<ProgressionMove>,
  language: AppLanguage,
  unitPreference: UnitPreference = 'kg',
): string | null {
  const loadDeltas = moves
    .filter(
      (move) =>
        move.autoProgressedFromKg !== null
        && move.loadKg !== null
        && move.loadKg > move.autoProgressedFromKg,
    )
    .map((move) => (move.loadKg as number) - (move.autoProgressedFromKg as number));

  if (loadDeltas.length > 0) {
    const biggest = Math.max(...loadDeltas);
    return t(
      language,
      loadDeltas.length === 1 ? 'guided.entry.progressed.one' : 'guided.entry.progressed.many',
      { delta: formatWeight(biggest, unitPreference), count: loadDeltas.length },
    );
  }

  const repDeltas = moves
    .filter((move) => move.autoProgressedFromReps !== null && move.reps > (move.autoProgressedFromReps as number))
    .map((move) => move.reps - (move.autoProgressedFromReps as number));

  if (repDeltas.length > 0) {
    // Separate singular key rather than a plural rule — the app has no
    // pluralization engine, and "+1 toistoa" is the kind of wrong that a
    // reader notices on the one screen they read before every session.
    const biggest = Math.max(...repDeltas);
    return biggest === 1
      ? t(language, 'guided.entry.progressed.repOne')
      : t(language, 'guided.entry.progressed.reps', { delta: biggest });
  }

  return null;
}
