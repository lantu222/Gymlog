/**
 * The conversation that is open right now, kept so a follow-up has something
 * to refer back to.
 *
 * Every question used to leave the device alone, which made "entä sitten?" and
 * "miksi?" unanswerable: the coach had no idea what "sitten" was. This keeps
 * the last few exchanges in memory and sends them with the next question.
 *
 * In memory, deliberately. Nothing is persisted, so closing the chat ends the
 * conversation — there is no memory across sessions or devices, which is what
 * the privacy copy promises.
 */
import type { AICoachConversationTurn } from '../types/aiCoach';

/**
 * Enough for a follow-up to land, few enough that the bill stays small: the
 * conversation rides in the uncached half of the request and is paid for on
 * every turn.
 */
export const MAX_COACH_CONVERSATION_TURNS = 3;

/**
 * The conversation after one more exchange. An exchange with nothing on either
 * side is dropped rather than stored: a blank turn would spend tokens saying
 * nothing, and an empty assistant turn is not a valid message anyway.
 */
export function appendCoachTurn(
  history: AICoachConversationTurn[],
  turn: AICoachConversationTurn,
): AICoachConversationTurn[] {
  const question = turn.question.trim();
  const takeaway = turn.takeaway.trim();
  if (!question || !takeaway) {
    return history;
  }
  return [...history, { question, takeaway }].slice(-MAX_COACH_CONVERSATION_TURNS);
}
