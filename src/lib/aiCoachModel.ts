/**
 * The model the coach endpoint calls unless AI_COACH_CLAUDE_MODEL names
 * another.
 *
 * One place, because two endpoints need it: the coach itself, and the daily
 * health check, which asks that same model for one token — a key that can list
 * models can still be refused every call, by a spend limit or a model name
 * that no longer exists (server audit, 2026-09-21).
 */
export const AI_COACH_DEFAULT_MODEL = 'claude-haiku-4-5-20251001';
