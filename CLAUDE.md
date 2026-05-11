# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```powershell
npm run start           # Expo dev server (scan QR to open on device)
npm run android         # Launch on Android emulator / device
npm run typecheck       # TypeScript type check (no emit)
npm run test:unit       # Run all unit tests (requires .test-dist to be up to date)
npm run android:release # Build signed Android APK via Gradle
npm run exercise:sync   # Regenerate src/data/generatedExerciseLibrary.ts
```

### Running tests

Tests import from `.test-dist/`, which is compiled separately from the main Expo build.
Compile first, then run:

```powershell
npx tsc -p tsconfig.test.json   # compile src/ -> .test-dist/
node tests/run-tests.cjs        # run all suites
```

`npm run test:unit` only runs the Node step — if you change `src/` files, recompile first.
To run a single suite, require it directly:

```powershell
node -e "const s = require('./tests/lib/workoutFlow.test.cjs'); s.forEach(t => t.run()); console.log('ok')"
```

## Architecture

### App shell

`App.tsx` is the single monolithic shell. It owns:
- All screen imports and conditional rendering
- In-memory `route` + `routeHistory` state
- Props passed into every screen (screens receive no props from React Navigation — there is no React Navigation)

This file is large. When changing screen-level routing, always edit `App.tsx`.

### Navigation

Custom flat navigation built on a plain array:
- Route type: `AppRoute` union in `src/navigation/routes.ts`
- Stack helpers: `pushRoute` / `popRoute` in `src/navigation/routeHistory.ts`
- Four tabs (`home | workout | progress | profile`), each with nested screens identified by `screen` key on the route object
- Back button pops the array; tab changes reset the nested screen to the tab's root route

### State layers

Two React context providers wrap the app:

**AppProvider** (`src/state/AppProvider.tsx`)
- Owns all persisted app data: preferences, custom workout templates, completed sessions, exercise logs, bodyweight/measurements
- Root type: `AppDatabase` in `src/types/models.ts`
- Persists to AsyncStorage key `@gymlog/database/v1`
- Exercise library is seeded on load but **stripped on save** (regenerated from `src/data/generatedExerciseLibrary.ts` each load)
- Access via `useAppContext()`

**WorkoutProvider** (`src/features/workout/WorkoutProvider.tsx`)
- Owns the live workout session state machine: `useReducer(workoutReducer, workoutInitialState)`
- All session mutations dispatch `WorkoutAction` — see `src/features/workout/workoutState.ts` for the full action union and reducer
- Persists active session + slot history to AsyncStorage key `@gymlog/workout/v1`
- Access via `useWorkoutContext()`

### Ready programs vs custom programs

- **Ready programs**: static `WorkoutTemplateV1[]` in `src/features/workout/workoutCatalog.ts`. Never written to AppDatabase.
- **Custom programs**: user-created, stored in `AppDatabase.workoutTemplates` via `workoutTemplateRepository` in `src/storage/repositories.ts`
- Routes distinguish them with `programType: 'ready' | 'custom'`

### Domain logic (`src/lib/`)

Pure TypeScript functions with no React dependencies. This is where all business logic lives. Key modules:

| Area | Files |
|---|---|
| Recommendation & onboarding | `recommendationScoring`, `recommendationProfile`, `recommendationProgramme`, `firstRunSetup`, `onboardingStructure` |
| Home decisions | `homePrimaryAction`, `homeProgramSelection`, `dashboard` |
| Workout session | `workoutFlow`, `workoutValidation`, `workoutLoggingSessionBootstrap`, `workoutLoggerNavigation` |
| AI Coach | `aiCoachClient`, `aiCoachPreview`, `aiCoachActions`, `aiTrainingContext`, `aiCoachPlan` |
| Progress & history | `historyView`, `progressionActivePlan`, `progressionSignal` |
| Formatting | `format`, `displayLabel` |

New domain logic belongs in `src/lib/` as a pure function, covered by a test in `tests/lib/`.

### Test conventions

Test files are CommonJS (`.cjs`) in `tests/`. Each file exports an array of suite objects:

```js
module.exports = [
  {
    name: 'describes what is tested',
    run() {
      const assert = require('node:assert/strict');
      // assertions — throws on failure
    },
  },
];
```

No test framework — only `node:assert/strict`. Tests import compiled output from `.test-dist/` (mirrors `src/` path structure). Add new suites to `tests/run-tests.cjs` to include them in `npm run test:unit`.

### Storage

| Key | Contents |
|---|---|
| `@gymlog/database/v1` | Full `AppDatabase` (minus exerciseLibrary which is stripped on write) |
| `@gymlog/workout/v1` | `WorkoutPersistenceBundle`: active session + slot history |

`src/storage/database.ts` normalizes all fields on load, providing safe defaults for missing or malformed stored values.

### AI Coach

The app works fully offline. AI Coach has two modes:
- **Preview mode** (default): local mock responses from `src/lib/aiCoachPreview.ts`
- **Live mode**: calls `EXPO_PUBLIC_AI_COACH_API_URL` → serverless endpoint in `api/ai-coach.ts` → OpenAI

Do not call OpenAI directly from the mobile app. See `docs/ai-coach-backend.md` for server setup.

## Key constraints

- All state flows through `AppProvider` or `WorkoutProvider` — no component-local persistence
- Saved workout UX must be truthful: do not show a success state before `saveCompletedWorkoutSession` resolves
- Use `src/theme.ts` colors and existing shared components in `src/components/` before adding new styling
- Keep `src/lib/` pure — no AsyncStorage, no React, no side effects
- Ready program templates in `workoutCatalog.ts` are immutable at runtime; duplication into custom templates is done via `src/lib/readyProgramDuplication.ts`
