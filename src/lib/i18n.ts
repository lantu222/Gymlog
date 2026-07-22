import { AppLanguage } from '../types/models';

/**
 * App copy dictionaries. English is the source of truth; every key must exist
 * in `en`, and `t` falls back to it so a missing translation can never render
 * an empty string. Coverage grows surface by surface — Welcome first, since
 * that is where the language choice lives.
 */
const EN = {
  'welcome.tagline': 'You go to the gym.\nWe handle the rest.',
  'welcome.feature.plans.title': 'AI-built plans',
  'welcome.feature.plans.body': 'Smart programs built for you.',
  'welcome.feature.adaptive.title': 'Adaptive',
  'welcome.feature.adaptive.body': 'We adjust as you improve.',
  'welcome.feature.recovery.title': 'Recovery aware',
  'welcome.feature.recovery.body': 'Optimized training & rest.',
  'welcome.continueGoogle': 'Continue with Google',
  'welcome.continueApple': 'Continue with Apple',
  'welcome.or': 'or',
  'welcome.signUpEmail': 'Sign up with email',
  'welcome.haveAccount': 'I already have an account',
} as const;

export type I18nKey = keyof typeof EN;

const FI: Record<I18nKey, string> = {
  'welcome.tagline': 'Sinä käyt salilla.\nMe hoidamme loput.',
  'welcome.feature.plans.title': 'Tekoälyn ohjelmat',
  'welcome.feature.plans.body': 'Fiksut ohjelmat juuri sinulle.',
  'welcome.feature.adaptive.title': 'Mukautuva',
  'welcome.feature.adaptive.body': 'Säädämme kun kehityt.',
  'welcome.feature.recovery.title': 'Palautuminen',
  'welcome.feature.recovery.body': 'Optimoitu treeni ja lepo.',
  'welcome.continueGoogle': 'Jatka Googlella',
  'welcome.continueApple': 'Jatka Applella',
  'welcome.or': 'tai',
  'welcome.signUpEmail': 'Luo tili sähköpostilla',
  'welcome.haveAccount': 'Minulla on jo tili',
};

const STRINGS: Record<AppLanguage, Record<I18nKey, string>> = {
  en: EN,
  fi: FI,
};

export function t(language: AppLanguage, key: I18nKey): string {
  return STRINGS[language]?.[key] ?? EN[key];
}

export const SUPPORTED_LANGUAGES: Array<{ key: AppLanguage; label: string; flag: string }> = [
  { key: 'fi', label: 'FIN', flag: '🇫🇮' },
  { key: 'en', label: 'ENG', flag: '🇬🇧' },
];
