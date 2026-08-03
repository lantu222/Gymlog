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
import { SessionRoutineBlock } from './homeSessionHero';
import { t } from './i18n';
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
    }
  | {
      type: 'rest';
      phase: 'work';
      slotId: string;
      exerciseName: string;
      setIndex: number;
      seconds: number;
      groupIndex: number;
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
  const exercises = input.exercises.filter((exercise) => !exercise.skipped && exercise.setCount > 0);
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
    exercises.forEach((exercise, exerciseIndex) => {
      const groupIndex = groups.length;
      groups.push({ phase: 'work', setCount: exercise.setCount });
      steps.push({
        type: 'position',
        phase: 'work',
        slotId: exercise.slotId,
        exerciseName: exercise.name,
        seconds: GUIDED_POSITION_SECONDS,
        groupIndex,
        exerciseIndex,
        exerciseCount: exercises.length,
      });
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
          exerciseCount: exercises.length,
        });
        const isFinalSetOfSession = exerciseIndex === exercises.length - 1 && setIndex === exercise.setCount - 1;
        if (!isFinalSetOfSession) {
          steps.push({
            type: 'rest',
            phase: 'work',
            slotId: exercise.slotId,
            exerciseName: exercise.name,
            setIndex,
            seconds: Math.max(15, exercise.restSeconds),
            groupIndex,
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
      return t(language, 'guided.label.rest');
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
    return t(language, 'guided.target.reps', { reps: target.reps });
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
    prefilledFromPerformedAt?: string;
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

  const reps = previous?.actualReps ?? set.plannedRepsMax;

  if (trackingMode === 'bodyweight') {
    return { reps, loadKg: null, autoProgressedFromKg: null, prefilledFromPerformedAt: null };
  }

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
  };
}

/**
 * Where to resume. A stored index wins (clamped, rolled forward past sets that
 * were completed meanwhile, e.g. in list view). With no stored index: the
 * first incomplete set when some sets are already logged, else the start.
 */
export function resolveGuidedResumeIndex(
  steps: GuidedStep[],
  storedIndex: number | null | undefined,
  isSetCompleted: (slotId: string, setIndex: number) => boolean,
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

  if (typeof storedIndex === 'number' && Number.isFinite(storedIndex) && storedIndex > 0) {
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
      message: t(language, 'guided.coach.pr', { kg: formatKg(input.pr.bestKg), name: input.pr.exerciseName }),
      sub: t(language, 'guided.coach.prSub', {
        name: input.pr.exerciseName,
        kg: formatKg(input.pr.bestKg + 2.5),
      }),
    };
  }
  if (input.topSet) {
    return {
      message: t(language, 'guided.coach.top', {
        name: input.topSet.exerciseName,
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
const GUIDED_LIBRARY_ALIASES: Record<string, string> = {
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
};

export function findGuidedLibraryIndex(
  exerciseName: string,
  libraryNames: string[],
): number | null {
  const normalized = exerciseName.trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  const lowerNames = libraryNames.map((name) => name.trim().toLowerCase());

  const exact = lowerNames.indexOf(normalized);
  if (exact >= 0) {
    return exact;
  }

  const alias = GUIDED_LIBRARY_ALIASES[normalized];
  if (alias) {
    const aliasIndex = lowerNames.indexOf(alias);
    if (aliasIndex >= 0) {
      return aliasIndex;
    }
  }

  let bestIndex: number | null = null;
  let bestLength = Infinity;
  lowerNames.forEach((name, index) => {
    if (name.includes(normalized) && name.length < bestLength) {
      bestIndex = index;
      bestLength = name.length;
    }
  });
  return bestIndex;
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
