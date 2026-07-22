/**
 * GAINER light-theme palette ("HG" tokens) for the Phase 6 redesign screens.
 *
 * These mirror the design handoff's shared palette (home-shared.jsx). The global
 * `theme.ts` is still the legacy dark theme; the redesigned light screens import
 * from here instead so the five Phase 6 screens share one source of truth rather
 * than drifting copies. Do not wire this into the dark screens.
 */
export const HG = {
  bg: '#F7F3FF',
  surface: '#FFFFFF',
  surfaceSoft: '#F2ECFF',
  ink: '#101828',
  // muted/faint/border darkened 2026-07-22 (user: hairlines and secondary text
  // read too washed-out on device).
  muted: '#5B6472',
  faint: '#867E9C',
  border: '#D6C6F5',
  shadow: '#D8C7FF',
  purple: '#7C3AED',
  purpleDark: '#5B21B6',
  purpleLight: '#EFE7FF',
  green: '#16A34A',
  greenSoft: '#E8F7EE',
  greenInk: '#157A3A',
  blue: '#0A84FF',
  gold: '#F4B740',
} as const;

export type HGToken = keyof typeof HG;

/**
 * Home v3 palette (GAINER Home v3 mock, 2026-07). The Home screen and bottom
 * bar moved to this slightly cooler, higher-contrast take on the light theme;
 * other Phase 6 screens still use HG above until they are migrated.
 */
export const HG3 = {
  bg: '#EFEAF9',
  surface: '#FFFFFF',
  ink: '#17131F',
  // muted/faint/border darkened 2026-07-22 (user: hairlines and secondary text
  // read too washed-out on device).
  muted: '#5E5670',
  faint: '#8A82A0',
  purple: '#6D28D9',
  purpleBright: '#7C3AED',
  purpleSoft: '#EEE7FC',
  border: '#D8CBEE',
  green: '#16A34A',
  gold: '#E4B14C',
  // Pro sheet gradient stops (dark violet).
  proSheetTop: '#241A3E',
  proSheetBottom: '#150E28',
} as const;

export type HG3Token = keyof typeof HG3;
