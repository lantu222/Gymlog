function normalize(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

function normalizeKey(value: string) {
  return normalize(value).toLowerCase();
}

function getFirstNamedExercise(exerciseNames: string[]) {
  return exerciseNames.map((name) => normalize(name)).find((name) => name.length > 0) ?? null;
}

export function getAutoSessionName({
  sessionIndex,
  workoutName,
  exerciseNames,
}: {
  sessionIndex: number;
  workoutName?: string | null;
  exerciseNames: string[];
}) {
  const exerciseBasedName = getFirstNamedExercise(exerciseNames);
  if (exerciseBasedName) {
    return exerciseBasedName;
  }

  const workoutTrimmed = normalize(workoutName ?? '');
  if (workoutTrimmed) {
    return `${workoutTrimmed} ${sessionIndex + 1}`;
  }

  return `Session ${sessionIndex + 1}`;
}

export function buildPersistedSessionNames(
  sessions: Array<{ exerciseNames: string[] }>,
  workoutName?: string | null,
) {
  const used = new Map<string, number>();

  return sessions.map((session, sessionIndex) => {
    const baseName = getAutoSessionName({
      sessionIndex,
      workoutName,
      exerciseNames: session.exerciseNames,
    });
    const key = normalizeKey(baseName);
    const seen = used.get(key) ?? 0;
    used.set(key, seen + 1);

    return seen === 0 ? baseName : `${baseName} ${seen + 1}`;
  });
}
