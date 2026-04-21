import { AppRoute, ROOT_ROUTES, WORKOUT_PLAN_ROUTE } from '../navigation/routes';

interface WorkoutLoggerFallbackInput {
  activeWorkoutTemplateId: string | null;
  recommendedProgramId: string | null;
  setupCompleted: boolean;
}

export function resolveWorkoutLoggerFallbackRoute({
  activeWorkoutTemplateId,
  recommendedProgramId,
  setupCompleted,
}: WorkoutLoggerFallbackInput): AppRoute {
  if (
    setupCompleted &&
    activeWorkoutTemplateId &&
    recommendedProgramId &&
    activeWorkoutTemplateId === recommendedProgramId
  ) {
    return {
      tab: 'home',
      screen: 'starting_week',
      recommendedProgramId,
      source: 'active',
    };
  }

  if (activeWorkoutTemplateId) {
    return ROOT_ROUTES.home;
  }

  return WORKOUT_PLAN_ROUTE;
}
