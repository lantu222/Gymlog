import { I18nKey, t } from './i18n';
import type { AppLanguage } from '../types/models';

/**
 * Body parts, equipment and categories, in the reader's language.
 *
 * These strings arrive from the generated library as lowercase English keys
 * and used to be title-cased on the way to the screen — so every filter chip
 * and card subtitle read "Back", "Chest", "Bodyweight" no matter the app's
 * language. There are only eighteen of them.
 *
 * This lives in lib/ rather than beside one screen because more than one
 * surface renders them now: the library browser, and the records list. Two
 * copies of the map is two places for a body part to stay English.
 */
const LIBRARY_LABEL_KEYS: Record<string, I18nKey> = {
  all: 'lib.bodyPart.all',
  back: 'lib.bodyPart.back',
  biceps: 'lib.bodyPart.biceps',
  chest: 'lib.bodyPart.chest',
  core: 'lib.bodyPart.core',
  'full body': 'lib.bodyPart.fullBody',
  glutes: 'lib.bodyPart.glutes',
  legs: 'lib.bodyPart.legs',
  shoulders: 'lib.bodyPart.shoulders',
  triceps: 'lib.bodyPart.triceps',
  barbell: 'lib.equipment.barbell',
  bodyweight: 'lib.equipment.bodyweight',
  cable: 'lib.equipment.cable',
  dumbbell: 'lib.equipment.dumbbell',
  machine: 'lib.equipment.machine',
  cardio: 'lib.category.cardio',
  compound: 'lib.category.compound',
  isolation: 'lib.category.isolation',
};

export function libraryLabel(raw: string, language: AppLanguage = 'en'): string {
  const key = LIBRARY_LABEL_KEYS[raw.trim().toLowerCase()];
  if (key) {
    return t(language, key);
  }
  // Anything the data adds later reads as itself rather than as nothing.
  return raw
    .split(/[_\s/()-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
