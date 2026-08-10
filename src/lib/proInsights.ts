import { FatigueResult } from './fatigueModel';
import { WorkoutSlotHistoryEntry } from '../features/workout/workoutTypes';
import { formatShortDate, formatWeight } from './format';
import { exerciseNameLabel } from './exerciseNameLabel';
import { t } from './i18n';
import { PROGRESSION_LEVEL_PARAMS, getProgressionTier } from './progressionGate';
import { LiftHistory } from './trainingHistory';
import { AppLanguage, SetupLevel } from '../types/models';

/**
 * The paywall-moments layer (design: Vinha Paywall Moments).
 *
 * One rule at every touchpoint: THE FINDING IS FREE, THE CONCLUSION IS PRO.
 * Detections — a stalled lift, a traffic-light status — are computed here from
 * logged sets and shown to everyone. The conclusion (what to do about it) is
 * also computed here, deterministically, so the locked state can blur the REAL
 * text rather than a generic feature list, and a Pro user gets the same text
 * unblurred. Nothing in this file estimates, predicts long-term outcomes, or
 * states a number that is not in the log; the only forward-looking figure is
 * the next micro-progression step (latest + one increment), the same step the
 * progression gate itself would take.
 *
 * Everything is pure so tests can hold each sentence against the data.
 */

/** Same threshold the coach context uses: three sessions at one top set. */
export const PLATEAU_STALL_SESSIONS = 3;

export interface PlateauDetection {
  liftKey: string;
  /** Localized display name of the lift. */
  liftLabel: string;
  /** e.g. "Your squat hasn't moved in 4 sessions." */
  headline: string;
  /** e.g. "82.5 kg × 5, 4 sessions running · 14 Jun – 26 Jul" */
  meta: string;
  stalledSessions: number;
  topSetKg: number;
}

export interface LockedConclusion {
  /** Short line on the lock, e.g. "One fix, from your own 4 sessions". */
  teaser: string;
  /**
   * The REAL conclusion, blurred for free users and readable for Pro.
   *
   * One sentence, not a list of visual lines. It used to be a string[] with
   * the line break authored into the copy, which meant every translation
   * inherited a break chosen for English width — and in Finnish two of the
   * four pairs split a genitive from its head noun.
   */
  body: string;
}

export interface ProMomentContent {
  /** Small caps eyebrow, e.g. the lift name. */
  eyebrow: string;
  title: string;
  lead: string;
  /** Real top sets, oldest first, at most 5. */
  bars: number[];
  /** The dashed next-step bar; null when no honest step exists. */
  nextValue: number | null;
  barLabel: string;
  bullets: string[];
}

export type ReadTone = 'green' | 'amber' | 'red';

export interface WeeklyReadRow {
  key: string;
  tone: ReadTone;
  name: string;
  status: string;
  meta: string;
  /** Normalized 0..1 series for the mini bars, oldest first, at most 5. */
  bars: number[];
  /** Present on the rows whose conclusion is worth paying for. */
  locked: LockedConclusion | null;
}

function lastBars(points: number[], count = 5): number[] {
  return points.slice(-count);
}

function normalizedBars(values: number[]): number[] {
  if (values.length === 0) {
    return [];
  }
  const max = Math.max(...values);
  const min = Math.min(...values);
  if (max === min) {
    return values.map(() => 0.82);
  }
  // Keep every bar visible: map the range onto 0.3..1.
  return values.map((value) => 0.3 + ((value - min) / (max - min)) * 0.7);
}

/**
 * The deterministic read of WHY a lift is stalled, from its own points.
 * If total reps fall across the stalled run, the sets behind the top set are
 * shrinking — that reads as recovery. If reps hold, the lift is ready to earn
 * the next step through reps. Both are statements about logged sets only.
 */
function stallReason(lift: LiftHistory): 'recovery' | 'reps_hold' {
  const stalledPoints = lift.points.slice(-Math.max(2, lift.stalledSessions));
  const first = stalledPoints[0];
  const last = stalledPoints[stalledPoints.length - 1];
  if (first && last && last.totalReps < first.totalReps) {
    return 'recovery';
  }
  return 'reps_hold';
}

export function detectPlateau(lifts: LiftHistory[]): LiftHistory | null {
  let best: LiftHistory | null = null;
  for (const lift of lifts) {
    if (lift.stalledSessions < PLATEAU_STALL_SESSIONS || lift.latest.topSetWeightKg <= 0) {
      continue;
    }
    if (
      !best ||
      lift.stalledSessions > best.stalledSessions ||
      (lift.stalledSessions === best.stalledSessions && lift.latest.topSetWeightKg > best.latest.topSetWeightKg)
    ) {
      best = lift;
    }
  }
  return best;
}

export function buildPlateauDetection(lift: LiftHistory, language: AppLanguage): PlateauDetection {
  const liftLabel = exerciseNameLabel(language, lift.name);
  const stalledPoints = lift.points.slice(-lift.stalledSessions);
  const from = stalledPoints[0]?.performedAt ?? lift.first.performedAt;
  return {
    liftKey: lift.key,
    liftLabel,
    headline: t(language, 'pro.plateau.headline', { lift: liftLabel, count: lift.stalledSessions }),
    meta: t(language, 'pro.plateau.meta', {
      weight: formatWeight(lift.latest.topSetWeightKg, 'kg'),
      reps: lift.latest.topSetReps,
      count: lift.stalledSessions,
      from: formatShortDate(from, language),
      to: formatShortDate(lift.latest.performedAt, language),
    }),
    stalledSessions: lift.stalledSessions,
    topSetKg: lift.latest.topSetWeightKg,
  };
}

export function buildPlateauConclusion(lift: LiftHistory, language: AppLanguage): LockedConclusion {
  const weight = formatWeight(lift.latest.topSetWeightKg, 'kg');
  const body =
    stallReason(lift) === 'recovery'
      ? t(language, 'pro.fix.recovery', { weight })
      : t(language, 'pro.fix.reps', { weight });
  return {
    teaser: t(language, 'pro.fix.teaser', { count: lift.stalledSessions }),
    body,
  };
}

/** The honest next step: latest top set + the user's own progression increment. */
export function nextStepKg(lift: LiftHistory, level: SetupLevel | null | undefined): number {
  const tier = getProgressionTier(level ?? null);
  return lift.latest.topSetWeightKg + PROGRESSION_LEVEL_PARAMS[tier].loadIncrementKg;
}

export function buildPlateauMoment(
  lift: LiftHistory,
  language: AppLanguage,
  level: SetupLevel | null | undefined,
): ProMomentContent {
  const liftLabel = exerciseNameLabel(language, lift.name);
  const bars = lastBars(lift.points.map((point) => point.topSetWeightKg));
  return {
    eyebrow: t(language, 'pro.sheet.plateau.eyebrow', { lift: liftLabel.toUpperCase() }),
    title: t(language, 'pro.sheet.plateau.title'),
    lead: t(language, 'pro.sheet.plateau.lead', { count: lift.stalledSessions }),
    bars,
    nextValue: nextStepKg(lift, level),
    barLabel: t(language, 'pro.sheet.plateau.barLabel', {
      lift: liftLabel.toUpperCase(),
      count: bars.length,
    }),
    bullets: [t(language, 'pro.sheet.bullet.why'), t(language, 'pro.sheet.bullet.loads')],
  };
}

export function buildNextSessionMoment(
  lift: LiftHistory,
  language: AppLanguage,
  level: SetupLevel | null | undefined,
): ProMomentContent {
  const liftLabel = exerciseNameLabel(language, lift.name);
  const bars = lastBars(lift.points.map((point) => point.topSetWeightKg));
  const climbed = lift.weightChangeKg > 0;
  return {
    eyebrow: t(language, 'pro.sheet.next.eyebrow'),
    title: t(language, 'pro.sheet.next.title'),
    lead: climbed
      ? t(language, 'pro.sheet.next.leadClimb', {
          lift: liftLabel,
          from: formatWeight(lift.first.topSetWeightKg, 'kg'),
          to: formatWeight(lift.latest.topSetWeightKg, 'kg'),
          weeks: Math.max(1, Math.round(lift.spanDays / 7)),
        })
      : t(language, 'pro.sheet.next.leadFlat', { lift: liftLabel, count: lift.points.length }),
    bars,
    nextValue: nextStepKg(lift, level),
    barLabel: t(language, 'pro.sheet.next.barLabel', {
      lift: liftLabel.toUpperCase(),
      count: bars.length,
    }),
    bullets: [t(language, 'pro.sheet.bullet.adaptive'), t(language, 'pro.sheet.bullet.plateau')],
  };
}

/**
 * The post-session locked insight: the session's most-trained lift with enough
 * history to say something about the next session. Null when nothing honest
 * can be said (fresh users see no lock at all).
 */
export function pickCompletionLift(lifts: LiftHistory[]): LiftHistory | null {
  const candidates = lifts.filter((lift) => lift.points.length >= 2 && lift.latest.topSetWeightKg > 0);
  return candidates[0] ?? null;
}

export function buildCompletionConclusion(
  lift: LiftHistory,
  language: AppLanguage,
  level: SetupLevel | null | undefined,
): LockedConclusion {
  const liftLabel = exerciseNameLabel(language, lift.name);
  if (lift.stalledSessions >= PLATEAU_STALL_SESSIONS) {
    return buildPlateauConclusion(lift, language);
  }
  return {
    teaser: t(language, 'pro.completion.teaser'),
    body: t(language, 'pro.completion.body', {
      lift: liftLabel,
      weight: formatWeight(nextStepKg(lift, level), 'kg'),
    }),
  };
}

/**
 * The Progress tab's traffic lights. Statuses are free — always. The locked
 * conclusion appears only where there is one worth paying for.
 */
export function buildWeeklyRead(
  lifts: LiftHistory[],
  fatigue: FatigueResult | null,
  language: AppLanguage,
): WeeklyReadRow[] {
  const rows: WeeklyReadRow[] = [];

  for (const lift of lifts.slice(0, 2)) {
    if (lift.points.length < 3) {
      continue;
    }
    const bars = normalizedBars(lastBars(lift.points.map((point) => point.topSetWeightKg)));
    const name = exerciseNameLabel(language, lift.name);
    if (lift.stalledSessions >= PLATEAU_STALL_SESSIONS) {
      rows.push({
        key: lift.key,
        tone: 'amber',
        name,
        status: t(language, 'pro.read.stalled'),
        meta: t(language, 'pro.read.stalledMeta', { count: lift.stalledSessions }),
        bars,
        locked: buildPlateauConclusion(lift, language),
      });
    } else if (lift.weightChangeKg > 0) {
      rows.push({
        key: lift.key,
        tone: 'green',
        name,
        status: t(language, 'pro.read.improving'),
        meta: t(language, 'pro.read.improvingMeta', {
          change: formatWeight(lift.weightChangeKg, 'kg'),
          weeks: Math.max(1, Math.round(lift.spanDays / 7)),
        }),
        bars,
        locked: null,
      });
    } else if (lift.weightChangeKg < 0) {
      rows.push({
        key: lift.key,
        tone: 'red',
        name,
        status: t(language, 'pro.read.declining'),
        meta: t(language, 'pro.read.decliningMeta', {
          change: formatWeight(Math.abs(lift.weightChangeKg), 'kg'),
        }),
        bars,
        locked: buildPlateauConclusion(lift, language),
      });
    } else {
      rows.push({
        key: lift.key,
        tone: 'green',
        name,
        status: t(language, 'pro.read.steady'),
        meta: t(language, 'pro.read.steadyMeta', { count: lift.points.length }),
        bars,
        locked: null,
      });
    }
  }

  // The recovery row only exists when the fatigue model has enough history to
  // be confident — an invented recovery status would break the honesty rule.
  if (fatigue?.confident) {
    const tone: ReadTone = fatigue.signal === 'high' ? 'red' : fatigue.signal === 'elevated' ? 'amber' : 'green';
    rows.push({
      key: 'recovery',
      tone,
      name: t(language, 'pro.read.recovery'),
      status:
        tone === 'red'
          ? t(language, 'pro.read.recoveryLow')
          : tone === 'amber'
            ? t(language, 'pro.read.recoveryElevated')
            : t(language, 'pro.read.recoveryOk'),
      meta: t(language, 'pro.read.recoveryMeta', { count: fatigue.sessionCount7d }),
      bars: normalizedBars([fatigue.recoveryScore]),
      locked:
        tone === 'green'
          ? null
          : {
              teaser: t(language, 'pro.read.recoveryTeaser'),
              body: t(language, 'pro.read.recoveryBody', { count: fatigue.sessionCount7d }),
            },
    });
  }

  return rows;
}
