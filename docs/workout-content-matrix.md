# Source of Truth

This document is authoritative.
If any other document conflicts with this file, this file takes precedence.

**Type:** Implementation spec — workout content rules, content fit checks, and acceptance matrix by goal and equipment

---

# Workout Content Matrix

This document defines what the recommended workouts should contain after onboarding. It focuses on the actual session content: exercises, set/rep intent, equipment fit, and progression.

## Step 1-5 to Ready Plan Assembly

The ready plan must be constructible from the current five onboarding steps without AI generation. The engine can use AI_COACH later to explain or discuss the plan, but the template, session content, and starter block come from deterministic product data.

| Input layer | Decides | Required output |
| --- | --- | --- |
| Step 1 Equipment access | Which exercise menus and template variants are allowed. | A plan that can be performed with the selected environment and has realistic substitutions. |
| Step 2 Training goal | The main session intent and progression bias. | Strength, hypertrophy, recomp/general, or endurance content rules applied consistently. |
| Step 3 Training profile | Experience guardrails and weekly frequency. | A weekly rhythm with the selected day count or an explicitly explained fallback. |
| Step 4 Focus areas | Muscle-group emphasis inside compatible plans. | Visible first-week emphasis when feasible, without breaking the selected goal or equipment fit. |
| Step 5 Bodyweight progress | Bodyweight direction and expectation framing. | Plan explanation and progression framing that reflect gain, loss, maintain, or no target. |

The minimum plan-ready payload should include:

- selected template / programme id
- user-facing plan name and subtitle
- days per week and first-week session list
- session guidance for each day: warmup, main focus, support focus, rest, estimated duration, progression hint, first action
- 4-week starter block metadata from `docs/recommendation-4-week-programme-contract.md`
- recommendation confidence and fallback reason when applicable
- `why this plan` reasons tied back to the user's Step 1-5 answers

If any of these fields cannot be generated from catalog data, the issue is a content gap, not something AI_COACH should invent.

## Content Rules

| Goal type | Session intent | Exercise mix | Set / rep bias | Progression bias |
| --- | --- | --- | --- | --- |
| Strength | Improve main lift performance. | 1-2 heavy compounds, 1-2 secondary compounds, 1-2 accessories. | Main lifts mostly 3-6 reps; support work 6-12 reps. | Add load only after clean reps at the top of the range. |
| Hypertrophy / gain | Build muscle with enough recoverable volume. | Compounds plus more accessory volume for target muscles. | Mostly 6-15 reps. | Add reps first, then load. |
| Fat loss / recomp | Keep strength and muscle while managing fatigue. | Simple full-body or upper/lower training plus optional conditioning. | Moderate reps, lower friction, avoid excessive high-fatigue days for beginners. | Maintain quality and consistency before adding load. |
| Endurance / cardio | Build run/cardio habit with mobility support. | Easy run, tempo/intervalling, long/easy add-ons, reset work. | Run blocks and mobility rounds. | Add total blocks or duration gradually. |
| Home / bodyweight | Train without full-gym dependency. | Squat/lunge, push-up, row/pull, hinge, core. | Mostly bodyweight reps or timed holds. | Progress through reps, tempo, range, and harder variations. |

## Automated Content Fit Checks

The test suite now validates representative recommendation paths with `evaluateWorkoutContentFit`.

| Path | Representative program | Checked signals |
| --- | --- | --- |
| Strength | `tpl_4_day_powerbuilding_v1` | Low-rep loaded anchors exist, primary strength set count is high enough, and full-gym exercises are allowed only because setup is full gym. |
| Muscle gain | `tpl_5_day_hybrid_v1` | Enough hypertrophy volume, accessory work, and weekly set count. |
| Fat loss | `tpl_3_day_full_body_v1` | Moderate density, session length at or below 55 min, loaded resistance work exists, and no false run-work signal. |
| Endurance | `tpl_3_day_run_mobility_v1` | At least two explicit run/cardio exposures and mobility work exist; no full-gym-only dependency. |
| Home/bodyweight | `tpl_2_day_minimal_full_body_v1` | No full-gym-only exercises; enough bodyweight-friendly work. |

The current signal set includes exercise count, accessory count, bodyweight count, weekly set count, primary set count, run exercise count, loaded exercise count, technical lift count, session density, average duration, low-rep anchors, hypertrophy volume, run work, mobility work, resistance work, and full-gym-only dependency.

## User-Ready Acceptance Matrix

| Path | Must recommend | Must explain | Must include |
| --- | --- | --- | --- |
| Full gym + Strength + 2 days | Beginner strength | Low frequency strength base | Heavy squat/press/hinge/pull exposure |
| Full gym + Strength + 3 days | Strength base | Heavy anchors with manageable recovery | 3 required strength days |
| Full gym + Strength + 4 days | Powerbuilding or strength-size | Heavy + support volume | 4 balanced upper/lower days |
| Full gym + Strength + 5 days | 4-day strength fallback | 5th day is optional | Explicit optional accessory/recovery day |
| Full gym + Muscle + gain target | Hypertrophy plan | Volume supports gain target | Enough compounds and accessories |
| Lose weight + lower target | Sustainable resistance plan | Target means fat-loss bias | Moderate full-body strength plus optional conditioning |
| Home + Muscle | Home/bodyweight-safe plan | No gym-only dependency | Bodyweight push/pull/legs/core |
| Outdoor + Endurance | Run + mobility | Run/cardio is primary | Easy run, tempo/stride, reset work |

## Session Quality Output

Each ready-template session now has generated guidance from the template data. This keeps the user-facing plan consistent without manually writing separate copy for every day.

| Output field | What it answers |
| --- | --- |
| `warmup` | How the user should prepare before the first hard block. |
| `mainFocus` | The main lift, run block, or movement focus for the day. |
| `supportFocus` | The accessory or support work that rounds out the session. |
| `restGuidance` | Main-work and support-work rest ranges from the actual exercise prescriptions. |
| `estimatedDuration` | Expected session length from the selected template. |
| `progressionHint` | How to progress the session next time. Bodyweight plans use rep/range/variation progress instead of load progress. |
| `firstAction` | The first practical thing the user should do when starting the session. |

## Training Block Model

The recommended week is the first week of a continuing 4-week starter block, not a one-off plan.

Detailed programme-generation rules live in `docs/recommendation-4-week-programme-contract.md`. This section summarizes the current content expectations that tests should enforce.

| Week | Role | What happens |
| --- | --- | --- |
| Week 1 | Baseline | Learn the sessions, find repeatable loads or variations, and log clean starting data. |
| Week 2 | Build | Repeat the same weekly structure and add reps or load only when week 1 was clean. |
| Week 3 | Build | Keep the same structure and push the best-performing lifts or blocks slightly forward. |
| Week 4 | Review + easier week | Reduce fatigue, review how the block went, then repeat, edit, or move to a harder block. |

Recommendation output now exposes `recommendationConfidence`, `fallbackReason`, and `trainingBlock` so a close match can be explained honestly before UI work is added.

## Substitution Readiness

Every ready-template exercise must point to a substitution group that exists and includes the exercise itself. Substitution groups must provide at least two realistic options so a user is not stuck if one movement or station is unavailable.

| Area | Current rule |
| --- | --- |
| Full gym compounds | Alternatives can use barbells, dumbbells, machines, and cables. |
| Full gym accessories | Isolation groups must include at least one realistic same-muscle alternative. |
| Bodyweight groups | Alternatives must stay bodyweight/home-safe and avoid full-gym-only movements. |
| Running/cardio | Running block alternatives stay within run/stride/tempo work. |

Current targeted fixes:

- `calves`: added standing and seated calf raise alternatives.
- `accessory_hamstrings`: added seated and lying leg curl alternatives.
- `bodyweight_hinge`: replaced gym-biased hip thrust alternative with single-leg glute bridge and hamstring walkout.

## Final Regression Coverage

The final user-ready regression suite checks the highest-risk onboarding combinations end to end. Each scenario must produce a recommendation definition, clean content-fit result, explanation text, weekly structure, confidence metadata, and a 4-week training block.

Covered paths:

- Strength 2, 3, 4, and 5 days.
- Muscle 3, 4, and 5 days.
- Muscle gain with a higher target weight.
- Fat-loss support with a lower target weight.
- Home/bodyweight muscle.
- Outdoor/endurance 3, 4, and 5 days.
- Beginner 5-day request, guarded against high-recovery output.

## Review Artifact Workbook

The spreadsheet mirror lives at `outputs/onboarding-recommendation/onboarding-recommendation-engine.xlsx`. It is generated from the current recommendation catalog and compiled test modules so reviewers can inspect the same decisions the engine currently makes.

Workbook tabs:

- `Summary`: release standard, guardrails, 4-week block model, fallback behavior, and artifact status.
- `Scenario Matrix`: acceptance paths with actual recommended program, explanation, weekly summary, confidence, and fallback metadata.
- `Program Catalog`: ready templates, days, session length, equipment tier, recovery demand, style tags, exercise count, weekly set count, and exercise preview.
- `Content Fit Checks`: representative paths with content-fit issues and validation signals.
- `Session Quality`: every ready session with warmup, main focus, support focus, rest, duration, progression hint, and first action.
- `Catalog Gaps`: known non-blocking gaps and preferred later fixes.
- `Final User-Ready Checklist`: high-risk regression scenarios and pass/review gates.

## Audit Findings

| Finding | Impact | Status |
| --- | --- | --- |
| Low-equipment starter previously depended on full-gym movement patterns. | Home/bodyweight users could receive a plan they cannot realistically do. | Fixed by replacing gym-only lifts with bodyweight squat/lunge, push, pull, hinge, and core work. |
| Run-work detection could be too broad if it matched partial words. | Non-running plans could look like they contain cardio work. | Fixed by checking explicit run/running/stride/tempo terms only. |
| Fat-loss quality checks did not require resistance training. | A mobility-only recovery plan could pass as a fat-loss plan even though it does not preserve strength or muscle well. | Fixed by adding a resistance-work signal and test. |

## Current Ready Program Content

| Program | Current role | Good for | Must contain | Current status |
| --- | --- | --- | --- | --- |
| `tpl_3_day_strength_base_v1` | 3-day strength base | Full gym strength 3 days | Squat/press/hinge anchors, full-body support | Good current base. |
| `tpl_4_day_powerbuilding_v1` | 4-day strength + muscle base | Full gym strength 4 days and 5-day strength fallback | Upper/lower strength days plus volume days | Good current base; 5th day handled by weekly structure add-on. |
| `tpl_5_day_hybrid_v1` | 5-day hypertrophy/gain | Full gym muscle gain 5 days | Higher-frequency upper/lower/push/pull/lower structure | Good current base. |
| `tpl_3_day_full_body_v1` | Recomp / general fitness | Fat loss or general beginner 3 days | Simple full-body lifting with sustainable fatigue | Good current base. |
| `tpl_2_day_minimal_full_body_v1` | Home/bodyweight starter | Home workout, bodyweight, low-equipment fallback | Bodyweight squat/lunge, push, pull, hinge, core | Updated to avoid full-gym-only exercises. |
| `tpl_3_day_run_mobility_v1` | Endurance base | Outdoor/running endurance 3-5 days | Easy run, tempo day, reset day | Good current base; 4-5 days handled by weekly structure add-ons. |
| `tpl_2_day_mobility_reset_v1` | Recovery / mobility fallback | Low-friction entry, mobility-heavy general users | Mobility, stretch, breath reset | Good current base. |
| `tpl_2_day_yoga_recovery_v1` | Recovery alternative | Extra movement / optional endurance support | Yoga flow, balance, mobility | Good current alternative. |

## Current Content Gaps

| Gap | Why it matters | Preferred fix |
| --- | --- | --- |
| No true 5-day strength template | Some strength users want 5 full training days. | Keep current 4-day strength + optional accessory fallback for now; add true 5-day strength later if needed. |
| No dedicated 4-day home hypertrophy template | Home + muscle currently starts from a 2-day bodyweight base plus add-ons. | Add a real 3-4 day home/bodyweight muscle template later. |
| Endurance has no dedicated 4/5-day template | Current add-ons are useful, but not a full running plan. | Add 4/5-day endurance templates if this path becomes important. |
| Exercise equipment tags are not attached directly to ready-template exercises | We infer fit from template choice and exercise names. | Add explicit equipment metadata per template exercise if swaps become more advanced. |
