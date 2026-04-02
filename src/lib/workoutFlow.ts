import { WorkoutExerciseInstance, WorkoutRole, WorkoutTemplateExercise } from '../features/workout/workoutTypes';

export type WorkoutFlowPhase = 'warmup' | 'main' | 'build' | 'finish';

export interface WorkoutFlowPhaseMeta {
  label: string;
  kicker: string;
}

export interface WorkoutFlowTrailItem extends WorkoutFlowPhaseMeta {
  phase: WorkoutFlowPhase;
  state: 'complete' | 'current' | 'upcoming';
}

export interface WorkoutFlowPhasePreviewItem extends WorkoutFlowPhaseMeta {
  phase: WorkoutFlowPhase;
  exerciseCount: number;
  leadExerciseName: string;
  trailingLabel: string | null;
}

type WorkoutFlowInputExercise = Pick<WorkoutExerciseInstance, 'slotId' | 'exerciseName' | 'role'>;
type WorkoutFlowPreviewInputExercise = Pick<WorkoutTemplateExercise | WorkoutExerciseInstance, 'exerciseName' | 'role'>;

const PHASE_META: Record<WorkoutFlowPhase, WorkoutFlowPhaseMeta> = {
  warmup: {
    label: 'Warm up',
    kicker: 'Prep',
  },
  main: {
    label: 'Main work',
    kicker: 'Main',
  },
  build: {
    label: 'Build',
    kicker: 'Build',
  },
  finish: {
    label: 'Finish',
    kicker: 'Finish',
  },
};

function resolveExerciseIndex(exercises: WorkoutFlowInputExercise[], target: WorkoutExerciseInstance | string | number) {
  if (typeof target === 'number') {
    return target;
  }

  if (typeof target === 'string') {
    return exercises.findIndex((exercise) => exercise.slotId === target);
  }

  return exercises.findIndex((exercise) => exercise.slotId === target.slotId);
}

function resolveWorkoutFlowPhaseFromRole(
  roles: WorkoutRole[],
  exerciseIndex: number,
  role: WorkoutRole,
): WorkoutFlowPhase {
  const firstPrimaryIndex = roles.findIndex((item) => item === 'primary');
  if (firstPrimaryIndex > 0 && exerciseIndex < firstPrimaryIndex) {
    return 'warmup';
  }

  if (role === 'primary') {
    return 'main';
  }

  if (role === 'secondary') {
    return 'build';
  }

  return 'finish';
}

export function getWorkoutFlowPhase(
  exercises: WorkoutFlowInputExercise[],
  target: WorkoutExerciseInstance | string | number,
): WorkoutFlowPhase {
  const exerciseIndex = resolveExerciseIndex(exercises, target);
  const exercise = exerciseIndex >= 0 ? exercises[exerciseIndex] : null;
  if (!exercise) {
    return 'main';
  }

  return resolveWorkoutFlowPhaseFromRole(
    exercises.map((item) => item.role),
    exerciseIndex,
    exercise.role,
  );
}

export function getWorkoutFlowPhaseMeta(phase: WorkoutFlowPhase): WorkoutFlowPhaseMeta {
  return PHASE_META[phase];
}

export function getWorkoutFlowTrail(
  exercises: WorkoutFlowInputExercise[],
  activeSlotId: string | null,
): WorkoutFlowTrailItem[] {
  const orderedPhases: WorkoutFlowPhase[] = [];

  exercises.forEach((exercise, index) => {
    const phase = getWorkoutFlowPhase(exercises, index);
    if (!orderedPhases.includes(phase)) {
      orderedPhases.push(phase);
    }
  });

  const activePhase = activeSlotId ? getWorkoutFlowPhase(exercises, activeSlotId) : orderedPhases[0] ?? 'main';
  const activePhaseIndex = orderedPhases.indexOf(activePhase);

  return orderedPhases.map((phase, index) => ({
    phase,
    ...getWorkoutFlowPhaseMeta(phase),
    state: index < activePhaseIndex ? 'complete' : index === activePhaseIndex ? 'current' : 'upcoming',
  }));
}

export function getWorkoutFlowPhasePreview(
  exercises: WorkoutFlowPreviewInputExercise[],
): WorkoutFlowPhasePreviewItem[] {
  if (exercises.length === 0) {
    return [];
  }

  const roles = exercises.map((exercise) => exercise.role);
  const orderedPhases: WorkoutFlowPhase[] = [];
  const phaseMap = new Map<WorkoutFlowPhase, WorkoutFlowPreviewInputExercise[]>();

  exercises.forEach((exercise, index) => {
    const phase = resolveWorkoutFlowPhaseFromRole(roles, index, exercise.role);
    if (!orderedPhases.includes(phase)) {
      orderedPhases.push(phase);
    }

    const phaseExercises = phaseMap.get(phase) ?? [];
    phaseExercises.push(exercise);
    phaseMap.set(phase, phaseExercises);
  });

  return orderedPhases.map((phase) => {
    const phaseExercises = phaseMap.get(phase) ?? [];
    const leadExercise = phaseExercises[0];
    const remainingCount = Math.max(0, phaseExercises.length - 1);

    return {
      phase,
      ...getWorkoutFlowPhaseMeta(phase),
      exerciseCount: phaseExercises.length,
      leadExerciseName: leadExercise?.exerciseName ?? 'Open session',
      trailingLabel:
        remainingCount > 0
          ? `+${remainingCount} more`
          : phaseExercises.length > 1
            ? `${phaseExercises.length} lifts`
            : null,
    };
  });
}

export function formatWorkoutExerciseRange(exercise: WorkoutExerciseInstance) {
  const firstSet = exercise.sets[0];
  if (!firstSet) {
    return '';
  }

  if (firstSet.plannedRepsMin === firstSet.plannedRepsMax) {
    return `${firstSet.plannedRepsMin} reps`;
  }

  return `${firstSet.plannedRepsMin}-${firstSet.plannedRepsMax} reps`;
}

export function formatWorkoutExerciseQueueMeta(exercise: WorkoutExerciseInstance) {
  const setCount = exercise.sets.length;
  const setLabel = setCount === 1 ? 'set' : 'sets';
  return `${setCount} ${setLabel} | ${formatWorkoutExerciseRange(exercise)}`;
}
