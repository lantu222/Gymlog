import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState } from 'react-native';

import { t } from '../../lib/i18n';
import {
  ServerNotice,
  serverNoticeText,
  shouldCheckServerNotice,
  unseenServerNotice,
} from '../../lib/serverNotice';
import { AppLanguage } from '../../types/models';
import { fetchServerNotice } from './serverNoticeClient';

/**
 * The notice the server has for every reader (api/notice), shown once.
 *
 * Asked at launch and again on returning to the app after hours away; shown at
 * a calm moment (`held` is the update prompt's own rule: not over the terms,
 * the tour, onboarding or a running workout). Closing it is what marks it
 * seen, so a notice the reader never got to read is shown again next time.
 */
export function ServerNoticeDialog({
  language,
  held,
  seenIds,
  onSeen,
}: {
  language: AppLanguage;
  held: boolean;
  seenIds: readonly string[];
  onSeen: (id: string) => void;
}) {
  const [notice, setNotice] = useState<ServerNotice | null>(null);
  const lastAnsweredRef = useRef<number | null>(null);
  const lastFailedRef = useRef<number | null>(null);
  const inFlightRef = useRef(false);
  const shownRef = useRef<string | null>(null);

  const check = useCallback(async () => {
    const now = Date.now();
    // One ask at a time: launch and the first foreground event arrive together.
    if (inFlightRef.current || !shouldCheckServerNotice(lastAnsweredRef.current, now, lastFailedRef.current)) {
      return;
    }
    inFlightRef.current = true;
    try {
      // null is a failed ask; "no notice" is an answer with notice: null. Only
      // an answer starts the six-hour window — a failure retries soon.
      const answer = await fetchServerNotice();
      if (answer) {
        lastAnsweredRef.current = now;
        lastFailedRef.current = null;
        setNotice(answer.notice);
      } else {
        lastFailedRef.current = now;
      }
    } finally {
      inFlightRef.current = false;
    }
  }, []);

  useEffect(() => {
    void check();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void check();
      }
    });
    return () => subscription.remove();
  }, [check]);

  useEffect(() => {
    const due = unseenServerNotice(notice, seenIds);
    if (!due || held || shownRef.current === due.id) {
      return;
    }
    shownRef.current = due.id;
    const text = serverNoticeText(due, language);
    Alert.alert(
      text.title,
      text.body,
      [{ text: t(language, 'serverNotice.ok'), onPress: () => onSeen(due.id) }],
      { cancelable: false },
    );
  }, [notice, seenIds, held, language, onSeen]);

  return null;
}
