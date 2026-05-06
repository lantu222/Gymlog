# Recommendation 4-Week Programme Contract

This document defines the deterministic 4-week programme layer that turns an onboarding recommendation into a concrete starter plan. It is the source of truth for programme metadata, `yourplan` plan-ready content, and the next implementation pass in `recommendationProgramme.ts`.

The goal is not to generate a perfect long-term training programme. The MVP goal is narrower:

- give the user a credible first 4 weeks immediately after onboarding
- keep the same weekly rhythm from the recommended template
- show how week 1 progresses into weeks 2-4
- explain the plan without AI generation
- expose enough structure that future UI can show the full 4-week plan, not only the first week

## Product Boundary

The 4-week programme is core product logic. AI_COACH can later explain it, compare options, or suggest guarded changes, but it must not invent the programme.

| Allowed in MVP | Not allowed in MVP |
| --- | --- |
| Deterministic 4-week starter block from template data. | Free-form AI-generated plans. |
| Goal-specific progression rules. | Nutrition promises or bodyweight guarantees. |
| Equipment-aware exercise progression. | Required exercises that violate Step 1 equipment access. |
| Honest fallback copy when the catalog is shallow. | Pretending a 6-day or 5-day strength plan exists when it does not. |
| Repeat/edit/switch decision after week 4. | Automatic plan switching without explicit user action. |

## Required Programme Payload

Each recommended programme should produce this minimum payload.

| Field | Type / shape | Purpose |
| --- | --- | --- |
| `programId` | string | Selected ready-template or programme id. |
| `familyId` | `TemplateFamilyId` | Programme family used for progression rules. |
| `blockLengthWeeks` | `4` | Fixed MVP starter-block length. |
| `phaseLabels` | 4 strings | User-facing week labels. |
| `weekRoles` | `baseline`, `build`, `build`, `review` | Machine-readable week roles. |
| `weeklySchedule` | 4 generated weeks | Sessions copied from the template with week-specific progression notes. |
| `progressionRules` | structured object | Volume, intensity, exercise-stability, and easier-week rules. |
| `goalProfile` | structured object | How the Step 2 goal changes progression. |
| `equipmentProfile` | structured object | How Step 1 changes allowed progression levers. |
| `focusAllocation` | structured object | How Step 4 focus areas are surfaced in sessions. |
| `readinessGuardrails` | structured object | How Step 3 level/frequency controls fatigue. |
| `planReadySummary` | strings | Copy for `yourplan`: why this plan, what to expect, first action. |
| `fallbackReason` | string / null | Honest explanation when exact fit is not available. |
| `confidence` | high / medium / low | How strongly the engine trusts the selected plan. |

## Four-Week Phase Model

The weekly structure stays stable across the block. The user should not feel like they are learning a new plan every week.

| Week | Role | User-facing label | Training intent | What changes from previous week |
| --- | --- | --- | --- | --- |
| 1 | `baseline` | `Week 1: Find your baseline` | Learn the sessions and log repeatable starting data. | Nothing yet; choose conservative loads, variations, or run pace. |
| 2 | `build` | `Week 2: Build the rhythm` | Repeat the same week and add a small progression only where week 1 was clean. | Add reps, small load, one set, tighter rest, or slightly longer run block depending on goal/equipment. |
| 3 | `build` | `Week 3: Push the best work` | Progress the strongest parts of the plan while keeping form and recovery stable. | Add another small progression to priority lifts, focus areas, or conditioning blocks. |
| 4 | `review` | `Week 4: Review and recover` | Reduce fatigue, keep the habit, and decide the next step. | Drop volume or density, keep movement quality high, and surface repeat/edit/switch options. |

Week 4 is an easier review week, not a full stop. The user should still train, but the plan should reduce fatigue enough that repeating or upgrading the block feels realistic.

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
| Main lifts | Keep anchors stable for all 4 weeks. |
| Week 1 | Conservative baseline loads, mostly 2-3 reps in reserve. |
| Week 2 | Add load only when all work sets were clean. |
| Week 3 | Push one or two key anchors, not every lift. |
| Week 4 | Reduce heavy-set volume and avoid new max attempts. |
| Yourplan copy | "This starts with repeatable strength work, then builds only when your logged sets are clean." |

### Muscle / Hypertrophy

| Area | Rule |
| --- | --- |
| Main lifts | Keep compounds stable and use accessories for extra volume. |
| Week 1 | Find repeatable weights in moderate rep ranges. |
| Week 2 | Add reps first; add one accessory set only for priority muscles if recovery is good. |
| Week 3 | Add load after reaching the top of the rep range, or add another quality set to focus areas. |
| Week 4 | Reduce accessory volume and keep pumps easy-to-moderate. |
| Yourplan copy | "This uses repeated muscle exposure and small volume increases instead of random exercise changes." |

### Lean & Athletic / Recomposition

| Area | Rule |
| --- | --- |
| Main lifts | Preserve resistance training quality before adding conditioning. |
| Week 1 | Establish a sustainable lifting and conditioning rhythm. |
| Week 2 | Add density, short conditioning, or small load increases only where recovery is good. |
| Week 3 | Progress one strength area and one conditioning/density area. |
| Week 4 | Pull density back and keep the week easy enough to repeat. |
| Yourplan copy | "This supports a leaner, more athletic goal without turning every session into a fatigue test." |

### General Fitness

| Area | Rule |
| --- | --- |
| Main lifts | Prioritize simple full-body movement patterns. |
| Week 1 | Learn the routine and finish sessions feeling repeatable. |
| Week 2 | Add small reps or load to the easiest wins. |
| Week 3 | Progress the most consistent sessions, not every exercise. |
| Week 4 | Keep the same habit with lower pressure and review what felt best. |
| Yourplan copy | "This is built to be sustainable first, then progressively harder when the routine is stable." |

### Running / Hybrid

| Area | Rule |
| --- | --- |
| Main work | Keep run, mobility, and strength days clearly separated. |
| Week 1 | Establish easy run pace, mobility reset, and strength baseline. |
| Week 2 | Add a small amount of time, blocks, or quality to one run/cardio exposure. |
| Week 3 | Add another small running or conditioning progression if soreness is controlled. |
| Week 4 | Reduce run density and keep mobility/reset work prominent. |
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
| Intermediate | Use normal build weeks, add volume or intensity in week 2-3, keep anchors stable. |
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

## Plan-Ready Copy Contract

`yourplan` should be able to show these sections directly from programme metadata.

| UI section | Required content |
| --- | --- |
| Plan title | User-facing plan or template family name. |
| Subtitle | One sentence combining goal, frequency, and plan style. |
| Why this plan | 2-4 reasons tied to Step 1-5 answers. |
| Your week | First-week session list with days, labels, and estimated duration. |
| 4-week progression | Week 1-4 phase labels with one short sentence each. |
| How to progress | Goal/equipment-specific progression rule. |
| If this feels too much | Easier-week or fallback guidance. |
| First action | Start the first session or review the weekly rhythm. |

The copy must avoid claiming guaranteed bodyweight change, muscle gain, or strength outcomes. It should frame the plan as structured support for the user's goal.

## Example Output Shapes

### Full Gym + Get Stronger + 3 Days + Beginner

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

### Full Gym + Build Muscle + 5 Days + Gain Target

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

### Bodyweight Only + General Fitness + 3 Days + Beginner

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

### Running / Hybrid + Lean & Athletic + 4-5 Days

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

## Acceptance Criteria

A 4-week programme is ready for MVP when:

- every recommendation result has a `blockLengthWeeks: 4` programme profile
- every week has a role, user-facing label, and short explanation
- the first week is built from real template sessions
- weeks 2-4 explain how the same sessions progress
- goal-specific progression differs between strength, muscle, lean/athletic, general fitness, and running/hybrid
- equipment-specific progression differs between full gym, minimal, bodyweight, and running/hybrid paths
- beginner and high-frequency guardrails can lower intensity or explain fallback
- `yourplan` can render the plan without inventing copy
- AI_COACH is not required for any part of programme creation

## Implementation Notes

The current `RecommendationProgrammeProfile` already has the right starting shape: `blockLengthWeeks`, `progressionStyle`, `phaseLabels`, `volumeProgression`, `intensityProgression`, `exerciseStability`, and `easierWeek`.

The next implementation pass should expand it with:

- per-week programme phases instead of only `phaseLabels`
- goal-specific progression text
- equipment-specific progression text
- focus-area allocation summary
- readiness guardrail summary
- plan-ready copy fields
- optional-day metadata for fallback frequencies

Keep the implementation deterministic and testable. If a field is needed by `yourplan`, it should come from typed programme metadata, not ad hoc UI copy.
