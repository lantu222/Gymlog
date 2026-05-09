# Gymlog Project Context

Tama tiedosto on projektin "AI-muisti": lue tama ensin, jos et tunne aiempaa keskusteluhistoriaa.

## Project Purpose

Gymlog is a mobile-first workout planning and logging app. The product goal is to make training feel decisive and practical:

- recommend a useful plan from onboarding inputs
- let the user start, log, and finish workouts quickly
- preserve completed workout data for History and Progress
- provide AI Coach guidance without making the core app depend on a live AI backend

The app is currently focused on Android/Expo development, but the codebase is React Native and keeps iOS/web scripts available.

## Stack

- Expo `~55.0.6`
- React `19.2.0`
- React Native `0.83.2`
- TypeScript `~5.9.2`
- `phosphor-react-native` for icons
- `react-native-svg` for SVG rendering
- `@react-native-async-storage/async-storage` for local storage
- Node-based CommonJS tests under `tests/`
- Optional serverless AI Coach endpoint in `api/ai-coach.ts`

There is no Supabase/Next.js/Tailwind stack in this repo.

## Setup

Install dependencies:

```powershell
npm install
```

Start Expo:

```powershell
npm run start
```

Run on Android:

```powershell
npm run android
```

Run on iOS:

```powershell
npm run ios
```

Run on web:

```powershell
npm run web
```

Typecheck:

```powershell
npm run typecheck
```

Run unit tests:

```powershell
npm run test:unit
```

Build Android release:

```powershell
npm run android:release
```

Regenerate the free exercise library:

```powershell
npm run exercise:sync
```

## Important Decisions

- The app should work locally without a backend. AI Coach has preview mode when `EXPO_PUBLIC_AI_COACH_API_URL` is not configured.
- Live AI Coach should call a project-owned endpoint, which then calls OpenAI. Do not call OpenAI directly from the mobile app.
- Prompt text and training context should not be intentionally logged by the AI Coach endpoint.
- Product principle: one clear next action, visible reasoning, honest save state, and fast logging.
- Saved workout UX must be truthful: do not imply a workout was saved until persistence succeeds.
- Onboarding is treated as a plan-fit system, not just a first-run wizard.
- Home should act primarily as a launcher, not as a second discovery feed.
- Profile/settings should only expose controls that work now or are clearly framed as upcoming.
- Keep implementation close to the existing TypeScript/React Native patterns.

## Current Product Areas

- Onboarding and recommendation flow
- Ready program catalog and program detail screens
- Workout logging, validation, completion, and persistence
- History and Progress surfaces
- AI Coach preview/live guidance
- Profile/settings and launch-readiness documentation

## Current TODO List

Highest-priority roadmap items are documented in `docs/product-roadmap-phases.md`.

Phase 1: Trust and flow integrity

- Preserve origin-aware navigation through recommendation, detail, logging, summary, history, and progress flows.
- Make finish/save states explicit: saving, saved, failed, retry.
- Prevent empty or invalid sessions from looking like successful saves.
- Improve logger validation, skipped-exercise recovery, undo paths, and rest timer controls.
- Hide or wire settings that are not actually implemented.

Phase 2: Activation and plan fit

- Add a reusable setup/refine-plan entry after onboarding.
- Simplify the final plan-ready pacing.
- Clarify Home semantics between continue actions and browse actions.
- Add concise recommendation explanations.

Phase 3: Depth and retention

- Improve workout discovery with search and filters.
- Persist richer saved-session detail such as notes, swaps, partial completion, and useful set context.
- Improve History and Progress with highlights, trends, filters, and clearer tracked-exercise copy.
- Make AI Coach operational with scoped actions that can move users into real app flows.

Manual launch tasks are tracked in `docs/manual-launch-tasks.md`.

## Folder Structure

```text
D:\Gymlog
|-- App.tsx                         Main app shell, navigation, top-level flow wiring
|-- index.ts                        Expo entry point
|-- app.json                        Expo app metadata, Android package, icons, splash
|-- package.json                    Scripts and dependencies
|-- api\
|   `-- ai-coach.ts                 Optional serverless AI Coach endpoint
|-- assets\                         App icons, splash images, fitness imagery, custom SVG icons
|-- docs\                           Product, launch, AI, roadmap, onboarding, and planning docs
|-- scripts\                        Utility scripts such as exercise library generation
|-- src\
|   |-- assets\                     App asset registries
|   |-- components\                 Shared React Native UI components
|   |-- data\                       Seed data and generated exercise library
|   |-- features\workout\           Workout domain state, adapters, selectors, persistence
|   |-- hooks\                      Shared hooks
|   |-- lib\                        Product/domain logic and pure helpers
|   |-- navigation\                 Route definitions and route history helpers
|   |-- screens\                    App screens
|   |-- state\                      App provider and completed-workout persistence
|   |-- storage\                    Database/repository helpers
|   |-- theme.ts                    Shared theme values
|   `-- types\                      Shared TypeScript models
|-- tests\                          Node-based unit and integration tests
|-- tools\                          Local tooling
|-- outputs\                        Generated workbooks/outputs
`-- android\                        Native Android project for release builds
```

## AI Coach Backend

Relevant files:

- `api/ai-coach.ts`
- `src/lib/aiCoachClient.ts`
- `src/lib/aiCoachPreview.ts`
- `src/types/aiCoach.ts`

App environment variable for live mode:

```text
EXPO_PUBLIC_AI_COACH_API_URL=https://your-domain.example/api/ai-coach
```

Server environment variables:

```text
OPENAI_API_KEY=...
AI_COACH_OPENAI_MODEL=gpt-5.2
AI_COACH_RATE_LIMIT_MAX=12
AI_COACH_RATE_LIMIT_WINDOW_MS=600000
AI_COACH_OPENAI_TIMEOUT_MS=12000
```

If the app env var is missing, the app falls back to local preview mode.

## Coding Rules

- Use TypeScript for app code.
- Prefer pure helper functions in `src/lib` and cover them with focused tests under `tests/lib`.
- Keep React Native screens and components aligned with existing component patterns.
- Do not introduce backend coupling into the mobile app for AI features.
- Use existing theme/components before adding new styling systems.
- Keep product copy honest: no saved/completed state before the data is actually persisted.
- Avoid broad refactors when fixing a targeted flow.
- When changing behavior, add or update tests near the relevant domain logic.

## Useful References

- Roadmap: `docs/product-roadmap-phases.md`
- AI backend setup: `docs/ai-coach-backend.md`
- Manual launch tasks: `docs/manual-launch-tasks.md`
- Recommendation contract: `docs/recommendation-4-week-programme-contract.md`
- Premium adaptive coach plan: `docs/premium-adaptive-coach-plan.md`
