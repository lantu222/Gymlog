# Onboarding Step 3 Training Profile

This document captures the Step 3 visual and product change from the April 30, 2026 onboarding review.

## Source Screens

- Target reference: `D:\Gymlog dokumentointi\Step3\Step3screen_reference.png` (`853 x 1844`)
- Current implementation: `D:\Gymlog dokumentointi\Step3\Step3_screen.png` (`381 x 843`)

## Intended Change

Step 3 changes from a basic demographic profile screen into a training-profile screen that asks the highest-impact training setup questions together:

- Step label: `STEP 3 OF 5`
- Title:

```text
TRAINING
PROFILE
```

- Subtitle: `We'll tailor your plan to your experience and availability.`
- Sections:
  - `EXPERIENCE LEVEL`
  - `TRAINING FREQUENCY`
  - `PLAN PREVIEW`

Product decision: this target intentionally asks experience level and training frequency on Step 3 even though the current app asks related values in later stages. Treat this as the desired product direction, not a blocker.

Current code note: the existing Step 3 implementation is `YOUR PROFILE`, with gender cards and an age slider. The target removes those from Step 3 and replaces the screen with training-level and frequency controls.

## Product Requirement

Step 3 should gather the inputs that directly change recommendation quality:

| UI area | Stored value | Recommendation impact |
| --- | --- | --- |
| Beginner | `level: beginner` | Lower fatigue, simpler workouts, more recovery-friendly plans. |
| Intermediate | `level: intermediate` | Balanced volume, progressive overload, more training variety. |
| Advanced | New value needed: `level: advanced` | Higher workload and advanced progression if the catalog supports it; otherwise use intermediate recommendations with advanced copy guarded carefully. |
| 2 days | `daysPerWeek: 2` | Low-frequency schedule, usually full-body or minimal split. |
| 3 days | `daysPerWeek: 3` | Default balanced setup; screenshot-selected state. |
| 4 days | `daysPerWeek: 4` | Higher weekly structure where compatible. |
| 5 days | `daysPerWeek: 5` | Higher-frequency split where compatible. |
| 6+ days | New value needed or mapped fallback | Future support needed. If not implemented immediately, map to `5` internally but preserve the visible intent separately. |

Current data gap: `SetupLevel` currently supports only `beginner | intermediate`, and `SetupDaysPerWeek` supports only `2 | 3 | 4 | 5`. The target UI introduces `Advanced` and `6+ days`. These need either storage expansion or a precise-intent field so the UI does not silently collapse user intent.

## Target Content

### Header

| Element | Text |
| --- | --- |
| Step label | `STEP 3 OF 5` |
| Title line 1 | `TRAINING` |
| Title line 2 | `PROFILE` |
| Subtitle | `We'll tailor your plan to your experience and availability.` |

### Experience Level

| Option | Subtitle | Supporting chips | Target selected state |
| --- | --- | --- | --- |
| Beginner | `0-1 years of consistent training` | `Simpler workouts`, `Lower fatigue`, `More recovery` | Selected in reference |
| Intermediate | `1-3 years of training` | `Balanced volume`, `Progressive overload`, `More variety` | Unselected |
| Advanced | `3+ years of serious training` | `Higher volume`, `Advanced progression`, `Greater workload` | Unselected |

### Training Frequency

| Option | Label | Target selected state |
| --- | --- | --- |
| 2 | `2 days` | Unselected |
| 3 | `3 days` | Selected in reference |
| 4 | `4 days` | Unselected |
| 5 | `5 days` | Unselected |
| 6+ | `6+ days` | Unselected |

### Plan Preview

The original target used a full recommended setup card. The accepted implementation keeps the same feedback but compresses it into a one-line `Plan preview` strip so Step 3 can remain non-scrollable on Pixel-style viewports. Reference state is beginner + 3 days:

| Metric | Reference copy |
| --- | --- |
| Workouts per week | `3 workouts / week` |
| Session duration | `45-60 min sessions` |
| Split structure | `Full body structure` |
| Recovery emphasis | `Recovery focused` |

## Accepted Layout Snapshot

The target is taller than the current app screenshot, but it should follow the same overall onboarding shell principles already established by Steps 1 and 2.

### Header and Pane Geometry

| Element | Accepted value / guidance |
| --- | --- |
| System/status area | Keep the existing white status area above the app content. |
| Black top pane | Full-width black pane, same family as Step 1/2, but taller than Step 2 because the headline is larger. |
| Top pane horizontal padding | Start from Step 1/2: `36` each side. |
| Progress bar | Inside black pane near the top, above the step label. |
| Progress state | 3 active segments, remaining segments inactive. |
| Progress segment color | Active `#F3F7FF`, inactive `rgba(255,255,255,0.10)`. |
| Step label position | Below progress, above headline. |
| Sloped transition | Same visual language as Step 1/2: light lower pane cuts into black pane with a shallow upward slope. |
| Lower pane background | `#F5F5F5` / near-white. |
| Overall behavior | Step 3 should be non-scrollable on Pixel-style viewports. Prioritize the actual inputs over the preview strip. |

Reference visual proportions:

- Black header occupies roughly the top third of the target screenshot below the status area.
- The sloped white pane begins just below the subtitle and creates a strong diagonal transition.
- Main content starts inside the white area with enough overlap/spacing that it feels connected to the header, not detached.

### Header Text

| Text | Font size guidance | Weight | Color |
| --- | ---: | --- | --- |
| `STEP 3 OF 5` | `16-18` on the large reference, or scale down proportionally for Pixel viewport | `900` | `rgba(255,255,255,0.62)` |
| `TRAINING` / `PROFILE` | Large hero type, heavier than Step 2; approximately Step 1 large-title family | `900` | `#FFFFFF` |
| Subtitle | Larger than Step 1/2 subtitle; should read as supporting paragraph | `800` | `rgba(255,255,255,0.72)` |

Implementation guidance: if using the current Step 1/2 compact shell on a Pixel viewport, reduce title size enough to preserve the same hierarchy without clipping the black pane.

### Section Headers

Each section header has a black square icon followed by uppercase label text.

| Element | Accepted value / guidance |
| --- | --- |
| Icon tile | Black rounded square, approximately `40 x 40` on target reference; white icon. |
| Header text | Uppercase, strong letter spacing, black text. |
| Header row gap | Tight, approximately `12-16`. |
| Section prompt text | Medium gray, below the section header. |

Section copy:

- `EXPERIENCE LEVEL`
- `How much training experience do you have?`
- `TRAINING FREQUENCY`
- `How many days per week can you train?`

### Experience Cards

| Element | Selected card | Unselected cards |
| --- | --- | --- |
| Background | `#FFFFFF` | `#141414` / near-black |
| Border | Black `2` px style outline | Subtle dark border |
| Text color | Black primary / gray secondary | White primary / light-gray secondary |
| Radio | Filled black dot inside circle | Empty gray circle |
| Icon tile | Black tile with white icon | Dark/black tile with white icon and light outline |
| Radius | Moderate rounded corners, close to `10-12` |
| Shadow | Selected card has subtle lift | Unselected cards have darker shadow/lift |

Experience card content layout:

- Left: icon tile.
- Middle: title, subtitle, then horizontal chips.
- Right: radio indicator.
- Chips use small check icons followed by text.
- Chip row should remain readable; wrapping is acceptable on narrow devices before shrinking text too far.

### Experience Text

| Element | Selected color | Unselected color | Weight |
| --- | --- | --- | --- |
| Card title | `#06080B` | `#FFFFFF` | `900` |
| Card subtitle | `rgba(6,8,11,0.62)` | `rgba(255,255,255,0.72)` | `700` |
| Chip text | `rgba(6,8,11,0.72)` | `rgba(255,255,255,0.78)` | `700` |

### Frequency Selector

Frequency is a five-option horizontal segmented row, not dark cards.

| Element | Accepted value / guidance |
| --- | --- |
| Container | Five equal tiles in one row with gaps. |
| Tile background | White / very light. |
| Selected border | Black outline, visually stronger than unselected. |
| Unselected border | Subtle light gray. |
| Tile radius | `10-12`. |
| Number text | Large, bold black. |
| `days` text | Smaller black text under the number. |

Selected state in reference: `3 days`.

### Plan Preview Strip

The plan preview strip is a compact light gray rounded rectangle under frequency. It is intentionally smaller than the original recommended setup card because this element confirms choices instead of collecting new input.

| Element | Accepted value / guidance |
| --- | --- |
| Background | Light gray, approximately `rgba(6,8,11,0.05)` or `#EFEFEF`. |
| Radius | Moderate, around `14-18`. |
| Header | `PLAN PREVIEW` with small lightning icon. |
| Layout | Compact one-line summary under the header. |
| Summary | Workouts/week, session duration, and structure. |
| Icon color | Black. |
| Text color | Black / dark gray. |

### Footer: Continue and Back

Use the same Step 1/2 footer language unless the whole Step 3 body needs to scroll.

| Element | Accepted value / guidance |
| --- | --- |
| Continue button | Black, full-width, rounded, white heavy text. |
| Back text | Centered below Continue, gray. |
| Footer position | At bottom of visible content when content fits; otherwise part of scroll content or sticky footer with no large dead band. |
| Continue text | `Continue` |
| Back text | `Back` |

## Implementation Notes

- Step 3 target combines current `profile` and `planning` concepts into one screen.
- Current gender and age collection should either move elsewhere, be removed from first-run onboarding, or become optional later; this document only defines the Step 3 target screen.
- `advanced` level support should be stored as `level: advanced`.
- `6+` frequency support should be stored as `daysPerWeek: 6`.
- Plan preview should update when level/frequency changes; reference copy is for Beginner + 3 days.
- Keep the visual system consistent with Step 1 and Step 2: black header, sloped transition, white lower pane, black Continue button.
