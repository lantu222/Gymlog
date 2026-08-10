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
export function buildDuplicatedCustomProgramDraft(
  name: string,
  sessions: WorkoutTemplateSessionWithExercises[],
  existingNames: string[] = [],
  language: AppLanguage = 'en',
): WorkoutTemplateDraft {
  return {
    name: buildDisplayCopyName(name, language, existingNames),
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