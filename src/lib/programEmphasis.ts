import { resolveCatalogBodyPart } from './catalogExercisePools';
import { I18nKey } from './i18n';

/**
 * "Mihin viikko menee" (design: GAINER Hourglass Shape) — the programme's
 * weekly sets grouped into four body areas, as a share of the whole.
 *
 * Computed from the sessions the programme actually prescribes, never written
 * per programme by hand: a distribution card that could disagree with the
 * exercise list below it would be the seed-data lie again, one card up.
 */

export type EmphasisArea = 'glutesLegs' | 'shouldersBack' | 'chestArms' | 'core' | 'other';

export const EMPHASIS_AREA_KEYS: Record<EmphasisArea, I18nKey> = {
  glutesLegs: 'detail.emphasis.glutesLegs',
  shouldersBack: 'detail.emphasis.shouldersBack',
  chestArms: 'detail.emphasis.chestArms',
  core: 'detail.emphasis.core',
  other: 'detail.emphasis.other',
};

const AREA_BY_BODY_PART: Record<string, EmphasisArea> = {
  glutes: 'glutesLegs',
  legs: 'glutesLegs',
  shoulders: 'shouldersBack',
  back: 'shouldersBack',
  chest: 'chestArms',
  biceps: 'chestArms',
  triceps: 'chestArms',
  core: 'core',
  'full body': 'other',
};

/**
 * Name fallback for lifts the catalog pools do not know. Deliberately short:
 * it exists so a squat pattern with an unusual name lands in the right area,
 * not to classify the whole library — anything it cannot place goes to
 * `other`, which the card shows honestly instead of hiding.
 */
const NAME_HINTS: Array<[RegExp, EmphasisArea]> = [
  [/squat|lunge|deadlift|hip thrust|glute|hamstring|calf|leg |step-up|kyykky|maastaveto|lantionnosto|pakara|askel|pohje|reisi/i, 'glutesLegs'],
  [/row|pull|lat |shoulder|press.*overhead|overhead.*press|lateral raise|face pull|shrug|soutu|veto|ylätalja|pystypunnerrus|sivunosto|olkapä|kohautus/i, 'shouldersBack'],
  [/bench|push-?up|chest|dip|curl|extension|tricep|bicep|fly|penkki|punnerrus|rinta|hauis|ojentaja|dippi/i, 'chestArms'],
  [/plank|crunch|sit-?up|ab |core|dead bug|twist|lankku|rutistus|vatsa|keskivartalo|kierto/i, 'core'],
];

export interface EmphasisSlice {
  area: EmphasisArea;
  sets: number;
  /** Whole percentages summing to exactly 100 (largest remainder). */
  percent: number;
}

export interface ProgramEmphasis {
  totalSets: number;
  /** Areas with at least one set, largest first. */
  slices: EmphasisSlice[];
}

function areaForExercise(name: string): EmphasisArea {
  const bodyPart = resolveCatalogBodyPart(name);
  if (bodyPart && AREA_BY_BODY_PART[bodyPart]) {
    return AREA_BY_BODY_PART[bodyPart];
  }
  for (const [pattern, area] of NAME_HINTS) {
    if (pattern.test(name)) {
      return area;
    }
  }
  return 'other';
}

export function resolveProgramEmphasis(
  sessions: ReadonlyArray<{ exercises: ReadonlyArray<{ name: string; sets: number }> }>,
): ProgramEmphasis | null {
  const setsByArea = new Map<EmphasisArea, number>();
  let totalSets = 0;

  for (const session of sessions) {
    for (const exercise of session.exercises) {
      const sets = Math.max(0, exercise.sets);
      if (sets === 0) {
        continue;
      }
      const area = areaForExercise(exercise.name);
      setsByArea.set(area, (setsByArea.get(area) ?? 0) + sets);
      totalSets += sets;
    }
  }

  if (totalSets === 0) {
    return null;
  }

  const raw = [...setsByArea.entries()]
    .map(([area, sets]) => ({ area, sets, exact: (sets / totalSets) * 100 }))
    .sort((left, right) => right.sets - left.sets);

  // Largest remainder, so the legend's whole numbers sum to exactly 100 —
  // "57 + 33 + 5 + 5" and never 99 or 101.
  const floors = raw.map((slice) => Math.floor(slice.exact));
  let remainder = 100 - floors.reduce((sum, value) => sum + value, 0);
  const order = raw
    .map((slice, index) => ({ index, frac: slice.exact - floors[index] }))
    .sort((left, right) => right.frac - left.frac);
  for (const { index } of order) {
    if (remainder <= 0) {
      break;
    }
    floors[index] += 1;
    remainder -= 1;
  }

  return {
    totalSets,
    slices: raw.map((slice, index) => ({ area: slice.area, sets: slice.sets, percent: floors[index] })),
  };
}
