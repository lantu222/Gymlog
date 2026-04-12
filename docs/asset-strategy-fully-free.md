# Fully Free Asset Strategy

This is the default asset policy for the `codex/big-ui-refresh` branch.

## Goal

Use only image and icon sources that are:

- free to use in a commercial mobile app
- safe to ship without in-app credits when possible
- easy to replace, crop, and theme into Gymlog's dark visual system

## Approved Sources

### 1. Fitness photos

Primary:

- `Pexels`
- `Unsplash`

Use these for:

- category cards like `Strength`, `HIIT`, `Run`, `Yoga`
- onboarding reward screens
- premium promo surfaces
- workout/program hero thumbnails

Notes:

- prefer clean single-subject shots
- avoid visible logos, brand-heavy clothing, and watermarks
- do not imply the model endorses Gymlog

### 2. Supporting illustrations

Primary:

- `unDraw`

Use this for:

- empty states
- small secondary explainer surfaces
- non-fitness-specific supporting illustrations

Notes:

- use only where a photo is not needed
- keep color overrides minimal so the library still feels consistent

### 3. Icons

Primary:

- `Heroicons`
- `Lucide`
- `Material Symbols`

Use this for:

- navigation
- quick stats
- status tokens
- training metadata like duration, progress, rest, equipment

## Official License References

- `Pexels`: https://www.pexels.com/license/
- `Unsplash`: https://unsplash.com/license
- `unDraw`: https://undraw.co/license
- `Heroicons`: https://github.com/tailwindlabs/heroicons/blob/master/LICENSE
- `Lucide`: https://lucide.dev/license
- `Material Symbols`: https://fonts.google.com/icons
- `Dribbble terms`: https://dribbble.com/terms

## What We Will Not Use

- assets copied from Dribbble, Behance, Pinterest, or screenshots of other apps
- stock packs that require attribution on every screen
- assets with unclear license or missing source page
- images with strong brand/logo presence

## Credit Rules

### No in-app credit required by default

These are the preferred sources because they are easy to ship:

- `Pexels`
- `Unsplash`
- `unDraw`
- `Heroicons`
- `Lucide`
- `Material Symbols`

### Still keep internal source tracking

Even when public credit is not required, save:

- source site
- source URL
- download date
- intended screen/category

## Asset Register Format

Keep one line per asset in an internal register:

`strength-man-01 | Pexels | <url> | Home hero alt | downloaded 2026-04-02`

## Search Terms For Gymlog

### Strength

- `strength training man gym`
- `barbell bench press athlete`
- `powerlifting gym portrait`

### HIIT / conditioning

- `hiit workout woman gym`
- `functional fitness athlete`
- `circuit training female`

### Running

- `running woman studio`
- `runner dark background`
- `cardio athlete portrait`

### Mobility / recovery

- `stretching woman studio`
- `yoga athlete minimal`
- `mobility training gym`

## Visual Use Rules

- crop hard; do not use busy full-frame images
- prefer 4:5 or wide hero crops
- darken and soften backgrounds so text stays readable
- use photos as one strong surface, not repeated everywhere
- keep the main home hero image-led, but keep the logger more utilitarian

## Recommended First Stack For Gymlog

If we stay fully free, use this mix:

- `Pexels` for fitness people photos
- `Unsplash` as backup when Pexels selection is weak
- `Heroicons` or `Lucide` for app icons
- custom in-code SVG/CSS shapes for 3D-looking hero objects and glows
- `unDraw` only for secondary explanatory surfaces

## Enforcement Rules

Before adding any new external visual asset:

1. Verify the source page and license page.
2. Save the source URL in the asset register.
3. Confirm there is no visible brand/logo problem.
4. Confirm the image supports the current screen action instead of adding noise.
