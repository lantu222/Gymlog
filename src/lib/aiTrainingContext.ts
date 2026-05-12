import { HomeSummary } from './dashboard';
import { ExerciseProgressSummary } from './progression';
import { ExerciseLog, UnitPreference, WorkoutSession } from '../types/models';
import { AICoachTrainingContext } from '../types/aiCoach';
import { detectPlateaus } from './progressionAnalyzer';
import { buildFatigueModel } from './fatigueModel';

export interface BuildAiTrainingContextInput {
  unitPreference: UnitPreference;
  activeWorkoutSummary: {
    title: string;
    nextExercise: string | null;
    meta: string;
  } | null;
  homeSummary: Pick<HomeSummary, 'streak'>;
  workoutSessions: WorkoutSession[];
  exerciseLogs: ExerciseLog[];
  trackedProgress: ExerciseProgressSummary[];
  readyProgramCount: number;
  recommendedProgramId: string | null;
  recommendedProgramTitle: string | null;
  customProgramTitle: string | null;
  plannerSetup?: {
    goal: string | null;
    daysPerWeek: number | null;
    experience: string | null;
    sessionMinutes: number | null;
    equipment: string | null;
    recovery: string | null;
    mustInclude: string[];
    avoid: string[];
    limitations: string[];
  } | null;
  includeActiveSessionContext?: boolean;
}

export function buildAiTrainingContext({
  unitPreference,
  activeWorkoutSummary,
  homeSummary,
  workoutSessions,
  exerciseLogs,
  trackedProgress,
  readyProgramCount,
  recommendedProgramId,
  recommendedProgramTitle,
  customProgramTitle,
  plannerSetup,
  includeActiveSessionContext = false,
}: BuildAiTrainingContextInput): AICoachTrainingContext {
  const recentCompletedSessions = [...workoutSessions]
    .sort((left, right) => new Date(right.performedAt).getTime() - new Date(left.performedAt).getTime())
    .slice(0, 3)
    .map((session) => ({
      sessionId: session.id,
      title: session.workoutNameSnapshot.trim(),
      performedAt: session.performedAt,
      durationMinutes: session.durationMinutes ?? null,
      setsCompleted: session.setsCompleted ?? null,
      swappedExercises: session.exercisesSwapped ?? 0,
      noteCount: session.noteCount ?? 0,
    }));

  const trackedLifts = trackedProgress.slice(0, 3).map((summary) => ({
    key: summary.key,
    name: summary.name,
    latestWeight: summary.latestWeight,
    bestWeight: summary.bestWeight,
    latestReps: summary.latestReps,
  }));

  const latestTopSets = trackedProgress.slice(0, 3).map((summary) => ({
    exerciseName: summary.name,
    weight: summary.latestWeight,
    reps: summary.latestReps,
    performedAt: summary.latestLog?.performedAt ?? null,
  }));

  const plateaus = detectPlateaus(trackedProgress)
    .filter((p) => p.isPlateau)
    .map((p) => ({
      exerciseKey: p.exerciseKey,
      name: p.name,
      stagnantSessions: p.stagnantSessions,
      topWeightKg: p.topWeightHistory[0] ?? null,
    }));

  const fatigueResult = buildFatigueModel({ workoutSessions, exerciseLogs });
  const fatigue = {
    acwr: fatigueResult.acwr,
    recoveryScore: fatigueResult.recoveryScore,
    signal: fatigueResult.signal,
    sessionCount7d: fatigueResult.sessionCount7d,
  };

  return {
    unitPreference,
    activeSession: includeActiveSessionContext && activeWorkoutSummary
      ? {
          title: activeWorkoutSummary.title,
          nextExercise: activeWorkoutSummary.nextExercise,
          meta: activeWorkoutSummary.meta,
        }
      : null,
    recentCompletedSessions,
    trackedLifts,
    latestTopSets,
    sessionsThisWeek: homeSummary.streak.sessionsThisWeek,
    sessionsLast30Days: homeSummary.streak.sessionsLast30Days,
    rhythm: homeSummary.streak.activity.days.map((day) => ({
      dayStart: day.dayStart,
      dayNumber: day.dayNumber,
      weekdayLabel: day.weekdayLabel,
      active: day.active,
      isToday: day.isToday,
    })),
    readyProgramCount,
    recommendedProgramId,
    recommendedProgramTitle,
    customProgramTitle,
    plateaus,
    fatigue,
    ...(plannerSetup !== undefined ? { plannerSetup } : {}),
  };
}
