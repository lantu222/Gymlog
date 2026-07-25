import { useCallback, useEffect, useRef } from 'react';

import { t } from '../lib/i18n';
import type { AppLanguage } from '../types/models';
import {
  cancelRestEndNotification,
  clearDeliveredRestNotifications,
  ensureRestNotifications,
  scheduleRestEndNotification,
} from '../utils/restNotifications';

/**
 * Keeps a rest deadline mirrored as a scheduled OS notification, so the "rest
 * is over" cue still lands when Android has suspended our JS — screen off,
 * another app in front, or the process killed outright.
 *
 * Every rest surface (guided player, freestyle logger, list logger) drives the
 * same contract: call `sync(endsAtMs, nextName)` when a rest starts or its
 * deadline moves, and `sync(null)` when it is skipped, paused or finished.
 *
 * Permission is requested when the screen mounts rather than at the first rest
 * — a system dialog mid-set is the worst possible moment.
 */
export function useRestEndAlert(language: AppLanguage) {
  const idRef = useRef<string | null>(null);
  const tokenRef = useRef(0);

  useEffect(() => {
    void ensureRestNotifications();
    // An alert from a session that died mid-rest has nothing left to say.
    void clearDeliveredRestNotifications();
  }, []);

  const sync = useCallback(
    async (endsAtMs: number | null, nextName?: string | null) => {
      // The token guards against an older async schedule landing after a newer
      // one and leaking an orphan alert.
      const token = (tokenRef.current += 1);
      const previousId = idRef.current;
      idRef.current = null;
      void cancelRestEndNotification(previousId);

      if (endsAtMs === null) {
        return;
      }

      const id = await scheduleRestEndNotification({
        endsAtMs,
        title: t(language, 'rest.notify.over'),
        body: nextName ? t(language, 'rest.notify.next', { name: nextName }) : t(language, 'rest.notify.plain'),
      });

      if (token !== tokenRef.current) {
        // Superseded while we awaited the schedule — don't keep this one.
        void cancelRestEndNotification(id);
        return;
      }
      idRef.current = id;
    },
    [language],
  );

  // Leaving the screen entirely retires whatever is still pending.
  useEffect(
    () => () => {
      tokenRef.current += 1;
      void cancelRestEndNotification(idRef.current);
      idRef.current = null;
    },
    [],
  );

  return sync;
}
