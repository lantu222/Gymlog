import type {
  WorkoutExerciseInstance,
  WorkoutLiftIdentity,
  WorkoutSetInstance,
  WorkoutTrackingMode,
} from '../features/workout/workoutTypes';

/**
 * Which lift each set of one exercise slot was.
 *
 * A slot can hold more than one lift in a session: two sets of back squat, the
 * rack is taken, the rest on the goblet squat. The swap sheet promises "your
 * logged sets stay on the exercise you did them on", and the save used to break
 * that promise — it filed every set under the lift the slot held at the end,
 * so the goblet squat's history, Progress row and records got the two 100 kg
 * squat sets, the back squat got nothing, and the next back squat opened on
 * last week's weight (swap audit, 2026-09-21).
 *
 * So the sets before a swap belong to the lift they were logged as, and the
 * sets after it to the lift that replaced it. Everything that saves a finished
 * slot — the exercise logs, the finish screen's rows, the slot history the next
 * session prefills from — asks this one function, so the three cannot file one
 * set under two lifts.
 */

export interface LiftSegment {
  exerciseName: string;
  trackingMode: WorkoutTrackingMode;
  /**
   * The lift the programme prescribes in this slot, when this segment is not
   * it; null when it is. A segment that is not the programmed lift is a swap,
   * and is saved as one: no claim on the programme's exercise template, and
   * the swap on record.
   */
  swappedFrom: string | null;
  /**
   * The lift the exercise holds now, and the sets still pending with it. No
   * segment is current when the swap came after the last set (see
   * splitExerciseByLift).
   */
  current: boolean;
  /**
   * This lift's sets in the order they were done. Renumbered from zero when
   * the slot held more than one lift, so the goblet squat's first set is its
   * set 1 rather than the slot's set 3 — the prefill reads a history entry by
   * set index.
   */
  sets: WorkoutSetInstance[];
}

type SegmentableExercise = Pick<
  WorkoutExerciseInstance,
  'exerciseName' | 'trackingMode' | 'sourceExerciseName' | 'swappedAfterSetIndex' | 'sets'
>;

const TRACKING_MODES: readonly WorkoutTrackingMode[] = ['load_and_reps', 'reps_first', 'bodyweight', 'hold'];

function normalizeName(name: string) {
  return name.trim().toLowerCase();
}

/**
 * A stamp is read back from the persisted session, so it is checked rather
 * than trusted: anything that is not a named lift with a known mode is no
 * stamp at all.
 */
function readStamp(value: unknown): WorkoutLiftIdentity | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const { exerciseName, trackingMode } = value as Partial<WorkoutLiftIdentity>;
  if (typeof exerciseName !== 'string' || !exerciseName.trim()) {
    return null;
  }
  return {
    exerciseName: exerciseName.trim(),
    trackingMode: TRACKING_MODES.includes(trackingMode as WorkoutTrackingMode)
      ? (trackingMode as WorkoutTrackingMode)
      : 'load_and_reps',
  };
}

/**
 * The lift one set was, when it was not the exercise's current one; null when
 * it was.
 *
 * The stamp answers for every set logged since the stamp exists — each is
 * stamped as it is logged. A session that was already running when the stamp
 * arrived has only the line of its one swap (`swappedAfterSetIndex`), and back
 * then a swap never changed the exercise's mode, so the lift before the line
 * was logged the way the exercise still is.
 */
export function liftBeforeSwap(exercise: SegmentableExercise, set: WorkoutSetInstance): WorkoutLiftIdentity | null {
  const stamp = readStamp(set.loggedAs);
  if (stamp) {
    return normalizeName(stamp.exerciseName) === normalizeName(exercise.exerciseName) ? null : stamp;
  }
  const source = exercise.sourceExerciseName?.trim();
  if (
    source &&
    set.status === 'completed' &&
    typeof exercise.swappedAfterSetIndex === 'number' &&
    set.setIndex <= exercise.swappedAfterSetIndex &&
    normalizeName(source) !== normalizeName(exercise.exerciseName)
  ) {
    return { exerciseName: source, trackingMode: exercise.trackingMode };
  }
  return null;
}

/**
 * The slot's sets, grouped by the lift that did them, in the order the lifts
 * were first done.
 *
 * A lift with no set at all is not one of them. That is the current lift when
 * every set was logged before the swap and none was added after it: nothing
 * was planned or done as that lift, and a row for it put an empty card on the
 * finish screen and counted the slot twice (review of this change). An
 * exercise with no sets whatever is still its current lift.
 */
export function splitExerciseByLift(exercise: SegmentableExercise): LiftSegment[] {
  const programmed = exercise.sourceExerciseName?.trim() || exercise.exerciseName;
  const swappedFromFor = (name: string) =>
    normalizeName(name) === normalizeName(programmed) ? null : programmed;
  const ordered = [...exercise.sets].sort((left, right) => left.setIndex - right.setIndex);

  const currentKey = normalizeName(exercise.exerciseName);
  const byLift = new Map<string, LiftSegment>();
  const order: string[] = [];
  const segmentFor = (lift: WorkoutLiftIdentity, current: boolean) => {
    const key = current ? currentKey : normalizeName(lift.exerciseName);
    let segment = byLift.get(key);
    if (!segment) {
      segment = {
        exerciseName: lift.exerciseName,
        trackingMode: lift.trackingMode,
        swappedFrom: swappedFromFor(lift.exerciseName),
        current,
        sets: [],
      };
      byLift.set(key, segment);
      order.push(key);
    }
    return segment;
  };

  const currentLift = { exerciseName: exercise.exerciseName, trackingMode: exercise.trackingMode };
  ordered.forEach((set) => {
    const before = liftBeforeSwap(exercise, set);
    segmentFor(before ?? currentLift, before === null).sets.push(set);
  });
  if (order.length === 0) {
    segmentFor(currentLift, true);
  }

  const segments = order.map((key) => byLift.get(key)!);
  if (segments.length === 1) {
    return segments;
  }
  return segments.map((segment) => ({
    ...segment,
    sets: segment.sets.map((set, index) => (set.setIndex === index ? set : { ...set, setIndex: index })),
  }));
}
