# Source of Truth

This document is authoritative.
If any other document conflicts with this file, this file takes precedence.

**Type:** Implementation spec — programme payload structure, duration model, progression variables, session composition, prep/recovery rules, copy contract
**Scope:** Owns programme construction after a template is selected. Template selection is owned by `onboarding-impact-matrix.md`. Workout content validation is owned by `workout-content-matrix.md`. These are complementary, not overlapping.

---

# Recommendation Programme Contract

This document defines the deterministic programme layer that turns an onboarding recommendation into a concrete training plan.

The programme system must support different block lengths over time. The MVP output is a 4-week starter block, but the domain model must not be named or structured as if every programme is always 4 weeks.

## Product Boundary

Programme construction is core product logic. GAINER AI can later explain a selected programme, compare alternatives, or suggest guarded changes, but it must not invent the programme or override deterministic selection.

| Allowed in MVP | Not allowed in MVP |
| --- | --- |
| Deterministic programme block from template data. | Free-form AI-generated programmes. |
| MVP 4-week starter block for onboarding recommendations. | Pretending every catalog programme is fully implemented when it is only reference content. |
| Goal-specific progression rules. | Nutrition promises or bodyweight guarantees. |
| Equipment-aware exercise progression. | Required exercises that violate Step 1 equipment access. |
| Honest fallback copy when the catalog is shallow. | Pretending a 6-day or 5-day strength plan exists when it does not. |
| Repeat/edit/switch decision after a block ends. | Automatic programme switching without explicit user action. |

## Duration Model

The programme payload should use `blockLengthWeeks` as a variable, not as a hard-coded product concept. Different durations serve different product jobs.

| Duration | Status | Product job | When to use |
| --- | --- | --- | --- |
| 4 weeks | MVP | Starter block after onboarding. Gives the user a concrete first plan quickly. | Default recommendation output for `yourplan`. |
| 6 weeks | Later | Short full programme with more time for accumulation and review. | Good for general fitness, beginner strength, lean/athletic, and low-equipment plans. |
| 8 weeks | Later | Standard hypertrophy/strength programme with clearer progression phases. | Good for muscle, powerbuilding, glute priority, and strength base. |
| 10-12 weeks | Reference / catalog | Longer curated programmes. | Useful for ready plans and manual programme selection, not default onboarding MVP. |
| 16+ weeks | Reference only | Advanced specialization. | Not an onboarding recommendation unless the user explicitly chooses an advanced plan later. |

MVP rule: onboarding creates a 4-week starter block even when the reference source programme is 8, 10, or 12 weeks. The starter block can be repeated, edited, or upgraded after week 4.

## Required Programme Payload

Each recommended programme should produce this minimum payload.

| Field | Type / shape | Purpose |
| --- | --- | --- |
| `programId` | string | Selected ready-template or programme id. |
| `familyId` | `TemplateFamilyId` | Programme family used for progression rules. |
| `blockLengthWeeks` | number | Current block length. MVP default is `4`. |
| `durationModel` | structured object | Whether this is starter, standard, long catalog, or advanced reference. |
| `phaseLabels` | string[] | User-facing week or phase labels. |
| `weekRoles` | role[] | Machine-readable week roles such as `baseline`, `build`, `push`, `review`, `deload`. |
| `weeklySchedule` | generated weeks | Sessions copied from the template with week-specific progression notes. |
| `sessionComposition` | structured object | Prep, main, support, focus, conditioning, cooldown blocks. |
| `progressionRules` | structured object | Volume, intensity, exercise-stability, and easier-week rules. |
| `goalProfile` | structured object | How the Step 2 goal changes progression. |
| `equipmentProfile` | structured object | How Step 1 changes allowed progression levers. |
| `focusAllocation` | structured object | How Step 4 focus areas are surfaced in sessions. |
| `readinessGuardrails` | structured object | How Step 3 level/frequency controls fatigue. |
| `planReadySummary` | strings | Copy for `yourplan`: why this plan, what to expect, first action. |
| `fallbackReason` | string / null | Honest explanation when exact fit is not available. |
| `confidence` | high / medium / low | How strongly the engine trusts the selected plan. |

## MVP: 4-Week Starter Block

The weekly structure stays stable across the block. The user should not feel like they are learning a new plan every week.

| Week | Role | User-facing label | Training intent | What changes from previous week |
| --- | --- | --- | --- | --- |
| 1 | `baseline` | `Week 1: Find your baseline` | Learn the sessions and log repeatable starting data. | Nothing yet; choose conservative loads, variations, or run pace. |
| 2 | `build` | `Week 2: Build the rhythm` | Repeat the same week and add a small progression only where week 1 was clean. | Add reps, small load, one set, tighter rest, or slightly longer run block depending on goal/equipment. |
| 3 | `build` | `Week 3: Push the best work` | Progress the strongest parts of the plan while keeping form and recovery stable. | Add another small progression to priority lifts, focus areas, or conditioning blocks. |
| 4 | `review` | `Week 4: Review and recover` | Reduce fatigue, keep the habit, and decide the next step. | Drop volume or density, keep movement quality high, and surface repeat/edit/switch options. |

Week 4 is an easier review week, not a full stop. The user should still train, but the plan should reduce fatigue enough that repeating or upgrading the block feels realistic.

## Later: 6-8 Week Programme Shapes

Longer programmes use the same template and session composition model, but the phase arc gets more room.

| Duration | Phase model | Notes |
| --- | --- | --- |
| 6 weeks | Baseline → Build → Build → Easier pivot → Build → Review | Good for sustainable plans where the user needs a reset before another build week. |
| 8 weeks | Baseline → Build → Build → Easier pivot → Build → Build → Consolidate → Review/deload | Good for hypertrophy, strength, glute priority, and powerbuilding once the catalog supports it. |

Later versions should not require a new recommendation engine. They should extend this contract by changing `blockLengthWeeks`, `phaseLabels`, `weekRoles`, and week-specific progression rules.

## Session Composition Contract

Every session should be understandable as a sequence of blocks, not just a list of exercises.

| Block | Required? | Purpose | Examples |
| --- | --- | --- | --- |
| `prepBlock` | Yes | Prepare the body and pattern for the session. | Dynamic mobility, activation, light ramp sets. |
| `mainBlock` | Yes | The primary lift, run block, circuit, or skill focus. | Squat, bench, hip thrust, easy run, HIIT block. |
| `supportBlock` | Usually | Secondary compounds or high-value support work. | Row, RDL, pulldown, lunge, machine press. |
| `focusBlock` | Optional | Step 4 muscle-focus work when feasible. | Glute bridge, lateral raise, curls, core finisher. |
| `conditioningBlock` | Optional | Athletic, lean/recomp, HIIT, or running work. | Intervals, circuits, carries, moderate cardio. |
| `cooldownBlock` | Optional but recommended | Reduce session friction and support recovery. | Mobility, stretching, breathing, easy walk. |

The plan-ready UI can show these blocks directly. If the current template data only has exercises, the programme layer should derive block roles from exercise order, muscles, equipment, reps, rest, and goal profile.

## Prep, Warmup, and Cooldown Rules

Warmup and cooldown should be productized as session guidance, not treated as normal working sets.

| Rule | Requirement |
| --- | --- |
| Warmup is separate from working sets | Warmup sets do not count toward progression, completion rate, or weekly hard-set totals. |
| Prep must match the session | Lower-body days need hips/ankles/glutes or ramp squats; upper days need shoulders/t-spine/scapular prep; running days need dynamic lower-leg prep. |
| Heavy compound sessions need ramping | Add 1-3 ramp-up sets before the first heavy barbell or machine anchor. |
| Bodyweight sessions need movement prep | Use range, tempo, and easier variations before harder working sets. |
| Cooldown is short by default | 3-8 minutes is enough for MVP. Avoid turning every workout into a long mobility class. |
| Static stretching before heavy work is not default | Longer holds belong after training or in recovery/mobility sessions. |
| Beginner and joint-friendly plans get more prep | They should start with lower-risk movement rehearsal before loading. |

Recommended prep templates:

| Session type | Prep direction |
| --- | --- |
| Heavy strength | General pulse raise, joint-specific mobility, ramp sets for first anchor lift. |
| Hypertrophy upper | Shoulder/scapular prep, light pressing or pulling ramp, first exercise rehearsed. |
| Hypertrophy lower / glutes | Hip mobility, glute activation, bodyweight squat/lunge rehearsal, ramp sets. |
| Full body beginner | 3-5 simple dynamic movements, then easy first-set rehearsal. |
| Lean/athletic / HIIT | Dynamic full-body prep and gradual intensity ramp before intervals. |
| Running/hybrid | Ankles, calves, hips, glutes, easy run ramp before quality work. |
| Mobility/recovery | Gentle range work first, then longer positions later. |

Recommended cooldown templates:

| Session type | Cooldown direction |
| --- | --- |
| Heavy lower | Hip flexor, hamstring, quad, glute, and breathing reset. |
| Heavy upper | Pec, lat, t-spine, shoulder, and breathing reset. |
| HIIT / conditioning | Easy walk or low-intensity movement, then short breathing reset. |
| Running/hybrid | Calves, hip flexors, glutes, ankles, and easy downshift. |
| Joint-friendly | Low-irritation mobility and balance, not aggressive stretching. |
| Bodyweight/home | Short mobility finisher based on the hardest movement pattern. |

## Progression Variables

The programme engine should choose progression levers by goal, equipment, and readiness.

| Variable | Applies to | How it progresses | Guardrail |
| --- | --- | --- | --- |
| Load | Strength, hypertrophy, full-gym plans | Add small load when all prescribed reps are clean. | Do not add load after missed reps or poor form. |
| Reps | Hypertrophy, bodyweight, low equipment | Add reps within the target range before adding load. | Cap at the top of the range before changing load/variation. |
| Sets | Hypertrophy, focus areas | Add one set to priority muscles in week 2 or 3. | Do not add sets for beginner high-frequency plans by default. |
| Rest | Lean/athletic, general fitness, low equipment | Shorten rest slightly after quality is stable. | Do not reduce rest on heavy strength anchors. |
| Tempo / range | Bodyweight, joint-friendly, low equipment | Use slower eccentrics, pauses, or larger range. | Do not make movement harder if pain or form breaks down. |
| Variation difficulty | Bodyweight, home plans | Move to a harder exercise variation. | Only after top-end reps are clean. |
| Density | Athletic/recomp, conditioning | Add rounds or reduce idle time. | Keep total fatigue moderate for beginners. |
| Run duration / blocks | Running/hybrid | Add time or intervals gradually. | No aggressive jump in total running volume. |

## Goal Profiles

### Strength

| Area | Rule |
| --- | --- |
| Main lifts | Keep anchors stable for the whole block. |
| Week 1 | Conservative baseline loads, mostly 2-3 reps in reserve. |
| Build weeks | Add load only when all work sets were clean. Push one or two key anchors, not every lift. |
| Easier/review week | Reduce heavy-set volume and avoid new max attempts. |
| Yourplan copy | "This starts with repeatable strength work, then builds only when your logged sets are clean." |

### Muscle / Hypertrophy

| Area | Rule |
| --- | --- |
| Main lifts | Keep compounds stable and use accessories for extra volume. |
| Week 1 | Find repeatable weights in moderate rep ranges. |
| Build weeks | Add reps first; add one accessory set only for priority muscles if recovery is good. |
| Easier/review week | Reduce accessory volume and keep pumps easy-to-moderate. |
| Yourplan copy | "This uses repeated muscle exposure and small volume increases instead of random exercise changes." |

### Lean & Athletic / Recomposition

| Area | Rule |
| --- | --- |
| Main lifts | Preserve resistance training quality before adding conditioning. |
| Week 1 | Establish a sustainable lifting and conditioning rhythm. |
| Build weeks | Progress one strength area and one conditioning/density area. |
| Easier/review week | Pull density back and keep the week easy enough to repeat. |
| Yourplan copy | "This supports a leaner, more athletic goal without turning every session into a fatigue test." |

### General Fitness

| Area | Rule |
| --- | --- |
| Main lifts | Prioritize simple full-body movement patterns. |
| Week 1 | Learn the routine and finish sessions feeling repeatable. |
| Build weeks | Add small reps or load to the easiest wins. |
| Easier/review week | Keep the same habit with lower pressure and review what felt best. |
| Yourplan copy | "This is built to be sustainable first, then progressively harder when the routine is stable." |

### Running / Hybrid

| Area | Rule |
| --- | --- |
| Main work | Keep run, mobility, and strength days clearly separated. |
| Week 1 | Establish easy run pace, mobility reset, and strength baseline. |
| Build weeks | Progress one strength exposure and one running/cardio exposure if soreness is controlled. |
| Easier/review week | Reduce run density and keep mobility/reset work prominent. |
| Yourplan copy | "This gives you a clear hybrid rhythm instead of mixing random cardio into every workout." |

## Frequency Rules

The programme should preserve the user's selected frequency when a coherent template exists. If not, it should recommend the closest coherent plan and make optional days explicit.

| Selected frequency | Required behavior |
| --- | --- |
| 2 days | Use full-body or minimal split. Both sessions must cover enough major patterns. |
| 3 days | Use the strongest default for strength base, full body, hypertrophy starter, or run + mobility. |
| 4 days | Use upper/lower, powerbuilding, or balanced split when equipment and goal support it. |
| 5 days | Use higher-frequency hypertrophy/hybrid only when recovery demand is acceptable. Strength may fall back to 4 required days plus optional accessory day. |
| 6+ days | Treat as high availability. Recommend a 5-day or 4-day base plus optional recovery/cardio/accessory day; do not invent a 6-day programme in MVP. |

Optional days must never be required for the plan to work. They should be named clearly as `Optional accessory`, `Optional easy cardio`, `Optional mobility`, or `Optional recovery`.

## Focus Area Allocation

Step 4 focus areas should be visible in the first week when feasible, but they are not allowed to break the plan.

| Focus type | Allocation rule |
| --- | --- |
| Chest / Back / Shoulders | Add emphasis through upper-body accessories or repeated exposure. |
| Arms | Add accessory work after main lifts, not instead of compounds. |
| Abs / Core | Add core finishers or support blocks without changing split type. |
| Quads / Glutes / Hamstrings | Add lower-body emphasis through squat, hinge, lunge, thrust, curl, or bridge patterns. |
| Calves | Add accessory work only where session length allows. |

If the selected focus area cannot be meaningfully shown because of equipment, frequency, or plan family, the explanation should say the plan prioritizes the main goal first and keeps the focus area as secondary.

## Readiness Guardrails

| User profile | Programme behavior |
| --- | --- |
| Beginner | Keep week 1 conservative, limit new exercises, avoid high-recovery 5-day output, progress only after clean logs. |
| Intermediate | Use normal build weeks, add volume or intensity in build phases, keep anchors stable. |
| Advanced | Allow higher workload only when the catalog supports it; otherwise explain closest-fit fallback. |
| Beginner + 5 days | Prefer moderate output or a 4-day base plus optional day instead of forcing five hard sessions. |
| Any user + low confidence | Show primary plus alternatives and avoid overconfident copy. |

## Equipment Progression Rules

| Equipment environment | Allowed progression |
| --- | --- |
| Full Gym | Load, reps, sets, machines/cables, accessory variety, stable anchors. |
| Home Gym | Load/reps where equipment allows, fewer machine assumptions, clear swaps. |
| Minimal Equipment | Reps, tempo, density, range, limited load increases, unilateral work. |
| Bodyweight Only | Reps, tempo, range, variation difficulty, density, holds. |
| Running / Hybrid | Run time/blocks, conditioning density, mobility quality, low-fatigue strength. |

## Reference Content From Gainer Program

The folder `D:\Gymlog dokumentointi\Gainer Program` is useful as reference content, not as direct production import.

| Source | Finding | Use |
| --- | --- | --- |
| `gainer-programs.json` | Smaller 5-program subset. | Useful quick sample data, but not the full catalog. |
| `gainer-programs.xlsx` | Built workbook with `Programs`, `Workouts`, and `Exercises` sheets. | Useful reviewer artifact for program/session/exercise shape. |
| `build_xlsx.py` | Wider 20-program source catalog. | Best source for extracting patterns, session structures, warmup/cooldown candidates, and catalog gaps. |

Important guardrail: do not import this catalog as-is into onboarding recommendations. Some programmes are too advanced, too long, gender-positioned, or too high-volume for first-run MVP.

Useful reference patterns:

| Reference program | Useful for | Guardrail |
| --- | --- | --- |
| `fullbody` / `strength_5x5` style patterns | Beginner 3-day strength/full-body starter. | Keep volume conservative and add prep/ramp sets. |
| `upperlower`, `expert_powerbuilding` | Upper/lower and heavy + volume architecture. | Expert variants are not onboarding defaults. |
| `dream_body_man`, `beginner_bro_split`, `advanced_ppl` | Hypertrophy split patterns and exercise density. | Rename/neutralize positioning; advanced PPL is not beginner-safe. |
| `glute_foundations`, `advanced_glutes` | Glute focus, activation, hip thrust/hinge/lunge sequencing. | Beginner glute work should start with activation and controlled volume. |
| `fat_burn_hiit`, `lean_shred` | Lean/athletic conditioning and density patterns. | Avoid making fat-loss plans punishing or cardio-only. |
| `mobility_flow` | Cooldown, mobility, recovery, and prep library. | Use short snippets inside plans, not 20-30 min mobility blocks by default. |
| `at_home_beginner`, `calisthenics_mastery` | Bodyweight and no-equipment progression. | Calisthenics skill work belongs later unless explicitly selected. |
| `joint_friendly` | Supported machine/bodyweight patterns and low-irritation progressions. | Do not treat as medical rehab. |
| `runners_strength` | Running/hybrid strength, calf/ankle/core/mobility support. | Running volume progression needs separate guardrails. |
| `prenatal_fitness`, `postpartum_recovery` | Recovery and low-impact movement examples. | Do not recommend without explicit safety policy and disclaimers. |

## Plan-Ready Copy Contract

`yourplan` should be able to show these sections directly from programme metadata.

| UI section | Required content |
| --- | --- |
| Plan title | User-facing plan or template family name. |
| Subtitle | One sentence combining goal, frequency, and plan style. |
| Why this plan | 2-4 reasons tied to Step 1-5 answers. |
| Your week | First-week session list with days, labels, and estimated duration. |
| Programme arc | Phase labels with one short sentence each. MVP shows Week 1-4. Later versions may show phases instead of every week. |
| How to progress | Goal/equipment-specific progression rule. |
| Prep / recovery | Short explanation of warmup/cooldown approach when relevant. |
| If this feels too much | Easier-week or fallback guidance. |
| First action | Start the first session or review the weekly rhythm. |

The copy must avoid claiming guaranteed bodyweight change, muscle gain, or strength outcomes. It should frame the plan as structured support for the user's goal.

## Example Output Shapes

### MVP: Full Gym + Get Stronger + 3 Days + Beginner

| Week | Output |
| --- | --- |
| Week 1 | Learn the three strength sessions and log conservative baseline loads. |
| Week 2 | Add small load only to lifts where all sets were clean. |
| Week 3 | Push the best 1-2 main lifts; keep accessories stable. |
| Week 4 | Reduce heavy-set fatigue and review whether to repeat or build. |

Required plan-ready explanation:

- matches 3 available days
- uses full-gym strength anchors
- beginner-friendly because progression waits for clean logs
- includes ramp-up guidance before heavy anchors

### MVP: Full Gym + Build Muscle + 5 Days + Gain Target

| Week | Output |
| --- | --- |
| Week 1 | Establish repeatable loads and volume across the five-day split. |
| Week 2 | Add reps to priority muscles and keep rest consistent. |
| Week 3 | Add load or one set to the best-recovering focus areas. |
| Week 4 | Reduce accessory volume and review readiness for another build block. |

Required plan-ready explanation:

- uses higher-frequency hypertrophy structure
- supports gain target through volume progression
- keeps exercise menu stable enough to track progress
- uses short muscle-specific prep before the first hard block

### MVP: Bodyweight Only + General Fitness + 3 Days + Beginner

| Week | Output |
| --- | --- |
| Week 1 | Learn bodyweight squat/lunge, push, pull, hinge, and core patterns. |
| Week 2 | Add reps or range to the easiest movements. |
| Week 3 | Use slightly harder variations only where week 2 was clean. |
| Week 4 | Reduce density and keep the routine repeatable. |

Required plan-ready explanation:

- no gym equipment required
- sustainable 3-day full-body rhythm
- progress comes from reps, tempo, range, and variation difficulty
- warmup uses movement rehearsal rather than load ramping

### MVP: Running / Hybrid + Lean & Athletic + 4-5 Days

| Week | Output |
| --- | --- |
| Week 1 | Establish the run, strength, and mobility rhythm. |
| Week 2 | Add a small run block or conditioning progression. |
| Week 3 | Progress one strength exposure and one cardio exposure. |
| Week 4 | Pull back density and keep mobility/reset work clear. |

Required plan-ready explanation:

- hybrid rhythm is intentional
- not every day is a hard lifting day
- optional days are clearly marked if the base template is fewer than requested days
- cooldown emphasizes calves, hips, breathing, and mobility after run/conditioning days

## Acceptance Criteria

A programme contract is ready for MVP when:

- every onboarding recommendation result has a `blockLengthWeeks: 4` starter programme profile
- the payload can later support `blockLengthWeeks: 6` or `8` without renaming the model
- every week has a role, user-facing label, and short explanation
- the first week is built from real template sessions
- weeks 2-4 explain how the same sessions progress
- every session has a derived or explicit `prepBlock`
- cooldown guidance exists for lower-body, HIIT, running/hybrid, joint-friendly, and beginner paths
- goal-specific progression differs between strength, muscle, lean/athletic, general fitness, and running/hybrid
- equipment-specific progression differs between full gym, minimal, bodyweight, and running/hybrid paths
- beginner and high-frequency guardrails can lower intensity or explain fallback
- `yourplan` can render the plan without inventing copy
- GAINER AI is not required for any part of programme creation

## Implementation Notes

The current `RecommendationProgrammeProfile` already has a useful starting shape: `blockLengthWeeks`, `progressionStyle`, `phaseLabels`, `volumeProgression`, `intensityProgression`, `exerciseStability`, and `easierWeek`.

The next implementation pass should expand it with:

- `durationModel`
- per-week programme phases instead of only `phaseLabels`
- session block metadata: `prepBlock`, `mainBlock`, `supportBlock`, `focusBlock`, `conditioningBlock`, `cooldownBlock`
- goal-specific progression text
- equipment-specific progression text
- focus-area allocation summary
- readiness guardrail summary
- plan-ready copy fields
- optional-day metadata for fallback frequencies
- reference-source tags when a session pattern comes from the Gainer Program catalog

Keep the implementation deterministic and testable. If a field is needed by `yourplan`, it should come from typed programme metadata, not ad hoc UI copy.
