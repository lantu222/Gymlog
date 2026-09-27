import { AICoachAdvice } from '../types/aiCoach';

/** A heads-up or an example is one sentence; past this it is a paragraph. */
export const MAX_EXTRA_LINE_CHARS = 280;

/**
 * The last-workout answer's extra fields, read off what the model returned.
 *
 * The shape the user set on 2026-09-27: an observation, what I would do next,
 * "Huomio" only when something needs a warning, and one "Kehitysesimerkki".
 * Each is carried only when it holds something, so an older app — and every
 * other kind of answer — receives the same object it always did.
 */
export function readAnswerExtras(
  candidate: unknown,
): Pick<AICoachAdvice, 'topic' | 'attention' | 'example'> {
  if (!candidate || typeof candidate !== 'object') {
    return {};
  }
  const record = candidate as Record<string, unknown>;
  const line = (value: unknown) =>
    typeof value === 'string' && value.trim() ? value.trim().slice(0, MAX_EXTRA_LINE_CHARS) : null;
  const attention = line(record.attention);
  const example = line(record.example);
  return {
    ...(record.topic === 'last_session' ? { topic: 'last_session' as const } : {}),
    ...(attention ? { attention } : {}),
    ...(example ? { example } : {}),
  };
}
