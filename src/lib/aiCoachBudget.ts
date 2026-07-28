/**
 * Spend controls for the coach endpoint (execution-plan A2).
 *
 * What this can and cannot do, stated plainly, because the difference matters:
 *
 * The endpoint is a stateless serverless function. Nothing here survives a
 * cold start, so an in-process counter is a brake, not a ceiling — a burst
 * spread across fresh instances slips past it. The only true ceiling is the
 * spend limit set on the Anthropic Console, which is a manual step and is
 * documented as such in docs/ai-coach-backend.md.
 *
 * What IS enforceable per request, and is enforced here:
 *
 * - A bound on how large a single call can get. This is the real lever: the
 *   response is already capped by max_tokens, but the request carries eight
 *   weeks of training history, and a client can post whatever it likes. An
 *   unbounded prompt is an unbounded bill.
 * - A per-instance budget in tokens, so the brake is denominated in the thing
 *   that actually costs money rather than in request count. Ten enormous
 *   requests should exhaust it faster than ten small ones.
 *
 * Everything here is pure so it can be tested without a network or a clock.
 */

/** Rough chars-per-token for budgeting. Deliberately pessimistic. */
const CHARS_PER_TOKEN = 3.5;

export interface AiCoachBudgetLimits {
  /** Largest prompt the endpoint will forward, in characters. */
  maxPromptChars: number;
  /** Largest serialized training context it will forward, in characters. */
  maxContextChars: number;
  /** Output cap handed to the model. */
  maxOutputTokens: number;
  /** Tokens this instance may spend before it starts refusing. */
  instanceTokenBudget: number;
  /** How long a budget window lasts. */
  windowMs: number;
}

export const DEFAULT_BUDGET_LIMITS: AiCoachBudgetLimits = {
  maxPromptChars: 2000,
  // The app's own history block caps near 5 KB; this leaves headroom for the
  // rest of the payload without letting a crafted one run away.
  maxContextChars: 24000,
  maxOutputTokens: 700,
  // ~1.5M tokens per window per instance. Generous for real use, and still a
  // bound rather than an open tap.
  instanceTokenBudget: 1_500_000,
  windowMs: 60 * 60 * 1000,
};

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

export type BudgetRejection =
  | { reason: 'prompt_too_large'; limit: number; actual: number }
  | { reason: 'context_too_large'; limit: number; actual: number }
  | { reason: 'budget_exhausted'; resetAt: number };

export interface BudgetDecision {
  allowed: boolean;
  rejection: BudgetRejection | null;
  /** Tokens this call is expected to cost, input + capped output. */
  estimatedTokens: number;
}

export interface BudgetState {
  spentTokens: number;
  windowResetAt: number;
}

export function createBudgetState(now: number, limits = DEFAULT_BUDGET_LIMITS): BudgetState {
  return { spentTokens: 0, windowResetAt: now + limits.windowMs };
}

/**
 * Decides whether a call may proceed and what it is expected to cost.
 *
 * Size checks come first: an oversized request is refused outright rather than
 * charged against the budget, so one bad client cannot starve everyone else.
 */
export function checkBudget(
  input: { promptChars: number; contextChars: number },
  state: BudgetState,
  now: number,
  limits: AiCoachBudgetLimits = DEFAULT_BUDGET_LIMITS,
): BudgetDecision {
  if (input.promptChars > limits.maxPromptChars) {
    return {
      allowed: false,
      rejection: { reason: 'prompt_too_large', limit: limits.maxPromptChars, actual: input.promptChars },
      estimatedTokens: 0,
    };
  }

  if (input.contextChars > limits.maxContextChars) {
    return {
      allowed: false,
      rejection: { reason: 'context_too_large', limit: limits.maxContextChars, actual: input.contextChars },
      estimatedTokens: 0,
    };
  }

  const estimatedTokens =
    Math.ceil((input.promptChars + input.contextChars) / CHARS_PER_TOKEN) + limits.maxOutputTokens;

  // A window that has elapsed is treated as empty; the caller rolls it over.
  const spent = now >= state.windowResetAt ? 0 : state.spentTokens;
  if (spent + estimatedTokens > limits.instanceTokenBudget) {
    return {
      allowed: false,
      rejection: { reason: 'budget_exhausted', resetAt: state.windowResetAt },
      estimatedTokens,
    };
  }

  return { allowed: true, rejection: null, estimatedTokens };
}

/** Rolls the window when it has elapsed, then books the spend. */
export function recordSpend(
  state: BudgetState,
  tokens: number,
  now: number,
  limits: AiCoachBudgetLimits = DEFAULT_BUDGET_LIMITS,
): BudgetState {
  if (now >= state.windowResetAt) {
    return { spentTokens: tokens, windowResetAt: now + limits.windowMs };
  }
  return { spentTokens: state.spentTokens + tokens, windowResetAt: state.windowResetAt };
}

export function readBudgetLimitsFromEnv(
  env: Record<string, string | undefined>,
  base: AiCoachBudgetLimits = DEFAULT_BUDGET_LIMITS,
): AiCoachBudgetLimits {
  const num = (value: string | undefined, fallback: number) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  };

  return {
    maxPromptChars: num(env.AI_COACH_MAX_PROMPT_CHARS, base.maxPromptChars),
    maxContextChars: num(env.AI_COACH_MAX_CONTEXT_CHARS, base.maxContextChars),
    maxOutputTokens: num(env.AI_COACH_CLAUDE_MAX_TOKENS, base.maxOutputTokens),
    instanceTokenBudget: num(env.AI_COACH_TOKEN_BUDGET, base.instanceTokenBudget),
    windowMs: num(env.AI_COACH_BUDGET_WINDOW_MS, base.windowMs),
  };
}
