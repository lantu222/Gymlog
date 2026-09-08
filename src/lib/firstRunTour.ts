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

export type TourSurface = 'home' | 'progress' | 'profile';

export const TOUR_SURFACES: readonly TourSurface[] = ['home', 'progress', 'profile'];

/** Every element a screen or the bar can register for the tour to point at. */
export type TourTargetId =
  | 'home.week'
  | 'home.hero'
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
  /** Which side of the target the callout prefers; the band decides. */
  place: 'above' | 'below';
  /** The dictionary key for the callout's one sentence. */
  copyKey: string;
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
        { kind: 'section', target: 'home.hero', place: 'below', copyKey: 'tour.home.hero' },
      ];
      if (options.hasProgram) {
        beats.push({ kind: 'section', target: 'home.program', place: 'below', copyKey: 'tour.home.program' });
      }
      beats.push({ kind: 'section', target: 'home.cards', place: 'above', copyKey: 'tour.home.cards' });
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

export const TOUR_BAR_STOP_COPY_KEY: Record<TourBarStop, string> = {
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
/** How long the bar sweep rests on each item before moving on. */
export const BAR_SWEEP_STOP_MS = 1800;
/** After a programmatic scroll, the target is measured once this has passed. */
export const SCROLL_SETTLE_MS = 450;

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
  if (prefer === 'above' ? fitsAbove : fitsBelow) {
    isAbove = prefer === 'above';
  } else if (prefer === 'above' ? fitsBelow : fitsAbove) {
    isAbove = prefer !== 'above';
  } else {
    // Neither side fits cleanly; take the one that overlaps the target less.
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

/** The ring's box: padded around a section, a fixed circle on a bar item. */
export function ringBox(target: TourRect, shape: 'section' | 'bar' | 'bar-ai'): TourRect {
  if (shape === 'section') {
    return {
      x: target.x - RING_PAD,
      y: target.y - RING_PAD,
      width: target.width + RING_PAD * 2,
      height: target.height + RING_PAD * 2,
    };
  }
  const d = shape === 'bar-ai' ? RING_BAR_AI_DIAMETER : RING_BAR_DIAMETER;
  return {
    x: target.x + target.width / 2 - d / 2,
    y: target.y + target.height / 2 - d / 2,
    width: d,
    height: d,
  };
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

/** Profile's "show it again": every surface gets its first time back. */
export function resetToursSeen(): TourSurface[] {
  return [];
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
