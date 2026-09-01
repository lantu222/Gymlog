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
  {
    /**
     * Progress v2 · 02 — one segmented control, not three that resemble
     * each other.
     *
     * Seg lived inside ProgressScreen and its own comment claimed "every
     * selector in the app goes through this one component". Three did.
     * RecordsScreen had a fourth, hand-built, with a different fill
     * (purpleSoft against surfaceSoft) and its own inner surface — so the two
     * halves of one tab shipped two widgets for one job.
     */
    name: 'progress: every selector on the tab is the shared Seg',
    run() {
      const seg = read('src', 'components', 'Seg.tsx');
      const records = read('src', 'screens', 'RecordsScreen.tsx');

      // It has a home of its own, and both screens come to it.
      assert.match(seg, /export function Seg<T extends string>/);
      assert.match(screen, /import \{ Seg \} from '\.\.\/components\/Seg';/);
      assert.match(records, /import \{ Seg \} from '\.\.\/components\/Seg';/);

      // Nobody re-declares it, and nobody hand-builds one beside it.
      assert.doesNotMatch(screen, /function Seg</, 'ProgressScreen grew its own Seg back');
      assert.doesNotMatch(records, /function Seg</, 'RecordsScreen grew its own Seg back');
      for (const style of ['segment', 'segmentItem', 'segmentText', 'segmentTextOn']) {
        assert.doesNotMatch(
          records,
          // Double backslashes: inside a template literal a single `\b` is a
          // backspace character, not a regex word boundary, so this pattern
          // was searching for `styles.segment` followed by a control code and
          // could never match. The sibling check above had it right.
          new RegExp(`styles\\.${style}[,\\s\\]}]`),
          `RecordsScreen is drawing its own ${style} again`,
        );
      }

      // The records kind switch goes through it, with the same three kinds.
      assert.match(records, /<Seg\s+options=\{KINDS\.map/);
      assert.match(records, /value=\{kind\}/);
      assert.match(records, /onChange=\{setKind\}/);

      // Four selectors on the tab, one component: metric, trend range,
      // measure range, records kind.
      //
      // Counted without a word boundary on purpose: a `` written through
      // a heredoc arrives as a literal backspace, which made this read zero
      // and look like a real failure. Third time in one session.
      const usages = (screen.match(/<Seg/g) ?? []).length + (records.match(/<Seg/g) ?? []).length;
      assert.equal(usages, 4, `expected four Seg call sites on the tab, found ${usages}`);
    },
  },
  {
    /**
     * Progress v2 · 03 — two empty states, one grammar.
     *
     * The brief's rule: "Empty is a dashed box with one mono line — never a
     * full-height card holding the words 'No entries'." A card the size of the
     * thing that is missing advertises the hole.
     *
     * The records card is the deliberate exception and keeps its shape: violet
     * icon, and ONE action in the accent. It is the only empty state on the
     * tab with something for the reader to do.
     */
    name: 'progress: an empty chart is a dashed box, and the records card keeps its one action',
    run() {
      const box = read('src', 'components', 'EmptyBox.tsx');
      const records = read('src', 'screens', 'RecordsScreen.tsx');

      // Dashed, transparent, and mono — the three things the rule is about.
      //
      // Read from the CutSurface call, not the file: /dashed/ file-wide is
      // satisfied by the doc comment that explains the rule, so deleting the
      // prop left the guard green. Same shape as the onDone(null) count and
      // the /trending/i sweep — a guard its own explanation can pass.
      const surface = box.slice(box.indexOf('<CutSurface'), box.indexOf('>', box.indexOf('<CutSurface')));
      assert.ok(surface.length > 40, 'EmptyBox no longer draws a CutSurface');
      // A line of its own, checked without a regex: writing one through a
      // heredoc keeps turning its escapes into real characters.
      assert.ok(
        surface.split('\n').some((line) => line.trim() === 'dashed'),
        'the empty box is not dashed any more',
      );
      assert.match(surface, /fill="transparent"/);
      assert.match(box, /fontFamily: 'JetBrainsMono'/);

      // Both chart empties go through it, and the loose Text they used to be
      // is gone with its style.
      assert.equal(
        (screen.match(/<EmptyBox label=/g) ?? []).length,
        2,
        'a chart is drawing its own empty state again',
      );
      assert.doesNotMatch(screen, /measureChartEmpty/, 'the old centred grey line is back');

      // The records card: violet ornament, accent action, and its ink paired
      // with the fill rather than hardcoded white — theme.highlight is orange
      // on the dark theme, where white is the weaker of the two.
      assert.match(records, /stroke=\{theme\.purple\}/, 'the empty icon lost its violet');
      assert.match(records, /<CutSurface size="lg" fill=\{theme\.highlight\} style=\{styles\.emptyCta\}>/);
      // Scoped to the CTA's own style block. File-wide this caught the NEW
      // tag, which is white on theme.purple and correct — the brief keeps it
      // as "the violet tag the sheets already use".
      const cta = records.slice(records.indexOf('  emptyCtaText: {'));
      assert.match(cta.slice(0, 400), /color: theme\.onHighlight,/);
      assert.doesNotMatch(cta.slice(0, 400), /color: '#FFFFFF'/, 'the CTA ink is hardcoded again');
      assert.equal(
        (records.match(/styles\.emptyCta[,\s\]}]/g) ?? []).length,
        1,
        'the empty records card grew a second action',
      );
    },
  },
  {
    /**
     * Tracked is the targets (user, 2026-09-01: "tracked sama kuin tavoite ja
     * vaik ne liikkeet joita voi tavoitteeksi asettaa").
     *
     * The section listed every lift with a log in it, behind a search field
     * and five filter chips. It is the ten a target can be set on now — the
     * ones you aim at and the ones you could — fed by the SAME list the target
     * flow offers, so the two cannot drift.
     *
     * Nothing became unreachable: Records still lists every logged lift and
     * still opens its set log. That is the half worth guarding, because it is
     * the half a narrowing usually breaks.
     */
    name: 'progress: the tracked section is the target lifts, and nothing else lost its page',
    run() {
      const app = read('App.tsx');
      const tab = read('src', 'app', 'renderProgressTab.tsx');

      // One source, shared with the flow.
      assert.match(app, /targetLifts: goalFlowLifts,/);
      assert.match(tab, /targetLifts=\{targetLifts\}/);
      assert.match(screen, /const trackedRows = useMemo/);
      assert.match(screen, /targetLifts\.map\(\(lift\) => \(\{/);

      // A lift with no target still gets a row, and the row does something.
      assert.match(screen, /onPress=\{\(\) => onSetTarget\?\.\(lift\.exerciseName\)\}/);
      assert.match(tab, /onSetTarget=\{\(\) => navigate\(\{ tab: 'workout', screen: 'goalFlow' \}\)\}/);

      // The long list's controls went with the long list: a search box over
      // ten fixed rows, and five always-on chips for a list you can see at
      // once, are controls for a problem the section no longer has.
      for (const gone of ['progressQuery', 'PROGRESS_FILTERS', 'filteredSummaries', 'styles.searchShell']) {
        assert.ok(!screen.includes(gone), `${gone} came back`);
      }

      // And the escape hatch. Records is where every other lift lives.
      const records = read('src', 'screens', 'RecordsScreen.tsx');
      assert.match(records, /onOpenExercise/);
      assert.match(screen, /onOpenExercise=\{\(key\) => setSetLogKey\(key\)\}/);
    },
  },
];
