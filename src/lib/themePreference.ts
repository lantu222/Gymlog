import { AppPreferences } from '../types/models';

export type ThemeName = 'light' | 'dark';

type ThemePreferences = Pick<AppPreferences, 'darkThemeEnabled'>;

/**
 * Which theme the app should serve.
 *
 * The reader's switch, and nothing else.
 *
 * Dark used to be a Pro perk (2026-07-22) and this function combined the
 * toggle with the entitlement. That reversed on 2026-08-23: a theme is not a
 * feature anybody subscribes for, and gating it meant the app shipped one
 * palette to most people while the other one was finished and sitting there.
 * The choice is now offered on the way in, before there is an account to
 * charge — see the theme step after "Let's begin".
 *
 * Kept as a function rather than reading the flag inline so there is still one
 * place that decides, and so the read cannot drift screen by screen.
 */
export function resolveThemeName(preferences: ThemePreferences): ThemeName {
  return preferences.darkThemeEnabled ? 'dark' : 'light';
}
