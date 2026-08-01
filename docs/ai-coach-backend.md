# Vinha AI backend setup

Last updated: 26 July 2026

This backend path is designed so that the app can work in two modes:
- preview mode: no backend configured, app stays local
- live mode: app calls your own endpoint, which calls Anthropic (Claude)

## Files
- <repo-root>\api\ai-coach.ts
- <repo-root>\src\lib\aiCoachClient.ts
- <repo-root>\src\lib\aiCoachPreview.ts
- <repo-root>\src\types\aiCoach.ts

## Environment variables
### App
Set this in the Expo environment for builds that should use live Vinha AI:
- `EXPO_PUBLIC_AI_COACH_API_URL=https://your-domain.example/api/ai-coach`

If this variable is missing, the app automatically falls back to local preview mode.

### Serverless endpoint
Set these on the server / deployment platform:
- `ANTHROPIC_API_KEY=...`
- `AI_COACH_CLAUDE_MODEL=claude-haiku-4-5-20251001` (optional)
- `AI_COACH_CLAUDE_MAX_TOKENS=700` (optional)
- `AI_COACH_RATE_LIMIT_MAX=12` (optional)
- `AI_COACH_RATE_LIMIT_WINDOW_MS=600000` (optional)
- `AI_COACH_CLAUDE_TIMEOUT_MS=12000` (optional)

Spend-control variables are listed under **Tuning** below.

## Why this model, and what it costs
Haiku 4.5 is the cheap tier, which is the right default: the reasoning here is
light because `trainingHistory.ts` has already done the arithmetic. The request
is mostly context, so the prompt cache does the heavy lifting — the rules and
the training context sit in one cached prefix, and follow-up questions inside a
conversation re-read it at the cache rate instead of the input rate.

## Spend controls (execution-plan A2)

Three layers, and it is worth being exact about what each one can actually
stop, because only one of them is a true ceiling.

**1. Per-request size bounds — enforceable, and the real lever.**
`src/lib/aiCoachBudget.ts` refuses a call whose prompt or context exceeds the
configured character limits, before any upstream request is made. The response
was already capped by `max_tokens`; this caps the input, which is the half that
carries eight weeks of training history and that a client could otherwise
inflate at will. An oversized request is rejected outright rather than charged
against the budget, so one bad client cannot starve everyone else.

**2. Per-instance token budget — a brake, not a ceiling.**
Spend is tracked in estimated tokens (input + capped output) against a rolling
window, and booked *before* the call so a timeout still counts. Be clear-eyed
about the limit of this: the endpoint is a stateless serverless function, so
the counter dies with the instance. A burst spread across cold starts slips
past it. It bounds a single warm instance; it does not bound your bill.

**3. Anthropic Console spend limit — the only real ceiling.**
Set a hard monthly limit on the API key in the Anthropic Console. This is a
manual step, it is not in code, and nothing in this repo can substitute for it.
**Do this before the endpoint is reachable by anyone but you.**

The per-IP rate limit above is unchanged and is likewise per-instance: a speed
bump against a single hammering client, not a spend control.

### Tuning
- `AI_COACH_MAX_PROMPT_CHARS=2000` (optional)
- `AI_COACH_MAX_CONTEXT_CHARS=24000` (optional)
- `AI_COACH_TOKEN_BUDGET=1500000` (optional, per instance per window)
- `AI_COACH_BUDGET_WINDOW_MS=3600000` (optional)

A zero, negative or unparseable value falls back to the default rather than
disabling the limit — a misconfigured deploy must not silently open the tap.

## Logging decision
Current decision:
- Prompt text is not intentionally logged by the endpoint.
- Training context is not intentionally logged by the endpoint.
- Generic error logging may still occur without prompt payloads.

## Flow
1. App collects prompt + limited training context.
2. App calls your own endpoint.
3. Endpoint applies a basic in-memory rate limit.
4. Endpoint checks the spend budget: an oversized prompt or context is refused
   before any upstream call, and the estimated cost is booked against the
   instance's token window.
5. Endpoint calls the Anthropic Messages API, forcing a tool call so the answer
   shape is enforced by the API rather than requested in prose.
6. If Claude fails, times out, or the budget refuses the call, the endpoint
   returns a preview fallback rather than an error at the user.
6. App renders either live or preview advice, plus a note when fallback is used.

## Important
This is a minimal Beta backend path.
If you enable it for public Play release, update:
- privacy policy
- Data Safety declarations
- any user-facing Beta disclosures
