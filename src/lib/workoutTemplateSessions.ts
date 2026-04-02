import { ExerciseTemplate, WorkoutTemplate, WorkoutTemplateSessionRecord, WorkoutTemplateSessionWithExercises } from '../types/models';

export function getLegacyTemplateSessionId(workoutTemplateId: string) {
  return `${workoutTemplateId}_session_1`;
}

export function buildLegacyTemplateSessions(template: Pick<WorkoutTemplate, 'id' | 'name'>, exercises: ExerciseTemplate[]): WorkoutTemplateSessionRecord[] {
  return [
    {
      id: getLegacyTemplateSessionId(template.id),
      name: template.name,
      orderIndex: 0,
      exerciseIds: exercises
        .slice()
        .sort((left, right) => left.orderIndex - right.orderIndex)
        .map((exercise) => exercise.id),
    },
  ];
}

export function buildWorkoutTemplateSessions(
  template: WorkoutTemplate,
  exercises: ExerciseTemplate[],
): WorkoutTemplateSessionWithExercises[] {
  const templateExercises = exercises.filter((exercise) => exercise.workoutTemplateId === template.id);
  const sessions = template.sessions?.length ? template.sessions : buildLegacyTemplateSessions(template, templateExercises);
  const sessionById = new Map(sessions.map((session) => [session.id, session] as const));
  const fallbackSessionId = sessions[0]?.id ?? getLegacyTemplateSessionId(template.id);

  const groupedExercises = new Map<string, ExerciseTemplate[]>();
  templateExercises.forEach((exercise) => {
    const resolvedSessionId = sessionById.has(exercise.workoutTemplateSessionId)
      ? exercise.workoutTemplateSessionId
      : sessions.find((session) => session.exerciseIds.includes(exercise.id))?.id ?? fallbackSessionId;
    const current = groupedExercises.get(resolvedSessionId) ?? [];
    current.push(exercise);
    groupedExercises.set(resolvedSessionId, current);
  });

  return sessions
    .slice()
    .sort((left, right) => left.orderIndex - right.orderIndex)
    .map((session) => ({
      ...session,
      exercises: (groupedExercises.get(session.id) ?? [])
        .slice()
        .sort((left, right) => left.orderIndex - right.orderIndex),
    }));
}