# Onboarding Step 1 Equipment Access

This document captures the Step 1 visual and product change from the April 30, 2026 path test.

## Source Screens

- Current implementation: `D:\Gymlog dokumentointi\Step1\Step1_1.png`
- Target reference: `D:\Gymlog dokumentointi\Step1\Step1screen_reference.png`

## Intended Change

Step 1 changes from a broad "Where do you train?" location question into a clearer "What equipment do you have access to?" equipment-access question.

The full screen should not be redesigned. Keep the existing top white system/status area and the current onboarding shell structure. The scoped UI change is the selection area and Step 1 copy:

- Step label: `STEP 1 OF 6`
- Title: `What equipment do you have access to?`
- Subtitle: `This helps us build the right program for you.`
- Options:
  - `Full Gym` with `MOST FLEXIBLE`
  - `Home Gym`
  - `Minimal Equipment` with `EFFICIENT`
  - `Bodyweight Only` with `BEGINNER FRIENDLY`
  - `Running / Hybrid` with `CARDIO FOCUSED`

The focus badges should be small, colored text pills. They are supporting labels, not primary buttons.

## Product Requirement

The visual change should not lose recommendation meaning. `Minimal Equipment`, `Bodyweight Only`, and `Running / Hybrid` can all map to the broad `equipment: minimal` compatibility bucket, but the selected Step 1 environment must remain available to recommendation profiling.

Recommended environment values:

| UI option | Broad equipment | Training environment |
| --- | --- | --- |
| Full Gym | `gym` | `full_gym` |
| Home Gym | `home` | `home_gym` |
| Minimal Equipment | `minimal` | `minimal_equipment` |
| Bodyweight Only | `minimal` | `bodyweight_only` |
| Running / Hybrid | `minimal` | `running_hybrid` |

## Implementation Notes

- Keep the existing black top pane and light lower pane.
- Replace the old four cards with five darker, taller cards.
- Active state should feel like the reference: complete animated full-card outline outside the card plus a large check circle, not a white filled card. The checkmark must fit fully inside the circle.
- Badge labels must stay readable at compact card size; avoid overly tiny uppercase text.
- Keep the Step label and progress bar visible above the headline; the progress bar should sit near the top of the visible black pane, below the safe-area overlay.
- Keep cards compact enough that the first four options and the footer are visible on a Pixel-style viewport without excessive scrolling.
- Step 1 should not scroll on the target Pixel-style viewport; the black header must fully contain the title/subtitle, and bottom whitespace should be used for option-card height before compressing card readability.
- `Bodyweight Only` must keep the `BEGINNER FRIENDLY` badge on the same title row.
- Keep the Continue / Back footer close to the bottom safe area; the footer should not consume a large white band above the home indicator.
- Do not change later onboarding steps as part of this task.
- Persist the precise Step 1 environment so edit mode and recommendations do not collapse the options back to the same `minimal` value.

## Accepted Layout Snapshot

Captured from the accepted Step 1 state on April 30, 2026. Treat these values as the baseline before making further Step 1 layout changes.

### Header and Pane Geometry

| Element | Accepted value |
| --- | --- |
| Stage background | `#F5F5F5` |
| Stage horizontal bleed | `marginHorizontal: -18` |
| Black top pane | `height: 248`, `backgroundColor: #000000` |
| Top pane horizontal padding | `36` each side |
| Step 1 top pane padding | `paddingTop: 32`, `paddingBottom: 18` |
| Header copy offset | `paddingTop: 20`, `paddingBottom: 0`, `gap: 3` |
| Progress bar position | Inside the black pane, above `STEP 1 OF 6`, with `marginBottom: 12` |
| Progress segments | `height: 4`, `borderRadius: 999`, `gap: 6`, inactive `rgba(255,255,255,0.10)`, active `#F3F7FF` |
| Sloped light pane overlay | `height: 72`, `bottom: -36`, `left/right: -12`, `backgroundColor: #F5F5F5` |
| Slope angle | `rotate: -4deg` |
| Lower pane | `backgroundColor: #F5F5F5`, `paddingHorizontal: 22`, `paddingTop: 4` |
| Step 1 options lift | `translateY: -12` |
| Scroll behavior | Step 1 is locked: `scrollEnabled: false`, `bounces: false`, `overScrollMode: never` |

The black pane must fully contain the progress bar, step label, headline, and subtitle. Do not let the subtitle intersect the sloped light pane.

### Header Text

| Text | Font size | Line height | Weight | Letter spacing | Color |
| --- | ---: | ---: | --- | ---: | --- |
| `STEP 1 OF 6` | `10` | `12` | `900` | `1.2` | `rgba(255,255,255,0.6)` |
| `What equipment do` / `you have access to?` | `34` | `37` | `900` | `-0.8` | `#FFFFFF` |
| `This helps us build the right program for you.` | `12` | `15` | `700` | default | `rgba(255,255,255,0.72)` |

### Option Cards

| Element | Accepted value |
| --- | --- |
| Card list gap | `8` |
| Pressable wrapper | `width: 100%`, `padding: 2`, `position: relative` |
| Card min height | `54` on compact Step 1 cards |
| Card padding | `paddingHorizontal: 14`, compact `paddingVertical: 7` |
| Card radius | `8` |
| Card background | Default `#141414`, active `#171717` |
| Card border | Default `rgba(255,255,255,0.12)`, active `rgba(255,255,255,0.22)` |
| Active outline | Absolute fill on wrapper, `borderWidth: 2`, `borderRadius: 10`, `borderColor: #FFFFFF` |
| Active shadow | `shadowColor: #000000`, `shadowOffset: 0 / 8`, `shadowOpacity: 0.2`, `shadowRadius: 14`, `elevation: 4` |
| Row layout | `flexDirection: row`, `alignItems: center` |
| Text column | `flex: 1`, `marginLeft: 12`, `gap: 3` |
| Title row | `flexDirection: row`, `alignItems: center`, `flexWrap: nowrap`, `gap: 4` |

The active outline must cover the full card perimeter on every option, not only `Full Gym`. `Bodyweight Only` must keep `BEGINNER FRIENDLY` on the same title row.

### Option Text and Badges

| Element | Font size | Line height | Weight | Letter spacing | Color |
| --- | ---: | ---: | --- | ---: | --- |
| Option title | `17` | `19` | `900` | `-0.2` | `#FFFFFF` |
| Option subtitle | `9.5` | `12` | `600` | `-0.1` | `rgba(255,255,255,0.72)` |
| Badge text | `8` | `10` | `900` | default | Tone-specific |

| Badge tone | Background | Text color |
| --- | --- | --- |
| `MOST FLEXIBLE` | `rgba(255,255,255,0.16)` | `rgba(255,255,255,0.88)` |
| `EFFICIENT` | `rgba(69,190,126,0.2)` | `#8BDEAE` |
| `BEGINNER FRIENDLY` | `rgba(104,184,255,0.2)` | `#8FCAFF` |
| `CARDIO FOCUSED` | `rgba(198,139,255,0.2)` | `#D9A9FF` |

Badge container: `borderRadius: 9`, `paddingHorizontal: 5`, `paddingVertical: 2`, `flexShrink: 0`.

### Selection Circle and Check

| Element | Accepted value |
| --- | --- |
| Circle size | `24 x 24` |
| Circle radius | `12` |
| Circle border | `1.5`, inactive `rgba(255,255,255,0.58)`, active `#FFFFFF` |
| Active circle fill | `#FFFFFF` |
| Check container | `16 x 16`, `position: relative` |
| Check color | `#111111` |
| Short check stroke | `width: 7`, `height: 2`, `left: 1`, `top: 9`, `rotate: 45deg` |
| Long check stroke | `width: 13`, `height: 2`, `left: 5`, `top: 6`, `rotate: -45deg` |

The checkmark must remain fully visible inside the white circle.

### Footer: Continue and Back

The footer is fixed below the non-scrollable Step 1 body. It should sit close to the bottom safe area, as in the accepted screenshot, without creating a large empty white band between the option cards and the button.

| Element | Accepted value |
| --- | --- |
| Footer background | `#FFFFFF` |
| Footer horizontal padding | `18` |
| Footer top padding | Base `10`, overridden to `0` for location stage |
| Footer bottom padding | `insets.bottom + 6` |
| Footer gap | `6` |
| Footer border | Hidden for location stage: `borderTopWidth: 0`, `borderTopColor: transparent` |
| Continue button width | `100%`, `maxWidth: 360` |
| Continue button height | Location stage `minHeight: 44` |
| Continue button radius | Inherits `18` |
| Continue button color | `#000000` |
| Continue text | `fontSize: 19`, `fontWeight: 900`, `letterSpacing: -0.3`, `color: #FFFFFF` |
| Disabled Continue text | `rgba(255,255,255,0.42)` |
| Back text | `fontSize: 14`, `fontWeight: 800`, `color: rgba(6,8,11,0.68)` |
