/**
 * The A3 shape's geometry: top-left corner cut away, the other three rounded.
 *
 * Pure, and in lib rather than beside the component, because the numbers are
 * the design contract — 14 / 11 / 8 / 7 px of cut at 50 / 40 / 30 / 26 px tall,
 * so the smallest chip reads as the same shape as the largest button.
 *
 * React Native has no `clip-path`. The design offers plain border-radius as a
 * fallback, but a square top-left corner reads as a rendering mistake rather
 * than as a cut, so the outline is drawn as a path instead.
 */

export type CutSize = 'lg' | 'md' | 'sm' | 'chip';

export const CUT_BY_SIZE: Record<CutSize, number> = {
  lg: 14,
  md: 11,
  sm: 8,
  chip: 7,
};

/** Bottom-left stays nearly square: the cut is the only soft corner on that side. */
const BOTTOM_LEFT_RADIUS = 4;

export function cutCornerPath(width: number, height: number, cut: number): string {
  const w = Math.max(width, 1);
  const h = Math.max(height, 1);
  // Never let the corners eat each other on a very small box.
  const c = Math.max(0, Math.min(cut, w / 2, h / 2));
  const r = c;
  const bl = Math.max(0, Math.min(BOTTOM_LEFT_RADIUS, w / 2, h / 2));

  return [
    `M ${c} 0`,
    `H ${w - r}`,
    `A ${r} ${r} 0 0 1 ${w} ${r}`,
    `V ${h - r}`,
    `A ${r} ${r} 0 0 1 ${w - r} ${h}`,
    `H ${bl}`,
    `A ${bl} ${bl} 0 0 1 0 ${h - bl}`,
    `V ${c}`,
    'Z',
  ].join(' ');
}

/**
 * Skew about the shape's vertical centre, the way CSS does it.
 *
 * SVG's `skewX` pivots on y = 0, so a bar drawn from the top slid further and
 * further left as it went down and most of it left the shape — the speed line
 * showed as a pale sliver instead of a solid bar.
 */
export function skewAboutCentre(height: number): string {
  const cy = height / 2;
  return `translate(0 ${cy}) skewX(-18) translate(0 ${-cy})`;
}
