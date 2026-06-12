# Handoff: GAINER Redesign — Onboarding, Home, Active Workout

## Overview
This package contains the redesigned GAINER (working title; codebase folder `Gymlog`) screens approved in design review:

1. **Onboarding flow** (11 screens, incl. Welcome) — light theme, no reward interstitials, no orb/mascot, sign-in moved to the end
2. **Home** — flat "no boxes" layout with one focal Today card
3. **Active Workout** — Lyfta-style flat logging list replacing the heavy focus card

**Implement in phases, in this order, one phase per session, commit per screen, on a dedicated git branch** (e.g. `redesign/light-theme`). Run the app and visually verify after every phase before starting the next. Do NOT attempt all phases in one pass — this codebase has a 11,966-line `OnboardingScreen.tsx` monolith and a previous big-bang attempt broke the app.

## About the Design Files
The files in `designs/` are **design references created in HTML/React (web)** — prototypes showing intended look and behavior, NOT production code to copy. The task is to **recreate these designs in the existing React Native (Expo) codebase** using its established patterns: `StyleSheet.create`, existing navigation, existing state/services, `react-native-svg` for icons, existing components like `GymlogIcon` where they fit.

Open the `.html` files in a browser to see the designs live. The `.jsx` files contain the exact styling values (sizes, colors, weights, spacing) — treat them as the spec source of truth.

## Fidelity
**High-fidelity.** Colors, type sizes, weights, radii, and spacing are final and should be matched closely (1–2 px tolerance). Exception: exercise thumbnails/diagrams are placeholders — keep whatever real illustrations/icons the app already has, in the same slot sizes.

## Design Tokens (shared across all screens)

Light palette (`HG` in the design files):

```
bg            #F7F3FF   (app background — NOTE: Home v2 and Active Workout v2 use pure #FFFFFF)
surface       #FFFFFF
surfaceSoft   #F2ECFF
ink           #101828   (primary text)
muted         #667085   (secondary text)
faint         #9A93AC   (tertiary/disabled text)
border        #E4D8FF
purple        #7C3AED   (primary action)
purpleDark    #5B21B6
purpleLight   #EFE7FF
green         #16A34A   greenSoft #E8F7EE
hairline      #EFEAF9   (section dividers, v2 screens)
inputBorder   #E2DBF2   (logging inputs)
doneTint      #F4EEFF   (completed set row)
softSurface   #FAF8FF   (thumb tiles, Today card)
danger        #D64545   (Cancel workout)
```

Typography: the prototypes use **Manrope**; in the app keep the existing font stack but match the **weight/size hierarchy**: 800 for headings/values/buttons, 600–700 for labels, tiny overline labels at ~11px / letter-spacing 0.1em / weight 800. Numbers use tabular numerals (`fontVariantNumeric: 'tabular-nums'` equivalent).

Radii: pills/buttons 999; cards 16–22; inputs 9–10; thumb tiles 12. Primary button shadow: `0 8px 20px rgba(124,58,237,0.28)`.

---

## PHASE 1 — Welcome screen
**Target:** `src/screens/WelcomeScreen.tsx` (279 lines, self-contained — low risk)
**Design:** screen "01 · Welcome" in `GAINER Onboarding.html` (component `OnbWelcome` in `onb-screens1.jsx`)

Replace the current dark theme (#080815) with the light design: white/`#F7F3FF` background, GAINER wordmark, one-line promise, 3 quiet feature pills (outline, not filled cards), single solid purple CTA pill. No carousel, no multiple CTAs. Styling values are in `onb-shared.jsx` + `onb-screens1.jsx`.

**Done when:** app launches into the new Welcome, CTA navigates to onboarding unchanged.

## PHASE 2 — Onboarding visual reskin (NO flow changes)
**Target:** `src/screens/OnboardingScreen.tsx` (11,966 lines — treat with care)
**Design:** screens 02–08 in `GAINER Onboarding.html`

Strictly limited scope: **colors, typography, spacing, and component styling only.** The color constants are centralized at the top of the file (`ONBOARDING_PANEL`, `ONBOARDING_PRIMARY`, `ONBOARDING_CARD`, …) — start there, then restyle the option cards, step bar, and CTA footer to match the design:

- Light background, ink text, purple accents (tokens above)
- **Step bar:** thin segmented progress at top, no percentage text
- **Option cards:** white, 1px `border` color, radius 16; selected = purple border + `purpleLight` tint; the "why it's great" confirmation appears INLINE under the selected card (expand animation), styled as in design — but if the codebase currently shows it as a separate screen, leave navigation as-is in this phase
- **CTA:** pinned footer, full-width purple pill, 999 radius
- **Building-your-plan loader:** calm list of steps, no orb/mascot/hype (visual restyle of the existing loader)

**Do NOT in this phase:** remove reward screens, move name collection, change step order, touch the recommendation engine.

**Done when:** full onboarding run-through works exactly as before, but light-themed.

## PHASE 3 — Home
**Target:** `src/screens/HomeScreen.tsx` (504 lines, data comes via props — low risk)
**Design:** `GAINER Home v2.html` (`home-v2.jsx`)

Layout top-to-bottom on **pure white** background:
1. **Header:** "Welcome back" (22/800 ink) + date/plan-week subline (13/600 muted); PRO badge pill (green) right
2. **Week strip:** 7 plain circles 34px, no container — done = purple fill + white check, today = `purpleLight` fill + `purpleDark` letter, other = 1.5px `hairline` outline + faint letter. Below: "1 of 3 sessions this week" left, streak right
3. **Today card** — the ONLY card on screen: `#FAF8FF` bg, 1px `border`, radius 22, padding 18. Contents: overline "TODAY · PUSH DAY" + "~50 min" right; workout name 27/800; first 3 exercises as rows (name 14/700 left, "4 × 6–8" 13/600 muted right, hairline dividers); "+ N more exercises" link 12.5/700 purple; **Start workout** pill 52px, purple, white text 16/800, arrow icon
4. **Routines:** section header (15.5/800 + "See all" purple link), then 3 flat rows (42px thumb tile `#FAF8FF` + 1px hairline border radius 12, title 15/800, sub 12.5/600 muted, chevron right), hairline dividers between rows: Templates / Explore plans / Empty workout
5. Existing bottom nav unchanged

**Done when:** Home renders with real data (streak, plan week, today's actual workout + exercises), Start navigates to logging.

## PHASE 4 — Active Workout (Lyfta-style flat logging)
**Target:** `src/screens/WorkoutLoggingScreen.tsx` (1,817 lines — medium risk; logic is entangled with the old card UI)
**Design:** `GAINER Active Workout v2.html` (`active-workout-v2.jsx`)

**Recommended approach:** first extract the logging logic (set state, timers, persistence) untouched, then rebuild the presentation around it.

Structure:
- **Header (white, no bar):** chevron-down (collapse/minimize) left, **Finish** purple pill (38px, 999) right. No workout title, no timer icon.
- **Stats strip:** one outlined row (1px `hairline`, radius 16): Duration (purple, live mm:ss) / Volume kg / Sets — label 12.5/600 muted, value 18/800
- **Exercise sections, flat list** with hairline dividers, no cards:
  - Header row: 46px thumb tile, name 16.5/800, ⋯ menu right (purple dots)
  - **⋯ menu** contains **Add note** → reveals a notes input under the header
  - **Rest Timer link** (purple, timer icon): tapping opens a dropdown: Off / 30s / 1:00 / 1:30 / 2:00 / 2:30 / 3:00, selected row highlighted `purpleLight`
  - **Set table** — grid `34px | 1fr | 64px | 64px | 40px`, headers SET / PREVIOUS / KG / REPS / (check) at 10.5/800 letter-spaced faint caps:
    - SET: row number 14.5/800
    - PREVIOUS: last session "60 kg × 8" 13.5/600 faint
    - KG and REPS: real TextInputs 36px high, radius 9, 1.5px `inputBorder`, bg `#FCFBFF`, centered 15/800; placeholder = previous values; numeric keyboards; focus = purple border
    - Check: 34px button radius 10, idle `#EFEBF9` w/ gray check, done = purple w/ white check. **Checking an empty row commits the placeholder (previous) values.** Done row gets `doneTint` background, inputs go borderless/transparent
  - **+ Add set:** full-width 38px pill, `#F1EDFA`, "+ Add set" 13.5/800; duplicates last set's targets
  - **Collapsed exercises:** thumb + name + "n/m done" (green when complete); tap to expand
- **Footer (in scroll, not pinned):** "Add exercise" 46px `purpleLight` pill + "Cancel workout" plain red text
- **Rest bar:** checking a set with rest enabled slides up a slim bottom bar (radius 20, `purpleDark` bg, shadow): REST overline + mm:ss countdown 21/800 tabular, pills −15s / +15s / **Skip** (white), 4px white progress line at bottom shrinking over the duration. NOT a fullscreen takeover. Slide-in ~380ms cubic-bezier(.22,1,.36,1); respect reduced motion.

**React Native watch-outs:** many TextInputs in a ScrollView → use `keyboardShouldPersistTaps="handled"` and proper KeyboardAvoidingView; prefer one FlatList/SectionList of set rows over deep nesting; keep timer in a ref-driven interval so re-renders don't drift it.

**Done when:** a full workout can be logged end-to-end (check sets, edit kg/reps, add set, add exercise, rest countdown, Finish saves identically to before).

## PHASE 5 (LAST, separate decision) — Onboarding flow changes
Only after phases 1–4 are stable. Riskiest part — touches the step state machine and recommendation engine inside the monolith:
- Remove reward/“Great choice!” interstitial screens → inline confirmation (screens 02–03 in the design)
- Remove name question from the questionnaire → identity comes from Google sign-in at the END ("11 · Save your plan"); name flows from the account
- Rebuild Plan-ready screens (09 overview, 10 day detail) per the design

Each bullet = its own commit. Re-run the full onboarding (all branch combinations: each location × goal at minimum) after each.

## Interactions & Behavior (summary)
- All primary CTAs: solid purple pill, radius 999, press feedback (slight opacity/scale)
- Inline expansions (option-card confirmation, exercise expand, notes): ~240ms ease, fade + 6px translate
- Rest dropdown and ⋯ menu: lightweight popovers anchored to the trigger, shadow `0 12px 30px rgba(40,24,90,0.16)`, radius 14
- Disable/respect reduced-motion for all entrance animations

## State Management
No new global state. Reuse existing stores/services for: workout session (sets, timers, persistence), plan/recommendation data, streak/dashboard data. New local UI state only: expanded exercise, open menus, rest-bar countdown, notes visibility.

## Assets
- Exercise thumbnails & focus-area diagrams: placeholders in the prototypes — use the app's existing illustrations at the same slot sizes (46px logging, 42px Home rows)
- Icons: simple 2px-stroke line icons (react-native-svg); match the paths in the design files where practical

## Files in this package
```
designs/GAINER Onboarding.html        ← open in browser; 11 screens left→right
designs/onb-main.jsx                  ← screen list/order
designs/onb-shared.jsx                ← onboarding shared atoms + tokens
designs/onb-screens1.jsx / 2 / 3      ← per-screen specs (source of truth)
designs/GAINER Home v2.html           ← Home design
designs/home-v2.jsx                   ← Home spec
designs/home-shared.jsx               ← palette (HG), StatusBar/BottomNav atoms
designs/GAINER Active Workout v2.html ← logging design
designs/active-workout-v2.jsx         ← logging spec
```
(The HTML files reference the design-canvas/React CDN scripts; they're for viewing only.)
