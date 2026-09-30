import { useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';

import { localDateKey } from '../lib/completedSessions';

/**
 * The day the reader is in, as values a memo can depend on: `todayKey`, the
 * local date, and `todayStartMs`, its local midnight. The docs below say why
 * there are two triggers and why the timer re-arms itself.
 *
 * Moved out of App.tsx verbatim in the phase-B split (2026-09-30). A hook
 * because the moved code is a state, an effect and a memo; it takes no
 * inputs. VinhaApp calls it at the slot the state stood in — after
 * usePendingAiLogDeletions, before useInstallStamps — so React's hook order is
 * unchanged, and its AppState listener still registers after
 * usePendingAiLogDeletions' and before the app_open one in App.tsx. "The key
 * above" in the todayStartMs doc is the todayKey state in this hook.
 */
export function useTodayKey(): { todayKey: string; todayStartMs: number } {
  /**
   * Today, as a value a memo can depend on.
   *
   * "Today" was read from `new Date()` inside memos whose dependencies hold
   * no time at all, so an app left open overnight kept yesterday: the session
   * the reader picked for the day, the dot on the week strip, the row Home
   * calls today. A phone that is never really closed is the normal case, not
   * the odd one (2026-09-16).
   *
   * Two triggers, because either alone leaves a hole. Coming back to the app
   * catches the phone that slept through midnight; a timer set for the next
   * local midnight catches the one left awake on the kitchen counter. The
   * timer is set to a calendar date rather than 24 hours on, so the clock
   * change does not push it an hour into the wrong day.
   */
  const [todayKey, setTodayKey] = useState(() => localDateKey(new Date()));
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const sync = () =>
      setTodayKey((current) => {
        const next = localDateKey(new Date());
        return next === current ? current : next;
      });
    /**
     * The timer re-arms itself rather than being re-armed by the state it
     * sets.
     *
     * Keying the effect on `todayKey` looked equivalent and was not: a fire
     * that finds the same date — a clock corrected backwards, a timezone
     * change, a wake a second early — leaves the state untouched, so the
     * effect never re-runs and no replacement timer is ever set. From then on
     * the day only moved when the app was reopened, which is the exact gap
     * the timer exists to close (PR #125 review).
     */
    const arm = () => {
      const now = new Date();
      const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5).getTime();
      timer = setTimeout(() => {
        sync();
        arm();
      }, Math.max(1000, nextMidnight - now.getTime()));
    };
    sync();
    arm();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        sync();
        // Back from a sleep that swallowed the timer: aim at the next
        // midnight from here rather than trusting one armed days ago.
        clearTimeout(timer);
        arm();
      }
    });
    return () => {
      subscription.remove();
      clearTimeout(timer);
    };
  }, []);

  /** Local midnight of the day the reader is in, from the key above. */
  const todayStartMs = useMemo(() => {
    const [year, month, day] = todayKey.split('-').map((part) => Number.parseInt(part, 10));
    return Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day)
      ? new Date(year, month - 1, day).getTime()
      : new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()).getTime();
  }, [todayKey]);

  return { todayKey, todayStartMs };
}
