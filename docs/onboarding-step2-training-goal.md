# Onboarding Step 2 Training Goal

This document captures the Step 2 visual and product change from the April 30, 2026 path test follow-up. Use the accepted Step 1 layout measurements as the baseline unless this document explicitly says otherwise.

## Source Screen

- Target reference: user-provided Step 2 screenshot in the April 30, 2026 onboarding review thread.
- Baseline measurements: `docs/onboarding-step1-equipment-access.md`, section `Accepted Layout Snapshot`.

## Intended Change

Step 2 should become a clearer primary training-goal question:

- Step label: `STEP 2 OF 6`
- Title: `WHAT DO YOU WANT MOST?`
- Subtitle: `We'll build your training around this.`
- Options:
  - `Get stronger`
  - `Build muscle`
  - `Lean & athletic`
  - `General fitness`

The reference screenshot shows compact dark goal cards with small supporting tags under each card subtitle. The tags are not separate inputs; they explain what the selected goal implies.

Current code note: the existing implementation still says `STEP 2`, `WHAT IS YOUR MAIN GOAL?`, `Pick one or more.`, and uses the older four-goal model. This document describes the target Step 2 state, not the current code state.

## Product Requirement

The visual change should not collapse distinct user intent into vague labels. Step 2 has four visible choices. Running/hybrid intent is captured in Step 1 through `trainingEnvironment: running_hybrid`, not as a Step 2 goal.

Recommended goal values:

| UI option | Recommended stored goal | Recommendation meaning |
| --- | --- | --- |
| Get stronger | `strength` | Heavy compound lifts, lower primary rep ranges, longer rests, progressive strength. |
| Build muscle | `muscle` | Hypertrophy volume, moderate rep ranges, visible muscle and size focus. |
| Lean & athletic | `lean_athletic` | Hybrid strength, conditioning, lower-fatigue plan design. |
| General fitness | `general_fitness` | Sustainable, beginner-friendly, flexible health and consistency goal. |

Keep separate precise Step 2 intent values so `Lean & athletic` and `General fitness` do not become indistinguishable recommendation inputs. Running/hybrid recommendation bias should come from Step 1 and later conditioning/focus signals.

Interaction note: the phrase `WHAT DO YOU WANT MOST?` reads as a primary single-choice question. If multi-select remains intentional, the copy should make that clear. My recommendation is to treat Step 2 as one primary goal and use later steps for secondary outcomes.

## Option Content

| Option | Subtitle | Tags | Icon direction |
| --- | --- | --- | --- |
| Get stronger | `Focus on heavy lifts and progressive strength.` | `Lower reps`, `Longer rest`, `Strength focus` | Dumbbell / barbell |
| Build muscle | `Higher volume training to build size and definition.` | `Hypertrophy`, `Moderate reps`, `More volume` | Flexed arm / muscle |
| Lean & athletic | `Stay lean while building strength and performance.` | `Hybrid training`, `Conditioning`, `Lower fatigue` | Running / athletic movement |
| General fitness | `Balanced training for overall health and consistency.` | `Beginner friendly`, `Sustainable`, `Flexible` | Heart |

## Accepted Layout Snapshot

These values intentionally mirror Step 1 so the onboarding flow feels like one system.

### Header and Pane Geometry

| Element | Accepted value |
| --- | --- |
| Stage background | Prefer `#000000` / near-black for the visible Step 2 card area shown in the reference; if using the shared split shell, keep Step 1 `#F5F5F5` lower pane only when the approved full screenshot confirms it. |
| Stage horizontal bleed | `marginHorizontal: -18` |
| Black top pane | Start from Step 1: `height: 248`, `backgroundColor: #000000` |
| Top pane horizontal padding | `36` each side |
| Top pane padding | Start from Step 1: `paddingTop: 32`, `paddingBottom: 18` |
| Header copy offset | Start from Step 1: `paddingTop: 20`, `paddingBottom: 0`, `gap: 3` |
| Progress bar position | Same as Step 1: inside the black pane, above `STEP 2 OF 6`, with `marginBottom: 12` |
| Progress segments | `height: 4`, `borderRadius: 999`, `gap: 6`, inactive `rgba(255,255,255,0.10)`, active `#F3F7FF` |
| Sloped transition | If Step 2 keeps the Step 1 shell: `height: 72`, `bottom: -36`, `left/right: -12`, `backgroundColor: #F5F5F5`, `rotate: -4deg` |
| Options shift | Step 2 uses `translateY: 8` to lower the four-card stack and reduce the dead area above Continue |
| Scroll behavior | Target should be non-scrollable on the same Pixel-style viewport; with four cards, use card height rather than empty whitespace to keep the stack close to the footer. |

The screenshot crop does not show the progress bar or system/status area. In the real app, keep the same Step 1 convention: progress bar and `STEP 2 OF 6` sit above the headline.

### Header Text

| Text | Font size | Line height | Weight | Letter spacing | Color |
| --- | ---: | ---: | --- | ---: | --- |
| `STEP 2 OF 6` | `10` | `12` | `900` | `1.2` | `rgba(255,255,255,0.6)` |
| `WHAT DO YOU WANT MOST?` | Start from Step 1 compact headline: `34` | `37` | `900` | `-0.8` | `#FFFFFF` |
| `We'll build your training around this.` | `12` | `15` | `700` | default | `rgba(255,255,255,0.72)` |

If the headline is rendered as uppercase, keep the line breaks controlled so it reads like the screenshot:

```text
WHAT DO YOU
WANT MOST?
```

### Goal Cards

| Element | Accepted value |
| --- | --- |
| Card count | `4` |
| Card list gap | `8` |
| Pressable wrapper | Same as Step 1: `width: 100%`, `padding: 2`, `position: relative` |
| Card min height | Step 2 roomy cards: `100` so the stack reaches close to the Continue button even with four options |
| Card padding | Step 2 roomy cards: `paddingHorizontal: 14`, `paddingVertical: 14` |
| Card radius | `8` |
| Card background | Default `#141414`, active `#171717` |
| Card border | Default `rgba(255,255,255,0.12)`, active `rgba(255,255,255,0.22)` |
| Active outline | Same as Step 1: absolute fill on wrapper, `borderWidth: 2`, `borderRadius: 10`, `borderColor: #FFFFFF` |
| Active shadow | `shadowColor: #000000`, `shadowOffset: 0 / 8`, `shadowOpacity: 0.2`, `shadowRadius: 14`, `elevation: 4` |
| Row layout | `flexDirection: row`, `alignItems: center` |
| Text column | `flex: 1`, `marginLeft: 12`, `gap: 3` |
| Title row | `flexDirection: row`, `alignItems: center`, `flexWrap: nowrap` |

The active outline must cover the full card perimeter on every option. It should look identical to the accepted Step 1 outline behavior.

### Goal Text and Tags

| Element | Font size | Line height | Weight | Letter spacing | Color |
| --- | ---: | ---: | --- | ---: | --- |
| Goal title | Start from Step 1 option title: `17` | `19` | `900` | `-0.2` | `#FFFFFF` |
| Goal subtitle | Start from Step 1 option subtitle: `9.5` | `12` | `600` | `-0.1` | `rgba(255,255,255,0.72)` |
| Tag text | Step 1 badge text: `8` | `10` | `900` | default | Tone-specific |

Tag container guidance:

| Element | Accepted value |
| --- | --- |
| Tag colors | Use the exact Step 1 badge tones: neutral `rgba(255,255,255,0.16)` / `rgba(255,255,255,0.88)`, green `rgba(69,190,126,0.2)` / `#8BDEAE`, blue `rgba(104,184,255,0.2)` / `#8FCAFF`, purple `rgba(198,139,255,0.2)` / `#D9A9FF` |
| Tag radius | `9` |
| Tag horizontal padding | `5` |
| Tag vertical padding | `2` |
| Tag row gap | `4` |
| Tag wrapping | Keep tags on one row when possible; allow wrap only if a localized label would overflow. |

The tags should be readable but secondary. They should not compete with the option title.

### Icon and Selection Circle

Use the Step 1 icon and radio/check baseline.

| Element | Accepted value |
| --- | --- |
| Icon tile | Keep the same black rounded-square treatment as Step 1 cards |
| Selection circle size | `24 x 24` |
| Selection circle radius | `12` |
| Selection circle border | `1.5`, inactive `rgba(255,255,255,0.58)`, active `#FFFFFF` |
| Active circle fill | `#FFFFFF` |
| Check container | `16 x 16`, `position: relative` |
| Check color | `#111111` |
| Short check stroke | `width: 7`, `height: 2`, `left: 1`, `top: 9`, `rotate: 45deg` |
| Long check stroke | `width: 13`, `height: 2`, `left: 5`, `top: 6`, `rotate: -45deg` |

The checkmark must remain fully visible inside the white circle.

### Footer: Continue and Back

Step 2 should use the same footer placement as the accepted Step 1 state.

| Element | Accepted value |
| --- | --- |
| Footer background | Same as surrounding lower area. Use `#FFFFFF` only if Step 2 keeps the shared light lower pane; otherwise use near-black to match the reference. |
| Footer horizontal padding | `18` |
| Footer top padding | Base `10`, overridden to `0` for location-style stages when needed |
| Footer bottom padding | `insets.bottom + 6` |
| Footer gap | `6` |
| Footer border | Hidden for this onboarding shell: `borderTopWidth: 0`, `borderTopColor: transparent` |
| Continue button width | `100%`, `maxWidth: 360` |
| Continue button height | `minHeight: 44` |
| Continue button radius | `18` |
| Continue text | `fontSize: 19`, `fontWeight: 900`, `letterSpacing: -0.3` |
| Back text | `fontSize: 14`, `fontWeight: 800` |

Avoid creating a large empty band above the footer. If the screen needs compression, reduce vertical gaps before reducing title or tag readability.
