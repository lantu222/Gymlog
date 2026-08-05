import { ExerciseLog, WorkoutSession } from '../types/models';

/**
 * Every set you have ever logged, as text you can take away.
 *
 * The app already exported a PLAN — Day, Exercise, Sets, Reps, the structure
 * of a program. That is not the same thing as your training, and the free tier
 * had started promising "readable and exportable forever" on the strength of
 * it. Readable was true. Exportable was not: there was no way to get a single
 * logged set out of the app.
 *
 * This matters more than a missing feature usually would, because "your log is
 * yours" is the one claim this app makes that a competitor has demonstrably
 * broken — Strong's v6 update lost people years of saved workouts. A promise
 * like that has to be checkable, and the only thing that makes it checkable is
 * being able to walk out with the data.
 *
 * Deliberately not a file. There is no storage the user can reach without a
 * document-picker dependency, so this is text for the system share sheet:
 * mail it to yourself, paste it into Sheets. The same choice the plan export
 * already made, for the same reason.
 */

export const WORKOUT_LOG_CSV_HEADER = 'Date,Workout,Exercise,Set,Reps,Weight (kg),Completed';

/**
 * RFC 4180 quoting. Exercise names carry commas ("Rows (Bar or Rings)") and
 * apostrophes, and a workout can be named anything at all — an unquoted field
 * turns one of those into two columns and silently shifts every value after it.
 */
function csvField(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? '' : String(value);
  if (!/[",\n\r]/.test(text)) {
    return text;
  }
  return `"${text.replace(/"/g, '""')}"`;
}

function isoDate(value: string): string {
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString().slice(0, 10) : '';
}

export interface WorkoutLogCsvInput {
  sessions: WorkoutSession[];
  logs: ExerciseLog[];
}

/**
 * Rows for one logged exercise, from whichever shape it was stored in.
 *
 * `sets` is the current shape. Older entries carry only `repsPerSet` plus a
 * single `weight`, and reading `sets` alone would export nothing for them —
 * a silent hole in exactly the years of history this feature exists to hand
 * back. `database.ts` already normalises on load, but an export that assumes
 * one shape is one migration away from losing someone's first season.
 */
function logRows(log: ExerciseLog): Array<{
  set: number;
  reps: number | null;
  weight: number | null;
  completed: boolean;
}> {
  if (log.sets && log.sets.length > 0) {
    return [...log.sets]
      .sort((left, right) => left.orderIndex - right.orderIndex)
      .map((set) => ({
        set: set.orderIndex + 1,
        reps: set.reps,
        weight: set.weight,
        // A set with no status at all predates the field and was, by
        // definition, one the user finished.
        completed: (set.status ?? 'completed') === 'completed',
      }));
  }
  return (log.repsPerSet ?? []).map((reps, index) => ({
    set: index + 1,
    reps,
    weight: log.weight,
    completed: true,
  }));
}

/**
 * Newest session first, sets in the order they were performed.
 *
 * A session with no logged sets contributes no rows: the file should contain
 * work, not a record of days the app was opened.
 */
export function buildWorkoutLogCsv({ sessions, logs }: WorkoutLogCsvInput): string {
  const logsBySession = new Map<string, ExerciseLog[]>();
  for (const log of logs) {
    const bucket = logsBySession.get(log.sessionId);
    if (bucket) {
      bucket.push(log);
    } else {
      logsBySession.set(log.sessionId, [log]);
    }
  }

  const ordered = [...sessions].sort(
    (left, right) => new Date(right.performedAt).getTime() - new Date(left.performedAt).getTime(),
  );

  const rows: string[] = [WORKOUT_LOG_CSV_HEADER];
  for (const session of ordered) {
    const sessionLogs = [...(logsBySession.get(session.id) ?? [])].sort(
      (left, right) => left.orderIndex - right.orderIndex,
    );
    for (const log of sessionLogs) {
      for (const row of logRows(log)) {
        rows.push(
          [
            csvField(isoDate(session.performedAt)),
            csvField(session.workoutNameSnapshot),
            csvField(log.exerciseNameSnapshot),
            csvField(row.set),
            csvField(row.reps ?? ''),
            csvField(row.weight ?? ''),
            csvField(row.completed ? 'yes' : 'no'),
          ].join(','),
        );
      }
    }
  }

  return rows.join('\n');
}

/** Row and session counts for the export screen, so it can say what it will send. */
export function summarizeWorkoutLog({ sessions, logs }: WorkoutLogCsvInput): {
  sessions: number;
  sets: number;
} {
  const sessionIds = new Set(sessions.map((session) => session.id));
  const counted = new Set<string>();
  let sets = 0;
  for (const log of logs) {
    if (!sessionIds.has(log.sessionId)) {
      continue;
    }
    const rows = logRows(log).length;
    if (rows > 0) {
      sets += rows;
      counted.add(log.sessionId);
    }
  }
  return { sessions: counted.size, sets };
}
