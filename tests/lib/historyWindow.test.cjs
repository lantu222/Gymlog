const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  FREE_TREND_MONTHS,
  isMeasureRangeLocked,
  isTrendRangeLocked,
  resolveMeasureRange,
  resolveTrendRange,
} = require('../../.test-dist/lib/historyWindow.js');

function read(...segments) {
  return fs.readFileSync(path.join(__dirname, '..', '..', ...segments), 'utf8');
}

module.exports = [
  {
    name: 'historyWindow: three months of trend on free, all of it on Pro',
    run() {
      assert.equal(FREE_TREND_MONTHS, 3);

      assert.equal(isTrendRangeLocked('1m', false), false);
      assert.equal(isTrendRangeLocked('3m', false), false);
      assert.equal(isTrendRangeLocked('6m', false), true);
      assert.equal(isTrendRangeLocked('all', false), true);

      assert.equal(isMeasureRangeLocked('3m', false), false);
      assert.equal(isMeasureRangeLocked('1y', false), true);
      assert.equal(isMeasureRangeLocked('all', false), true);

      for (const range of ['1m', '3m', '6m', 'all']) {
        assert.equal(isTrendRangeLocked(range, true), false, `pro ${range}`);
      }
      for (const range of ['3m', '1y', 'all']) {
        assert.equal(isMeasureRangeLocked(range, true), false, `pro ${range}`);
      }
    },
  },
  {
    name: 'historyWindow: a lapsed entitlement narrows the chart instead of leaving it drawn',
    run() {
      // The selected range is component state and knows nothing about a promo
      // code running out mid-session. Without resolving on render, a six-month
      // chart chosen while Pro was on keeps drawing after it is off.
      assert.equal(resolveTrendRange('all', false), '3m');
      assert.equal(resolveTrendRange('6m', false), '3m');
      assert.equal(resolveMeasureRange('1y', false), '3m');

      // It narrows to the longest free window, not to nothing: losing Pro
      // should cost the long view, not the chart.
      assert.equal(resolveTrendRange('1m', false), '1m');
      assert.equal(resolveTrendRange('all', true), 'all');
      assert.equal(resolveMeasureRange('all', true), 'all');
    },
  },
  {
    name: 'the cap is on the charts, and the Progress screen draws the resolved range',
    run() {
      const progress = read('src', 'screens', 'ProgressScreen.tsx');

      // Every read of the range goes through the resolver. A single raw read
      // is a chart that ignores the entitlement.
      assert.match(progress, /getOverviewRangeStart\(resolvedOverviewRange\)/);
      assert.match(progress, /getMeasurementRangeStart\(resolvedMeasureRange\)/);
      assert.doesNotMatch(progress, /getOverviewRangeStart\(overviewRange\)/);
      assert.doesNotMatch(progress, /getMeasurementRangeStart\(measureRange\)/);

      // Locked options are shown with a lock, not removed: a reader who never
      // learns the long view exists cannot want it.
      assert.match(progress, /lockedKeys=\{lockedTrendRanges\}/);
      assert.match(progress, /lockedKeys=\{lockedMeasureRanges\}/);
      assert.match(progress, /onLockedPress=\{onOpenPremium\}/);
      assert.match(progress, /locked \? onLockedPress\?\.\(\) : onChange\(option\.key\)/);
    },
  },
  {
    name: 'the log stays uncapped, and the table says both things separately',
    run() {
      const premium = read('src', 'screens', 'PremiumScreen.tsx');
      // Two rows. One line cannot carry this distinction, and it is the one
      // the whole free tier rests on.
      assert.match(
        premium,
        /'pro\.v2\.row\.history', free: 'pro\.v2\.val\.allTime', pro: 'pro\.v2\.val\.allTime'/,
      );
      assert.match(
        premium,
        /'pro\.v2\.row\.trends', free: 'pro\.v2\.val\.threeMonths', pro: 'pro\.v2\.val\.allTime'/,
      );
      // Export is what makes "your log is yours" checkable rather than a
      // promise, so it must stay free too.
      assert.match(premium, /'pro\.v2\.row\.csv', free: 'pro\.v2\.val\.yes', pro: 'pro\.v2\.val\.yes'/);

      // History, exercise detail and the session analysis read the log, not a
      // trend window — none of them may start asking about entitlement.
      for (const file of ['HistoryScreen.tsx', 'SessionAnalysisScreen.tsx']) {
        const source = read('src', 'screens', file);
        assert.doesNotMatch(source, /historyWindow|isTrendRangeLocked/, `${file} reads the log`);
      }

      // And the free-tier promise stops implying the charts go back forever
      // while staying exact about what does.
      const i18n = read('src', 'lib', 'i18n.ts');
      const body = i18n.split(String.fromCharCode(10)).filter((line) => line.includes("'pro.v2.free.body':"));
      assert.equal(body.length, 2, 'both languages');
      assert.doesNotMatch(body[0], /full history, forever/);
      assert.doesNotMatch(body[1], /koko historiasi, ikuisesti/);
      assert.match(body[0], /exportable forever/);
      assert.match(body[1], /vietävissä ikuisesti/);
    },
  },
];
