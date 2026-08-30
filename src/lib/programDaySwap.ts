import { WORKOUT_TEMPLATES_V1 } from '../features/workout/workoutCatalog';
import { inferBodyPartFromExerciseName } from './workoutCompleteView';

/**
 * Swapping a whole day out of a programme for one that trains something else.
 *
 * The request, in the reader's own words (2026-08-26): "Haluaisin vaihtaa
 * kokonaisen päivän tiedän että on tarkoituksella rankka mutta haluan
 * rinta%vatsat treenit myös mukaan." So this is not moving a day to another
 * weekday — that already works — and not reordering the exercises inside one.
 * It is changing WHAT A DAY TRAINS while keeping the rest of the programme.
 *
 * Candidates are real days out of the catalogue rather than generated ones.
 * That is the whole design decision here: the app has 57 programmes and 197
 * written sessions, and a chest day somebody wrote is better than a chest day
 * assembled from a rule — and, more to the point, it is checkable. A generated
 * day would need its own defence about set counts, rep ranges and ordering;
 * a catalogue day arrives with all three already decided.
 *
 * Pure: the catalogue is a static import and the library is passed in, so the
 * whole thing can be tested without a store or a screen.
 */

export interface DaySwapLibraryItem {
  name: string;
  bodyPart: string;
}

export interface DaySwapCandidate {
  /** The catalogue session this day would be replaced by. */
  templateId: string;
  sessionId: string;
  /** The programme it comes from, so the reader can see the provenance. */
  templateName: string;
  sessionName: string;
  /** Muscle groups it trains, most sets first, at most three. */
  muscles: string[];
  exerciseCount: number;
  setCount: number;
}

/**
 * The muscle groups a set of exercise names trains, biggest share first.
 *
 * The library's own `bodyPart` wins on an exact name match; anything the
 * library does not carry falls back to the same name patterns the completion
 * screen uses. Sharing that inference matters more than it looks: if this
 * screen and the summary screen disagreed about what "Chest-Supported Row"
 * trains, the reader would swap in a back day and be shown a chest one.
 */
export function summariseSessionMuscles(
  exerciseNames: readonly string[],
  library: readonly DaySwapLibraryItem[],
  limit = 3,
): string[] {
  const byName = new Map(library.map((item) => [item.name.trim().toLowerCase(), item.bodyPart]));
  const counts = new Map<string, number>();

  for (const name of exerciseNames) {
    const exact = byName.get(name.trim().toLowerCase());
    const group = (exact ?? inferBodyPartFromExerciseName(name)).toLowerCase();
    if (group === 'other') {
      continue;
    }
    counts.set(group, (counts.get(group) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([group]) => group);
}

/**
 * Every catalogue day that could stand in for one, minus the day itself.
 *
 * Deliberately not filtered down to "days like this one": the reader asking
 * for this wants a day that is NOT like this one — that is the entire point of
 * the request. Sorting is by muscle group so the list can be read by what it
 * trains, which is how the ask was phrased ("rinta, vatsat"), rather than by
 * which programme it came from.
 */
export function buildDaySwapCandidates(
  currentSessionId: string,
  library: readonly DaySwapLibraryItem[],
): DaySwapCandidate[] {
  const candidates: DaySwapCandidate[] = [];

  for (const template of WORKOUT_TEMPLATES_V1) {
    for (const session of template.sessions) {
      if (session.id === currentSessionId || session.exercises.length === 0) {
        continue;
      }
      const names = session.exercises.map((exercise) => exercise.exerciseName);
      candidates.push({
        templateId: template.id,
        sessionId: session.id,
        templateName: template.name,
        sessionName: session.name,
        muscles: summariseSessionMuscles(names, library),
        exerciseCount: session.exercises.length,
        setCount: session.exercises.reduce((total, exercise) => total + exercise.sets, 0),
      });
    }
  }

  return candidates.sort(
    (a, b) =>
      (a.muscles[0] ?? 'zz').localeCompare(b.muscles[0] ?? 'zz') ||
      a.templateName.localeCompare(b.templateName) ||
      a.sessionName.localeCompare(b.sessionName),
  );
}

/**
 * Candidates whose LEADING muscle group is the one asked for.
 *
 * Membership was the first cut — any day that trained chest at all — and on a
 * device it read wrong: a session called "Back" appeared under the Chest
 * filter because chest happened to make its top three. True, and useless. The
 * reader picking a filter is asking what a day IS, not what it touches.
 */
export function filterDaySwapCandidates(
  candidates: readonly DaySwapCandidate[],
  muscle: string | null,
): DaySwapCandidate[] {
  if (!muscle) {
    return [...candidates];
  }
  return candidates.filter((candidate) => candidate.muscles[0] === muscle);
}

/**
 * The filter row, built from LEADING groups only — the same rule the filter
 * itself applies. Offering a chip that no day leads with would be a filter
 * that empties the list, which reads as a broken screen rather than as an
 * honest "none of these".
 */
export function daySwapMuscleOptions(candidates: readonly DaySwapCandidate[]): string[] {
  const seen = new Set<string>();
  for (const candidate of candidates) {
    if (candidate.muscles[0]) {
      seen.add(candidate.muscles[0]);
    }
  }
  return [...seen].sort();
}

export interface DaySwapExercise {
  id: string;
  name: string;
  targetSets: number;
  repMin: number;
  repMax: number;
  restSeconds: number | null;
  trackedDefault: boolean;
  libraryItemId: string | null;
}

/**
 * The replacement day's exercises, renamed into the target day's id space.
 *
 * Ids are rebuilt from the session being replaced rather than carried over
 * from the catalogue. Two days in one programme holding exercises with the
 * same id is the kind of thing that works until the reader edits one of them
 * and both change.
 */
export function buildSwappedDayExercises(
  candidate: Pick<DaySwapCandidate, 'templateId' | 'sessionId'>,
  targetSessionId: string,
  resolveLibraryItemId: (name: string) => string | null,
): DaySwapExercise[] {
  const template = WORKOUT_TEMPLATES_V1.find((entry) => entry.id === candidate.templateId);
  const session = template?.sessions.find((entry) => entry.id === candidate.sessionId);
  if (!session) {
    return [];
  }

  return session.exercises.map((exercise, index) => ({
    id: `${targetSessionId}_swap_${index + 1}`,
    name: exercise.exerciseName,
    targetSets: exercise.sets,
    repMin: exercise.repsMin,
    repMax: exercise.repsMax,
    // The catalogue carries a range; the programme draft holds one number, and
    // the shorter rest is the one that keeps a session inside its estimate.
    restSeconds: exercise.restSecondsMin ?? null,
    trackedDefault: exercise.trackingMode !== 'bodyweight',
    libraryItemId: resolveLibraryItemId(exercise.exerciseName),
  }));
}
