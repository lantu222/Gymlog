import { getTotalVolume } from './progression';
import { I18nKey, t } from './i18n';
import { exerciseNameLabel } from './exerciseNameLabel';
import { localizeSessionName } from './sessionNameLabel';
import { AppLanguage, ExerciseLog, WorkoutSession } from '../types/models';

/**
 * Content for the AI Coach sheet's three data modules, computed from what the
 * user actually logged.
 *
 * The rule this file exists to enforce: **every figure shown comes from a
 * logged set.** When the data cannot support a module, the builder returns
 * null and the sheet shows an honest empty state instead. It never falls back
 * to sample numbers — an app that invents a "+8% volume" is lying about the
 * one thing it is for.
 */

/** A sentence plus the exact substrings the sheet renders in gold. */
export interface CoachText {
  text: string;
  highlights: string[];
}

export interface CoachMetric {
  value: string;
  label: string;
}

export interface CoachFocusModule {
  body: CoachText;
  metrics: CoachMetric[];
}

export type CoachBulletTone = 'up' | 'flat' | 'down';

export interface CoachBullet {
  tone: CoachBulletTone;
  body: CoachText;
}

export interface CoachAnalysisModule {
  /** Localized session name + date, e.g. "Ma · Koko keho". */
  caption: string;
  sessionId: string;
  bullets: CoachBullet[];
}

export interface CoachSuggestionModule {
  body: CoachText;
}

export interface CoachModules {
  focus: CoachFocusModule | null;
  analysis: CoachAnalysisModule | null;
  suggestion: CoachSuggestionModule | null;
  /** True when nothing could be built honestly — the sheet says why. */
  needsMoreData: boolean;
}

export interface CoachModulesInput {
  sessions: WorkoutSession[];
  logs: ExerciseLog[];
  language: AppLanguage;
  /** Sessions before this many days ago are too old to call "recent". */
  recentDays?: number;
}

const DEFAULT_RECENT_DAYS = 21;

function timeOf(session: Pick<WorkoutSession, 'performedAt'>) {
  const time = new Date(session.performedAt).getTime();
  return Number.isFinite(time) ? time : 0;
}

function sortNewestFirst(sessions: WorkoutSession[]) {
  return [...sessions].sort((left, right) => timeOf(right) - timeOf(left));
}

function sessionVolume(session: WorkoutSession, logs: ExerciseLog[]) {
  if (typeof session.totalVolumeKg === 'number' && session.totalVolumeKg > 0) {
    return session.totalVolumeKg;
  }

  // Older saves predate totalVolumeKg; recompute rather than show nothing.
  const own = logs.filter((log) => log.sessionId === session.id);
  const volume = own.reduce((sum, log) => sum + getTotalVolume(log), 0);
  return volume > 0 ? volume : null;
}

function roundVolume(value: number) {
  return Math.round(value);
}

function formatSigned(value: number) {
  const rounded = Math.round(value * 10) / 10;
  return rounded > 0 ? `+${rounded}` : `${rounded}`;
}

/** Heaviest completed set in a log, or null when nothing usable was logged. */
function topSetOf(log: ExerciseLog) {
  if (log.skipped || log.weight <= 0) {
    return null;
  }

  const reps = (log.repsPerSet ?? []).filter((count) => count > 0);
  if (reps.length === 0) {
    return null;
  }

  return { weight: log.weight, reps: Math.max(...reps) };
}

function buildFocus(
  sessions: WorkoutSession[],
  logs: ExerciseLog[],
  language: AppLanguage,
): CoachFocusModule | null {
  // Focus needs a lift with at least two logged weights to compare.
  const byExercise = new Map<string, Array<{ log: ExerciseLog; time: number }>>();
  const sessionTime = new Map(sessions.map((session) => [session.id, timeOf(session)]));

  for (const log of logs) {
    const top = topSetOf(log);
    if (!top) {
      continue;
    }
    const time = sessionTime.get(log.sessionId);
    if (time === undefined) {
      continue;
    }
    const key = log.exerciseNameSnapshot.trim().toLowerCase();
    const bucket = byExercise.get(key) ?? [];
    bucket.push({ log, time });
    byExercise.set(key, bucket);
  }

  let best: { name: string; delta: number; latest: number; days: number } | null = null;

  for (const entries of byExercise.values()) {
    if (entries.length < 2) {
      continue;
    }
    const ordered = [...entries].sort((left, right) => left.time - right.time);
    const first = ordered[0];
    const last = ordered[ordered.length - 1];
    const delta = last.log.weight - first.log.weight;
    if (delta <= 0) {
      continue;
    }
    const days = Math.max(1, Math.round((last.time - first.time) / 86400000));
    if (!best || delta > best.delta) {
      best = {
        name: last.log.exerciseNameSnapshot,
        delta,
        latest: last.log.weight,
        days,
      };
    }
  }

  if (!best) {
    return null;
  }

  const liftName = exerciseNameLabel(language, best.name);
  const deltaText = `${formatSigned(best.delta)} kg`;
  // Two sessions a day apart are not "a week" — say the span that happened.
  const periodText =
    best.days < 7
      ? t(language, best.days === 1 ? 'coach.dayOne' : 'coach.dayMany', { count: best.days })
      : t(language, Math.round(best.days / 7) === 1 ? 'coach.weekOne' : 'coach.weekMany', {
          count: Math.round(best.days / 7),
        });

  return {
    body: {
      text: t(language, 'coach.focus.liftUp', { lift: liftName, delta: deltaText, period: periodText }),
      highlights: [deltaText, periodText],
    },
    metrics: [
      { value: `${Math.round(best.latest * 10) / 10} kg`, label: liftName },
      { value: deltaText, label: periodText },
    ],
  };
}

function buildAnalysis(
  sessions: WorkoutSession[],
  logs: ExerciseLog[],
  language: AppLanguage,
): CoachAnalysisModule | null {
  const ordered = sortNewestFirst(sessions);
  const latest = ordered[0];
  if (!latest) {
    return null;
  }

  const bullets: CoachBullet[] = [];

  // Volume compared against the previous session with the same name — that is
  // the honest analogue of "vs your last Push".
  const sameName = ordered
    .slice(1)
    .filter(
      (session) =>
        session.workoutNameSnapshot.trim().toLowerCase() ===
        latest.workoutNameSnapshot.trim().toLowerCase(),
    );
  const latestVolume = sessionVolume(latest, logs);
  const priorVolume = sameName.length > 0 ? sessionVolume(sameName[0], logs) : null;

  if (latestVolume !== null && priorVolume !== null && priorVolume > 0) {
    const changePercent = Math.round(((latestVolume - priorVolume) / priorVolume) * 100);
    const changeText = `${changePercent > 0 ? '+' : ''}${changePercent}%`;
    bullets.push({
      tone: changePercent > 0 ? 'up' : changePercent < 0 ? 'down' : 'flat',
      body: {
        text: t(language, 'coach.analysis.volume', { change: changeText }),
        highlights: [changeText],
      },
    });
  } else if (latestVolume !== null) {
    const volumeText = `${roundVolume(latestVolume)} kg`;
    bullets.push({
      tone: 'flat',
      body: {
        text: t(language, 'coach.analysis.volumeFirst', { volume: volumeText }),
        highlights: [volumeText],
      },
    });
  }

  // Top set of the session, and whether it matched the user's best for that lift.
  const sessionLogs = logs.filter((log) => log.sessionId === latest.id);
  let heaviest: { log: ExerciseLog; weight: number; reps: number } | null = null;
  for (const log of sessionLogs) {
    const top = topSetOf(log);
    if (top && (!heaviest || top.weight > heaviest.weight)) {
      heaviest = { log, weight: top.weight, reps: top.reps };
    }
  }

  if (heaviest) {
    const key = heaviest.log.exerciseNameSnapshot.trim().toLowerCase();
    const priorBest = logs
      .filter(
        (log) =>
          log.sessionId !== latest.id && log.exerciseNameSnapshot.trim().toLowerCase() === key,
      )
      .reduce((max, log) => {
        const top = topSetOf(log);
        return top && top.weight > max ? top.weight : max;
      }, 0);

    const liftName = exerciseNameLabel(language, heaviest.log.exerciseNameSnapshot);
    const setText = `${Math.round(heaviest.weight * 10) / 10} kg × ${heaviest.reps}`;
    // Beating the old best and equalling it are different results; calling a
    // new PR "matched" undersells what the user actually did.
    const beatBest = priorBest > 0 && heaviest.weight > priorBest;
    const matchedBest = priorBest > 0 && heaviest.weight === priorBest;
    const topSetKey: I18nKey = beatBest
      ? 'coach.analysis.topSetNew'
      : matchedBest
        ? 'coach.analysis.topSetBest'
        : 'coach.analysis.topSet';

    bullets.push({
      tone: beatBest || matchedBest ? 'up' : 'flat',
      body: {
        text: t(language, topSetKey, { lift: liftName, set: setText }),
        highlights: [setText],
      },
    });
  }

  if (bullets.length === 0) {
    return null;
  }

  const performed = new Date(latest.performedAt);
  const weekday = Number.isFinite(performed.getTime())
    ? t(language, `guided.weekday.${performed.getDay()}` as never)
    : '';
  const name = localizeSessionName(latest.workoutNameSnapshot, language);
  const caption = weekday ? `${weekday.slice(0, 2)} · ${name}` : name;

  return { caption, sessionId: latest.id, bullets };
}

function buildSuggestion(
  sessions: WorkoutSession[],
  logs: ExerciseLog[],
  language: AppLanguage,
): CoachSuggestionModule | null {
  // The only suggestion this build can make honestly: a lift whose top set has
  // not moved across three or more logged sessions.
  const sessionTime = new Map(sessions.map((session) => [session.id, timeOf(session)]));
  const byExercise = new Map<string, Array<{ weight: number; time: number; name: string }>>();

  for (const log of logs) {
    const top = topSetOf(log);
    const time = sessionTime.get(log.sessionId);
    if (!top || time === undefined) {
      continue;
    }
    const key = log.exerciseNameSnapshot.trim().toLowerCase();
    const bucket = byExercise.get(key) ?? [];
    bucket.push({ weight: top.weight, time, name: log.exerciseNameSnapshot });
    byExercise.set(key, bucket);
  }

  for (const entries of byExercise.values()) {
    if (entries.length < 3) {
      continue;
    }
    const ordered = [...entries].sort((left, right) => right.time - left.time).slice(0, 3);
    const weights = ordered.map((entry) => entry.weight);
    const stalled = weights.every((weight) => Math.abs(weight - weights[0]) < 0.001);
    if (!stalled) {
      continue;
    }

    const liftName = exerciseNameLabel(language, ordered[0].name);
    const weightText = `${Math.round(weights[0] * 10) / 10} kg`;
    const countText = `${ordered.length}`;
    return {
      body: {
        text: t(language, 'coach.suggestion.plateau', {
          lift: liftName,
          weight: weightText,
          count: countText,
        }),
        highlights: [weightText, liftName],
      },
    };
  }

  return null;
}

export function buildCoachModules({
  sessions,
  logs,
  language,
  recentDays = DEFAULT_RECENT_DAYS,
}: CoachModulesInput): CoachModules {
  const cutoff = Date.now() - recentDays * 86400000;
  const recent = sessions.filter((session) => timeOf(session) >= cutoff);
  // Trends need history, so they read every session; only the analysis module
  // is limited to what is recent enough to still be worth commenting on.
  const focus = buildFocus(sessions, logs, language);
  const analysis = buildAnalysis(recent, logs, language);
  const suggestion = buildSuggestion(sessions, logs, language);

  return {
    focus,
    analysis,
    suggestion,
    needsMoreData: !focus && !analysis && !suggestion,
  };
}
