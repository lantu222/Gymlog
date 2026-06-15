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
  muted: '#667085',
  faint: '#9A93AC',
  border: '#E4D8FF',
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
