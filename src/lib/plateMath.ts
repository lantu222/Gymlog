/**
 * Barbell plate math for the freestyle logger's plate readout.
 *
 * Mirrors the AW3 design handoff (aw3-shared.jsx): a 20 kg bar, standard kg
 * plates, and a greedy per-side breakdown. Pure and kg-only like the rest of
 * src/lib.
 */

export const BAR_WEIGHT_KG = 20;

/** Standard kg plates, heaviest first — the greedy order used per side. */
export const PLATE_SIZES_KG = [25, 20, 15, 10, 5, 2.5, 1.25] as const;

/** Competition-style plate colors from the design handoff. */
export const PLATE_COLORS: Record<number, string> = {
  25: '#C0392B',
  20: '#2A6FDB',
  15: '#E0A100',
  10: '#1F8A5B',
  5: '#33302B',
  2.5: '#8A8577',
  1.25: '#B9B4A8',
};

/**
 * Greedy plate breakdown for one side of the bar. Returns an empty list when
 * the total is at or below the bar weight ("just the bar"). Weight that does
 * not divide into standard plates is left off rather than rounded up.
 */
export function platesPerSide(totalKg: number, barKg: number = BAR_WEIGHT_KG): number[] {
  let remaining = (totalKg - barKg) / 2;
  const plates: number[] = [];

  if (!Number.isFinite(remaining) || remaining <= 0.0001) {
    return plates;
  }

  for (const plate of PLATE_SIZES_KG) {
    // The epsilon absorbs float drift from repeated 2.5/1.25 subtraction.
    while (remaining >= plate - 1e-9) {
      plates.push(plate);
      remaining -= plate;
    }
  }

  return plates;
}
