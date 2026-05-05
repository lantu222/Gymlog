# Onboarding Impact Matrix

This document defines what each onboarding answer should change in the recommended program, the explanation shown to the user, and the weekly structure. It is the source of truth for the next recommendation tests.

## Current Selection Surface

| Step | Answer | Stored value | Expected recommendation impact | Expected explanation impact | Expected weekly structure impact | Current status |
| --- | --- | --- | --- | --- | --- | --- |
| 1 Equipment access | Full Gym | `equipment: gym`, `trainingEnvironment: full_gym` | Allow full-gym templates and prefer full-gym exercise menus. | Mention broad equipment access only when useful. | No direct schedule change. | UI should show this as the strongest default option with the focus badge `MOST FLEXIBLE`. |
| 1 Equipment access | Home Gym | `equipment: home`, `trainingEnvironment: home_gym` | Prefer home-friendly templates; avoid commercial-gym-only plans unless no good match. | Explain that the plan fits home equipment. | No direct schedule change. | Replaces the old `Home Workout` label to make it clear this means owned equipment, not bodyweight-only training. |
| 1 Equipment access | Minimal Equipment | `equipment: minimal`, `trainingEnvironment: minimal_equipment` | Prefer dumbbell/band/bench-compatible templates and low-equipment exercise menus. | Explain limited-equipment fit. | No direct schedule change. | New distinct Step 1 option; should not collapse visually into Bodyweight or Running. Focus badge: `EFFICIENT`. |
| 1 Equipment access | Bodyweight Only | `equipment: minimal`, `trainingEnvironment: bodyweight_only` | Prefer bodyweight/minimal plans and bodyweight-friendly exercise choices. | Explain no-equipment/bodyweight fit. | No direct schedule change. | Must be kept distinct from running/hybrid even though both use the broad `minimal` equipment bucket. Focus badge: `BEGINNER FRIENDLY`. |
| 1 Equipment access | Running / Hybrid | `equipment: minimal`, `trainingEnvironment: running_hybrid` | Prefer run/mobility, conditioning, or hybrid strength templates depending on later goals. | Explain running/cardio or hybrid fit. | May recommend fewer structured strength days if the goal is endurance/cardio. | Must be kept distinct from Bodyweight Only even when the later goal is not pure endurance. Focus badge: `CARDIO FOCUSED`. |
| 2 Goal | Get stronger | `goal: strength` | Prefer strength or powerbuilding templates, heavy compounds, lower primary rep ranges, longer rests. | Explain strength match and main lifts. | Match requested days when a strength template exists; otherwise use a strength base plus concrete optional add-on days. | UI label updated from `Strength`; works for 3-4 days and 5-day fallback has an optional accessory day. |
| 2 Goal | Build muscle | `goal: muscle` | Prefer hypertrophy templates, higher volume, pump/balanced style, muscle focus. | Explain muscle-building or gain context when target weight is higher. | Prefer 3-5 day hypertrophy structures depending on selected days. | Works; derived `goalType: hypertrophy` and gain target copy exist. |
| 2 Goal | Lean & athletic | `goal: lean_athletic` | Prefer athletic/recomp templates, low-friction balanced strength, and conditioning-friendly plans. | Explain balanced strength and conditioning; use fat-loss copy only when a lower bodyweight target exists. | Avoid overly demanding high-recovery templates unless selected level and days justify it. | New precise Step 2 intent; currently maps to `goalType: recomposition` unless target weight makes it fat-loss oriented. |
| 2 Goal | General fitness | `goal: general_fitness` | Prefer sustainable general/recomp templates, lower friction, optional conditioning/mobility support. | Explain sustainable, flexible fitness. | Match selected days where possible and keep recovery demand moderate. | New precise Step 2 intent; legacy `general` remains supported for old saved setup data. |
| 3 Profile | Gender | `gender` | Should not change recommendation by default. | No prominent explanation unless future content is gender-specific. | No schedule change. | Stored only. Correct for now. |
| 3 Profile | Age | `age` / `ageRange` | Should influence readiness only when very young/older ranges require a safer start. | Mention safer start only if it changes the recommendation. | May reduce recovery demand for older beginners later. | Stored only. Needs future policy if used. |
| 4 Training days | 2 days | `daysPerWeek: 2` | Prefer 2-day templates or closest low-friction alternative. | Explain 2-day weekly fit. | Default rhythm Mon/Thu. | Works. |
| 4 Training days | 3 days | `daysPerWeek: 3` | Prefer 3-day templates. | Explain 3-day weekly fit. | Default rhythm Mon/Wed/Fri. | Works. |
| 4 Training days | 4 days | `daysPerWeek: 4` | Prefer 4-day templates. | Explain 4-day weekly fit. | Default rhythm Mon/Tue/Thu/Sat. | Works. |
| 4 Training days | 5 days | `daysPerWeek: 5` | Prefer 5-day templates if goal-compatible; otherwise explain nearest 4-day plan. | Explain if selected program is fewer than 5 days. | Default rhythm Mon/Tue/Thu/Fri/Sat if 5-day program exists. | Works for muscle; strength is a gap. |
| 5 Bodyweight | Current weight | `currentWeightKg` | Informs bodyweight target context and derived weight direction. | Show current-to-target context when target exists. | No direct schedule change. | Used by `recommendationProfile` and recommendation explanation. |
| 5 Bodyweight | Target weight | `targetWeightKg` | Influences explanation and light scoring bias, not blindly changing template. | For gain: mention mass gain support. For loss: mention fat-loss/recomp support. | No direct schedule change unless future large-loss policy reduces recovery demand. | Used by `recommendationProfile`, explanation, and fat-loss/gain scoring bias. |
| 6 Focus | Glutes | `focusAreas: glutes` | Prefer templates tagged for glutes/legs or surface swaps/accessories later. | Explain extra glute focus. | No direct day count change. | Scored through focus tags. |
| 6 Focus | Legs | `focusAreas: legs` | Prefer templates with leg focus tags. | Explain extra leg focus. | No direct day count change. | Scored through focus tags. |
| 6 Focus | Chest | `focusAreas: chest` | Prefer templates with chest focus tags. | Explain extra chest focus. | No direct day count change. | Scored through focus tags. |
| 6 Focus | Shoulders | `focusAreas: shoulders` | Prefer templates with shoulder focus tags. | Explain extra shoulder focus. | No direct day count change. | Scored through focus tags. |
| 6 Focus | Back | `focusAreas: back` | Prefer templates with back focus tags. | Explain extra back focus. | No direct day count change. | Scored through focus tags. |
| 6 Focus | Arms | `focusAreas: arms` | Prefer templates with arm focus tags. | Explain extra arm focus. | No direct day count change. | Scored through focus tags. |
| 6 Focus | Core | `focusAreas: core` | Prefer templates with core focus tags. | Explain extra core focus. | No direct day count change. | Scored through focus tags. |
| 6 Focus | Conditioning | `focusAreas: conditioning` | Prefer conditioning/run/mobility tags. | Explain conditioning focus. | May make run/mobility secondary option stronger. | Scored through focus tags. |

## High-Priority Scenario Tests

| Scenario | Input | Expected recommendation | Expected explanation | Expected weekly structure | Gap / action |
| --- | --- | --- | --- | --- | --- |
| Full gym strength 3 days | Full Gym, Strength, 3 days, beginner/intermediate | `tpl_3_day_strength_base_v1` or equivalent strength base. | "3 days for strength", full-gym access implicit or explicit, main lifts/heavy start. | 3 sessions on Mon/Wed/Fri by default. | Test current behavior and lock it. |
| Full gym strength 4 days | Full Gym, Strength, 4 days, intermediate | `tpl_4_day_strength_size_v1` or `tpl_4_day_powerbuilding_v1` depending level/tailoring. | Explain heavy compounds plus enough volume. | 4 sessions on Mon/Tue/Thu/Sat by default. | Test expected winner and alternative. |
| Full gym strength 5 days | Full Gym, Strength, 5 days, target 120kg | Prefer a 5-day strength-compatible plan if available. If not, recommend 4-day strength and clearly say closest coherent fit. | Explain strength match, full gym, target-weight context if current weight exists. | 4-day strength base plus optional 5th accessory day. | Fallback is now intentional; true 5-day strength template remains future catalog work. |
| Full gym muscle gain | Full Gym, Build muscle, current < target | Prefer hypertrophy templates; 5 days should map to `tpl_5_day_hybrid_v1`. | Explain muscle-building volume and gain target support. | Match selected day count where template exists. | Target weight not yet used in explanation/scoring. |
| Lean target path | Full Gym/Home, Lean & athletic or legacy Lose weight, current > target | Prefer sustainable general/recomp, low-friction or balanced template. | Explain current-to-target bodyweight goal and sustainable training. | Match selected days, but avoid high recovery demand for beginners. | `lean_athletic` and legacy `general` both support lower-target fat-loss context. |
| Home workout muscle | Home Workout, Build muscle, 3-4 days | Prefer low-equipment/home-friendly templates; avoid full gym templates unless presented as closest compromise. | Explain home setup constraints and muscle goal tradeoff. | If no exact 4-day home muscle plan exists, use 2-day home-friendly base plus concrete optional volume/mobility days. | Weekly structure fallback exists; no home-specific program family yet. |
| Outdoor/running endurance | Running / Hybrid equipment, 3-5 days | `tpl_3_day_run_mobility_v1` for 3 days when the Step 1 environment and later conditioning signals justify it; for 4-5, show closest 3-day base plus optional recovery/cardio add-ons. | Explain run/cardio/mobility match and why day count may differ. | 3-day run/mobility base plus concrete Easy Run / Long Run add-ons when needed. | Running/hybrid is no longer a Step 2 goal; it remains a Step 1 environment signal. |

## Current Recommendation Inputs

The scoring input currently uses:

- `goal`
- derived `profile.goalType`
- derived `profile.setupContext`
- derived `profile.weightDirection`
- `level`
- `daysPerWeek`
- `equipment`
- `secondaryOutcomes`
- `focusAreas`
- `weeklyMinutes`
- inferred `preferredSessionMinutes`
- `wantsConsistency`

It does not currently use:

- `gender`
- `age` / `ageRange`

`currentWeightKg`, `targetWeightKg`, and the Step 1 distinction between `Minimal Equipment`, `Bodyweight Only`, and `Running / Hybrid` should be available to `buildRecommendationProfile`. The broad `equipment` value remains for compatibility, but the more precise `trainingEnvironment` is the recommendation-facing Step 1 signal.

## Current Program Catalog Gaps

| Gap | Why it matters | Candidate fix |
| --- | --- | --- |
| No true 5-day strength plan | User can select Full Gym + Strength + 5 days, but best match may be hypertrophy/hybrid or 4-day strength. | Current behavior intentionally falls back to 4-day strength plus optional accessory day; add a true 5-day template later if needed. |
| Home Gym, Minimal Equipment, and Bodyweight Only still share much of the low-equipment catalog | Home muscle, limited-equipment, and bodyweight training should not always feel the same as outdoor/running. | Keep Step 1 environments distinct now; add deeper home/bodyweight-specific templates or exercise selection rules later. |
| Target weight is only lightly used | Users who enter target weight expect it to matter. | Expand from explanation/scoring bias into progression and optional nutrition guidance. |
| Legacy `general` still exists in stored setup | Existing users may have `goal: general` from the previous Lose weight UI. | Keep legacy support, but new Step 2 should store `lean_athletic` or `general_fitness` for the new visible non-strength/non-muscle options. |
| 4-5 day endurance catalog depth | Endurance users may choose more days than the current run/mobility catalog supports. | Current behavior adds concrete optional run days; add additional 4/5-day endurance templates later if usage supports it. |

## Proposed Test Order

1. Lock existing good paths: full gym strength 3 days, full gym muscle 5 days, outdoor endurance 3 days.
2. Add tests that expose gaps: full gym strength 5 days, lose weight with target, home workout muscle.
3. Decide whether each gap should be fixed with scoring changes, explanation changes, or new templates.
4. Only then adjust recommendation logic or templates.
