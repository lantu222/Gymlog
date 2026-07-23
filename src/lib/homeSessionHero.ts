/**
 * Pure helpers for the Home v4 session hero (design_handoff_home_v4).
 * Focus title, body-focus label, week phase, equipment line, default
 * warmup/cooldown blocks, and the Adapt-sheet trim estimate.
 */
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
  if (/^day\s*\d+$/i.test(head.trim()) && afterColon) {
    return afterColon;
  }
  const beforeColon = head.trim();
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

type FocusKind = 'lower' | 'push' | 'pull' | 'general';

function classifyFocus(focusTitle: string): FocusKind {
  const normalized = focusTitle.toLowerCase();
  if (/(squat|leg|lower|glute|posterior)/.test(normalized)) {
    return 'lower';
  }
  if (/(push|chest|press|shoulder)/.test(normalized)) {
    return 'push';
  }
  if (/(pull|back|row|width)/.test(normalized)) {
    return 'pull';
  }
  return 'general';
}

/** Deterministic default warmup for a session focus (no warmup data model yet). */
export function getDefaultWarmup(focusTitle: string, language: AppLanguage = 'en'): SessionRoutineBlock {
  switch (classifyFocus(focusTitle)) {
    case 'lower':
      return {
        minutes: 6,
        drills: [
          { name: t(language, 'home.drill.rowingMachine'), schemeLabel: '3 min' },
          { name: t(language, 'home.drill.hipOpeners'), schemeLabel: '2 × 8' },
          { name: t(language, 'home.drill.emptyBarSquats'), schemeLabel: '2 × 10' },
        ],
      };
    case 'push':
      return {
        minutes: 6,
        drills: [
          { name: t(language, 'home.drill.rowingMachine'), schemeLabel: '3 min' },
          { name: t(language, 'home.drill.bandPullAparts'), schemeLabel: '2 × 12' },
          { name: t(language, 'home.drill.pushUps'), schemeLabel: '2 × 8' },
        ],
      };
    case 'pull':
      return {
        minutes: 6,
        drills: [
          { name: t(language, 'home.drill.rowingMachine'), schemeLabel: '3 min' },
          { name: t(language, 'home.drill.scapularPullUps'), schemeLabel: '2 × 6' },
          { name: t(language, 'home.drill.bandFacePulls'), schemeLabel: '2 × 12' },
        ],
      };
    default:
      return {
        minutes: 6,
        drills: [
          { name: t(language, 'home.drill.rowingMachine'), schemeLabel: '3 min' },
          { name: t(language, 'home.drill.hipOpeners'), schemeLabel: '2 × 8' },
          { name: t(language, 'home.drill.emptyBarSquats'), schemeLabel: '2 × 10' },
        ],
      };
  }
}

/** Deterministic default cooldown for a session focus. */
export function getDefaultCooldown(focusTitle: string, language: AppLanguage = 'en'): SessionRoutineBlock {
  switch (classifyFocus(focusTitle)) {
    case 'push':
      return {
        minutes: 4,
        drills: [
          { name: t(language, 'home.drill.chestDoorwayStretch'), schemeLabel: '2 × 45s' },
          { name: t(language, 'home.drill.tricepsOverheadStretch'), schemeLabel: '2 × 30s' },
        ],
      };
    case 'pull':
      return {
        minutes: 4,
        drills: [
          { name: t(language, 'home.drill.latStretchOnRack'), schemeLabel: '2 × 45s' },
          { name: t(language, 'home.drill.deadHang'), schemeLabel: '2 × 30s' },
        ],
      };
    default:
      return {
        minutes: 4,
        drills: [
          { name: t(language, 'home.drill.couchStretch'), schemeLabel: '2 × 60s' },
          { name: t(language, 'home.drill.chestDoorwayStretch'), schemeLabel: '2 × 45s' },
        ],
      };
  }
}

/** "Trim to ~35 min · drops 4 sets" numbers for the Adapt sheet. */
export function getAdaptTrimEstimate(
  totalSets: number,
  durationMinutes: number,
): { trimmedMinutes: number; droppedSets: number } {
  const droppedSets = Math.max(1, Math.round(totalSets * 0.3));
  const trimmedMinutes = Math.max(15, Math.round((durationMinutes - droppedSets * 5) / 5) * 5);
  return { trimmedMinutes, droppedSets };
}
