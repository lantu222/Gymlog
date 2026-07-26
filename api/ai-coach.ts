import { buildAiCoachPreviewAnswer } from '../src/lib/aiCoachPreview';
import { buildAiCoachSystemContext } from '../src/lib/aiCoachSystemContext';
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
const CLAUDE_MAX_TOKENS = Number(process.env.AI_COACH_CLAUDE_MAX_TOKENS ?? 700);
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

const ADVICE_TOOL_NAME = 'ai_coach_advice';

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

function parseBody(body: unknown): AICoachAdviceRequest | null {
  const parsed = typeof body === 'string' ? JSON.parse(body) : body;
  if (!parsed || typeof parsed !== 'object') {
    return null;
  }

  const candidate = parsed as Partial<AICoachAdviceRequest>;
  if (typeof candidate.prompt !== 'string' || !candidate.prompt.trim() || !candidate.context || typeof candidate.context !== 'object') {
    return null;
  }

  return {
    prompt: candidate.prompt.trim(),
    context: candidate.context as AICoachAdviceRequest['context'],
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
export function extractToolInput(payload: unknown) {
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
    if (record.type === 'tool_use' && record.name === ADVICE_TOOL_NAME) {
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
          {
            type: 'text',
            text: `# Training context\n\n${buildAiCoachSystemContext(input.context)}`,
            cache_control: { type: 'ephemeral' },
          },
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

  let input: AICoachAdviceRequest | null = null;
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

  const result = await requestClaude(input);
  if (result.ok) {
    res.status(200).json(result);
    return;
  }

  const status = result.error.code === 'UPSTREAM_TIMEOUT' ? 504 : result.error.code === 'RATE_LIMIT' ? 429 : 502;
  res.status(status).json(result);
}
