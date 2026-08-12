import { AppLanguage } from '../types/models';

/**
 * The language the app opens in before anybody has chosen one.
 *
 * It was 'en', hard-coded, in a Finnish-first app — so a phone set to Finnish
 * launched into English and the reader's first act was to fix the app's mind
 * about where it was. That is the "content default nobody overrides" bug this
 * codebase keeps finding: a default that is a CHOICE about meaning, not a
 * structural fallback.
 *
 * This only decides the FIRST run. The moment a language is stored — from the
 * welcome screen's toggle or from Settings — the stored value wins, because
 * `normalizeDatabase` prefers it and only falls back to this.
 *
 * No new dependency: expo-localization would need a prebuild, and the platform
 * already tells us. Only the RULE lives here, so it can be tested without a
 * device — reading the tag needs react-native and lives in storage/deviceLocale.
 */

/**
 * Which of the app's two languages a BCP-47 / POSIX locale tag asks for.
 *
 * Matches the language subtag only. "fi-FI", "fi_FI", "fi" and a bare "FI" are
 * all Finnish; everything else — including Swedish, which is a Finnish
 * official language but not one this app speaks — falls to English rather than
 * guessing at a third.
 */
export function resolveLanguageFromLocale(tag: string | null | undefined): AppLanguage {
  if (typeof tag !== 'string') {
    return 'en';
  }
  // Split on both separators: Android reports fi_FI, the web and iOS fi-FI.
  const primary = tag.trim().toLowerCase().split(/[-_.@]/)[0];
  return primary === 'fi' ? 'fi' : 'en';
}
