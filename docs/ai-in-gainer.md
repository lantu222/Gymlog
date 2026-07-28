# What the AI actually does in GAINER

Last updated: 28 July 2026

One page, everything the words "AI" and "coach" refer to in this app: where it
appears, what data reaches it, what it is allowed to say, and what it cannot do.
Written to be checkable — every claim below points at the file that implements
it.

---

## The short version

Most of what feels like intelligence in GAINER is **not** a language model.
Programme selection, the composed week, progression, plateau detection and the
figures on the analysis screen are all deterministic code with tests. A model
is involved in exactly two places: the Coach chat, and the AI-assisted
programme setup. Everything else the model *appears* to know, it was told.

| Surface | Language model? | Where the logic lives |
|---|---|---|
| Programme recommendation | No | `recommendationWaterfall.ts`, `recommendationScoring.ts` |
| Composed week / day count | No | `programDayComposer.ts` |
| Exercise substitution for gear and injuries | No | `equipmentExerciseFilter.ts`, `cautionExerciseFilter.ts` |
| Focus-area emphasis | No | `focusEmphasis.ts` |
| Coach sheet's three modules | No | `aiCoachModules.ts` |
| Full analysis screen | No | `sessionAnalysis.ts` |
| Plateau / fatigue signals | No | `progressionAnalyzer.ts`, `fatigueModel.ts` |
| **Coach chat answers** | **Yes** | `api/ai-coach.ts` → Anthropic |
| **AI-assisted programme draft** | **Yes** (planned) | `aiCoachPlan.ts` |

`ADR-005` is the reason: programme selection must not require an LLM.
`ADR-001` is the other: nothing speaks during an active workout.

---

## Two modes, and how to tell which one you are in

**Preview (default).** No backend configured. Answers come from
`src/lib/aiCoachPreview.ts`, a local generator with no network access. The app
is fully usable offline in this mode. Preview answers are honest but generic:
they obey every rule below, but they cannot name your stalled lift because the
generator does not reason over your history.

**Live.** `EXPO_PUBLIC_AI_COACH_API_URL` is set. The app posts to your own
endpoint, which calls Anthropic. If that call fails, times out, or is refused
by the spend budget, the user gets the preview answer plus a note — never an
error screen.

> As of this writing the endpoint is **not deployed**, so every install is in
> preview mode and no user data leaves the device.

---

## What the model is told

The payload is built by `aiTrainingContext.ts` and serialized to text by
`aiCoachSystemContext.ts`. It is the user's training log, as figures:

- **Load** — sessions this week, ACWR and recovery *only when the history
  supports reading them* (see "confidence" below), sessions in the last 30 days.
- **Weeks** — the last eight weeks, one line each: sessions done, planned
  sessions when a schedule exists, volume. Weeks with no training are included,
  because a gap is the signal.
- **Sessions** — every session in the window: date, name, duration, sets,
  exercise count, volume. Capped at 24 with a `truncated` flag.
- **Lift trajectories** — per lift: first and latest top set, best, change over
  the window, span in days, the consecutive run of flat sessions, and the full
  top-set series.
- **Schedule** — planned days per week and adherence over the window.
- **Athlete profile** — the onboarding answers: goal, days, experience,
  equipment, recovery, must-include, avoid, limitations.

The numbers come from `trainingHistory.ts`, the same layer the coach sheet and
the analysis screen read, so the model and the UI can never disagree about the
same workout.

**What is deliberately not sent:** no name, no email, no device identifier, no
bodyweight history, no measurements, no free-text notes. Exercise and session
names are sent as stored (English identifiers).

---

## What the model is allowed to say

The rules live in `COACH_SYSTEM_RULES` in `api/ai-coach.ts` and are the
contract, not a suggestion:

- **Never state a number, session, exercise or date that is not in the
  context.** No estimating, no filling a gap with what is typical.
- **When the context marks something unreadable, say nothing about it.** A
  single logged session produces an alarming ACWR out of arithmetic alone; the
  context says "too little history — do not comment on fatigue" and the model
  is told to obey it.
- **Cite the actual figures.** "Your squat went 100 → 102.5 kg over three
  sessions", not "you're progressing nicely".
- **A lift up over the window but flat recently is stalled** — say so; the
  recent stall is the actionable half.
- **Never diagnose.** Pain gets "worth having looked at" and nothing more.
- **Silence is a valid answer** (`ADR-003`). When there is nothing worth
  saying, say the small true thing.
- Answer in the user's language. Weights are kilograms.

The answer shape is enforced by the API through a forced tool call, so a model
that ignores the format fails validation rather than reaching the user as prose.

---

## The honesty machinery, and why it exists

Every AI-adjacent surface in this app has been caught lying at least once, and
each fix left a guard behind:

| What lied | Fix | Guard |
|---|---|---|
| Seed data invented six workouts and a PR history for every new install | `5646de4` | test asserts first launch is empty |
| Fatigue model called one logged session "well above the safe zone" | `confident` flag on `FatigueResult` | preview + prompt both gated on it |
| Coach sheet would have shown the handoff mock's canned figures | modules return `null` when data is thin | test fails if `6240`/`72.5`/`+8%` appear in a builder |
| Plan composer produced exercises named "Arms", "Core", "Easy cardio" | `catalogExercisePools.ts` | every pooled name checked against the 873-exercise library |
| Health Connect screen showed fabricated body data as an import | real Health Connect read | empty store now says so |
| Recommendation reasons were English prose for Finnish users | i18n keys | sweep over every rule asserts a real key |

The pattern: **when the data cannot support a claim, the surface returns null
and the UI says why.** That is the whole product thesis — an app whose only job
is an honest training log cannot invent a kilogram.

---

## Measuring whether the coach is any good

`scripts/eval-ai-coach.cjs` scores the coach against a set of cases with
hand-written expectations (`aiCoachEvalCases.ts`). Every check is mechanical —
no model grades another model:

- **grounded** — every figure in the answer traces to the context, except
  prescriptions the case declares
- **cites / mentions** — the figures and subjects a good answer must reach for
- **avoids** — claims this history does not license
- **abstains** — silence where silence is honest

```bash
npx tsc -p tsconfig.test.json
node scripts/eval-ai-coach.cjs          # offline preview
node scripts/eval-ai-coach.cjs --live   # deployed endpoint, costs money
```

Current baseline: **the offline preview scores 84%.** It passes every honesty
rule and fails only the two checks that require actually reading the history —
naming the stalled lift and citing its weight. That is the number the live
coach has to beat, and the reason the harness exists.

The seed set is five synthetic-but-real-shaped cases. `execution-plan.md` A3
asks for 20–30 **real anonymised** histories with hand-written expectations;
those are still missing and are the half that matters, because synthetic cases
only test rules we already knew to write down.

---

## Cost controls

Three layers, only one of which is a real ceiling — see
`ai-coach-backend.md` for the full treatment:

1. **Per-request size bounds** (`aiCoachBudget.ts`) — enforceable, and the real
   lever. An oversized prompt or context is refused before any upstream call.
2. **Per-instance token budget** — a brake. Serverless is stateless, so the
   counter dies with the instance.
3. **Anthropic Console spend limit** — the only true ceiling. Manual, not in
   code, and required before the endpoint is reachable by anyone but you.

Model: Haiku 4.5. The reasoning is light because `trainingHistory.ts` already
did the arithmetic; the request is mostly context, and the rules plus the
history sit in one cached prefix so follow-up questions in a conversation
re-read it at the cache rate.

### What it actually costs

Measured, not estimated. `scripts/simulate-coach-cost.cjs` builds real
training histories, serializes them with the same `buildAiCoachSystemContext`
the endpoint sends, and prices the result through `aiCoachCostModel.ts`:

| Context | Chars | ~Tokens | Share of the 24 000-char cap |
|---|---|---|---|
| Brand new, no history | 364 | 104 | 2% |
| First month, 3×/wk | 2 493 | 713 | 10% |
| Full 8-week window, 4×/wk | 4 214 | 1 204 | 18% |
| Heavy logger, 8 wk, 6×/wk, 9 lifts | 5 431 | 1 552 | 23% |

Cost per Pro user per month, full-window context:

| Engagement | Per user / month |
|---|---|
| Light — 4 conversations, 1 question each | $0.017 |
| Typical — 12 conversations, 2 questions | $0.075 |
| Power user — 40 conversations, 3 questions | $0.33 |
| At the rate limit every single day, max output | $1.44 |

Three things worth knowing, because they are not what you would guess:

- **The fixed overhead is bigger than most users' history.** The coach rules
  plus the tool schema are ~791 tokens on every call, against 104–1 204 tokens
  of training context. Trimming the system prompt is a larger lever than
  trimming what the user logged.
- **The prompt cache costs money on single-question conversations.** A cache
  write is 1.25× input; break-even is 2 questions inside the 5-minute window.
  Kept anyway, because the surcharge is ~$0.0006 and follow-ups are common —
  but it is a surcharge, not a saving, for a user who asks once and closes the
  sheet.
- **The worst case is survivable.** Even if every subscriber hammered the rate
  limit daily with maximum-length answers, the model is 18% of revenue at
  $7.99/month. The tier is not cost-constrained; it is trust-constrained.

Re-run it after any change to the system rules, the context serializer, or the
model:

```bash
npx tsc -p tsconfig.test.json && node scripts/simulate-coach-cost.cjs
```

Prices in `aiCoachCostModel.ts` are a constant, not a fact. Check them against
anthropic.com/pricing before quoting a figure from this table.

---

## What it does not do

- No AI during an active workout (`ADR-001`).
- No AI in programme selection (`ADR-005`).
- No training on user data. Nothing is stored server-side; the endpoint holds
  no database.
- No medical claims, no diagnosis, no injury assessment.
- No prediction of future results. The app reports what was logged and what a
  plan calls for; it does not forecast a one-rep max or a body-composition date.

---

## Files, if you want to read the code

| File | Owns |
|---|---|
| `src/lib/trainingHistory.ts` | The numeric layer: volume, trajectories, adherence |
| `src/lib/aiTrainingContext.ts` | Assembles the payload |
| `src/lib/aiCoachSystemContext.ts` | Serializes it to the text the model reads |
| `api/ai-coach.ts` | Endpoint, system rules, forced tool call, budget check |
| `src/lib/aiCoachBudget.ts` | Spend controls |
| `src/lib/aiCoachCostModel.ts` | What a call costs, and whether caching pays |
| `scripts/simulate-coach-cost.cjs` | Measures real contexts and prices them |
| `src/lib/aiCoachPreview.ts` | Offline answers |
| `src/lib/aiCoachModules.ts` | Coach sheet's three modules (no model) |
| `src/lib/sessionAnalysis.ts` | Full analysis screen (no model) |
| `src/lib/aiCoachEval.ts` | Scoring |
| `src/lib/aiCoachEvalCases.ts` | The evaluation set |
| `docs/ai-trust-system.md` | Trust philosophy and notification rules |
| `docs/adr/ADR-001-no-in-session-ai.md` | Why nothing speaks mid-workout |
| `docs/adr/ADR-003-silence-as-default.md` | Why `null` is the right default |
| `docs/adr/ADR-005-deterministic-recommendation.md` | Why selection needs no LLM |
