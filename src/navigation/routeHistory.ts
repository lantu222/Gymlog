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
