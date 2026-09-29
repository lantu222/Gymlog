/**
 * Clamps a remembered History-list scroll offset to what the list can
 * actually show right now.
 *
 * The list can get shorter between a visit and the next — deleting a
 * session while its detail is open is the direct route — and restoring an
 * offset past the new bottom would leave the scroll wedged against empty
 * padding instead of back at the row the reader was reading (#bugs
 * 2026-09-29).
 */
export function clampHistoryScrollOffset(
  rememberedOffsetY: number,
  contentHeightPx: number,
  viewportHeightPx: number,
): number {
  if (!Number.isFinite(rememberedOffsetY) || rememberedOffsetY <= 0) {
    return 0;
  }
  const maxOffsetY = Math.max(0, contentHeightPx - viewportHeightPx);
  return Math.min(rememberedOffsetY, maxOffsetY);
}
