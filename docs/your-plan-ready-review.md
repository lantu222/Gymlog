# Your Plan Ready Review

This document captures the target redesign for the post-onboarding plan-ready screen from the May 5, 2026 review. This is documentation only; no implementation changes are made in this pass.

## Source Screens

- Target reference: `<reference-assets>\Your_plan\Yourplan_referenssi.png` (`863 x 1823`)
- Current implementation anchor: `src/screens/OnboardingScreen.tsx`, `renderReview()`
- Current assets/data anchor:
  - `PLAN_READY_GYM_BACKDROP_SOURCE`
  - `recommendedProgramPresentation`
  - `projectedSessions`
  - `projectedRhythm`
  - `focusAreaLabels`
  - `tailoringBadgeLabels`
  - `secondaryOutcomeLabels`

## Intended Change

Replace the current plan-ready menu with a richer full-screen plan summary that closely matches the reference:

- dark full-screen plan review
- large image-backed hero
- top-right `See other plans` pill
- clear `YOUR PLAN IS READY` kicker
- large recommended plan title
- compact summary chips
- `Why this plan?` and `Plan overview` combined panel
- two workout-day cards
- weekly overview strip
- `What to expect` panel
- lime primary CTA: `START MY PLAN`

The screen should feel like the final reveal of the onboarding flow, not another form step.

## Product Requirement

The screen must answer four questions without requiring user interaction:

| Question | UI section |
| --- | --- |
| What plan did GAINER pick? | Hero title and subtitle |
| Why did this plan fit me? | `WHY THIS PLAN?` checklist |
| What will my week look like? | Workout cards and weekly overview |
| What happens next? | `WHAT TO EXPECT` panel and primary CTA |

The primary action should start or open the selected plan. Alternative plans stay available, but secondary.

## Accepted Layout Snapshot

### Screen Shell

| Element | Accepted value |
| --- | --- |
| Background | Full-screen black/dark surface, `#050505` base |
| Content width | Full width with `24` px horizontal padding on phone-sized layouts |
| Top safe area | Dark status area, no white onboarding shell |
| Scroll behavior | Vertical scroll allowed; CTA remains at bottom of content, not fixed unless later testing proves it is needed |
| Bottom safe area | Keep bottom home indicator spacing; CTA should sit above it with `28-34` px breathing room |
| Global card radius | `16-22` for large panels, `14-16` for smaller cards, `999` for pills |
| Global border | `1` px, usually `rgba(255,255,255,0.12)` |
| Global panel fill | `rgba(255,255,255,0.045)` or `rgba(255,255,255,0.06)` over black |

### Color Tokens

Use one consistent palette for this screen. Do not introduce random one-off shades during implementation.

| Token | Value | Usage |
| --- | --- | --- |
| `planBlack` | `#050505` | Screen background |
| `planPanel` | `#0B0B0B` | Main card/panel base |
| `planPanelSoft` | `rgba(255,255,255,0.05)` | Inner panels and workout cards |
| `planPanelRaised` | `rgba(255,255,255,0.08)` | Overview card and chips |
| `planBorder` | `rgba(255,255,255,0.12)` | Standard panel borders |
| `planBorderStrong` | `rgba(255,255,255,0.20)` | Emphasized cards |
| `planText` | `#FFFFFF` | Primary text |
| `planTextSubtle` | `rgba(255,255,255,0.72)` | Body text |
| `planTextMuted` | `rgba(255,255,255,0.54)` | Kicker/meta text |
| `planLime` | `#B8FF6A` | Primary CTA, checkmarks, active days, section accent |
| `planPurple` | `#D9A9FF` | Upper-focus / what-to-expect accent |
| `planBlue` | `#96D8FF` | Lower-focus accent |
| `planWhiteScrim` | `rgba(255,255,255,0.10)` | Chip surface |
| `planHeroScrimTop` | `rgba(0,0,0,0.24)` | Hero overlay top |
| `planHeroScrimBottom` | `rgba(0,0,0,0.78)` | Hero overlay bottom |

Existing app colors that already match this family:

- black/dark: `#050505`, `#0B0B0B`, `#000000`
- muted white: `rgba(255,255,255,0.72)`, `rgba(255,255,255,0.58)`, `rgba(255,255,255,0.54)`
- purple: `#D9A9FF`, `rgba(198,139,255,0.20)`
- blue: `#96D8FF`, `#67A8E9`

### Typography

| Text | Font size | Line height | Weight | Color |
| --- | ---: | ---: | --- | --- |
| Hero kicker `YOUR PLAN IS READY` | `15` | `18` | `900` | `planTextMuted` |
| Hero title | `34-38` | `38-42` | `900` | `planText` |
| Hero subtitle | `18-20` | `24-28` | `700` | `planTextSubtle` |
| Section title | `14-16` | `18-20` | `900` | `planText` or `planLime` |
| Panel title | `15-17` | `20-22` | `900` | `planLime` |
| Card title | `18-22` | `24-26` | `900` | `planText` |
| Body / row text | `15-17` | `21-24` | `700` | `planTextSubtle` |
| Exercise rows | `15-16` | `20-22` | `600-700` | `planTextSubtle` |
| Meta / chip text | `12-14` | `15-18` | `800-900` | `planTextSubtle` |
| CTA text | `22-24` | `28-30` | `900` | `#06080B` |

Letter spacing should stay `0` unless an existing local style already uses uppercase kicker tracking. Avoid negative letter spacing on compact cards.

## Section Layout

### Hero

| Element | Accepted value |
| --- | --- |
| Height | `365-410` depending on viewport; target reference uses a tall hero occupying roughly the top quarter |
| Background image | Real gym/barbell image, dark but readable; current `PLAN_READY_GYM_BACKDROP_SOURCE` can remain if it is close enough |
| Image treatment | `cover`, right-weighted framing, black scrims top and bottom |
| Top row | `See other plans` pill aligned top-right |
| Pill | `minHeight: 58`, `paddingHorizontal: 28`, radius `999`, transparent/black fill, border `rgba(255,255,255,0.24)` |
| Kicker | `YOUR PLAN IS READY 🎉`; emoji can stay if it renders consistently |
| Title | Recommended plan name, e.g. `Minimal Full Body` |
| Subtitle | `Built around your goals, schedule and recovery.` or template subtitle if better |
| Chip row | Horizontal chips, wrapping if needed; 4 chips on wide phone reference |

Hero chip examples:

| Chip | Source |
| --- | --- |
| `2 workouts / week` | `recommendedProgram.daysPerWeek` |
| `45-60 min / session` | `recommendedProgram.estimatedSessionDuration` or range fallback |
| `Progressive overload` | static plan benefit |
| `Recovery focused` | static benefit or schedule fit |

### Fit Summary Panel

Reference combines `WHY THIS PLAN?` and `PLAN OVERVIEW` in one bordered panel.

| Element | Accepted value |
| --- | --- |
| Container | Radius `20`, border `planBorder`, fill `rgba(255,255,255,0.035)`, padding `24` |
| Layout | Two columns on wide phone; stack vertically on narrow screens |
| Left width | Flexible, about `58%` in reference |
| Right card | About `36-40%`, fill `rgba(255,255,255,0.07)`, radius `14`, padding `22` |

`WHY THIS PLAN?` rows:

- `Your goal: {goalLabel}`
- `{levelLabel} experience level`
- `{daysPerWeek} training days per week`
- `{equipment/access label}`
- `Focus areas: {focusAreaLabels}` if selected

Each row uses a lime check icon, `20-22` px icon box, and `15-17` px text.

`PLAN OVERVIEW` rows:

- workouts per week
- estimated minutes per week
- plan structure, e.g. `Full body focus`
- estimated duration horizon, e.g. `3-6 months est. time`

Use existing `GAINERIcon` names where possible. If an exact icon is missing, map to the closest existing icon first before adding new icon paths.

### Workout Plan Cards

| Element | Accepted value |
| --- | --- |
| Section label | `YOUR WORKOUT PLAN`, white, uppercase, `15 / 18`, `900` |
| Layout | Two cards side by side if width allows; stack on smaller devices |
| Card fill | `rgba(255,255,255,0.035)` |
| Card border | `rgba(255,255,255,0.14)` |
| Card radius | `14-16` |
| Card padding | `18` |
| Header split | left day meta, middle workout title/focus chip, right duration |
| Exercise divider | `1` px `rgba(255,255,255,0.10)` below header |
| Exercise row | icon, exercise name, prescription right-aligned |

Reference card content pattern:

| Field | Example |
| --- | --- |
| Day label | `Day 1`, `Day 2` |
| Weekday | `Mon`, `Thu` |
| Workout name | `Minimal A`, `Minimal B` |
| Focus chip | `Upper focus`, `Lower focus` |
| Duration | `~45 min` |
| Exercise row | `Bodyweight Squat` + `3 x 10-15` |

Implementation should use the first two training sessions from `projectedSessions`. If a plan has more than two sessions, show the first two cards and keep the full session list accessible in details or a later expanded state.

### Weekly Overview

| Element | Accepted value |
| --- | --- |
| Container | Full-width panel, radius `18`, border `planBorder`, fill `rgba(255,255,255,0.035)` |
| Header | left `YOUR WEEKLY OVERVIEW`, right `{n} recovery days built in` |
| Days | 7 equal columns |
| Active day | lime day label, lime filled circle with black check, `Train` label |
| Recovery day | muted day label, outlined dark circle with muted check, `Recover` label |
| Legend | bottom-left, lime dot `Training day`, gray dot `Recovery day` |

Current `projectedRhythm` and `reviewWeekRows` already provide most of this data. Keep this section data-driven.

### What To Expect

| Element | Accepted value |
| --- | --- |
| Container | Radius `18`, border `rgba(198,139,255,0.70)` or softer if too loud, dark purple-tinted fill |
| Header | left round sparkle icon, `WHAT TO EXPECT` in purple |
| Items | 4 equal columns with dividers between columns |
| Icon size | `28-34` |
| Title | `14-16 / 19`, `900`, white |
| Body | `14-15 / 20`, `700`, muted white |

Reference items:

| Title | Body |
| --- | --- |
| `Progressive workouts` | `Get stronger week by week` |
| `Track & adjust` | `We'll adapt as you progress` |
| `Balanced approach` | `Training, recovery & consistency` |
| `Real results` | `Visible progress over time` |

Use vertical separators: `1` px `rgba(255,255,255,0.14)` between item columns.

### Primary CTA

| Element | Accepted value |
| --- | --- |
| Text | `START MY PLAN 🚀` |
| Height | `74-86` |
| Radius | `18-22` |
| Fill | `planLime` |
| Text color | `#06080B` |
| Font | `22-24 / 28-30`, `900` |
| Position | Full-width at bottom of content, after `What to expect` |

Do not use a white button for the primary action on this target. The lime CTA is part of the screen hierarchy.

## Responsive Notes

Reference screenshot is `863 x 1823`. Production must also work on narrower phone layouts:

- keep horizontal padding at `20-24`
- hero chips may wrap into two rows
- fit summary panel can stack `WHY THIS PLAN?` above `PLAN OVERVIEW`
- workout cards can stack vertically under `390` px viewport width
- weekly overview day labels must not overlap; use `numberOfLines={1}` and smaller meta text if needed
- `What to expect` can remain 4 columns on wide phones; on narrow phones use 2 x 2 if text feels cramped
- CTA text must fit without clipping; use `adjustsFontSizeToFit` only as a fallback

## Data Mapping

| UI field | Source |
| --- | --- |
| Plan title | `recommendedProgramPresentation.title` |
| Plan subtitle | `recommendedProgramPresentation.subtitle`, with fallback to target copy |
| Workouts per week | `recommendedProgram.daysPerWeek` |
| Session duration | `recommendedProgram.estimatedSessionDuration` |
| Minutes per week | `effectiveWeeklyMinutes` |
| Goal row | `goalLabel` |
| Experience row | `level` label from setup |
| Training days row | `daysPerWeek` |
| Equipment row | `getLocationLabel(trainingEnvironment, equipment)` or equivalent |
| Focus row | `focusAreaLabels` / `focusAreaSummary` |
| Workout cards | first two `projectedSessions` |
| Weekly overview | `projectedRhythm` + `reviewWeekRows` |
| Other plans | `recommendationOptionIds` excluding active program |

## Current Implementation Gap

Current `renderReview()` already has several building blocks, but the layout differs from the reference:

- current hero is more compact and card-like
- current plan chips are vertical, not horizontal
- current `See other plans` is a small peek element, not the pill in the reference
- current “why” copy is not a large two-column panel
- current workout plan cards are simpler and more stacked
- current weekly overview exists but needs the larger reference treatment
- current CTA is a small white `Start plan` button, not a full-width lime `START MY PLAN` button

## Implementation Notes For Later

- Keep the new screen inside `renderReview()` unless the file becomes too hard to maintain. If implementation grows too large, extract presentational components near the existing Plan Ready helpers first.
- Reuse `GAINERIcon` wherever possible.
- Keep `PLAN_READY_GYM_BACKDROP_SOURCE` if it visually matches the reference; otherwise replace with a darker barbell/gym image asset.
- Keep `Other plans` behavior secondary. The reference exposes it, but the primary visual hierarchy belongs to the selected plan.
- Do not reintroduce onboarding progress dots on this screen. The onboarding input flow is complete before this view appears.
- Avoid marketing-page layout patterns. This is an operational plan summary with a strong hero and dense, readable plan details.

## Test Plan For Implementation

When implementation starts, add or update structure tests to verify:

- `renderReview()` includes `YOUR PLAN IS READY`
- primary CTA text is `START MY PLAN`
- `See other plans` remains available
- `WHY THIS PLAN?`, `PLAN OVERVIEW`, `YOUR WORKOUT PLAN`, `YOUR WEEKLY OVERVIEW`, and `WHAT TO EXPECT` exist
- the CTA no longer uses the old small `Start plan` button treatment
- workout card rendering uses `projectedSessions` / `planReadyPreviewRows`
- weekly overview remains data-driven from `projectedRhythm`
- no onboarding `StepDots` render on the plan-ready screen

Visual verification should include at least:

- one narrow phone viewport
- one tall phone viewport matching the reference proportions
- one setup with 2 training days
- one setup with 4+ training days to confirm card overflow/stacking behavior
