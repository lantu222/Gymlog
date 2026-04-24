# AI Coach backend setup

Last updated: 26 March 2026

This backend path is designed so that the app can work in two modes:
- preview mode: no backend configured, app stays local
- live mode: app calls your own endpoint, which calls OpenAI

## Files
- D:\Gymlog\api\ai-coach.ts
- D:\Gymlog\src\lib\aiCoachClient.ts
- D:\Gymlog\src\lib\aiCoachPreview.ts
- D:\Gymlog\src\types\aiCoach.ts

## Environment variables
### App
Set this in the Expo environment for builds that should use live AI Coach:
- `EXPO_PUBLIC_AI_COACH_API_URL=https://your-domain.example/api/ai-coach`

If this variable is missing, the app automatically falls back to local preview mode.

### Serverless endpoint
Set these on the server / deployment platform:
- `OPENAI_API_KEY=...`
- `AI_COACH_OPENAI_MODEL=gpt-5.2` (optional)
- `AI_COACH_RATE_LIMIT_MAX=12` (optional)
- `AI_COACH_RATE_LIMIT_WINDOW_MS=600000` (optional)
- `AI_COACH_OPENAI_TIMEOUT_MS=12000` (optional)

## Logging decision
Current decision:
- Prompt text is not intentionally logged by the endpoint.
- Training context is not intentionally logged by the endpoint.
- Generic error logging may still occur without prompt payloads.

## Flow
1. App collects prompt + limited training context.
2. App calls your own endpoint.
3. Endpoint applies a basic in-memory rate limit.
4. Endpoint calls OpenAI Responses API with structured JSON output.
5. If OpenAI fails or times out, endpoint returns a preview fallback.
6. App renders either live or preview advice, plus a note when fallback is used.

## Important
This is a minimal Beta backend path.
If you enable it for public Play release, update:
- privacy policy
- Data Safety declarations
- any user-facing Beta disclosures
