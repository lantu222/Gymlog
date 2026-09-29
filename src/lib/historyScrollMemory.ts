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

/**
 * What a remembered History-list scroll offset was captured under.
 *
 * The offset used to be one bare number, blind to what the list was showing
 * when it was recorded. Typing a search, scrolling down its shorter
 * filtered list, then switching tabs away and back remounts the screen with
 * its search box reset to "" — and the bare number restored onto that fresh,
 * unfiltered list anyway, landing the reader partway down rows they had
 * never scrolled past (recheck round 2026-09-29). Carrying the query and
 * filter alongside the offset lets the restore check it is looking at the
 * same list it was recorded from.
 */
export interface HistoryScrollMemory {
  offsetY: number;
  searchQuery: string;
  filter: string;
}

/**
 * Whether a remembered offset was captured on the same list — same search
 * text, same filter — the screen is about to show, and so is safe to
 * restore. #232 only promised the round trip into a session and back would
 * keep the reader's place; a fresh visit (search reset, filter reset) can
 * still land at the top, which falling through to `false` here does.
 */
export function historyScrollMemoryMatches(
  remembered: HistoryScrollMemory | null | undefined,
  current: { searchQuery: string; filter: string },
): boolean {
  return (
    remembered != null && remembered.searchQuery === current.searchQuery && remembered.filter === current.filter
  );
}
