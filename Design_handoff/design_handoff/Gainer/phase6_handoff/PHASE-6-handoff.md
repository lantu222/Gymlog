# Handoff: GAINER Redesign — Phase 6 (Exercises · Exercise Detail · Progress · Profile · Premium)

## Overview
This is the **continuation** of the light-theme redesign. Phases 1–5 (Welcome, Onboarding, Home, Active Workout) are already implemented on branch `redesign/light-theme` and merged/in-PR. This package covers the **five remaining main screens**, whose **designs are already finished** and approved — the gap is the **React Native implementation** (the code screens are still the old dark theme).

Same rules as the earlier handoff:
> **Implement in phases, one screen per session, commit per screen, on the redesign branch.** Run the app and visually verify after every screen before starting the next. Do NOT big-bang all five — `ProgressScreen.tsx` (3,610 lines) and `ExerciseLibraryBrowser.tsx` (1,004 lines) are large and entangled.

## About the design files (`designs/`)
HTML/React **web prototypes** — the intended look & behaviour, NOT code to copy. Recreate them in the existing RN patterns (`StyleSheet.create`, existing nav/state/services, `react-native-svg`, existing components like `GymlogIcon`). The `*-app.jsx` files are the **spec source of truth** for sizes/colors/weights/structure. Open the `.html` files in a browser to see them live.

```
designs/GAINER Exercises.html        + exercises-app.jsx + exercises-data.jsx
designs/GAINER Exercise Detail.html  + exercise-detail-app.jsx
designs/GAINER Progress.html         + progress-app.jsx + progress-data.jsx + progress-charts.jsx
designs/GAINER Profile.html          + profile-app.jsx
designs/GAINER Premium.html          + premium-app.jsx
designs/home-shared.jsx              ← shared palette (HG) + StatusBar/BottomNav/HomeIndicator atoms
designs/GAINER Premium - build notes.md  ← RevenueCat wiring for Premium
```

## Fidelity & tokens
**High-fidelity**, match to 1–2 px. The palette, type hierarchy, radii and shadows are the **same `HG` tokens** as Phases 1–5 (see `home-shared.jsx` / the Phase 1–5 handoff): bg `#F7F3FF`, surface `#FFFFFF`, ink `#101828`, muted `#667085`, faint `#9A93AC`, border `#E4D8FF`, purple `#7C3AED`, purpleDark `#5B21B6`, purpleLight `#EFE7FF`, green `#16A34A`, greenSoft `#E8F7EE`. Manrope-equivalent weight hierarchy (800 headings/values, 600–700 labels, 11–12px/0.09em/800 overlines), tabular numerals for numbers.

**Two deliberate color rules to preserve:**
- **Purple = primary** (nav, primary CTAs, selection).
- **Green = the "add / confirm" action** (the round `+` add-to-workout button, the "Add to workout" CTA, positive deltas). This is intentional, not a leftover — keep it.

## ⚠️ The #1 cross-cutting concern: real data + empty states
The prototypes are populated with rich **mock data and a signed-in persona** ("Aleksi Virtanen", 138 sessions, squat 92.5 kg, favorites, photos). In the app you must:
- **Wire every value to the real store/service** (workout sessions, progression summaries, measurements, streak/rhythm, exercise library, plan/recommendation, preferences). Reuse what `ProgressScreen.tsx` already computes — don't recompute.
- **Handle the states the mock never shows:** new user / no history / no favorites / **guest account (no name/email)**. Phase 5 made the typed name `null` and identity comes from Google sign-in (still presentational), so **Profile must render a guest state** (no "Aleksi Virtanen") as well as the signed-in state. Each screen has empty-state copy in the prototype where relevant (Exercises "No favorites yet" / "No matches"; Progress "Nothing here") — use them.

No new global state. Only local UI state (active tab, search query, expanded card, selected metric/range/plan, favorites/added, toasts).

---

## SCREEN A — Exercise Detail  *(recommended first — self-contained)*
**Target:** `src/screens/ExerciseDetailScreen.tsx` (894 lines, dark) → restyle to light.
**Design:** `GAINER Exercise Detail.html` / `exercise-detail-app.jsx`.

Top-to-bottom on `HG.bg`:
- **Top bar:** back chevron (left, 38px rounded surface btn), `EXERCISE` overline center, **favorite star** right (gold `#F4B740` when active, toggles).
- **Media hero:** 16:10 image (real `item.imageUrls[0]`) with shimmer-skeleton while loading + graceful dumbbell fallback on error; small "▶ Form video" pill bottom-right.
- **Title** (27/800) + **info chips** (body part, equipment, level — purple-tinted pills).
- **YOUR HISTORY:** 3-stat grid (Personal best / Last done / Sessions) + a "Working weight" `LineChart` (purple `#7C3AED`) from this lift's real history. "All history" link top-right.
- **TARGET MUSCLES:** PRIMARY (filled purple chips) + SECONDARY (purpleLight chips).
- **HOW TO PERFORM:** numbered steps (purpleLight number badge) from `item.instructions`.
- **Pinned CTA:** **green** "Add to workout" → toggles to greenSoft "Added to workout" + toast.

Data: real exercise from `generatedExerciseLibrary` (name/bodyPart/equipment/category/primary+secondaryMuscles/instructions/imageUrls) + this lift's history from progression data. Watch-outs: image load states; reuse the app's chart component (or `SimpleLineChart`) rather than the web `LineChart`.

## SCREEN B — Exercises (library)
**Target:** `src/screens/ExercisesScreen.tsx` (wraps `ExerciseLibraryBrowser.tsx`, 1,004 lines, dark). Restyle the browser to light **and** add the dashboard sections. Reuse its existing search/filter logic — don't rewrite it.
**Design:** `GAINER Exercises.html` / `exercises-app.jsx` + `exercises-data.jsx`.

- **Sticky header:** "Exercises" 28/800 + subline; two purpleLight icon buttons (search, filter). **Search input** (live filter by name). **Category rail** (horizontal pills: All / Chest / Back / Legs / Shoulders / Arms / Core / Full body — selected = purple fill; `CatIcon` per category).
- **Dashboard (only when category=All & no query):** horizontal rails — **POPULAR EXERCISES**, **FAVORITES** (empty-state card "No favorites yet" until starred), **SUGGESTED FOR YOUR PLAN**. Cards = 180px, photo + gold star (top-left) + name + body part + **green `+` add button**.
- **ALL EXERCISES / RESULTS list:** vertical rows (52px photo, name, `bodyPart · equipment · category`, star, green `+`), live count.
- **Added pill** (floats above nav showing N added · Review) + **toasts** on fav/add.

Watch-outs: real exercise photos with lazy load + shimmer + fallback (same `Thumb` behaviour); favorites/added are local UI state for now; `keyboardShouldPersistTaps="handled"` for the search field over scrolling lists.

## SCREEN C — Profile  *(big presentational build, low logic risk)*
**Target:** `src/screens/ProfileScreen.tsx` (currently only **187 lines / minimal**) → build out to the full design.
**Design:** `GAINER Profile.html` / `profile-app.jsx`.

Sections (cards on `HG.bg`, each with the standard surface/border/soft-shadow):
1. **Identity:** gradient avatar (initials), name, email, "Training since … · Synced" pill. **Guest variant required** (no name/email → "Guest account" + a Sign-in affordance), since auth is still presentational.
2. **LIFETIME:** 2×2 stat grid (Sessions / Weeks active / Total volume / Best rhythm) — real lifetime aggregates.
3. **YOUR PLAN:** card (plan name, days/week · goal, "Up next") → opens plan settings. "Manage" link.
4. **TRAINING PROFILE:** Goal / Experience / Equipment rows + Focus-area chips. "Edit" link.
5. **PERSONAL RECORDS:** top lifts (name, body part, `latest kg × reps · when`). "Progress" link → Progress tab.
6. **PREMIUM:** dark-purple gradient card → Premium screen.
7. **PREFERENCES:** segmented controls **Units (kg/lb)**, **Language (FIN/ENG)**, **Theme (Light/Dark)** + **Notifications toggle, OFF by default** (copy: never guilt/streak pressure — retention philosophy). Wire to existing `AppPreferences` / `onPreferencesChange` / unit handler.
8. **ACCOUNT:** Export my data, Privacy, **Sign out** (red). Version footer.

Watch-outs: most values need real aggregates — wire to existing stores; where an aggregate isn't computed yet, compute from `workoutSessions` (reuse Progress's logic) rather than inventing. Respect the existing FIN/ENG + kg/lb plumbing already in the current `ProfileScreen.tsx`.

## SCREEN D — Premium
**Target:** `src/screens/PremiumScreen.tsx` (452 lines). Restyle to the light design **and** wire real pricing.
**Design:** `GAINER Premium.html` / `premium-app.jsx` + **`GAINER Premium - build notes.md`** (RevenueCat).

- **Top bar:** close (×) left, **Restore** right.
- **Hero (dark-purple gradient):** "Keep progressing — without the guesswork" + sub; **progression chart** (`react-native-svg`): solid white history polyline + **dashed green** "coach's next step" projection + endpoint label, data from the user's squat trend (`AICoachTrainingContext.trackedLifts`).
- **WHAT PREMIUM ADDS:** 4 lanes with `LIVE`/`SOON` tags (Adaptive set coach·LIVE, Smart rest·LIVE, Session adjustments·SOON, Weekly adaptation·SOON). `premiumLanes` already exists in code.
- **CHOOSE YOUR PLAN:** two selectable cards (Yearly w/ SAVE badge default, Monthly) — **prices from RevenueCat `pkg.product.priceString`, never hardcoded** (mock shows 9,99 €/mo · 71,99 €/yr).
- **FREE VS PREMIUM** table (`comparisonRows` exists). 
- **Pinned CTA:** "Start 7-day free trial" + dynamic "Then … cancel anytime" + Terms/Privacy.

Follow the build-notes doc for RevenueCat setup, packages, entitlement gating (reuse existing `preferences.adaptiveCoachPremiumUnlocked` / `AccessTier`; the logger lock already keys off it). Store-compliance: visible price+cadence, Restore, Terms, Privacy, trial terms — all already in the design.

## SCREEN E — Progress  *(largest / riskiest — do LAST)*
**Target:** `src/screens/ProgressScreen.tsx` (3,610 lines, dark; already computes summaries, bodyweight, measurements, sessions, activity calendar, streak, charts). **Restructure into 3 tabs + restyle**; reuse the existing computation/chart code — don't rebuild the math.
**Design:** `GAINER Progress.html` / `progress-app.jsx` + `progress-data.jsx` + `progress-charts.jsx`.

Header: "Progress" + subline + **segmented tabs: Overview / Tracked / Measures** (reset scroll on switch).
- **Overview:** hero "Working weight · {top lift}" big value + `kg × reps` + "since you started" + `LineChart`; **TRAINING RHYTHM** (weeks-in-a-row + sessions-per-week bars, current week dashed — a weekly-consistency signal, *not* a daily streak); **THIS MONTH** 3 stats; **TREND** card with metric selector (volume/…) + range selector (3m/…) + chart; **ACTIVITY** month calendar.
- **Tracked:** search + signal filter pills (all / progressing / watch / …); expandable lift cards (sparkline collapsed → full `LineChart` + start→latest delta expanded), colored progression `Badge`.
- **Measures:** selected-measure detail (big value + delta pill + chart); ALL MEASURES list (sparkline + delta pill, with the "lower-is-better" inversion for waist/bodyfat); **PROGRESS PHOTOS** (Front/Side/Back placeholders).

Watch-outs: this file is big — **extract the data/calc first, then re-skin the presentation around it** (same approach that worked for Active Workout). Map each prototype block to the data the screen already has. Use the app's existing chart primitives (`SimpleLineChart`/`ProgressCard`) restyled to the light tokens rather than porting the web SVG verbatim.

## Suggested order (one commit each)
1. **Exercise Detail** — self-contained, clearest.
2. **Exercises** — restyle browser + dashboard.
3. **Profile** — large but low-risk (presentational + existing prefs).
4. **Premium** — restyle + RevenueCat (has build notes).
5. **Progress** — biggest/riskiest, last.

After each: run on-device, verify the screen end-to-end **including its empty/guest state**, confirm `tsc` clean and no new test failures, commit, stop, report.

## Interactions & behavior
- Primary CTAs: solid purple pill, press feedback. Add actions: green.
- Inline expansions (tracked-lift expand, etc.): ~240ms ease, fade + small translate; entrance animations gated on `prefers-reduced-motion`.
- Toasts: dark pill, ~1.7s auto-dismiss.
- Lists with inputs: `keyboardShouldPersistTaps="handled"`, proper keyboard avoidance.

## Known follow-ups (not blockers)
- Real Google/Apple OAuth still pending (Phase 5) — Profile identity stays guest/null until wired.
- Favorites & "added to workout" are local UI state in the prototype; decide persistence when wiring.
- Progress muscle-group labels / exercise grouping use heuristics where the data lacks a group field.
