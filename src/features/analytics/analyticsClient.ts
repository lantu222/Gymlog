/**
 * The device side of the usage events: a queue in AsyncStorage and a
 * fire-and-forget flush. Configured by EXPO_PUBLIC_ANALYTICS_URL; without it
 * every call is a no-op, which is the fourth variable in the family that
 * turns its feature off silently (see the env notes) — and for analytics,
 * silently off is the correct failure mode.
 *
 * Offline-first like everything else: track() writes to the queue and never
 * blocks or throws into the caller; a flush drains the queue when the network
 * cooperates and puts the batch back when it does not. Losing events to a
 * dead zone is acceptable; losing a workout save to analytics would not be,
 * which is why nothing here is awaited on any user path.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  AnalyticsEvent,
  AnalyticsEventName,
  MAX_BATCH_EVENTS,
  appendToQueue,
  isValidEvent,
} from '../../lib/analytics';

const ANALYTICS_URL = (process.env.EXPO_PUBLIC_ANALYTICS_URL ?? '').trim();
const STORAGE_KEY = '@vinha/analytics/v1';
/** Small waits batch a burst of steps into one request. */
const FLUSH_DELAY_MS = 5000;

interface StoredState {
  installId: string;
  queue: AnalyticsEvent[];
}

let memory: StoredState | null = null;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let flushing = false;

function randomUuid(): string {
  // Math.random is enough: this id needs to be unique-ish, not secret.
  const hex = (length: number) =>
    Array.from({ length }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  return `${hex(8)}-${hex(4)}-4${hex(3)}-${((Math.random() * 4) | 8).toString(16)}${hex(3)}-${hex(12)}`;
}

async function loadState(): Promise<StoredState> {
  if (memory) {
    return memory;
  }
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<StoredState>;
      if (typeof parsed.installId === 'string' && Array.isArray(parsed.queue)) {
        memory = { installId: parsed.installId, queue: parsed.queue.filter(isValidEvent) };
        return memory;
      }
    }
  } catch {
    // A corrupt queue is not worth crashing over; start over.
  }
  memory = { installId: randomUuid(), queue: [] };
  await persist();
  return memory;
}

async function persist(): Promise<void> {
  if (!memory) {
    return;
  }
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(memory));
  } catch {
    // Full disk loses analytics, not the app.
  }
}

async function flush(): Promise<void> {
  if (flushing || !ANALYTICS_URL) {
    return;
  }
  const state = await loadState();
  if (state.queue.length === 0) {
    return;
  }
  flushing = true;
  const batch = state.queue.slice(0, MAX_BATCH_EVENTS);
  try {
    const response = await fetch(ANALYTICS_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ installId: state.installId, sentAt: new Date().toISOString(), events: batch }),
    });
    if (response.ok) {
      state.queue = state.queue.slice(batch.length);
      await persist();
      if (state.queue.length > 0) {
        scheduleFlush();
      }
    }
    // A refused batch stays queued; the next flush retries it.
  } catch {
    // Offline. The queue holds; the next foreground tries again.
  } finally {
    flushing = false;
  }
}

function scheduleFlush(): void {
  if (flushTimer) {
    return;
  }
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flush();
  }, FLUSH_DELAY_MS);
}

/**
 * Record one event. Never awaited by callers, never throws into them, and a
 * build without the URL queues nothing at all — no ghost queue growing on
 * installs that will never send it.
 */
export function trackEvent(name: AnalyticsEventName, props?: { step?: number; path?: string }): void {
  if (!ANALYTICS_URL) {
    return;
  }
  void (async () => {
    try {
      const state = await loadState();
      const event: AnalyticsEvent = { name, at: new Date().toISOString(), ...(props ? { props } : {}) };
      if (!isValidEvent(event)) {
        return;
      }
      state.queue = appendToQueue(state.queue, event);
      await persist();
      scheduleFlush();
    } catch {
      // Analytics must never cost the user anything.
    }
  })();
}

/** Whether this build reports usage at all — the settings screen states it. */
export function isAnalyticsConfigured(): boolean {
  return ANALYTICS_URL.length > 0;
}
