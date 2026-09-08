const assert = require('node:assert/strict');

const tour = require('../../.test-dist/lib/firstRunTour');

/**
 * The first-run tour's rules, tested where they are decided.
 *
 * The design build got two of these wrong in ways only a number shows: it
 * measured its ring 400 ms into a smooth scroll, and it made the bar five
 * stops. Both are settled here, in lib, so the overlay only draws.
 */
module.exports = [
  {
    name: 'firstRunTour: Home has four section beats and one bar beat, three without a programme',
    run() {
      const withProgram = tour.resolveTourBeats('home', { hasProgram: true });
      assert.deepEqual(
        withProgram.map((beat) => (beat.kind === 'section' ? beat.target : 'bar')),
        ['home.week', 'home.hero', 'home.program', 'home.cards', 'bar'],
      );
      const withoutProgram = tour.resolveTourBeats('home', { hasProgram: false });
      assert.deepEqual(
        withoutProgram.map((beat) => (beat.kind === 'section' ? beat.target : 'bar')),
        ['home.week', 'home.hero', 'home.cards', 'bar'],
      );
      // The two beats the brief cut stay cut: the lifts and the quick rows.
      for (const beat of withProgram) {
        if (beat.kind === 'section') {
          assert.doesNotMatch(beat.target, /lifts|quick|empty|cardio/);
        }
      }
    },
  },
  {
    name: 'firstRunTour: the bar is ONE beat that sweeps all five items in order',
    run() {
      const beats = tour.resolveTourBeats('home', { hasProgram: true });
      const barBeats = beats.filter((beat) => beat.kind === 'bar');
      assert.equal(barBeats.length, 1);
      assert.deepEqual([...barBeats[0].stops], ['home', 'programs', 'ai', 'progress', 'profile']);
      for (const stop of barBeats[0].stops) {
        assert.equal(typeof tour.TOUR_BAR_STOP_COPY_KEY[stop], 'string');
      }
    },
  },
  {
    name: 'firstRunTour: Progress and Profile are two beats each, and the bar is not among them',
    run() {
      for (const surface of ['progress', 'profile']) {
        const beats = tour.resolveTourBeats(surface, { hasProgram: true });
        assert.equal(beats.length, 2, surface);
        assert.ok(beats.every((beat) => beat.kind === 'section'), surface);
      }
    },
  },
  {
    name: 'firstRunTour: the tour starts after the last Home section has settled',
    run() {
      // HomeScreen RISE_DELAYS_MS ends at 600 and each rise is 500 ms.
      assert.ok(tour.TOUR_START_AFTER_UNFOLD_MS >= 600 + 500);
      assert.ok(tour.TOUR_START_AFTER_UNFOLD_MS < 2000, 'not so late the page feels dead');
      assert.equal(tour.tourStartDelayMs(false), tour.TOUR_START_AFTER_UNFOLD_MS);
      assert.ok(tour.tourStartDelayMs(true) < 100, 'reduced motion has no unfold to wait for');
      assert.ok(tour.SCROLL_SETTLE_MS >= 400, 'the ring is measured after the scroll, not during it');
    },
  },
  {
    name: 'firstRunTour: the callout sits below when it fits and flips above when it does not',
    run() {
      const screen = { screenHeight: 800, barTop: 720, calloutHeight: 120 };
      const high = tour.placeCallout({ ...screen, target: { x: 20, y: 100, width: 350, height: 60 }, prefer: 'below' });
      assert.equal(high.above, false);
      assert.equal(high.top, 100 + 60 + tour.CALLOUT_GAP);

      // A target near the bar: below would cross the 24 dp floor, so it flips.
      const low = tour.placeCallout({ ...screen, target: { x: 20, y: 600, width: 350, height: 80 }, prefer: 'below' });
      assert.equal(low.above, true);
      assert.equal(low.top, 600 - tour.CALLOUT_GAP - 120);

      // Preference honoured when both fit.
      const mid = tour.placeCallout({ ...screen, target: { x: 20, y: 380, width: 350, height: 60 }, prefer: 'above' });
      assert.equal(mid.above, true);
    },
  },
  {
    name: 'firstRunTour: the callout never crosses the gesture-bar floor or the status band',
    run() {
      const tall = tour.placeCallout({
        target: { x: 20, y: 300, width: 350, height: 400 },
        calloutHeight: 160,
        screenHeight: 800,
        barTop: 720,
        prefer: 'below',
      });
      assert.ok(tall.top + 160 <= 720 - tour.GESTURE_BAR_FLOOR, 'stays above the bar with its floor');
      assert.ok(tall.top >= tour.CALLOUT_TOP_MIN);

      const noBar = tour.placeCallout({
        target: { x: 20, y: 700, width: 350, height: 80 },
        calloutHeight: 120,
        screenHeight: 800,
        barTop: null,
        prefer: 'below',
      });
      assert.ok(noBar.top + 120 <= 800 - tour.GESTURE_BAR_FLOOR);
      assert.equal(tour.GESTURE_BAR_FLOOR, 24);
    },
  },
  {
    name: 'firstRunTour: the ring pads a section and is a fixed circle on a bar item, larger on the AI orb',
    run() {
      const section = tour.ringBox({ x: 20, y: 100, width: 300, height: 80 }, 'section');
      assert.deepEqual(section, { x: 13, y: 93, width: 314, height: 94 });
      const tab = tour.ringBox({ x: 100, y: 700, width: 58, height: 64 }, 'bar');
      assert.equal(tab.width, tour.RING_BAR_DIAMETER);
      assert.equal(tab.x + tab.width / 2, 129);
      const ai = tour.ringBox({ x: 100, y: 700, width: 58, height: 64 }, 'bar-ai');
      // The orb's halo is 58; a 50 ring sat inside it in the design build.
      assert.ok(ai.width > 58);
    },
  },
  {
    name: 'firstRunTour: the notch points at the target centre and stays inside the callout',
    run() {
      const width = 352;
      assert.equal(tour.notchOffset({ x: 20, y: 0, width: 200, height: 10 }, 20, width), 100);
      assert.equal(tour.notchOffset({ x: 0, y: 0, width: 4, height: 10 }, 20, width), 18);
      assert.equal(tour.notchOffset({ x: 800, y: 0, width: 4, height: 10 }, 20, width), width - 18);
    },
  },
  {
    name: 'firstRunTour: scrolling lifts a below-target higher than an above-target and never past the top',
    run() {
      assert.equal(tour.scrollOffsetForTarget(0, 500, 'below'), 500 - 132);
      assert.equal(tour.scrollOffsetForTarget(0, 500, 'above'), 500 - 240);
      assert.equal(tour.scrollOffsetForTarget(0, 40, 'below'), 0);
      assert.equal(tour.scrollOffsetForTarget(300, 40, 'below'), 300 + 40 - 132);
    },
  },
  {
    name: 'firstRunTour: stored seen-lists are normalised to known surfaces without duplicates',
    run() {
      assert.deepEqual(tour.normalizeFirstRunToursSeen(undefined), []);
      assert.deepEqual(tour.normalizeFirstRunToursSeen('home'), []);
      assert.deepEqual(tour.normalizeFirstRunToursSeen(['home', 'home', 'garden', 7, 'profile']), ['home', 'profile']);
    },
  },
  {
    name: 'firstRunTour: seen once is seen; replay hands every surface back',
    run() {
      assert.equal(tour.isTourDue([], 'home'), true);
      const seen = tour.markTourSeen([], 'home');
      assert.deepEqual(seen, ['home']);
      assert.deepEqual(tour.markTourSeen(seen, 'home'), ['home']);
      assert.equal(tour.isTourDue(seen, 'home'), false);
      assert.equal(tour.isTourDue(seen, 'progress'), true);
      assert.deepEqual(tour.resetToursSeen(), []);
    },
  },
  {
    name: 'firstRunTour: only a tab root is a tour surface, and Progress only on its overview',
    run() {
      assert.equal(tour.resolveTourSurface({ tab: 'home', screen: 'dashboard' }), 'home');
      assert.equal(tour.resolveTourSurface({ tab: 'home', screen: 'ai_chat' }), null);
      assert.equal(tour.resolveTourSurface({ tab: 'progress', screen: 'list' }), 'progress');
      assert.equal(tour.resolveTourSurface({ tab: 'progress', screen: 'list', section: 'overview' }), 'progress');
      assert.equal(tour.resolveTourSurface({ tab: 'progress', screen: 'list', section: 'records' }), null);
      assert.equal(tour.resolveTourSurface({ tab: 'profile', screen: 'list' }), 'profile');
      assert.equal(tour.resolveTourSurface({ tab: 'profile', screen: 'settings' }), null);
      assert.equal(tour.resolveTourSurface({ tab: 'workout', screen: 'list' }), null);
    },
  },
];
