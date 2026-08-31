import { MeasurementKind } from '../types/models';

/**
 * Every measurement the app can take — the one list, so a new one cannot be
 * half-added.
 *
 * `normalizeDatabase` used to carry its own hand-written chain of
 * `entry.kind === '...'` comparisons. It had drifted: `arms` and `calves` were
 * added to the model and to the measurement screen, and never to that chain,
 * so a reader who logged a biceps or a calf lost it on the next app start —
 * the entry was written, read back, and dropped in silence. Adding `back` on
 * 2026-08-31 would have made three.
 *
 * The type is the source. `MEASUREMENT_KIND_ORDER` is typed as a tuple whose
 * union must equal `MeasurementKind`, so leaving a kind out is a compile
 * error rather than a bug someone finds on their own phone months later.
 */
export const MEASUREMENT_KIND_ORDER = [
  'bodyfat',
  'shoulders',
  'chest',
  'back',
  'arms',
  'waist',
  'hips',
  'thighs',
  'calves',
] as const;

/**
 * Compile-time proof that the list above covers the type, in both directions.
 *
 * Miss one and `Exhaustive` stops being `true`; invent one and the array stops
 * satisfying `readonly MeasurementKind[]`.
 */
type ListedKind = (typeof MEASUREMENT_KIND_ORDER)[number];
type Exhaustive = [MeasurementKind] extends [ListedKind]
  ? [ListedKind] extends [MeasurementKind]
    ? true
    : false
  : false;
const EXHAUSTIVE: Exhaustive = true;
void EXHAUSTIVE;

export function isMeasurementKind(value: unknown): value is MeasurementKind {
  return (
    typeof value === 'string' && (MEASUREMENT_KIND_ORDER as readonly string[]).includes(value)
  );
}
