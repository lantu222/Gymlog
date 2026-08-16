/**
 * Why the reader ended their membership.
 *
 * The reasons are i18n keys rather than strings, which is what makes the stored
 * answer useful later: a Finnish "Liian kallis" and an English "Too expensive"
 * are the same answer, and storing the key keeps them countable across both.
 *
 * There is no server. The answer is written to the device, and the survey says
 * so in its own fine print rather than showing a Send button that goes nowhere.
 * When there is somewhere to send it, this shape is what gets uploaded.
 */
export const CANCEL_REASON_KEYS = [
  'subs.survey.r1',
  'subs.survey.r2',
  'subs.survey.r3',
  'subs.survey.r4',
  'subs.survey.r5',
  'subs.survey.r6',
] as const;

export type CancelReasonKey = (typeof CANCEL_REASON_KEYS)[number];

export interface CancelSurveyAnswer {
  /** ISO instant the answer was given. */
  answeredAt: string;
  reasons: CancelReasonKey[];
  /** Free text, only when "something else" was picked. Empty otherwise. */
  note: string;
}

function isCancelReasonKey(value: unknown): value is CancelReasonKey {
  return CANCEL_REASON_KEYS.includes(value as CancelReasonKey);
}

/**
 * Builds the stored answer, or null when there is nothing to store.
 *
 * Skipping is a real outcome and it is not the same as answering nothing: both
 * end up here, and both return null, so a skipped survey leaves no record at
 * all rather than an empty one that would count as a response.
 */
export function buildCancelSurveyAnswer(
  reasons: readonly unknown[],
  note: string,
  answeredAt: string,
): CancelSurveyAnswer | null {
  const clean = reasons.filter(isCancelReasonKey);
  const trimmed = note.trim();
  if (clean.length === 0 && trimmed.length === 0) {
    return null;
  }
  return {
    answeredAt,
    reasons: clean,
    // The note belongs to "something else"; keeping it when that box is not
    // ticked would store text the reader has already backed out of.
    note: clean.includes('subs.survey.r6') ? trimmed : '',
  };
}

export function normalizeCancelSurveyAnswer(input: unknown): CancelSurveyAnswer | null {
  if (!input || typeof input !== 'object') {
    return null;
  }
  const raw = input as Partial<CancelSurveyAnswer>;
  if (typeof raw.answeredAt !== 'string' || !Array.isArray(raw.reasons)) {
    return null;
  }
  return buildCancelSurveyAnswer(
    raw.reasons,
    typeof raw.note === 'string' ? raw.note : '',
    raw.answeredAt,
  );
}
