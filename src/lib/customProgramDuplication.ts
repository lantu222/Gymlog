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
export interface DuplicateNamingOptions {
  /**
   * Keep the programme's own name instead of marking it a copy.
   *
   * For the copy that REPLACES a ready programme when one of its lifts is
   * changed. There the reader never asked for a duplicate — they asked to drop
   * an exercise — and handing back "Pakarakunto · Pro (kopio)" tells them a
   * second thing exists when it does not: the original is untouched in the
   * catalog and comes back whole if they ever take it up again (user
   * 2026-08-26, "onko tämä pakollinen eikö se voi vain mennä tämän ohjelman
   * päälle").
   *
   * A real duplicate — two of the reader's own, side by side — still gets the
   * suffix, and so does this one if the plain name is already taken, because
   * two rows reading the same is worse than one reading "(kopio)".
   */
  keepName?: boolean;
}

export function buildDuplicatedCustomProgramDraft(
  name: string,
  sessions: WorkoutTemplateSessionWithExercises[],
  existingNames: string[] = [],
  language: AppLanguage = 'en',
  { keepName = false }: DuplicateNamingOptions = {},
): WorkoutTemplateDraft {
  const taken = existingNames.some((existing) => existing.trim() === name.trim());
  return {
    name: keepName && !taken ? name : buildDisplayCopyName(name, language, existingNames),
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
          })),
      })),
  };
}