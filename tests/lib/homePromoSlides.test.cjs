const assert = require('node:assert/strict');

const { buildHomePromoSlides } = require('../../.test-dist/lib/homePromoSlides.js');
const { SEASON_JOIN_WINDOW_DAYS } = require('../../.test-dist/lib/seasonEnrolment.js');

const base = { seasons: [], recommendation: null, goalCount: 0, trackedLiftCount: 0 };

const running = {
  season: 'summer',
  state: 'running',
  week: 19,
  weeksLeft: 7,
  progress: 19 / 26,
  daysUntilStart: 0,
  enrolled: false,
  rangeLabel: '1.4.–30.9.2026',
  endLabel: '30.9.',
  startLabel: '1.4.',
  templateId: 'tpl_season_summer_v1',
};

const upcoming = {
  season: 'winter',
  state: 'upcoming',
  week: 0,
  weeksLeft: 26,
  progress: 0,
  daysUntilStart: 30,
  enrolled: false,
  rangeLabel: '1.10.2026–31.3.2027',
  endLabel: '31.3.',
  startLabel: '1.10.',
  templateId: 'tpl_season_winter_v1',
};

module.exports = [
  {
    // Week 19 / 26 is the SEASON's progress, not the reader's points — so the
    // badge's denominator has to be the two numbers beside it, added up, or
    // the card contradicts itself in one line.
    name: 'the running season states its week out of the season it is in',
    run() {
      const slides = buildHomePromoSlides({ ...base, seasons: [running] });
      assert.deepEqual(slides.map((slide) => slide.kind), ['season']);
      assert.equal(slides[0].badgeKey, 'home.promo.season.running');
      assert.equal(slides[0].badgeVars.week, 19);
      assert.equal(slides[0].badgeVars.total, 26);
      assert.equal(slides[0].badgeTone, 'solid');
      assert.equal(slides[0].titleKey, 'season.summer');
      assert.equal(slides[0].subtitle, '1.4.–30.9.2026');
      assert.equal(slides[0].season.endLabel, '30.9.');
    },
  },
  {
    // Joining a season that is already running swaps the programme you are
    // training TODAY, and the swap is explained on the season screen and
    // nowhere else. Neither button on the card may do it.
    name: 'a running season is never signed up for from the card',
    run() {
      for (const enrolled of [false, true]) {
        const [slide] = buildHomePromoSlides({ ...base, seasons: [{ ...running, enrolled }] });
        assert.equal(slide.season.canEnrolHere, false);
        assert.equal(slide.ctaKey, 'home.promo.season.cta');
        assert.equal(slide.secondaryCtaKey, 'home.promo.season.program');
        assert.equal(slide.templateId, running.templateId);
      }
    },
  },
  {
    // Signing up early writes a row and changes nothing else, so one tap is
    // the right cost for it.
    name: 'a season that has not opened is signed up for in one tap',
    run() {
      const [slide] = buildHomePromoSlides({ ...base, seasons: [upcoming] });
      assert.equal(slide.season.canEnrolHere, true);
      assert.equal(slide.ctaKey, 'home.promo.season.enrol');
      assert.equal(slide.secondaryCtaKey, 'home.promo.season.cta');
      assert.equal(slide.badgeKey, 'season.upcoming');
      assert.equal(slide.badgeTone, 'ghost');
    },
  },
  {
    // Once you are in, the card stops selling and starts reporting.
    name: 'a signed-up season says so and stops offering to sign you up',
    run() {
      const [slide] = buildHomePromoSlides({
        ...base,
        seasons: [{ ...upcoming, enrolled: true }],
      });
      assert.equal(slide.season.canEnrolHere, false);
      assert.equal(slide.badgeKey, 'home.promo.season.in');
      assert.equal(slide.badgeTone, 'solid');
      assert.equal(slide.ctaKey, 'home.promo.season.cta');
      assert.equal(slide.secondaryCtaKey, 'home.promo.season.program');
    },
  },
  {
    // The design pins the coming season in the rail permanently. At 148 days
    // out it is a date nobody can act on, in the most valuable strip on the
    // screen — and the button on it would have nothing to do.
    name: 'the next season appears exactly when sign-ups open',
    run() {
      const inWindow = buildHomePromoSlides({
        ...base,
        seasons: [{ ...upcoming, daysUntilStart: SEASON_JOIN_WINDOW_DAYS }],
      });
      assert.deepEqual(inWindow.map((slide) => slide.kind), ['season']);
      assert.equal(inWindow[0].season.daysUntilStart, SEASON_JOIN_WINDOW_DAYS);

      const tooEarly = buildHomePromoSlides({
        ...base,
        seasons: [{ ...upcoming, daysUntilStart: SEASON_JOIN_WINDOW_DAYS + 1 }],
      });
      assert.deepEqual(tooEarly, []);
    },
  },
  {
    // A season card is a countdown, not a scoreboard, so it stays after you
    // sign up — but a season with nothing left to score in is over, and the
    // calendar has already moved the other one into place.
    name: 'a spent season leaves the rail',
    run() {
      assert.deepEqual(buildHomePromoSlides({ ...base, seasons: [{ ...running, weeksLeft: 0 }] }), []);
    },
  },
  {
    name: 'the programme slide carries the id the tap opens',
    run() {
      const slides = buildHomePromoSlides({
        ...base,
        recommendation: { templateId: 'tpl_x', title: 'HUGE Amateur' },
      });
      assert.equal(slides[0].kind, 'program');
      assert.equal(slides[0].templateId, 'tpl_x');
      assert.equal(slides[0].title, 'HUGE Amateur');
    },
  },
  {
    // A target is measured from your own best set. With nothing logged the
    // goal sheet can only ask for a number to compare against nothing.
    name: 'a target is offered only with lifts to measure and no target yet',
    run() {
      assert.deepEqual(
        buildHomePromoSlides({ ...base, trackedLiftCount: 3 }).map((slide) => slide.kind),
        ['goal'],
      );
      assert.deepEqual(buildHomePromoSlides({ ...base, trackedLiftCount: 0 }), []);
      assert.deepEqual(buildHomePromoSlides({ ...base, trackedLiftCount: 3, goalCount: 1 }), []);
    },
  },
  {
    name: 'ids are unique, so two season cards can sit in one rail',
    run() {
      const slides = buildHomePromoSlides({
        seasons: [running, upcoming],
        recommendation: { templateId: 'tpl_x', title: 'HUGE Amateur' },
        goalCount: 0,
        trackedLiftCount: 2,
      });
      assert.deepEqual(slides.map((slide) => slide.kind), ['season', 'season', 'program', 'goal']);
      assert.equal(new Set(slides.map((slide) => slide.id)).size, slides.length);
      assert.deepEqual(buildHomePromoSlides(base), []);
    },
  },
  {
    // Every card either names a key or carries a string. One that had neither
    // would render a blank headline on a painted poster.
    name: 'every slide has a headline and a primary action',
    run() {
      const slides = buildHomePromoSlides({
        seasons: [running, upcoming],
        recommendation: { templateId: 'tpl_x', title: 'HUGE Amateur' },
        goalCount: 0,
        trackedLiftCount: 2,
      });
      for (const slide of slides) {
        assert.ok(slide.titleKey || slide.title, `${slide.id} has no headline`);
        assert.ok(slide.ctaKey, `${slide.id} has no action`);
        assert.ok(slide.badgeKey, `${slide.id} has no badge`);
      }
    },
  },
];
