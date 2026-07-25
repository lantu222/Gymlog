/**
 * Session names live in the program catalogs as English data — "HOME Starter -
 * Day 1: Full Body". Program family names are brand (STRONG, HOME, SHRED…) and
 * stay put, but the structural parts around them read as untranslated UI to a
 * Finnish user: "Day 1", "Upper (Heavy)", "Chest & Triceps".
 *
 * These helpers translate the structure only, and compositionally: the focus is
 * split on the separators the catalogs actually use (`&`, `+`, a trailing
 * qualifier in parentheses) and each part is looked up on its own. Anything the
 * dictionary doesn't know is passed through untouched, so a new catalog entry
 * degrades to English rather than breaking.
 */
import { AppLanguage } from '../types/models';

/** Focus words used across workoutCatalog + gainerProgramCatalog. */
const FOCUS_FI: Record<string, string> = {
  'full body': 'Koko keho',
  'upper body': 'Ylävartalo',
  'lower body': 'Alavartalo',
  upper: 'Ylävartalo',
  lower: 'Alavartalo',
  push: 'Työntö',
  pull: 'Veto',
  chest: 'Rinta',
  back: 'Selkä',
  legs: 'Jalat',
  glutes: 'Pakarat',
  shoulders: 'Olkapäät',
  arms: 'Kädet',
  abs: 'Vatsa',
  core: 'Keskivartalo',
  biceps: 'Hauikset',
  triceps: 'Ojentajat',
  'weak points': 'Heikot kohdat',
  squat: 'Kyykky',
  bench: 'Penkki',
  deadlift: 'Maastaveto',
  press: 'Pystypunnerrus',
  row: 'Soutu',
  hinge: 'Saranaliike',
  circuit: 'Kiertoharjoittelu',
  intervals: 'Intervallit',
  engine: 'Kestävyys',
  reset: 'Palautus',
  recovery: 'Palautuminen',
  mobility: 'Liikkuvuus',
  'mobility flow': 'Liikkuvuusvirta',
  'yoga flow': 'Joogavirta',
  'easy run': 'Kevyt juoksu',
  'tempo run': 'Tempojuoksu',
  // Two-word focuses with no separator to split on.
  'upper power': 'Ylävartalon teho',
  'lower power': 'Alavartalon teho',
  'upper volume': 'Ylävartalon volyymi',
  'full body circuit': 'Koko kehon kierto',
  // Qualifiers, which arrive in parentheses.
  heavy: 'raskas',
  volume: 'volyymi',
  growth: 'kasvu',
  pressure: 'kova',
  tempo: 'tempo',
};

const DICTIONARIES: Partial<Record<AppLanguage, Record<string, string>>> = { fi: FOCUS_FI };

function translateWord(word: string, dictionary: Record<string, string>): string {
  return dictionary[word.trim().toLowerCase()] ?? word.trim();
}

/**
 * "Upper (Heavy)" → "Ylävartalo (raskas)", "Chest & Triceps" → "Rinta &
 * ojentajat". Unknown words survive as they were written.
 */
export function localizeWorkoutFocus(focus: string, language: AppLanguage = 'en'): string {
  const dictionary = DICTIONARIES[language];
  const raw = focus.trim();
  if (!dictionary || !raw) {
    return raw;
  }

  // A whole-phrase hit wins over decomposition ("Full Body Circuit").
  const whole = dictionary[raw.toLowerCase()];
  if (whole) {
    return whole;
  }

  const qualifierMatch = raw.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  const head = qualifierMatch ? qualifierMatch[1] : raw;
  const qualifier = qualifierMatch ? qualifierMatch[2] : null;

  // Keep the separator the catalog used — "&" and "+" mean different things.
  const translatedHead = head
    .split(/(\s*[&+]\s*)/)
    .map((part) => (/^\s*[&+]\s*$/.test(part) ? part : translateWord(part, dictionary)))
    .join('');

  if (!qualifier) {
    return translatedHead;
  }
  return `${translatedHead} (${translateWord(qualifier, dictionary)})`;
}

/**
 * "HOME Starter - Day 1: Full Body" → "HOME Starter - Päivä 1: Koko keho".
 * The plan name in front is a brand and is never touched.
 */
export function localizeSessionName(name: string, language: AppLanguage = 'en'): string {
  const raw = name.trim();
  if (language === 'en' || !raw) {
    return raw;
  }

  const dayMatch = raw.match(/^(.*?)\bDay\s+(\d+)\s*:\s*(.*)$/i);
  if (!dayMatch) {
    return localizeWorkoutFocus(raw, language);
  }

  const [, prefix, dayNumber, focus] = dayMatch;
  const dayLabel = language === 'fi' ? `Päivä ${dayNumber}` : `Day ${dayNumber}`;
  return `${prefix}${dayLabel}: ${localizeWorkoutFocus(focus, language)}`;
}
