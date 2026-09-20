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
    (route.screen === 'ai_chat' ||
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
      route.screen === 'guided' ||
      route.screen === 'summary')
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
  // Only true together with backSkipsHistory below.
  if (route.tab === 'profile' && route.screen === 'premium_unlock') {
    return ROOT_ROUTES.profile;
  }

  return null;
}

/**
 * Whether the back route above is the destination rather than a fallback.
 *
 * The shell hands getBackRoute's answer to navigateBack, which pops the history
 * first and only lands on that route when the history is empty. From the
 * unlock moment the history is never empty — its top is the paywall the reader
 * just came through — so the Profile route above was never reached and back
 * opened a page selling what they now own (audit 2026-09-16). For these routes
 * the history is left behind instead.
 */
export function backSkipsHistory(route: AppRoute): boolean {
  return route.tab === 'profile' && route.screen === 'premium_unlock';
}
