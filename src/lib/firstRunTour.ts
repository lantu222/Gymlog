/**
 * The first-run tour: which beats a surface has, where a callout goes, and
 * which surfaces have had their turn.
 *
 * Design: "Vinha First-Run Tour" (brief corrected against this codebase on
 * 2026-09-08, build reviewed the same day). Three things the review sent
 * back, and this module is where they are settled rather than in the UI:
 *
 * - The tour never blocks. There is no scrim, so nothing here models a
 *   "tap outside" surface. The callout advances itself; the page stays live.
 * - The bar is ONE beat: a sweep across the five items with the highlight
 *   travelling, not five stops with five taps.
 * - Beats point at sections that exist on a fresh install. What is inside
 *   them (an empty calendar, one weigh-in) is the real screen's business.
 *
 * Pure: the numbers are the contract, and the placement maths is the part a
 * mock got wrong (the ring measured mid-scroll), so it is testable here.
 */

import { cutCornerPath } from './cutCorner';
import type { I18nKey } from './i18n';

export type TourSurface = 'home' | 'progress' | 'profile';

export const TOUR_SURFACES: readonly TourSurface[] = ['home', 'progress', 'profile'];

/** Every element a screen or the bar can register for the tour to point at. */
export type TourTargetId =
  | 'home.week'
  | 'home.hero'
  | 'home.workoutChevron'
  | 'home.program'
  | 'home.cards'
  | 'progress.chart'
  | 'progress.calendar'
  | 'profile.milestone'
  | 'profile.settings'
  | 'bar.pill'
  | 'bar.home'
  | 'bar.programs'
  | 'bar.ai'
  | 'bar.progress'
  | 'bar.profile';

/** The bar's five items, left to right, as the sweep visits them. */
export type TourBarStop = 'home' | 'programs' | 'ai' | 'progress' | 'profile';

export const TOUR_BAR_STOPS: readonly TourBarStop[] = ['home', 'programs', 'ai', 'progress', 'profile'];

export interface TourSectionBeat {
  kind: 'section';
  target: TourTargetId;
  /**
   * What the callout is placed against, when that is not the ring's target.
   * The hero beat rings one chevron but belongs to the whole day block, so
   * the callout sits under the block and follows it as the list opens and
   * closes. Defaults to `target`.
   */
  anchor?: TourTargetId;
  /** Which side of the target the callout prefers; the band decides. */
  place: 'above' | 'below';
  /**
   * How the scroller brings the target into the band. The last section on a
   * page has nothing under it to lift itself against, so it asks for the end
   * of the list instead of an offset (user 2026-09-08: the cards beat stopped
   * short and drew half a section).
   */
  scroll?: 'target' | 'end';
  /** The dictionary key for the callout's one sentence. */
  copyKey: I18nKey;
}

export interface TourBarBeat {
  kind: 'bar';
  stops: readonly TourBarStop[];
}

export type TourBeat = TourSectionBeat | TourBarBeat;

/**
 * Home's beats, in the order the page unfolds. The lifts (300 ms) and the
 * empty-workout/cardio rows (600 ms) are deliberately absent: the list stands
 * open and the rows carry their own names, so a callout on either restates
 * what is already on screen.
 */
export function resolveTourBeats(surface: TourSurface, options: { hasProgram: boolean }): TourBeat[] {
  switch (surface) {
    case 'home': {
      const beats: TourBeat[] = [
        { kind: 'section', target: 'home.week', place: 'below', copyKey: 'tour.home.week' },
        // With a plan, the day block is a box of foldable rows and the beat's
        // subject is the fold itself: the ring goes on the workout row's
        // chevron, the callout stays with the block. Without one, the block is
        // a single start button and there is nothing finer to point at.
        options.hasProgram
          ? {
              kind: 'section',
              target: 'home.workoutChevron',
              anchor: 'home.hero',
              place: 'below',
              copyKey: 'tour.home.hero',
            }
          : { kind: 'section', target: 'home.hero', place: 'below', copyKey: 'tour.home.hero' },
      ];
      if (options.hasProgram) {
        beats.push({ kind: 'section', target: 'home.program', place: 'below', copyKey: 'tour.home.program' });
      }
      beats.push({ kind: 'section', target: 'home.cards', place: 'above', scroll: 'end', copyKey: 'tour.home.cards' });
      beats.push({ kind: 'bar', stops: TOUR_BAR_STOPS });
      return beats;
    }
    case 'progress':
      return [
        { kind: 'section', target: 'progress.chart', place: 'below', copyKey: 'tour.progress.chart' },
        { kind: 'section', target: 'progress.calendar', place: 'above', copyKey: 'tour.progress.calendar' },
      ];
    case 'profile':
      return [
        { kind: 'section', target: 'profile.milestone', place: 'below', copyKey: 'tour.profile.milestone' },
        { kind: 'section', target: 'profile.settings', place: 'below', copyKey: 'tour.profile.settings' },
      ];
    default:
      return [];
  }
}

export const TOUR_BAR_STOP_COPY_KEY: Record<TourBarStop, I18nKey> = {
  home: 'tour.bar.home',
  programs: 'tour.bar.programs',
  ai: 'tour.bar.ai',
  progress: 'tour.bar.progress',
  profile: 'tour.bar.profile',
};

// ── Timing ──────────────────────────────────────────────────────────────

/**
 * Home's last section starts rising at 600 ms and rises for 500 ms
 * (HomeScreen RISE_DELAYS_MS). The tour cannot ride that stagger — six
 * callouts inside 1.1 s would land a hundred milliseconds apart — so it
 * waits for the page to settle and starts then. Nothing is paused or slowed.
 */
export const HOME_UNFOLD_SETTLED_MS = 600 + 500;
export const TOUR_START_AFTER_UNFOLD_MS = HOME_UNFOLD_SETTLED_MS + 50;
/** Under reduced motion there is no unfold to wait for. */
export const TOUR_START_REDUCED_MS = 30;

export const CALLOUT_ENTER_MS = 260;
export const CALLOUT_LEAVE_MS = 160;
export const RING_ENTER_MS = 300;
/**
 * How long the bar sweep rests on each item before moving on. 1800 read the
 * five names faster than a first-time reader could (user 2026-09-08).
 */
export const BAR_SWEEP_STOP_MS = 2600;
/** After a programmatic scroll, the target is measured once this has passed. */
export const SCROLL_SETTLE_MS = 450;
/**
 * The page under the tour is live, so a beat's target moves for reasons no
 * scroll event reports: the week row opens a month panel into itself, the
 * workout list folds. The beat re-measures on this tick and moves the ring
 * and the callout when the answer changed.
 */
export const TOUR_REMEASURE_MS = 300;
/**
 * After the reader's own scroll, the beat leaves the page alone this long
 * before it may scroll again. Chasing a target the reader is dragging is the
 * one thing worse than a callout slightly out of place.
 */
export const TOUR_RESCROLL_QUIET_MS = 600;
/** Sub-pixel measurement jitter is not a move. */
export const RECT_EPSILON = 0.5;

export function tourStartDelayMs(reduceMotion: boolean): number {
  return reduceMotion ? TOUR_START_REDUCED_MS : TOUR_START_AFTER_UNFOLD_MS;
}

// ── Placement ───────────────────────────────────────────────────────────

export interface TourRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Nothing anchored low sits on the gesture bar: 24 dp under it, always. */
export const GESTURE_BAR_FLOOR = 24;
/** The callout never climbs into the status bar's band. */
export const CALLOUT_TOP_MIN = 12;
export const CALLOUT_GAP = 14;
export const CALLOUT_SIDE_INSET = 20;
/** The ring's breathing room around a section, and its size on a bar item. */
export const RING_PAD = 7;
export const RING_BAR_DIAMETER = 62;
export const RING_BAR_AI_DIAMETER = 74;
/** A row's chevron is a 16 dp glyph; the ring is the tap target around it. */
export const RING_CHEVRON_DIAMETER = 44;
/** A ring on one control breathes, so the glyph under it reads as pressable. */
export const RING_PULSE_SCALE = 1.12;
export const RING_PULSE_MS = 900;
/** The cut on the section ring's top-left corner, matching the app's shape. */
export const RING_CUT = 20;

export type TourRingShape = 'section' | 'bar' | 'bar-ai' | 'chevron';

export interface PlaceCalloutInput {
  target: TourRect;
  calloutHeight: number;
  /** The overlay's height; the band's floor is derived from it or the bar. */
  screenHeight: number;
  /** Top of the floating bar, when one is on screen. */
  barTop: number | null;
  prefer: 'above' | 'below';
}

export interface CalloutPlacement {
  top: number;
  /** True when the callout sits above its target, so the notch points down. */
  above: boolean;
}

/**
 * Resolve which side of the target the callout sits on, and clamp it into the
 * band between the status bar and the floating bar.
 *
 * A beat's `place` is a preference, not a coordinate: the target's real
 * position depends on how far the scroller could reach, and on the last
 * section it cannot lift the target any further. So the side is decided
 * against the measured callout height and the band, and the preference only
 * breaks the tie when both fit.
 */
export function placeCallout(input: PlaceCalloutInput): CalloutPlacement {
  const { target, calloutHeight, screenHeight, barTop, prefer } = input;
  const bandBottom = (barTop ?? screenHeight) - GESTURE_BAR_FLOOR;
  const lowest = Math.max(CALLOUT_TOP_MIN, bandBottom - calloutHeight);
  const below = target.y + target.height + CALLOUT_GAP;
  const above = target.y - CALLOUT_GAP - calloutHeight;
  const fitsBelow = below <= lowest;
  const fitsAbove = above >= CALLOUT_TOP_MIN;

  let isAbove: boolean;
  if (fitsAbove !== fitsBelow) {
    // Only one side has room.
    isAbove = fitsAbove;
  } else if (fitsAbove) {
    // Both fit: the beat's preference decides.
    isAbove = prefer === 'above';
  } else {
    // Neither fits; the clamp below will overlap the target either way. Go
    // above unless that would push the callout up past the status band by
    // more than a row's worth (40), in which case below hides less.
    isAbove = above >= CALLOUT_TOP_MIN - 40;
  }
  const raw = isAbove ? above : below;
  return { top: Math.max(CALLOUT_TOP_MIN, Math.min(raw, lowest)), above: isAbove };
}

/** Where the notch points: the target's centre, kept inside the callout. */
export function notchOffset(target: TourRect, calloutLeft: number, calloutWidth: number): number {
  const centre = target.x + target.width / 2 - calloutLeft;
  const min = 18;
  const max = Math.max(min, calloutWidth - 18);
  return Math.max(min, Math.min(max, centre));
}

/**
 * Which shape a section beat's ring takes: a circle on one control when the
 * beat rings something inside its anchor and that control was actually found,
 * the padded outline otherwise — including when the fine target is not on
 * this install and the anchor stood in for it.
 */
export function sectionRingShape(beat: TourSectionBeat, foundTarget: boolean): TourRingShape {
  return foundTarget && beat.anchor !== undefined && beat.anchor !== beat.target ? 'chevron' : 'section';
}

/** The ring's box: padded around a section, a fixed circle on a glyph. */
export function ringBox(target: TourRect, shape: TourRingShape): TourRect {
  if (shape === 'section') {
    return {
      x: target.x - RING_PAD,
      y: target.y - RING_PAD,
      width: target.width + RING_PAD * 2,
      height: target.height + RING_PAD * 2,
    };
  }
  const d =
    shape === 'bar-ai' ? RING_BAR_AI_DIAMETER : shape === 'chevron' ? RING_CHEVRON_DIAMETER : RING_BAR_DIAMETER;
  return {
    x: target.x + target.width / 2 - d / 2,
    y: target.y + target.height / 2 - d / 2,
    width: d,
    height: d,
  };
}

/**
 * Did the target actually move? The beat re-measures four times a second, and
 * setting state on an unchanged rectangle re-renders the layer for nothing.
 */
export function rectChanged(previous: TourRect | null, next: TourRect | null): boolean {
  if (previous === next) {
    return false;
  }
  if (!previous || !next) {
    return true;
  }
  return (
    Math.abs(previous.x - next.x) > RECT_EPSILON ||
    Math.abs(previous.y - next.y) > RECT_EPSILON ||
    Math.abs(previous.width - next.width) > RECT_EPSILON ||
    Math.abs(previous.height - next.height) > RECT_EPSILON
  );
}

/**
 * Does the callout, where it landed, sit on top of what it points at?
 *
 * `placeCallout` clamps into the band, so a target that has grown past what
 * the band leaves over — the day block with its list open — gets its own
 * callout pushed back across it. That is the signal to scroll the page again,
 * not to move the callout somewhere it does not belong.
 */
export function calloutCoversTarget(
  placement: CalloutPlacement,
  target: TourRect,
  calloutHeight: number,
): boolean {
  return placement.top + calloutHeight > target.y && placement.top < target.y + target.height;
}

/** A closed circle as path data, so a cut-out can hold it and its frame in one `d`. */
function circlePath(cx: number, cy: number, r: number): string {
  return `M ${cx - r} ${cy} A ${r} ${r} 0 1 0 ${cx + r} ${cy} A ${r} ${r} 0 1 0 ${cx - r} ${cy} Z`;
}

/**
 * The dim layer's one path: the whole overlay with the ring's shape punched
 * out of it, drawn with `fillRule="evenodd"`.
 *
 * Both subpaths must live in ONE `<Path>` for even-odd to cut a hole rather
 * than paint a second shape, so they share the hole's frame — the caller
 * draws this inside `translate(hole.x hole.y)`, the way the ring already is.
 */
export function dimCutoutPath(
  overlay: { width: number; height: number },
  hole: TourRect,
  shape: TourRingShape,
): string {
  const outer = `M ${-hole.x} ${-hole.y} H ${overlay.width - hole.x} V ${overlay.height - hole.y} H ${-hole.x} Z`;
  const inner =
    shape === 'section'
      ? cutCornerPath(hole.width, hole.height, RING_CUT)
      : circlePath(hole.width / 2, hole.height / 2, hole.width / 2);
  return `${outer} ${inner}`;
}

/**
 * How far to scroll so the target sits where the callout has room: a section
 * that wants its callout below is lifted to the upper third, one that wants
 * it above sits lower. Negative offsets clamp to the top.
 */
export function scrollOffsetForTarget(
  currentOffset: number,
  targetTopInViewport: number,
  prefer: 'above' | 'below',
): number {
  const lift = prefer === 'below' ? 132 : 240;
  return Math.max(0, currentOffset + targetTopInViewport - lift);
}

// ── Seen state ──────────────────────────────────────────────────────────

export function isTourSurface(value: unknown): value is TourSurface {
  return typeof value === 'string' && (TOUR_SURFACES as readonly string[]).includes(value);
}

/**
 * The loader's normaliser: whatever an old install stored, the result is a
 * list of known surfaces with no duplicates. Anything else means "not seen",
 * which costs a returning reader one replay rather than a crash.
 */
export function normalizeFirstRunToursSeen(input: unknown): TourSurface[] {
  if (!Array.isArray(input)) {
    return [];
  }
  const seen: TourSurface[] = [];
  for (const value of input) {
    if (isTourSurface(value) && !seen.includes(value)) {
      seen.push(value);
    }
  }
  return seen;
}

export function isTourDue(seen: readonly TourSurface[], surface: TourSurface): boolean {
  return !seen.includes(surface);
}

export function markTourSeen(seen: readonly TourSurface[], surface: TourSurface): TourSurface[] {
  return seen.includes(surface) ? [...seen] : [...seen, surface];
}

/**
 * Which surface a route is the root of, if the tour has one for it. Progress
 * only counts on its overview: the chart and the calendar live there, and a
 * reader who arrived on Records would be shown a tour of things not on screen.
 */
export function resolveTourSurface(route: {
  tab: string;
  screen: string;
  section?: string;
}): TourSurface | null {
  if (route.tab === 'home' && route.screen === 'dashboard') {
    return 'home';
  }
  if (route.tab === 'progress' && route.screen === 'list') {
    return route.section === undefined || route.section === 'overview' ? 'progress' : null;
  }
  if (route.tab === 'profile' && route.screen === 'list') {
    return 'profile';
  }
  return null;
}
