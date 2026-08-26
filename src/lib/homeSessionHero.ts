/**
 * Pure helpers for the Home v4 session hero (design_handoff_home_v4).
 * Focus title, body-focus label, week phase, equipment line, default
 * warmup/cooldown blocks, and the Adapt-sheet trim estimate.
 */
import { resolveCatalogBodyPart, resolveCatalogSourceCategory } from './catalogExercisePools';
import { estimateRoutineBlockSeconds } from './guidedPlayer';
import { t } from './i18n';
import { AppLanguage } from '../types/models';

export interface SessionDrill {
  name: string;
  schemeLabel: string;
}

export interface SessionRoutineBlock {
  drills: SessionDrill[];
  minutes: number;
}

/**
 * "Day 2: Back & Biceps" -> "Back & Biceps", "Push A: Chest Focus" -> "Push",
 * "Strength A" -> "Strength".
 * Falls back to the plan title's focus word when the session has no name.
 */
export function getSessionFocusTitle(sessionTitle?: string | null, planTitle?: string | null): string {
  const base = sessionTitle?.trim() || planTitle?.trim() || 'Workout';
  const [head, ...rest] = base.split(':');
  const afterColon = rest.join(':').trim();
  const beforeColon = head.trim();
  // Both spellings of the ordinal. A duplicated or composed custom programme
  // SAVES its session names in Finnish by design (customProgramDuplication),
  // so "Päivä 4: Ylävartalo + HIIT" arrives here — and an English-only test
  // let it fall through to the suffix strip below, which removed the "4" and
  // put the bare word "Päivä" on the Home hero (user 2026-08-26). Same shape
  // as the truncation saga: an assembly helper that only knew English.
  if (/^(?:day|päivä)\s*\d+$/i.test(beforeColon)) {
    // The focus when there is one; otherwise the ordinal itself, which is all
    // the session has to show — and is still better than half of it.
    return afterColon || beforeColon;
  }
  const stripped = beforeColon.replace(/\s+(?:[A-Ca-c]|\d+)$/, '').trim();
  return stripped || beforeColon || 'Workout';
}

/** 'full_body' -> 'Full body', 'push_pull_legs' -> 'Push / pull / legs'. */
export function getSessionBodyFocusLabel(splitType?: string | null): string {
  if (!splitType) {
    return 'Full body';
  }
  const parts = splitType.split('_').filter(Boolean);
  if (!parts.length) {
    return 'Full body';
  }
  if (parts.join(' ') === 'full body') {
    return 'Full body';
  }
  const label = parts.join(' / ');
  return label[0].toUpperCase() + label.slice(1);
}

/** Early third of the plan is "building", middle "progressing", final "peaking". */
export function getPlanWeekPhase(currentWeek: number, totalWeeks: number): string {
  const safeTotal = Math.max(1, totalWeeks);
  const week = Math.min(Math.max(1, currentWeek), safeTotal);
  const ratio = week / safeTotal;
  if (ratio <= 1 / 3) {
    return 'building';
  }
  if (ratio <= 2 / 3) {
    return 'progressing';
  }
  return 'peaking';
}

const EQUIPMENT_LABELS: Record<string, string> = {
  barbell: 'Barbell',
  dumbbell: 'Dumbbells',
  machine: 'Machines',
  cable: 'Cables',
};

/**
 * Infers equipment from an exercise name when the library has no exact match
 * (plan names like "Back Squat" vs library names like "Barbell Squat").
 * Explicit equipment words win; classic barbell lifts and bodyweight moves
 * are recognized by pattern; anything else stays unknown (null).
 */
export function inferEquipmentFromExerciseName(name: string): string | null {
  const normalized = name.trim().toLowerCase();
  if (/\bdumbbell\b|\bdb\b/.test(normalized)) {
    return 'dumbbell';
  }
  if (/\bcable\b|pulldown|pushdown|face pull/.test(normalized)) {
    return 'cable';
  }
  if (/\bmachine\b|leg press|leg extension|leg curl|pec deck|\bsmith\b/.test(normalized)) {
    return 'machine';
  }
  if (/\bbarbell\b|back squat|front squat|bench press|deadlift|overhead press|military press|power clean|hip thrust/.test(normalized)) {
    return 'barbell';
  }
  if (/\bplank\b|push-?up|pull-?up|chin-?up|\bdip\b|crunch|sit-?up|bodyweight|air squat|\bhang\b/.test(normalized)) {
    return 'bodyweight';
  }
  return null;
}

/**
 * Builds the bold equipment list ("Barbell, Dumbbells & Cables") from the
 * session's exercises via the exercise library, falling back to name-based
 * inference for names the library doesn't know verbatim. Returns null when
 * the session is bodyweight-only (or nothing resolves) so the row can hide.
 */
export function buildSessionEquipmentLabel(
  exerciseNames: string[],
  library: Array<{ name: string; equipment: string }>,
): string | null {
  const equipmentByName = new Map(library.map((item) => [item.name.trim().toLowerCase(), item.equipment]));
  const found: string[] = [];
  for (const name of exerciseNames) {
    const equipment = equipmentByName.get(name.trim().toLowerCase()) ?? inferEquipmentFromExerciseName(name);
    if (equipment && equipment !== 'bodyweight' && !found.includes(equipment)) {
      found.push(equipment);
    }
  }
  if (!found.length) {
    return null;
  }
  const labels = found.map((equipment) => EQUIPMENT_LABELS[equipment] ?? equipment);
  if (labels.length === 1) {
    return labels[0];
  }
  return `${labels.slice(0, -1).join(', ')} & ${labels[labels.length - 1]}`;
}

export type SessionFocusKind = 'lower' | 'push' | 'pull' | 'upper' | 'general';

/**
 * Catalog body part → the movement pattern whose prep and stretches it wants.
 * `core` and `full body` are deliberately absent: they appear on every kind of
 * day, so counting them would only blur the majority.
 */
const PATTERN_BY_BODY_PART: Record<string, 'push' | 'pull' | 'lower'> = {
  chest: 'push',
  shoulders: 'push',
  triceps: 'push',
  back: 'pull',
  biceps: 'pull',
  legs: 'lower',
  glutes: 'lower',
};

/**
 * Movement pattern from the exercise name, for the names the library cannot
 * match. Two thirds of the ready catalogs' exercise names miss the library —
 * "Chest-Supported Row" appears 24 times and resolves to nothing — and without
 * this the classifier is blind on exactly the sessions it most needs to read.
 *
 * Matches on the MOVEMENT word, not the muscle: "Chest-Supported Row" is a row.
 * Lower goes first so "Cable Pull-Through" lands as a hinge, not as a pull.
 * Anything unmatched returns null and gets no vote — core, mobility flows and
 * conditioning appear on every kind of day, so a guess there would only blur
 * the majority. Same approach, and same reason, as
 * `inferEquipmentFromExerciseName` above.
 */
function inferPatternFromExerciseName(name: string): 'push' | 'pull' | 'lower' | null {
  const normalized = name.trim().toLowerCase();
  // Same abstention the library category gives, for names it cannot place:
  // "Lying Quad Stretch" and "Standing Forward Fold" are not quad and hinge
  // training, and counting them made a stretching session read as a leg day.
  if (/stretch|\bpose\b|mobility|\bflow\b|breath|\bfold\b|salutation|circles/.test(normalized)) {
    return null;
  }
  if (
    // "kickback" is qualified: a glute kickback is lower, a triceps kickback
    // is not. "sled" beats the push regex below for the same reason.
    /squat|lunge|deadlift|hip thrust|glute|bridge|calf|hamstring|quad|step-?up|leg press|leg curl|leg extension|leg raise|good morning|pull-through|glute kickback|nordic|box jump|skater|high knees|sprint|\bsled\b/.test(
      normalized,
    )
  ) {
    return 'lower';
  }
  if (/\brow\b|rows|pulldown|pull-?up|chin-?up|curl|\blat\b|lats|face pull|shrug|rear delt|pullover|reverse pec/.test(normalized)) {
    return 'pull';
  }
  if (/press|push|\bdip\b|dips|\bfly\b|flyes|lateral raise|front raise|overhead|tricep|pushdown|skullcrusher|thruster/.test(normalized)) {
    return 'push';
  }
  return null;
}

/** A pattern owns the session at 70%; below that the day is genuinely mixed. */
const MAJORITY = 0.7;

/**
 * What the session actually trains, read from its exercises.
 *
 * This used to be read from the session's title against English keywords
 * ("squat|leg|lower|glute"). The title is display text: the moment the app
 * spoke Finnish — and the moment a user's own program stored "Pakarat &
 * Jalat" as its name — every session fell through to `general` and got the
 * same warmup and the same stretches no matter what it trained. Nothing threw,
 * because `general` is a valid answer.
 *
 * Exercise names are the stable id in this codebase (see exerciseNameLabel:
 * stored, matched and filtered as English, translated only for display), so
 * counting body parts is the one signal a rename or a translation cannot
 * silently break.
 *
 * Pass the WHOLE session. A truncated list is a different session, and this
 * will happily classify it as one.
 */
export function classifySessionFocus(exerciseNames: string[]): SessionFocusKind {
  const counts = { push: 0, pull: 0, lower: 0 };
  for (const name of exerciseNames) {
    const inferred = inferPatternFromExerciseName(name);

    // A stretch is not the stimulus, so it does not get a vote. Its body part
    // is real — "Kneeling Hip Flexor" is legs — and counting it turned a
    // mobility day into a leg day that opened with empty-bar squats.
    //
    // The name has a veto, because the library's category is not always right:
    // it files "Split Squats" and "Crossover Reverse Lunge" as stretching, and
    // those are what "Bulgarian Split Squat" and "Curtsy Lunge" resolve to. A
    // category alone would have silently excluded 18 leg prescriptions.
    if (!inferred && resolveCatalogSourceCategory(name) === 'stretching') {
      continue;
    }

    // The name wins where the two disagree, because the library's body part
    // answers a different question: it files "Deadlift" under back and
    // "Curtsy Lunge" under back, which are true of the muscles worked and
    // wrong about which day it is. Across the catalog they disagree 11 times
    // and the name is right in 8; the three the library won are handled by
    // the qualifiers above rather than by ranking.
    const bodyPart = resolveCatalogBodyPart(name);
    const pattern = inferred ?? (bodyPart ? PATTERN_BY_BODY_PART[bodyPart] : undefined);
    if (pattern) {
      counts[pattern] += 1;
    }
  }

  const total = counts.push + counts.pull + counts.lower;
  if (total === 0) {
    // Nothing recognisable — a mobility or cardio day, or names the catalog
    // has never heard of. `general` is the honest answer, not a fallback.
    return 'general';
  }

  if (counts.lower / total >= MAJORITY) {
    return 'lower';
  }

  const upper = counts.push + counts.pull;
  if (upper / total >= MAJORITY) {
    if (counts.push / upper >= MAJORITY) {
      return 'push';
    }
    if (counts.pull / upper >= MAJORITY) {
      return 'pull';
    }
    return 'upper';
  }

  return 'general';
}

/**
 * A warmup/cooldown drill with its gear requirement. `requires` uses the same
 * equipment-chip vocabulary as equipmentExerciseFilter: every group must be
 * satisfied by at least one available item. Drills with no `requires` are
 * bodyweight and always allowed; every gated drill carries a bodyweight
 * fallback so the block never shrinks — a user with no rower warms up with
 * jumping jacks, not with a machine they told us they don't have.
 */
interface DrillSpec {
  key: Parameters<typeof t>[1];
  scheme: string;
  requires?: string[][];
  fallbackKey?: Parameters<typeof t>[1];
  fallbackScheme?: string;
}

const CARDIO_OPENER: DrillSpec = {
  key: 'home.drill.rowingMachine',
  scheme: '3 min',
  requires: [['Cardio machines']],
  fallbackKey: 'home.drill.jumpingJacks',
  fallbackScheme: '2 min',
};

const WARMUP_DRILLS: Record<SessionFocusKind, DrillSpec[]> = {
  lower: [
    CARDIO_OPENER,
    { key: 'home.drill.hipOpeners', scheme: '2 × 8' },
    {
      key: 'home.drill.emptyBarSquats',
      scheme: '2 × 10',
      requires: [['Barbells', 'Barbell & plates']],
      fallbackKey: 'home.drill.bodyweightSquats',
    },
  ],
  push: [
    CARDIO_OPENER,
    {
      key: 'home.drill.bandPullAparts',
      scheme: '2 × 12',
      requires: [['Resistance bands']],
      fallbackKey: 'home.drill.armCircles',
    },
    { key: 'home.drill.pushUps', scheme: '2 × 8' },
  ],
  pull: [
    CARDIO_OPENER,
    {
      key: 'home.drill.scapularPullUps',
      scheme: '2 × 6',
      requires: [['Pull-up bar']],
      fallbackKey: 'home.drill.wallSlides',
      fallbackScheme: '2 × 8',
    },
    {
      key: 'home.drill.bandFacePulls',
      scheme: '2 × 12',
      requires: [['Resistance bands']],
      fallbackKey: 'home.drill.wallSlides',
    },
  ],
  // Both halves of the body get prepped, because both are about to work.
  upper: [
    CARDIO_OPENER,
    {
      key: 'home.drill.bandPullAparts',
      scheme: '2 × 12',
      requires: [['Resistance bands']],
      fallbackKey: 'home.drill.armCircles',
    },
    { key: 'home.drill.pushUps', scheme: '2 × 8' },
  ],
  // A mixed day, so the block is mixed too — hips and shoulders, not the
  // lower-body block wearing a different name.
  general: [
    CARDIO_OPENER,
    { key: 'home.drill.hipOpeners', scheme: '2 × 8' },
    { key: 'home.drill.pushUps', scheme: '2 × 8' },
  ],
};

const COOLDOWN_DRILLS: Record<SessionFocusKind, DrillSpec[]> = {
  push: [
    { key: 'home.drill.chestDoorwayStretch', scheme: '2 × 45s' },
    { key: 'home.drill.tricepsOverheadStretch', scheme: '2 × 30s' },
  ],
  pull: [
    {
      key: 'home.drill.latStretchOnRack',
      scheme: '2 × 45s',
      requires: [['Squat rack', 'Pull-up bar']],
      fallbackKey: 'home.drill.standingLatStretch',
    },
    {
      key: 'home.drill.deadHang',
      scheme: '2 × 30s',
      requires: [['Pull-up bar']],
      fallbackKey: 'home.drill.childsPose',
    },
  ],
  // Front of the thigh and back of it. The chest doorway stretch used to sit
  // here, which is how a leg day ended by stretching the chest — the drill was
  // never wrong, it was in the wrong block.
  lower: [
    { key: 'home.drill.couchStretch', scheme: '2 × 60s' },
    { key: 'home.drill.seatedHamstringStretch', scheme: '2 × 45s' },
  ],
  upper: [
    { key: 'home.drill.chestDoorwayStretch', scheme: '2 × 45s' },
    {
      key: 'home.drill.latStretchOnRack',
      scheme: '2 × 45s',
      requires: [['Squat rack', 'Pull-up bar']],
      fallbackKey: 'home.drill.standingLatStretch',
    },
  ],
  general: [
    { key: 'home.drill.couchStretch', scheme: '2 × 60s' },
    { key: 'home.drill.chestDoorwayStretch', scheme: '2 × 45s' },
  ],
};

function drillAllowed(spec: DrillSpec, available: string[] | null) {
  // null = the setup never said what gear exists, so nothing is assumed missing.
  if (available === null || !spec.requires) {
    return true;
  }
  return spec.requires.every((group) => group.some((item) => available.includes(item)));
}

function resolveDrills(
  specs: DrillSpec[],
  language: AppLanguage,
  available: string[] | null,
): SessionRoutineBlock['drills'] {
  return specs.map((spec) => {
    if (drillAllowed(spec, available)) {
      return { name: t(language, spec.key), schemeLabel: spec.scheme };
    }
    return {
      name: t(language, spec.fallbackKey ?? spec.key),
      schemeLabel: spec.fallbackScheme ?? spec.scheme,
    };
  });
}

/**
 * A block's minutes, from the drills it actually holds — the same arithmetic
 * the guided player runs on the same drills. These used to be the literals 6
 * and 4, so Home said "Palautuminen · 4 min" over two stretches that take
 * two and a half, while the player's entry screen said ~3 for the same block.
 */
function routineBlockMinutes(drills: SessionRoutineBlock['drills']): number {
  return Math.max(1, Math.round(estimateRoutineBlockSeconds({ minutes: 0, drills }) / 60));
}

/**
 * Deterministic default warmup for a session focus (no warmup data model yet).
 *
 * Takes the classified focus rather than a title, so no caller can pass display
 * text again — a session name is now a type error here, not a silent `general`.
 */
export function getDefaultWarmup(
  focus: SessionFocusKind,
  language: AppLanguage = 'en',
  availableEquipment: string[] | null = null,
): SessionRoutineBlock {
  const drills = resolveDrills(WARMUP_DRILLS[focus], language, availableEquipment);
  return { minutes: routineBlockMinutes(drills), drills };
}

/** Deterministic default cooldown for a session focus. */
export function getDefaultCooldown(
  focus: SessionFocusKind,
  language: AppLanguage = 'en',
  availableEquipment: string[] | null = null,
): SessionRoutineBlock {
  const drills = resolveDrills(COOLDOWN_DRILLS[focus], language, availableEquipment);
  return { minutes: routineBlockMinutes(drills), drills };
}
