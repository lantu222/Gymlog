# Onboarding Step 4 Focus Areas

This document captures the Step 4 visual and product change from the May 2, 2026 onboarding review.

## Source Screens

- Target reference: `D:\Gymlog dokumentointi\Step4\Step4screen_reference.png` (`853 x 1844`)
- Current implementation: `D:\Gymlog dokumentointi\Step4\Step4_screen.png` (`393 x 856`)

## Intended Change

Step 4 changes from a weekly training-days picker into a focus-area selection screen. Training frequency now belongs to Step 3, so Step 4 can collect what the user wants the plan to emphasize.

- Step label: `STEP 4 OF 6`
- Title:

```text
WHAT DO YOU
WANT TO FOCUS ON?
```

- Subtitle:

```text
Select up to 2 areas.
Why focus areas? We'll prioritize what matters most in your program.
```

Current code note: the old Step 4 implementation was `TRAINING DAYS` with day-count cards. The target removes that from Step 4.

## Product Requirement

Step 4 is a multi-select screen with a maximum of 2 selected areas. Selecting a third area should keep the flow moving without an error state; the implementation replaces the oldest selected area with the newly selected one.

Visible focus areas:

| Row | Options |
| --- | --- |
| Row 1 | `Chest`, `Back`, `Shoulders`, `Arms` |
| Row 2 | `Quads`, `Glutes`, `Hamstrings`, `Calves` |
| Row 3 | `Abs`, `Mobility` centered in the same 4-column grid rhythm |

Removed from the visible Step 4 menu:

- `Strength`
- `Conditioning`
- `Running`

Compatibility note: old stored values such as `conditioning` may still exist in data for recommendation and migration safety, but they should not appear in the Step 4 grid.

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
| Black top pane | Same family as Step 1-3, taller than compact Step 1 because the title is longer. |
| Progress bar | Inside the black pane above the step label. |
| Step label | `STEP 4 OF 6`, uppercase, muted white. |
| Headline | Large white 900-weight text, controlled two-line break. |
| Subtitle | Two-line muted white supporting copy. The old `Why focus areas?` info-box message is folded into this area. |
| Sloped transition | Same white angled transition used in earlier onboarding steps. |

### Focus Grid

| Element | Accepted value / guidance |
| --- | --- |
| Lower pane | Near-white `#F5F5F5`. |
| Group labels | Removed to give the cards more vertical space. |
| Grid columns | 4 columns. The final row uses two centered cards for `Abs` and `Mobility`. |
| Card background | Step 1 card family: `#141414` behind the anatomy image. |
| Card radius | `8`. |
| Selected state | White outline around the full card and white check circle in the top-right. |
| Unselected state | Gray circular outline in the top-right. |
| Card label | Bottom-centered white bold label. The 4-column layout uses a compact `14 / 16`, `900`, `-0.2` variant of the Step 1 card label. |
| Info box | Removed; the explanatory copy moved into the black top pane subtitle. |

## Implementation Notes

- Step 4 uses focus-area presentation data rather than hard-coded day cards.
- `quads`, `hamstrings`, `calves`, and `mobility` are first-class focus-area values.
- `Abs` is the user-facing label for the existing `core` focus-area value.
- The current visible onboarding grid is one 4-column grid: two full rows plus a centered `Abs` / `Mobility` row.
- `conditioning` remains a legacy-compatible value but is excluded from the Step 4 onboarding options.
- The visible card image slots use `FOCUS_AREA_CARD_ASSETS` in `OnboardingScreen.tsx`.
- V2 focus assets use `FOCUS_AREA_IMAGE_FRAMES` and `contain` rendering where needed so close-up anatomy images can zoom out inside the same card size.
- The accepted 4-column pass keeps the black top pane at `252` and uses `130` high focus cards so the screen stays non-scrollable with three card rows.
