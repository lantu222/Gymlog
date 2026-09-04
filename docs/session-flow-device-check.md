# Session flow — what to check on the device

The workout-session redesign (design handoff 2026-09-04) ships as six changes to
one screen. None of it is verifiable in a browser preview, so everything that
needs a pair of eyes on a real phone is collected here as it is written, and
walked in one pass when the last change lands.

Walk it in Finnish and in **both themes** — every change below is written
against theme tokens, so a wrong token shows up in exactly one of them.

**The boxes below are unticked, and that does not mean untested.** Two
emulator walkthroughs covered most of them; what they found is written in prose
under "Walked on an emulator" further down, not ticked here. The boxes are
left empty on purpose: nobody has walked this list item by item on a real
phone, and ticking them from a summary would turn a to-do into a claim.

## PR 1 · Session overview

- [ ] The three step cards read **1 · 2 · 3**, and the numbers sit where the
      play discs used to — no shift in the header's rhythm.
- [ ] **Workout is open** when the screen arrives; warm-up and recovery closed.
- [ ] Rows carry the load: `4 × 7 · 62,5 kg`. A bodyweight lift shows `4 × 7`
      with no trailing separator, a hold shows `4 × 45 s` and never a weight.
- [ ] **VIIME KERRALLA** row: `48 min · 12 340 kg` — check the thousands
      separator does not wrap, and that a first-ever run of a session shows no
      row at all rather than `0 min`.
- [ ] The `+2,5 kg tänään` pill and the last-time line fit on one line on a
      narrow phone (320 dp). The pill must not squash the line's numbers.
- [ ] Card outlines and the in-card hairline read correctly in **dark** — they
      were hardcoded light-theme lilac before this change.

## PR 2 · Session chrome

- [ ] `TREENI · 2/5 · 14:20` fits the top bar at 320 dp without truncating.
      Check the longest phase label (`LÄMMITTELY · 1/3`) too.
- [ ] The clock runs on **every** in-session screen, including the phase
      splashes, and is gone from the set screen's name row.
- [ ] A long lift name now has the whole name row: check a two-line name.
- [ ] Progress bar shows **this phase only** — 3 segments in the warm-up, one
      per exercise in the workout, 2 in the recovery.
- [ ] Rail colours: done = green, current = accent, still to come = faint.
      The faint segment must be visible in the light theme (opacity 0.35).
- [ ] The current exercise's set pill: green dots for logged sets, accent for
      the one being worked.
- [ ] The rail still opens the run sheet on tap.

## PR 3 · Warm-up

- [ ] The gate lists the drills — number, name, the body part it is there for,
      duration. Check a drill the library does not map: it must show the name
      and the duration with no empty second line.
- [ ] The list scrolls inside its card rather than pushing the title off a
      short screen. Test on the smallest device available.
- [ ] The second button is two lines (`Lämmittele omatoimisesti` / `Ohittaa
      liikkeet · kello käy kunnes olet valmis`) and reads as a peer of the CTA,
      not as a footnote.
- [ ] The recovery gate says stretches, not drills, in its second line.
- [ ] Free timer: the clock and nothing above it. `Viime kerralla käytit 4:20`
      under it — absent the first time, there from the second session.
- [ ] `TÄMÄN TREENIN KUORMAT` card: area chips, then `ENSIMMÄINEN LIIKE` with
      its weight. **This card must never name a drill** — that was removed on
      purpose (#bugs 2026-08-26).
- [ ] The card scrolls when the session loads five areas.
- [ ] `Tee ohjatut liikkeet sittenkin` sits **above** the Done button, clear of
      the Android system bar.
- [ ] Press Done after two seconds: nothing is recorded, and the next session
      still shows the previous "last time".
- [ ] An install that predates this change loads without a crash (the new
      preference field is normalized).

## PR 4 · Set screen

- [ ] The lift's card is at the top of every set screen: 64px photo with the
      play badge, name, ⓘ, `Napauta: kuva · ohje · historia`, and a
      `VIIME KERRALLA` row with the load and one pill per set.
- [ ] A lift with no history shows `Ensimmäinen kerta tällä liikkeellä`
      instead of an empty row.
- [ ] A lift with no photo shows its two initials, not a blank square.
- [ ] The **sound toggle is back** in the top bar on set screens, and toggling
      it there still silences the cues.
- [ ] Tapping the card opens the sheet. Three tabs. Check each:
      - Opettele: three cues, the technique self-audit and "Opittu" — only on
        the three lifts that have teaching written; the tab is absent otherwise
      - Näin teet: photo, numbered steps, `VARO NÄITÄ` chips
      - Historia: best set / 1RM / count, the bar chart with today's bar in
        accent, then rows newest first
- [ ] Log a set with the sheet open behind you, reopen it: today's row grows a
      pill and the chart's last bar moves.
- [ ] Beat your best: the `ENNÄTYS` pill appears on today's row.
- [ ] Set dots: logged = green filled with a check, current = accent ring.
- [ ] The CTA says `Kirjaa sarja 1`, `Kirjaa sarja 2`… and is accent-coloured
      (it was violet).
- [ ] Pause and ··· have labels under them.
- [ ] Long lift name: the card's name wraps to two lines without pushing the
      dials off screen. Check the tightest device.
- [ ] The sheet clears the Android system bar at the bottom.

## PR 5 · Rest, and walking to the next machine

- [ ] Rest opens with the set you just logged in a green card:
      `SARJA 1 KIRJATTU · Penkkipunnerrus · 62,5 kg × 7`, with `Muokkaa`.
      Press it: you land back on that set and can change it.
- [ ] The ring is neutral while resting and reads `1:14` over `/ 2:00`.
- [ ] `SEURAAVA · SARJA 2/4` card with the target and ONE weight — the gate's
      pick, with its delta against last session beside it. The three-option
      picker was removed on 2026-09-04.
- [ ] **The rest does not advance by itself.** Let it run out: the ring turns
      accent, the label reads `VALMISTA`, and `+0:12 yli` counts up. Put the
      phone down for a minute and come back — the count keeps rising and you
      are still on the rest screen.
- [ ] At zero the footer becomes one button: `Aloita sarja 2 · 62,5 kg`.
      Before zero it is still `−15s` / `+15s` / `Ohita lepo`.
- [ ] The rest-end notification still fires (PR #45) and lands you here.
- [ ] An interval's walk half is unchanged: it still runs on by itself, still
      green, still no ±15 s.
- [ ] Walking to the next exercise: **no countdown, no "pysäytä kello"**.
      The screen shows the finished lift in green with its rep pills, then the
      next lift with its photo and two stat cards (`TÄNÄÄN` accent /
      `VIIMEKSI`), a `Vaihda liike` link and `Aloita sarja 1`.
- [ ] The old full-screen "VALMIS" splash is gone — no flash between the last
      set and this screen.
- [ ] The session-length estimate on the overview did not change (the walk-up
      step keeps its nominal 15 s).

## PR 6 · Recovery naming, and the finish screen

- [ ] The block is called **Palautuminen** in all three places: the overview
      card, the gate, and the top bar. The top bar said `PALAUTUMINEN` in
      Finnish but `COOLDOWN` in English — check the English build too.
- [ ] `VIIKKO 1 · 2/5 tehty` with its segments is now directly under the title,
      not at the bottom of the screen.
- [ ] `MIKÄ LIIKAHTI` card appears when a lift went up: name, `+2,5 kg`, and
      `62,5 × 7 — ensi kerralla tavoittele 8.` on the line under it.
- [ ] A session where nothing went up shows **no card at all** — not an empty
      one.
- [ ] `MITÄ TEIT` rows show the comparison where "paras sarja" used to be:
      `+2,5 kg` green, `sama` muted, nothing at all the first time a lift is
      done. The PR badge is unchanged.
- [ ] Do the same lift lighter than last week: the row reads `−2,5 kg` and it
      does **not** appear in MIKÄ LIIKAHTI.
- [ ] A free workout (Empty workout) still finishes cleanly, with no MIKÄ
      LIIKAHTI card and no crash.
- [ ] The feel question on the way out is unchanged.

## Walked on an emulator 2026-09-04 (Pixel 7, dark, English)

Verified: the numbered steps and the open workout block; the session clock on
every screen; the phase-only progress bar with green/accent; the gate's drill
list and its two-line second button; the free timer's loads card; the set
screen's card, its three-tab sheet and its dot colours; the rest screen's
logged-set card, its three weights, and — the one that mattered — that it does
NOT advance itself; the walk-up screen with no clock and its DONE card; the
week bar under the finish screen's title; and no WHAT MOVED card on a session
that moved nothing.

Five defects found and fixed in `ff3a1ff`: the ring never turned accent at zero
(and its track was a hardcoded light-theme colour), "+6 over" read as a bare
number, the ±15 s row stayed after the wait ended, Skip rest was louder than
the button that goes forward, and the free timer had no top bar at all.

**Still unwalked**, and why — these need data this emulator profile does not
have:

- [ ] Loads on the overview rows, and the `+2,5 kg` pill: every lift in this
      profile is first-time, so there is no weight to show. Run the SAME
      session twice. (The mechanism is proven indirectly: LAST TIME's volume
      appeared the moment one session existed, from the same data path.)
- [x] ~~Amber caution rows and the `WATCH FOR` chips~~ — the amber rows were
      removed on 2026-09-04; the chips stay and are shown on the three lifts
      that have teaching written.
- [x] ~~The "always start on your own" offer~~ — removed on 2026-09-04. It was
      the one item this list could never reach without three sessions run that
      way, and it is gone rather than untested.
- [ ] The recovery gate and its top-bar label on a device.
- [x] The light theme — walked 2026-09-04, one defect found (see below).
- [x] Finnish — walked 2026-09-04.

## Design questions the walkthrough raised (not defects)

- The gate's per-drill purpose line read "Legs" three times on a leg day. An
  always-on label is noise; it should mark the exception or go.
- Loop and How to show the same text — Loop's SETUP is the first three of the
  same instructions. Two tabs, one answer.
- The sheet's height follows its tab, so switching from Loop to History shrinks
  it and moves the tab bar down under the reader's finger.
- Gate, walk-up, set screen and free timer all carry a lot of vertical dead
  space on a tall phone.
- `240 s rest` would read better as `4 min`.
- The finish screen titles the session "Strong Calves Pro - Day 2: Lower
  (Heavy)" where the overview says "Lower (Heavy)".
- `Finish` and the actions sheet's `Resume` are violet, against the app's own
  "orange is what you press" rule. Pre-existing, not from this change.

## Light theme and Finnish, walked 2026-09-04

Both were on the "still unwalked" list; both are walked now, and one real
defect came out of it.

**The rest ring never turned in the light theme.** It took RestRing's default
stroke — the purple token — and in light the purple and highlight tokens are
the same violet, so the ring the design turns accent at zero turned into
itself. The resting ring is named neutral now, which is what the design asked
for in the first place and makes the change visible in both themes.

Otherwise light holds: the session chrome, the lift card, the dots (green
logged, accent ring current), the single rest target, the READY state and its
one CTA all read on the lilac ground. Finnish reads throughout, decimal comma
included — `12,5 kg` on the dial, in the logged-set card and on the target.

Note for anyone reading a screenshot: in light the CTA is **green**, because
`accent` is green there and orange only in dark. That is the theme engine
working, not a colour bug.

**Still unwalked:** nothing. The amber caution rows were removed on 2026-09-04,
and so was the "always start on your own" offer — the one item this list could
never reach without three sessions run that way.

## After the walkthrough

Delete this file once every box is ticked — it is a to-do for one release, not
documentation.
