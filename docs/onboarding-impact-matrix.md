# Onboarding Impact Matrix

This document defines what each onboarding answer should change in the recommended program, the explanation shown to the user, and the weekly structure. It is the source of truth for the next recommendation tests.

## Current Selection Surface

| Step | Answer | Stored value | Expected recommendation impact | Expected explanation impact | Expected weekly structure impact | Current status |
| --- | --- | --- | --- | --- | --- | --- |
| 1 Location | Full Gym | `equipment: gym` | Allow full-gym templates and prefer full-gym exercise menus. | Mention broad equipment access only when useful. | No direct schedule change. | Works for template filtering/scoring. |
| 1 Location | Home Workout | `equipment: home` | Prefer low-equipment/home-friendly templates; avoid full-gym-only plans unless no good match. | Explain that the plan fits a home setup. | No direct schedule change. | Uses derived `setupContext: home_limited`; still needs home-specific catalog depth. |
| 1 Location | Outdoor / Running | `equipment: minimal` | Prefer low-equipment and run/mobility templates. | Explain outdoor/minimal setup fit. | May recommend fewer structured strength days if the goal is endurance/cardio. | Uses derived `setupContext: outdoor_running` when run/conditioning signals exist. |
| 1 Location | Bodyweight | `equipment: minimal` | Prefer bodyweight/minimal plans and bodyweight-friendly exercise choices. | Explain no-equipment/bodyweight fit. | No direct schedule change. | Uses derived `setupContext: bodyweight` for minimal non-running setups. |
| 2 Goal | Strength | `goal: strength` | Prefer strength or powerbuilding templates, heavy compounds, lower primary rep ranges, longer rests. | Explain strength match and main lifts. | Match requested days when a strength template exists; otherwise use a strength base plus concrete optional add-on days. | Works for 3-4 days; 5-day fallback now has an optional accessory day. |
| 2 Goal | Build muscle | `goal: muscle` | Prefer hypertrophy templates, higher volume, pump/balanced style, muscle focus. | Explain muscle-building or gain context when target weight is higher. | Prefer 3-5 day hypertrophy structures depending on selected days. | Works; derived `goalType: hypertrophy` and gain target copy exist. |
| 2 Goal | Lose weight | `goal: general` | Prefer sustainable general/recomp templates, lower friction, optional conditioning/mobility support. | Explain fat-loss/recomp support using current/target weight when present. | Avoid overly demanding high-recovery templates unless selected level and days justify it. | Derived `goalType: fat_loss` when target is lower; copy and scoring bias added. |
| 2 Goal | Endurance / cardio | `goal: run_mobility` | Prefer run/mobility and recovery templates; avoid full-gym strength templates. | Explain running/cardio/mobility match. | Current closest fit is 3-day run/mobility; 4-5 day users get concrete optional run add-ons. | Works for 2-3 day templates; 4-5 day weekly structure now has explicit add-on days. |
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
| Lose weight with target | Full Gym/Home, Lose weight, current > target | Prefer sustainable general/recomp, low-friction or balanced template. | Explain current-to-target bodyweight goal and sustainable training. | Match selected days, but avoid high recovery demand for beginners. | `general` copy and target-weight explanation need improvement. |
| Home workout muscle | Home Workout, Build muscle, 3-4 days | Prefer low-equipment/home-friendly templates; avoid full gym templates unless presented as closest compromise. | Explain home setup constraints and muscle goal tradeoff. | If no exact 4-day home muscle plan exists, use 2-day home-friendly base plus concrete optional volume/mobility days. | Weekly structure fallback exists; no home-specific program family yet. |
| Outdoor/running endurance | Outdoor / Running, Endurance / cardio, 3-5 days | `tpl_3_day_run_mobility_v1` for 3 days; for 4-5, show closest 3-day base plus optional recovery/cardio add-ons. | Explain run/cardio/mobility match and why day count may differ. | 3-day run/mobility base plus concrete Easy Run / Long Run add-ons when needed. | Weekly structure fallback exists; dedicated 4/5-day endurance templates remain future work. |

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

`currentWeightKg`, `targetWeightKg`, and the distinction between `Outdoor / Running` and `Bodyweight` are used through `buildRecommendationProfile`, but they are not yet stored as first-class setup fields.

## Current Program Catalog Gaps

| Gap | Why it matters | Candidate fix |
| --- | --- | --- |
| No true 5-day strength plan | User can select Full Gym + Strength + 5 days, but best match may be hypertrophy/hybrid or 4-day strength. | Current behavior intentionally falls back to 4-day strength plus optional accessory day; add a true 5-day template later if needed. |
| Home Workout and Bodyweight still share the low-equipment catalog | Home muscle and bodyweight training should not always feel the same as outdoor/running. | Add home/bodyweight-specific templates or exercise selection rules. |
| Target weight is only lightly used | Users who enter target weight expect it to matter. | Expand from explanation/scoring bias into progression and optional nutrition guidance. |
| Lose weight still maps to `general` in stored setup | This is acceptable internally only if derived `goalType` handles UX and scoring. | Keep `goalType: fat_loss` as the recommendation-facing signal; consider storage migration later. |
| 4-5 day endurance catalog depth | Endurance users may choose more days than the current run/mobility catalog supports. | Current behavior adds concrete optional run days; add additional 4/5-day endurance templates later if usage supports it. |

## Proposed Test Order

1. Lock existing good paths: full gym strength 3 days, full gym muscle 5 days, outdoor endurance 3 days.
2. Add tests that expose gaps: full gym strength 5 days, lose weight with target, home workout muscle.
3. Decide whether each gap should be fixed with scoring changes, explanation changes, or new templates.
4. Only then adjust recommendation logic or templates.
