import { WorkoutTemplateDraft, WorkoutTemplateSessionWithExercises } from '../types/models';

import { buildDisplayCopyName } from './displayLabel';

export function buildDuplicatedCustomProgramDraft(
  name: string,
  sessions: WorkoutTemplateSessionWithExercises[],
  existingNames: string[] = [],
): WorkoutTemplateDraft {
  return {
    name: buildDisplayCopyName(name, existingNames),
    sessions: sessions
      .slice()
      .sort((left, right) => left.orderIndex - right.orderIndex)
      .map((session) => ({
        name: session.name,
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