import { getRollingWindowStart } from './completedSessions';
import { I18nKey, t } from './i18n';
import { exerciseNameLabel } from './exerciseNameLabel';
import { localizeSessionName } from './sessionNameLabel';
import {
  buildLiftHistories,
  normalizedName,
  previousComparableSession,
  sessionTime,
  sessionVolumeKg,
  topSetOf,
} from './trainingHistory';
import { AppLanguage, ExerciseLog, WorkoutSession } from '../types/models';
import { removeTrailingZeros } from './format';

/**
 * Content for the AI Coach sheet's three data modules, computed from what the
 * user actually logged.
 *
 * The rule this file exists to enforce: **every figure shown comes from a
 * logged set.** When the data cannot support a module, the builder returns
 * null and the sheet shows an honest empty state instead. It never falls back
 * to sample numbers — an app that invents a "+8% volume" is lying about the
 * one thing it is for.
 *
 * The arithmetic lives in trainingHistory; this file only decides what is
 * worth saying and how to word it.
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
  /** Injectable so the recent-session window can be pinned in a test. */
  now?: Date;
}

const DEFAULT_RECENT_DAYS = 21;

function sortNewestFirst(sessions: WorkoutSession[]) {
  return [...sessions].sort((left, right) => sessionTime(right) - sessionTime(left));
}

function roundVolume(value: number) {
  return Math.round(value);
}

function formatSigned(value: number) {
  const rounded = removeTrailingZeros(Math.round(value * 10) / 10);
  return value > 0 ? `+${rounded}` : rounded;
}

function buildFocus(
  sessions: WorkoutSession[],
  logs: ExerciseLog[],
  language: AppLanguage,
): CoachFocusModule | null {
  // Focus needs a lift with at least two logged weights to compare, and a
  // move upward — there is nothing to celebrate in a lift that went down.
  let best: { name: string; delta: number; latest: number; days: number } | null = null;

  for (const lift of buildLiftHistories(sessions, logs)) {
    if (lift.points.length < 2 || lift.weightChangeKg <= 0) {
      continue;
    }
    if (!best || lift.weightChangeKg > best.delta) {
      best = {
        name: lift.name,
        delta: lift.weightChangeKg,
        latest: lift.latest.topSetWeightKg,
        // Two sessions on the same day still span a day's worth of training.
        days: Math.max(1, lift.spanDays),
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
      { value: `${removeTrailingZeros(Math.round(best.latest * 10) / 10)} kg`, label: liftName },
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
  const previous = previousComparableSession(latest, ordered);
  const latestVolume = sessionVolumeKg(latest, logs);
  const priorVolume = previous ? sessionVolumeKg(previous, logs) : null;

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
    const key = normalizedName(heaviest.log.exerciseNameSnapshot);
    const priorBest = logs
      .filter(
        (log) => log.sessionId !== latest.id && normalizedName(log.exerciseNameSnapshot) === key,
      )
      .reduce((max, log) => {
        const top = topSetOf(log);
        return top && top.weight > max ? top.weight : max;
      }, 0);

    const liftName = exerciseNameLabel(language, heaviest.log.exerciseNameSnapshot);
    const setText = `${removeTrailingZeros(Math.round(heaviest.weight * 10) / 10)} kg × ${heaviest.reps}`;
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
  for (const lift of buildLiftHistories(sessions, logs)) {
    if (lift.stalledSessions < 3) {
      continue;
    }

    const liftName = exerciseNameLabel(language, lift.name);
    const weightText = `${removeTrailingZeros(Math.round(lift.latest.topSetWeightKg * 10) / 10)} kg`;
    // The real run of flat sessions, not a capped "three" — a lift stuck for
    // six sessions is a different conversation from one stuck for three.
    const countText = `${lift.stalledSessions}`;
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
  now = new Date(),
}: CoachModulesInput): CoachModules {
  // Calendar stepping, and a reference date rather than Date.now() read inline:
  // the first keeps the edge on the time of day the window claims across a
  // clock change, the second is what makes that checkable at all.
  const cutoff = getRollingWindowStart(now, recentDays);
  // Bounded at the top as well: a session stamped in the future — a wrong
  // device clock keeps that timestamp forever — otherwise becomes the latest
  // one the analysis describes, and every real session is measured against it.
  const nowTimestamp = now.getTime();
  const recent = sessions.filter((session) => {
    const time = sessionTime(session);
    return time >= cutoff && time <= nowTimestamp;
  });
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
