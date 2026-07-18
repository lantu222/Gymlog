# Onboarding truth plan — every choice must change the training, and the UI must show it

Status: **PLAN — not started** (written 2026-07-16, after screen 08b "pick your program" shipped).
Owner intent (user, in Finnish): *"kaikki valinnat mitä tehdään oikeasti vaikuttaa käyttäjän
treeniin, ja myös UI muuttuu sen mukaan — esim. 3 päivän ohjelma oikeasti näyttää UI:ssa
3 päivän ohjelmaa eikä 4 päivää, home screenissä tai missään muuallakaan."*

## Principle

Two rules, applied to every onboarding choice:

1. **Real effect** — the choice changes what the user actually trains (exercises, days,
   loads, progression), not just which card is highlighted.
2. **Truthful UI** — every surface (08b picker, 09 plan overview, week preview, Home,
   Programs tab, logger, Plan settings) reflects the *composed result*, never the raw
   catalog template. If a promise can't be implemented yet, the copy must not make it.

## Audit — what each choice does TODAY

| # | Choice (screen) | Affects recommendation? | Affects actual training? | UI truthful? |
|---|---|---|---|---|
| 1 | Environment: Full gym / Home / Bodyweight (Step 1) | ✅ waterfall gym-content guard | ✅ via which template is picked | ✅ |
| 2 | Equipment chips, e.g. no barbell (Step 1) | ➖ minor tailoring input | ❌ stored only (`setupEquipmentItems`), no exercise filtering | ❌ implies gear-aware plan |
| 3 | Goal (Step 2) | ✅ family selection | ✅ via template | ✅ |
| 4 | Level (Step 3) | ✅ beginner cap 3d, tier pick | ✅ via template | ✅ |
| 5 | Days per week (Step 4) | ✅ preferred days-cell | ⚠️ **only if catalog has an exact-day template** — picked program keeps ITS OWN day count (user picks 4 → offered 5-day + 3-day) | ❌ **the core gap** |
| 6 | Specific weekdays + schedule mode (Step 4) | ➖ | ⚠️ stored (`availableDays`), used by Plan settings; Home/Programs derive week rows from session index, not chosen weekdays | ❌ |
| 7 | Caution flags: careful/avoid + refinements (Step 5) | ❌ | ❌ **UI colouring only** — `setupCautionFlags` has no consumer outside onboarding UI + persistence | ❌ copy promises "we train around it", "joint-friendly swaps", "we leave this area out", "bodyweight only" — none implemented |
| 8 | Focus areas (Step 6) | ✅ scoring/tailoring | ❌ no extra volume/emphasis inside the program | ⚠️ 08b focus bar is honest (computed from real sessions), but "prioritizes what matters" is only true at program-choice level |
| 9 | About you: gender/age/height/weight (+ Health Connect) | ✅ profile inputs | ➖ prefill/analytics only | ✅ |
| 10 | Automated progression toggle (plan review) | — | ❌ stored (`automatedProgression`, default true) but progression engine never reads it | ❌ toggle is decorative |
| 11 | Weekly time (recommendation refinement) | ✅ input | ❌ session length comes from template | ⚠️ |

## Phases (each = pure lib + tests first, then wiring, then emu E2E)

### P1 — Days-per-week truth (the core, do first) — ✅ DONE 2026-07-18
Selected N days must produce an N-day program **everywhere**.

Implemented via `src/lib/programDayComposer.ts` (`composeProgramWeekForSelection`):
one composed week shared by the 08b picker, 09 overview (stats + day-count tag),
week preview (`projectedSessions`) and the App.tsx save path (which previously had
its own copy of this logic). Home hero counts the promised block (weeks × N, no
more 8-week default for onboarding plans). E2E-verified: picked 4 days on a 5-day
recommendation → picker "4 days / 16 workouts" (both cards), overview "4 workouts
a week" + "4 Days" tag, Home "0 of 16 sessions", Programs "4 DAYS / WEEK · Week 1
of 4" with exactly 4 session rows. Matrix test pins days 2–6 in
`tests/lib/programDayComposer.test.cjs`.

Note: extension days (target above template) still use the thin supplemental-day
exercises — quality pass belongs to P2/P3 composer work.

1. **Resolution order** when the engine's family pick doesn't match N:
   a. exact-N sibling tier in the same family (families already ship 3d/4d/5d tiers),
   b. otherwise **compose**: duplicate the closest template via `readyProgramDuplication`
      trimmed/extended to N sessions (drop/add whole sessions by `orderIndex`; extension
      reuses the family's add-on day from `recommendationProgramme` session composition),
   c. never silently keep a mismatched day count (current "closest base + add-ons" note dies).
2. New pure lib `src/lib/programDayComposer.ts` + tests: `composeProgramForDays(template, N)`
   with invariants (sessions.length === N, roles/anchors preserved, honest name).
3. 08b picker cards + 09 overview stats read the **composed** program (5→"5 days" only if
   the thing being saved really has 5 sessions).
4. Saving commits the composed program (custom duplicate when composed), so Home,
   Programs hero ("N DAYS / WEEK"), week rows, week preview and logger all inherit truth
   for free.

**Acceptance:** for every N in 2–6: finish onboarding with N days → 08b stats, 09 stats,
Home, Programs THIS WEEK, Plan settings and week preview all show exactly N training days;
total workouts = weeks × N. Add a matrix test in `tests/lib/`.

### P2 — Caution flags become real (highest honesty debt) — ✅ DONE 2026-07-18
Implemented via `src/lib/cautionExerciseFilter.ts`, applied inside the P1 composer
so picker split, previews, saved program and logger all inherit it:
- `avoid` removes every exercise matching the area's stress patterns
  (name-based, grounded in catalog names); swaps never land on a banned move.
- `careful` swaps to joint-friendly variants (registry per area), keeps the
  prescription. Per decision #2 there is no separate load-cap UI.
- careful area picked as a step-6 FOCUS swaps bodyweight-first (decision #3).
- Plan overview shows "Trains around: Knees left out · …"; step-6 note copy now
  matches the implementation ("joint-friendly, bodyweight-first … avoided areas
  stay out entirely").
- Caution→focus-area mapping moved into the lib; the onboarding UI imports it.
E2E: knees=avoid → saved plan's Lower day lost Back Squat (kept Romanian
Deadlift), Full Body lost Goblet Squat, durations updated, overview line shown.
Tests: `tests/lib/cautionExerciseFilter.test.cjs` (incl. composed-week ban check).
1. New pure lib `src/lib/cautionExerciseFilter.ts`: `SetupCautionArea` → exercise-name /
   library-muscle patterns; levels: `info` = no change, `careful` = swap to joint-friendly
   variant + flag for lighter-load guidance, `avoid` = exclude the pattern entirely.
2. Apply at compose/save time (works on the P1 composed program). Swaps source from the
   exercise library (equipment + primaryMuscles fields) via `exerciseAlternatives`.
3. Logger: `careful` exercises get a reduced-load note in prescription guidance.
4. Flagged-focus-selected → bodyweight-only variants (`trackingMode: 'bodyweight'`), which
   makes the Step-6 note ("bodyweight only to maximize safety") TRUE — until then that
   copy must be softened.
5. Surface it: plan overview gets a small "Tailored around: Knees (avoid), Shoulders
   (careful)" line so the user SEES the effect.

**Acceptance:** flag knees=avoid → composed program contains no squat/lunge/leg-press
patterns; week preview + logger show the swaps; overview lists the tailoring line.
Matrix test: every area × level produces a program with zero banned patterns.

### P3 — Focus areas add real emphasis — ✅ DONE 2026-07-18
`src/lib/focusEmphasis.ts`: +1 weekly accessory for small areas, +2 for big
muscle groups (decision #4), spread round-robin across sessions, no duplicates,
max two additions per session. Runs before the caution pass so flags veto/swap
additions; reported additions only include survivors. Split bar shifts live.
1. Composer step: for each selected focus area, +1 accessory (or accessory swap) targeting
   that area in the sessions where it fits, capped by session time budget.
2. 08b "WHERE YOUR WEEK GOES" recomputes from the composed program (already wired via
   `programFocusSplit`) — the bar visibly shifts when focus changes. That's the honest
   feedback loop.

**Acceptance:** Chest focus → ≥1 added/emphasized chest accessory vs base template; split
bar changes; overview shows focus badge.

### P4 — Equipment chips filter exercises — ✅ DONE 2026-07-18
`src/lib/equipmentExerciseFilter.ts`: chips = the full truth about available
gear; requirement groups per movement pattern (bench press needs bench AND
barbell, squats need a rack, cables/machines/kettlebells/pull-up bar gated),
fallback chain dumbbell → band → bodyweight, drop when nothing honest remains.
Runs between focus emphasis and the caution pass (bans always win).
1. `setupEquipmentItems` → allowed-equipment set; compose step swaps/drops exercises whose
   library `equipment` isn't available (reuse `exerciseAlternatives`).
2. Home-equipment without "Barbell & plates"/"Squat rack" → no barbell lifts anywhere,
   including logger alternatives.

**Acceptance:** deselect Barbells → composed program + alternatives contain no barbell
exercises.

### P5 — Automated progression toggle honored — ✅ DONE 2026-07-18
`resolveAdaptiveCoachOffer` in `src/lib/adaptiveCoach.ts`: toggle OFF silences
the in-logger adaptive coach AND its locked upsell (the choice is respected,
not monetized). Logger reads `preferences.automatedProgressionEnabled`; Plan
settings gained an On/Off toggle so the choice stays editable.
1. Progression stack (`progressionActivePlan`, `adaptiveCoach`, logger prefill) reads
   `preferences.automatedProgressionEnabled`; OFF = prefill last logged values, no load/rep
   bump suggestions, no deload prompts. Toggle also editable in Profile.

**Acceptance:** OFF → next session prefill equals last session exactly; no "+2.5 kg" chips.

### P6 — Weekday rhythm truth — ✅ DONE 2026-07-18
Saved plan entry labels (user's chosen days when self-managed, app-placed
rhythm otherwise) flow into Programs THIS WEEK rows via
`HomeDaySessionSummary.dayLabel`; the generic index spread is only a fallback
for plans without fixed weekdays. Tue/Thu/Sat no longer renders as MON/WED/FRI.
1. `self_managed` chosen weekdays drive Home "today vs rest day" and Programs THIS WEEK
   letters (today Programs derives letters from session index — `weekdayForSession`).
2. `app_managed` (rolling sequence) stops pretending: label rows "Next / Then / …" instead
   of fake weekday letters.

**Acceptance:** pick Mon/Wed/Fri → Tuesday shows rest state on Home; Programs rows sit on
M/W/F. Rolling mode shows no weekday letters at all.

### P7 — Copy honesty sweep (close the loop) — ✅ DONE 2026-07-18
Audited onboarding claims against implemented behaviour and fixed the liars:
- Health connect bullet "Workouts log themselves … sync back automatically"
  (write-back is stubbed) → "Private by design — data stays on your device".
- Caution `careful` body "Lighter loads and joint-friendly swaps" → swaps only
  (matches decision #2 and the implementation).
- Plan-review PROGRESSION_BULLETS ("Weights progress week to week", "Deloads
  arrive when recovery dips" — neither shipped) → prefill-from-logs, Adaptive
  Coach attribution, and the new Plan-settings toggle.
Claims left as-is because they are now TRUE: "get a program that fits your goal
and week" (P1), "We leave this area out of your plan" (P2), step-6 safety note
(P2), "Pick 1–2 areas" (cap exists). Welcome-screen marketing copy left
untouched (user-approved, pinned by tests).

## Order & effort

P1 → P2 are the user-visible lies today; do them first (P1 unlocks the composer that
P2–P4 reuse). P5 is small and independent. P3/P4 ride the composer. P6 is UI-only. P7 last.

## Decisions — CONFIRMED by user 2026-07-18

1. **Day mismatch resolution:** YES — composed program may be saved as a custom duplicate
   with an honest name when no exact-tier catalog program exists.
2. **"Careful" level:** swaps only (joint-friendly variants), no separate load-cap UI.
3. **"Avoid entirely":** the area is left out entirely (matches the existing promise
   "We leave this area out of your plan"). The bodyweight-first idea lives in the
   flagged-FOCUS case instead: if the user picks a flagged area as a focus on Step 6,
   that area trains with bodyweight-only variants (matches the Step-6 note).
4. **Focus emphasis size:** scale by muscle size — +1 accessory for small areas
   (arms, calves, shoulders, abs), +2 for big ones (chest, back, quads, glutes,
   hamstrings, legs).
