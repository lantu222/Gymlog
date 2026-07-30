/**
 * Puts the planned training notifications onto the OS clock.
 *
 * The plan from `src/lib/notificationPlan.ts` is the whole truth: whatever it
 * contains should be pending, and nothing else of ours should be. Sync diffs
 * the two so an unchanged plan does not re-arm a month of alarms every time the
 * app comes to the foreground.
 *
 * Permission is never assumed. If the user revoked notifications in system
 * settings, sync cancels everything instead of leaving stale alarms behind
 * pretending the feature still works.
 */
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

import { PLAN_NOTIFICATION_MARKER, installNotificationHandler } from './notificationHandler';
import type { PlannedNotification } from '../lib/notificationPlan';

export const TRAINING_NOTIFICATION_CHANNEL_ID = 'training';

let channelReady = false;

async function ensureChannel() {
  if (Platform.OS !== 'android' || channelReady) {
    return;
  }
  await Notifications.setNotificationChannelAsync(TRAINING_NOTIFICATION_CHANNEL_ID, {
    name: 'Training',
    // DEFAULT, not HIGH: a reminder is not a rest timer going off. It should
    // land in the shade, not interrupt whatever the phone is doing.
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 180],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
    bypassDnd: false,
  });
  channelReady = true;
}

/** Current OS permission, without ever showing a dialog. */
export async function getNotificationPermissionGranted(): Promise<boolean> {
  if (Platform.OS === 'web') {
    return false;
  }
  try {
    const current = await Notifications.getPermissionsAsync();
    return current.granted;
  } catch {
    return false;
  }
}

/**
 * Asks for permission, showing the system dialog when that is still possible.
 * Returns what we actually ended up with — the caller must not store "on" for a
 * user the OS is going to keep silent.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') {
    return false;
  }
  try {
    installNotificationHandler();
    await ensureChannel();

    const current = await Notifications.getPermissionsAsync();
    if (current.granted) {
      return true;
    }
    // Never gate this on `canAskAgain`. On Android it is backed by
    // shouldShowRequestPermissionRationale, which is false BOTH before the
    // first ask and after a permanent denial — so treating it as "already
    // refused" means the dialog never appears on a fresh install. Asking when
    // the permission really is blocked just returns denied, with no UI.
    const requested = await Notifications.requestPermissionsAsync();
    return requested.granted;
  } catch {
    return false;
  }
}

/** Identity of a scheduled item: same signature = nothing to re-schedule. */
function signatureOf(item: PlannedNotification) {
  return [item.key, item.fireAtMs, item.title, item.body].join('|');
}

async function cancelOurScheduled(
  requests: Notifications.NotificationRequest[],
  predicate: (request: Notifications.NotificationRequest) => boolean,
) {
  await Promise.all(
    requests.filter(predicate).map(async (request) => {
      try {
        await Notifications.cancelScheduledNotificationAsync(request.identifier);
      } catch {
        // Already fired or cancelled; nothing to undo.
      }
    }),
  );
}

/**
 * Makes the pending notifications match `plan` exactly. Returns how many are
 * pending afterwards, or 0 when nothing could be scheduled.
 */
export async function syncPlannedNotifications(plan: PlannedNotification[]): Promise<number> {
  if (Platform.OS === 'web') {
    return 0;
  }

  try {
    installNotificationHandler();

    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const ours = scheduled.filter(
      (request) => request.content.data?.[PLAN_NOTIFICATION_MARKER] === true,
    );

    // No permission (never granted, or revoked in system settings): drop
    // everything rather than keep alarms that can no longer be delivered.
    const granted = await getNotificationPermissionGranted();
    if (!granted || plan.length === 0) {
      await cancelOurScheduled(ours, () => true);
      return 0;
    }

    await ensureChannel();

    const wanted = new Map(plan.map((item) => [signatureOf(item), item] as const));
    const kept = new Set<string>();

    await cancelOurScheduled(ours, (request) => {
      const signature = String(request.content.data?.signature ?? '');
      if (wanted.has(signature) && !kept.has(signature)) {
        kept.add(signature);
        return false;
      }
      return true;
    });

    let pending = kept.size;
    for (const [signature, item] of wanted) {
      if (kept.has(signature)) {
        continue;
      }
      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: item.title,
            body: item.body,
            sound: true,
            data: {
              [PLAN_NOTIFICATION_MARKER]: true,
              signature,
              category: item.category,
            },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: item.fireAtMs,
            channelId: TRAINING_NOTIFICATION_CHANNEL_ID,
          },
        });
        pending += 1;
      } catch {
        // One bad item must not take the rest of the plan down with it.
      }
    }

    return pending;
  } catch {
    // Notifications are an enhancement — never let scheduling break the app.
    return 0;
  }
}
