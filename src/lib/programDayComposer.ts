import { WorkoutTemplateExercise } from '../features/workout/workoutTypes';
import { getWorkoutTemplateById } from '../features/workout/workoutCatalog';
import { buildRecommendationPlanReadyPayload } from './recommendationProgramme';
import type { FirstRunSetupSelection } from './firstRunSetup';

/**
 * Days-per-week truth (onboarding truth plan P1).
 *
 * The week the user is shown and the week that gets saved must be the SAME
 * composition: the catalog template trimmed or extended to the user's chosen
 * days per week. This module is the single source for that composed week —
 * `App.tsx` saves it and `OnboardingScreen` previews it, so the two can't
 * drift apart.
 */

export interface ComposedProgramSession {
  id: string;
  /** Raw schedule-day name; format with formatWorkoutDisplayLabel for UI. */
  name: string;
  orderIndex: number;
  source: 'template' | 'suggested';
  exercises: WorkoutTemplateExercise[];
}

export interface ComposedProgramWeek {
  programId: string;
  sessions: ComposedProgramSession[];
  /** Actual training days in the composed week — always what the UI shows. */
  days: number;
  weeks: number;
  totalWorkouts: number;
  sessionMinutes: number;
  /** True when the composed week differs from the template's own day count. */
  composed: boolean;
}

function getFallbackTrackingMode(name: string): WorkoutTemplateExercise['trackingMode'] {
  const normalized = name.toLowerCase();
  if (
    normalized.includes('bodyweight') ||
    normalized.includes('push-up') ||
    normalized.includes('plank') ||
    normalized.includes('mountain climber') ||
    normalized.includes('glute bridge') ||
    normalized.includes('lunge') ||
    normalized.includes('inverted row') ||
    normalized.includes('mobility') ||
    normalized.includes('run')
  ) {
    return 'bodyweight';
  }

  return 'load_and_reps';
}

export function buildComposedFallbackExercise(
  name: string,
  sessionId: string,
  exerciseIndex: number,
): WorkoutTemplateExercise {
  const role = exerciseIndex === 0 ? 'primary' : exerciseIndex < 3 ? 'secondary' : 'accessory';

  return {
    id: `${sessionId}_exercise_${exerciseIndex + 1}`,
    exerciseName: name,
    slotId: `${role}_${exerciseIndex + 1}`,
    role,
    progressionPriority: exerciseIndex === 0 ? 'high' : exerciseIndex < 3 ? 'medium' : 'low',
    trackingMode: getFallbackTrackingMode(name),
    sets: exerciseIndex === 0 ? 3 : 2,
    repsMin: name.toLowerCase().includes('plank') ? 20 : 10,
    repsMax: name.toLowerCase().includes('plank') ? 40 : 15,
    restSecondsMin: exerciseIndex === 0 ? 75 : 45,
    restSecondsMax: exerciseIndex === 0 ? 120 : 75,
    substitutionGroup: `onboarding_${role}_${exerciseIndex + 1}`,
  };
}

export function composeProgramWeekForSelection(
  selection: FirstRunSetupSelection,
  programId: string,
): ComposedProgramWeek | null {
  const template = getWorkoutTemplateById(programId);
  if (!template) {
    return null;
  }

  const payload = buildRecommendationPlanReadyPayload(selection, programId);
  const trainingDays = payload.weeklySchedule.filter(
    (day) => day.source === 'template' || day.keyLifts.length > 0,
  );

  const sessions = trainingDays.map((day, dayIndex): ComposedProgramSession => {
    const sourceSession =
      day.source === 'template' ? template.sessions.find((session) => session.id === day.id) ?? null : null;
    const sessionId = `onboarding_${programId}_${dayIndex + 1}`;
    const exercises = sourceSession
      ? sourceSession.exercises.map((exercise) => ({
          ...exercise,
          id: `${sessionId}_${exercise.id}`,
          slotId: `${exercise.slotId}_${dayIndex + 1}`,
        }))
      : day.keyLifts.map((lift, exerciseIndex) => buildComposedFallbackExercise(lift, sessionId, exerciseIndex));

    return {
      id: sessionId,
      name: day.name,
      orderIndex: dayIndex,
      source: sourceSession ? 'template' : 'suggested',
      exercises,
    };
  });

  const weeks = payload.blockLengthWeeks > 0 ? payload.blockLengthWeeks : 4;
  const days = sessions.length;

  return {
    programId,
    sessions,
    days,
    weeks,
    totalWorkouts: weeks * days,
    sessionMinutes: template.estimatedSessionDuration,
    composed: days !== template.daysPerWeek,
  };
}
