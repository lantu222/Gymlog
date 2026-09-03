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

      // Five selectors on the tab, one component: metric, trend range,
      // measure range, records kind, and the body-weight range that piece 06
      // added. The count is pinned so a sixth hand-built one fails rather than
      // quietly appearing — it already caught this one.
      //
      // Counted without a word boundary on purpose: a `` written through
      // a heredoc arrives as a literal backspace, which made this read zero
      // and look like a real failure. Third time in one session.
      const usages = (screen.match(/<Seg/g) ?? []).length + (records.match(/<Seg/g) ?? []).length;
      assert.equal(usages, 5, `expected five Seg call sites on the tab, found ${usages}`);
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
      // Counted on the tag, not on `<EmptyBox label=`: one of the two grew a
      // multi-line prop and the narrower pattern stopped seeing it.
      assert.equal(
        (screen.match(/<EmptyBox[\s/>]/g) ?? []).length,
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
  {
    /**
     * Progress v2 · 06 — the body-weight card.
     *
     * Four things: the chart line joins every other chart in violet so the
     * only orange left is Log; the BMI rainbow becomes one track with the
     * healthy band marked once; the BMI Edit pill goes because the height row
     * already opens the same sheet; and the card gets the range chips it never
     * had (reported from the device 1.9.).
     */
    name: 'progress: the weight card is violet, has ranges, and one way to edit BMI',
    run() {
      const chart = read('src', 'components', 'WeightTrendChart.tsx');
      const cards = read('src', 'components', 'WeightBmiCards.tsx');

      // The line is violet. It was theme.highlight, which is orange on the
      // dark theme, so the screen had three orange things claiming emphasis.
      //
      // Checked against the CODE, with comments stripped: the file explains
      // what it stopped using, and a file-wide doesNotMatch failed on its own
      // explanation. Fifth time this session that prose and pattern collided.
      const chartCode = chart.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*/g, '');
      assert.doesNotMatch(chartCode, /theme\.highlight/, 'the weight line is orange again');
      assert.match(chartCode, /stroke=\{theme\.purple\}/);

      // The WHO bands keep their colours. The brief cut them to one track with
      // the healthy band marked; built that way, seen on the device, and
      // reversed by the user the same day (2026-09-02) — the colours carry the
      // reading, and one violet band says "healthy" without saying how far the
      // next one is.
      assert.match(cards, /fill=\{band\.color\}/, 'the bands lost their colours again');
      assert.match(cards, /backgroundColor: band\.color/, 'the dot and the bar disagree');
      // What piece 06 kept: the marker takes a theme token, not the dark
      // literal that was invisible on the dark theme's own near-black card.
      //
      // Only the positive check. A doesNotMatch on the old literal failed on
      // the comment that explains why it went — the sixth time this session a
      // guard and its own prose collided.
      assert.match(cards, /fill=\{theme\.ink\}/);

      // One way to edit. The pill went; the height row kept the pencil AND
      // learned to say that it edits, which its label alone did not.
      assert.equal(
        (cards.match(/onPress=\{onEditBmi\}/g) ?? []).length,
        1,
        'BMI has two editors again',
      );
      assert.match(cards, /accessibilityHint=\{t\(language, 'bmi\.edit'\)\}/);

      // The chips, and the reason they can exist now: 7D stays centred on
      // today, everything longer takes the trailing window every other chart
      // uses. A centred three-month window is half future, which is why the
      // card had no chips at all.
      const weightBranch = screen.slice(
        screen.indexOf('const weightWindowDays = useMemo'),
        screen.indexOf('const weightWindowDays = useMemo') + 1400,
      );
      assert.match(weightBranch, /if \(resolvedMeasureRange === '7d'\) \{/);
      assert.match(weightBranch, /buildWeightWindow\(bodyweightProgress\.entries, nowMs\)/);
      assert.match(weightBranch, /buildValueWindow\(entries, nowMs, days, measureWindowEnd\(/);
      // And the end follows the data: a history shorter than the range anchors
      // the window at the first entry instead of leaving eleven empty weeks in
      // front of it (user, 2026-09-02).
      assert.match(weightBranch, /measureWindowEnd\(first, nowMs, days\)/);
      // The TREND section's bodyweight grid follows the same end: it opened
      // on 5.6 while the weight card opened on the first weigh-in (user
      // 2026-09-03).
      const overviewBranch = screen.slice(
        screen.indexOf('const overviewWeightWindow = useMemo'),
        screen.indexOf('const overviewChart = useMemo'),
      );
      assert.ok(overviewBranch.length > 100, 'the overview window moved — recheck by hand');
      assert.match(overviewBranch, /measureWindowEnd\(first, nowMs, days\),?\s*\)/);

      // And the chips are actually ON the card. The <Seg count in the case
      // above only proves five exist somewhere; a mutation that gutted this
      // one's props left the tag behind and both checks stayed green.
      const weightCard = screen.slice(
        screen.indexOf('<WeightBmiCards'),
        screen.indexOf('{renderMeasureEntries()}'),
      );
      assert.ok(weightCard.length > 200, 'the weight card branch moved — recheck by hand');
      // Handed to the card, not rendered after it. WeightBmiCards draws TWO
      // cards, so appending put the chips under BMI — which is where the
      // device showed them.
      assert.match(weightCard, /rangeSlot=\{/);
      // BETWEEN the two cards, not inside either (user, 2026-09-02). Inside
      // the weight card they sat on its surface and read as the chart's own
      // chrome; between them they read as the axis both cards share.
      const bmiCards = read('src', 'components', 'WeightBmiCards.tsx');
      const slotAt = bmiCards.indexOf('{rangeSlot}');
      const chartAt = bmiCards.indexOf('<WeightTrendChart days={chartDays} />');
      const bmiCardAt = bmiCards.indexOf('<View style={[styles.card, styles.cardFollowing]}');
      assert.ok(slotAt > 0 && chartAt > 0 && bmiCardAt > 0, 'the weight/BMI cards were restructured');
      assert.ok(chartAt < slotAt, 'the chips moved above the weight chart');
      assert.ok(slotAt < bmiCardAt, 'the chips fell below the BMI card again');
      assert.match(weightCard, /options=\{MEASURE_RANGES\.map/);
      assert.match(weightCard, /value=\{resolvedMeasureRange\}/);
      assert.match(weightCard, /onChange=\{setMeasureRange\}/);
      assert.match(weightCard, /lockedKeys=\{lockedMeasureRanges\}/);

      // And the day counts are one rule, not two copies.
      assert.match(
        read('src', 'lib', 'bodyweightCard.ts'),
        /export function measureRangeDays\(/,
      );
      assert.equal(
        (screen.match(/measureRangeDays\(/g) ?? []).length,
        2,
        'the range-to-days rule was copied instead of shared',
      );
    },
  },
  {
    /**
     * Progress v2 · 06 — entries are a list until you press Edit.
     *
     * The brief: "Entries get the History treatment: no × on a resting row."
     * Three rows of numbers you scroll past on the way to the chart, each
     * carrying a delete, is a mis-tap waiting to happen.
     */
    name: 'progress: a weight entry cannot be deleted from a resting row',
    run() {
      assert.match(screen, /const \[entriesEditing, setEntriesEditing\] = useState\(false\);/);
      assert.match(screen, /\{entriesEditing \? \(/, 'the delete draws on every row again');
      assert.match(screen, /setEntriesEditing\(\(value\) => !value\)/);
      // It opens closed: a list first, deletes on request.
      assert.doesNotMatch(screen, /useState\(true\); \/\/ entriesEditing/);
      // The toggle names both states rather than staying "Edit" while editing.
      assert.match(screen, /entriesEditing \? 'plan\.done' : 'plan\.edit'/);
    },
  },
  {
    /**
     * Two calls from the device walkthrough of 2026-09-02.
     */
    name: 'progress: bodyweight leads the metrics, and an entry says when in full',
    run() {
      // Bodyweight first. It is the metric a reader checks between sessions
      // rather than after one, and the only one that moves on a day nothing
      // was logged.
      const metrics = screen.slice(
        screen.indexOf('const OVERVIEW_METRICS'),
        screen.indexOf('const OVERVIEW_RANGES'),
      );
      const at = (key) => metrics.indexOf(`key: '${key}'`);
      assert.ok(at('bodyweight') > 0, 'the bodyweight metric is gone');
      assert.ok(at('bodyweight') < at('volume'), 'bodyweight no longer leads');
      assert.ok(at('volume') < at('duration'), 'volume and duration swapped');

      // A weight entry carries its whole stamp. "Sep 1 / Sep 1" cannot tell
      // two weigh-ins on one day apart, and those are the ones you came to
      // delete.
      assert.match(screen, /styles\.entryDate\}>\{formatSessionDate\(row\.recordedAt, language\)\}/);

      // A day that lifted nothing is not a zero-volume day, it is a day with
      // no volume reading. Plotted as 0 it pinned the line to the axis and
      // made the first real number look like a jump out of nowhere.
      assert.match(
        screen,
        /\.filter\(\(row\) => row\.volume > 0\)/,
        'a session that lifted nothing is a point on the volume chart again',
      );
      assert.match(
        read('src', 'lib', 'format.ts'),
        /export function formatSessionDate[\s\S]{0,320}minute: '2-digit'/,
        'formatSessionDate stopped carrying a time',
      );
    },
  },
  {
    /**
     * Progress v2 · 07 — what you track, and one row for the rest.
     *
     * Ten rows, seven of them empty, was a wall you scrolled past. A measure
     * is yours once you have logged it — and the one you are looking at right
     * now is yours too, or opening a fresh one from the sheet would leave its
     * card above a list that does not mention it.
     */
    name: 'progress: the measure list is what you track, and the rest are one row',
    run() {
      // The split, and both halves of what "tracked" means.
      assert.match(screen, /const tracked = measureModels\.filter\(/);
      assert.match(screen, /item\.values\.length > 0 \|\| item\.key === selectedMeasure/);
      assert.match(screen, /const untracked = measureModels\.filter\(\(item\) => !tracked\.includes\(item\)\)/);
      // The list draws the tracked ones, not every model.
      assert.match(screen, /\[\.\.\.tracked\][\s\S]{0,20}\.sort\(/);
      assert.doesNotMatch(screen, /\[\.\.\.measureModels\]/, 'the wall of ten is back');

      // One row for the rest, opening the kit's own sheet — the same one Home
      // adds a stat card with, not a second picker.
      assert.match(screen, /t\(language, 'progress\.trackAnother'\)/);
      assert.match(screen, /import \{ KitRow, KitSheet \} from '\.\.\/components\/sheetKit';/);
      assert.match(screen, /<KitSheet/);
      assert.match(screen, /untracked\.length \? \(/, 'the add row draws with nothing left to add');

      // And the absence is stated once. The caption went; the dashed box keeps
      // it, because it is where the line will appear.
      assert.doesNotMatch(screen, /'progress\.addFirst'/, 'the card says it twice again');
      assert.doesNotMatch(i18n, /'progress\.addFirst':/);
      assert.match(screen, /model\.values\.length \? 'progress\.noEntriesRange' : 'progress\.noEntriesYet'/);
      assert.match(screen, /model\.values\.length \? \([\s\S]{0,20}<Text style=\{styles\.measureCaption\}/);

      // The section is named for what it holds.
      assert.match(i18n, /'progress\.section\.youTrack':/);
      assert.doesNotMatch(i18n, /'progress\.section\.allMeasures':/);
    },
  },
  {
    /**
     * The brief's first rule: "The calendar was a wall of orange. Logged days
     * are violet — they are a record of what happened, not something to
     * press."
     *
     * Twenty-five orange squares out of thirty read as a screen full of
     * buttons, and not one of them does anything when tapped. The one-mark
     * rule from 2026-08-25 survives — a training day is still the only mark,
     * with no trained/planned split and no legend — only the ink changed.
     */
    name: 'progress: the calendar is a record, not a wall of buttons',
    run() {
      const styles = screen.slice(screen.indexOf('  calendarBubbleTraining: {'));
      const block = styles.slice(0, styles.indexOf('  progressHistoryCard: {'));
      assert.ok(block.length > 80, 'the calendar styles moved — recheck by hand');

      // Nothing in the calendar's own styles takes the pressable accent.
      assert.doesNotMatch(block, /theme\.highlight/, 'the calendar is orange again');
      assert.match(block, /calendarBubbleTraining: \{[^}]*backgroundColor: theme\.purple/);
      assert.match(block, /calendarBubbleToday: \{[^}]*borderColor: theme\.purple/);

      // And the ink follows the fill. onHighlight is the pair for the accent,
      // which is orange on the dark theme — the wrong ink for a violet square.
      assert.doesNotMatch(block, /theme\.onHighlight/);
      assert.match(block, /calendarBubbleTextToday: \{[^}]*color: theme\.purple/);
    },
  },
];
