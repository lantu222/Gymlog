/**
 * The app's dark palette.
 *
 * It is not a mechanical inversion of `HG`. The app already had a dark visual
 * language before it had a dark theme — the AI Coach surface, the paywall
 * sheets, the exercise-info panel — and all of them are dark *violet*, not
 * neutral grey. `COACH` in particular has been on screen since 2026-07-19 and
 * the user has approved how it reads. So the values below start from COACH's
 * text and accent colours and build the missing surfaces around them, which
 * means switching to dark makes the rest of the app look like the parts that
 * were already dark rather than like a different product.
 *
 * Two token pairs carry weight beyond their names:
 *
 *   ink / surface   — these are an inverting pair. A black button is written as
 *                     `backgroundColor: theme.ink` with `color: theme.surface`,
 *                     so in dark it becomes a white button with dark text,
 *                     which is what both platform conventions do.
 *   purpleLight /
 *   purpleSoft      — in light these are pale tinted *fills* that carry dark
 *                     text. Inverting them to dark tints keeps that role; a
 *                     literal lightening would have made unreadable surfaces.
 *
 * `gold` is unchanged: it is already a dark-surface colour in COACH and reads
 * correctly on both backgrounds. The Pro sheet gradient stops are unchanged for
 * the same reason — they were always dark.
 *
 * 2026-08-10: the surfaces moved to the boost design's dark values. Two things
 * changed and both are about depth. The page went deeper and bluer, so a card
 * sitting on it reads as a card rather than as a slightly different grey. And
 * the card outline became a translucent white hairline instead of an opaque
 * violet one — on a near-black page an opaque border draws itself, while a
 * hairline lets the surface do the separating. The text ramp and the orange
 * action accent are unchanged: those were decided on their own evidence.
 */
export const HG_DARK = {
  bg: '#0D0A20',
  surface: '#191436',
  surfaceSoft: '#201A42',
  // COACH's own text ramp, unchanged.
  ink: '#F4F1FF',
  muted: '#A79FC4',
  faint: '#8B83AE',
  // A hairline, not a line. See the note above.
  border: 'rgba(255, 255, 255, 0.09)',
  // A violet drop shadow is invisible on a dark background; black still reads.
  shadow: '#000000',
  // The light theme's purples are 4.5:1 against white and near-invisible
  // against #141021, so the whole accent ramp lifts rather than inverts.
  purple: '#9B6DFF',
  purpleBright: '#A78BFA',
  purpleDark: '#8B5CF6',
  purpleLight: '#2C2350',
  purpleSoft: '#2A2049',
  green: '#37D08A',
  greenSoft: '#16321F',
  greenInk: '#5FE3A6',
  // The action accent goes orange in dark (user decision 2026-08-01). Warm
  // enough to lead the eye on a near-black screen, and far enough from `gold`
  // (#E4B14C) that a favourite star and a start button do not read alike.
  accent: '#FF8A4C',
  // Dark collapses the two accent families into one: anything pressable is
  // orange, violet carries brand and structure. `onHighlight` is near-black
  // because white on #FF8A4C is about 2:1 — a white TODAY badge would be
  // unreadable.
  highlight: '#FF8A4C',
  highlightSoft: 'rgba(255, 138, 76, 0.26)',
  onHighlight: '#241203',
  blue: '#4FA8FF',
  gold: '#E4B14C',
  // The caution and danger washes invert: light's cream and pink become a
  // tinted panel a shade off `surface`, with the ink brightened to carry the
  // meaning instead. The light values (#FDF3E3, #FEF2F2) are all but white and
  // would have read as two lit panels on a near-black page.
  amber: '#F0A44E',
  amberSoft: '#2E2216',
  amberBorder: 'rgba(240, 164, 78, 0.30)',
  amberInk: '#F3C68A',
  danger: '#FF6B6B',
  dangerSoft: '#331A1E',
  dangerBorder: 'rgba(255, 107, 107, 0.30)',
  proSheetTop: '#241A3E',
  proSheetBottom: '#150E28',
};
