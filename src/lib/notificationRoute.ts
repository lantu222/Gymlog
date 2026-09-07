/**
 * Where a scheduled notification's tap should land.
 *
 * The app has read notification taps since the rest timer went in, but that
 * listener answers only the lock-screen session actions — it checks for the
 * session marker and returns for everything else. So the PLANNED notifications
 * (records, reminders, the weekly summary) were delivered, tapped, and then
 * dropped: the app simply resumed whatever screen it had been left on. The
 * reader tapped "Uusi ennätys" and arrived at the activity calendar, which
 * looked like a wrong destination and was actually no destination — they had
 * been on the calendar the last time they closed the app (#bugs 2026-09-05).
 *
 * The category already travels in the notification's data; the scheduler puts
 * it there to recognise its own pending items. So this is a mapping and not a
 * new payload.
 */

import { AppRoute, ROOT_ROUTES } from '../navigation/routes';
import type { NotificationCategory } from './notificationPlan';

/**
 * `PLAN_NOTIFICATION_MARKER`, copied rather than imported: it lives in
 * `utils/notificationHandler`, which pulls in expo-notifications and
 * react-native and so cannot be reached from a pure module or a Node test. A
 * guard in tests/lib/notificationRoute.test.cjs pins the two together.
 *
 * Tested POSITIVELY — "is this one of the planner's?" — rather than by the
 * absence of a session marker. The rest-timer notifications carry no category
 * today, but one that gained a field with that name would otherwise start
 * steering the route.
 */
const PLAN_MARKER = 'gymlogPlan';

/** The measures section, optionally opened on one measurement. */
function measuresRoute(measure?: string): AppRoute {
  return measure
    ? { tab: 'progress', screen: 'list', section: 'measures', measure }
    : { tab: 'progress', screen: 'list', section: 'measures' };
}

/**
 * Null means "leave the app where it is" — the behaviour every notification
 * had until today. Wrong as the rule, right as the fallback: a session action,
 * or a notification still pending from a build that knew a category this one
 * does not.
 */
export function routeForNotification(data: unknown): AppRoute | null {
  if (!data || typeof data !== 'object') {
    return null;
  }
  if ((data as Record<string, unknown>)[PLAN_MARKER] !== true) {
    return null;
  }

  const category = (data as { category?: unknown }).category as NotificationCategory | undefined;
  const measureKind = (data as { measureKind?: unknown }).measureKind;

  switch (category) {
    // "Eilen teit liikkeessä X 30 kg x 12" — the records page is where that
    // number lives, and it is the page the reader was looking for.
    case 'record':
      return { tab: 'progress', screen: 'list', section: 'records' };
    // Both of these ask for a number, so they open where it is entered. The
    // weekly one NAMES a measurement, and arriving with that kind already
    // selected saves finding it again — the same reason the route grew
    // `measure` for the Home stat cards.
    case 'weighIn':
      return measuresRoute('bodyweight');
    case 'measure':
      return measuresRoute(typeof measureKind === 'string' ? measureKind : undefined);
    // The week in review: the overview is the page it is about.
    case 'weekly':
      return { tab: 'progress', screen: 'list', section: 'overview' };
    // Both of these are "come and train". Home is where a workout starts, and
    // the one screen that knows which one is due today.
    case 'comeback':
    case 'reminder':
      return ROOT_ROUTES.home;
    default:
      return null;
  }
}
