const assert = require('node:assert/strict');

const { buildHomePromoSlides } = require('../../.test-dist/lib/homePromoSlides.js');

const base = { season: null, recommendation: null, goalCount: 0, trackedLiftCount: 0 };
const summer = { kind: 'summer', weeksLeft: 7, joined: false };

module.exports = [
  {
    name: 'a running season the reader has not joined is offered',
    run() {
      const slides = buildHomePromoSlides({ ...base, season: summer });
      assert.deepEqual(slides.map((slide) => slide.kind), ['season']);
      assert.equal(slides[0].eyebrowKey, 'home.promo.season.summer');
      assert.equal(slides[0].bodyVars.weeks, 7);
    },
  },
  {
    // The scoreboard lives on the season screen; repeating it here would be a
    // second, worse copy of something the reader already did.
    name: 'a joined season, or one that has run out, is not offered',
    run() {
      assert.deepEqual(buildHomePromoSlides({ ...base, season: { ...summer, joined: true } }), []);
      assert.deepEqual(buildHomePromoSlides({ ...base, season: { ...summer, weeksLeft: 0 } }), []);
      assert.deepEqual(buildHomePromoSlides({ ...base, season: null }), []);
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
    name: 'order is season, programme, target — and an empty state shows nothing',
    run() {
      const slides = buildHomePromoSlides({
        season: summer,
        recommendation: { templateId: 'tpl_x', title: 'HUGE Amateur' },
        goalCount: 0,
        trackedLiftCount: 2,
      });
      assert.deepEqual(slides.map((slide) => slide.kind), ['season', 'program', 'goal']);
      assert.deepEqual(buildHomePromoSlides(base), []);
    },
  },
];
