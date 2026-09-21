/**
 * Screen-reader labels that are built from what a control shows.
 *
 * The accessibility audit of 2026-09-21 found the same mistake in several
 * places: a pressable card given a label that named its ACTION, which on
 * Android replaces everything inside it. The set screen's lift card was read
 * as "Liikkeen tiedot" — the lift's name and last time's numbers, the two
 * things the card exists to show, were never spoken. The action belongs in
 * the hint; the label is the content.
 *
 * Pure, so the wording can be tested without rendering a screen.
 */
import { AppLanguage } from '../types/models';
import { removeTrailingZeros } from './format';
import { t } from './i18n';
import { WEIGHT_DIAL_STEP_KG } from './weightDial';

export interface LastTimeSummary {
  /** The heaviest load of last time's sets; 0 when none carried a weight. */
  heaviestKg: number;
  /** Reps of each set, in order. */
  reps: number[];
  /** From this lift in another program or an empty workout, not this slot. */
  borrowed: boolean;
}

/**
 * The lift card on the set screen: the name, then last time, in the order the
 * card draws them. A lift never done reads the card's own first-time line.
 */
export function exerciseCardAccessibilityLabel(
  language: AppLanguage,
  name: string,
  lastTime: LastTimeSummary | null,
): string {
  if (!lastTime) {
    return `${name}. ${t(language, 'guided.card.firstTime')}`;
  }
  const details = [
    lastTime.heaviestKg > 0 ? `${removeTrailingZeros(lastTime.heaviestKg)} kg` : null,
    lastTime.reps.length > 0 ? t(language, 'guided.a11y.lastTimeReps', { reps: lastTime.reps.join(', ') }) : null,
  ].filter((part): part is string => part !== null);
  const lead = t(language, lastTime.borrowed ? 'guided.a11y.lastTimeBorrowed' : 'guided.a11y.lastTime');
  return details.length > 0 ? `${name}. ${lead}: ${details.join(', ')}` : `${name}. ${lead}`;
}

/**
 * One of a set's two number fields. `setNumber` is the one the screen prints
 * (1-based). `liftName` goes first where the list holds more than one lift.
 */
export function setFieldAccessibilityLabel(
  language: AppLanguage,
  field: 'kg' | 'reps',
  setNumber: number,
  liftName?: string | null,
): string {
  if (liftName) {
    return t(language, field === 'kg' ? 'a11y.setField.kgInLift' : 'a11y.setField.repsInLift', {
      name: liftName,
      index: setNumber,
    });
  }
  return t(language, field === 'kg' ? 'a11y.setField.kg' : 'a11y.setField.reps', { index: setNumber });
}

/**
 * The weight dial's −/+ labels, from the step the dial actually takes. The
 * copy used to state 2,5 kg while the dial moved 1,25, so a screen-reader user
 * was told twice the change they made. Printed with the app's decimal mark.
 */
export function weightStepAccessibilityLabel(language: AppLanguage, direction: -1 | 1): string {
  return t(language, direction < 0 ? 'guided.a11y.weightDown' : 'guided.a11y.weightUp', {
    kg: removeTrailingZeros(WEIGHT_DIAL_STEP_KG),
  });
}
