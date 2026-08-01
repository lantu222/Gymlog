import { AppPreferences } from '../types/models';
import { isProUnlocked } from './proEntitlement';

export type ThemeName = 'light' | 'dark';

type ThemePreferences = Pick<
  AppPreferences,
  'darkThemeEnabled' | 'promoProUntil' | 'adaptiveCoachPremiumUnlocked'
>;

/**
 * Which theme the app should serve.
 *
 * Dark is a Pro perk (user decision 2026-07-22), so the toggle alone is not
 * enough — the same shape as `resolveProgressionOptions`, and for the same
 * reason: one place combines the user's choice with the entitlement, so no
 * screen can hand a free user a paid theme or a Pro user a dead switch.
 *
 * The stored preference is kept as the user set it. Losing Pro turns the app
 * light again but does not silently rewrite their choice, so it comes back if
 * they resubscribe.
 */
export function resolveThemeName(
  preferences: ThemePreferences,
  now: Date = new Date(),
): ThemeName {
  return preferences.darkThemeEnabled && isProUnlocked(preferences, now) ? 'dark' : 'light';
}

/**
 * What the Settings row should show. The row has three honest states and this
 * is the only place that decides between them, so the copy cannot drift from
 * what the engine actually does.
 */
export function resolveThemeRowState(
  preferences: ThemePreferences,
  now: Date = new Date(),
): { locked: boolean; value: boolean } {
  const unlocked = isProUnlocked(preferences, now);
  return { locked: !unlocked, value: preferences.darkThemeEnabled && unlocked };
}
