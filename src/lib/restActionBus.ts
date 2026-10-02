/**
 * The bus that carries a lock-screen rest action to the screen holding the rest.
 *
 * The notification response lands in App, but the rest lives in screen state
 * on two of the three loggers, so App cannot act on it directly: it emits, and
 * the screen that owns the rest listens.
 *
 * It used to be a bare `listeners.forEach`. After a cold start the response
 * arrives before any listener exists — the screens mount only after the
 * launch screens and the brand splash have played (~4.5 s) — so "+30 s" and
 * "Skip rest" from a killed app were emitted into an empty set and did
 * nothing, while "Finish" (which does not use the bus) worked (#bugs
 * 2026-10-02, after #258 claimed the fix). An action with nobody listening is
 * now held — one, the latest — and handed to the first listener that
 * subscribes, if it is still young and was meant for that session.
 *
 * Pure: the clock is injected, so the module is testable and keeps `src/lib/`
 * free of side effects.
 */
export type RestAction =
  | { kind: 'extend'; seconds: number }
  | { kind: 'skip' }
  | { kind: 'finish' }
  | { kind: 'logSet' };

export type RestActionListener = (action: RestAction) => void;

/**
 * How long a held action stays good. A cold start takes the launch screens
 * and the splash (~4.5 s) plus hydration; half a minute covers a slow device
 * without letting a stale tap fire on a rest the reader reached much later.
 */
export const PENDING_REST_ACTION_TTL_MS = 30000;

export interface RestActionBus {
  /** Listen for actions. `sessionId` is the session this screen belongs to, when it has one. */
  subscribe(listener: RestActionListener, sessionId?: string | null): () => void;
  /**
   * Deliver to everyone listening, or hold it (one, the latest) when nobody is.
   * `sessionId` is the session the action was tapped for; held actions only
   * go to a screen of the same session.
   */
  emit(action: RestAction, sessionId?: string | null): void;
  /** Drop a held action, if any. */
  clearPending(): void;
}

interface PendingRestAction {
  action: RestAction;
  sessionId: string | null;
  atMs: number;
}

export function createRestActionBus(now: () => number = Date.now): RestActionBus {
  const listeners = new Set<RestActionListener>();
  let pending: PendingRestAction | null = null;

  return {
    subscribe(listener, sessionId = null) {
      listeners.add(listener);
      const held = pending;
      if (held) {
        // Taken either way: delivered, or too old / for another session.
        pending = null;
        const fresh = now() - held.atMs <= PENDING_REST_ACTION_TTL_MS;
        const sameSession = held.sessionId === null || sessionId === null || held.sessionId === sessionId;
        if (fresh && sameSession) {
          listener(held.action);
        }
      }
      return () => {
        listeners.delete(listener);
      };
    },
    emit(action, sessionId = null) {
      if (listeners.size === 0) {
        pending = { action, sessionId, atMs: now() };
        return;
      }
      // Someone is listening: this is the warm path, immediate as ever.
      pending = null;
      listeners.forEach((listener) => listener(action));
    },
    clearPending() {
      pending = null;
    },
  };
}
