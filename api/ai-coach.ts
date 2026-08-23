import { buildAiCoachPreviewAnswer } from '../src/lib/aiCoachPreview';
import { buildAiCoachSystemContext } from '../src/lib/aiCoachSystemContext';
import { normalizeAiCoachTrainingContext } from '../src/lib/aiTrainingContext';
import {
  BudgetState,
  checkBudget,
  createBudgetState,
  readBudgetLimitsFromEnv,
  recordSpend,
} from '../src/lib/aiCoachBudget';
import { AICoachAdvice, AICoachAdviceError, AICoachAdviceRequest, AICoachAdviceSuccess } from '../src/types/aiCoach';

type ApiRequest = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
  socket?: {
    remoteAddress?: string;
  };
};

type ApiResponse = {
  status: (code: number) => ApiResponse;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
  end: (body?: string) => void;
};

const RATE_LIMIT_WINDOW_MS = Number(process.env.AI_COACH_RATE_LIMIT_WINDOW_MS ?? 10 * 60 * 1000);
const RATE_LIMIT_MAX = Number(process.env.AI_COACH_RATE_LIMIT_MAX ?? 12);
const CLAUDE_TIMEOUT_MS = Number(process.env.AI_COACH_CLAUDE_TIMEOUT_MS ?? 12000);
const CLAUDE_MODEL = process.env.AI_COACH_CLAUDE_MODEL ?? 'claude-haiku-4-5-20251001';
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

/**
 * Spend ceiling (execution-plan A2).
 *
 * The rate limit above counts requests per IP; it does nothing about how
 * expensive one request is, and both reset on a cold start. The budget below
 * bounds the size of a single call — the part that is genuinely enforceable
 * here — and keeps a per-instance token brake on top. The real ceiling is the
 * Anthropic Console spend limit; see docs/ai-coach-backend.md.
 */
const BUDGET_LIMITS = readBudgetLimitsFromEnv(process.env);
const CLAUDE_MAX_TOKENS = BUDGET_LIMITS.maxOutputTokens;
let budgetState: BudgetState = createBudgetState(Date.now(), BUDGET_LIMITS);

const ADVICE_TOOL_NAME = 'ai_coach_advice';
const PROGRAMME_TOOL_NAME = 'ai_coach_programme';

/**
 * The composer's answer: a week as exercise NAMES. The app resolves every
 * name against its own library and drops what does not resolve, so the
 * schema asks for common English names and nothing else that would need
 * inventing (no ids, no muscle groups, no equipment tags).
 */
const AI_COACH_PROGRAMME_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'sessions'],
  properties: {
    title: { type: 'string', description: 'A short programme name in the language the athlete wrote in.' },
    sessions: {
      type: 'array',
      minItems: 1,
      maxItems: 6,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'exercises'],
        properties: {
          name: { type: 'string', description: 'The session name, e.g. "Day 1: Upper".' },
          focus: { type: 'string', description: 'One or two words on what the day is for.' },
          exercises: {
            type: 'array',
            minItems: 3,
            maxItems: 8,
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['name', 'sets', 'repsMin', 'repsMax'],
              properties: {
                name: {
                  type: 'string',
                  description:
                    'The common English gym name of a real exercise, e.g. "Barbell Bench Press", "Romanian Deadlift", "Lat Pulldown". Never invent a name.',
                },
                sets: { type: 'integer', minimum: 1, maximum: 8 },
                repsMin: { type: 'integer', minimum: 1, maximum: 30 },
                repsMax: { type: 'integer', minimum: 1, maximum: 30 },
                restSeconds: { type: 'integer', minimum: 30, maximum: 300 },
              },
            },
          },
        },
      },
    },
  },
} as const;

const COMPOSER_SYSTEM_RULES = [
  'You are the programme composer inside a strength and hypertrophy logging app.',
  '',
  '# Task',
  '- The user describes, in their own words, the programme they want. The training context is what the app already knows: their level, days available, equipment, cautions, and their log.',
  '- Return ONE week of sessions that follows the brief first and the context second. If the brief names a number of days, plan exactly that many (1-6). If it names lifts, they are in the week as the main lift of a session. If it names something that hurts, do not program lifts that load it.',
  '- Sets and reps follow the goal: strength 3-5 sets of 3-6, hypertrophy 3-4 sets of 8-12, fitness 2-3 sets of 10-15. Rest 60-180 s.',
  '',
  '# Names - these outrank everything',
  '- Use only the common English gym name of a real exercise (the app translates). Never invent, brand, or compound names. If unsure whether an exercise exists under a name, choose a more common exercise instead.',
  '- Only equipment the context says the user has.',
  '',
  '# Do not',
  '- Do not explain, do not add notes, do not address the user. Return the programme through the tool and nothing else.',
].join('\n');

const AI_COACH_RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['takeaway', 'why', 'nextSteps', 'plan', 'assumptions'],
  properties: {
    takeaway: {
      type: 'string',
      description:
        'The answer, in one or two sentences. The app shows this first and often alone, so it must stand on its own.',
    },
    why: {
      type: 'array',
      items: { type: 'string' },
      description: 'The evidence, each item citing a figure that appears in the training context.',
    },
    nextSteps: {
      type: 'array',
      items: { type: 'string' },
      description: 'What to do at the next session. One or two concrete actions, with numbers.',
    },
    plan: {
      type: 'array',
      items: { type: 'string' },
      description: 'Optional multi-week direction. Empty when the question does not call for one.',
    },
    assumptions: {
      type: 'array',
      items: { type: 'string' },
      description: 'Anything you had to assume because the context did not say. Empty when nothing was assumed.',
    },
  },
} as const;

/**
 * The rules the coach answers under. These are the contract: what it may claim,
 * what it must refuse to invent, and when saying less is the correct answer.
 * Kept as a constant prefix so it caches cleanly ahead of the training context.
 */
const COACH_SYSTEM_RULES = [
  'You are GAINER Coach, the training coach inside a strength and hypertrophy logging app.',
  '',
  '# Scope',
  '- You advise on training: programming, progression, exercise selection, technique cues, recovery, and nutrition as it relates to gaining muscle or losing fat.',
  '- Anything outside that, decline in one sentence and return to training.',
  '',
  '# Evidence rules — these outrank being helpful',
  '- The training context is the entire record of this user. Never state a number, session, exercise, or date that does not appear in it.',
  '- If the context lacks what you need, say what you would need. Do not estimate, and do not fill the gap with what is typical.',
  '- When a section says there is too little history to read something, do not comment on it at all.',
  '- Cite the actual figures. "Your squat top set went 100 to 102.5 kg across three sessions" — not "you are progressing nicely".',
  '- A lift that is up across the window but flat for the last several sessions is stalled. Say so; the recent stall is the actionable part.',
  '- Fewer than three sessions in the window is not a trend. Do not call it progress, consistency, momentum, or a pattern — say the record is too short to read, then answer what can be answered without it.',
  '- Never diagnose an injury or illness. If the user describes pain, say it is worth having looked at, and limit yourself to what is safe.',
  '',
  '# How to answer',
  '- Answer the question in the first sentence.',
  '- Two concrete actions beat ten. Give a number wherever a number is the answer.',
  '- All weights are kilograms.',
  '- Answer in the language the user wrote in.',
  '- Do not describe yourself, your context, or how you reasoned.',
  '',
  '# Saying less',
  '- Silence is a valid output. When there is nothing worth saying, say the small true thing rather than manufacturing an insight.',
].join('\n');

function getIpAddress(req: ApiRequest) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0]?.trim() ?? 'unknown';
  }

  return req.socket?.remoteAddress ?? 'unknown';
}

function createSuccess(answer: AICoachAdvice, source: 'live' | 'preview', note?: string): AICoachAdviceSuccess {
  return { ok: true, source, answer, note };
}

function createError(
  error: AICoachAdviceError['error'],
  fallback?: AICoachAdvice,
  note?: string,
  source: 'live' | 'preview' = 'live',
): AICoachAdviceError {
  return { ok: false, source, error, fallback, note };
}

function setCors(res: ApiResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
}

function checkRateLimit(ip: string) {
  const now = Date.now();
  const existing = rateLimitStore.get(ip);

  if (!existing || existing.resetAt <= now) {
    rateLimitStore.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { limited: false };
  }

  if (existing.count >= RATE_LIMIT_MAX) {
    return { limited: true };
  }

  existing.count += 1;
  rateLimitStore.set(ip, existing);
  return { limited: false };
}

type ParsedBody = AICoachAdviceRequest & { mode: 'advice' | 'compose' };

function parseBody(body: unknown): ParsedBody | null {
  const parsed = typeof body === 'string' ? JSON.parse(body) : body;
  if (!parsed || typeof parsed !== 'object') {
    return null;
  }

  const candidate = parsed as Partial<AICoachAdviceRequest> & { mode?: unknown };
  if (typeof candidate.prompt !== 'string' || !candidate.prompt.trim() || !candidate.context || typeof candidate.context !== 'object') {
    return null;
  }

  return {
    prompt: candidate.prompt.trim(),
    // Repaired, not trusted: a context with fields missing used to reach the
    // preview builder and crash the function on `trackedLifts[0]`.
    context: normalizeAiCoachTrainingContext(candidate.context as Partial<AICoachAdviceRequest['context']>),
    language: candidate.language === 'fi' || candidate.language === 'en' ? candidate.language : undefined,
    mode: candidate.mode === 'compose' ? 'compose' : 'advice',
  };
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function validateAnswer(payload: unknown): AICoachAdvice | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const candidate = payload as Partial<AICoachAdvice>;
  const { takeaway, why, nextSteps, plan, assumptions } = candidate;
  if (
    typeof takeaway !== 'string' ||
    !isStringArray(why) ||
    !isStringArray(nextSteps) ||
    !isStringArray(plan) ||
    !isStringArray(assumptions)
  ) {
    return null;
  }

  return {
    takeaway,
    why,
    nextSteps,
    plan,
    assumptions,
  };
}

/**
 * The answer arrives as a forced tool call, so the schema is enforced by the
 * API rather than by asking the model nicely for JSON.
 */
export function extractToolInput(payload: unknown, toolName: string = ADVICE_TOOL_NAME) {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const content = (payload as Record<string, unknown>).content;
  if (!Array.isArray(content)) {
    return null;
  }

  for (const block of content) {
    if (!block || typeof block !== 'object') {
      continue;
    }
    const record = block as Record<string, unknown>;
    if (record.type === 'tool_use' && record.name === toolName) {
      return record.input ?? null;
    }
  }

  return null;
}

async function requestClaude(input: AICoachAdviceRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return createError(
      { code: 'MISSING_API_KEY', message: 'ANTHROPIC_API_KEY is not configured.' },
      buildAiCoachPreviewAnswer(input.prompt, input.context),
      'ANTHROPIC_API_KEY puuttuu. AI Coach preview-vastaus palautettiin sen sijaan.',
    );
  }

  // Build the context once: it is both what gets sent and what gets measured,
  // so the budget can never be checked against a different payload than the
  // one that actually goes out.
  const contextText = `# Training context\n\n${buildAiCoachSystemContext(input.context)}`;
  const now = Date.now();
  const budget = checkBudget(
    { promptChars: input.prompt.length, contextChars: contextText.length + COACH_SYSTEM_RULES.length },
    budgetState,
    now,
    BUDGET_LIMITS,
  );

  if (!budget.allowed) {
    const rejection = budget.rejection;
    console.warn('AI Coach request refused by budget', rejection);
    return createError(
      {
        code: rejection?.reason === 'budget_exhausted' ? 'RATE_LIMIT' : 'BAD_REQUEST',
        message:
          rejection?.reason === 'budget_exhausted'
            ? 'Coach budget for this window is spent.'
            : 'Request is larger than the coach endpoint accepts.',
      },
      buildAiCoachPreviewAnswer(input.prompt, input.context),
      'Live AI Coach ei ollut käytettävissä juuri nyt. Preview-vastaus palautettiin.',
    );
  }

  // Booked before the call, not after: a request that times out still consumed
  // upstream tokens, and a crash between send and response must not leave the
  // spend unaccounted.
  budgetState = recordSpend(budgetState, budget.estimatedTokens, now, BUDGET_LIMITS);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CLAUDE_TIMEOUT_MS);

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: CLAUDE_MAX_TOKENS,
        // Rules first, then this user's training context. The cache breakpoint
        // sits after both: follow-up questions in the same conversation reuse
        // the whole prefix, which is most of the request.
        system: [
          { type: 'text', text: COACH_SYSTEM_RULES },
          { type: 'text', text: contextText, cache_control: { type: 'ephemeral' } },
        ],
        tools: [
          {
            name: ADVICE_TOOL_NAME,
            description: 'Return coaching advice for the athlete described in the training context.',
            input_schema: AI_COACH_RESPONSE_SCHEMA,
          },
        ],
        tool_choice: { type: 'tool', name: ADVICE_TOOL_NAME },
        messages: [{ role: 'user', content: input.prompt }],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text();
      console.error('AI Coach upstream request failed', response.status, body.slice(0, 400));
      return createError(
        { code: 'UPSTREAM_ERROR', message: 'Claude request failed.' },
        buildAiCoachPreviewAnswer(input.prompt, input.context),
        'Live AI Coach ei vastannut oikein. Preview-vastaus palautettiin.',
      );
    }

    const payload = (await response.json()) as unknown;
    const parsed = validateAnswer(extractToolInput(payload));

    if (!parsed) {
      return createError(
        { code: 'INVALID_RESPONSE', message: 'Claude returned an invalid schema payload.' },
        buildAiCoachPreviewAnswer(input.prompt, input.context),
        'Live AI Coach palautti virheellisen vastauksen. Preview-vastaus palautettiin.',
      );
    }

    return createSuccess(parsed, 'live');
  } catch (error) {
    const isAbort = error instanceof Error && error.name === 'AbortError';
    return createError(
      { code: isAbort ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_ERROR', message: isAbort ? 'Claude request timed out.' : 'Claude request failed.' },
      buildAiCoachPreviewAnswer(input.prompt, input.context),
      isAbort ? 'Live AI Coach aikakatkaistiin. Preview-vastaus palautettiin.' : 'Live AI Coach ei ollut tavoitettavissa. Preview-vastaus palautettiin.',
    );
  } finally {
    clearTimeout(timeout);
  }
}

/** Shape-checks the composer's tool output; anything off is an INVALID_RESPONSE, not a partial programme. */
export function validateProgramme(payload: unknown) {
  if (!payload || typeof payload !== 'object') {
    return null;
  }
  const record = payload as { title?: unknown; sessions?: unknown };
  if (typeof record.title !== 'string' || !Array.isArray(record.sessions) || record.sessions.length === 0) {
    return null;
  }
  const sessions = [];
  for (const session of record.sessions) {
    if (!session || typeof session !== 'object') {
      return null;
    }
    const entry = session as { name?: unknown; focus?: unknown; exercises?: unknown };
    if (typeof entry.name !== 'string' || !Array.isArray(entry.exercises)) {
      return null;
    }
    const exercises = [];
    for (const exercise of entry.exercises) {
      if (!exercise || typeof exercise !== 'object') {
        return null;
      }
      const item = exercise as { name?: unknown; sets?: unknown; repsMin?: unknown; repsMax?: unknown; restSeconds?: unknown };
      if (
        typeof item.name !== 'string' ||
        typeof item.sets !== 'number' ||
        typeof item.repsMin !== 'number' ||
        typeof item.repsMax !== 'number'
      ) {
        return null;
      }
      exercises.push({
        name: item.name.trim(),
        sets: item.sets,
        repsMin: item.repsMin,
        repsMax: item.repsMax,
        restSeconds: typeof item.restSeconds === 'number' ? item.restSeconds : undefined,
      });
    }
    sessions.push({ name: entry.name.trim(), focus: typeof entry.focus === 'string' ? entry.focus : undefined, exercises });
  }
  return { title: record.title.trim(), sessions };
}

/**
 * The compose mode. Same key, same budget, same rate limit as advice; a
 * different tool and different rules. There is no preview fallback in the
 * response - the deterministic composer needs the exercise library, which is
 * on the device - so every failure is an error the client answers locally.
 */
type ProgrammeResult =
  | AICoachAdviceError
  | { ok: true; source: 'live'; proposal: { title: string; sessions: unknown[] } };

async function requestClaudeProgramme(input: ParsedBody): Promise<ProgrammeResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return createError({ code: 'MISSING_API_KEY', message: 'ANTHROPIC_API_KEY is not configured.' });
  }
  const contextText = `# Training context\n\n${buildAiCoachSystemContext(input.context)}`;
  const now = Date.now();
  const budget = checkBudget(
    { promptChars: input.prompt.length, contextChars: contextText.length + COMPOSER_SYSTEM_RULES.length },
    budgetState,
    now,
    BUDGET_LIMITS,
  );
  if (!budget.allowed) {
    const rejection = budget.rejection;
    return createError({
      code: rejection?.reason === 'budget_exhausted' ? 'RATE_LIMIT' : 'BAD_REQUEST',
      message: rejection?.reason === 'budget_exhausted' ? 'Coach budget for this window is spent.' : 'Request is larger than the coach endpoint accepts.',
    });
  }
  budgetState = recordSpend(budgetState, budget.estimatedTokens, now, BUDGET_LIMITS);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CLAUDE_TIMEOUT_MS);
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: CLAUDE_MAX_TOKENS,
        system: [
          { type: 'text', text: COMPOSER_SYSTEM_RULES },
          { type: 'text', text: contextText, cache_control: { type: 'ephemeral' } },
        ],
        tools: [
          {
            name: PROGRAMME_TOOL_NAME,
            description: 'Return one week of training sessions for the athlete described in the training context.',
            input_schema: AI_COACH_PROGRAMME_SCHEMA,
          },
        ],
        tool_choice: { type: 'tool', name: PROGRAMME_TOOL_NAME },
        messages: [{ role: 'user', content: input.prompt }],
      }),
      signal: controller.signal,
    });
    if (!response.ok) {
      const body = await response.text();
      console.error('AI composer upstream request failed', response.status, body.slice(0, 400));
      return createError({ code: 'UPSTREAM_ERROR', message: 'Claude request failed.' });
    }
    const payload = (await response.json()) as unknown;
    const proposal = validateProgramme(extractToolInput(payload, PROGRAMME_TOOL_NAME));
    if (!proposal) {
      return createError({ code: 'INVALID_RESPONSE', message: 'Claude returned an invalid programme payload.' });
    }
    return { ok: true as const, source: 'live' as const, proposal };
  } catch (error) {
    const isAbort = error instanceof Error && error.name === 'AbortError';
    return createError({
      code: isAbort ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_ERROR',
      message: isAbort ? 'Claude request timed out.' : 'Claude request failed.',
    });
  } finally {
    clearTimeout(timeout);
  }
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json(createError({ code: 'METHOD_NOT_ALLOWED', message: 'Use POST.' }, undefined, undefined, 'preview'));
    return;
  }

  let input: ParsedBody | null = null;
  try {
    input = parseBody(req.body);
  } catch {
    input = null;
  }

  if (!input) {
    res.status(400).json(createError({ code: 'BAD_REQUEST', message: 'Prompt and context are required.' }, undefined, undefined, 'preview'));
    return;
  }

  const ip = getIpAddress(req);
  const rateLimit = checkRateLimit(ip);
  if (rateLimit.limited) {
    res.status(429).json(
      createError(
        { code: 'RATE_LIMIT', message: 'Too many requests. Try again shortly.' },
        buildAiCoachPreviewAnswer(input.prompt, input.context),
        'Pyyntoraja tayttyi hetkeksi. Preview-vastaus palautettiin.',
      ),
    );
    return;
  }

  if (input.mode === 'compose') {
    const composed = await requestClaudeProgramme(input);
    if (composed.ok === true) {
      res.status(200).json(composed);
      return;
    }
    // Narrowed by the literal discriminant: Vercel's compiler refused the
    // truthiness form and reported `error` as missing on the union.
    const failure: AICoachAdviceError = composed;
    const composeStatus =
      failure.error.code === 'UPSTREAM_TIMEOUT' ? 504 : failure.error.code === 'RATE_LIMIT' ? 429 : failure.error.code === 'BAD_REQUEST' ? 400 : 502;
    res.status(composeStatus).json(failure);
    return;
  }

  const result = await requestClaude(input);
  if (result.ok) {
    res.status(200).json(result);
    return;
  }

  const status = result.error.code === 'UPSTREAM_TIMEOUT' ? 504 : result.error.code === 'RATE_LIMIT' ? 429 : 502;
  res.status(status).json(result);
}
