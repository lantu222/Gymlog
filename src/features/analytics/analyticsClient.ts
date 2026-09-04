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
 *
 * The reader's switch (Settings → Usage statistics, 2026-09-04) reaches this
 * module through setUsageStatisticsEnabled. Nothing is sent until the switch
 * has been read from the stored preferences, so a reader who turned it off
 * never has a batch slip out during startup; turning it off also forgets the
 * queue and the install id, so re-enabling starts as a new install.
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
/**
 * null until App.tsx has read the preference: events raised before that are
 * queued, and dropped if the answer turns out to be no. Only an explicit
 * `true` lets a batch leave.
 */
let enabled: boolean | null = null;

/**
 * Read through a function on purpose: the compiler narrows a module-level
 * `let` after an `if` and keeps the narrowing across an await, so a second
 * direct comparison after the await is reported as impossible — and the
 * whole point of the second check is that the switch may have moved.
 */
function switchedOff(): boolean {
  return enabled === false;
}

function randomUuid(): string {
  // Math.random is enough: this id needs to be unique-ish, not secret.
  const hex = (length: number) =>
    Array.from({ length }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  return `${hex(8)}-${hex(4)}-4${hex(3)}-${((Math.random() * 4) | 8).toString(16)}${hex(3)}-${hex(12)}`;
}

/**
 * The stored state, or null once the switch is off. The switch is re-read
 * after every await in this module: a call that started while the answer was
 * unknown must not be the thing that writes the key back after the off path
 * removed it.
 */
async function loadState(): Promise<StoredState | null> {
  if (switchedOff()) {
    return null;
  }
  if (memory) {
    return memory;
  }
  let loaded: StoredState | null = null;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<StoredState>;
      if (typeof parsed.installId === 'string' && Array.isArray(parsed.queue)) {
        loaded = { installId: parsed.installId, queue: parsed.queue.filter(isValidEvent) };
      }
    }
  } catch {
    // A corrupt queue is not worth crashing over; start over.
  }
  // The switch may have flipped during the read, and a second caller may
  // have finished its own read first — either way this one yields.
  if (switchedOff()) {
    return null;
  }
  if (memory) {
    return memory;
  }
  memory = loaded ?? { installId: randomUuid(), queue: [] };
  if (!loaded) {
    await persist();
  }
  return memory;
}

async function persist(): Promise<void> {
  if (!memory || switchedOff()) {
    return;
  }
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(memory));
  } catch {
    // Full disk loses analytics, not the app.
  }
}

async function flush(): Promise<void> {
  if (flushing || !ANALYTICS_URL || enabled !== true) {
    return;
  }
  const state = await loadState();
  if (!state || state.queue.length === 0) {
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
 * installs that will never send it. A reader who switched statistics off
 * queues nothing either.
 */
export function trackEvent(name: AnalyticsEventName, props?: { step?: number; path?: string }): void {
  if (!ANALYTICS_URL || enabled === false) {
    return;
  }
  void (async () => {
    try {
      const state = await loadState();
      // Null means the switch went off while the state was loading.
      if (!state) {
        return;
      }
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

/**
 * Apply the reader's switch. Off clears the queue and forgets the install id,
 * so nothing waits to be sent later and nothing ties a future yes to the
 * past; on lets whatever queued while the answer was unknown go out.
 */
export function setUsageStatisticsEnabled(next: boolean): void {
  enabled = next;
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (!next) {
    memory = null;
    void AsyncStorage.removeItem(STORAGE_KEY).catch(() => undefined);
    return;
  }
  if (!ANALYTICS_URL) {
    return;
  }
  void loadState()
    .then((state) => {
      if (state && state.queue.length > 0) {
        scheduleFlush();
      }
    })
    .catch(() => undefined);
}

/** Whether this build reports usage at all — the settings screen states it. */
export function isAnalyticsConfigured(): boolean {
  return ANALYTICS_URL.length > 0;
}
