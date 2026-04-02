interface WorkoutLoggingSessionBootstrapInput {
  hydrated: boolean;
  activeSessionId: string | null;
  targetKey: string;
  lastBootstrappedTargetKey: string | null;
}

interface WorkoutLoggingSessionBootstrapResult {
  shouldStartWorkout: boolean;
  nextBootstrappedTargetKey: string | null;
}

export function getWorkoutLoggingSessionBootstrapResult({
  hydrated,
  activeSessionId,
  targetKey,
  lastBootstrappedTargetKey,
}: WorkoutLoggingSessionBootstrapInput): WorkoutLoggingSessionBootstrapResult {
  if (!hydrated) {
    return {
      shouldStartWorkout: false,
      nextBootstrappedTargetKey: lastBootstrappedTargetKey,
    };
  }

  if (activeSessionId) {
    return {
      shouldStartWorkout: false,
      nextBootstrappedTargetKey: targetKey,
    };
  }

  if (lastBootstrappedTargetKey === targetKey) {
    return {
      shouldStartWorkout: false,
      nextBootstrappedTargetKey: lastBootstrappedTargetKey,
    };
  }

  return {
    shouldStartWorkout: true,
    nextBootstrappedTargetKey: targetKey,
  };
}
