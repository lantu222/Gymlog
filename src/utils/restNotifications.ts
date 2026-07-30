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
 * shared handler in `notificationHandler.ts` suppresses the banner — the user
 * should never get alerted twice for the same rest.
 */
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

import { installNotificationHandler } from './notificationHandler';

export const REST_NOTIFICATION_CHANNEL_ID = 'rest-timer';
/** Tags our rest alerts so the shade sweep leaves other notifications alone. */
const REST_NOTIFICATION_MARKER = 'gymlogRest';

let channelReady = false;
let permissionGranted: boolean | null = null;

/**
 * Permission + channel setup. Safe to call repeatedly; the work happens once.
 * Returns false when we may not post notifications — the caller then simply
 * relies on the in-app timer.
 */
export async function ensureRestNotifications(): Promise<boolean> {
  if (Platform.OS === 'web') {
    return false;
  }

  installNotificationHandler();

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

    // Re-checked until it is actually granted: the cached `false` would
    // otherwise outlive a permission the user granted on the settings screen.
    if (permissionGranted !== true) {
      const current = await Notifications.getPermissionsAsync();
      permissionGranted = current.granted;
      if (!permissionGranted) {
        // Not gated on `canAskAgain` — on Android that flag is false before the
        // first ask too, which would mean the dialog never appears at all.
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
 * say. Only rest alerts are cleared — a training reminder or a record note in
 * the same shade is unrelated and stays where the user left it.
 */
export async function clearDeliveredRestNotifications(): Promise<void> {
  try {
    const presented = await Notifications.getPresentedNotificationsAsync();
    await Promise.all(
      presented
        .filter((notification) => notification.request.content.data?.[REST_NOTIFICATION_MARKER] === true)
        .map((notification) => Notifications.dismissNotificationAsync(notification.request.identifier)),
    );
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
        data: { [REST_NOTIFICATION_MARKER]: true },
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
