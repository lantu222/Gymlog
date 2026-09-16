import { AppRoute } from './routes';

export interface RouteHistoryResult {
  history: AppRoute[];
  route: AppRoute | null;
}

export function isSameRoute(left: AppRoute, right: AppRoute) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function pushRoute(history: AppRoute[], current: AppRoute, next: AppRoute) {
  if (isSameRoute(current, next)) {
    return history;
  }

  return [...history, current];
}

export function popRoute(history: AppRoute[]): RouteHistoryResult {
  if (history.length === 0) {
    return {
      history,
      route: null,
    };
  }

  return {
    history: history.slice(0, -1),
    route: history[history.length - 1],
  };
}

/**
 * The history with every page about `workoutTemplateId` removed.
 *
 * Deleting a programme left its pages in the back stack: `navigate` pushes,
 * so the page the reader was standing on when they deleted it stayed behind
 * them. Back then returned to a programme that no longer exists, where the
 * route guard bounced them to the programme list — so Back read as broken
 * (2026-09-16). A programme's pages are deleted with the programme.
 */
export function forgetRoutesForTemplate(history: AppRoute[], workoutTemplateId: string): AppRoute[] {
  return history.filter(
    (entry) => !('workoutTemplateId' in entry) || entry.workoutTemplateId !== workoutTemplateId,
  );
}
