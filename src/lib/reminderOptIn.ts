import { NotificationPrefs } from '../types/models';

/**
 * The preferences a reader has, once they have asked for one scheduled
 * reminder by name and the phone has allowed notifications.
 *
 * Every scheduled reminder waits on the Notifications switch, which ships off.
 * Two doors asked for a reminder without touching it: the coach's "Morning
 * weigh-in is on" wrote `weighInReminder` and the plan dropped it on the
 * floor, and starting the Pro trial asked for the permission its two-day
 * warning needs and then left the switch that warning waits on where it was.
 * Both promised something the planner was never going to schedule.
 *
 * So asking turns the switch on — and only for what was asked. Records, the
 * weekly summary and the comeback nudge ship on INSIDE the switch, and a
 * reader who asked for a weigh-in did not ask for them; nor for a training-day
 * or tape-measure reminder left stored from before the switch went off, which
 * would start firing again the moment it came back (review 2026-09-17). Every
 * scheduled category goes off when this is what turns the switch on, and the
 * one asked for goes on. A switch the reader had already turned on keeps every
 * choice they made there.
 *
 * The caller asks the OS first: a switch stored "on" for a phone that will
 * stay silent is the lie the Notifications screen already refuses to tell.
 */
export function remindersOptedIn(
  prefs: NotificationPrefs,
  patch: Partial<NotificationPrefs> = {},
): NotificationPrefs {
  if (prefs.pushEnabled) {
    return { ...prefs, ...patch };
  }
  return {
    ...prefs,
    pushEnabled: true,
    personalRecords: false,
    weeklySummary: false,
    comebackNudge: false,
    sessionReminders: false,
    weighInReminder: false,
    measurementReminderKind: null,
    ...patch,
  };
}
