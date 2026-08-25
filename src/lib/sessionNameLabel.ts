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
  // Names the decomposition only half-translated: it renders "&" and the
  // parenthetical separately, so "Morning Mobility (Full Body)" came back as
  // "Morning Mobility (Koko keho)" — a checker that only looks for names
  // returned UNCHANGED never sees those.
  'core & mobility for runners': 'Keskivartalo ja liikkuvuus juoksijalle',
  'lower volume + engine': 'Alavartalon volyymi + kestävyys',
  'full body & balance': 'Koko keho ja tasapaino',
  'glutes & hamstrings': 'Pakarat ja takareidet',
  'hiit cardio & core': 'HIIT-kestävyys ja keskivartalo',
  'lower body (supported)': 'Alavartalo (tuettuna)',
  'mobility & pelvic floor': 'Liikkuvuus ja lantionpohja',
  'morning mobility (full body)': 'Aamuliikkuvuus (koko keho)',
  'press & hypertrophy pump': 'Pystypunnerrus ja kasvupumppi',
  'pull & conditioning': 'Veto ja kunto',
  'shoulders & back (width)': 'Olkapäät ja selkä (leveys)',
  'skills & core': 'Taidot ja keskivartalo',
  'upper body (supported)': 'Ylävartalo (tuettuna)',

  // ── Whole session names from the Vinha programs ──────────────────────
  // Written out rather than decomposed: "Pull A: Width Focus" and "Push:
  // Handstand & Planche Progressions" are sentences, not two nouns, and
  // word-by-word translation turns them into something a reader has to
  // decode. A whole-phrase hit wins over decomposition.
  // The two season programmes. Whole phrases: "Push and Easy Run" is what the
  // session IS, and decomposing it gives two nouns joined by a conjunction the
  // dictionary would have to guess at.
  'push and easy run': 'Työntö ja kevyt juoksu',
  'strength and tempo run': 'Voima ja vauhtijuoksu',
  'legs and strides': 'Jalat ja vedot',
  'lower, heavy': 'Alavartalo, raskas',
  'upper, press': 'Ylävartalo, työntö',
  'lower, volume': 'Alavartalo, volyymi',
  'upper, pull': 'Ylävartalo, veto',
  'athletic upper': 'Urheilullinen ylävartalo',
  'bench day': 'Penkkipäivä',
  'core reconnection': 'Keskivartalon herättely',
  'deadlift day': 'Maastavetopäivä',
  'deep recovery stretch': 'Syvä palautusvenyttely',
  'endurance & conditioning': 'Kestävyys ja kunto',
  'explosive lower': 'Räjähtävä alavartalo',
  'full body burn': 'Koko kehon poltto',
  'gentle full body': 'Kevyt koko keho',
  'gentle strength': 'Kevyt voima',
  'glute activation': 'Pakaroiden herättely',
  'glute finisher': 'Pakaralopetus',
  'glute hypertrophy': 'Pakaroiden kasvatus',
  'glute volume (pump)': 'Pakaravolyymi (pumppi)',
  'heavy glutes (strength)': 'Raskaat pakarat (voima)',
  'hip opening flow': 'Lonkkien avaus',
  'legs a: quad focus': 'Jalat A: etureidet',
  'legs b: posterior focus': 'Jalat B: takaketju',
  'legs: pistol squats & plyo': 'Jalat: pistolikyykyt ja hypyt',
  'low-impact cardio & stability': 'Kevyt kestävyys ja tasapaino',
  'lower body bodyweight': 'Alavartalo kehonpainolla',
  'lower body hiit': 'Alavartalon HIIT',
  'lower body strength': 'Alavartalon voima',
  'posterior chain & power': 'Takaketju ja teho',
  'pull a: width focus': 'Veto A: leveys',
  'pull b: thickness focus': 'Veto B: paksuus',
  'pull day': 'Vetopäivä',
  'pull: muscle-up & front lever': 'Veto: muscle-up ja front lever',
  'push a: chest focus': 'Työntö A: rinta',
  'push b: shoulder focus': 'Työntö B: olkapäät',
  'push: handstand & planche progressions': 'Työntö: käsinseisonta ja planche',
  'quads & cardio': 'Etureidet ja kestävyys',
  'quads & hamstrings': 'Etureidet ja takareidet',
  'shoulder mobility': 'Olkapäiden liikkuvuus',
  'single-leg stability': 'Yhden jalan tasapaino',
  'speed & agility': 'Nopeus ja ketteryys',
  'spinal flexibility': 'Selkärangan liikkuvuus',
  'squat day': 'Kyykkypäivä',
  'strength circuit': 'Voimakierros',
  'strength rebuild': 'Voiman palautus',
  'tabata finisher': 'Tabata-lopetus',
  'total body hiit': 'Koko kehon HIIT',
  'upper body bodyweight': 'Ylävartalo kehonpainolla',
  'upper body hiit': 'Ylävartalon HIIT',
  'upper body sculpt': 'Ylävartalon muotoilu',
  'upper body strength': 'Ylävartalon voima',
  'upper body toning': 'Ylävartalon kiinteytys',
  'upper pull + hiit': 'Ylävartalon veto + HIIT',
  'upper push + hiit': 'Ylävartalon työntö + HIIT',
  'workout a': 'Treeni A',
  'workout b': 'Treeni B',

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
  // The block below is what the template editor's split presets write: they
  // are stored as session names, so they arrive here rather than through a
  // translation key. Decomposition cannot reach them — "Upper Heavy" has no
  // separator and no parentheses, so it fell through as written.
  'upper heavy': 'Ylävartalo raskas',
  'lower heavy': 'Alavartalo raskas',
  'upper pump': 'Ylävartalo pumppi',
  'lower pump': 'Alavartalo pumppi',
  'upper strength': 'Ylävartalon voima',
  'lower strength': 'Alavartalon voima',
  'push volume': 'Työntövolyymi',
  'pull volume': 'Vetovolyymi',
  'legs volume': 'Jalkavolyymi',
  'full body a': 'Koko keho A',
  'full body b': 'Koko keho B',
  'full body c': 'Koko keho C',
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
  pump: 'pumppi',
  strength: 'voima',
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

  // Keep the separator the catalog used — "&", "+" and "/" mean different
  // things, and "/" was missing: the editor's body-part presets are all
  // "Chest / Triceps", "Legs / Glutes", so every one of them survived
  // untranslated even though both halves were in the dictionary.
  const translatedHead = head
    .split(/(\s*[&+/]\s*)/)
    .map((part) => (/^\s*[&+]\s*$/.test(part) ? part : translateWord(part, dictionary)))
    .join('');

  if (!qualifier) {
    return translatedHead;
  }
  return `${translatedHead} (${translateWord(qualifier, dictionary)})`;
}

/**
 * The session's focus alone: "HOME Starter - Day 1: Full Body" → "Koko keho".
 *
 * For rows that already say which day this is. The card on Home carries a
 * weekday badge, so "Päivä 1:" says it a second time — and the repetition is
 * not free: it took the width the real name then truncated for, leaving
 * "Päivä 1: Koko keho + H…" (user, 2026-08-25). The programme name sits above
 * the list, so the brand in front goes with it.
 *
 * A session with no focus at all — "Day 3", the editor's placeholder — keeps
 * its ordinal, because removing the focus would leave nothing to show.
 */
export function localizeSessionFocus(name: string, language: AppLanguage = 'en'): string {
  const raw = name.trim();
  const dayMatch = raw.match(/^(.*?)\bDay\s+(\d+)\s*:\s*(.*)$/i);
  if (!dayMatch) {
    return localizeSessionName(raw, language);
  }
  const focus = dayMatch[3].trim();
  if (!focus) {
    // "Day 3:" with nothing after it — the ordinal is all there is, and
    // handing it back through the full localizer keeps the dangling colon.
    return language === 'fi' ? `Päivä ${dayMatch[2]}` : `Day ${dayMatch[2]}`;
  }
  return localizeWorkoutFocus(focus, language);
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

  // A session created and never renamed is just "Day 3" — no colon, no focus.
  // The pattern below requires the colon, so the placeholder name the editor
  // writes was the one session name that stayed English everywhere.
  const bareDay = raw.match(/^Day\s+(\d+)$/i);
  if (bareDay) {
    return language === 'fi' ? `Päivä ${bareDay[1]}` : raw;
  }

  const dayMatch = raw.match(/^(.*?)\bDay\s+(\d+)\s*:\s*(.*)$/i);
  if (!dayMatch) {
    return localizeWorkoutFocus(raw, language);
  }

  const [, prefix, dayNumber, focus] = dayMatch;
  const dayLabel = language === 'fi' ? `Päivä ${dayNumber}` : `Day ${dayNumber}`;
  return `${prefix}${dayLabel}: ${localizeWorkoutFocus(focus, language)}`;
}
