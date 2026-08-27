# Programme tile photos

One photo per programme, for the welcome screen's marquee tiles
(`src/components/ProgramMarquee.tsx`). Downloaded at 1000 px on the long edge and cropped by the tile, not by the
download: the first pass asked Pexels for a 520×700 crop, which on a landscape
original is a hard zoom into its middle, and a 700 px landscape upscaled into a
portrait tile is where the softness came from. Full frame in, `resizeMode:
'cover'` does the rest. The tile draws them at 172×200 dp.

## Where they came from

All sixteen are from **Pexels**, under the
[Pexels License](https://www.pexels.com/license/): free for commercial use, no
attribution required, no sign-up. The id in each row is the Pexels photo id —
`https://www.pexels.com/photo/<id>/` opens the original.

| File | Pexels | What it shows |
|---|---|---|
| `advanced-glutes.jpg` | 14673249 | Lunge with a kettlebell, head out of frame |
| `athlete-conditioning.jpg` | 618612 | Feet at a track starting line |
| `calisthenics-mastery.jpg` | 4164645 | Hands gripping gymnastic rings |
| `dream-body-female.jpg` | 33832200 | Woman at a cable machine, from behind |
| `dream-body-man.jpg` | 8874376 | Back muscles, face turned away |
| `expert-powerbuilding.jpg` | 14762138 | Chalked hands before a lift, b&w |
| `fat-burn-hiit.jpg` | 9545911 | Kettlebells on a gym floor |
| `glute-foundations.jpg` | 8846362 | Legs mid-lunge with a dumbbell |
| `hourglass-shape.jpg` | 7675410 | Waist and midsection, close crop |
| `huge-elite.jpg` | 19254703 | Back and shoulder under load |
| `lean-shred-cut.jpg` | 5411023 | Treadmills facing a window |
| `powerbuild.jpg` | 19025673 | Barbell and plates in a rack |
| `runners-strength.jpg` | 15875678 | Runner's legs and shadow on a track |
| `shred.jpg` | 35376432 | Torso in a gym, b&w |
| `strong-lean-female.jpg` | 38576481 | Under the bar in a rack, from behind |
| `summer-conditioning.jpg` | 8544647 | Push-ups on a boardwalk, summer light |

## The rule these were chosen by

**No identifiable face.** Not a style preference — the Pexels licence covers
the photographer's copyright and says nothing about the rights of the person in
the picture. A tile headed "Dream Body Female" over a recognisable person
claims that person trains this programme and got that result, and that claim is
the app's problem, not the stock library's.

Six first picks were thrown out for exactly this: three had a face in frame,
one cropped to a shape that read as a swimwear shot rather than a set, and one
went so dark at tile size that the subject disappeared. Equipment and
lower-body framing turned out to be the reliable answer — a rack of dumbbells
carries a programme fine and cannot be a person.

Second rule, quieter: these sit under a colour scrim and behind a headline. A
photo that needs to be looked at to work is the wrong photo here.

## Replacing one

Drop a 3:4 JPEG in with the same filename. The mapping from programme id to
file is in `src/assets/programmePhotos.ts`; nothing else needs touching.
