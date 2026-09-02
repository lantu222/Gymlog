import { NotificationPrefs } from '../types/models';

export type RestAlertAskOutcome = 'granted' | 'denied' | 'later';

/**
 * What the first-rest ask writes back, given how it was answered.
 *
 * The rest ladder is gated on the phone's master notifications switch (user
 * 2026-08-22: "off" silences everything, rest alerts included). The master
 * switch defaults to off, so on a fresh install the in-context ask at the
 * first rest — "Rings when rest ends, screen off or app closed" — granted
 * the OS permission, mirrored that one rest, and then every later rest was
 * silent: the ask never touched the switch it was gated on. Measured on
 * the emulator 2026-09-02: three rests, one ladder.
 *
 * Allow turns the master switch on. And only the workout alerts with it:
 * the sheet promises "only during a workout, never a marketing push", so the
 * training categories that default to on (records, weekly summary, comeback)
 * go off when this is what switches the phone on. A master switch the reader
 * had already turned on keeps their choices.
 *
 * "Not now" and a denied dialog record the ask and change nothing else — the
 * screens then say at each rest what is off rather than pretending.
 */
export function restAlertsAnswered(prefs: NotificationPrefs, outcome: RestAlertAskOutcome): NotificationPrefs {
  const asked = { ...prefs, restAlertsAsked: true };
  if (outcome !== 'granted' || prefs.pushEnabled) {
    return asked;
  }
  return {
    ...asked,
    pushEnabled: true,
    restAlerts: true,
    personalRecords: false,
    weeklySummary: false,
    comebackNudge: false,
  };
}
