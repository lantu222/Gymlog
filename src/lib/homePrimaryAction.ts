import { ResumeWorkoutCardData } from '../components/ResumeWorkoutCard';
import { formatLiftDisplayLabel, formatWorkoutDisplayLabel } from './displayLabel';

interface HomePrimaryActionProgramReference {
  source: 'ready' | 'custom';
  workoutTemplateId: string;
  title: string;
  subtitle: string;
  meta?: string;
}

interface HomePrimaryActionResumeReference {
  title: string;
  nextExercise: string | null;
  meta: string;
}

export interface HomePrimaryActionInput {
  activeWorkout: HomePrimaryActionResumeReference | null;
  nextPlannedWorkout: HomePrimaryActionProgramReference | null;
  lastWorkout: HomePrimaryActionProgramReference | null;
  recommendedWorkout: HomePrimaryActionProgramReference | null;
}

export type HomePrimaryActionTarget =
  | { type: 'resume_active' }
  | { type: 'open_program'; source: 'ready' | 'custom'; workoutTemplateId: string }
  | { type: 'open_ready_library' };

export interface HomePrimaryActionSelection {
  mode: 'resume_active' | 'continue_plan' | 'open_last_workout' | 'ready_programs';
  card: ResumeWorkoutCardData;
  target: HomePrimaryActionTarget;
}

function buildProgramCard(
  eyebrow: string,
  actionLabel: string,
  reason: string,
  program: HomePrimaryActionProgramReference,
): ResumeWorkoutCardData {
  return {
    mode: 'start',
    eyebrow,
    title: formatWorkoutDisplayLabel(program.title, 'Workout'),
    subtitle: program.subtitle,
    reason,
    meta: program.meta,
    actionLabel,
  };
}

export function selectHomePrimaryAction({
  activeWorkout,
  nextPlannedWorkout,
  lastWorkout,
  recommendedWorkout,
}: HomePrimaryActionInput): HomePrimaryActionSelection {
  if (activeWorkout) {
    return {
      mode: 'resume_active',
      target: { type: 'resume_active' },
      card: {
        mode: 'resume',
        eyebrow: 'Live session',
        title: formatWorkoutDisplayLabel(activeWorkout.title, 'Workout'),
        subtitle: activeWorkout.nextExercise
          ? `Next up: ${formatLiftDisplayLabel(activeWorkout.nextExercise)}`
          : 'Jump back into the session you already started.',
        reason: 'This is first because you already have a live workout in progress.',
        meta: activeWorkout.meta,
        actionLabel: 'Resume workout',
      },
    };
  }

  if (nextPlannedWorkout) {
    return {
      mode: 'continue_plan',
      target: {
        type: 'open_program',
        source: nextPlannedWorkout.source,
        workoutTemplateId: nextPlannedWorkout.workoutTemplateId,
      },
      card: buildProgramCard(
        'Continue plan',
        'Continue plan',
        'This is the clearest next session from your saved plan fit.',
        nextPlannedWorkout,
      ),
    };
  }

  if (lastWorkout) {
    return {
      mode: 'open_last_workout',
      target: {
        type: 'open_program',
        source: lastWorkout.source,
        workoutTemplateId: lastWorkout.workoutTemplateId,
      },
      card: buildProgramCard(
        'Last workout',
        'Open last workout',
        'This is your most reusable recent workout when no active plan is ahead of it.',
        lastWorkout,
      ),
    };
  }

  if (recommendedWorkout) {
    return {
      mode: 'ready_programs',
      target: {
        type: 'open_program',
        source: recommendedWorkout.source,
        workoutTemplateId: recommendedWorkout.workoutTemplateId,
      },
      card: buildProgramCard(
        'Recommended',
        'Open recommended plan',
        'This is the current best match for your saved goal, schedule, and equipment.',
        recommendedWorkout,
      ),
    };
  }

  return {
    mode: 'ready_programs',
    target: { type: 'open_ready_library' },
    card: {
      mode: 'start',
      eyebrow: 'Ready plans',
      title: 'Ready programs',
      subtitle: 'Browse proven splits and open the exact one you want to run.',
      reason: 'Nothing is in progress, so the next best action is to browse the plan library.',
      meta: undefined,
      actionLabel: 'Open ready plans',
    },
  };
}
