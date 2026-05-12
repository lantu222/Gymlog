# Onboarding Step 4 Focus Areas

This document captures the Step 4 visual and product change from the May 2, 2026 onboarding review.

## Source Screens

- Target reference: `<reference-assets>\Step4\Step4screen_reference.png` (`853 x 1844`)
- Current implementation: `<reference-assets>\Step4\Step4_screen.png` (`393 x 856`)

## Intended Change

Step 4 changes from a weekly training-days picker into a focus-area selection screen. Training frequency now belongs to Step 3, so Step 4 can collect what the user wants the plan to emphasize.

- Step label: `STEP 4 OF 5`
- Title:

```text
WHAT DO YOU
WANT TO FOCUS ON?
```

- Subtitle: no supporting copy in the black header for this pass.

Current code note: the old Step 4 implementation was `TRAINING DAYS` with day-count cards. The target removes that from Step 4.

## Product Requirement

Step 4 is a multi-select screen with a maximum of 2 selected areas. Selecting a third area should keep the flow moving without an error state; the implementation replaces the oldest selected area with the newly selected one.

Visible focus areas:

| Row | Options |
| --- | --- |
| Row 1 | `Chest`, `Back`, `Shoulders` |
| Row 2 | `Arms`, `Abs`, `Quads` |
| Row 3 | `Glutes`, `Hamstrings`, `Calves` |

Removed from the visible Step 4 menu:

- `Strength`
- `Conditioning`
- `Running`
- `Mobility`

Compatibility note: old stored values such as `conditioning` may still exist in data for recommendation and migration safety, but they should not appear in the Step 4 grid.

## Plan Generation Contract

Step 4 is a soft preference layer, not a hard constraint. It should rank and shape compatible plans, not force a bad template just because a muscle group was selected.

| Focus area | Recommendation effect | Programme effect | Plan content requirement |
| --- | --- | --- | --- |
| Chest | Biases chest-tagged hypertrophy, upper/lower, and pressing-friendly plans. | May prioritize pressing accessories and repeated chest exposure. | At least one visible chest emphasis should appear across the first week when feasible. |
| Back | Biases pulling volume and back-tagged plans. | May prioritize rows/pulldowns and upper-back density. | Back work should not be hidden as a minor accessory only. |
| Shoulders | Biases shoulder/delt support, with joint-friendly caution if later limitations exist. | May include vertical press or delt accessories. | Avoid excessive shoulder stress for beginners. |
| Arms | Biases plans with arm accessory capacity. | Adds or preserves arm volume after anchors. | Arm focus should not replace main compound structure. |
| Abs | Maps to `core`; biases core-support plans. | Adds core work without changing split type. | Core appears as support work, not the whole plan. |
| Quads | Biases squat/leg-press/hack-squat patterns. | May emphasize quad accessories and squat patterns. | Lower days should visibly include quad work. |
| Glutes | Biases glute/lower-body and hypertrophy plans. | May emphasize hip thrust, hinge, lunge, or glute bridge work. | Glute focus should be explicit in session focus or accessory selection. |
| Hamstrings | Biases hinge/curl/posterior-chain work. | May add hamstring accessory volume. | Hamstring work should appear beyond incidental deadlift stress when feasible. |
| Calves | Biases lower-body accessory completeness. | May add calf accessories. | Calf focus should not outrank more important hard constraints. |

Selection rule: maximum 2 focus areas. If two focus areas conflict with equipment or days-per-week, the engine should prefer a coherent plan and explain the tradeoff.

## Asset Plan

The final target uses anatomy-style card images: a dark body figure with the selected muscle region highlighted in white.

This implementation now uses the first anatomy asset set provided for Upper Body and Lower Body:

- Card image areas use anatomy-style black images with white focus highlights.
- Labels, selection states, layout, grouping, and max-2 selection behavior are implemented.
- The UI still owns labels, checks, active outline, and card selection states.
- Future replacement assets can be inserted into the same mapping without changing the interaction model.

Current asset names:

| Option | Asset |
| --- | --- |
| Chest | `focus-chest-anatomy-card.png` |
| Back | `focus-back-anatomy-card.png` |
| Shoulders | `focus-shoulders-anatomy-card.png` |
| Arms | `focus-arms-anatomy-card.png` |
| Abs | `focus-abs-anatomy-card.png` |
| Quads | `focus-quads-anatomy-card.png` |
| Glutes | `focus-glutes-anatomy-card.png` |
| Hamstrings | `focus-hamstrings-anatomy-card.png` |
| Calves | `focus-calves-anatomy-card.png` |
| Mobility | `focus-mobility-anatomy-card.png` |

## Accepted Layout Snapshot

### Header

| Element | Accepted value / guidance |
| --- | --- |
| System/status area | Keep the existing white status area above the app content. |
| Black top pane | Same family and vertical rhythm as Step 1-3: `248` high, `paddingTop: 32`, `paddingBottom: 18`. |
| Progress bar | Inside the black pane above the step label. |
| Step label | `STEP 4 OF 5`, uppercase, muted white. |
| Headline | Large white 900-weight text, controlled two-line break. |
| Subtitle | Removed. Do not replace it with new header copy. |
| Sloped transition | Same white angled transition used in earlier onboarding steps. |

### Focus Grid

| Element | Accepted value / guidance |
| --- | --- |
| Lower pane | Near-white `#F5F5F5`. |
| Group labels | Removed to give the cards more vertical space. |
| Grid columns | 3 columns x 3 rows. |
| Card background | Step 1 card family: `#141414` behind the anatomy image. |
| Card radius | `8`. |
| Selected state | White outline around the full card and white check circle in the top-right. |
| Unselected state | Gray circular outline in the top-right. |
| Card label | Bottom-centered white bold label. The 3-column layout uses a compact `14 / 16`, `900`, `-0.2` variant of the Step 1 card label. |
| Info box | Restored below the grid with the lightning icon, `Why focus areas?`, supporting copy, and `Max 2 selections` pill. Lightning uses yellow accent, max-selection pill uses the established purple accent family. |

## Implementation Notes

- Step 4 uses focus-area presentation data rather than hard-coded day cards.
- `quads`, `hamstrings`, and `calves` are visible first-class focus-area values. `mobility` remains supported in data but is hidden from this onboarding grid.
- `Abs` is the user-facing label for the existing `core` focus-area value.
- The current visible onboarding grid is one 3-column x 3-row grid.
- `conditioning` remains a legacy-compatible value but is excluded from the Step 4 onboarding options.
- The visible card image slots use `FOCUS_AREA_CARD_ASSETS` in `OnboardingScreen.tsx`.
- V2 focus assets use `FOCUS_AREA_IMAGE_FRAMES` and `contain` rendering where needed so close-up anatomy images can zoom out inside the same card size.
- The accepted 3-column pass keeps the black top pane aligned to the other steps at `248`, uses `140` high focus cards, and keeps the info box compact at `62` minimum height.
