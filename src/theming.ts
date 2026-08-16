import React, { createContext, createElement, useContext, useMemo } from 'react';

import { AW3_DARK, HG_DARK } from './darkTheme';
import { AW3, AW3Palette, HG } from './lightTheme';

/**
 * The runtime theme seam.
 *
 * `StyleSheet.create` runs at module scope, before any React context exists,
 * so a style sheet built there can never react to a theme change. That is the
 * whole reason this file exists: styles that need to follow the theme are
 * written as a factory and built inside the component instead.
 *
 *     const makeStyles = (theme: Theme) => StyleSheet.create({ … });
 *     …
 *     const styles = useThemedStyles(makeStyles);
 *
 * There are two themes now. Which one is served is decided outside this file —
 * `resolveThemeName` in lib/themePreference.ts combines the user's toggle with
 * the Pro entitlement — so nothing here needs to know about preferences, Pro,
 * or storage, and a component can be rendered under either theme in isolation.
 */

/**
 * The token shape every theme fills. Identical to `HG` by construction, so a
 * migrated component and an unmigrated one cannot disagree about a colour.
 */
export interface Theme {
  bg: string;
  surface: string;
  surfaceSoft: string;
  ink: string;
  muted: string;
  faint: string;
  border: string;
  shadow: string;
  purple: string;
  purpleBright: string;
  purpleDark: string;
  purpleLight: string;
  purpleSoft: string;
  green: string;
  greenSoft: string;
  greenInk: string;
  /**
   * The colour of "do the thing" — the start-workout CTA. Deliberately its own
   * token rather than `green`: green also means *done* (completed sets,
   * finished cardio, success chips), and those must not move when the action
   * accent does.
   */
  accent: string;
  /**
   * Everything else that is interactive: text links, the active tab, the TODAY
   * badge, secondary filled buttons.
   *
   * In light this is the same violet the app has always used, so nothing
   * changes there. In dark it converges on `accent` — one orange for anything
   * you can press, with violet left to carry brand and structure (user
   * decision 2026-08-01).
   */
  highlight: string;
  /** A tinted wash of `highlight`, e.g. the sliding circle in the tab bar. */
  highlightSoft: string;
  /**
   * What goes ON a filled `highlight`. White works on violet and on green, but
   * not on a light orange — a white TODAY badge would be unreadable in dark.
   */
  onHighlight: string;
  blue: string;
  gold: string;
  /** Caution: a missing piece of gear, a form warning, an "check this" note. */
  amber: string;
  amberSoft: string;
  amberBorder: string;
  amberInk: string;
  /** Destructive: delete, reset, remove. */
  danger: string;
  dangerSoft: string;
  dangerBorder: string;
  proSheetTop: string;
  proSheetBottom: string;
}

/** The light theme is the palette itself — not a copy of it. */
export const lightTheme: Theme = HG;

/** Typed here rather than in darkTheme.ts, so the two files cannot cycle. */
export const darkTheme: Theme = HG_DARK;

export type ThemeName = 'light' | 'dark';

export function themeForName(name: ThemeName): Theme {
  return name === 'dark' ? darkTheme : lightTheme;
}

const ThemeContext = createContext<Theme>(lightTheme);

/**
 * `createElement` rather than JSX so this file can stay `.ts`. The test build
 * compiles `src/**\/*.ts` only, and the theme is worth asserting on directly
 * rather than by reading its source.
 *
 * `theme` defaults to light so a screen rendered outside the app's provider —
 * a test, a preview — still gets a complete palette instead of undefined
 * tokens.
 */
export function ThemeProvider({
  theme = lightTheme,
  children,
}: {
  theme?: Theme;
  children: React.ReactNode;
}) {
  return createElement(ThemeContext.Provider, { value: theme }, children);
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}

/**
 * Which theme is active, for the handful of decisions that are not a colour —
 * status-bar icon style, a keyboard appearance, an image asset. Derived from
 * the same context rather than stored in a second one, so the two can never
 * disagree about what is on screen.
 */
export function useThemeName(): ThemeName {
  return useContext(ThemeContext) === darkTheme ? 'dark' : 'light';
}

/**
 * The Active Workout field palette for a given theme.
 *
 * AW3 lives in lightTheme.ts and the logging surfaces imported it from there
 * directly, which meant every field, hairline and placeholder in them stayed
 * light under the dark theme — the logged-set row glowed white and the numbers
 * in it went nearly invisible. Import this instead of AW3; the light half is
 * the same object, so nothing about the light theme changes.
 *
 * Takes a theme rather than reading context, because most of these colours are
 * consumed inside a `makeStyles(theme)` factory, and a factory cannot call a
 * hook. `useAW3` is the same thing for the handful of inline uses.
 */
export function aw3ForTheme(theme: Theme): AW3Palette {
  return theme === darkTheme ? AW3_DARK : AW3;
}

export function useAW3(): AW3Palette {
  return aw3ForTheme(useTheme());
}

/**
 * Per (factory, theme) cache. A `StyleSheet.create` on every render would be
 * waste, and the WeakMap keeps the entry only as long as the factory itself
 * lives — so a factory accidentally defined inside a component costs nothing
 * permanent, it just stops being cached.
 */
const styleCache = new WeakMap<object, Map<Theme, unknown>>();

/**
 * Builds a component's styles for the active theme.
 *
 * Define the factory at module scope. Defined inside a component it is a new
 * function every render, which defeats the cache — correct, but wasteful.
 */
export function useThemedStyles<T>(factory: (theme: Theme) => T): T {
  const theme = useTheme();
  return useMemo(() => {
    let byTheme = styleCache.get(factory);
    if (!byTheme) {
      byTheme = new Map();
      styleCache.set(factory, byTheme);
    }
    const cached = byTheme.get(theme);
    if (cached !== undefined) {
      return cached as T;
    }
    const built = factory(theme);
    byTheme.set(theme, built);
    return built;
  }, [factory, theme]);
}
