# Source of Truth

This document is authoritative.
If any other document conflicts with this file, this file takes precedence.

**Type:** Implementation spec — onboarding input/output contract and recommendation scoring
**Scope:** Owns onboarding input schema, scoring dimensions, and plan assembly order. Programme payload fields are owned by `recommendation-4-week-programme-contract.md`. These are complementary, not overlapping.

---

# Onboarding Impact Matrix

This document defines how the current Step 1-5 onboarding answers become a ready training plan. It is the source of truth for recommendation tests, plan-ready review copy, and future programme-generation work.

The current onboarding has five input steps plus a final plan-ready review:

| Step | Screen | Primary purpose | Hard / soft role |
| --- | --- | --- | --- |
| 1 | Equipment access | Decide what the user can realistically train with. | Hard constraint. |
| 2 | Training goal | Decide the main objective of the plan. | Primary ranking signal. |
| 3 | Training profile | Decide experience level and weekly frequency. | Hard schedule input plus readiness guardrail. |
| 4 | Focus areas | Add up to two muscle-group preferences. | Soft preference. |
| 5 | Bodyweight progress | Add bodyweight direction and expectation framing. | Context and scoring bias. |
| Review | Your plan is ready | Explain the chosen plan and let the user start. | Output screen, not a new input step. |

## Plan Assembly Contract

The engine should build a plan in this order:

1. Apply hard constraints from Step 1 and Step 3.
2. Filter out templates that cannot satisfy equipment, frequency, or beginner-safety rules.
3. Rank remaining candidates by Step 2 goal fit, Step 4 focus fit, Step 5 bodyweight-direction fit, and catalog quality.
4. Select one primary recommendation and two useful alternatives.
5. Attach programme metadata from `docs/recommendation-4-week-programme-contract.md`: first week, 4-week block, progression rules, fallback reason, and confidence.
6. Generate explanation copy from the selected candidate and the exact Step 1-5 answers.

The plan-ready screen should be able to answer these questions without asking AI:

| Question | Source |
| --- | --- |
| What kind of training week is this? | Selected template family, days per week, session labels. |
| Why this plan? | Top scoring reasons from Steps 1-5. |
| What will I do first? | Week 1 sessions from the selected template. |
| How will it progress? | Programme profile / training block metadata. |
| What tradeoff did the engine make? | Confidence and fallback metadata. |

## Current Selection Surface

| Step | Answer | Stored value | Recommendation impact | Programme impact | Plan-ready explanation |
| --- | --- | --- | --- | --- | --- |
| 1 Equipment access | Full Gym | `equipment: gym`, `trainingEnvironment: full_gym` | Allows full-gym templates and full exercise menus. | Can use heavier loading, machines, cables, and broader substitutions. | Mention only when it materially explains the match. |
| 1 Equipment access | Home Gym | `equipment: home`, `trainingEnvironment: home_gym` | Prefers home-friendly templates; avoids commercial-gym-only plans unless explained as a compromise. | Progression should work with repeatable home equipment and swaps. | Explain that the plan fits home training constraints. |
| 1 Equipment access | Minimal Equipment | `equipment: minimal`, `trainingEnvironment: minimal_equipment` | Prefers dumbbell/band/bench/bodyweight-compatible plans. | Progression uses reps, load when available, tempo, density, and range. | Explain low-equipment fit and any required substitutions. |
| 1 Equipment access | Bodyweight Only | `equipment: minimal`, `trainingEnvironment: bodyweight_only` | Strongly prefers bodyweight-safe templates. | Progression uses reps, tempo, range, harder variations, and density before load. | Must not show required gym-only movements. |
| 1 Equipment access | Running / Hybrid | `equipment: minimal`, `trainingEnvironment: running_hybrid` | Biases run/mobility, athletic, conditioning-friendly, or hybrid plans. | Can include run blocks, reset days, and lower-fatigue strength work. | Explain the hybrid weekly rhythm clearly. |
| 2 Training goal | Get stronger | `goal: strength` | Prefers strength base or powerbuilding templates. | Lower-rep anchors, longer rests, conservative load increases. | Explain main-lift strength exposure and recovery. |
| 2 Training goal | Build muscle | `goal: muscle` | Prefers hypertrophy, mass, or powerbuilding templates. | Volume accumulation and reps-first progression. | Explain volume, muscle focus, and gain support when Step 5 supports it. |
| 2 Training goal | Lean & athletic | `goal: lean_athletic` | Prefers athletic/recomp, balanced strength, and conditioning-friendly plans. | Moderate fatigue and sustainable density. | Explain athletic/recomp fit; use fat-loss language only with lower target weight. |
| 2 Training goal | General fitness | `goal: general_fitness` | Prefers sustainable, flexible, beginner-safe plans. | Balanced movement patterns and manageable progression. | Explain repeatability and consistency. |
| 3 Experience | Beginner | `level: beginner` | Filters away high-recovery or overly complex plans. | Starts conservatively and avoids aggressive week-to-week jumps. | Explain simpler structure and recovery. |
| 3 Experience | Intermediate | `level: intermediate` | Allows balanced volume and more structure. | Uses normal build weeks and stable anchors. | Explain progression and variety. |
| 3 Experience | Advanced | `level: advanced` | Allows higher workload only when the catalog supports it. | Should not pretend advanced-specific support exists if fallback is used. | Explain honest closest-fit tradeoff when needed. |
| 3 Frequency | 2 days | `daysPerWeek: 2` | Prefers 2-day full-body or minimal splits. | Each session must cover enough major patterns. | Show a clear low-frequency rhythm. |
| 3 Frequency | 3 days | `daysPerWeek: 3` | Prefers 3-day balanced structures. | Good default for strength base, full body, run + mobility. | Show three required sessions. |
| 3 Frequency | 4 days | `daysPerWeek: 4` | Enables upper/lower, powerbuilding, and higher-volume plans. | Supports split-specific progression. | Explain the four-day rhythm. |
| 3 Frequency | 5 days | `daysPerWeek: 5` | Enables higher-frequency hypertrophy/hybrid plans when compatible. | Must check recovery demand, especially for beginners. | If using a 4-day fallback, say so explicitly. |
| 3 Frequency | 6+ days | `daysPerWeek: 6` | Current catalog should use closest coherent plan rather than inventing a 6-day plan. | Prefer 5-day or 4-day base plus optional day. | Explain the fallback honestly. |
| 4 Focus | Chest | `focusAreas: chest` | Biases pressing and chest-tagged plans. | Adds or preserves chest accessories when feasible. | Mention chest focus only if visible in the first week. |
| 4 Focus | Back | `focusAreas: back` | Biases pulling volume and back-tagged plans. | Adds or preserves row/pulldown/back density. | Explain back emphasis if it affected the plan. |
| 4 Focus | Shoulders | `focusAreas: shoulders` | Biases delt/pressing support with beginner caution. | Adds shoulder work without excessive joint stress. | Avoid overpromising if equipment/frequency limits it. |
| 4 Focus | Arms | `focusAreas: arms` | Biases plans with accessory capacity. | Adds arm work after main anchors. | Position as extra emphasis, not the whole plan. |
| 4 Focus | Abs | `focusAreas: core` | Biases core support. | Adds core work without changing split type. | Explain core support if surfaced in sessions. |
| 4 Focus | Quads | `focusAreas: quads` | Biases squat/leg-press/lunge patterns. | Adds quad emphasis on lower/full-body days. | Explain visible lower-body focus. |
| 4 Focus | Glutes | `focusAreas: glutes` | Biases glute/lower-body and hypertrophy plans. | Adds hip thrust, hinge, lunge, bridge, or glute accessory priority. | Make glute focus explicit if selected. |
| 4 Focus | Hamstrings | `focusAreas: hamstrings` | Biases posterior-chain work. | Adds hinge/curl/hamstring support. | Mention only when first week includes it clearly. |
| 4 Focus | Calves | `focusAreas: calves` | Small accessory bias. | Adds calf work where it fits. | Should never outrank goal, equipment, or frequency. |
| 5 Bodyweight | Current weight | `currentWeightKg` | Provides baseline for target direction. | Enables current-to-target context. | Mention only with target or expectation framing. |
| 5 Bodyweight | Target above current | `targetWeightKg`, direction `gain` | Biases hypertrophy/gain explanation and scoring. | Frames progression as muscle-building support. | Explain gain support without nutrition promises. |
| 5 Bodyweight | Target below current | `targetWeightKg`, direction `loss` | Biases lean/recomp/fat-loss support and lower fatigue. | Emphasizes resistance training, consistency, and recovery. | Explain sustainable fat-loss support. |
| 5 Bodyweight | Target equals current | `targetWeightKg`, direction `maintain` | Biases general fitness/recomp framing. | Frames progress around performance and consistency. | Avoid bodyweight-change promises. |
| 5 Bodyweight | No target | `targetWeightKg: null` | Keeps Step 2 as the main signal. | Avoids bodyweight-specific framing. | Do not pretend weight target changed the plan. |

## Scoring Dimensions

| Dimension | Weight | Source | Notes |
| --- | ---: | --- | --- |
| Constraint fit | Required | Step 1, Step 3 | Hard fail if the plan requires unavailable equipment or unsafe recovery demand. |
| Goal fit | 35 | Step 2 | Primary ranking driver after constraints. |
| Frequency fit | 20 | Step 3 | Exact day match is preferred; coherent fallback is allowed with explanation. |
| Readiness fit | 15 | Step 3 | Beginner plans need lower complexity and recovery demand. |
| Focus fit | 12 | Step 4 | Max two soft preferences; cannot override hard constraints. |
| Bodyweight direction fit | 8 | Step 5 | Biases framing and fatigue, not the entire plan alone. |
| Catalog quality | 10 | Template metadata | Prefer complete, tested, content-safe plans. |

Confidence should be high when the winner matches equipment, goal, frequency, and readiness exactly. Confidence should drop when the engine uses a fallback day count, ignores a focus area, or has only low-catalog-depth options.

## High-Priority Scenario Tests

| Scenario | Input | Expected recommendation | Expected explanation | Expected weekly structure |
| --- | --- | --- | --- | --- |
| Full gym strength 3 days | Full Gym, Get stronger, beginner/intermediate, 3 days | `tpl_3_day_strength_base_v1` or equivalent strength base. | Strength anchors, manageable recovery, full-gym fit if useful. | 3 required sessions. |
| Full gym strength 4 days | Full Gym, Get stronger, intermediate, 4 days | `tpl_4_day_powerbuilding_v1` or equivalent strength-size plan. | Heavy compounds plus support volume. | 4 balanced upper/lower sessions. |
| Full gym strength 5 days | Full Gym, Get stronger, 5 days | 4-day strength fallback unless true 5-day strength exists. | Explain closest coherent fit and optional 5th day. | 4 required sessions plus optional accessory/recovery day. |
| Full gym muscle gain | Full Gym, Build muscle, current < target | Hypertrophy or 5-day hybrid plan where frequency matches. | Muscle-building volume and gain-support framing. | 3-5 sessions depending on Step 3. |
| Lean target path | Full Gym/Home, Lean & athletic, current > target | Sustainable recomp/fat-loss support plan. | Lower target means fat-loss support, not punishment. | Moderate recovery demand, especially for beginners. |
| General beginner path | Any compatible equipment, General fitness, beginner, 2-3 days | Full-body/minimal sustainable plan. | Repeatability, simple structure, consistency. | 2-3 low-friction sessions. |
| Home/minimal muscle | Home Gym or Minimal Equipment, Build muscle, 3-4 days | Low-equipment hypertrophy-safe plan or explained fallback. | Equipment tradeoff plus muscle intent. | Required sessions must be possible without commercial-gym-only movements. |
| Bodyweight-only beginner | Bodyweight Only, General fitness or Lean & athletic, beginner | Bodyweight/minimal full-body starter. | No-equipment fit and simple progression. | Bodyweight-safe sessions. |
| Running / Hybrid | Running / Hybrid, Lean & athletic or General fitness, 3-5 days | Run + mobility or athletic hybrid base. | Explain strength/cardio balance and any day-count fallback. | Run/reset/strength rhythm with optional add-ons when needed. |

## Current Recommendation Inputs

The scoring input currently uses:

- `goal`
- derived `profile.goalType`
- derived `profile.setupContext`
- derived `profile.weightDirection`
- `level`
- `daysPerWeek`
- `equipment`
- `trainingEnvironment`
- `secondaryOutcomes`
- `focusAreas`
- `weeklyMinutes`
- inferred `preferredSessionMinutes`
- `wantsConsistency`
- `currentWeightKg`
- `targetWeightKg`

It does not currently use:

- `gender`
- `age` / `ageRange`

`equipment` remains the broad compatibility field for old data. `trainingEnvironment` is the precise Step 1 field that prevents `Minimal Equipment`, `Bodyweight Only`, and `Running / Hybrid` from collapsing into the same plan.

## Current Program Catalog Gaps

| Gap | Why it matters | Candidate fix |
| --- | --- | --- |
| No true 5-day strength plan | Strength users can choose 5 days, but the best coherent current plan may be 4 days. | Keep the 4-day strength plus optional accessory-day fallback; add true 5-day strength later if demand supports it. |
| Limited home/minimal hypertrophy depth | Home Gym, Minimal Equipment, and Bodyweight Only need to feel different. | Add distinct home hypertrophy and bodyweight progression templates. |
| No true 6-day onboarding recommendation | Step 3 supports `6+`, but the catalog is not deep enough for a real 6-day plan. | Treat as high availability and recommend closest coherent 5-day or 4-day plan with explanation. |
| Focus areas are still mostly scoring tags | Users expect selected muscles to appear in the first week. | Add programme/session-level focus allocation metadata. |
| Target weight is only a light bias | Users expect target weight to influence expectations. | Keep it as explanation/scoring for MVP; later add adaptive progression and nutrition-adjacent guidance outside the template engine. |

## Proposed Test Order

1. Lock exact current 5-step input mapping: Step 1 environment, Step 2 goal, Step 3 level/frequency, Step 4 max-two focus areas, Step 5 weight direction.
2. Lock strong recommendation paths: full gym strength 3 days, full gym muscle 5 days, general beginner 3 days, bodyweight-only beginner.
3. Lock honest fallback paths: strength 5 days, 6+ days, running/hybrid 5 days, home/minimal muscle.
4. Verify plan-ready output includes selected programme name, weekly rhythm, first-week sessions, why-this-plan reasons, confidence, and fallback copy when needed.
