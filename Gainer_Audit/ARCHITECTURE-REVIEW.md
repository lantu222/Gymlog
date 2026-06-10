# GAINER (Gymlog) — Architecture & Scalability Review

**Reviewer role:** Senior startup CTO / software architect
**Date:** 4 June 2026
**Stack:** React Native 0.83 · Expo SDK 55 · React 19 · TypeScript 5.9 · AsyncStorage · no backend
**Target to support:** 100,000 users · 1,000,000 logged workouts · AI coaching · premium subscriptions · future web
**Tone:** brutally honest, as requested — but fair. There is genuinely good engineering here, and there are a few decisions that will stop this product cold if it actually reaches the stated scale.

---

## The one-paragraph verdict

GAINER has a **professional-grade domain layer and test culture** wrapped around a **hobby-grade persistence and shell architecture**. `src/lib/` is 62 pure, tested functions (60+ test suites) — that is the part most startups get wrong and you got right. But the entire user database is held in memory as one object and rewritten as a **single JSON blob to AsyncStorage on every keystroke-level mutation**, there is **no backend at all**, navigation is **hand-rolled with no URL model**, and the UI lives in **multi-thousand-line screen files** (one is ~12,000 lines). As built, the app is excellent for a single user with a few hundred workouts and **structurally incapable** of the 100k-user / 1M-workout / web / subscription product described. None of this is fatal — the clean `lib/` layer is exactly what makes the rework feasible — but the next 6 months need to be about the foundation, not features.

**Scores:** Architecture **5/10** · Scalability **3/10** · Maintainability **5/10** (details and reasoning below).

---

## What's genuinely good (so we're being fair)

- **Domain logic is pure and isolated.** `src/lib/` (62 files, ~12.4k LOC) has no React, no storage, no side effects — recommendation scoring, progression, fatigue model, insights, dashboard. This is textbook and rare.
- **Test discipline is real.** 64 test files / ~62 suites, including an integration test for the save pipeline (`tests/integration/liveWorkoutSavePipeline.test.cjs`). Business logic is covered.
- **Offline-first actually works.** Everything functions with no network; AI degrades to a local preview. That's a deliberate, well-executed property.
- **Type safety is strong.** Routes are a discriminated union (`src/navigation/routes.ts`); the storage layer (`src/storage/database.ts`) defensively normalizes every field on load.
- **Correct secret boundary.** OpenAI is server-side only (`api/ai-coach.ts`); the client never holds the key.
- **Context values are memoized** (`useMemo` in both providers).

Hold onto all of this during the rework. It's the reason the rework is a refactor and not a rewrite.

---

# Findings by dimension

Each issue: **Severity · Business impact · Technical impact · Recommended solution.**

---

## A. Data flow & storage — the load-bearing problem

### A1. The whole database is one in-memory object serialized to one AsyncStorage key on every mutation
**Severity: Critical**
**Files:** `src/state/AppProvider.tsx:210-214` (`commit` → `setDatabase` + `saveDatabase`), `src/storage/database.ts` (`saveDatabase` = `AsyncStorage.setItem('@gymlog/database/v1', JSON.stringify({...database, exerciseLibrary: []}))`)

Every change — logging a set, toggling a preference, renaming a template — calls `commit(nextDatabase)`, which replaces the entire React state object **and** `JSON.stringify`s the **entire** `AppDatabase` (all `workoutSessions` + all `exerciseLogs` + everything) into a single string written to one AsyncStorage key. There is no debounce, no partial write, no pagination, no indexing.

- **Business impact:** The product literally cannot hit "1,000,000 workouts." Long before that, active users will experience multi-hundred-millisecond UI stalls on every set logged, then data-loss/crashes as the blob exceeds AsyncStorage's default Android size limit (~6 MB; a power user hits this in a year or two). The core promise — "your workout is saved truthfully" — breaks at exactly the moment a user is most invested (months of history). This is churn and 1-star reviews.
- **Technical impact:** Write cost is **O(total history)** per mutation, not O(change). Launch cost is a full parse + full `normalizeDatabase` pass over all history (also O(n), every cold start). Memory is unbounded — all history lives in RAM. The single key is a serialization bottleneck and a single point of corruption.
- **Recommended solution:** Move to a **real on-device database with row-level reads/writes and indexes**: SQLite via `op-sqlite`/`expo-sqlite`, or a sync-capable engine (**WatermelonDB**, **PowerSync**, **Replicache**, or **Legend-State**). Persist sessions/logs as rows; keep only working sets and aggregates in memory; paginate history and progress queries. Make writes append-only at the row level (you already treat history as append-only conceptually — §9.4 of your own scope). This single change unlocks the scale target.

### A2. There is no backend, no sync, and no server data model
**Severity: Critical (relative to the stated goals)**
**Files:** whole repo; only network surface is the stateless `api/ai-coach.ts`

The app has zero server-side persistence. That's fine for an offline tracker — but **every one of your stated goals requires a backend**: 100k users (support/analytics), 1M workouts (durable storage/backup), premium subscriptions (entitlement validation — see also the security audit's F6), AI coaching (server-side user history/compute/memory), and a web version (shared data across devices).

- **Business impact:** Without a backend you cannot validate subscriptions (revenue leaks), cannot offer multi-device or web (a stated goal), cannot recover a user's data if they lose their phone (trust killer), and cannot do real AI personalization. This is the single biggest gap between "what exists" and "what the brief asks for."
- **Technical impact:** Retrofitting sync onto an app that was never designed for it is one of the hardest migrations in mobile. Conflict resolution, identity, and migration of existing local-only data all have to be invented at once.
- **Recommended solution:** Stand up a backend now, even minimally. Given the offline-first requirement, choose a **sync engine rather than a naive REST CRUD layer**: Supabase (already named as the intended direction in `docs/mvp-launch-scope.md` §9.1) + a sync layer (PowerSync/Replicache/WatermelonDB sync), or Firebase/Firestore. Pair it with real auth (the security audit's F5). Decide this **before** A1's local DB choice, because the local DB should be the sync engine's client.

### A3. No schema migration framework; normalization is an implicit migration that runs every launch
**Severity: High**
**File:** `src/storage/database.ts` (`normalizeDatabase`, key `@gymlog/database/v1`)

The `v1` key implies versioning, but there is no migration system. `normalizeDatabase` re-derives/repairs the entire DB on every load — it's both your de-facto migration and a startup cost (O(total data)). A breaking schema change has no safe upgrade path.

- **Business impact:** A future schema change risks silently dropping or corrupting users' history on app update — the worst possible bug for a tracker.
- **Technical impact:** Normalization-on-every-load doesn't scale (see A1) and can't express irreversible migrations.
- **Recommended solution:** Introduce explicit, versioned migrations (trivial once on SQLite — use the DB's `user_version`/migration runner). Run migrations once on upgrade, not normalization on every load.

---

## B. App shell & maintainability

### B1. Monolithic `App.tsx` + multi-thousand-line screens
**Severity: High**
**Files:** `App.tsx` (2,957 LOC — all routing, screen wiring, handlers, prop drilling), `src/screens/OnboardingScreen.tsx` (**11,965 LOC**), `ProgressScreen.tsx` (3,490), `WorkoutEditorScreen.tsx` (2,645), `WorkoutLoggingScreen.tsx` (1,920), `WorkoutsScreen.tsx` (1,832), `HomeScreen.tsx` (1,083)

`src/screens` is 31k LOC across 26 files — the UI is where the complexity concentrated, and it concentrated badly. A ~12k-line onboarding screen is not maintainable by a team; it's a merge-conflict magnet and effectively unreviewable. `App.tsx` is the single chokepoint for all navigation and handler wiring.

- **Business impact:** Slow feature velocity and high bug rate as you add engineers. Onboarding a new dev to a 12k-line file costs days. Two people can't safely work in the same screen.
- **Technical impact:** Prop drilling from `App.tsx` into every screen; no route-level code splitting; impossible to lazy-load; logic and presentation interleaved so the good `lib/` separation doesn't extend to the view layer.
- **Recommended solution:** Decompose screens into a screen container (data/wiring) + small presentational components; extract the onboarding flow into per-step components driven by a state machine (the structure already exists in `src/lib/onboardingStructure.ts` — lean on it). Set a lint budget (e.g. warn > 400 LOC/file). Move handler logic out of `App.tsx` into hooks/feature modules.

### B2. Hand-rolled navigation with no URL model
**Severity: High** (Medium for native-only; High given the web goal)
**Files:** `src/navigation/routes.ts`, `src/navigation/routeHistory.ts` (`isSameRoute` compares via `JSON.stringify`)

Navigation is a custom in-memory array of route objects, compared with `JSON.stringify` (order-dependent, fragile). There's no URL/path model, no deep linking (explicitly deferred in scope), no native-stack optimizations, no transition/gesture handling.

- **Business impact:** **The future web version is blocked** — web needs URL-addressable routes (shareable links, back/forward, SEO). Deep links (push notifications, marketing, "resume your workout") are impossible today. This will force a navigation rewrite right when you're trying to ship web.
- **Technical impact:** Reinventing history/stack semantics by hand; `JSON.stringify` equality is brittle; no integration with native screen lifecycle; no analytics screen-tracking hook point.
- **Recommended solution:** Adopt **Expo Router** (file-based, URL-native, works on web and native) or React Navigation + linking config. Your route union maps cleanly onto typed routes. Do this before the web build; doing it after means migrating screens twice.

### B3. Single global context re-renders all consumers
**Severity: Medium**
**File:** `src/state/AppProvider.tsx` (`setDatabase(nextDatabase)` replaces the whole object each mutation)

The memoized `value` helps, but because the database object is replaced on every change, **every** component using `useAppContext()` re-renders on **any** change (a preference toggle re-renders the logging screen). With the giant screens in B1, that's expensive.

- **Business impact:** Jank on mid/low-end Android (your largest user segment at 100k scale), perceived as "the app is slow."
- **Technical impact:** No selector granularity; context is all-or-nothing.
- **Recommended solution:** Split contexts by concern, or move to a selector-based store (**Zustand**/**Jotai**/Legend-State) so components subscribe only to the slices they use. This pairs naturally with the A1 DB change (store holds working state + query results, not the whole world).

---

## C. Performance

### C1. Lists rendered with `.map()` inside `ScrollView` — no virtualization
**Severity: High (at scale)**
**Evidence:** 25 files use `ScrollView`, only 2 use `FlatList`/`SectionList`; 21 screen files use `.map()`. History/Progress are derived from full workout history.

Rendering history or progress as `.map()` inside a `ScrollView` mounts every row at once. At a few dozen sessions it's fine; at thousands it's dropped frames and out-of-memory on Android.

- **Business impact:** The most engaged users (most history) get the worst performance — backwards incentive.
- **Technical impact:** No row recycling/windowing; whole list in the view tree.
- **Recommended solution:** Virtualize long/unbounded lists with **FlatList** or **FlashList** (Shopify) + stable `keyExtractor` + memoized row components. Combine with paginated DB queries (A1) so you never load the full history into JS.

### C2. 24,368-line generated exercise library bundled and seeded into memory
**Severity: Medium**
**File:** `src/data/generatedExerciseLibrary.ts` (24,368 LOC), seeded in `src/storage/database.ts` (then stripped on save)

The full exercise DB is a static TS module parsed into the JS bundle and held in memory. It inflates bundle size and startup parse time and can't be updated without an app release.

- **Business impact:** Slower cold start (first impression), larger download, and content fixes require store review cycles.
- **Technical impact:** Large bundle; memory resident; the seed/strip/merge dance on every load (`mergeExerciseLibrary`) is extra work.
- **Recommended solution:** Acceptable for v1 (your scope Rule 10 keeps it static deliberately). For scale, ship it as a bundled JSON asset loaded lazily, or as a versioned remote pack fetched and cached on the device DB — so content updates don't need a release.

### C3. 1-second global `setInterval` tick
**Severity: Low**
**File:** `src/features/workout/WorkoutProvider.tsx` (`setInterval(... 'session/tick' ..., 1000)`)

A 1s tick dispatches into the reducer continuously while hydrated, even when no rest timer is running, nudging re-renders every second.

- **Business/Technical impact:** Minor battery/CPU and re-render churn; negligible now, wasteful at scale.
- **Recommended solution:** Run the interval only while a timer is actually active; derive elapsed time from timestamps instead of ticking state.

---

## D. Error handling & resilience

### D1. No React error boundary and no crash reporting
**Severity: High**
**Evidence:** `grep` for `ErrorBoundary`/`componentDidCatch`/`getDerivedStateFromError` → none. Only 11 files contain `catch`. No Sentry/Crashlytics.

A render error anywhere drops the user to a white screen with no recovery, and **you'll never know it happened** — there's no crash telemetry.

- **Business impact:** Silent crashes = silent churn. At 100k users you're flying blind on stability; you can't prioritize fixes you can't see.
- **Technical impact:** No fault isolation; one bad component takes down the tree; no stack traces from the field.
- **Recommended solution:** Add a top-level **ErrorBoundary** (plus per-tab boundaries) with a recovery action, and integrate **Sentry** (`@sentry/react-native`) for crashes + performance. The storage layer's try/catch is good; extend the same discipline to the view layer.

---

## E. Analytics readiness

### E1. No analytics instrumentation exists
**Severity: High (for the business)**
**Evidence:** no analytics SDK, no event tracking in code; `docs/mvp-launch-scope.md` §10 carefully defines the metrics that matter (onboarding completion, session start/finish rate, D7/D30 retention) — none are wired.

You wrote an excellent metrics spec and implemented none of it.

- **Business impact:** You cannot answer the only question that matters at launch ("do users complete the loop and come back?"). Product decisions will be guesswork; fundraising/board metrics won't exist.
- **Technical impact:** No event taxonomy, no screen tracking hook (worsened by custom navigation, B2), no funnel.
- **Recommended solution:** Add a privacy-respecting analytics layer (PostHog or Amplitude; both have RN SDKs and self-host/EU options) behind a thin `track(event, props)` wrapper so it's swappable and testable. Instrument exactly the §10 events — no more. Add screen tracking at the (new) navigation layer. Honor the §10.4 privacy-first stance (aggregate, opt-in, disclosed).

---

## F. Reusability & maintainability (code quality)

### F1. Strong logic reuse, weak UI reuse
**Severity: Medium**
**Files:** `src/lib/` (excellent reuse) vs `src/screens/` (31k LOC, lots of inline UI/logic/styles); `src/components/` (41 files, 10k LOC) is decent but under-leveraged given screen sizes.

Business logic is beautifully reusable; the view layer is not. The giant screens (B1) almost certainly duplicate layout/section patterns that should be shared components.

- **Business impact:** UI changes are slow and inconsistent; design-system drift across screens.
- **Technical impact:** Duplication, higher change-amplification, harder theming.
- **Recommended solution:** Invest in a small design-system layer (you already have `src/theme.ts` and `MainScreenPrimitives`); extract repeated section/card/list patterns; enforce composition over monolith screens (ties to B1).

---

## G. Offline support & future AI/web

### G1. Offline is a strength but uses a non-syncable store
**Severity: Medium (strategic)**
Offline-first is done well, but on a store (AsyncStorage blob) that has no sync story. When you add the backend (A2), you'll want offline writes to reconcile with the server.
- **Recommendation:** Choose the local DB in A1 to be the **client of your sync engine** (WatermelonDB/PowerSync/Replicache/Legend-State all do offline-first sync). That preserves the offline strength and makes the backend additive instead of a rewrite.

### G2. AI is a stateless proxy — no server-side user memory
**Severity: Medium (for the AI roadmap)**
**Files:** `api/ai-coach.ts`, `src/lib/aiTrainingContext.ts`
The AI endpoint is stateless: the client ships a context snapshot each call. Real "coaching" (longitudinal memory, plan adaptation, weekly summaries) needs server-side history and compute — which needs A2.
- **Recommendation:** Once the backend exists, move training context assembly server-side, add per-user state/embeddings for retrieval, and keep the strict JSON-schema contract. Add cost controls and auth first (see the security audit's F7/F8).

### G3. Web version is blocked by current choices
**Severity: Medium (strategic)**
Blocked by custom navigation (no URLs, B2), AsyncStorage scale (A1), and no shared backend (A2). Expo supports web, but these three must be resolved first.
- **Recommendation:** Sequence web after Expo Router + backend + DB are in place; then the web build is mostly free from the shared Expo/React codebase.

---

# Required deliverables

## 1. Architecture Score: **5 / 10**
A tale of two codebases. The domain layer (pure `lib/`, tests, types, offline design) is 8/10 work. The shell, persistence, and navigation are 3/10 for the stated ambition. Averaged and weighted toward the foundation that has to carry the product: **5**. The score is held up by how cleanly the good parts are separated — that's what makes 8 reachable.

## 2. Scalability Score: **3 / 10**
Honest and unsentimental: as built, the app **cannot** reach 1M workouts or 100k synced/web/subscribed users. The single-blob AsyncStorage model (A1), absent backend (A2), and non-virtualized lists (C1) are hard ceilings, not tuning problems. It scales fine to one user with a few hundred workouts. **3**, and the 3 is for the offline design and pure logic being scale-friendly once the storage/back end are fixed.

## 3. Maintainability Score: **5 / 10**
The test suite and `lib/` factoring would be an 8 on their own. The 12k-line onboarding screen, 3k-line screens, 3k-line `App.tsx`, prop drilling, and brittle custom navigation pull it down to **5**. Fixing B1/B2 alone moves this to ~7.

---

## 4. Top 20 improvements — ranked by impact

| # | Improvement | Sev | Primary impact |
|---|---|---|---|
| 1 | Replace single-blob AsyncStorage with an indexed/sync local DB (SQLite/WatermelonDB/PowerSync) | Critical | Unblocks 1M-workout scale; kills write-stall + data-loss risk (A1) |
| 2 | Stand up a backend + auth + sync (Supabase/PowerSync) | Critical | Enables premium validation, multi-device, web, AI memory, backup (A2) |
| 3 | Add real subscription entitlement (IAP + server validation) | Critical | Protects revenue; removes free-premium toggle (A2 + security F6) |
| 4 | Add crash reporting + top-level error boundaries (Sentry) | High | Visibility into stability; stops silent white-screen churn (D1) |
| 5 | Instrument the §10 analytics events (PostHog/Amplitude) | High | You can finally measure retention/funnel — the launch KPI (E1) |
| 6 | Virtualize long lists (FlatList/FlashList) + paginate queries | High | History/Progress stay smooth as data grows (C1) |
| 7 | Migrate to Expo Router (URL-native navigation) | High | Unblocks web + deep links; removes brittle custom nav (B2) |
| 8 | Decompose `App.tsx` and the giant screens | High | Team velocity, reviewability, fewer merge conflicts (B1) |
| 9 | Introduce explicit, versioned DB migrations | High | Prevents data loss on schema upgrades (A3) |
| 10 | Selector-based state (Zustand/Jotai) to kill global re-renders | Medium | Smoother UI on low-end Android (B3) |
| 11 | Encrypt sensitive data at rest (keystore/SQLCipher) | High | Privacy/GDPR (cross-ref security audit F3) |
| 12 | Refactor onboarding (11,965 LOC) into a state-machine flow | High | Removes the single worst maintainability hotspot (B1) |
| 13 | Move AI context assembly server-side w/ per-user memory | Medium | Real coaching, not snapshot prompting (G2) |
| 14 | Extract a design-system layer; dedupe screen UI | Medium | Consistency + faster UI changes (F1) |
| 15 | Ship exercise library as lazy asset / remote pack | Medium | Smaller bundle, faster cold start, content updates w/o release (C2) |
| 16 | Add CI (typecheck + tests + lint + size budget) on PRs | Medium | Protects the good test culture as the team grows |
| 17 | Add component/integration tests for critical screens | Medium | Coverage currently logic-only; protect the save/log UI flows |
| 18 | Scope the 1s timer to active rest only; timestamp-derive | Low | Battery/CPU/re-render hygiene (C3) |
| 19 | Add E2E smoke tests (Maestro/Detox) for the core loop | Medium | Guards the "log → save → history" promise across releases |
| 20 | Define an event/error taxonomy + privacy data map | Medium | Foundations for analytics, GDPR, and support at 100k scale |

(Items 1, 2, 3, 11 are shared with or reinforce the separate security/privacy audit — sequence them together.)

---

## 5. Technical roadmap — next 12 months

### Q1 (Months 0–3) — Foundation: don't add features, add a floor
- **Decide the data architecture** (backend + sync engine + local DB) as one coupled decision (#1, #2). Recommended: Supabase (Postgres + auth) with PowerSync or WatermelonDB sync; local store becomes the sync client.
- Migrate persistence off the single AsyncStorage blob to the indexed local DB, with **explicit migrations** and a safe one-time import of existing local data (#1, #9).
- Add **Sentry** + **error boundaries** and a thin **analytics** wrapper instrumenting the §10 events (#4, #5).
- Encrypt sensitive data at rest (#11, security F3).
- Stand up **CI** (typecheck/test/lint/size budget) before the team grows (#16).
- *Exit criteria:* a power user with 5,000 workouts has instant writes, smooth history, and crash/▾retention telemetry flowing.

### Q2 (Months 3–6) — Scale the client + real monetization
- **Expo Router** migration; map the route union to typed URLs; add deep linking (#7).
- Virtualize all long lists + paginate DB queries (#6).
- Decompose `App.tsx` and the top 5 screens; refactor onboarding into a state machine (#8, #12).
- Implement **IAP + server-side entitlement** for premium (#3).
- Introduce **selector-based state** alongside the new DB (#10).
- *Exit criteria:* premium is real and uncheatable; navigation is URL-addressable; the largest screens are under control.

### Q3 (Months 6–9) — AI coaching for real + quality bars
- Move AI context server-side; add per-user history/memory and retrieval; keep strict JSON contracts; enforce auth, durable rate limiting, and cost controls (#13, security F7/F8).
- Design-system extraction + UI dedupe (#14); exercise library as lazy/remote pack (#15).
- Add **component/integration + E2E** tests for the core loop (#17, #19).
- *Exit criteria:* AI gives longitudinal, personalized coaching; UI is consistent; the core loop is guarded end-to-end in CI.

### Q4 (Months 9–12) — Web + hardening
- Ship the **web version** on the shared Expo/React codebase (now unblocked by Expo Router + backend + synced DB).
- Performance pass on low-end Android; finalize event/error taxonomy + GDPR data map (#20); timer hygiene (#18).
- Load-test the backend and sync at 100k-user / 1M-workout volumes; backup/restore drills.
- *Exit criteria:* one codebase serving native + web, synced, observable, and validated against the target scale.

---

## Closing, brutally honest

You did the hard, unglamorous thing well — pure logic, tests, types, offline — and the easy-to-defer things were deferred to the point of becoming structural risk: storage that can't grow, no backend behind a product whose every goal needs one, and screens that have outgrown what a human can maintain. The good news is that the discipline already in `lib/` is exactly the discipline this rework needs, and almost none of it has to be thrown away. Spend the next quarter on the floor, not the features. If you put 1M workouts on the current storage model, you won't get to have the scaling problem — the app will fall over first.

---

*Methodology: static review of the full source tree, git metadata, and architecture docs as of 4 June 2026, plus LOC/structure analysis. I did not run the app under load; scalability claims are derived from the persistence and rendering models in code (A1, C1) and standard AsyncStorage/Android limits. Scores assume the stated 100k-user / 1M-workout / web / subscription target — against a "personal offline tracker" goal, the same codebase would score far higher.*
