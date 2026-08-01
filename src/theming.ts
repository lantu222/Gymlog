import React, { createContext, createElement, useContext, useMemo } from 'react';

import { HG } from './lightTheme';

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
 * Today there is exactly one theme and the provider always serves it, so this
 * changes nothing you can see. It is deliberately landed early anyway: moving
 * ~54 files onto the hook is the bulk of the work, and it can only start once
 * the seam is here. The dark values, the switch and the preference come later
 * — and until they do, nothing in the app claims a theme can be chosen.
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
  blue: string;
  gold: string;
  proSheetTop: string;
  proSheetBottom: string;
}

/** The light theme is the palette itself — not a copy of it. */
export const lightTheme: Theme = HG;

const ThemeContext = createContext<Theme>(lightTheme);

/**
 * `createElement` rather than JSX so this file can stay `.ts`. The test build
 * compiles `src/**\/*.ts` only, and the theme is worth asserting on directly
 * rather than by reading its source.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return createElement(ThemeContext.Provider, { value: lightTheme }, children);
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
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
