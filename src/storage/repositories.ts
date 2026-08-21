import { normalizeExerciseLog } from '../lib/exerciseLog';
import { buildWorkoutTemplateSessions } from '../lib/workoutTemplateSessions';
import {
  AppDatabase,
  BodyweightEntry,
  ExerciseLog,
  ExerciseTemplate,
  WorkoutPlan,
  WorkoutSession,
  WorkoutTemplate,
} from '../types/models';

export const workoutTemplateRepository = {
  list(database: AppDatabase) {
    return [...database.workoutTemplates].sort(
      (left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
    );
  },
  findById(database: AppDatabase, id: string) {
    return database.workoutTemplates.find((item) => item.id === id);
  },
  upsert(database: AppDatabase, template: WorkoutTemplate): AppDatabase {
    const existing = database.workoutTemplates.some((item) => item.id === template.id);

    return {
      ...database,
      workoutTemplates: existing
        ? database.workoutTemplates.map((item) => (item.id === template.id ? template : item))
        : [template, ...database.workoutTemplates],
    };
  },
  remove(database: AppDatabase, templateId: string): AppDatabase {
    return {
      ...database,
      workoutTemplates: database.workoutTemplates.filter((item) => item.id !== templateId),
      exerciseTemplates: database.exerciseTemplates.filter(
        (exercise) => exercise.workoutTemplateId !== templateId,
      ),
      workoutPlans: database.workoutPlans.map((plan) => ({
        ...plan,
        entries: plan.entries.filter((entry) => entry.workoutTemplateId !== templateId),
      })),
    };
  },
};

export const exerciseTemplateRepository = {
  listByWorkoutTemplateId(database: AppDatabase, workoutTemplateId: string) {
    const template = workoutTemplateRepository.findById(database, workoutTemplateId);
    const exercises = database.exerciseTemplates.filter((exercise) => exercise.workoutTemplateId === workoutTemplateId);

    if (!template) {
      return exercises.sort((left, right) => left.orderIndex - right.orderIndex);
    }

    return buildWorkoutTemplateSessions(template, exercises).flatMap((session) => session.exercises);
  },
  listByWorkoutTemplateSessionId(database: AppDatabase, workoutTemplateSessionId: string) {
    return database.exerciseTemplates
      .filter((exercise) => exercise.workoutTemplateSessionId === workoutTemplateSessionId)
      .sort((left, right) => left.orderIndex - right.orderIndex);
  },
  replaceForWorkoutTemplate(
    database: AppDatabase,
    workoutTemplateId: string,
    nextExercises: ExerciseTemplate[],
  ): AppDatabase {
    return {
      ...database,
      exerciseTemplates: [
        ...database.exerciseTemplates.filter((exercise) => exercise.workoutTemplateId !== workoutTemplateId),
        ...nextExercises,
      ],
    };
  },
};

export const workoutPlanRepository = {
  list(database: AppDatabase) {
    return [...database.workoutPlans].sort(
      (left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
    );
  },
  findById(database: AppDatabase, planId: string) {
    return database.workoutPlans.find((plan) => plan.id === planId);
  },
  upsert(database: AppDatabase, plan: WorkoutPlan): AppDatabase {
    const existing = database.workoutPlans.some((item) => item.id === plan.id);

    return {
      ...database,
      workoutPlans: existing
        ? database.workoutPlans.map((item) => (item.id === plan.id ? plan : item))
        : [plan, ...database.workoutPlans],
    };
  },
};

export const workoutSessionRepository = {
  list(database: AppDatabase) {
    return [...database.workoutSessions].sort(
      (left, right) => new Date(right.performedAt).getTime() - new Date(left.performedAt).getTime(),
    );
  },
  findById(database: AppDatabase, sessionId: string) {
    return database.workoutSessions.find((session) => session.id === sessionId);
  },
  append(database: AppDatabase, session: WorkoutSession): AppDatabase {
    return {
      ...database,
      workoutSessions: [session, ...database.workoutSessions],
    };
  },
  update(
    database: AppDatabase,
    sessionId: string,
    patch: Partial<Pick<WorkoutSession, 'workoutNameSnapshot' | 'sessionNotes'>>,
  ): AppDatabase {
    return {
      ...database,
      workoutSessions: database.workoutSessions.map((session) =>
        session.id === sessionId ? { ...session, ...patch } : session,
      ),
    };
  },
  /**
   * Removes a saved workout and the sets logged in it.
   *
   * The logs go with it, and that is not a detail: records, trends and the
   * coach's read are all computed from those rows, so leaving them behind would
   * have the app claim a personal best from a workout the reader had just
   * deleted. "Take it off the list" can only mean this if the list and the
   * numbers are to agree.
   */
  remove(database: AppDatabase, sessionId: string): AppDatabase {
    return {
      ...database,
      workoutSessions: database.workoutSessions.filter((session) => session.id !== sessionId),
      exerciseLogs: database.exerciseLogs.filter((log) => log.sessionId !== sessionId),
    };
  },
};

export const exerciseLogRepository = {
  listBySessionId(database: AppDatabase, sessionId: string) {
    return database.exerciseLogs
      .filter((log) => log.sessionId === sessionId)
      .sort((left, right) => left.orderIndex - right.orderIndex);
  },
  appendMany(database: AppDatabase, logs: ExerciseLog[]): AppDatabase {
    const normalizedLogs = logs
      .map((log) => normalizeExerciseLog(log))
      .filter((log): log is NonNullable<typeof log> => Boolean(log));

    return {
      ...database,
      exerciseLogs: [...normalizedLogs, ...database.exerciseLogs],
    };
  },
};

export const bodyweightRepository = {
  list(database: AppDatabase) {
    return [...database.bodyweightEntries].sort(
      (left, right) => new Date(right.recordedAt).getTime() - new Date(left.recordedAt).getTime(),
    );
  },
  append(database: AppDatabase, entry: BodyweightEntry): AppDatabase {
    return {
      ...database,
      bodyweightEntries: [entry, ...database.bodyweightEntries],
    };
  },
};
