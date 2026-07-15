# Program photo placeholders

Real gym photos will be shot later (camera source: 9504 × 6336 px, 3:2 landscape).
Until then every surface that will show a photo renders an explicit placeholder so
swapping in the real assets is a drop-in change.

## Placeholder components

- `src/components/ProgramPhotoSlot.tsx` — dashed slot with a camera icon.
  Used on the program detail screen (ready programs only).
- `ProgramsHomeScreen` cover cards render a small camera chip
  (`coverPhotoMark`) on the designed gradient covers: the gradient stays as the
  fallback art, the chip marks the photo slot.

## Photo slots and target crops

| Surface | Component / location | Target crop | Notes |
|---|---|---|---|
| Programs home hero | `ProgramsHomeScreen` → `styles.hero` (camera chip marks the slot) | ~9:7 (full-bleed, 320px tall) | Photo of the ACTIVE program; keep the accent scrim overlay for text legibility. |
| Program detail hero | `ProgramDetailScreen` → `ProgramPhotoSlot` | 16:9 | Full-width above the plan card. |
| Explore cover card | `ProgramsHomeScreen` → `ProgramCover` | 4:5 portrait | Photo replaces the gradient; keep the bottom shade overlay for name legibility. |
| Program picked sheet | `ProgramsHomeScreen` modal (reuses `ProgramCover`) | 4:5 portrait | Same asset as the cover card. |
| Onboarding result cards (future) | Result Screen v2 spec (Excel) | 16:9 | Add `ProgramPhotoSlot` when the 2-card result screen is built. |

## Shooting / export guidance

From a 9504 × 6336 source:

- **16:9 hero**: crop to 9504 × 5346, export ~1920 × 1080 (or 2× for retina: 2560 × 1440).
- **4:5 cover**: crop to 5069 × 6336, export ~800 × 1000.
- Export as `.webp` (quality ~80) into `assets/programs/<program-id>/cover.webp`
  and `hero.webp`. Keep one photo per program family at minimum; per-program
  photos can come later.
- Leave headroom at the bottom third of cover crops — the name and shade
  gradient overlay sit there.
