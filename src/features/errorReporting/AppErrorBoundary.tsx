import React from 'react';

import { AppCrashScreen } from '../../components/AppCrashScreen';
import { reportAppError } from './errorReporter';

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
 * An error thrown in an event handler or a timer never reaches a boundary —
 * React only catches rendering and lifecycle errors. Those go to the global
 * handler (installErrorReporting).
 */
interface State {
  failed: boolean;
  /** Bumped by Try again: a new key remounts every child from scratch. */
  attempt: number;
}

export class AppErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  state: State = { failed: false, attempt: 0 };

  static getDerivedStateFromError(): Partial<State> {
    return { failed: true };
  }

  componentDidCatch(error: unknown): void {
    reportAppError('render', error);
  }

  private retry = (): void => {
    this.setState((current) => ({ failed: false, attempt: current.attempt + 1 }));
  };

  render(): React.ReactNode {
    if (this.state.failed) {
      return <AppCrashScreen onRetry={this.retry} />;
    }
    return <React.Fragment key={this.state.attempt}>{this.props.children}</React.Fragment>;
  }
}
