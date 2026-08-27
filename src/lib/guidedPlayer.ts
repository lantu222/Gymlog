/**
 * Guided Player step machine (design_handoff_guided_player).
 *
 * A session runs as a flat ordered list of steps:
 * splash → (ready → drill)* → splash → (position → (set → rest)*)* → splash →
 * (ready → drill)* → finish. Rests are generated after every set except the
 * last set of the last exercise. Pure functions only — the screen owns timers
 * and dispatches; this module owns the step list and its derived labels.
 */

import { exerciseNameLabel } from './exerciseNameLabel';
import { parseNumberInput, removeTrailingZeros } from './format';
// Type-only on purpose: homeSessionHero reaches the catalog pools, which reach
// back here for the library matcher. Keeping this erased at build time means
// that loop stays a type relationship and never becomes a module cycle.
import type { SessionRoutineBlock } from './homeSessionHero';
import { t } from './i18n';
import { IntervalRecoveryKind, IntervalScheme, parseIntervalScheme } from './intervalScheme';
import type { GuidedResumeAnchor } from '../features/workout/workoutTypes';
import { AppLanguage } from '../types/models';

export type GuidedPhase = 'warmup' | 'work' | 'cooldown';

export const GUIDED_READY_SECONDS = 3;
export const GUIDED_POSITION_SECONDS = 15;

export interface GuidedDrill {
  name: string;
  seconds: number;
}

export interface GuidedExerciseInput {
  slotId: string;
  name: string;
  restSeconds: number;
  setCount: number;
  skipped: boolean;
}

export type GuidedStep =
  | { type: 'splash'; phase: GuidedPhase; title: string; sub: string; doneLabel: string | null }
  | { type: 'ready'; phase: GuidedPhase; drillName: string; seconds: number; groupIndex: number }
  | {
      type: 'drill';
      phase: GuidedPhase;
      drillName: string;
      seconds: number;
      groupIndex: number;
      drillIndex: number;
      drillCount: number;
    }
  | {
      type: 'position';
      phase: 'work';
      slotId: string;
      exerciseName: string;
      seconds: number;
      groupIndex: number;
      exerciseIndex: number;
      exerciseCount: number;
    }
  | {
      type: 'set';
      phase: 'work';
      slotId: string;
      exerciseName: string;
      setIndex: number;
      setCount: number;
      groupIndex: number;
      exerciseIndex: number;
      exerciseCount: number;
      /**
       * Present when the exercise names an interval scheme. The set is then a
       * timed work bout rather than a number to dial in: the screen counts it
       * down, logs it and runs on into the recovery without a tap, because
       * nobody taps a phone mid-sprint.
       */
      interval?: IntervalScheme;
    }
  | {
      type: 'rest';
      phase: 'work';
      slotId: string;
      exerciseName: string;
      setIndex: number;
      seconds: number;
      groupIndex: number;
      /** The recovery half of an interval — a walk, not a rest. */
      recoveryKind?: IntervalRecoveryKind;
    }
  | { type: 'finish' };

export interface GuidedGroup {
  phase: GuidedPhase;
  setCount?: number;
}

export interface GuidedStepPlan {
  steps: GuidedStep[];
  groups: GuidedGroup[];
}

/**
 * "3 min" → 180, "2 × 45s" → 90, "45s" → 45, "2 × 8" (reps) → paced estimate.
 * Accepts both '×' and 'x'. Unparseable labels get a 40s default so a drill
 * never renders with a zero timer.
 */
export function parseSchemeLabelSeconds(schemeLabel: string): number {
  const label = schemeLabel.trim().toLowerCase().replace(/×/g, 'x');

  const minutes = label.match(/^(\d+(?:\.\d+)?)\s*min/);
  if (minutes) {
    return Math.round(Number(minutes[1]) * 60);
  }

  const timedSets = label.match(/^(\d+)\s*x\s*(\d+(?:\.\d+)?)\s*s/);
  if (timedSets) {
    return Math.round(Number(timedSets[1]) * Number(timedSets[2]));
  }

  const timed = label.match(/^(\d+(?:\.\d+)?)\s*s/);
  if (timed) {
    return Math.round(Number(timed[1]));
  }

  const repSets = label.match(/^(\d+)\s*x\s*(\d+)$/);
  if (repSets) {
    // ~3s per rep, rounded up to the nearest 5s, floored at 30s.
    const estimate = Number(repSets[1]) * Number(repSets[2]) * 3;
    return Math.max(30, Math.ceil(estimate / 5) * 5);
  }

  return 40;
}

/** Home-hero warmup/cooldown block → timed guided drills. */
export function buildGuidedDrillsFromBlock(block: SessionRoutineBlock): GuidedDrill[] {
  return block.drills.map((drill) => ({
    name: drill.name,
    seconds: parseSchemeLabelSeconds(drill.schemeLabel),
  }));
}

/**
 * Seconds a warm-up or cool-down block actually costs, ready-countdowns
 * included. Shared so Home and the player feed the same number into the
 * session estimate instead of each summing the block their own way.
 */
export function estimateRoutineBlockSeconds(block: SessionRoutineBlock): number {
  return buildGuidedDrillsFromBlock(block).reduce(
    (sum, drill) => sum + drill.seconds + GUIDED_READY_SECONDS,
    0,
  );
}

/**
 * How long to wait before the next step while a dial button is held, given
 * how many steps the hold has already produced. Slow enough at first to stop
 * on a number, then quick — 100 kg from zero in 2.5 kg steps is forty ticks,
 * and forty ticks at 140 ms is a long time to hold a button.
 */
export function dialHoldIntervalMs(ticksSoFar: number): number {
  if (ticksSoFar < 6) {
    return 140;
  }
  if (ticksSoFar < 16) {
    return 80;
  }
  return 45;
}

/**
 * Whether the guided plan should leave an exercise out — no steps, no dots.
 *
 * Two different questions share the word "skipped". The session's status
 * answers "did anything get done here", and drives what is saved: an
 * exercise with one logged set and the rest skipped is *completed* there, so
 * the set survives into volume and records. The plan asks "is there anything
 * left to do here that the user did not walk away from" — and for that same
 * exercise the answer is no: the user pressed skip. So it leaves the plan,
 * exactly as it did when the status alone said so, while its logged set
 * stays a set.
 */
export function isGuidedExerciseOut(exercise: {
  status: string;
  sets: ReadonlyArray<{ status: string }>;
}): boolean {
  if (exercise.status === 'skipped') {
    return true;
  }
  const nothingPending = exercise.sets.every((set) => set.status !== 'pending');
  const somethingSkipped = exercise.sets.some((set) => set.status === 'skipped');
  return exercise.sets.length > 0 && nothingPending && somethingSkipped;
}

function formatBlockLength(totalSeconds: number): string {
  if (totalSeconds < 90) {
    return `~${Math.max(5, Math.round(totalSeconds / 5) * 5)} sec`;
  }
  return `~${Math.round(totalSeconds / 60)} min`;
}

export function buildGuidedSteps(
  input: {
    warmup: GuidedDrill[];
    exercises: GuidedExerciseInput[];
    cooldown: GuidedDrill[];
  },
  language: AppLanguage = 'en',
): GuidedStepPlan {
  const steps: GuidedStep[] = [];
  const groups: GuidedGroup[] = [];
  // Every lift the session had, skipped ones included: this is what the
  // header counts over. Skipped lifts get no steps, but they keep their place
  // in the numbering — otherwise skipping two of six turned the third into
  // "EXERCISE 1 OF 4", and the last one into "1 OF 1", because the plan is
  // rebuilt after every skip and used to number the survivors from one.
  const roster = input.exercises.filter((exercise) => exercise.setCount > 0);
  const exercises = roster.filter((exercise) => !exercise.skipped);
  const totalSets = exercises.reduce((sum, exercise) => sum + exercise.setCount, 0);

  if (input.warmup.length > 0) {
    const warmupSeconds = input.warmup.reduce((sum, drill) => sum + drill.seconds + GUIDED_READY_SECONDS, 0);
    const drillCount =
      input.warmup.length === 1
        ? t(language, 'guided.count.drillOne')
        : t(language, 'guided.count.drillMany', { count: input.warmup.length });
    steps.push({
      type: 'splash',
      phase: 'warmup',
      title: t(language, 'guided.phase.warmup'),
      sub: `${drillCount} · ${formatBlockLength(warmupSeconds)}`,
      doneLabel: null,
    });
    input.warmup.forEach((drill, drillIndex) => {
      const groupIndex = groups.length;
      groups.push({ phase: 'warmup' });
      steps.push({ type: 'ready', phase: 'warmup', drillName: drill.name, seconds: drill.seconds, groupIndex });
      steps.push({
        type: 'drill',
        phase: 'warmup',
        drillName: drill.name,
        seconds: drill.seconds,
        groupIndex,
        drillIndex,
        drillCount: input.warmup.length,
      });
    });
  }

  if (exercises.length > 0) {
    const exerciseCount =
      exercises.length === 1
        ? t(language, 'guided.count.exerciseOne')
        : t(language, 'guided.count.exerciseMany', { count: exercises.length });
    steps.push({
      type: 'splash',
      phase: 'work',
      title: t(language, 'guided.phase.workout'),
      sub: `${exerciseCount} · ${t(language, 'guided.count.sets', { count: totalSets })}`,
      doneLabel: input.warmup.length > 0 ? t(language, 'guided.done.warmup') : null,
    });
    exercises.forEach((exercise, activeIndex) => {
      const groupIndex = groups.length;
      // Position in the full roster, not among the survivors.
      const exerciseIndex = roster.indexOf(exercise);
      groups.push({ phase: 'work', setCount: exercise.setCount });
      steps.push({
        type: 'position',
        phase: 'work',
        slotId: exercise.slotId,
        exerciseName: exercise.name,
        seconds: GUIDED_POSITION_SECONDS,
        groupIndex,
        exerciseIndex,
        exerciseCount: roster.length,
      });
      // An interval states its own two halves; everything else is a set with a
      // number to dial in and a rest after it.
      const interval = parseIntervalScheme(exercise.name);
      for (let setIndex = 0; setIndex < exercise.setCount; setIndex += 1) {
        steps.push({
          type: 'set',
          phase: 'work',
          slotId: exercise.slotId,
          exerciseName: exercise.name,
          setIndex,
          setCount: exercise.setCount,
          groupIndex,
          exerciseIndex,
          exerciseCount: roster.length,
          ...(interval ? { interval } : {}),
        });
        // No rest after an exercise's last set. What follows is the next
        // exercise, and the player already gives that its own "get into
        // position" countdown — so a rest ring here was a timer counting down
        // to a screen that was going to change anyway. Reported 2026-08-21:
        // "vikan sarjan jälkeen tulee rest vaikka pitäisi tulla siirtymä
        // seuraavaan liikkeeseen".
        const isFinalSetOfExercise = setIndex === exercise.setCount - 1;
        if (!isFinalSetOfExercise) {
          steps.push({
            type: 'rest',
            phase: 'work',
            slotId: exercise.slotId,
            exerciseName: exercise.name,
            setIndex,
            // An interval's recovery is exactly what its name says — including
            // a tabata's ten seconds, which the fifteen-second floor for
            // ordinary rests would have stretched to fifteen.
            seconds: interval ? interval.recoverySeconds : Math.max(15, exercise.restSeconds),
            groupIndex,
            ...(interval ? { recoveryKind: interval.recoveryKind } : {}),
          });
        }
      }
    });
  }

  if (input.cooldown.length > 0) {
    const cooldownSeconds = input.cooldown.reduce((sum, drill) => sum + drill.seconds + GUIDED_READY_SECONDS, 0);
    const stretchCount =
      input.cooldown.length === 1
        ? t(language, 'guided.count.stretchOne')
        : t(language, 'guided.count.stretchMany', { count: input.cooldown.length });
    steps.push({
      type: 'splash',
      phase: 'cooldown',
      title: t(language, 'guided.phase.cooldown'),
      sub: `${stretchCount} · ${formatBlockLength(cooldownSeconds)}`,
      doneLabel:
        exercises.length > 0
          ? t(language, 'guided.done.workout')
          : input.warmup.length > 0
            ? t(language, 'guided.done.warmup')
            : null,
    });
    input.cooldown.forEach((drill, drillIndex) => {
      const groupIndex = groups.length;
      groups.push({ phase: 'cooldown' });
      steps.push({ type: 'ready', phase: 'cooldown', drillName: drill.name, seconds: drill.seconds, groupIndex });
      steps.push({
        type: 'drill',
        phase: 'cooldown',
        drillName: drill.name,
        seconds: drill.seconds,
        groupIndex,
        drillIndex,
        drillCount: input.cooldown.length,
      });
    });
  }

  steps.push({ type: 'finish' });
  return { steps, groups };
}

/**
 * Identity of a built step list — the memo key the player rebuilds its steps on.
 *
 * The exercise NAME is in here for a reason. Every set and position step bakes
 * in the name it was built with, and the set screen reads the name off the
 * step, not off the session. Leaving the name out of this key (which is how
 * this shipped) meant swapping an exercise changed the state and nothing else:
 * same slots, same set counts, same key, so the steps were never rebuilt and
 * the player kept showing — and cueing the photo of — the lift you had just
 * swapped away. The swap looked completely dead from the outside.
 */
export function getGuidedStepPlanKey(exercises: GuidedExerciseInput[]): string {
  return exercises
    .map((exercise) => `${exercise.slotId}:${exercise.name}:${exercise.setCount}:${exercise.skipped ? 's' : ''}`)
    .join('|');
}

/** Index of the first step of a phase, or null when the phase has no steps. */
export function findGuidedPhaseStart(steps: GuidedStep[], phase: GuidedPhase): number | null {
  const index = steps.findIndex((step) => step.type !== 'finish' && step.phase === phase);
  return index >= 0 ? index : null;
}

/** Top-bar label: "WARM-UP · 2 OF 3", "WORKOUT · EXERCISE 1 OF 3", "WORKOUT · REST"… */
export function getGuidedPhaseLabel(step: GuidedStep, language: AppLanguage = 'en'): string {
  switch (step.type) {
    case 'finish':
      return t(language, 'guided.label.done');
    case 'splash':
      return step.phase === 'warmup'
        ? t(language, 'guided.label.warmup')
        : step.phase === 'work'
          ? t(language, 'guided.label.workout')
          : t(language, 'guided.label.cooldown');
    case 'ready':
      return step.phase === 'warmup' ? t(language, 'guided.label.warmup') : t(language, 'guided.label.cooldown');
    case 'drill': {
      const prefix = step.phase === 'warmup' ? t(language, 'guided.label.warmup') : t(language, 'guided.label.cooldown');
      return t(language, 'guided.label.ofCount', {
        label: prefix,
        index: step.drillIndex + 1,
        count: step.drillCount,
      });
    }
    case 'position':
    case 'set':
      return t(language, 'guided.label.exercise', {
        index: step.exerciseIndex + 1,
        count: step.exerciseCount,
      });
    case 'rest':
      // An interval's easy half is a phase of the work, and the header saying
      // LEPO over a ring saying KÄVELE is the app disagreeing with itself.
      return step.recoveryKind
        ? t(
            language,
            step.recoveryKind === 'walk'
              ? 'guided.interval.walk'
              : step.recoveryKind === 'rest'
                ? 'guided.interval.rest'
                : 'guided.interval.easy',
          )
        : t(language, 'guided.label.rest');
  }
}

/**
 * Short human label for the resume chip ("Bench Press set 2").
 *
 * The exercise name goes through the same translation the player itself uses.
 * Without it the entry screen offered to resume "Front Squat sarja 3" while
 * the screen it resumes into says "Etukyykky" — one lift with two names, and
 * the English one on the surface that is meant to be reassuring.
 */
export function getGuidedStepLabel(step: GuidedStep, language: AppLanguage = 'en'): string {
  switch (step.type) {
    case 'set':
      return t(language, 'guided.step.set', {
        name: exerciseNameLabel(language, step.exerciseName),
        index: step.setIndex + 1,
      });
    case 'position':
      return t(language, 'guided.step.setup', { name: exerciseNameLabel(language, step.exerciseName) });
    case 'rest':
      return t(language, 'guided.step.rest', { name: exerciseNameLabel(language, step.exerciseName) });
    case 'drill':
    case 'ready':
      return step.drillName;
    case 'splash':
      return step.title;
    case 'finish':
      return t(language, 'guided.step.complete');
  }
}

export interface GuidedSetTarget {
  reps: number;
  /** `reps` is seconds held, not repetitions — carried so every label agrees. */
  timed?: boolean;
  loadKg: number | null;
  /**
   * Load this set carried before automated progression raised it, when the
   * shown weight is still that untouched machine-picked one. Null whenever the
   * user has a hand in the number — the badge must never claim credit for a
   * weight the user typed.
   */
  autoProgressedFromKg: number | null;
  /**
   * When this weight came from the same lift in another slot — another
   * program, another day, an empty workout — the date it was performed. Same
   * "only while untouched" rule as the badge above.
   */
  prefilledFromPerformedAt: string | null;
  /**
   * The load had earned a jump and recovery held it (Pro). Same
   * "only while untouched" rule as the two above: once the user moves the
   * number themselves, the app has no claim on it either way.
   */
  heldForFatigue: boolean;
  /**
   * The rep floor this target was raised from, for exercises that progress by
   * reps instead of load (bodyweight — the load gate is silent there). Null on
   * loaded lifts and whenever `reps` is not the gate's own number.
   */
  autoProgressedFromReps: number | null;
}

export interface GuidedNextPreview {
  title: string;
  sub: string;
  line: string;
}

function formatKg(value: number): string {
  return removeTrailingZeros(value);
}

export function formatGuidedTarget(target: GuidedSetTarget, language: AppLanguage = 'en'): string {
  if (target.loadKg === null) {
    return t(language, target.timed ? 'guided.target.seconds' : 'guided.target.reps', { reps: target.reps });
  }
  return `${target.reps} × ${formatKg(target.loadKg)} kg`;
}

/**
 * "Next ·" preview: the next drill/set/splash after `index`, skipping
 * ready/rest/position steps.
 */
export function getGuidedNextPreview(
  steps: GuidedStep[],
  index: number,
  resolveTarget: (slotId: string, setIndex: number) => GuidedSetTarget | null,
  language: AppLanguage = 'en',
): GuidedNextPreview | null {
  for (let cursor = index + 1; cursor < steps.length; cursor += 1) {
    const step = steps[cursor];
    if (step.type === 'drill') {
      return {
        title: step.drillName,
        sub: `${step.seconds}s`,
        line: `${step.drillName} · ${step.seconds}s`,
      };
    }
    if (step.type === 'set') {
      const target = resolveTarget(step.slotId, step.setIndex);
      const targetLabel = target ? formatGuidedTarget(target, language) : null;
      const name = exerciseNameLabel(language, step.exerciseName);
      return {
        title: t(language, 'guided.next.setTitle', {
          name,
          index: step.setIndex + 1,
          count: step.setCount,
        }),
        sub: targetLabel ?? '',
        line: targetLabel ? `${name} · ${targetLabel}` : name,
      };
    }
    if (step.type === 'splash') {
      return { title: step.title, sub: step.sub, line: step.title };
    }
    if (step.type === 'finish') {
      return { title: t(language, 'guided.step.complete'), sub: '', line: t(language, 'guided.next.finish') };
    }
  }
  return null;
}

/**
 * Name of the next drill/exercise/block after `index` — the set screen's
 * "Next ·" line names what is coming without repeating its target.
 *
 * Translated here, like every other label this module returns. It used to hand
 * back the raw English name and rely on the caller to localize it, which is
 * the arrangement that let the resume chip ship in the wrong language.
 */
export function getGuidedNextName(
  steps: GuidedStep[],
  index: number,
  language: AppLanguage = 'en',
): string | null {
  for (let cursor = index + 1; cursor < steps.length; cursor += 1) {
    const step = steps[cursor];
    if (step.type === 'drill') {
      return step.drillName;
    }
    if (step.type === 'set') {
      return exerciseNameLabel(language, step.exerciseName);
    }
    if (step.type === 'splash') {
      return step.title;
    }
    if (step.type === 'finish') {
      return null;
    }
  }
  return null;
}

/**
 * Default target the set screen opens with. Weight: the draft prefill (last
 * time / carry-forward) wins, then the planned load, then the previous
 * completed set. Reps: previous completed set's actual, else the planned max.
 */
export function resolveGuidedSetTarget(
  sets: Array<{
    setIndex: number;
    status: string;
    plannedLoadKg?: number;
    plannedRepsMin: number;
    plannedRepsMax: number;
    draftLoadText: string;
    draftRepsText: string;
    autoProgressedFromKg?: number;
    heldForFatigue?: boolean;
    prefilledFromPerformedAt?: string;
    plannedTargetReps?: number;
    autoProgressedFromReps?: number;
    actualLoadKg?: number;
    actualReps?: number;
  }>,
  setIndex: number,
  trackingMode: string,
  /**
   * Sets at or below this index were logged as a different lift (the exercise
   * was swapped mid-way). Carry-forward stops here — see
   * `WorkoutExerciseInstance.swappedAfterSetIndex`.
   */
  swappedAfterSetIndex?: number | null,
): GuidedSetTarget | null {
  const set = sets.find((item) => item.setIndex === setIndex);
  if (!set) {
    return null;
  }

  const carryForwardFloor = typeof swappedAfterSetIndex === 'number' ? swappedAfterSetIndex : -1;
  const previous = [...sets]
    .filter(
      (item) => item.setIndex < setIndex && item.setIndex > carryForwardFloor && item.status === 'completed',
    )
    .sort((left, right) => right.setIndex - left.setIndex)[0];

  // A hold logs no weight either — its "reps" are seconds.
  if (trackingMode === 'bodyweight' || trackingMode === 'hold') {
    // Bodyweight progresses by reps: the gate's target replaces the template
    // fallback, and the previous completed set still wins — mid-session the
    // day's own numbers are the better prescription.
    const suggestedReps = trackingMode === 'bodyweight' ? set.plannedTargetReps : undefined;
    const reps = previous?.actualReps ?? suggestedReps ?? set.plannedRepsMax;
    // Same rule as the load badges below: the claim follows the number. Once
    // the shown reps are not the ones the gate picked, it has nothing to
    // point at.
    const untouchedReps = suggestedReps !== undefined && reps === suggestedReps;
    return {
      reps,
      // Set only when true, so a bodyweight target keeps the shape it had.
      ...(trackingMode === 'hold' ? { timed: true } : {}),
      loadKg: null,
      autoProgressedFromKg: null,
      prefilledFromPerformedAt: null,
      autoProgressedFromReps:
        untouchedReps && set.autoProgressedFromReps !== undefined ? set.autoProgressedFromReps : null,
      // The hold is reported while today is still untouched; after the first
      // logged set the day has its own numbers to answer for.
      heldForFatigue: trackingMode === 'bodyweight' && previous == null && set.heldForFatigue === true,
    };
  }

  const reps = previous?.actualReps ?? set.plannedRepsMax;
  const draftLoad = parseNumberInput(set.draftLoadText);
  const loadKg = draftLoad ?? set.plannedLoadKg ?? previous?.actualLoadKg ?? null;
  // Both badges follow the number, not the set: once the shown load drifts off
  // the plan (user edit, carry-forward from a set they logged heavier), it is
  // no longer the weight the app put there, and neither badge may claim it.
  const untouched =
    loadKg !== null && set.plannedLoadKg !== undefined && Math.abs(loadKg - set.plannedLoadKg) < 0.001;
  return {
    reps,
    loadKg,
    autoProgressedFromKg: untouched && set.autoProgressedFromKg !== undefined ? set.autoProgressedFromKg : null,
    prefilledFromPerformedAt: untouched ? set.prefilledFromPerformedAt ?? null : null,
    heldForFatigue: untouched && set.heldForFatigue === true,
    autoProgressedFromReps: null,
  };
}

/**
 * A step in terms that survive the plan being rebuilt — the thing to persist
 * instead of (as well as) its index. See GuidedResumeAnchor.
 */
export function getGuidedStepAnchor(step: GuidedStep): GuidedResumeAnchor {
  switch (step.type) {
    case 'finish':
      return { type: 'finish', phase: null };
    case 'splash':
      return { type: 'splash', phase: step.phase };
    case 'ready':
    case 'drill':
      return { type: step.type, phase: step.phase, drillName: step.drillName };
    case 'position':
      return { type: 'position', phase: 'work', slotId: step.slotId };
    case 'set':
    case 'rest':
      return { type: step.type, phase: 'work', slotId: step.slotId, setIndex: step.setIndex };
  }
}

/** The index of the step an anchor names in *this* list, or null if it is gone. */
export function findGuidedStepIndexByAnchor(steps: GuidedStep[], anchor: GuidedResumeAnchor): number | null {
  const index = steps.findIndex((step) => {
    if (step.type !== anchor.type) {
      return false;
    }
    switch (step.type) {
      case 'finish':
        return true;
      case 'splash':
        return step.phase === anchor.phase;
      case 'ready':
      case 'drill':
        return step.phase === anchor.phase && step.drillName === anchor.drillName;
      case 'position':
        return step.slotId === anchor.slotId;
      case 'set':
      case 'rest':
        return step.slotId === anchor.slotId && step.setIndex === anchor.setIndex;
    }
  });
  return index >= 0 ? index : null;
}

/**
 * Where to resume. An anchor wins when its step still exists (rolled forward
 * past sets completed meanwhile). Failing that a stored index (clamped, rolled
 * forward). With neither: the first incomplete set when some sets are already
 * logged, else the start.
 *
 * The anchor is what makes this survive a rebuilt plan. Skipping a lift, or
 * updating the app, changes the step list's shape; an index into the old list
 * then names a different step, and the entry screen offered to resume
 * "Penkkipunnerrus sarja 2" in a session that had never touched the bench.
 * When the anchored step is gone — the lift it belonged to left the plan —
 * the index is not trusted either: it points into a list that no longer
 * exists. The first incomplete set is the honest place to land.
 */
export function resolveGuidedResumeIndex(
  steps: GuidedStep[],
  storedIndex: number | null | undefined,
  isSetCompleted: (slotId: string, setIndex: number) => boolean,
  anchor?: GuidedResumeAnchor | null,
): number {
  const lastIndex = steps.length - 1;
  const rollForward = (from: number) => {
    let cursor = Math.min(Math.max(0, from), lastIndex);
    while (cursor < lastIndex) {
      const step = steps[cursor];
      if (step.type === 'set' && isSetCompleted(step.slotId, step.setIndex)) {
        cursor += 1;
        // The rest right after a completed set belongs to it — skip that too.
        if (steps[cursor]?.type === 'rest') {
          cursor += 1;
        }
        continue;
      }
      break;
    }
    return cursor;
  };

  if (anchor) {
    const anchored = findGuidedStepIndexByAnchor(steps, anchor);
    if (anchored !== null) {
      return rollForward(anchored);
    }
    // Anchored step gone → the index is stale too. Fall through to the
    // set-based landing below.
  } else if (typeof storedIndex === 'number' && Number.isFinite(storedIndex) && storedIndex > 0) {
    return rollForward(storedIndex);
  }

  const anyCompleted = steps.some(
    (step) => step.type === 'set' && isSetCompleted(step.slotId, step.setIndex),
  );
  if (!anyCompleted) {
    return 0;
  }

  const firstIncomplete = steps.findIndex(
    (step) => step.type === 'set' && !isSetCompleted(step.slotId, step.setIndex),
  );
  if (firstIncomplete < 0) {
    // Everything logged — resume at the cooldown splash if one exists,
    // otherwise land on finish.
    const cooldownStart = findGuidedPhaseStart(steps, 'cooldown');
    return cooldownStart ?? lastIndex;
  }

  // Land on the exercise's position step when resuming at its first set.
  const step = steps[firstIncomplete];
  if (step.type === 'set' && step.setIndex === 0 && steps[firstIncomplete - 1]?.type === 'position') {
    return firstIncomplete - 1;
  }
  return firstIncomplete;
}

/** Skip target: next step, jumping over the rest that follows a skipped set. */
export function getGuidedSkipTargetIndex(steps: GuidedStep[], index: number): number {
  const lastIndex = steps.length - 1;
  let target = index + 1;
  if (steps[index]?.type === 'set' && steps[target]?.type === 'rest') {
    target += 1;
  }
  return Math.min(target, lastIndex);
}

/**
 * Where a reader lands when they skip a whole warmup or cooldown.
 *
 * Skipping drill by drill already worked, and on a five-drill warmup that is
 * five taps to get to the bar. Asked for from a gym floor (user, 2026-08-20).
 *
 * The work block is not skippable and never will be: it is the session. Only
 * the two blocks around it answer to this, and a step with no phase at all —
 * the finish card — answers to nothing.
 */
export function getGuidedPhaseSkipTargetIndex(steps: GuidedStep[], index: number): number {
  const current = steps[index];
  const phase = current && 'phase' in current ? current.phase : null;
  if (!phase || phase === 'work') {
    return index;
  }

  for (let next = index + 1; next < steps.length; next += 1) {
    const step = steps[next];
    const nextPhase = 'phase' in step ? step.phase : null;
    if (nextPhase !== phase) {
      return next;
    }
  }

  return Math.max(0, steps.length - 1);
}

/** Back target: previous drill/set/position/splash, skipping rest/ready steps. */
export function getGuidedBackTargetIndex(steps: GuidedStep[], index: number): number {
  let cursor = index - 1;
  while (cursor > 0) {
    const step = steps[cursor];
    if (step.type === 'rest' || step.type === 'ready') {
      cursor -= 1;
      continue;
    }
    break;
  }
  return Math.max(0, cursor);
}

/*
 * The entry screen's duration estimate used to live here, adding up the step
 * list at a flat 35 s per set. It is gone: a set of five and a set of fifteen
 * do not take the same time, and this was one of four different answers the
 * app gave to "how long is this session". See `lib/sessionDuration.ts`, which
 * Home and the player now share.
 */

/**
 * "STRONG Elite - Day 1: Upper (Heavy)" → "Upper (Heavy)". Runtime session
 * templates are named `<plan> - <day>`; entry wants just the day focus.
 */
export function getGuidedSessionTitle(templateName: string, language: AppLanguage = 'en'): string {
  const raw = templateName.trim();
  const separatorIndex = raw.lastIndexOf(' - ');
  const dayPart = separatorIndex >= 0 ? raw.slice(separatorIndex + 3).trim() : raw;
  const [head, ...rest] = dayPart.split(':');
  const afterColon = rest.join(':').trim();
  if (/^day\s*\d+$/i.test(head.trim()) && afterColon) {
    return afterColon;
  }
  return dayPart || t(language, 'guided.sessionFallback');
}

export interface GuidedSessionPr {
  exerciseName: string;
  bestKg: number;
  deltaKg: number;
}

/**
 * NEW RECORD card input: the heaviest completed set today that beats the
 * heaviest weight on record for the same slot. Requires history — a first
 * session is never a "record". Returns the biggest such lift, or null.
 */
export function findGuidedSessionPr(
  exercises: Array<{
    exerciseName: string;
    sets: Array<{ status: string; actualLoadKg?: number }>;
  }>,
  resolveHistoryBestKg: (exerciseIndex: number) => number | null,
): GuidedSessionPr | null {
  let best: GuidedSessionPr | null = null;
  exercises.forEach((exercise, exerciseIndex) => {
    const todayBest = exercise.sets.reduce(
      (max, set) => (set.status === 'completed' && (set.actualLoadKg ?? 0) > max ? set.actualLoadKg ?? 0 : max),
      0,
    );
    if (todayBest <= 0) {
      return;
    }
    const historyBest = resolveHistoryBestKg(exerciseIndex);
    if (historyBest === null || historyBest <= 0 || todayBest <= historyBest) {
      return;
    }
    if (!best || todayBest > best.bestKg) {
      best = { exerciseName: exercise.exerciseName, bestKg: todayBest, deltaKg: todayBest - historyBest };
    }
  });
  return best;
}

export interface GuidedCoachMessage {
  message: string;
  sub: string | null;
}

/** Deterministic 1–2 line COACH card copy from session data. */
export function buildGuidedCoachMessage(
  input: {
    pr: GuidedSessionPr | null;
    topSet: { exerciseName: string; loadKg: number; reps: number } | null;
  },
  language: AppLanguage = 'en',
): GuidedCoachMessage {
  if (input.pr) {
    return {
      message: t(language, 'guided.coach.pr', { kg: formatKg(input.pr.bestKg), name: exerciseNameLabel(language, input.pr.exerciseName) }),
      sub: t(language, 'guided.coach.prSub', {
        name: exerciseNameLabel(language, input.pr.exerciseName),
        kg: formatKg(input.pr.bestKg + 2.5),
      }),
    };
  }
  if (input.topSet) {
    return {
      message: t(language, 'guided.coach.top', {
        name: exerciseNameLabel(language, input.topSet.exerciseName),
        kg: formatKg(input.topSet.loadKg),
      }),
      sub: t(language, 'guided.coach.topSub', {
        kg: formatKg(input.topSet.loadKg),
        reps: input.topSet.reps + 1,
      }),
    };
  }
  return { message: t(language, 'guided.coach.logged'), sub: null };
}

/** Heaviest completed set of the session (for the COACH card). */
export function findGuidedTopSet(
  exercises: Array<{
    exerciseName: string;
    sets: Array<{ status: string; actualLoadKg?: number; actualReps?: number }>;
  }>,
): { exerciseName: string; loadKg: number; reps: number } | null {
  let top: { exerciseName: string; loadKg: number; reps: number } | null = null;
  for (const exercise of exercises) {
    for (const set of exercise.sets) {
      if (set.status !== 'completed' || !set.actualLoadKg || set.actualLoadKg <= 0) {
        continue;
      }
      if (!top || set.actualLoadKg > top.loadKg) {
        top = { exerciseName: exercise.exerciseName, loadKg: set.actualLoadKg, reps: set.actualReps ?? 0 };
      }
    }
  }
  return top;
}

/** mm:ss over 60s, plain seconds under it — matches the mock's gpFmt. */
export function formatGuidedCountdown(secondsLeft: number): string {
  const seconds = Math.max(0, Math.ceil(secondsLeft));
  if (seconds >= 60) {
    const minutes = Math.floor(seconds / 60);
    return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
  }
  return `${seconds}`;
}

/**
 * Media/instructions match: exact name first, then a curated alias map for
 * classic plan names, then a containment heuristic (library name contains the
 * plan name, shortest wins). Returns the library index or null — never guesses
 * across ambiguous containment in both directions.
 */
export const GUIDED_LIBRARY_ALIASES: Record<string, string> = {
  'bench press': 'barbell bench press - medium grip',
  'incline bench press': 'barbell incline bench press - medium grip',
  'overhead press': 'standing military press',
  'military press': 'standing military press',
  'lateral raise': 'side lateral raise',
  'back squat': 'barbell full squat',
  'front squat': 'front barbell squat',
  'deadlift': 'barbell deadlift',
  'romanian deadlift': 'romanian deadlift',
  'barbell row': 'bent over barbell row',
  'hip thrust': 'barbell hip thrust',
  'lat pulldown': 'wide-grip lat pulldown',
  'pull-up': 'pullups',
  'pull-ups': 'pullups',
  'chin-up': 'chin-up',
  'push-up': 'pushups',
  'push-ups': 'pushups',
  'plank': 'plank',

  // Names the catalogs qualify with a coaching cue. Each pair was checked
  // against the library by hand: the containment heuristic reached "Seated
  // Cable Rows" for a ring row and "Push Up to Side Plank" for a side plank,
  // which is why stripped names are not allowed to use it.
  'rows (bar or rings)': 'inverted row',
  'seated cable row': 'seated cable rows',
  'glute bridge': 'barbell glute bridge',
  'step-up': 'step-up with knee raise',
  vacuum: 'stomach vacuum',

  // ── Names the library has under a different spelling ──────────────────
  //
  // Each pair was checked by hand against the library, on one rule: the
  // entry must be the SAME MOVEMENT, so the photo and the instructions are
  // right. Different gear for the same movement is fine and already the norm
  // here ("Hip Thrust" has always resolved to the barbell version) — the
  // position is what a user reads off a photo. A different movement is not
  // fine, however close the name: "Plank-Up", "Plank to Pike" and "Skater
  // Jump" are left unresolved rather than pointed at "Plank" and "Star Jump".
  'chest-supported row': 'dumbbell incline row',
  'chest-supported t-bar row': 'lying t-bar row',
  'bulgarian split squat': 'split squats',
  'machine chest press': 'leverage chest press',
  'machine high row': 'leverage high row',
  'hanging knee raise': 'hanging leg raise',
  'weighted pull-up': 'weighted pull ups',
  'weighted dips': 'parallel bar dip',
  'standing overhead press': 'standing military press',
  'incline barbell press': 'barbell incline bench press - medium grip',
  'competition bench press': 'bench press - powerlifting',
  'paused bench press': 'bench press - powerlifting',
  'cable lateral raise': 'cable seated lateral raise',
  'dumbbell lateral raise': 'side lateral raise',
  'lateral raise superset': 'side lateral raise',
  'cable front raise': 'front cable raise',
  'dumbbell rear delt fly': 'reverse flyes',
  'reverse pec deck': 'reverse machine flyes',
  'single-arm dumbbell row': 'one-arm dumbbell row',
  'dumbbell renegade row': 'alternating renegade row',
  'cable triceps pushdown': 'triceps pushdown',
  'rope pushdown': 'triceps pushdown - rope attachment',
  'cable triceps kickback': 'tricep dumbbell kickback',
  'reverse wrist curl': 'palms-down wrist curl over a bench',
  'cable pullover': 'straight-arm dumbbell pullover',
  'cable pull-through': 'pull through',
  'dumbbell thruster': 'kettlebell thruster',
  'battle rope slam': 'battling ropes',
  'banded lateral walk': 'monster walk',
  'wall push-up': 'incline push-up',
  'cat-cow': 'cat stretch',
  // A curtsy lunge is a crossover reverse lunge — same movement, and the
  // library files that entry under 'back', which is its mistake, not ours.
  'curtsy lunge': 'crossover reverse lunge',
  // "Reverse Lunge" used to reach 'Crossover Reverse Lunge' by containment,
  // which is a different movement AND filed under 'back' — so every leg day
  // running one picked up a pull vote.
  'reverse lunge': 'dumbbell rear lunge',
  'bodyweight reverse lunge': 'dumbbell rear lunge',
  'banded hip thrust': 'barbell hip thrust',
  'single-leg hip thrust': 'single leg glute bridge',
  'banded glute bridge': 'barbell glute bridge',
  'glute bridge hold': 'barbell glute bridge',
  'cable glute kickback': 'one-legged cable kickback',
  'inchworm to push-up': 'inchworm',
  // "each side" is a prescription, so the qualifier strip refuses this one.
  // Same stand-in drillMedia already uses for the couch stretch.
  'couch stretch (each side)': 'intermediate hip flexor and quad stretch',
  // ── The catalogs' own names for lifts the library files differently ────
  //
  // Found by walking every exercise the ready catalogs prescribe against the
  // library: 113 of 274 names resolved to nothing, so they reached the reader
  // with no photo, no demo and no instructions in any language. These are the
  // ones the library does hold under another name. Each pair was checked by
  // hand on the same rule as the block above — SAME MOVEMENT, gear may differ.
  //
  // What is deliberately not here: the cardio prescriptions (Treadmill HIIT,
  // Easy Run Blocks), which are dosage rather than lifts and have no library
  // entry to point at, and the movements the library genuinely lacks (Burpee,
  // Bird Dog, Nordic Hamstring Curl). A near miss is worse than a blank.
  'competition back squat': 'barbell full squat',
  'pause squat': 'barbell full squat',
  'competition deadlift': 'barbell deadlift',
  'conventional deadlift': 'barbell deadlift',
  'pendlay row': 'bent over barbell row',
  'seated machine row': 'seated cable rows',
  'machine shoulder press': 'machine shoulder (military) press',
  'standing dumbbell shoulder press': 'standing dumbbell press',
  'cable bicep curl': 'standing biceps cable curl',
  'triceps kickback': 'tricep dumbbell kickback',
  'triceps dip (chair)': 'bench dips',
  'explosive pull-up': 'pullups',
  'muscle-up progression (negative)': 'muscle up',
  'band pull-apart': 'band pull apart',
  'battle rope wave': 'battling ropes',
  'standing side bend': 'dumbbell side bend',
  'broad jump': 'standing long jump',
  // A sumo squat is a wide-stance squat; the library files that movement as a
  // plie, and holding a dumbbell is gear, not a different lift.
  'sumo squat': 'plie dumbbell squat',
  // The library's pistol is counterbalanced with a kettlebell. Same position.
  'pistol squat (each leg)': 'kettlebell pistol squat',
  // The library's "Air Bike" is the bicycle crunch, not the fan bike — which is
  // exactly why the qualifier strip refuses "Air Bike (30s sprint)" above.
  'bicycle crunch': 'air bike',
  "child's pose with reach": "child's pose",
  'lying quad stretch': 'quad stretch',
  'hip flexor stretch': 'kneeling hip flexor',
  // Prescriptions the strip refuses on purpose, named one by one instead.
  'push-up (20s on / 10s off)': 'pushups',
  'squat jump (20s on / 10s off)': 'freehand jump squat',
  'mountain climber (20s on / 10s off)': 'mountain climbers',
  'rowing machine hiit': 'rowing, stationary',
  'rowing machine (500m intervals)': 'rowing, stationary',
  'stationary bike (easy pace)': 'bicycling, stationary',
};

/**
 * A trailing parenthetical carrying a PRESCRIPTION, not a cue.
 *
 * These must never be stripped. "Air Bike (30s sprint)" is a fan bike; drop
 * the qualifier and it resolves to the library's "Air Bike", which in this
 * catalog is the ab exercise (see catalogExercisePools). A confidently wrong
 * photo is worse than no photo.
 */
const PRESCRIPTION_QUALIFIER = /\d|each (side|leg|arm)|per side/i;

/**
 * "Seated Cable Row (Wide)" -> "seated cable row".
 *
 * The catalogs qualify names with coaching cues the library never spells:
 * (Wide), (Light), (Banded), (Bodyweight), (or Knee Push-Up). Every one of
 * them resolved to nothing, so 16 prescribed exercises reached the user with
 * no photo, no demo and no swap pool. The qualifier stays on screen — this
 * only affects what the name is matched against.
 */
function stripCoachingQualifier(normalized: string): string | null {
  const match = normalized.match(/^(.*?)\s*\(([^)]*)\)$/);
  if (!match || PRESCRIPTION_QUALIFIER.test(match[2])) {
    return null;
  }
  const head = match[1].trim();
  return head && head !== normalized ? head : null;
}

export function findGuidedLibraryIndex(
  exerciseName: string,
  libraryNames: string[],
): number | null {
  const normalized = exerciseName.trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  const lowerNames = libraryNames.map((name) => name.trim().toLowerCase());

  const resolveExactOrAlias = (candidate: string): number | null => {
    const exact = lowerNames.indexOf(candidate);
    if (exact >= 0) {
      return exact;
    }

    const alias = GUIDED_LIBRARY_ALIASES[candidate];
    const aliasIndex = alias ? lowerNames.indexOf(alias) : -1;
    return aliasIndex >= 0 ? aliasIndex : null;
  };

  const direct = resolveExactOrAlias(normalized);
  if (direct !== null) {
    return direct;
  }

  let bestIndex: number | null = null;
  let bestLength = Infinity;
  lowerNames.forEach((name, index) => {
    if (name.includes(normalized) && name.length < bestLength) {
      bestIndex = index;
      bestLength = name.length;
    }
  });
  if (bestIndex !== null) {
    return bestIndex;
  }

  // The stripped name gets exact and alias lookups but NOT containment.
  // Dropping the qualifier makes a name shorter and more generic, and
  // containment on a generic name is where it goes wrong: "rows" is inside
  // "seated cable rows", "side plank" is inside "push up to side plank".
  // Anything the strip should reach is worth naming in the alias table.
  const stripped = stripCoachingQualifier(normalized);
  return stripped ? resolveExactOrAlias(stripped) : null;
}

/** Oversized 2-letter initials for the brand-panel media fallback. */
export function getGuidedInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter((word) => /^[A-Za-z]/.test(word))
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('');
}

/** One line of the run sheet: a warm-up drill, a lift, or a cool-down drill. */
export interface GuidedRunItem {
  groupIndex: number;
  phase: GuidedPhase;
  name: string;
  /** Sets, for a lift. Null for a drill, which is measured in seconds. */
  setCount: number | null;
  status: 'done' | 'current' | 'upcoming';
}

/**
 * The whole session as a list, with where you are in it.
 *
 * "Treenin aikana ei ole mitään keinoa nähdä seuraavaa liikettä" (#bugs
 * 2026-08-27). The player shows one step at a time on purpose — you are
 * lifting, not reading — and the rail under it is dots, which say how far
 * along you are and nothing about what they stand for. So the session existed
 * only as the step you were on: to find out whether the last lift was coming
 * you had to reach it.
 *
 * Built from the steps rather than from the groups because the groups carry no
 * names: a group is a shape on a rail, and this is the same session read out
 * loud. The order is the order it will be done in, which is why the first step
 * of each group wins — it names the group before any of its sets do.
 */
export function buildGuidedRunSheet(plan: GuidedStepPlan, stepIndex: number): GuidedRunItem[] {
  const currentGroup = groupIndexOfStep(plan.steps[stepIndex]);
  const items: GuidedRunItem[] = [];
  const seen = new Set<number>();

  for (const step of plan.steps) {
    const groupIndex = groupIndexOfStep(step);
    if (groupIndex === null || seen.has(groupIndex)) {
      continue;
    }
    if (step.type === 'splash' || step.type === 'finish') {
      continue;
    }
    const name =
      step.type === 'ready' || step.type === 'drill' ? step.drillName : step.exerciseName;
    seen.add(groupIndex);
    items.push({
      groupIndex,
      phase: step.phase,
      name,
      setCount: plan.groups[groupIndex]?.setCount ?? null,
      status:
        currentGroup === null || groupIndex > currentGroup
          ? 'upcoming'
          : groupIndex === currentGroup
            ? 'current'
            : 'done',
    });
  }

  return items;
}

function groupIndexOfStep(step: GuidedStep | undefined): number | null {
  if (!step || step.type === 'splash' || step.type === 'finish') {
    return null;
  }
  return step.groupIndex;
}
