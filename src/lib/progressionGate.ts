import type { WorkoutSlotHistoryEntry } from '../features/workout/workoutTypes';
import { SetupLevel } from '../types/models';

/**
 * Double progression, as specified (ADR-004 + progression-gating-rules.md).
 *
 * This is the decision that used to exist only on paper. The rule was written
 * down, `buildProgressionSuggestion` implemented a rough version of it, and
 * that function was wired into WorkoutExerciseCard — a component no screen
 * renders. So the live logger simply repeated last session's weight forever
 * and the "Automated progression" toggle changed nothing a free user could
 * see. This is the gate the logger actually calls.
 *
 * The load increases only when the rep ceiling is reached on ALL target
 * working sets. One set at the ceiling is not enough — that is the whole
 * point of the model, and the thing a naive "did they hit the top rep?"
 * implementation gets wrong.
 */

export type ProgressionLevelTier = 'beginner' | 'intermediate';

export interface ProgressionLevelParams {
  /** Sessions of history needed before the gate says anything at all. */
  minSessions: number;
  /** Consecutive progression-ready sessions required before load moves. */
  requiredConsecutive: number;
  loadIncrementKg: number;
}

/** Values owned by progression-gating-rules.md §7. */
export const PROGRESSION_LEVEL_PARAMS: Record<ProgressionLevelTier, ProgressionLevelParams> = {
  beginner: { minSessions: 2, requiredConsecutive: 1, loadIncrementKg: 2.5 },
  intermediate: { minSessions: 3, requiredConsecutive: 2, loadIncrementKg: 1.25 },
};

export function getProgressionTier(level: SetupLevel | null | undefined): ProgressionLevelTier {
  // 'advanced' and 'pro' both want the confirmation session; only a true
  // beginner progresses off a single ceiling session.
  return level === 'beginner' || level == null ? 'beginner' : 'intermediate';
}

/** What the gate acts on, narrower than the fatigue model's own signal. */
export type ProgressionFatigueSignal = 'normal' | 'elevated' | 'high';

export type ProgressionHoldReason =
  | 'fatigue_high'
  | 'fatigue_elevated'
  | 'set_skipped'
  | 'insufficient_sets'
  | 'low_completion_rate'
  | 'rep_ceiling_not_reached'
  | 'gap_return'
  | 'awaiting_confirmation';

/**
 * The fatigue model's four-way signal, narrowed to what the gate acts on.
 *
 * The holds below were written with the gate and then never fired: nothing
 * passed a signal in, so `fatigueSignal` was undefined on every call for
 * months while the paywall sold "Pro reads your load and eases off before
 * fatigue costs you a week". This is the missing half.
 *
 * `confident` is not optional. The chronic load is a 28-day total over four,
 * so one logged session gives acute 500 against chronic 125 — an ACWR of 4,
 * and a hold on the strength of a single workout. Below the confidence bar
 * the answer is 'normal': the gate must not ease off on a guess.
 */
export function toProgressionFatigueSignal(
  fatigue: { signal: 'undertrained' | 'optimal' | 'elevated' | 'high'; confident: boolean } | null | undefined,
): ProgressionFatigueSignal {
  if (!fatigue || !fatigue.confident) {
    return 'normal';
  }
  if (fatigue.signal === 'high') {
    return 'high';
  }
  if (fatigue.signal === 'elevated') {
    return 'elevated';
  }
  // 'undertrained' is not a reason to hold — it is room to add.
  return 'normal';
}

export type ProgressionDecision =
  | { recommendation: 'silent' }
  | { recommendation: 'hold'; holdReason: ProgressionHoldReason; loadKg: number }
  | { recommendation: 'increase'; loadKg: number; fromLoadKg: number; incrementKg: number };

export interface ProgressionGateInput {
  /** Newest first, as the slot history stores it. */
  history: WorkoutSlotHistoryEntry[];
  repsMin: number;
  repsMax: number;
  targetSets: number;
  level?: SetupLevel | null;
  /** Caller-computed. Undefined counts as clear, per the spec's T11. */
  fatigueSignal?: ProgressionFatigueSignal;
  /** Bodyweight exercises accumulate reps; load never moves. */
  trackingMode?: string;
}

const GAP_DAYS = 7;
const MIN_COMPLETION_RATE = 0.8;

/** The heaviest load actually used in an entry, which is what we progress from. */
function entryLoadKg(entry: WorkoutSlotHistoryEntry): number {
  return entry.sets.reduce((max, set) => Math.max(max, set.loadKg), 0);
}

/**
 * A session is progression-ready when every completed working set reached the
 * rep ceiling, enough sets were completed, and nothing was skipped.
 */
export function isProgressionReadySession(
  entry: WorkoutSlotHistoryEntry,
  repsMax: number,
  targetSets: number,
): boolean {
  if (entry.skipped || entry.sets.length === 0) {
    return false;
  }
  if (entry.sets.length < targetSets) {
    return false;
  }
  return entry.sets.every((set) => set.reps >= repsMax);
}

function daysBetween(laterIso: string, earlierIso: string): number {
  const later = Date.parse(laterIso);
  const earlier = Date.parse(earlierIso);
  if (!Number.isFinite(later) || !Number.isFinite(earlier)) {
    return 0;
  }
  return Math.abs(later - earlier) / 86400000;
}

export function evaluateProgression(input: ProgressionGateInput): ProgressionDecision {
  const { history, repsMin, repsMax, targetSets, fatigueSignal, trackingMode } = input;
  const params = PROGRESSION_LEVEL_PARAMS[getProgressionTier(input.level)];

  // ── Silence: no target to evaluate against, or not enough baseline ────────
  if (!(repsMin > 0) || !(repsMax > 0) || !(targetSets > 0)) {
    return { recommendation: 'silent' };
  }
  // Bodyweight progresses by reps and variation, never by load (ADR-004 §What
  // This Model Does Not Cover).
  // A hold progresses in seconds, and there is no load to add either way.
  if (trackingMode === 'bodyweight' || trackingMode === 'hold') {
    return { recommendation: 'silent' };
  }
  if (history.length < params.minSessions) {
    return { recommendation: 'silent' };
  }

  const latest = history[0];
  if (!latest || latest.sets.length === 0) {
    return { recommendation: 'silent' };
  }

  const currentLoadKg = entryLoadKg(latest);
  if (!(currentLoadKg > 0)) {
    return { recommendation: 'silent' };
  }

  // ── Hold, in the spec's order: fatigue first, it is a hard block ──────────
  if (fatigueSignal === 'high') {
    return { recommendation: 'hold', holdReason: 'fatigue_high', loadKg: currentLoadKg };
  }
  if (fatigueSignal === 'elevated') {
    return { recommendation: 'hold', holdReason: 'fatigue_elevated', loadKg: currentLoadKg };
  }

  if (latest.skipped) {
    return { recommendation: 'hold', holdReason: 'set_skipped', loadKg: currentLoadKg };
  }
  if (latest.sets.length < targetSets) {
    return { recommendation: 'hold', holdReason: 'insufficient_sets', loadKg: currentLoadKg };
  }
  if (latest.sets.length / targetSets < MIN_COMPLETION_RATE) {
    return { recommendation: 'hold', holdReason: 'low_completion_rate', loadKg: currentLoadKg };
  }

  // A session that follows a long break is not the moment to add load.
  const previous = history[1];
  if (previous && daysBetween(latest.performedAt, previous.performedAt) >= GAP_DAYS) {
    return { recommendation: 'hold', holdReason: 'gap_return', loadKg: currentLoadKg };
  }

  if (!isProgressionReadySession(latest, repsMax, targetSets)) {
    return { recommendation: 'hold', holdReason: 'rep_ceiling_not_reached', loadKg: currentLoadKg };
  }

  // ── Consecutive-session gate ─────────────────────────────────────────────
  let consecutive = 0;
  for (const entry of history) {
    if (!isProgressionReadySession(entry, repsMax, targetSets)) {
      break;
    }
    // Only sessions at the same load count toward confirmation; a lighter
    // session that happened to hit the ceiling proves nothing about this load.
    if (Math.abs(entryLoadKg(entry) - currentLoadKg) > 0.001) {
      break;
    }
    consecutive += 1;
  }

  if (consecutive < params.requiredConsecutive) {
    return { recommendation: 'hold', holdReason: 'awaiting_confirmation', loadKg: currentLoadKg };
  }

  return {
    recommendation: 'increase',
    loadKg: currentLoadKg + params.loadIncrementKg,
    fromLoadKg: currentLoadKg,
    incrementKg: params.loadIncrementKg,
  };
}

/**
 * What the logger should prefill for a set.
 *
 * With automated progression off, this is exactly the old behaviour: repeat
 * what was logged last time. With it on, an earned progression moves the load
 * and every other outcome still repeats — so the toggle changes something the
 * user can actually see, which it previously did not.
 */
export function resolveProgressedLoadKg(
  input: ProgressionGateInput & { automatedProgressionEnabled: boolean; fallbackLoadKg: number },
): {
  loadKg: number;
  progressed: boolean;
  fromLoadKg: number | null;
  /**
   * True when the load would have moved but recovery said not today.
   *
   * A hold is the absence of a change, which is invisible — and an invisible
   * feature is one the user cannot know they are paying for. The logger says
   * so on the set, the same way it says where a raised load came from.
   */
  heldForFatigue: boolean;
} {
  if (!input.automatedProgressionEnabled) {
    return { loadKg: input.fallbackLoadKg, progressed: false, fromLoadKg: null, heldForFatigue: false };
  }

  const decision = evaluateProgression(input);
  if (decision.recommendation === 'increase') {
    // `fromLoadKg` is what the set was carrying before the gate moved it — the
    // logger shows the difference, so a load the user did not choose can say
    // where it came from.
    return {
      loadKg: decision.loadKg,
      progressed: true,
      fromLoadKg: decision.fromLoadKg,
      heldForFatigue: false,
    };
  }

  // The badge may only claim a decision the app actually made.
  //
  // Fatigue is checked FIRST in the gate order, so a hold reports
  // 'fatigue_high' even when the load was never going to move — the user had
  // not cleared the rep ceiling, or skipped a set. Reporting that as "held for
  // recovery" would be a false claim, and a loud one: a high ACWR persists for
  // weeks, so the badge would sit on every set of every session while the app
  // took credit for holding back a jump that was never earned.
  //
  // So: re-run the gate with recovery out of the way. It is only a recovery
  // hold if the load would otherwise have moved.
  const heldForFatigue =
    decision.recommendation === 'hold'
    && (decision.holdReason === 'fatigue_high' || decision.holdReason === 'fatigue_elevated')
    && evaluateProgression({ ...input, fatigueSignal: 'normal' }).recommendation === 'increase';

  return { loadKg: input.fallbackLoadKg, progressed: false, fromLoadKg: null, heldForFatigue };
}

/** One more rep, both tiers — a rep is already the smallest step there is. */
export const REP_INCREMENT = 1;

/**
 * Named, not inlined at the call site: `heldForFatigue` on the load resolver
 * shipped computed-but-dropped because the receiving object listed its fields
 * by hand. A named type keeps the field list in one place for both resolvers.
 */
export interface ProgressedRepsResolution {
  /** What the reps dial should open at. */
  targetReps: number;
  progressed: boolean;
  /** The floor the user actually proved last time, when the target moved. */
  fromReps: number | null;
  /** Same contract as the load resolver: earned, and recovery said not today. */
  heldForFatigue: boolean;
}

/** The weakest set is the level the session proved, so it is what we raise. */
function entryMinReps(entry: WorkoutSlotHistoryEntry): number {
  return entry.sets.reduce((min, set) => Math.min(min, set.reps), Number.POSITIVE_INFINITY);
}

export interface ProgressedRepsInput {
  /** Newest first, as the slot history stores it. */
  history: WorkoutSlotHistoryEntry[];
  /** The template's single rep target (repsMax; min equals it in the catalog). */
  templateTargetReps: number;
  targetSets: number;
  level?: SetupLevel | null;
  fatigueSignal?: ProgressionFatigueSignal;
  trackingMode?: string;
  automatedProgressionEnabled: boolean;
}

type RepsRecommendation = 'silent' | 'hold' | 'increase';

function evaluateRepsProgression(input: ProgressedRepsInput): RepsRecommendation {
  const { history, templateTargetReps, targetSets, fatigueSignal } = input;
  const params = PROGRESSION_LEVEL_PARAMS[getProgressionTier(input.level)];

  if (!(templateTargetReps > 0) || !(targetSets > 0)) {
    return 'silent';
  }
  if (history.length < params.minSessions) {
    return 'silent';
  }

  const latest = history[0];
  if (!latest || latest.sets.length === 0) {
    return 'silent';
  }

  // Same order as the load gate: fatigue is a hard block and comes first.
  if (fatigueSignal === 'high' || fatigueSignal === 'elevated') {
    return 'hold';
  }
  if (latest.skipped || latest.sets.length < targetSets) {
    return 'hold';
  }

  const previous = history[1];
  if (previous && daysBetween(latest.performedAt, previous.performedAt) >= GAP_DAYS) {
    return 'hold';
  }

  // Ready = every working set reached the target — the load gate's own rule,
  // with the target playing the ceiling. No same-level requirement across
  // sessions: reps drift upward naturally, and 13-13-13 after 12-12-12 is
  // confirmation, not a different lift.
  let consecutive = 0;
  for (const entry of history) {
    if (!isProgressionReadySession(entry, templateTargetReps, targetSets)) {
      break;
    }
    consecutive += 1;
  }
  if (consecutive < params.requiredConsecutive) {
    return 'hold';
  }

  return 'increase';
}

/**
 * What the reps dial should open at, for exercises that progress by reps.
 *
 * The load resolver's counterpart for bodyweight work, where ADR-004 keeps the
 * load gate silent: an earned session moves the target one rep past the floor
 * the user proved, and every other outcome opens at the template target — which
 * is exactly what the dial did unconditionally before this existed. Holds are
 * excluded: their "reps" are seconds, and a seconds dose is not dialled by one.
 */
export function resolveProgressedReps(input: ProgressedRepsInput): ProgressedRepsResolution {
  const base: ProgressedRepsResolution = {
    targetReps: input.templateTargetReps,
    progressed: false,
    fromReps: null,
    heldForFatigue: false,
  };

  if (!input.automatedProgressionEnabled || input.trackingMode !== 'bodyweight') {
    return base;
  }

  const recommendation = evaluateRepsProgression(input);
  if (recommendation === 'increase') {
    // The floor can sit above the template target when the user has been
    // overshooting it; raising from the proven floor is what keeps +1 honest.
    const fromReps = Math.max(input.templateTargetReps, entryMinReps(input.history[0]));
    return {
      targetReps: fromReps + REP_INCREMENT,
      progressed: true,
      fromReps,
      heldForFatigue: false,
    };
  }

  // Same rule as the load resolver: it is only a recovery hold if the reps
  // would otherwise have moved.
  const heldForFatigue =
    recommendation === 'hold'
    && (input.fatigueSignal === 'high' || input.fatigueSignal === 'elevated')
    && evaluateRepsProgression({ ...input, fatigueSignal: 'normal' }) === 'increase';

  return { ...base, heldForFatigue };
}
