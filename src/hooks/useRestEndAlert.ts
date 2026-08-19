import { useCallback, useEffect, useRef } from 'react';

import { t } from '../lib/i18n';
import { formatEndsAt } from '../lib/restSchedule';
import type { AppLanguage } from '../types/models';
import {
  RestLadderIds,
  cancelRestLadder,
  clearAllSessionNotifications,
  clearOngoingSession,
  scheduleRestLadder,
  setupSessionNotifications,
  showOngoingSession,
} from '../utils/sessionNotifications';

/**
 * What the ongoing lock-screen card says when no rest is running. The screen
 * that owns the session passes it; `null` means no card between rests.
 */
export interface SessionCardSummary {
  /** "Push A · Bench Press, set 3 of 4" */
  title: string;
  /** "8 of 17 sets logged" */
  body: string;
}

export interface RestAlertOptions {
  /** The 10 s haptic warning before the end. A setting; default on. */
  warning?: boolean;
  /** Whether to keep the ongoing session card at all. A setting; default on. */
  ongoing?: boolean;
  /** What the card says between rests. Without it the card is cleared then. */
  session?: SessionCardSummary | null;
}

/**
 * Keeps a rest deadline mirrored in the OS — the alert ladder and the ongoing
 * lock-screen card — so "rest is over" still lands when Android has suspended
 * our JS: screen off, another app in front, or the process killed outright.
 *
 * Every rest surface drives the same contract: call `sync(endsAtMs, nextName)`
 * when a rest starts or its deadline moves, and `sync(null)` when it is
 * skipped, paused or finished. Between rests the card shows the session.
 *
 * Permission is NOT requested here. The design asks at the first rest, in
 * context, through the sheet the screen shows — see `requestRestAlertPermission`.
 * Channels and action categories are set up on mount so the first rest has
 * somewhere to go the moment permission lands.
 */
export function useRestEndAlert(language: AppLanguage, options: RestAlertOptions = {}) {
  const idsRef = useRef<RestLadderIds | null>(null);
  const tokenRef = useRef(0);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    void setupSessionNotifications({
      extend30: t(language, 'rest.notify.action.extend30'),
      extend60: t(language, 'rest.notify.action.extend60'),
      skip: t(language, 'rest.notify.action.skip'),
      open: t(language, 'rest.notify.action.open'),
      logSet: t(language, 'rest.notify.action.logSet'),
      finish: t(language, 'rest.notify.action.finish'),
      stillGoing: t(language, 'rest.notify.action.stillGoing'),
    });
    // An alert from a session that died mid-rest has nothing left to say.
    void clearAllSessionNotifications();
  }, [language]);

  const sync = useCallback(
    async (endsAtMs: number | null, nextName?: string | null) => {
      // The token guards against an older async schedule landing after a newer
      // one and leaking an orphan alert.
      const token = (tokenRef.current += 1);
      const previous = idsRef.current;
      idsRef.current = null;
      void cancelRestLadder(previous);

      const { warning = true, ongoing = true, session = null } = optionsRef.current;

      if (endsAtMs === null) {
        // Back to the session card, or nothing.
        if (ongoing && session) {
          void showOngoingSession({ kind: 'session', title: session.title, body: session.body });
        } else {
          void clearOngoingSession();
        }
        return;
      }

      const next = nextName?.trim() ? nextName.trim() : null;
      const endsAt = formatEndsAt(endsAtMs);
      if (ongoing) {
        // The card states the END TIME, not a countdown it could not keep
        // honest while the app is suspended — the bar in the app says the same.
        void showOngoingSession({
          kind: 'rest',
          title: t(language, 'rest.notify.ongoingTitle', { time: endsAt }),
          body: next ? t(language, 'rest.notify.next', { name: next }) : t(language, 'rest.notify.plain'),
        });
      }

      const ids = await scheduleRestLadder({
        endsAtMs,
        warning,
        copy: {
          warningTitle: t(language, 'rest.notify.warningTitle'),
          warningBody: next ? t(language, 'rest.notify.next', { name: next }) : t(language, 'rest.notify.plain'),
          endTitle: t(language, 'rest.notify.over'),
          endBody: next ? t(language, 'rest.notify.next', { name: next }) : t(language, 'rest.notify.plain'),
          repeatTitle: t(language, 'rest.notify.repeatTitle'),
          repeatBody: next ? t(language, 'rest.notify.next', { name: next }) : t(language, 'rest.notify.plain'),
        },
      });

      if (token !== tokenRef.current) {
        // Superseded while we awaited the schedule — don't keep this one.
        void cancelRestLadder(ids);
        return;
      }
      idsRef.current = ids;
    },
    [language],
  );

  // Leaving the screen entirely retires whatever is still pending, and the
  // card with it — the session may go on, but this screen no longer speaks for it.
  useEffect(
    () => () => {
      tokenRef.current += 1;
      void cancelRestLadder(idsRef.current);
      idsRef.current = null;
      void clearOngoingSession();
    },
    [],
  );

  return sync;
}

/* ------------------------------------------------------------------------- */
/* Lock-screen actions → the screen that owns the rest                         */
/* ------------------------------------------------------------------------- */

export type RestAction =
  | { kind: 'extend'; seconds: number }
  | { kind: 'skip' }
  | { kind: 'finish' }
  | { kind: 'logSet' };

type RestActionListener = (action: RestAction) => void;
const listeners = new Set<RestActionListener>();

/**
 * Tiny bus from the notification response (which lands in App) to whichever
 * screen holds the running rest. The rest lives in screen state on two of the
 * three loggers, so App cannot act on it directly.
 */
export function subscribeRestActions(listener: RestActionListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function emitRestAction(action: RestAction): void {
  listeners.forEach((listener) => listener(action));
}
