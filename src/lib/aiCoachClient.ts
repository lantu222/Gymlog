import { buildAiCoachPreviewAnswer } from './aiCoachPreview';
import { resolveLiveAiCoachUrl } from './aiCoachLiveGate';
import { ProgramImageMediaType, ProgramTableRow, validateProgramTable } from './programImageImport';
import { AICoachAdvice, AICoachAdviceError, AICoachAdviceRequest, AICoachAdviceSuccess } from '../types/aiCoach';

// Routed through the spend-cap gate: a release build only sees the URL after
// a human has confirmed the Console usage limit (see aiCoachLiveGate.ts).
const AI_COACH_API_URL = resolveLiveAiCoachUrl(
  process.env.EXPO_PUBLIC_AI_COACH_API_URL,
  process.env.NODE_ENV !== 'production',
);
// Outer bound over the endpoint's 30 s Claude timeout plus the round trip.
const REQUEST_TIMEOUT_MS = 40000;

export interface RequestAiCoachAdviceResult {
  answer: AICoachAdvice;
  source: 'live' | 'preview';
  note?: string;
}

/**
 * Whether this build can reach a coach server at all. The same check the
 * request path makes, exported so a screen can state which mode the user is in
 * rather than guessing — in preview mode nothing they log leaves the device,
 * and that is worth being able to say out loud.
 */
export function isAiCoachLiveConfigured() {
  return AI_COACH_API_URL.length > 0;
}

function getAbortSignal(timeoutMs: number, upstreamSignal?: AbortSignal) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const handleAbort = () => controller.abort();
  if (upstreamSignal) {
    if (upstreamSignal.aborted) {
      controller.abort();
    } else {
      upstreamSignal.addEventListener('abort', handleAbort, { once: true });
    }
  }

  return {
    signal: controller.signal,
    cleanup() {
      clearTimeout(timeout);
      if (upstreamSignal) {
        upstreamSignal.removeEventListener('abort', handleAbort);
      }
    },
  };
}

function isSuccessResponse(value: unknown): value is AICoachAdviceSuccess {
  return Boolean(value) && typeof value === 'object' && (value as AICoachAdviceSuccess).ok === true;
}

function isErrorResponse(value: unknown): value is AICoachAdviceError {
  return Boolean(value) && typeof value === 'object' && (value as AICoachAdviceError).ok === false;
}

export async function requestAiCoachAdvice(input: AICoachAdviceRequest, upstreamSignal?: AbortSignal): Promise<RequestAiCoachAdviceResult> {
  if (!AI_COACH_API_URL) {
    return {
      answer: buildAiCoachPreviewAnswer(input.prompt, input.context, input.language),
      source: 'preview',
      note: 'Preview mode.',
    };
  }

  const { signal, cleanup } = getAbortSignal(REQUEST_TIMEOUT_MS, upstreamSignal);

  try {
    const response = await fetch(AI_COACH_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
      signal,
    });

    const payload = (await response.json()) as unknown;

    if (response.ok && isSuccessResponse(payload)) {
      return {
        answer: payload.answer,
        source: payload.source,
        note: payload.note,
      };
    }

    if (isErrorResponse(payload) && payload.fallback) {
      return {
        answer: payload.fallback,
        source: 'preview',
        note: payload.note ?? payload.error.message,
      };
    }

    return {
      answer: buildAiCoachPreviewAnswer(input.prompt, input.context, input.language),
      source: 'preview',
      note: 'Live error. Preview answer.',
    };
  } catch {
    return {
      answer: buildAiCoachPreviewAnswer(input.prompt, input.context, input.language),
      source: 'preview',
      note: 'Live unavailable. Preview answer.',
    };
  } finally {
    cleanup();
  }
}

/**
 * The composer's live path: the brief and the training context go to the
 * same endpoint with `mode: 'compose'`, and Claude returns a week as NAMES.
 * Resolving those names to the library is the caller's job
 * (programmeBrief.resolveLiveProposal), so this function stays a transport.
 *
 * Returns null whenever the live path cannot answer — not configured, refused,
 * timed out, or the payload is not a proposal — and the caller composes
 * locally. There is no fallback proposal in the response the way advice has
 * one: the deterministic composer needs the exercise library, which lives on
 * the device, not on the server.
 */
export interface LiveProgrammeProposalPayload {
  title: string;
  sessions: Array<{
    name: string;
    focus?: string;
    exercises: Array<{ name: string; sets: number; repsMin: number; repsMax: number; restSeconds?: number }>;
  }>;
}

function isProposalPayload(value: unknown): value is { ok: true; proposal: LiveProgrammeProposalPayload } {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const record = value as { ok?: unknown; proposal?: { title?: unknown; sessions?: unknown } };
  return (
    record.ok === true &&
    Boolean(record.proposal) &&
    typeof record.proposal?.title === 'string' &&
    Array.isArray(record.proposal?.sessions)
  );
}

/**
 * Read a programme out of a photograph.
 *
 * Returns the rows, or null when the app cannot reach a server or the answer
 * is not one. Null is deliberately indistinguishable from "the image had no
 * programme in it" at this layer: both leave the reader with nothing to
 * import, and the screen says so once rather than in two shades.
 *
 * The image is a one-off upload the reader initiated by choosing a photo, so
 * needing the network here is acceptable in a way it is not for logging a set.
 */
export async function requestProgramTableFromImage(
  input: { dataBase64: string; mediaType: ProgramImageMediaType },
  upstreamSignal?: AbortSignal,
): Promise<ProgramTableRow[] | null> {
  if (!AI_COACH_API_URL) {
    return null;
  }
  const { signal, cleanup } = getAbortSignal(REQUEST_TIMEOUT_MS, upstreamSignal);
  try {
    const response = await fetch(AI_COACH_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'table', mediaType: input.mediaType, dataBase64: input.dataBase64 }),
      signal,
    });
    if (!response.ok) {
      return null;
    }
    const payload = (await response.json()) as { ok?: unknown; rows?: unknown };
    // Validated again on the way in, with the same function the server used
    // on the way out: this side cannot assume the server it reached is the
    // one this build was written against.
    return payload?.ok === true ? validateProgramTable(payload) : null;
  } catch {
    return null;
  } finally {
    cleanup();
  }
}

export async function requestProgrammeComposition(
  input: { brief: string; context: AICoachAdviceRequest['context']; language?: 'fi' | 'en' },
  upstreamSignal?: AbortSignal,
): Promise<LiveProgrammeProposalPayload | null> {
  if (!AI_COACH_API_URL) {
    return null;
  }
  const { signal, cleanup } = getAbortSignal(REQUEST_TIMEOUT_MS, upstreamSignal);
  try {
    const response = await fetch(AI_COACH_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'compose', prompt: input.brief, context: input.context, language: input.language }),
      signal,
    });
    const payload = (await response.json()) as unknown;
    return response.ok && isProposalPayload(payload) ? payload.proposal : null;
  } catch {
    return null;
  } finally {
    cleanup();
  }
}
