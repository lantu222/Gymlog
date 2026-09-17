import { NotificationPrefs } from '../types/models';

export type RestAlertAskOutcome = 'granted' | 'denied' | 'later';

/**
 * What the first-rest ask writes back, given how it was answered.
 *
 * The rest alerts have their own switches and no longer wait on the phone's
 * Notifications switch (user decision 2026-09-17). That switch defaults to
 * off, and gating the rest ladder on it left the end-of-rest alert silent on
 * most phones: the only thing that turned it on was this sheet, and the sheet
 * opens only while the OS permission is undetermined — never on Android 12
 * and older, where the permission is granted at install, and never after the
 * trial had already asked. The Notifications switch now governs the
 * scheduled reminders alone, so this answer has nothing to do with it.
 *
 * Allow keeps the end-of-rest alert on: the sheet promised "rings when rest
 * ends", and a reader who said yes to that has said yes to the alert.
 * "Not now" and a denied dialog record the ask and change nothing else — the
 * screens then say at each rest what is off rather than pretending.
 */
export function restAlertsAnswered(prefs: NotificationPrefs, outcome: RestAlertAskOutcome): NotificationPrefs {
  const asked = { ...prefs, restAlertsAsked: true };
  return outcome === 'granted' ? { ...asked, restAlerts: true } : asked;
}
