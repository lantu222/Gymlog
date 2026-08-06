import { EQUIPMENT_RULES_FOR_DISPLAY } from './equipmentExerciseFilter';
import { I18nKey } from './i18n';

/**
 * What a program actually needs, as chips.
 *
 * The catalog stores one sentence per program — "Vaatii täyden salin: tangot,
 * käsipainot, ylätalja…" — which is prose a reader has to parse and which
 * nothing can check against their own gym. The equipment is already derivable:
 * `equipmentExerciseFilter` matches exercise names to required gear in order to
 * SWAP exercises the reader cannot do, and the same table answers "what does
 * this program need" if you read it forwards instead of backwards.
 *
 * The chip names are the ones onboarding already stores, so the two lists can
 * be compared directly rather than through a mapping that would drift.
 */

/** Canonical chips, in the order a gym is usually described. */
const CHIP_ORDER = [
  'Barbells',
  'Barbell & plates',
  'Squat rack',
  'Bench',
  'Dumbbells',
  'Kettlebells',
  'Machines',
  'Cables',
  'Pull-up bar',
  'Resistance bands',
  'Cardio machines',
  'Yoga mat',
] as const;

export type EquipmentChip = (typeof CHIP_ORDER)[number];

export const EQUIPMENT_CHIP_KEYS: Record<string, I18nKey> = {
  Barbells: 'equip.barbell',
  'Barbell & plates': 'equip.barbellPlates',
  'Squat rack': 'equip.rack',
  Bench: 'equip.bench',
  Dumbbells: 'equip.dumbbells',
  Kettlebells: 'equip.kettlebells',
  Machines: 'equip.machines',
  Cables: 'equip.cables',
  'Pull-up bar': 'equip.pullupBar',
  'Resistance bands': 'equip.bands',
  'Cardio machines': 'equip.cardio',
  'Yoga mat': 'equip.mat',
};

/**
 * The gear a list of exercises requires, deduplicated and ordered.
 *
 * Each rule states its requirement as alternatives — a bench press needs a
 * barbell OR barbell-and-plates — and the FIRST alternative is taken as the
 * chip to show. Listing every alternative would turn a six-chip program into
 * fifteen chips that mostly mean the same thing.
 */
export function resolveProgramEquipment(exerciseNames: readonly string[]): EquipmentChip[] {
  const needed = new Set<string>();

  for (const name of exerciseNames) {
    const normalized = name.trim().toLowerCase();
    // "Hip Thrust (Bodyweight)" matched the hip-thrust rule and claimed a
    // bench, so a postpartum program that needs a floor was listed as needing
    // gym furniture. When the name says bodyweight, it means it.
    if (normalized.includes('bodyweight')) {
      continue;
    }
    for (const rule of EQUIPMENT_RULES_FOR_DISPLAY) {
      if (!normalized.includes(rule.pattern)) {
        continue;
      }
      for (const group of rule.requires) {
        if (group.length > 0) {
          needed.add(group[0]);
        }
      }
    }
  }

  return CHIP_ORDER.filter((chip) => needed.has(chip));
}

/**
 * Chips the program needs that the reader's gym does not have.
 *
 * `available === null` means the setup never said, and an unknown gym cannot
 * be missing anything — the screen shows the chips without a verdict rather
 * than claiming everything fits.
 */
export function missingEquipment(
  needed: readonly EquipmentChip[],
  available: readonly string[] | null,
): EquipmentChip[] {
  if (available === null) {
    return [];
  }
  const have = new Set(available);
  // A barbell rack counts as a barbell: the two chips describe the same corner
  // of a gym, and demanding both would report a missing item nobody is missing.
  const satisfied = (chip: EquipmentChip) =>
    have.has(chip) ||
    (chip === 'Barbells' && have.has('Barbell & plates')) ||
    (chip === 'Barbell & plates' && have.has('Barbells'));
  return needed.filter((chip) => !satisfied(chip));
}
