import { AppLanguage, WorkoutTemplateDraft, WorkoutTemplateSessionWithExercises } from '../types/models';

import { buildDisplayCopyName } from './displayLabel';
import { localizeSessionName } from './sessionNameLabel';

/**
 * Duplication is where catalog English enters the user's own database.
 *
 * Session names are translated here rather than on the way out, because this
 * is the one moment the string stops being catalog data and becomes the user's
 * program. Every viewer already localises, so leaving it English only showed
 * through in the template editor — the one screen that must display the stored
 * name verbatim, since that is the name it will save.
 */
/**
 * A copy keeps the programme's own name.
 *
 * There is only one way to get here now: the reader changed a lift in a ready
 * programme, so the app made them their own version of it. They never asked
 * for a duplicate — they asked to change an exercise — and the whole point is
 * that the catalog original stays untouched behind them and comes back whole
 * if they take it up again (user 2026-08-26 and again 2026-09-08: "ei ole
 * tarkoitus olla kopiota ... alkuperäiset säilyy koskemattomina mutta tätä
 * sinun omaa ohjelmaasi voit muokata miten haluat").
 *
 * The "(kopio)" suffix survives for one case only, and it is not a feature:
 * when the plain name is already taken. Two rows reading the same is worse
 * than one reading "(kopio)" — and the reader can now type over either
 * (ProgramDetailScreen's rename).
 */
export function buildDuplicatedCustomProgramDraft(
  name: string,
  sessions: WorkoutTemplateSessionWithExercises[],
  existingNames: string[] = [],
  language: AppLanguage = 'en',
): WorkoutTemplateDraft {
  const taken = existingNames.some((existing) => existing.trim() === name.trim());
  return {
    name: taken ? buildDisplayCopyName(name, language, existingNames) : name,
    sessions: sessions
      .slice()
      .sort((left, right) => left.orderIndex - right.orderIndex)
      .map((session) => ({
        name: localizeSessionName(session.name, language),
        exercises: session.exercises
          .slice()
          .sort((left, right) => left.orderIndex - right.orderIndex)
          .map((exercise) => ({
            name: exercise.name,
            targetSets: exercise.targetSets,
            repMin: exercise.repMin,
            repMax: exercise.repMax,
            restSeconds: exercise.restSeconds,
            trackedDefault: exercise.trackedDefault,
            libraryItemId: exercise.libraryItemId ?? null,
            // The copy trains the same way the original did, supersets
            // included. Dropping this would unpair every superset in a
            // programme the moment the reader edited one lift in it.
            supersetGroup: exercise.supersetGroup ?? null,
          })),
      })),
  };
}
/** A day and a lift, as either the catalog or the reader's copy holds them. */
export interface ProgramTargetDay {
  id: string;
  exercises: ReadonlyArray<{ id: string; name: string }>;
}

/**
 * Where a catalog programme's day and lift ended up in the reader's copy.
 *
 * The copy is written through the repository, which mints its own ids, so an
 * edit made from the catalog page — that page still shows the untouched
 * original — carries ids the copy has never heard of. It used to apply to
 * nothing and be confirmed anyway. The copy keeps the days in order and the
 * lifts under their own names, so that is what this matches on: the day by
 * position, the lift by name inside it, and when a day holds the same lift
 * twice, by which of those it is — the second squat of the day, not the
 * second row. Anything else picks a row the reader was not pointing at once
 * they have added or moved a lift in their own version.
 *
 * Null means the copy has moved on from the original and this edit has no
 * target in it — the caller must not claim an edit it cannot make.
 */
export function locateCopiedProgramTarget(
  original: ReadonlyArray<ProgramTargetDay>,
  copy: ReadonlyArray<ProgramTargetDay>,
  sessionId: string,
  exerciseId: string,
): { sessionId: string; exerciseId: string } | null {
  const dayIndex = original.findIndex((session) => session.id === sessionId);
  if (dayIndex === -1) {
    return null;
  }
  const copiedDay = copy[dayIndex];
  if (!copiedDay) {
    return null;
  }
  // An add names the day and nothing else; there is no lift to find.
  if (!exerciseId) {
    return { sessionId: copiedDay.id, exerciseId: '' };
  }

  const source = original[dayIndex].exercises.findIndex((exercise) => exercise.id === exerciseId);
  if (source === -1) {
    return null;
  }
  const key = (exercise: { name: string }) => exercise.name.trim().toLowerCase();
  const name = key(original[dayIndex].exercises[source]);
  const occurrence = original[dayIndex].exercises
    .slice(0, source)
    .filter((exercise) => key(exercise) === name).length;
  const sameName = copiedDay.exercises.filter((exercise) => key(exercise) === name);
  const picked = sameName[occurrence];
  return picked ? { sessionId: copiedDay.id, exerciseId: picked.id } : null;
}
