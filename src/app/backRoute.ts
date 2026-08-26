import { AppRoute, ROOT_ROUTES } from '../navigation/routes';

/**
 * Where the hardware back button lands from a nested screen.
 *
 * Null means "no opinion" — the caller pops its own history instead. Moved
 * out of App.tsx in the phase-A split (2026-08-26); the route table is data
 * about navigation, not wiring.
 */
export function getBackRoute(route: AppRoute, workoutHome: AppRoute): AppRoute | null {
  if (
    route.tab === 'home' &&
    (route.screen === 'ai' ||
      route.screen === 'ai_chat' ||
      route.screen === 'ai_setup' ||
      route.screen === 'history' ||
      route.screen === 'session' ||
      route.screen === 'analysis' ||
      route.screen === 'cardio')
  ) {
    return ROOT_ROUTES.home;
  }

  if (route.tab === 'workout' && route.screen === 'detail') {
    return ROOT_ROUTES.workout;
  }

  if (
    route.tab === 'workout' &&
    (route.screen === 'plans' ||
      route.screen === 'program' ||
      route.screen === 'programDay' ||
      route.screen === 'template' ||
      route.screen === 'editor' ||
      route.screen === 'guided' ||
      route.screen === 'summary' ||
      route.screen === 'celebration')
  ) {
    return workoutHome;
  }

  if (
    route.tab === 'progress' &&
    (route.screen === 'detail' || route.screen === 'bodyweight')
  ) {
    return ROOT_ROUTES.progress;
  }

  if (route.tab === 'profile' && route.screen === 'setup') {
    return ROOT_ROUTES.profile;
  }

  if (route.tab === 'profile' && route.screen === 'premium') {
    return ROOT_ROUTES.profile;
  }

  // Back out of the unlock moment lands on Profile, not on the paywall you
  // just came through — going 'back' to a page selling what you now own.
  if (route.tab === 'profile' && route.screen === 'premium_unlock') {
    return ROOT_ROUTES.profile;
  }

  return null;
}
