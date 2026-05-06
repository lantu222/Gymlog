# Onboarding Step 5 Bodyweight Progress

This document captures the Step 5 visual update from the May 5, 2026 onboarding review.

## Source Screens

- Target reference: `D:\Gymlog dokumentointi\Step5\Step5_referenssi.png` (`307 x 649`)
- Previous implementation: `D:\Gymlog dokumentointi\Step5\Step5.png` (`405 x 863`)
- Baseline measurements: `docs/onboarding-step1-equipment-access.md`, section `Accepted Layout Snapshot`

## Intended Change

Step 5 changes from a simple bodyweight entry screen into a progress-tracking setup screen.

- Step label: `STEP 5 OF 5`
- Title:

```text
TRACK YOUR
PROGRESS
```

- Subtitle: `Set your current weight and optional goal.`
- Body sections:
  - `Current weight`
  - `Your goal`
  - `Target weight (optional)`
  - `What to expect`

The target should keep the same split black-header / light-body onboarding shell used in Step 1-4.

## Product Requirement

Step 5 collects current bodyweight and an optional target bodyweight. It also lets the user choose the bodyweight intent that controls the default target and expectation copy.

Visible bodyweight goals:

| Option | Internal value | Default target behavior |
| --- | --- | --- |
| `Gain muscle` | `muscle` | Current weight + `8 kg` / `18 lb`; slider range starts at current weight |
| `Maintain` | `general_fitness` | Current weight; slider range stays near current weight (`+/- 5 kg` / `10 lb`) |
| `Lean down` | `lean_athletic` | Current weight - `5 kg` / `10 lb`; slider range ends at current weight |

The bodyweight goal is local to the Step 5 UI and does not overwrite the Step 2 training goal. The saved recommendation inputs still use the current and target bodyweight values.

Changing the bodyweight goal resets the target to that goal's default so an old gain target cannot remain selected after switching to `Lean down`.

## Plan Generation Contract

Step 5 refines recommendation intent but should not blindly override Step 2. It mainly changes explanation, scoring bias, and programme framing.

| Step 5 input | Stored value | Recommendation effect | Programme effect |
| --- | --- | --- | --- |
| Current weight | `currentWeightKg` | Provides baseline for target direction. | Enables current-to-target context in the plan explanation. |
| Target weight above current | `targetWeightKg`, direction `gain` | Biases muscle/hypertrophy explanations and gain-support copy. | Programme should frame progression as muscle-building support, not weight-loss support. |
| Target weight below current | `targetWeightKg`, direction `loss` | Biases lean/recomp/fat-loss support and avoids overly punishing high-fatigue output for beginners. | Programme should emphasize sustainable resistance training, consistency, and recovery. |
| Target equals current / maintain | `targetWeightKg`, direction `maintain` | Supports general fitness/recomp framing. | Programme should frame progress around performance, consistency, and body composition stability. |
| No target | `targetWeightKg: null` | Keeps Step 2 goal as the main signal. | Programme should avoid bodyweight-specific promises. |

Output rule: if Step 5 creates a weight-direction signal, the final plan should mention it in `Why this plan?` or `What to expect`; if it does not affect the selected plan, do not pretend it changed the template.

## Accepted Layout Snapshot

### Header

| Element | Accepted value |
| --- | --- |
| System/status area | Keep the existing white status area above app content. |
| Stage background | `#F5F5F5` |
| Stage horizontal bleed | Same as Step 1: `marginHorizontal: -18` |
| Black top pane | Same as Step 1: `height: 248`, `paddingTop: 32`, `paddingBottom: 18`, `backgroundColor: #000000` |
| Top pane horizontal padding | Same as Step 1: `36` each side |
| Header copy offset | Same as Step 1: `paddingTop: 20`, `paddingBottom: 0`, `gap: 3` |
| Progress segments | Same as Step 1: `height: 4`, `borderRadius: 999`, `gap: 6`, active `#F3F7FF`, inactive `rgba(255,255,255,0.10)` |
| Sloped transition | Same as Step 1: `height: 72`, `bottom: -36`, `left/right: -12`, `rotate: -4deg`, color `#F5F5F5` |
| Lower pane | `#F5F5F5`, `paddingHorizontal: 22`, `paddingTop: 4` |

### Header Text

| Text | Font size | Line height | Weight | Letter spacing | Color |
| --- | ---: | ---: | --- | ---: | --- |
| `STEP 5 OF 5` | `10` | `12` | `900` | `1.2` | `rgba(255,255,255,0.6)` |
| `TRACK YOUR` / `PROGRESS` | `34` | `37` | `900` | `-0.8` | `#FFFFFF` |
| Subtitle | `12` | `15` | `700` | default | `rgba(255,255,255,0.72)` |

### Current Weight

| Element | Accepted value |
| --- | --- |
| Section label | Uppercase, `12 / 16`, `900`, letter spacing `0.8`, color `#06080B` |
| Stepper card | White, `minHeight: 50`, radius `14`, subtle `rgba(6,8,11,0.08)` border |
| Step buttons | `34 x 34`, radius `17`, light gray background |
| Number | `30 / 34`, `900`, black |
| Unit text | Smaller attached unit: `15 / 18`, `900`, black |
| Unit pills | Centered row, `30` high, active black fill and white text |
| Section lift | Step 5 body content is raised `5` px with `translateY: -5` to tighten the space above the footer |

### Goal Cards

| Element | Accepted value |
| --- | --- |
| Grid | 3 columns, `gap: 8` |
| Card | White inactive, black active, radius `8`, `minHeight: 88`, centered content |
| Icon | Custom `react-native-svg` stroke icon: `Gain muscle` centered upward arrow, `Maintain` flat line, `Lean down` centered downward arrow; black inactive, white active |
| Title | `12 / 14`, `900`, centered |
| Body | `8.5 / 10`, `700`, centered |

The active card should match the reference's `Gain muscle` black card treatment.

### Target Slider

| Element | Accepted value |
| --- | --- |
| Header | `Target weight (optional)` plus muted hint |
| Slider card | White, `minHeight: 50`, radius `12`, subtle border |
| Value | `17 / 21`, `900`, black |
| Track | `2` px line, inactive `rgba(6,8,11,0.10)`, active black; rendered on the same row immediately after the value |
| Thumb | `8 x 8`, black, centered on track |
| Clear text | Small muted text at the right |

### What To Expect Card

| Element | Accepted value |
| --- | --- |
| Card | Black `#050505`, radius `8`, `minHeight: 92`, compact padding |
| Kicker | `WHAT TO EXPECT`, uppercase, `8 / 10`, `900`, muted white |
| Title | `15 / 18`, `900`, white |
| Body | One short explanatory sentence, `10.5 / 14`, `700`, muted white |

The card intentionally avoids a mini chart and dense bullet list on this step. The target value and slider already communicate the direction, so the black card only confirms what the selected goal means.

The Step 5 body intentionally uses the available space above the shared footer by giving the goal cards and expectation card more height instead of leaving a large blank band above `Continue`.

## Implementation Notes

- Step 5 uses `renderOnboardingShell` with the same fixed `248` black top pane as Step 1.
- `BodyweightStepper` remains the current-weight input and unit switcher.
- `BodyweightGoalOptionCard`, `BodyweightTargetSlider`, and `BodyweightExpectationCard` are Step 5-specific components in `OnboardingScreen.tsx`.
- `BODYWEIGHT_GOAL_OPTIONS` defines the three visible Step 5 cards.
- The target slider updates target bodyweight by tapping the track; `Clear` removes the saved optional target. Its min/max are derived from the selected goal so `Gain muscle` moves upward from current weight and `Lean down` moves downward to current weight.
- `Lean down` is treated as a required target mode internally, so it receives a default target if none is saved.
- Step 5 is the final input step. The footer uses `Build my first program`, starts the building-plan transition directly, and then opens the plan-ready review.

## Verification

- `node tests/run-tests.cjs`
- `npm run typecheck`
