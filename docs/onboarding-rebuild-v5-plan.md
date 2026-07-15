# Onboarding full rebuild (V5) — implementation plan

**STATUS: COMPLETE (2026-07-15).** All phases P1–P8 landed on `onboarding-update-v5`:
P1 stage skeleton (0ae183c) · P2 equipment chips (84452af, polish 6de67aa) ·
P3b level slider + flames (2bb9d12) · P3a SetupLevel rename (fdb4d1c) ·
P4 days chips + week row (dd66237) · P5 avoid caution flags (a0f26f3) ·
P6 caution-aware focus list (072975c) · P7 progression toggle, account gate removed (a3bd88c) ·
P8 dead-code sweep (~2700 lines) + automated end-to-end emulator walks of both paths.

Branch: `onboarding-update-v5`. Backup: commit `d565de2` = branch `backup/pre-onb-full-rebuild`
(both pushed to origin). Restore with `git reset --hard backup/pre-onb-full-rebuild`.

Source of truth: the user's full-rebuild prompt (2026-07-15). The repo's design handoff
(`Design_handoff/.../design_handoff_gainer_redesign/designs/onb-*.jsx`) is an OLDER flow
(still has Training profile / Goal / Goal weight / Save your plan) — do NOT copy structure
from it; use it only for shared atoms/tokens. If an updated `GAINER Onboarding.html` handoff
appears, drop it next to the old one and prefer it.

## Already done (commit d565de2)

01 Welcome auth stack · 01b StartPath 2-card selection · 01c HealthConnect · 01d HealthSynced ·
01e AboutYou · health.ts stub (dev preview data) · basicsSeed prop · heightCm plumbing ·
Profile CONNECTIONS row. 315 tests pass.

## Current questionnaire anatomy (OnboardingScreen.tsx)

- `STAGES = ['location', 'goal', 'profile', 'planning', 'about', 'review']`,
  progress bar over the first five (`ONBOARDING_PROGRESS_STAGES`).
- `location` = "Where do you train?" (LocationChoiceCard list)
- `goal` = "What do you want most?" (flat list, why-panel already removed in an earlier round)
- `profile` = level + frequency + gender waterfall (reveal Animated values + *Selected gates)
- `planning` = focus areas (FocusAreaBodyCard anatomy cards, STEP 4 OF 5)
- `about` = bodyweight goal steps (`BODYWEIGHT_SETUP_STEPS: goal/current/target/outcome`)
- `review` + building animation + plan-ready views (`planReadyView: overview/day/account`)

## Target flow

Welcome → StartPath → [build: HealthConnect → Synced] → AboutYou →
**02 What can you train with?** → **03 What do you want most?** → **04 Training level (slider+flames)** →
**04b Training days (chips + tappable week)** → **Avoid? (caution levels)** → **05 Focus areas (list, caution-coloured)** →
Building → Plan overview → Plan day → **11 Plan review (automated-progression toggle, CTA "Start training")**.
Ready path: catalog, unchanged. No account screen at the end (auth lives on Welcome).

Proposed stage array:
`['location', 'goal', 'level', 'days', 'avoid', 'planning', 'review']` — progress over first six.
(`avoid` before `planning` so Focus can colour flagged parts; placement was "TBD" — confirm with user.)

## Phases (one commit each, verify on emulator per phase)

**P1 · Stage skeleton + deletions.** Split `profile` into `level` + `days` stages (move the existing
level picker and frequency picker as-is first — no new visuals yet); delete the gender block from
`profile` (gender/age now come from AboutYou via basicsSeed); delete the `about` bodyweight-goal
stage entirely; renumber progress labels (compute STEP n OF total from the stage array, stop
hardcoding). Keep `targetWeightKg`/`bodyweightGoalKg` fields in the model (data preserved, question
gone — note: recommendationProfile loses its lose-weight signal; acceptable per spec).
Update onboardingStructure tests. THIS PHASE IS THE RISKY ONE — everything after is per-screen visuals.

**P2 · 02 What can you train with?** Rename copy, selected card expands into equipment toggle
chips + "N selected", other setups collapse to compact rows under "OR CHOOSE ANOTHER".
New `equipmentItems: string[]` in selection + `setupEquipmentItems` pref (+normalization).
Chip catalogs per environment (full gym / home / bodyweight). No "WHY IT'S GREAT" anywhere.

**P3 · 04 Training level.** Replace the level picker with a 3-stop slider (Beginner/Advanced/Pro),
live descriptor lines, centred GAINER wordmark with purple flame Svg elements whose count/size
scale by level + pop animation on change (Animated, reduced-motion safe). Maps to existing
`SetupLevel` ('beginner' | 'intermediate' | 'advanced' — map Pro→advanced, Advanced→intermediate;
confirm naming with user).

**P4 · 04b Training days.** Chips 2–6 with recommended flag (reuse tier logic) + tappable
Mon–Sun week row (letters only) driving `availableDays`/`daysPerWeek` both ways;
"N training days · M rest" line. scheduleMode: picking specific days = self_managed semantics —
keep existing mapping (availableDays only persisted when self_managed; decide in-phase).

**P5 · Avoid screen (new stage).** Body-part rows → per-part caution level radio
(For info only #667085/#F1F0F4 · Be careful #D97706/#FEF3C7 · Avoid entirely #DC2626/#FEE2E2),
colour tints tile/border/radio/title; REFINE chips (Old injury, Lower-back pain, …);
"Add something else" + "Nothing to note" clears; CTA label "Skip" until something chosen.
New types: `SetupCautionLevel`, `SetupCautionFlag { area, level, refinements }`;
selection field `cautionFlags` + pref `setupCautionFlags` (+normalization + patch + selection builder).

**P6 · 05 Focus areas → list.** Replace anatomy-highlight cards with plain selectable rows
(names only, tap-to-fill like 03, pick 1–2 max kept). Rows read `cautionFlags`:
careful = amber row + warning triangle, avoid = red. FocusAreaBodyCard becomes dead code — delete.

**P7 · 11 Plan review.** Replace "Save your plan"/account remnants with the automated-progression
card: toggle default ON (glowing purple border/shadow + purple checks + "On — GAINER adjusts your
plan for you"); OFF dims bullets with ✕/strike-through; "change this anytime in Settings" note;
CTA "Start training". New pref `automatedProgressionEnabled: boolean` default true
(decide in-phase whether it maps onto existing `SetupGuidanceMode` or is a new field).

**P8 · Sweep.** Typecheck + full test run + emulator pass of both paths + ready path;
delete dead styles/components; update docs; final push.

## Test impact

`tests/lib/onboardingStructure.test.cjs` pins much of the old structure (profile waterfall,
FocusAreaBodyCard, STEP 4 OF 5 labels, scroll-lock rules) — every phase updates its suites.
`recommendationScoring/profile` tests unaffected except lose-weight-signal cases (P1) — verify.

## Emulator quickstart (per phase verify)

emulator -avd Pixel_7 · adb reverse tcp:8081 tcp:8081 · npx expo start ·
app pref debug_http_host=localhost:8081 already set · reset state via Profile → Reset all data.

## Decisions (user, 2026-07-15)

1. **No newer handoff exists** — build from the prompt text; user can supply screenshots on request.
2. **Avoid screen goes BEFORE Focus areas** (stage order confirmed:
   `location → goal → level → days → avoid → planning → review`).
3. **Rename SetupLevel internally to match the UI**: `'beginner' | 'advanced' | 'pro'`
   (UI labels Beginner/Advanced/Pro — same words inside and out). Migration in
   `storage/database.ts` normalization: legacy `'intermediate'` → `'advanced'`;
   legacy stored `'advanced'` stays `'advanced'` (old top-tier collapses to middle —
   acceptable pre-release; users reset data constantly). Touches SetupLevel consumers:
   recommendation scoring/waterfall (beginner cap etc.), firstRunSetup, tests. Do inside P3
   (or as its own commit P3a if the fan-out is large).
4. **Goal weight removed entirely.** Keep `targetWeightKg`/`bodyweightGoalKg` fields in the
   model (data intact, question gone). User may later resurface goal weight inside the app
   (e.g. Profile) — parked, not planned.
