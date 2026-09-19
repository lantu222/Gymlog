/**
 * Whether Android lets the rest alert ring on time, and the way to let it.
 *
 * expo-notifications arms every notification through AlarmManager, and from
 * Android 12 an exact alarm needs the "Alarms & reminders" grant: without it
 * the end-of-rest alert goes out as an inexact alarm, which Android may hold
 * for minutes. The app declares SCHEDULE_EXACT_ALARM; Android 14 still denies
 * it to a fresh install until the reader allows it. The native half lives in
 * modules/exact-alarm.
 *
 * Optional on purpose, like the widget's module: a JS bundle running on an
 * older native build — or anywhere but Android — must degrade rather than
 * throw.
 */
import { Linking, Platform } from 'react-native';
import { NativeModule, requireOptionalNativeModule } from 'expo';

declare class ExactAlarmNativeModule extends NativeModule {
  canScheduleExactAlarms(): Promise<boolean>;
  openSettings(): Promise<boolean>;
}

const native = requireOptionalNativeModule<ExactAlarmNativeModule>('ExactAlarm');

/** Android 12 is where exact alarms started needing a grant. */
const EXACT_ALARM_API_LEVEL = 31;

function needsGrant(): boolean {
  return Platform.OS === 'android' && Number(Platform.Version) >= EXACT_ALARM_API_LEVEL;
}

/**
 * True when rest alerts can ring on the second, false when Android will hold
 * them, and null when this build cannot tell — a screen shows nothing then,
 * rather than a warning it cannot back.
 */
export async function canScheduleExactAlarms(): Promise<boolean | null> {
  if (!needsGrant()) {
    return true;
  }
  if (!native) {
    return null;
  }
  try {
    return await native.canScheduleExactAlarms();
  } catch {
    return null;
  }
}

/**
 * Opens "Alarms & reminders" for this app. Without the native module the
 * generic page is the next best thing: it lists the apps, Vinha among them.
 */
export async function openExactAlarmSettings(): Promise<void> {
  if (!needsGrant()) {
    return;
  }
  try {
    if (native && (await native.openSettings())) {
      return;
    }
  } catch {
    // Fall through to the generic page.
  }
  try {
    await Linking.sendIntent('android.settings.REQUEST_SCHEDULE_EXACT_ALARM');
  } catch {
    await Linking.openSettings().catch(() => undefined);
  }
}
