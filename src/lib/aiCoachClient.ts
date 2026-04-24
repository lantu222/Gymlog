import { buildAiCoachPreviewAnswer } from './aiCoachPreview';
import { AICoachAdvice, AICoachAdviceError, AICoachAdviceRequest, AICoachAdviceSuccess } from '../types/aiCoach';

const AI_COACH_API_URL = (process.env.EXPO_PUBLIC_AI_COACH_API_URL ?? '').trim();
const REQUEST_TIMEOUT_MS = 12000;

export interface RequestAiCoachAdviceResult {
  answer: AICoachAdvice;
  source: 'live' | 'preview';
  note?: string;
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
      answer: buildAiCoachPreviewAnswer(input.prompt, input.context),
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
      answer: buildAiCoachPreviewAnswer(input.prompt, input.context),
      source: 'preview',
      note: 'Live error. Preview answer.',
    };
  } catch {
    return {
      answer: buildAiCoachPreviewAnswer(input.prompt, input.context),
      source: 'preview',
      note: 'Live unavailable. Preview answer.',
    };
  } finally {
    cleanup();
  }
}
