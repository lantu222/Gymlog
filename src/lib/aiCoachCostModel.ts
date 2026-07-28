/**
 * What the coach endpoint actually costs to run.
 *
 * The inputs that matter are not guesses: `scripts/simulate-coach-cost.cjs`
 * builds real training contexts with the same buildAiCoachSystemContext the
 * endpoint sends, measures them, and feeds the token counts through this
 * model. Nothing here estimates a payload size — it prices one.
 *
 * PRICES ARE A CONSTANT, NOT A FACT. Verify HAIKU_4_5_PRICING against
 * anthropic.com/pricing before trusting a number this produces; a model or
 * tier change moves every figure downstream.
 */

export interface ModelPricing {
  /** USD per million uncached input tokens. */
  inputPerMTok: number;
  /** USD per million tokens written to the prompt cache. */
  cacheWritePerMTok: number;
  /** USD per million tokens read from the prompt cache. */
  cacheReadPerMTok: number;
  /** USD per million output tokens. */
  outputPerMTok: number;
}

/** Claude Haiku 4.5, the model api/ai-coach.ts defaults to. */
export const HAIKU_4_5_PRICING: ModelPricing = {
  inputPerMTok: 1,
  // 5-minute ephemeral cache: writes cost 1.25x input, reads 0.1x.
  cacheWritePerMTok: 1.25,
  cacheReadPerMTok: 0.1,
  outputPerMTok: 5,
};

export interface CoachUsageProfile {
  label: string;
  /**
   * Tokens in the cacheable prefix — tool schema, coach rules, and this user's
   * serialized training context. Everything before the cache breakpoint.
   */
  prefixTokens: number;
  /** Tokens in one typed question. */
  promptTokens: number;
  /** Tokens the model returns. Bounded by maxOutputTokens. */
  outputTokens: number;
  /**
   * Questions asked before the cache entry expires. The first one always pays
   * a miss; the rest hit. 1 means the user asks once and closes the sheet.
   */
  questionsPerConversation: number;
  /** Conversations a Pro user starts per month. */
  conversationsPerMonth: number;
}

export interface ConversationCost {
  /** USD for one conversation, with the endpoint's cache_control in place. */
  cachedUsd: number;
  /** USD for the same conversation with no prompt caching at all. */
  uncachedUsd: number;
}

const PER_MTOK = 1_000_000;

/**
 * One conversation, priced both ways.
 *
 * Caching is not free: a write costs 1.25x what the same tokens cost uncached,
 * so a user who asks exactly one question and leaves pays MORE with caching
 * on. It only wins once a conversation has follow-ups, which is why this
 * returns both numbers rather than assuming the answer.
 */
export function conversationCost(
  profile: CoachUsageProfile,
  pricing: ModelPricing = HAIKU_4_5_PRICING,
): ConversationCost {
  const questions = Math.max(1, Math.round(profile.questionsPerConversation));
  const followUps = questions - 1;

  const promptUsd = (profile.promptTokens * questions * pricing.inputPerMTok) / PER_MTOK;
  const outputUsd = (profile.outputTokens * questions * pricing.outputPerMTok) / PER_MTOK;

  const cachedPrefixUsd =
    (profile.prefixTokens * pricing.cacheWritePerMTok) / PER_MTOK +
    (profile.prefixTokens * followUps * pricing.cacheReadPerMTok) / PER_MTOK;

  const uncachedPrefixUsd = (profile.prefixTokens * questions * pricing.inputPerMTok) / PER_MTOK;

  return {
    cachedUsd: cachedPrefixUsd + promptUsd + outputUsd,
    uncachedUsd: uncachedPrefixUsd + promptUsd + outputUsd,
  };
}

/**
 * How many questions a conversation needs before caching is cheaper.
 *
 * Below this, the endpoint's cache_control is costing money rather than saving
 * it. Returns Infinity when reads are not cheaper than input, which would make
 * caching never pay.
 */
export function cacheBreakEvenQuestions(pricing: ModelPricing = HAIKU_4_5_PRICING): number {
  const savedPerHit = pricing.inputPerMTok - pricing.cacheReadPerMTok;
  if (savedPerHit <= 0) {
    return Number.POSITIVE_INFINITY;
  }

  const writePremium = pricing.cacheWritePerMTok - pricing.inputPerMTok;
  // First question pays the premium; each later one saves. Break even is the
  // first whole question count where the savings cover it.
  return 1 + Math.ceil(writePremium / savedPerHit);
}

export interface MonthlyCost {
  perUserUsd: number;
  perUserCentsRounded: number;
  /** Cost for a fleet of Pro users, USD/month. */
  fleetUsd: (users: number) => number;
}

export function monthlyCost(
  profile: CoachUsageProfile,
  pricing: ModelPricing = HAIKU_4_5_PRICING,
  useCaching = true,
): MonthlyCost {
  const cost = conversationCost(profile, pricing);
  const perConversation = useCaching ? cost.cachedUsd : cost.uncachedUsd;
  const perUserUsd = perConversation * profile.conversationsPerMonth;

  return {
    perUserUsd,
    perUserCentsRounded: Math.round(perUserUsd * 100 * 10) / 10,
    fleetUsd: (users: number) => perUserUsd * users,
  };
}

/**
 * The share of a subscription price that goes to the model.
 *
 * This is the number that decides whether the tier is viable, and the one that
 * has to survive the worst-behaved user rather than the average one.
 */
export function grossMarginShare(perUserUsd: number, subscriptionUsd: number): number {
  if (subscriptionUsd <= 0) {
    return 1;
  }
  return perUserUsd / subscriptionUsd;
}
