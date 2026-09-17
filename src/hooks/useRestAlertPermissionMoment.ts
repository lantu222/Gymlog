import { useEffect, useState } from 'react';

import { RestAlertAskOutcome } from '../lib/restAlertAnswer';
import { canScheduleExactAlarms, openExactAlarmSettings } from '../utils/exactAlarm';
import {
  RestAlertPermission,
  getRestAlertPermission,
  requestRestAlertPermission,
} from '../utils/sessionNotifications';

/**
 * The permission moment (design: Background Timer, rule 05): at the first
 * rest, in context, once.
 *
 * One hook for both workout screens. It lived inline in the empty workout
 * only, so the guided player — the default way to train — never asked at
 * all: on a fresh install its rests went to the OS behind a permission
 * nobody had been offered, and nothing said so.
 *
 * `restKey` names the current rest (its start time, or the step it is); the
 * moment fires once per rest START, so ±15 s on a running rest does not
 * re-open the sheet over it.
 */
export function useRestAlertPermissionMoment(input: {
  /** A rest is running right now. */
  restRunning: boolean;
  /** Identity of the current rest; null between rests. */
  restKey: number | string | null;
  /** The in-app ask has been answered before, whichever way. */
  asked: boolean;
  /** The settings say rest alerts should fire — so silence is worth a banner. */
  alertsWanted: boolean;
  /** The answer, for the app to record. */
  onAnswered?: (outcome: RestAlertAskOutcome) => void;
  /** Permission just landed while a rest runs: hand that rest to the OS now. */
  onGranted?: () => void;
}) {
  const { restRunning, restKey, asked, alertsWanted, onAnswered, onGranted } = input;
  // null until the OS has answered: the guided player can mount straight
  // onto a running rest (Continue after leaving mid-rest), and asking before
  // the answer is in showed the sheet for a permission that was never
  // undetermined (PR review).
  const [permission, setPermission] = useState<RestAlertPermission | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [deniedBannerShown, setDeniedBannerShown] = useState(false);

  useEffect(() => {
    void getRestAlertPermission().then(setPermission);
  }, []);

  const resolved = permission !== null;
  useEffect(() => {
    if (!resolved || !restRunning || restKey === null) {
      return;
    }
    if (permission === 'undetermined' && !asked) {
      setSheetOpen(true);
    } else if (permission !== 'granted' && alertsWanted) {
      // Anything that is not a granted permission after the ask — "Not now",
      // or alerts switched off in system settings later — is a rest that will
      // not reach the reader. Say so at the start of the rest rather than run
      // a timer that silently cannot fire.
      setDeniedBannerShown(true);
    }
    // Once per rest START, on purpose — and once more for the rest that was
    // already running when the OS answer arrived.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restKey, resolved]);

  const allow = async () => {
    setSheetOpen(false);
    const next = await requestRestAlertPermission();
    setPermission(next);
    onAnswered?.(next === 'granted' ? 'granted' : 'denied');
    if (next === 'granted') {
      onGranted?.();
      // The sheet promised a ring when rest ends, and from Android 14 an
      // allowed notification is still an inexact alarm until the reader also
      // allows exact ones — minutes late, on a rest of ninety seconds. The
      // reader has just said yes to exactly that, so the one page that
      // finishes the job opens now rather than being left for them to find.
      if ((await canScheduleExactAlarms()) === false) {
        void openExactAlarmSettings();
      }
    }
  };

  const later = () => {
    setSheetOpen(false);
    onAnswered?.('later');
  };

  return {
    permission: permission ?? 'undetermined',
    sheetOpen,
    allow,
    later,
    deniedBannerShown: deniedBannerShown && permission !== 'granted',
    dismissDeniedBanner: () => setDeniedBannerShown(false),
  };
}
