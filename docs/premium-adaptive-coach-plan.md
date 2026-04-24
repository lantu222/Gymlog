# Gymlog Premium Plan

This document defines the first premium feature direction for Gymlog.

The recommended premium direction is not "more charts" or "more templates".
It is one clear promise:

## Premium Promise

`Adaptive Coach`

Gymlog Premium adapts the workout, the session, and the week to how the user actually performs.

That means:

- set-to-set guidance during logging
- smarter rest and next-set recommendations
- session adjustment when energy, time, or recovery is off
- weekly plan adaptation based on real performance trends
- AI Coach actions that can change the plan, not only explain it

This is the strongest premium candidate because the app already has the right foundations:

- a fast logger
- effort capture
- plan-fit setup
- progress and history
- AI Coach

The premium layer should unify those into one paid coaching system.

## Product Positioning

### Free tier stays useful

Free should continue to include:

- workout logging
- ready plans
- custom workouts
- basic progress
- manual rest timer
- basic AI Coach advice
- plan setup and editing

Free should feel complete enough to trust the app.
Premium should feel smarter, not less fair.

### Premium should feel like a coach

The user should clearly understand:

- free logs what happened
- premium reacts to what happened

That distinction is simple, valuable, and easy to explain.

## Premium Feature Pack

## 1. Adaptive Set Coach

This is the first premium slice and the best place to start.

### What it does

After each completed set, Gymlog Premium uses:

- planned reps
- actual reps
- current load
- effort input
- recent performance on the same slot

to generate the next recommendation.

### Example outputs

- `Keep load. Beat last set by 1 rep.`
- `Take 45s more rest before the next set.`
- `This moved fast. Add 2.5 kg next set.`
- `Hold load. Keep the set clean.`
- `Drop 5% and finish the work well.`

### Why it feels premium

- it changes the workout in the moment
- it saves thinking during logging
- it feels like a real coach, not a static logger

### Where it lives

- [WorkoutLoggingScreen.tsx](/D:/Gymlog/src/screens/WorkoutLoggingScreen.tsx)
- [WorkoutExerciseCard.tsx](/D:/Gymlog/src/components/WorkoutExerciseCard.tsx)
- [WorkoutSummaryBar.tsx](/D:/Gymlog/src/components/WorkoutSummaryBar.tsx)

## 2. Smart Rest

Premium should upgrade the rest timer from passive countdown to adaptive recovery support.

### What it does

Rest time adjusts using:

- movement type
- set difficulty
- whether the lift is a primary slot
- how the session is trending

### Premium behaviors

- suggest extra rest after hard/maxed sets
- shorten rest after easy accessories
- explain why the timer changed
- allow quick override: `Need less`, `Need more`

### Example outputs

- `Heavy press. Take 30s more.`
- `Accessory work. 60s is enough here.`
- `You marked that set hard. Recover before the next top set.`

### Why it feels premium

It turns the timer into coaching rather than decoration.

## 3. Readiness Check

This is the second premium slice after Adaptive Set Coach.

### What it does

Before the session starts, Gymlog asks 3-4 short questions:

- sleep
- soreness
- stress
- time available today

### What changes

The app can then:

- shorten the session
- reduce accessories
- hold back progression
- suggest a lighter variant
- preserve the main lift and remove less important work

### Why it matters

This is the cleanest way to introduce premium adaptation before needing wearables or external integrations.

### Where it lives

- [StartingWeekScreen.tsx](/D:/Gymlog/src/screens/StartingWeekScreen.tsx)
- [ProgramDetailScreen.tsx](/D:/Gymlog/src/screens/ProgramDetailScreen.tsx)
- [WorkoutLoggingScreen.tsx](/D:/Gymlog/src/screens/WorkoutLoggingScreen.tsx)

## 4. Adaptive Week

This is the third premium slice.

### What it does

Gymlog adjusts the next week based on:

- repeated hard/maxed sets
- missed sessions
- skipped accessories
- time-budget compression
- strong progress on a focus lift

### Example changes

- reduce weekly volume slightly
- move one lower-body session later
- make the week 3 days instead of 4
- swap in a shoulder-friendlier press block
- add one extra upper-back movement if posture/support work is lagging

### Why it matters

This is the first premium feature that makes the whole app feel alive, not just the logger.

### Where it lives

- [PlanSettingsScreen.tsx](/D:/Gymlog/src/screens/PlanSettingsScreen.tsx)
- [StartingWeekScreen.tsx](/D:/Gymlog/src/screens/StartingWeekScreen.tsx)
- [HomeScreen.tsx](/D:/Gymlog/src/screens/HomeScreen.tsx)
- [firstRunSetup.ts](/D:/Gymlog/src/lib/firstRunSetup.ts)

## 5. AI Coach Pro Actions

Premium should also upgrade AI Coach from advice to execution.

### Free AI Coach

- explanations
- general Q&A
- simple suggestions

### Premium AI Coach

- `Adapt this session`
- `Make today 35 min`
- `Swap for home gym`
- `Make this shoulder-friendly`
- `Deload this week`
- `Rebuild this plan around bench`

### Why it matters

This gives the paywall a visible AI value that is concrete and immediately useful.

### Where it lives

- [AICoachScreen.tsx](/D:/Gymlog/src/screens/AICoachScreen.tsx)
- [aiCoachActions.ts](/D:/Gymlog/src/lib/aiCoachActions.ts)
- [aiTrainingContext.ts](/D:/Gymlog/src/lib/aiTrainingContext.ts)

## Free vs Premium Boundary

## Free

- log sets manually
- use ready plans
- build custom workouts
- track progress
- ask AI Coach questions
- use a fixed rest timer
- edit setup and plan settings

## Premium

- adaptive set recommendations
- adaptive rest timing
- readiness-based session adjustment
- weekly plan adaptation
- premium AI Coach actions that change plans or sessions
- premium insight summaries that explain why changes were made

## UX Surfaces

Premium should not start as a generic pricing page.
It should start inside moments where the value is obvious.

## Surface 1: Logger paywall moments

Best trigger:

- after the first `Easy / Good / Hard` input

Prompt:

- `Unlock Adaptive Coach`
- `Get next-set guidance, smarter rest, and session adjustments.`

Why this works:

- the user just performed the action that premium builds on

## Surface 2: Starting week / plan handoff

Best trigger:

- after recommendation or setup review

Prompt:

- `Want this plan to adapt with you each week?`

Why this works:

- the user is already thinking in terms of plan fit

## Surface 3: AI Coach action lock

Best trigger:

- user taps a premium action like `Make today 35 min`

Why this works:

- the lock is attached to a real action, not a generic upsell

## Surface 4: Plan settings

This should become the long-term premium control center.

Add a Premium block:

- `Adaptive Coach`
- `Smart Rest`
- `Readiness`
- `Adaptive Week`
- `AI Coach Pro`

This is the cleanest internal home for premium configuration.

## Recommended MVP

The first premium build should be intentionally narrow.

## MVP Feature

`Adaptive Set Coach`

### MVP scope

- keep current effort capture
- upgrade it from label-only to recommendation-producing logic
- show premium recommendation card after effort
- adjust next-set recommendation and rest suggestion
- lock the adaptive behavior behind premium

### MVP UI

In logger, after effort:

- `Coach read`
- `Good set`
- `Keep 20 kg`
- `Aim for 9 reps`
- `Rest 75s`

Secondary:

- `Why?`
- `Unlock Adaptive Coach` if free

### MVP implementation files

- [WorkoutLoggingScreen.tsx](/D:/Gymlog/src/screens/WorkoutLoggingScreen.tsx)
- [WorkoutExerciseCard.tsx](/D:/Gymlog/src/components/WorkoutExerciseCard.tsx)
- new logic file:
  - `src/lib/adaptiveCoach.ts`
- new entitlement/preference support:
  - [models.ts](/D:/Gymlog/src/types/models.ts)
  - [database.ts](/D:/Gymlog/src/storage/database.ts)
  - [AppProvider.tsx](/D:/Gymlog/src/state/AppProvider.tsx)

### MVP data needed

- premium status flag
- effort per completed set
- current set prescription
- previous slot history
- optional override if the user rejects the suggestion

## Future Premium Stack

After MVP:

1. Smart Rest
2. Readiness Check
3. Adaptive Week
4. AI Coach Pro Actions
5. Premium insights summaries

This order is important because each step reuses the previous data.

## Copy Direction

Premium copy should stay simple and direct.
Avoid sounding like a generic AI fitness app.

### Good direction

- `Adaptive Coach`
- `Train smarter every set`
- `Let Gymlog adjust the next move`
- `Your plan adapts as you train`
- `Get smarter rest and next-set guidance`

### Avoid

- vague hype like `unlock your full potential`
- generic `AI-powered transformation` language
- too many feature bullets without one clear promise

## What Not To Build First

Do not start premium with:

- extra charts only
- cosmetic themes
- template count paywalls
- nutrition as the first paid feature
- wearable integrations before readiness logic exists locally

Those can come later, but they are weaker first premium hooks than adaptive coaching.

## Success Criteria

Premium is succeeding when:

- users immediately understand what is paid
- the paid value appears during training, not only on an upgrade page
- free remains useful
- premium feels like a real coach, not a locked menu

## Recommended Next Action

Build the MVP:

- add entitlement scaffolding
- create `adaptiveCoach.ts`
- show premium recommendation card after effort input
- add one small locked logger prompt for free users

That is the smallest premium slice that already feels real.
