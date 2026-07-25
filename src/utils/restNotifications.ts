/**
 * Rest-timer alerts that survive the app being backgrounded, the screen going
 * off, or the process being killed.
 *
 * Android stops running our JS in those states, so an in-app timer can never
 * fire the "rest is over" cue at the right moment. The fix every training app
 * uses: hand the deadline to the OS as a scheduled local notification. The
 * system wakes it on time and plays the channel's sound and vibration on our
 * behalf.
 *
 * While the app is in the foreground the in-app cue already covers it, so the
 * handler suppresses the banner — the user should never get alerted twice for
 * the same rest.
 */
import { AppState, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

export const REST_NOTIFICATION_CHANNEL_ID = 'rest-timer';

let handlerInstalled = false;
let channelReady = false;
let permissionGranted: boolean | null = null;

function installHandler() {
  if (handlerInstalled) {
    return;
  }
  handlerInstalled = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => {
      // Foreground: the player already buzzed and moved on — a banner on top of
      // that is noise. Background/killed: the system presents it for us and we
      // never reach this handler.
      const foreground = AppState.currentState === 'active';
      return {
        shouldShowBanner: !foreground,
        shouldShowList: !foreground,
        shouldPlaySound: !foreground,
        shouldSetBadge: false,
      };
    },
  });
}

/**
 * Permission + channel setup. Safe to call repeatedly; the work happens once.
 * Returns false when we may not post notifications — the caller then simply
 * relies on the in-app timer.
 */
export async function ensureRestNotifications(): Promise<boolean> {
  if (Platform.OS === 'web') {
    return false;
  }

  installHandler();

  try {
    if (Platform.OS === 'android' && !channelReady) {
      await Notifications.setNotificationChannelAsync(REST_NOTIFICATION_CHANNEL_ID, {
        name: 'Rest timer',
        importance: Notifications.AndroidImportance.HIGH,
        // A rest ending is worth a buzz even when the phone is on a bench.
        // No `sound` key: naming one makes expo-notifications look for a
        // bundled asset file, so the channel keeps the system default tone.
        vibrationPattern: [0, 220, 120, 220],
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        bypassDnd: false,
      });
      channelReady = true;
    }

    if (permissionGranted === null) {
      const current = await Notifications.getPermissionsAsync();
      permissionGranted = current.granted;
      if (!permissionGranted && current.canAskAgain) {
        const requested = await Notifications.requestPermissionsAsync();
        permissionGranted = requested.granted;
      }
    }

    return permissionGranted === true;
  } catch {
    // Notifications are an enhancement — never let setup break a workout.
    return false;
  }
}

/**
 * Clears any rest alert still sitting in the shade. Called when the player
 * opens: an alert from a session that was killed mid-rest has nothing left to
 * say. Safe to blanket-dismiss — a rest ending is the only thing we ever post.
 */
export async function clearDeliveredRestNotifications(): Promise<void> {
  try {
    await Notifications.dismissAllNotificationsAsync();
  } catch {
    // Nothing delivered, or the platform has no shade to clear.
  }
}

/**
 * Schedules the "rest is over" alert for an absolute timestamp. Returns the
 * identifier to cancel with, or null when nothing was scheduled (no
 * permission, or the deadline is already behind us).
 */
export async function scheduleRestEndNotification({
  endsAtMs,
  title,
  body,
}: {
  endsAtMs: number;
  title: string;
  body: string;
}): Promise<string | null> {
  const secondsAway = (endsAtMs - Date.now()) / 1000;
  // Under a second there is nothing to schedule — the in-app timer wins.
  if (!Number.isFinite(secondsAway) || secondsAway < 1) {
    return null;
  }

  const allowed = await ensureRestNotifications();
  if (!allowed) {
    return null;
  }

  try {
    return await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        // `true` = the platform default tone; a string would name an asset.
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: Math.max(1, Math.round(secondsAway)),
        channelId: REST_NOTIFICATION_CHANNEL_ID,
      },
    });
  } catch {
    return null;
  }
}

/**
 * Drops an alert — the rest was skipped, adjusted, paused or finished. Cancels
 * it if it is still pending and clears it from the shade if it already fired,
 * so returning to the app never leaves a stale "rest over" sitting there.
 */
export async function cancelRestEndNotification(identifier: string | null): Promise<void> {
  if (!identifier) {
    return;
  }
  try {
    await Notifications.cancelScheduledNotificationAsync(identifier);
  } catch {
    // Already delivered or cancelled; nothing to undo.
  }
  try {
    await Notifications.dismissNotificationAsync(identifier);
  } catch {
    // Never made it to the shade.
  }
}
