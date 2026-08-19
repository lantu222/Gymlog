/**
 * The app's single foreground notification handler.
 *
 * `setNotificationHandler` is global — the last caller wins — so both the rest
 * timer and the scheduled training notifications have to be decided here, in
 * one place. They want opposite things:
 *
 * - A rest alert in the foreground is a duplicate: the player already buzzed
 *   and moved on, so the banner is suppressed.
 * - A training notification is never a duplicate of what is on screen, so it
 *   shows whether or not the app happens to be open.
 */
import { AppState } from 'react-native';
import * as Notifications from 'expo-notifications';

/** Marks a notification as one the training planner scheduled. */
export const PLAN_NOTIFICATION_MARKER = 'gymlogPlan';
/** Marks the sticky session card, which the shade keeps even in the foreground. */
export const ONGOING_NOTIFICATION_MARKER = 'vinhaOngoing';

let handlerInstalled = false;

export function installNotificationHandler() {
  if (handlerInstalled) {
    return;
  }
  handlerInstalled = true;

  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const data = notification.request.content.data ?? {};
      const fromPlan = data[PLAN_NOTIFICATION_MARKER] === true;
      // The ongoing session card is a surface, not an alert: it belongs in the
      // shade whether or not the app is open, and it never makes a sound.
      const ongoing = data[ONGOING_NOTIFICATION_MARKER] === true;
      // Background / killed: the system presents it and we never get here.
      const foreground = AppState.currentState === 'active';
      const show = fromPlan || !foreground;

      if (ongoing) {
        return {
          shouldShowBanner: false,
          shouldShowList: true,
          shouldPlaySound: false,
          shouldSetBadge: false,
        };
      }

      return {
        shouldShowBanner: show,
        shouldShowList: show,
        shouldPlaySound: show,
        shouldSetBadge: false,
      };
    },
  });
}
