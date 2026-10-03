import React from 'react';

import { markWorkoutFailure } from './workoutFailure';

/**
 * Marks a render failure inside the workout tab as the workout's, and passes it on.
 *
 * Not a place the app recovers: it draws nothing of its own. The failure is
 * thrown again from render, so the root boundary (AppErrorBoundary) catches it
 * as before and reports it once; that boundary offers to put the workout aside
 * only for a failure marked here or in the workout provider (workoutFailure).
 */
interface State {
  error: unknown;
  failed: boolean;
}

export class WorkoutAreaBoundary extends React.Component<React.PropsWithChildren, State> {
  state: State = { error: null, failed: false };

  static getDerivedStateFromError(error: unknown): State {
    markWorkoutFailure(error);
    return { error, failed: true };
  }

  render(): React.ReactNode {
    if (this.state.failed) {
      throw this.state.error;
    }
    return this.props.children;
  }
}
