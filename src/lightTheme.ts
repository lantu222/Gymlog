/**
 * The app's one light palette.
 *
 * Until 2026-07-31 there were two: `HG` (46 files) and `HG3` (Home and the
 * bottom bar), a migration `lightTheme.ts` itself described as unfinished.
 * Two palettes meant "what is the background colour?" had two answers, which
 * makes a theme engine impossible — you cannot write one dark variant of two
 * competing light ones.
 *
 * They are now the same object. Where they disagreed, HG3's cooler and
 * higher-contrast values won (user decision 2026-07-31): it was the newer,
 * deliberate direction and it dresses the most-looked-at screen.
 *
 * `HG3` below is an alias, kept only so the migration could land without
 * touching 54 call sites at the same time as changing colours. Prefer `HG`.
 *
 * Deliberately NOT themed: `COACH` and the `PW` sheet gradients are designed
 * dark surfaces, not light-theme variants — the contrast is what marks the
 * paid features. They stay fixed in both modes.
 */
export const HG = {
  bg: '#EFEAF9',
  surface: '#FFFFFF',
  surfaceSoft: '#F2ECFF',
  ink: '#17131F',
  // muted/faint/border darkened 2026-07-22 (user: hairlines and secondary text
  // read too washed-out on device).
  muted: '#5E5670',
  faint: '#8A82A0',
  border: '#D8CBEE',
  shadow: '#D8C7FF',
  purple: '#6D28D9',
  /** The old HG.purple. Still the brighter accent on a few surfaces. */
  purpleBright: '#7C3AED',
  purpleDark: '#5B21B6',
  // purpleLight and purpleSoft are within a hair of each other and should
  // collapse into one token once every call site reads from `HG`.
  purpleLight: '#EFE7FF',
  purpleSoft: '#EEE7FC',
  green: '#16A34A',
  greenSoft: '#E8F7EE',
  greenInk: '#157A3A',
  blue: '#0A84FF',
  gold: '#E4B14C',
  // Pro sheet gradient stops (dark violet).
  proSheetTop: '#241A3E',
  proSheetBottom: '#150E28',
} as const;

export type HGToken = keyof typeof HG;

/**
 * Paywall-moment tokens ("PW", pw-shared.jsx): the locked-state language and
 * the caution colours the detection cards use. Shared by the locked card, the
 * contextual sheet, the Pro page, and the traffic-light rows so the moments
 * cannot drift apart.
 */
export const PW = {
  amber: '#D97706',
  amberSoft: '#FDF3E3',
  amberBorder: '#F0D3A2',
  amberInk: '#7A5B32',
  red: '#DC2626',
  redSoft: '#FDECEC',
  green: '#16A34A',
  greenSoft: '#E8F7EE',
  proInk: '#5B21B6',
  /** Contextual sheet gradient stops (dark violet). */
  sheetTop: '#251743',
  sheetMid: '#3A1F7A',
  sheetBottom: '#4A2398',
  sheetLavender: '#C9B6FF',
  sheetMint: '#8FE3B4',
} as const;

/**
 * Active Workout v3 palette additions ("AW3" tokens, aw3-shared.jsx). Field
 * and hairline colors for the shared logging surfaces: the freestyle Empty
 * Workout screen now, the Active Workout v3 rebuild later.
 */
export const AW3 = {
  hair: '#EEEAF7',
  ghost: '#C0B8D4',
  field: '#FAF8FF',
  fieldBorder: '#E5DEF4',
  ink2: '#3B3550',
  danger: '#D64545',
} as const;

export type AW3Token = keyof typeof AW3;

/**
 * @deprecated Alias of `HG`, which now carries these values. Kept so the
 * palette merge could land without rewriting 54 call sites in the same commit
 * as the colour change. Import `HG` in new code; this name goes away once the
 * remaining `HG3.` references are renamed.
 */
export const HG3 = HG;

export type HG3Token = HGToken;

/**
 * The AI Coach surface (design_handoff_ai_coach). Deliberately dark and gold
 * against the otherwise light app — the contrast is what marks it as the paid
 * feature. Shared with the full-analysis screen so the two cannot drift.
 */
export const COACH = {
  bg: '#17122A',
  surface: '#221A3D',
  surfaceSoft: '#1C1636',
  hairline: 'rgba(255,255,255,0.09)',
  text: '#F4F1FF',
  muted: '#A79FC4',
  faint: '#7C739E',
  gold: '#E4B14C',
  goldInk: '#2A1B05',
  purple: '#9B6DFF',
  good: '#37D08A',
  warn: '#E0922F',
  focusTop: '#2A1E4E',
  focusBottom: '#3A2A16',
  focusBorder: 'rgba(228,177,76,0.32)',
} as const;
