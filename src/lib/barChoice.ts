import type { ExerciseLibraryItem } from '../types/models';

/**
 * Which bar a barbell lift is loaded on (#bugs 2026-09-28: "pitäskö olla myös
 * tanko painot esim 20kg ja onkohan z-bar 7,5kg ja yks 15kg").
 *
 * Three bars and nothing else, by the user's own list. The weight the set
 * screen logs stays the TOTAL, bar included: the choice says which bar is in
 * that total, so switching bars moves the number by the difference and the
 * history of a lift never mixes totals with plates-only numbers.
 */
export const BAR_WEIGHTS_KG = [7.5, 15, 20] as const;
export type BarWeightKg = (typeof BAR_WEIGHTS_KG)[number];

export function isBarWeightKg(value: unknown): value is BarWeightKg {
  return typeof value === 'number' && (BAR_WEIGHTS_KG as readonly number[]).includes(value);
}

/**
 * The total after swapping one bar for another — or putting one on or taking
 * it off (null). Never below zero, and kept to the hundredth so 27.5 − 7.5 is
 * 20, not 19.999999999999996.
 */
export function switchBar(totalKg: number, from: BarWeightKg | null, to: BarWeightKg | null): number {
  const base = Number.isFinite(totalKg) ? totalKg : 0;
  const next = base - (from ?? 0) + (to ?? 0);
  return Math.max(0, Math.round(next * 100) / 100);
}

/** The row is for lifts done with a bar: the library's barbell equipment, which includes the EZ bar. */
export function barChoiceApplies(item: Pick<ExerciseLibraryItem, 'equipment'> | null | undefined): boolean {
  return item?.equipment === 'barbell';
}

/** The choice is remembered per lift, by the name the session carries. */
export function barChoiceKey(exerciseName: string): string {
  return exerciseName.trim().toLowerCase();
}

/**
 * Stored choices, as far as they can be trusted: an object of known bar
 * weights under non-empty names. Anything else is dropped rather than read —
 * a stored 25 would otherwise subtract a bar that is not one of the three.
 */
export function normalizeBarChoices(input: unknown): Record<string, BarWeightKg> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {};
  }
  const out: Record<string, BarWeightKg> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    const name = barChoiceKey(key);
    if (name && isBarWeightKg(value)) {
      out[name] = value;
    }
  }
  return out;
}

/** The choices after one lift's changes; null forgets it. */
export function withBarChoice(
  choices: Record<string, BarWeightKg>,
  exerciseName: string,
  bar: BarWeightKg | null,
): Record<string, BarWeightKg> {
  const key = barChoiceKey(exerciseName);
  if (!key) {
    return choices;
  }
  const next = { ...choices };
  if (bar === null) {
    delete next[key];
  } else {
    next[key] = bar;
  }
  return next;
}

/**
 * The weight the dial opens on. The target, when there is one: it came from
 * a logged total, so the bar is already in it. With no target but a
 * remembered bar, the bar itself — nothing lighter can be lifted on it.
 */
export function openingWeightWithBar(targetKg: number | null | undefined, bar: BarWeightKg | null): number {
  if (typeof targetKg === 'number' && Number.isFinite(targetKg) && targetKg > 0) {
    return targetKg;
  }
  return bar ?? 0;
}
