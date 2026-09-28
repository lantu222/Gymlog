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

/** The figures a line carries, as written: "155", "6", "82,5". */
function figuresOf(text: string): Set<string> {
  return new Set((text.match(/\d+(?:[.,]\d+)?/g) ?? []).map((figure) => figure.replace(',', '.')));
}

/**
 * The next steps without the one that only restates the example.
 *
 * With one topic, "what I would do next" and "Kehitysesimerkki" are about the
 * same lift, and the model kept writing the example twice — "Pidä 155 kg ja
 * tavoittele 6/6/6" under both headings (live, 2026-09-28) — although the
 * rules and the schema both said not to (#204 learnt the same: prose alone
 * does not stop it). A step that carries every figure of the example is that
 * repeat, and is dropped; a step with other figures, or none, stays.
 */
export function withoutExampleRepeats(nextSteps: string[], example: string | undefined): string[] {
  const figures = example ? figuresOf(example) : new Set<string>();
  if (figures.size === 0) {
    return nextSteps;
  }
  return nextSteps.filter((step) => {
    const stepFigures = figuresOf(step);
    return ![...figures].every((figure) => stepFigures.has(figure));
  });
}
