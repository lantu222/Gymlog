# GAINER AI backend setup

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
Set this in the Expo environment for builds that should use live GAINER AI:
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

## Why this model, and what it costs
Haiku 4.5 is the cheap tier, which is the right default: the reasoning here is
light because `trainingHistory.ts` has already done the arithmetic. The request
is mostly context, so the prompt cache does the heavy lifting — the rules and
the training context sit in one cached prefix, and follow-up questions inside a
conversation re-read it at the cache rate instead of the input rate.

The rate limit is per-IP and in-memory, which means it resets on every cold
start. It is a speed bump, not a spend ceiling. Before this endpoint is public,
it needs a real cap (see `execution-plan.md` A2).

## Logging decision
Current decision:
- Prompt text is not intentionally logged by the endpoint.
- Training context is not intentionally logged by the endpoint.
- Generic error logging may still occur without prompt payloads.

## Flow
1. App collects prompt + limited training context.
2. App calls your own endpoint.
3. Endpoint applies a basic in-memory rate limit.
4. Endpoint calls the Anthropic Messages API, forcing a tool call so the answer
   shape is enforced by the API rather than requested in prose.
5. If Claude fails or times out, endpoint returns a preview fallback.
6. App renders either live or preview advice, plus a note when fallback is used.

## Important
This is a minimal Beta backend path.
If you enable it for public Play release, update:
- privacy policy
- Data Safety declarations
- any user-facing Beta disclosures
