const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (...segments) => fs.readFileSync(path.join(__dirname, '..', '..', ...segments), 'utf8');
const screen = read('src', 'screens', 'ProgressScreen.tsx');
const i18n = read('src', 'lib', 'i18n.ts');

/**
 * Progress v2 · 01 — the chart is the headline.
 *
 * See docs/design/progress-v2-brief.html. The tab opened on a "Working
 * weight · <lift>" card showing one lift's last load above a chart that
 * answers the same question better, and for a bodyweight lift that load is 0 —
 * progression.ts says so in a comment on latestValue: "reading its weight
 * gives 0 every time". It was photographed on the device reading "0 kg × 15"
 * over a line drawn flat from 0 to 0.
 */

module.exports = [
  {
    name: 'progress trend: the working-weight card is gone, chart and all',
    run() {
      // The card, its values and the styles that drew it.
      assert.doesNotMatch(screen, /heroSummary/, 'the working-weight card is back');
      for (const style of ['heroBlock', 'heroCard', 'heroValue', 'heroSince', 'emptyHeroCard']) {
        assert.doesNotMatch(
          screen,
          new RegExp(`styles\\.${style}\\b`),
          `${style} draws something again`,
        );
      }
      // And the strings only it used. workingWeight stays: the exercise page
      // still labels a real, per-lift number with it.
      assert.doesNotMatch(i18n, /'progress\.heroSince':/);
      assert.doesNotMatch(i18n, /'progress\.noTracked\.body':/);
      assert.match(read('src', 'screens', 'ExerciseDetailScreen.tsx'), /'progress\.workingWeight'/);
    },
  },
  {
    /**
     * What replaced it was already there — which is the point of the removal.
     * The trend card carries the brief's three controls in the brief's order,
     * and the section must not go back to opening on anything else.
     */
    name: 'progress trend: the chart leads, with metric above and range below',
    run() {
      const overview = screen.slice(screen.indexOf('function renderOverview()'));
      const metricAt = overview.indexOf('OVERVIEW_METRICS.map');
      const valueAt = overview.indexOf('overviewChart.valueLabel');
      const rangeAt = overview.indexOf('OVERVIEW_RANGES.map');
      const monthAt = overview.indexOf("'progress.section.thisMonth'");

      assert.ok(metricAt > 0 && valueAt > 0 && rangeAt > 0, 'the trend card lost one of its three controls');
      assert.ok(metricAt < valueAt, 'the metric switch is no longer above the number');
      assert.ok(valueAt < rangeAt, 'the range chips are no longer under the chart');
      assert.ok(rangeAt < monthAt, 'the month block moved above the trend card');

      // Nothing renders before the trend card in the overview: it IS the
      // headline now, not the second thing on the page.
      const cardAt = overview.indexOf("t(language, 'progress.section.trend')");
      assert.ok(cardAt > 0, 'the trend section label is gone');
      assert.ok(
        overview.slice(0, cardAt).indexOf('<View style={styles.card}>') === -1,
        'something is drawing above the trend card again',
      );
    },
  },
  {
    /**
     * The locked ranges keep leading to Pro. A range chip that is locked and
     * inert is a control that lies, and the lock is how the free tier's
     * three-month history cap is stated on this tab.
     */
    name: 'progress trend: a locked range still opens Pro',
    run() {
      // Scoped to the overview. Both assertions passed file-wide while the
      // overview's own lock was deleted, because renderMeasures has a lock of
      // its own — a guard that another section can satisfy.
      const overview = screen.slice(
        screen.indexOf('function renderOverview()'),
        screen.indexOf('function renderRecords()'),
      );
      assert.ok(overview.length > 200, 'renderOverview was renamed — recheck by hand');
      assert.match(overview, /lockedKeys=\{lockedTrendRanges\}/);
      assert.match(overview, /onLockedPress=\{onOpenPremium\}/);
    },
  },
];
