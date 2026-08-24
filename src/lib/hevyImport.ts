/**
 * Hevy CSV export → importable workout history.
 *
 * Hevy's "Export data" mails one CSV where every row is a single set:
 * `title, start_time, end_time, description, exercise_title, superset_id,
 * exercise_notes, set_index, set_type, weight_kg (or weight_lbs), reps,
 * distance_km, duration_seconds, rpe`. Timestamps come as ISO in some exports
 * and as `"10 Jun 2024, 08:15"` in others; weight arrives in whichever unit
 * the account used. All of it is handled here, header-driven — column order
 * is never assumed.
 *
 * This module only parses and summarises. Writing the workouts into the
 * database goes through the same persistence path a finished live workout
 * uses, with a deterministic session id per Hevy start time, so importing the
 * same file twice cannot duplicate a single workout.
 */

export interface HevyImportedSet {
  weightKg: number;
  reps: number;
  kind: 'working' | 'warmup' | 'drop';
}

export interface HevyImportedExercise {
  name: string;
  sets: HevyImportedSet[];
}

export interface HevyImportedWorkout {
  name: string;
  /** ISO — also the identity: one Hevy workout is one start time. */
  startedAt: string;
  endedAt: string | null;
  exercises: HevyImportedExercise[];
}

export interface HevyImportPreview {
  workouts: HevyImportedWorkout[];
  setCount: number;
  firstDate: string | null;
  lastDate: string | null;
  /** Rows with no countable set — duration-only cardio, empty lines. */
  skippedRowCount: number;
  errors: string[];
}

const LBS_TO_KG = 0.45359237;

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

/**
 * Whether pasted text is a Hevy history export rather than a programme CSV.
 * The two columns no programme file carries, together, are proof enough.
 */
export function isHevyHistoryCsv(text: string): boolean {
  const firstLine = text.trimStart().split(/\r?\n/, 1)[0] ?? '';
  const header = firstLine.toLowerCase();
  return header.includes('exercise_title') && header.includes('start_time');
}

/** One CSV line → fields, honouring quotes, embedded commas and "" escapes. */
function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      fields.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields;
}

/** `"10 Jun 2024, 08:15"` or ISO → ISO string, or null. */
function parseHevyTimestamp(raw: string): string | null {
  const value = raw.trim();
  if (!value) {
    return null;
  }
  const named = value.match(/^(\d{1,2}) ([A-Za-z]{3,}) (\d{4}),? (\d{1,2}):(\d{2})/);
  if (named) {
    const month = MONTHS[named[2].slice(0, 3).toLowerCase()];
    if (month !== undefined) {
      const date = new Date(
        Number(named[3]),
        month,
        Number(named[1]),
        Number(named[4]),
        Number(named[5]),
      );
      return Number.isNaN(date.getTime()) ? null : date.toISOString();
    }
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function toNumber(raw: string | undefined): number | null {
  if (raw === undefined) {
    return null;
  }
  const value = Number(raw.trim().replace(',', '.'));
  return Number.isFinite(value) ? value : null;
}

function setKind(rawType: string | undefined): HevyImportedSet['kind'] {
  const value = (rawType ?? '').trim().toLowerCase();
  if (value === 'warmup' || value === '2') {
    return 'warmup';
  }
  if (value === 'dropset' || value === '3') {
    return 'drop';
  }
  return 'working';
}

export function parseHevyCsv(text: string): HevyImportPreview {
  const empty: HevyImportPreview = {
    workouts: [],
    setCount: 0,
    firstDate: null,
    lastDate: null,
    skippedRowCount: 0,
    errors: [],
  };
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) {
    return { ...empty, errors: ['EMPTY'] };
  }

  const header = splitCsvLine(lines[0]).map((column) => column.trim().toLowerCase());
  const col = (name: string) => header.indexOf(name);
  const columns = {
    title: col('title'),
    startTime: col('start_time'),
    endTime: col('end_time'),
    exercise: col('exercise_title'),
    setType: col('set_type'),
    weightKg: col('weight_kg'),
    weightLbs: col('weight_lbs'),
    reps: col('reps'),
    duration: col('duration_seconds'),
  };
  if (columns.startTime < 0 || columns.exercise < 0) {
    return { ...empty, errors: ['NOT_HEVY'] };
  }

  // File order everywhere: workouts in the order the export lists them,
  // exercises in the order they were performed.
  const workoutsByKey = new Map<string, HevyImportedWorkout>();
  let setCount = 0;
  let skippedRowCount = 0;

  for (let i = 1; i < lines.length; i += 1) {
    if (!lines[i].trim()) {
      continue;
    }
    const fields = splitCsvLine(lines[i]);
    const startedAt = parseHevyTimestamp(fields[columns.startTime] ?? '');
    const exerciseName = (fields[columns.exercise] ?? '').trim();
    if (!startedAt || !exerciseName) {
      skippedRowCount += 1;
      continue;
    }

    const reps = toNumber(fields[columns.reps]);
    const weightKgRaw = columns.weightKg >= 0 ? toNumber(fields[columns.weightKg]) : null;
    const weightLbs = columns.weightLbs >= 0 ? toNumber(fields[columns.weightLbs]) : null;
    const weightKg = weightKgRaw ?? (weightLbs !== null ? weightLbs * LBS_TO_KG : null);

    // A row with no reps is duration- or distance-only work (cardio blocks);
    // v1 imports the lifting history and counts the rest out loud.
    if (!reps || reps <= 0) {
      skippedRowCount += 1;
      continue;
    }

    const key = startedAt;
    let workout = workoutsByKey.get(key);
    if (!workout) {
      workout = {
        name: (columns.title >= 0 ? (fields[columns.title] ?? '').trim() : '') || 'Hevy workout',
        startedAt,
        endedAt: columns.endTime >= 0 ? parseHevyTimestamp(fields[columns.endTime] ?? '') : null,
        exercises: [],
      };
      workoutsByKey.set(key, workout);
    }

    let exercise = workout.exercises[workout.exercises.length - 1];
    if (!exercise || exercise.name !== exerciseName) {
      // Non-consecutive repeats (straight sets split around a superset) still
      // belong to one entry — find the existing group before opening another.
      exercise = workout.exercises.find((candidate) => candidate.name === exerciseName) ?? {
        name: exerciseName,
        sets: [],
      };
      if (!workout.exercises.includes(exercise)) {
        workout.exercises.push(exercise);
      }
    }
    exercise.sets.push({
      weightKg: Math.max(0, Math.round((weightKg ?? 0) * 100) / 100),
      reps: Math.max(1, Math.round(reps)),
      kind: setKind(columns.setType >= 0 ? fields[columns.setType] : undefined),
    });
    setCount += 1;
  }

  const workouts = [...workoutsByKey.values()].filter((workout) => workout.exercises.length > 0);
  const dates = workouts.map((workout) => workout.startedAt).sort();
  return {
    workouts,
    setCount,
    firstDate: dates[0] ?? null,
    lastDate: dates[dates.length - 1] ?? null,
    skippedRowCount,
    errors: workouts.length === 0 ? ['NO_WORKOUTS'] : [],
  };
}
