/**
 * Anonymous usage events — the answer to "is some step so hard that people
 * quit there" (user, 2026-08-25).
 *
 * The design constraint is the app's own privacy stance: Vinha's pitch is
 * that data stays on the phone. So this collects the minimum that answers
 * real questions and nothing more:
 *
 *  - a random install id, generated on the device, tied to nothing — not the
 *    account, not the email, not the advertising id
 *  - WHICH screen-level steps happened and when — never what was in them:
 *    no exercise names, no weights, no measurements, no question texts
 *
 * The allowlist below is the entire vocabulary. The client refuses to queue
 * anything outside it and the server refuses to store it, so a future call
 * site cannot quietly start shipping something new: widening the vocabulary
 * is a visible edit here, which is exactly where a privacy reviewer looks.
 * An event that answers no question is noise — the same rule as the labels.
 */

export const ANALYTICS_EVENTS = [
  /** App came to the foreground. Daily actives and D2/D7 retention fall out. */
  'app_open',
  /** An onboarding step was reached; `step` says which. The funnel's spine. */
  'onboarding_step',
  /** Onboarding finished; `path` says whether built or picked ready. */
  'onboarding_completed',
  /** A programme was adopted as the active plan. */
  'plan_adopted',
  /** A workout session was started. */
  'workout_started',
  /** A workout session was saved. Started-without-completed is a finding. */
  'workout_completed',
  /** The Pro paywall was on screen. */
  'paywall_viewed',
  /** A question left for the coach (the fact of it — never the text). */
  'coach_question_asked',
] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[number];

export interface AnalyticsEvent {
  name: AnalyticsEventName;
  /** ISO timestamp, client clock. */
  at: string;
  /** The only two properties that exist. Anything else is refused. */
  props?: { step?: number; path?: string };
}

export interface AnalyticsBatch {
  /** Random UUID minted on the device. Identifies an install, not a person. */
  installId: string;
  sentAt: string;
  events: AnalyticsEvent[];
}

/** More than this in one batch means a stuck queue, not a busy user. */
export const MAX_BATCH_EVENTS = 100;
/** Queue cap on the device: beyond this the oldest events are dropped. */
export const MAX_QUEUED_EVENTS = 200;

const INSTALL_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidEventName(name: unknown): name is AnalyticsEventName {
  return typeof name === 'string' && (ANALYTICS_EVENTS as readonly string[]).includes(name);
}

/**
 * One event, shape-checked. Unknown property keys reject the whole event —
 * an open props bag is how "just this one extra field" becomes tracking.
 */
export function isValidEvent(value: unknown): value is AnalyticsEvent {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  if (!isValidEventName(candidate.name)) {
    return false;
  }
  if (typeof candidate.at !== 'string' || Number.isNaN(Date.parse(candidate.at))) {
    return false;
  }
  const keys = Object.keys(candidate).filter((key) => key !== 'name' && key !== 'at' && key !== 'props');
  if (keys.length > 0) {
    return false;
  }
  if (candidate.props === undefined) {
    return true;
  }
  if (!candidate.props || typeof candidate.props !== 'object') {
    return false;
  }
  const props = candidate.props as Record<string, unknown>;
  for (const key of Object.keys(props)) {
    if (key === 'step') {
      if (typeof props.step !== 'number' || !Number.isInteger(props.step) || props.step < 0 || props.step > 50) {
        return false;
      }
    } else if (key === 'path') {
      if (typeof props.path !== 'string' || props.path.length > 32) {
        return false;
      }
    } else {
      return false;
    }
  }
  return true;
}

/** The whole batch, or null. Partial acceptance would hide a broken client. */
export function validateBatch(payload: unknown): AnalyticsBatch | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }
  const candidate = payload as Record<string, unknown>;
  if (typeof candidate.installId !== 'string' || !INSTALL_ID_PATTERN.test(candidate.installId)) {
    return null;
  }
  if (typeof candidate.sentAt !== 'string' || Number.isNaN(Date.parse(candidate.sentAt))) {
    return null;
  }
  if (!Array.isArray(candidate.events) || candidate.events.length === 0 || candidate.events.length > MAX_BATCH_EVENTS) {
    return null;
  }
  if (!candidate.events.every(isValidEvent)) {
    return null;
  }
  return {
    installId: candidate.installId,
    sentAt: candidate.sentAt,
    events: candidate.events as AnalyticsEvent[],
  };
}

/**
 * The device-side queue after one more event. Oldest drop first past the cap:
 * with the network gone for a week, the recent funnel is worth more than the
 * stale one, and an unbounded queue is a disk leak.
 */
export function appendToQueue(queue: AnalyticsEvent[], event: AnalyticsEvent): AnalyticsEvent[] {
  const next = [...queue, event];
  return next.length > MAX_QUEUED_EVENTS ? next.slice(next.length - MAX_QUEUED_EVENTS) : next;
}
