/**
 * The notification surface of a live workout — what the app is while the
 * phone is dark (design: "Background Timer", built for Vinha).
 *
 * Three things, each owned here and nowhere else:
 *
 *  1. The rest ladder. A rest start schedules up to three OS notifications at
 *     absolute times: a silent haptic warning 10 s before the end, the end
 *     alert itself, and one repeat 30 s after. Logging the set, skipping,
 *     adjusting or finishing cancels the lot. Nothing about the alert depends
 *     on JavaScript being alive at that moment (rule 02).
 *  2. The ongoing card. One sticky, silent notification per session that says
 *     what is happening — rest ending at 18:42, or the session and its current
 *     lift — with the actions that matter. Android has no chronometer through
 *     expo-notifications, so the card states the wall-clock END rather than a
 *     countdown it could not keep honest while the app is suspended. It is
 *     re-posted whenever the session changes and removed when it ends.
 *  3. The idle nudge. Nothing logged for 25 minutes and one notification asks
 *     whether the session is still one. Rescheduled on every logged set.
 *
 * What this is not: a foreground service. expo-notifications cannot start one,
 * and none of the above needs JS running — rest end is OS-scheduled and elapsed
 * time is derived from timestamps. The one thing a service would add is a live
 * per-second countdown on the lock screen; the end time carries that job.
 *
 * Actions open the app. Handling "+30 s" or "skip" with the process dead needs
 * a background task (expo-task-manager), which is not in the build; opening the
 * app and then acting is the honest version of the same button.
 */
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

import { restAlertTimes } from '../lib/restSchedule';
import { ONGOING_NOTIFICATION_MARKER, installNotificationHandler } from './notificationHandler';

export const REST_CHANNEL_ID = 'rest-timer';
export const REST_WARNING_CHANNEL_ID = 'rest-warning';
export const SESSION_CHANNEL_ID = 'session-ongoing';
export const IDLE_CHANNEL_ID = 'session-idle';

/** Tags every notification here so shade sweeps leave unrelated ones alone. */
export const SESSION_NOTIFICATION_MARKER = 'gymlogRest';

export const CATEGORY_REST_RUNNING = 'vinha-rest-running';
export const CATEGORY_REST_END = 'vinha-rest-end';
export const CATEGORY_SESSION = 'vinha-session';
export const CATEGORY_IDLE = 'vinha-idle';

/** Action identifiers the response listener dispatches on. */
export const ACTION_EXTEND_30 = 'extend-30';
export const ACTION_EXTEND_60 = 'extend-60';
export const ACTION_SKIP_REST = 'skip-rest';
export const ACTION_OPEN = 'open';
export const ACTION_LOG_SET = 'log-set';
export const ACTION_FINISH = 'finish';
export const ACTION_STILL_GOING = 'still-going';

export type RestAlertPermission = 'granted' | 'denied' | 'undetermined';

let setupDone = false;
let permission: RestAlertPermission = 'undetermined';

export interface SessionNotificationActionLabels {
  extend30: string;
  extend60: string;
  skip: string;
  open: string;
  logSet: string;
  finish: string;
  stillGoing: string;
}

/**
 * Channels and action categories. Safe to call repeatedly; the work happens
 * once. Does NOT request permission — that is asked in context, at the first
 * rest, through `requestRestAlertPermission` (rule 05).
 */
export async function setupSessionNotifications(labels: SessionNotificationActionLabels): Promise<void> {
  if (Platform.OS === 'web') {
    return;
  }
  installNotificationHandler();
  if (setupDone) {
    return;
  }
  setupDone = true;
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(REST_CHANNEL_ID, {
        name: 'Rest timer',
        importance: Notifications.AndroidImportance.HIGH,
        // No `sound` key: naming one makes expo-notifications look for a
        // bundled asset file, so the channel keeps the system default tone.
        vibrationPattern: [0, 220, 120, 220],
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        bypassDnd: false,
      });
      // The 10 s warning: a tick you feel, not a tone you hear — you may
      // still be under the bar.
      await Notifications.setNotificationChannelAsync(REST_WARNING_CHANNEL_ID, {
        name: 'Rest warning',
        importance: Notifications.AndroidImportance.DEFAULT,
        sound: null,
        vibrationPattern: [0, 80],
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });
      // The ongoing card: silent, low, never buzzes — it is a surface, not an alert.
      await Notifications.setNotificationChannelAsync(SESSION_CHANNEL_ID, {
        name: 'Workout in progress',
        importance: Notifications.AndroidImportance.LOW,
        sound: null,
        enableVibrate: false,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });
      await Notifications.setNotificationChannelAsync(IDLE_CHANNEL_ID, {
        name: 'Idle workout',
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 120],
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });
    }
    const opens = { opensAppToForeground: true };
    await Notifications.setNotificationCategoryAsync(CATEGORY_REST_RUNNING, [
      { identifier: ACTION_EXTEND_30, buttonTitle: labels.extend30, options: opens },
      { identifier: ACTION_SKIP_REST, buttonTitle: labels.skip, options: opens },
      { identifier: ACTION_OPEN, buttonTitle: labels.open, options: opens },
    ]);
    await Notifications.setNotificationCategoryAsync(CATEGORY_REST_END, [
      { identifier: ACTION_LOG_SET, buttonTitle: labels.logSet, options: opens },
      { identifier: ACTION_EXTEND_60, buttonTitle: labels.extend60, options: opens },
    ]);
    await Notifications.setNotificationCategoryAsync(CATEGORY_SESSION, [
      { identifier: ACTION_OPEN, buttonTitle: labels.open, options: opens },
      { identifier: ACTION_FINISH, buttonTitle: labels.finish, options: opens },
    ]);
    await Notifications.setNotificationCategoryAsync(CATEGORY_IDLE, [
      { identifier: ACTION_STILL_GOING, buttonTitle: labels.stillGoing, options: opens },
      { identifier: ACTION_FINISH, buttonTitle: labels.finish, options: opens },
    ]);
  } catch {
    // Notifications are an enhancement — never let setup break a workout.
  }
}

/** Current permission without asking. */
export async function getRestAlertPermission(): Promise<RestAlertPermission> {
  if (Platform.OS === 'web') {
    return 'denied';
  }
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) {
      permission = 'granted';
    } else if (current.status === 'undetermined') {
      permission = 'undetermined';
    } else {
      // Android reports canAskAgain=false before the first ask too, so a
      // "denied" with canAskAgain still counts as not-yet-asked.
      permission = current.canAskAgain ? 'undetermined' : 'denied';
    }
  } catch {
    permission = 'denied';
  }
  return permission;
}

/** The system dialog. Only called after the in-app ask (rule 05). */
export async function requestRestAlertPermission(): Promise<RestAlertPermission> {
  if (Platform.OS === 'web') {
    return 'denied';
  }
  try {
    const requested = await Notifications.requestPermissionsAsync();
    permission = requested.granted ? 'granted' : 'denied';
  } catch {
    permission = 'denied';
  }
  return permission;
}

function marker() {
  return { [SESSION_NOTIFICATION_MARKER]: true };
}

function secondsUntil(atMs: number): number {
  return (atMs - Date.now()) / 1000;
}

async function scheduleAt(
  atMs: number,
  content: Notifications.NotificationContentInput,
  channelId: string,
): Promise<string | null> {
  const seconds = secondsUntil(atMs);
  if (!Number.isFinite(seconds) || seconds < 1) {
    return null;
  }
  try {
    return await Notifications.scheduleNotificationAsync({
      content: { ...content, data: { ...(content.data ?? {}), ...marker() } },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: Math.max(1, Math.round(seconds)),
        channelId,
      },
    });
  } catch {
    return null;
  }
}

export interface RestLadderIds {
  warning: string | null;
  end: string | null;
  repeat: string | null;
}

export interface RestLadderCopy {
  warningTitle: string;
  warningBody: string;
  endTitle: string;
  endBody: string;
  repeatTitle: string;
  repeatBody: string;
}

/**
 * Schedules the rest ladder for an absolute end time. Pass `warning: false`
 * to skip the 10 s tick (a setting). Returns the ids to cancel with.
 */
export async function scheduleRestLadder(input: {
  endsAtMs: number;
  warning: boolean;
  copy: RestLadderCopy;
}): Promise<RestLadderIds> {
  if ((await getRestAlertPermission()) !== 'granted') {
    return { warning: null, end: null, repeat: null };
  }
  const times = restAlertTimes(input.endsAtMs);
  const [warning, end, repeat] = await Promise.all([
    input.warning
      ? scheduleAt(
          times.warningAtMs,
          { title: input.copy.warningTitle, body: input.copy.warningBody, sound: false },
          REST_WARNING_CHANNEL_ID,
        )
      : Promise.resolve(null),
    scheduleAt(
      input.endsAtMs,
      {
        title: input.copy.endTitle,
        body: input.copy.endBody,
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
        categoryIdentifier: CATEGORY_REST_END,
      },
      REST_CHANNEL_ID,
    ),
    scheduleAt(
      times.repeatAtMs,
      {
        title: input.copy.repeatTitle,
        body: input.copy.repeatBody,
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
        categoryIdentifier: CATEGORY_REST_END,
      },
      REST_CHANNEL_ID,
    ),
  ]);
  return { warning, end, repeat };
}

async function cancelOne(id: string | null): Promise<void> {
  if (!id) {
    return;
  }
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {
    // Already delivered or cancelled.
  }
  try {
    await Notifications.dismissNotificationAsync(id);
  } catch {
    // Never made it to the shade.
  }
}

export async function cancelRestLadder(ids: RestLadderIds | null): Promise<void> {
  if (!ids) {
    return;
  }
  await Promise.all([cancelOne(ids.warning), cancelOne(ids.end), cancelOne(ids.repeat)]);
}

/** Our one ongoing card, by a fixed id so re-posting replaces rather than stacks. */
const ONGOING_ID = 'vinha-session-ongoing';

/**
 * Posts or replaces the ongoing session card. Sticky and silent. `kind`
 * picks the action set: a running rest offers +30 s / skip, a session offers
 * open / finish.
 */
export async function showOngoingSession(input: {
  kind: 'rest' | 'session';
  title: string;
  body: string;
}): Promise<void> {
  if (Platform.OS !== 'android') {
    // iOS has no ongoing notification; a Live Activity is the carrier there
    // and is not in this build. The scheduled alerts still cover the rest end.
    return;
  }
  if ((await getRestAlertPermission()) !== 'granted') {
    return;
  }
  try {
    await Notifications.scheduleNotificationAsync({
      identifier: ONGOING_ID,
      content: {
        title: input.title,
        body: input.body,
        sound: false,
        sticky: true,
        autoDismiss: false,
        priority: Notifications.AndroidNotificationPriority.LOW,
        categoryIdentifier: input.kind === 'rest' ? CATEGORY_REST_RUNNING : CATEGORY_SESSION,
        data: { ...marker(), [ONGOING_NOTIFICATION_MARKER]: true },
      },
      // Immediate, on the silent channel: a channel-only trigger presents now.
      trigger: { channelId: SESSION_CHANNEL_ID },
    });
  } catch {
    // Surface only; the session is unaffected.
  }
}

export async function clearOngoingSession(): Promise<void> {
  await cancelOne(ONGOING_ID);
}

const IDLE_ID = 'vinha-session-idle';

/** (Re)schedules the idle nudge for an absolute time; cancels the previous one. */
export async function scheduleIdleNudge(input: { atMs: number; title: string; body: string }): Promise<void> {
  await cancelOne(IDLE_ID);
  if ((await getRestAlertPermission()) !== 'granted') {
    return;
  }
  const seconds = secondsUntil(input.atMs);
  if (!Number.isFinite(seconds) || seconds < 1) {
    return;
  }
  try {
    await Notifications.scheduleNotificationAsync({
      identifier: IDLE_ID,
      content: {
        title: input.title,
        body: input.body,
        sound: true,
        categoryIdentifier: CATEGORY_IDLE,
        data: marker(),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: Math.max(1, Math.round(seconds)),
        channelId: IDLE_CHANNEL_ID,
      },
    });
  } catch {
    // Nudge is advisory.
  }
}

export async function cancelIdleNudge(): Promise<void> {
  await cancelOne(IDLE_ID);
}

/** Everything this module posted, gone — for session end and for a fresh open. */
export async function clearAllSessionNotifications(): Promise<void> {
  await Promise.all([clearOngoingSession(), cancelIdleNudge()]);
  try {
    const presented = await Notifications.getPresentedNotificationsAsync();
    await Promise.all(
      presented
        .filter((n) => n.request.content.data?.[SESSION_NOTIFICATION_MARKER] === true)
        .map((n) => Notifications.dismissNotificationAsync(n.request.identifier)),
    );
  } catch {
    // Nothing in the shade.
  }
}
