import { put } from '@vercel/blob';
import { buildAiCoachPreviewAnswer } from '../src/lib/aiCoachPreview';
import { buildAiCoachSystemContext } from '../src/lib/aiCoachSystemContext';
import { normalizeAiCoachTrainingContext } from '../src/lib/aiTrainingContext';
import { AI_COACH_DEBUG_TRANSCRIPTS } from '../src/lib/aiCoachDebug';
import {
  isProgramImageMediaType,
  PROGRAM_IMAGE_MAX_BASE64_CHARS,
  PROGRAM_TABLE_RULES,
  PROGRAM_TABLE_SCHEMA,
  PROGRAM_TABLE_TOOL_NAME,
  ProgramImageMediaType,
  validateProgramTable,
} from '../src/lib/programImageImport';
import {
  BudgetState,
  checkBudget,
  createBudgetState,
  readBudgetLimitsFromEnv,
  recordSpend,
} from '../src/lib/aiCoachBudget';
import {
  AICoachAdvice,
  AICoachAdviceError,
  AICoachAdviceRequest,
  AICoachAdviceSuccess,
  AICoachConversationTurn,
  AICoachSuggestion,
} from '../src/types/aiCoach';

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
// 30 s: Sonnet 5 thinks before it answers, and the first call after a cold
// start (cache creation included) ran past 20 s twice in one evening
// (2026-08-23). A late real answer beats an on-time preview fallback. The
// app's own fetch timeout (40 s) stays the outer bound.
const CLAUDE_TIMEOUT_MS = Number(process.env.AI_COACH_CLAUDE_TIMEOUT_MS ?? 30000);

const CLAUDE_MODEL = process.env.AI_COACH_CLAUDE_MODEL ?? 'claude-haiku-4-5-20251001';
// Coaching answers are short and grounded, so the default is a modest effort
// setting, which keeps the Sonnet/Opus tiers fast. AI_COACH_EFFORT tunes it
// without a deploy: low | medium | high, or 'off' to disable thinking
// entirely. Haiku 4.5 rejects both parameters, so it gets neither.
// Medium: on Sonnet 5, low effort produced garbled Finnish tokens in one
// answer out of three ("eikän", "viikonon"); medium was clean in every run
// and no slower (probe, 2026-08-23).
const EFFORT_SETTING = (process.env.AI_COACH_EFFORT ?? 'medium').trim();
function effortConfig(setting: string, model: string = CLAUDE_MODEL): Record<string, unknown> {
  if (/haiku/.test(model)) return {};
  if (setting === 'off') return { thinking: { type: 'disabled' } };
  return { output_config: { effort: ['low', 'medium', 'high'].includes(setting) ? setting : 'low' } };
}
const EFFORT_CONFIG: Record<string, unknown> = effortConfig(EFFORT_SETTING);
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
    unanswered: {
      type: 'boolean',
      description:
        'True only when `takeaway` is a follow-up question instead of an answer, because the context did not hold what the question needed. The app does not charge a free-tier question for it.',
    },
    suggestion: {
      type: 'object',
      additionalProperties: false,
      required: ['kind'],
      description:
        'At most one thing to offer to do for the reader, drawn as a button. Omit unless the App state section shows the thing is missing and the conversation actually called for it.',
      properties: {
        kind: {
          type: 'string',
          enum: ['pin_stat_card', 'set_goal', 'weigh_in_reminder', 'log_measurement', 'compose_programme'],
          description:
            'log_measurement: open the page where a measurement is recorded, when the answer needs a reading the Body record does not have. pin_stat_card: put a measurement card on the home screen. set_goal: save the goal the reader described in their own words. weigh_in_reminder: switch on a morning nudge to weigh in, when the goal needs weight tracked and it is off. compose_programme: build a programme from the brief in `brief` — offer this whenever the reader asks for a new programme.',
        },
        statKey: {
          type: 'string',
          description: 'For pin_stat_card and log_measurement: which measurement, e.g. "chest".',
        },
        goalText: {
          type: 'string',
          description:
            'For set_goal only: the goal in the words and language the reader used, with the target if they gave one — "kasvattaa rinnanympärystä 104 cm". Keep their own sentence: it must name the body part or bodyweight, and paraphrasing has dropped that before. The app parses it and discards the offer if it cannot, which leaves your answer pointing at a button nobody sees.',
        },
        brief: {
          type: 'string',
          description:
            'For compose_programme only: the programme brief, written from what this conversation established and in the reader\'s own language — days per week, the focus or lifts they named, anything that hurts. "5 päivää viikossa, painotus rinta, pakarat ja vatsa". It is quoted back to them before they tap, so it must be theirs and not your embellishment. Do not invent what was never said.',
        },
        value: {
          type: 'number',
          description:
            'For log_measurement, when the reader stated the number: the value, so the button logs it in one tap. Omit when no number was given — the button opens the recording page instead.',
        },
        unit: {
          type: 'string',
          enum: ['cm', 'kg', '%'],
          description: 'For log_measurement with a value: the unit of that value.',
        },
      },
    },
  },
} as const;

/**
 * The rules the coach answers under. These are the contract: what it may claim,
 * what it must refuse to invent, and when saying less is the correct answer.
 * Kept as a constant prefix so it caches cleanly ahead of the training context.
 */
const COACH_SYSTEM_RULES = [
  'You are Vinha Coach, the training coach inside Vinha Fitness, a strength and hypertrophy logging app.',
  '',
  '# Scope',
  '- You advise on training: programming, progression, exercise selection, technique cues, recovery, and nutrition as it relates to gaining muscle or losing fat.',
  '- Anything outside that, decline in one sentence and return to training.',
  '',
  '# Evidence rules — these outrank being helpful',
  '- The training context is the entire record of this user. Never state a number, session, exercise, or date that does not appear in it.',
  '- When a "Current programme" section is present it is the reader\'s running plan, day by day. Read it before answering anything about their programme — what it contains, whether it suits a goal, what to change — and name the actual days and exercises. Never say you cannot see their programme while that section is there.',
  '- If the context lacks what you need, do not answer anyway. Do not estimate, and do not fill the gap with what is typical — ask instead, under "When you cannot answer" below.',
  '- When a section says there is too little history to read something, do not comment on it at all.',
  '- Cite the actual figures. "Your squat top set went 100 to 102.5 kg across three sessions" — not "you are progressing nicely".',
  '- A lift that is up across the window but flat for the last several sessions is stalled. Say so; the recent stall is the actionable part.',
  '- Fewer than three sessions in the window is not a trend. Do not call it progress, consistency, momentum, or a pattern — say the record is too short to read, then answer what can be answered without it.',
  '- The "Reading note" section says how much record the answer rests on. It is counted from the log, so treat it as fact and let it set how firmly you speak: hedge nothing on a long record, qualify once on a short one. Never rate your own confidence, and never open successive sentences with "it seems" or "it looks like" — a hedge on every line carries no information.',
  '- The "Advice you have already given this reader" section is your own past answers, dated. Read it as a record of what was said, never as a fact about training now: the log above is the only source for what is true today. Do not repeat a point that is already there — the reader has had it. Build on it instead ("you added the third set two weeks ago; the next step is..."), and when the log shows that advice was wrong or has been outgrown, say plainly that you are changing it rather than pretending the earlier answer never happened.',
  '- Never diagnose an injury or illness. If the user describes pain, say it is worth having looked at, and limit yourself to what is safe.',
  '- Never say you are doing, opening, logging, setting or changing anything. You are text and one optional button; "I will open weight logging for you" is a promise the app does not keep, and the reader waits for a screen that never comes. Say what the button below does, or say where in the app it is done.',
  '',
  '# How to answer',
  '- Answer the question in the first sentence.',
  '- Answer the question that was asked: a nutrition question gets a nutrition answer, a measurement question a measurement answer — never a training summary the user did not ask for.',
  '- Every line must state a conclusion or an instruction the user could not read off their own screen. Numbers appear only as evidence for a claim — never recite a session\'s sets, a list of entries, or a series of dates back to the user; the app already shows them.',
  '- "Analyse" means: what improved, what stalled, what was unusual, and what to do about it — not a recap of what was done.',
  '- Two concrete actions beat ten: at most three reasons and two next steps. Give a number wherever a number is the answer.',
  '- Be brief: the takeaway is one or two sentences, and every reason and step is a single clause of at most ~15 words. Cut anything the reader did not ask for.',
  '- Fill `plan` only when the user asked for a plan or schedule; otherwise return it empty.',
  '- All weights are kilograms.',
  '- Answer in the language the user wrote in, and write numbers and dates the way that language does: Finnish uses a decimal comma (82,5 kg) and day.month dates (3.8.); English uses 82.5 kg and 3 Aug. Never write ISO dates such as 2026-08-03 in prose — the context uses them only as data.',
  '- Do not describe yourself, your context, or how you reasoned.',
  '',
  '# When you cannot answer',
  '- A coach asks before advising. When the context does not hold what an accurate answer needs, do not guess and do not fall back on a generic answer: ask exactly one short follow-up question, put that question in `takeaway`, leave `why`, `nextSteps`, `plan` and `assumptions` empty, and set `unanswered` to true.',
  '- One question, never two, and never a question plus an answer. It is the whole reply.',
  '- Ask only when the missing fact actually blocks the answer. If a useful answer exists from what you have, give it — asking instead of answering is evasion, and it is the more common failure.',
  '- Pair such a question with the matching `suggestion` so the reader can answer it with one tap — asking to log a chest measurement while offering no way to do it is a question that goes nowhere.',
  '- Prefer a question the app can act on: a measurement to log, a goal to set, a bodyweight to record. "Chest growth is measured, not guessed — shall we log your chest measurement now so there is a starting point?" beats "what do you mean by faster?".',
  '- Never set `unanswered` on a reply that does answer. The flag means the reader was asked something, not that the answer was short or uncertain.',
  '',
  '# Body, goals and nutrition',
  '- When the context lists goals, tie the answer to them: say where the user stands against the goal and name the one thing that moves it next.',
  '- Exactly one goal carries `isPrimary`. That is the goal a general question is answered against; the others are background you may mention only when they change the advice.',
  '- When goals pull against each other — a surplus for size and a deficit for fat loss cannot both be right — name the conflict in one sentence and ask which comes first, following "When you cannot answer". Do not split the difference, and do not quietly pick one.',
  '- A circumference goal is built from training volume, progression and food together — read the relevant lifts from the history when advising on it.',
  '- Check the levers for a growth goal in this order: progression, volume, frequency, food. The first three are readable from the log; advise on the earliest one the log shows lacking, and reach food only when the training levers look in order. Protein arithmetic is the cheapest answer to give, which is exactly why it must not be the default one.',
  '- Never repeat advice you already gave in this conversation. If the same question comes back, either the earlier advice has not been acted on yet — say so and ask about it — or it has, and the next lever is due.',
  '- Nutrition questions: general sports-nutrition knowledge is allowed here, but anchor every number to this user — protein 1.6–2.2 g per kg of their logged bodyweight, surplus or deficit according to their stated goal. If bodyweight is missing from the context, give the per-kg rule and note that logging bodyweight lets you compute it exactly.',
  '- Never prescribe a diet for a medical condition.',
  '',
  '# What the app itself can do',
  '- Vinha builds programmes, and you can start it: attach the `compose_programme` suggestion with a `brief`, and the button under your answer composes a week from the app\'s own exercise library for the reader to look at and save.',
  '- So never tell the reader a programme cannot be built, or that their only options are the ready-made list and editing what they have. Asked for a new programme, offer to build it. That is the answer — not a refusal.',
  '- Ask first only when the brief would be empty. One question — usually days per week, or what they want to focus on — then offer. Two rounds of questions before a button is an interrogation, and everything else the composer needs it already reads from their setup.',
  '- The app decides whether that button is included with their plan and says so under it. Do not discuss what is paid and what is free; you do not know their subscription.',
  '- Do not describe any other screen, button or menu path. You are told about this one because you were denying it existed; everything else you have not been told about, and guessing at it is inventing app behaviour. If the reader asks how to do something in the app that is not covered here, say plainly that you do not know that part rather than guessing, and never suggest reinstalling or updating the app.',
  '',
  '# Offering to do something',
  '- You may offer one action per answer, in `suggestion`, and only when the conversation led there — an offer bolted onto an unrelated answer is an advert.',
  '- Offer only what the App state section shows is missing. Never offer what is already on, and never offer a kind listed under "Do not offer": the reader has answered that question.',
  '- Most answers carry no suggestion at all. Leave it out unless it clearly helps.',
  '- The suggestion button is the only hand you have. Attach it and say what it does, rather than describing an action of your own.',
  '- When the reader asks you to record a number they stated — a bodyweight, a measurement — attach log_measurement with statKey, value and unit, and tell them the button below logs it. When they should record something but gave no number, attach log_measurement without a value: the button opens the recording page.',
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

/**
 * The photo-import request, which shares nothing with the other two modes but
 * the key, the budget and the rate limit: no prompt, no training context, just
 * a picture of a spreadsheet.
 */
interface ParsedImageBody {
  mode: 'table';
  mediaType: ProgramImageMediaType;
  dataBase64: string;
}

function parseImageBody(body: unknown): ParsedImageBody | null {
  const parsed = typeof body === 'string' ? JSON.parse(body) : body;
  if (!parsed || typeof parsed !== 'object') {
    return null;
  }
  const candidate = parsed as { mode?: unknown; mediaType?: unknown; dataBase64?: unknown };
  if (candidate.mode !== 'table' || !isProgramImageMediaType(candidate.mediaType)) {
    return null;
  }
  if (
    typeof candidate.dataBase64 !== 'string' ||
    !candidate.dataBase64 ||
    // Refused before it is sent upstream, so an oversized body is never
    // charged for. The client downscales; this is the backstop.
    candidate.dataBase64.length > PROGRAM_IMAGE_MAX_BASE64_CHARS
  ) {
    return null;
  }
  return { mode: 'table', mediaType: candidate.mediaType, dataBase64: candidate.dataBase64 };
}

/**
 * The open conversation, trimmed to what a follow-up actually needs.
 *
 * Three exchanges is enough for "entä sitten?" to have an antecedent, and the
 * cap matters: this rides in the uncached part of every request, so an
 * unbounded history would be paid for on every turn. Each side is clipped too
 * — a takeaway is one or two sentences by the rules, and anything longer is a
 * client that sent more than it should.
 */
const MAX_HISTORY_TURNS = 3;
const MAX_HISTORY_CHARS = 600;

function sanitizeHistory(value: unknown): AICoachConversationTurn[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const clean = value
    .filter((turn): turn is AICoachConversationTurn => {
      if (!turn || typeof turn !== 'object') {
        return false;
      }
      const record = turn as Partial<AICoachConversationTurn>;
      return (
        typeof record.question === 'string' &&
        typeof record.takeaway === 'string' &&
        record.question.trim().length > 0 &&
        record.takeaway.trim().length > 0
      );
    })
    .map((turn) => ({
      question: turn.question.trim().slice(0, MAX_HISTORY_CHARS),
      takeaway: turn.takeaway.trim().slice(0, MAX_HISTORY_CHARS),
    }));
  // Oldest first, so the newest exchanges are the ones kept.
  return clean.slice(-MAX_HISTORY_TURNS);
}

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
    history: sanitizeHistory(candidate.history),
    language: candidate.language === 'fi' || candidate.language === 'en' ? candidate.language : undefined,
    mode: candidate.mode === 'compose' ? 'compose' : 'advice',
    reporter: typeof candidate.reporter === 'string' && candidate.reporter.length <= 200 ? candidate.reporter : undefined,
    effortOverride:
      AI_COACH_DEBUG_TRANSCRIPTS
      && process.env.AI_COACH_DEBUG_TRANSCRIPTS === '1'
      && typeof candidate.effortOverride === 'string'
      && ['low', 'medium', 'high', 'off'].includes(candidate.effortOverride)
        ? candidate.effortOverride
        : undefined,
    modelOverride:
      AI_COACH_DEBUG_TRANSCRIPTS
      && process.env.AI_COACH_DEBUG_TRANSCRIPTS === '1'
      && typeof candidate.modelOverride === 'string'
      && /^claude-[a-z0-9.-]{2,40}$/.test(candidate.modelOverride)
        ? candidate.modelOverride
        : undefined,
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
  const { takeaway } = candidate;
  if (typeof takeaway !== 'string' || !takeaway.trim()) {
    return null;
  }
  // A list the model left out is an empty list, not an invalid answer:
  // Sonnet 5 omits `plan: []` when there is no plan to give, and the whole
  // answer fell back to preview over it (eval, 2026-08-23).
  const list = (value: unknown) => (isStringArray(value) ? value : value === undefined ? [] : null);
  const suggestion = validateSuggestion(candidate.suggestion);
  const why = list(candidate.why);
  const nextSteps = list(candidate.nextSteps);
  const plan = list(candidate.plan);
  const assumptions = list(candidate.assumptions);
  if (why === null || nextSteps === null || plan === null || assumptions === null) {
    return null;
  }

  // A follow-up question is not a billable answer. The client already reads
  // this flag and skips the free-tier charge; until now only the offline
  // preview ever set it, so a live "I need to know X first" cost a question
  // out of three a week. Carried through only when true, so an answer stays
  // the same object it was.
  return {
    takeaway,
    why,
    nextSteps,
    plan,
    assumptions,
    ...(candidate.unanswered === true ? { unanswered: true } : {}),
    ...(suggestion ? { suggestion } : {}),
  };
}

/**
 * Which part of the shape was wrong, as a field name and a reason.
 *
 * The log used to say only that a payload was invalid, plus the stop reason —
 * which answers "was it truncated?" and nothing else. A complete tool_use that
 * still fails validation left no way to tell an empty takeaway from a
 * malformed list (live eval, 25.8.), so the answer dropped to preview and the
 * cause stayed a guess.
 *
 * Field names and shapes only. Nothing the reader wrote or the model answered
 * goes into a log line.
 */
export function describeAnswerShape(payload: unknown): string {
  if (!payload || typeof payload !== 'object') {
    return `not-an-object:${typeof payload}`;
  }
  const candidate = payload as Partial<AICoachAdvice>;
  if (typeof candidate.takeaway !== 'string') {
    return `takeaway:${candidate.takeaway === undefined ? 'missing' : typeof candidate.takeaway}`;
  }
  if (!candidate.takeaway.trim()) {
    return 'takeaway:empty';
  }
  for (const field of ['why', 'nextSteps', 'plan', 'assumptions'] as const) {
    const value = candidate[field];
    if (value === undefined) {
      continue;
    }
    if (!Array.isArray(value)) {
      return `${field}:${typeof value}`;
    }
    if (!value.every((item) => typeof item === 'string')) {
      return `${field}:array-of-${[...new Set(value.map((item) => typeof item))].join('|')}`;
    }
  }
  return 'shape-ok';
}

/**
 * The offer, or nothing. An unknown kind is dropped rather than passed on: the
 * client draws a button per kind, and a button it cannot carry out would be a
 * promise the app does not keep.
 */
function validateSuggestion(value: unknown): AICoachSuggestion | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const candidate = value as Partial<AICoachSuggestion>;
  if (
    candidate.kind !== 'pin_stat_card' &&
    candidate.kind !== 'set_goal' &&
    candidate.kind !== 'weigh_in_reminder' &&
    candidate.kind !== 'log_measurement' &&
    candidate.kind !== 'compose_programme'
  ) {
    return null;
  }
  // A compose offer with no brief has nothing to hand the composer, and the
  // button would open an empty field — the retyping the offer exists to spare.
  const brief =
    typeof candidate.brief === 'string' && candidate.brief.trim() ? candidate.brief.trim().slice(0, 400) : null;
  if (candidate.kind === 'compose_programme' && !brief) {
    return null;
  }
  return {
    kind: candidate.kind,
    brief,
    statKey: typeof candidate.statKey === 'string' && candidate.statKey.trim() ? candidate.statKey.trim() : null,
    goalText: typeof candidate.goalText === 'string' && candidate.goalText.trim() ? candidate.goalText.trim().slice(0, 200) : null,
    // A reading is a small positive number. Anything outside that is a
    // malformed offer, and a button that would log garbage is dropped whole.
    value:
      typeof candidate.value === 'number' && Number.isFinite(candidate.value) && candidate.value > 0 && candidate.value < 1000
        ? candidate.value
        : null,
    unit: candidate.unit === 'cm' || candidate.unit === 'kg' || candidate.unit === '%' ? candidate.unit : null,
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
      buildAiCoachPreviewAnswer(input.prompt, input.context, input.language),
      'ANTHROPIC_API_KEY puuttuu. AI Coach preview-vastaus palautettiin sen sijaan.',
    );
  }

  // Build the context once: it is both what gets sent and what gets measured,
  // so the budget can never be checked against a different payload than the
  // one that actually goes out.
  const contextText = `# Training context\n\n${buildAiCoachSystemContext(input.context)}`;
  const now = Date.now();
  const budget = checkBudget(
    {
      // The conversation rides in the prompt half: it is uncached and paid
      // for on every turn, so it has to be measured with the question.
      promptChars:
        input.prompt.length +
        (input.history ?? []).reduce((total, turn) => total + turn.question.length + turn.takeaway.length, 0),
      contextChars: contextText.length + COACH_SYSTEM_RULES.length,
    },
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
      buildAiCoachPreviewAnswer(input.prompt, input.context, input.language),
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
        model: input.modelOverride ?? CLAUDE_MODEL,
        ...(input.modelOverride || input.effortOverride
          ? effortConfig(input.effortOverride ?? EFFORT_SETTING, input.modelOverride ?? CLAUDE_MODEL)
          : EFFORT_CONFIG),
        max_tokens: CLAUDE_MAX_TOKENS,
        // Rules first, then this user's training context. Two cache
        // breakpoints: the rules block is identical for every user, so it
        // hits across users; the context breakpoint adds same-conversation
        // follow-ups on top.
        system: [
          { type: 'text', text: COACH_SYSTEM_RULES, cache_control: { type: 'ephemeral' } },
          { type: 'text', text: contextText, cache_control: { type: 'ephemeral' } },
        ],
        tools: [
          {
            name: ADVICE_TOOL_NAME,
            description: 'Return coaching advice for the athlete described in the training context.',
            input_schema: AI_COACH_RESPONSE_SCHEMA,
            // The API validates the tool input against the schema before it
            // reaches us — required lists included.
            strict: true,
          },
        ],
        tool_choice: { type: 'tool', name: ADVICE_TOOL_NAME },
        // The open conversation as real turns, so "why?" and "and then?" have
        // something to refer back to. The earlier answers go back as their
        // takeaway alone — the reasons and steps were shown on screen, and
        // resending them would pay for the whole answer again every turn.
        messages: [
          ...(input.history ?? []).flatMap((turn) => [
            { role: 'user', content: turn.question },
            { role: 'assistant', content: turn.takeaway },
          ]),
          { role: 'user', content: input.prompt },
        ],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text();
      console.error('AI Coach upstream request failed', response.status, body.slice(0, 400));
      return createError(
        { code: 'UPSTREAM_ERROR', message: 'Claude request failed.' },
        buildAiCoachPreviewAnswer(input.prompt, input.context, input.language),
        'Live AI Coach ei vastannut oikein. Preview-vastaus palautettiin.',
      );
    }

    const payload = (await response.json()) as unknown;
    const parsed = validateAnswer(extractToolInput(payload));

    if (!parsed) {
      // Shape only, never content: the stop reason tells a truncated answer
      // (max_tokens) from a refused tool call, and that is the whole diagnosis.
      const meta = payload && typeof payload === 'object' ? (payload as { stop_reason?: string; content?: unknown[] }) : {};
      console.error(
        'AI Coach invalid answer payload',
        JSON.stringify({
          stop_reason: meta.stop_reason ?? null,
          blocks: Array.isArray(meta.content) ? meta.content.map((block) => (block as { type?: string }).type ?? '?') : null,
          shape: describeAnswerShape(extractToolInput(payload)),
        }),
      );
      return createError(
        { code: 'INVALID_RESPONSE', message: 'Claude returned an invalid schema payload.' },
        buildAiCoachPreviewAnswer(input.prompt, input.context, input.language),
        'Live AI Coach palautti virheellisen vastauksen. Preview-vastaus palautettiin.',
      );
    }

    return createSuccess(parsed, 'live');
  } catch (error) {
    const isAbort = error instanceof Error && error.name === 'AbortError';
    return createError(
      { code: isAbort ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_ERROR', message: isAbort ? 'Claude request timed out.' : 'Claude request failed.' },
      buildAiCoachPreviewAnswer(input.prompt, input.context, input.language),
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
        ...EFFORT_CONFIG,
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

/**
 * The photo-import mode: a picture of a spreadsheet in, the four columns the
 * CSV importer reads out.
 *
 * On-device OCR was the alternative and is the wrong tool — it reads
 * characters, not tables. This shares the coach's key, budget and rate limit
 * because it is the same spend from the same account.
 */
type TableResult =
  | AICoachAdviceError
  | { ok: true; source: 'live'; rows: ReturnType<typeof validateProgramTable> };

async function requestClaudeTable(input: ParsedImageBody): Promise<TableResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return createError({ code: 'MISSING_API_KEY', message: 'ANTHROPIC_API_KEY is not configured.' });
  }

  const now = Date.now();
  // Images are charged by area, not by characters. Base64 length is the only
  // size this endpoint can see, and ~750 base64 chars per token is the right
  // order of magnitude for a screenshot — enough for the brake to mean
  // something rather than to wave every image through as "0 chars of prompt".
  const budget = checkBudget(
    { promptChars: Math.round(input.dataBase64.length / 3), contextChars: PROGRAM_TABLE_RULES.length },
    budgetState,
    now,
    BUDGET_LIMITS,
  );
  if (!budget.allowed) {
    const rejection = budget.rejection;
    return createError({
      code: rejection?.reason === 'budget_exhausted' ? 'RATE_LIMIT' : 'BAD_REQUEST',
      message:
        rejection?.reason === 'budget_exhausted'
          ? 'Coach budget for this window is spent.'
          : 'Image is larger than the import endpoint accepts.',
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
        ...EFFORT_CONFIG,
        max_tokens: CLAUDE_MAX_TOKENS,
        system: [{ type: 'text', text: PROGRAM_TABLE_RULES }],
        tools: [
          {
            name: PROGRAM_TABLE_TOOL_NAME,
            description: 'Report the training programme visible in the image as rows.',
            input_schema: PROGRAM_TABLE_SCHEMA,
          },
        ],
        tool_choice: { type: 'tool', name: PROGRAM_TABLE_TOOL_NAME },
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: input.mediaType, data: input.dataBase64 },
              },
              { type: 'text', text: 'Report every exercise row in this programme.' },
            ],
          },
        ],
      }),
      signal: controller.signal,
    });
    if (!response.ok) {
      const body = await response.text();
      console.error('AI table upstream request failed', response.status, body.slice(0, 400));
      return createError({ code: 'UPSTREAM_ERROR', message: 'Claude request failed.' });
    }
    const rows = validateProgramTable(extractToolInput(await response.json(), PROGRAM_TABLE_TOOL_NAME));
    if (rows === null) {
      return createError({ code: 'INVALID_RESPONSE', message: 'Claude returned an invalid table payload.' });
    }
    return { ok: true as const, source: 'live' as const, rows };
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

  // The photo import is parsed first and separately: it carries no prompt and
  // no training context, so parseBody would reject it as malformed.
  let imageInput: ParsedImageBody | null = null;
  try {
    imageInput = parseImageBody(req.body);
  } catch {
    imageInput = null;
  }
  if (imageInput) {
    const ipForImage = getIpAddress(req);
    if (checkRateLimit(ipForImage).limited) {
      res.status(429).json(createError({ code: 'RATE_LIMIT', message: 'Too many requests. Try again shortly.' }));
      return;
    }
    const table = await requestClaudeTable(imageInput);
    if (table.ok === true) {
      res.status(200).json(table);
      return;
    }
    const tableFailure: AICoachAdviceError = table;
    const tableStatus =
      tableFailure.error.code === 'UPSTREAM_TIMEOUT'
        ? 504
        : tableFailure.error.code === 'RATE_LIMIT'
          ? 429
          : tableFailure.error.code === 'BAD_REQUEST'
            ? 400
            : 502;
    res.status(tableStatus).json(tableFailure);
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
        buildAiCoachPreviewAnswer(input.prompt, input.context, input.language),
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

  const startedAt = Date.now();
  const result = await requestClaude(input);
  // TEMPORARY transcript log — see src/lib/aiCoachDebug.ts. Question and
  // answer only; the training context is never logged. Stored in the same
  // private Blob store as the backups and read back by
  // scripts/coach-transcripts.cjs through api/transcripts.ts.
  if (AI_COACH_DEBUG_TRANSCRIPTS && process.env.AI_COACH_DEBUG_TRANSCRIPTS === '1') {
    const at = new Date();
    const day = at.toISOString().slice(0, 10);
    const pathname = `transcripts/${day}/${at.toISOString().replace(/[:.]/g, '-')}-${Math.random().toString(36).slice(2, 8)}.json`;
    try {
      await put(
        pathname,
        JSON.stringify({
          at: at.toISOString(),
          reporter: input.reporter ?? null,
          language: input.language,
          model: CLAUDE_MODEL,
          durationMs: Date.now() - startedAt,
          prompt: input.prompt,
          source: result.ok ? result.source : `error:${result.error.code}`,
          answer: result.ok ? result.answer : result.fallback ?? null,
        }),
        { access: 'private', contentType: 'application/json', addRandomSuffix: false },
      );
    } catch (error) {
      // The log must never cost the reader an answer.
      console.warn('transcript store failed', error instanceof Error ? error.message : error);
    }
  }
  if (result.ok) {
    res.status(200).json(result);
    return;
  }

  const status = result.error.code === 'UPSTREAM_TIMEOUT' ? 504 : result.error.code === 'RATE_LIMIT' ? 429 : 502;
  res.status(status).json(result);
}
