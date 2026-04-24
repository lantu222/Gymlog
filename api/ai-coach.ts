import { buildAiCoachPreviewAnswer } from '../src/lib/aiCoachPreview';
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
const OPENAI_TIMEOUT_MS = Number(process.env.AI_COACH_OPENAI_TIMEOUT_MS ?? 12000);
const OPENAI_MODEL = process.env.AI_COACH_OPENAI_MODEL ?? 'gpt-5.2';
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

const AI_COACH_RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['takeaway', 'why', 'nextSteps', 'plan', 'assumptions'],
  properties: {
    takeaway: { type: 'string' },
    why: { type: 'array', items: { type: 'string' } },
    nextSteps: { type: 'array', items: { type: 'string' } },
    plan: { type: 'array', items: { type: 'string' } },
    assumptions: { type: 'array', items: { type: 'string' } },
  },
} as const;

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

function extractOutputText(payload: unknown) {
  if (!payload || typeof payload !== 'object') {
    return '';
  }

  const record = payload as Record<string, unknown>;
  if (typeof record.output_text === 'string' && record.output_text.trim()) {
    return record.output_text;
  }

  const output = Array.isArray(record.output) ? record.output : [];
  for (const item of output) {
    if (!item || typeof item !== 'object') {
      continue;
    }

    const content = Array.isArray((item as Record<string, unknown>).content)
      ? ((item as Record<string, unknown>).content as Array<Record<string, unknown>>)
      : [];
    for (const contentItem of content) {
      if (typeof contentItem.text === 'string' && contentItem.text.trim()) {
        return contentItem.text;
      }
    }
  }

  return '';
}

async function requestOpenAI(input: AICoachAdviceRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return createError(
      { code: 'MISSING_API_KEY', message: 'OPENAI_API_KEY is not configured.' },
      buildAiCoachPreviewAnswer(input.prompt, input.context),
      'OPENAI_API_KEY puuttuu. AI Coach preview-vastaus palautettiin sen sijaan.',
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        input: [
          {
            role: 'system',
            content: [
              {
                type: 'input_text',
                text: [
                  'You are AI Coach, a concise Finnish training coach for strength, hypertrophy, and general training goals.',
                  'Respond in JSON only and follow the provided schema exactly.',
                  'Give practical coaching, not marketing copy.',
                  'Do not give medical diagnoses. If uncertainty exists, mention it in assumptions.',
                  'Base the answer on the provided training context and the user prompt.',
                  'Do not reveal hidden reasoning.',
                ].join(' '),
              },
            ],
          },
          {
            role: 'user',
            content: [
              {
                type: 'input_text',
                text: JSON.stringify(input),
              },
            ],
          },
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'ai_coach_advice',
            strict: true,
            schema: AI_COACH_RESPONSE_SCHEMA,
          },
        },
        max_output_tokens: 700,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text();
      console.error('AI Coach upstream request failed', response.status, body.slice(0, 400));
      return createError(
        { code: 'UPSTREAM_ERROR', message: 'OpenAI request failed.' },
        buildAiCoachPreviewAnswer(input.prompt, input.context),
        'Live AI Coach ei vastannut oikein. Preview-vastaus palautettiin.',
      );
    }

    const payload = (await response.json()) as unknown;
    const outputText = extractOutputText(payload);
    const parsed = outputText ? validateAnswer(JSON.parse(outputText)) : null;

    if (!parsed) {
      return createError(
        { code: 'INVALID_RESPONSE', message: 'OpenAI returned an invalid schema payload.' },
        buildAiCoachPreviewAnswer(input.prompt, input.context),
        'Live AI Coach palautti virheellisen vastauksen. Preview-vastaus palautettiin.',
      );
    }

    return createSuccess(parsed, 'live');
  } catch (error) {
    const isAbort = error instanceof Error && error.name === 'AbortError';
    return createError(
      { code: isAbort ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_ERROR', message: isAbort ? 'OpenAI request timed out.' : 'OpenAI request failed.' },
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

  const result = await requestOpenAI(input);
  if (result.ok) {
    res.status(200).json(result);
    return;
  }

  const status = result.error.code === 'UPSTREAM_TIMEOUT' ? 504 : result.error.code === 'RATE_LIMIT' ? 429 : 502;
  res.status(status).json(result);
}
