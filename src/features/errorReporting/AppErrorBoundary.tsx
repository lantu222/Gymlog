import React from 'react';

import { AppCrashScreen, CrashAsideAction } from '../../components/AppCrashScreen';
import { hasWorkoutToPutAside, setWorkoutBundleAside } from '../../storage/workoutAside';
import { reportAppError } from './errorReporter';
import { isWorkoutFailure } from './workoutFailure';

/**
 * How long the app must stay up after a "Try again" for the next failure to
 * count as a new one rather than the same one again.
 */
export const CRASH_SETTLE_MS = 15_000;

/** The second action of the crash screen; one object, so the screen's effect does not re-run. */
const SET_ASIDE: CrashAsideAction = { isAvailable: hasWorkoutToPutAside, run: setWorkoutBundleAside };

/**
 * The root error boundary: the last place a render error can be caught before
 * it takes the whole app down to a white screen.
 *
 * It wraps everything in App.tsx, outside both providers, because a provider
 * is as able to throw as a screen is. On an error it reports `render` (where
 * the code failed, never what it held — lib/errorReport) and shows
 * AppCrashScreen. "Try again" remounts the whole tree under a new key, which
 * hydrates from storage as at launch. Nothing is cleared or rewritten here:
 * the reader's data is exactly as it was, which the screen says.
 *
 * The one deliberate exception (user 2026-10-03): a render error that comes
 * from persisted data remounts into the same error however often it is
 * retried. A retry that fails again, within CRASH_SETTLE_MS of the retry, makes
 * the screen offer a second action — put the stored workout bundle aside. That
 * is the reader's own tap, never automatic; it copies the bundle to its own
 * key first and removes the live one only after the copy resolved, so nothing
 * is deleted (storage/workoutAside). The count lives in this component's state
 * and is not persisted: a fresh launch starts at the first failure. A crash
 * that recurs only after the retry has held for CRASH_SETTLE_MS is counted as a
 * first failure and does not show the action: that is a bug which needs the
 * app to run for a while, not a bundle it cannot draw at startup, and "Try
 * again" is still there for it.
 *
 * And only when the failure is the workout's (workoutFailure): thrown on a
 * workout-tab screen or while the workout provider applied its stored state.
 * Putting the workout aside cannot cure a crash from anywhere else, and it took
 * the workout in progress out of sight for nothing (user decision 2026-10-03).
 * The copy it makes comes back from Settings (Restore set-aside workout).
 *
 * An error thrown in an event handler or a timer never reaches a boundary —
 * React only catches rendering and lifecycle errors. Those go to the global
 * handler (installErrorReporting).
 */
interface State {
  failed: boolean;
  /** Bumped by Try again: a new key remounts every child from scratch. */
  attempt: number;
  /**
   * Whether the current mount is a retry still inside its settle window. A
   * failure while this is true is a retry that crashed again.
   */
  recentlyRetried: boolean;
  /** The failure on screen was thrown by the workout (isWorkoutFailure). */
  fromWorkout: boolean;
}

export class AppErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  state: State = { failed: false, attempt: 0, recentlyRetried: false, fromWorkout: false };

  private settleTimer: ReturnType<typeof setTimeout> | null = null;

  static getDerivedStateFromError(error: unknown): Partial<State> {
    return { failed: true, fromWorkout: isWorkoutFailure(error) };
  }

  componentDidCatch(error: unknown): void {
    reportAppError('render', error);
  }

  componentWillUnmount(): void {
    this.clearSettleTimer();
  }

  private clearSettleTimer(): void {
    if (this.settleTimer) {
      clearTimeout(this.settleTimer);
      this.settleTimer = null;
    }
  }

  private retry = (): void => {
    this.setState((current) => ({ failed: false, attempt: current.attempt + 1, recentlyRetried: true }));
    // Still up after the window: the retry worked, and a later failure is a
    // new one. While the screen is failed the flag stays, so the next retry's
    // failure is recognised.
    this.clearSettleTimer();
    this.settleTimer = setTimeout(() => {
      this.settleTimer = null;
      if (!this.state.failed) {
        this.setState({ recentlyRetried: false });
      }
    }, CRASH_SETTLE_MS);
  };

  render(): React.ReactNode {
    if (this.state.failed) {
      return (
        <AppCrashScreen
          onRetry={this.retry}
          aside={this.state.recentlyRetried && this.state.fromWorkout ? SET_ASIDE : undefined}
        />
      );
    }
    return <React.Fragment key={this.state.attempt}>{this.props.children}</React.Fragment>;
  }
}
