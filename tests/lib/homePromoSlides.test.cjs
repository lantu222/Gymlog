const assert = require('node:assert/strict');

const {
  buildHomePromoSlides,
  UPCOMING_SEASON_ANNOUNCE_DAYS,
} = require('../../.test-dist/lib/homePromoSlides.js');

const base = { seasons: [], recommendation: null, goalCount: 0, trackedLiftCount: 0 };

const running = {
  season: 'summer',
  state: 'running',
  week: 19,
  weeksLeft: 7,
  progress: 19 / 26,
  daysUntilStart: 0,
  joined: false,
  rangeLabel: '1.4.–30.9.2026',
  endLabel: '30.9.',
  startLabel: '1.4.',
  templateId: 'tpl_summer',
};

const upcoming = {
  season: 'winter',
  state: 'upcoming',
  week: 0,
  weeksLeft: 26,
  progress: 0,
  daysUntilStart: 49,
  joined: false,
  rangeLabel: '1.10.2026–31.3.2027',
  endLabel: '31.3.',
  startLabel: '1.10.',
  templateId: 'tpl_winter',
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
    // Joining swaps the reader's active programme and the swap is explained on
    // the season screen and nowhere else. Both buttons open something, so
    // neither can do it from a promo strip by accident.
    name: 'both season buttons open a destination, and both have one',
    run() {
      for (const season of [running, upcoming]) {
        const [slide] = buildHomePromoSlides({ ...base, seasons: [season] });
        assert.equal(slide.ctaKey, 'home.promo.season.cta');
        assert.equal(slide.secondaryCtaKey, 'home.promo.season.program');
        assert.equal(slide.templateId, season.templateId);
      }
    },
  },
  {
    // The design puts the coming season permanently second in the rail. At 148
    // days out it is a fact nobody can act on, in the most valuable strip on
    // the screen.
    name: 'the next season appears only once it is close enough to plan for',
    run() {
      const near = buildHomePromoSlides({
        ...base,
        seasons: [{ ...upcoming, daysUntilStart: UPCOMING_SEASON_ANNOUNCE_DAYS }],
      });
      assert.deepEqual(near.map((slide) => slide.kind), ['season']);
      assert.equal(near[0].badgeKey, 'season.upcoming');
      assert.equal(near[0].badgeTone, 'ghost');
      assert.equal(near[0].season.daysUntilStart, UPCOMING_SEASON_ANNOUNCE_DAYS);

      const far = buildHomePromoSlides({
        ...base,
        seasons: [{ ...upcoming, daysUntilStart: UPCOMING_SEASON_ANNOUNCE_DAYS + 1 }],
      });
      assert.deepEqual(far, []);
    },
  },
  {
    // A season card is a countdown, not a scoreboard, so it stays after
    // joining — but a season with nothing left to score in is over.
    name: 'a joined season still shows; a spent one does not',
    run() {
      assert.equal(
        buildHomePromoSlides({ ...base, seasons: [{ ...running, joined: true }] }).length,
        1,
      );
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
