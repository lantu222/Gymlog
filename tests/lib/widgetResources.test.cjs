const assert = require('node:assert/strict');

/**
 * Cross-checks the widget's generated native side against itself.
 *
 * The widget is the one part of this repo whose real verification costs a
 * prebuild, a Gradle build, an install and a hand-placed widget — about ten
 * minutes per attempt, on a device, because Android will not let anything force
 * a widget to redraw. A missing `R.id.` or a drawable that no longer exists is
 * a compile error found at the end of that ten minutes. This finds it in
 * milliseconds instead.
 *
 * It cannot tell you the layout looks right. That still needs the device.
 */
const { widgetResources, applyWidgetReceivers, PROVIDERS } = require('../../plugins/withHomeWidget.js');
const {
  HOME_WIDGET_PAYLOAD_VERSION,
  HOME_WIDGET_CURRENT_WEEK_INDEX,
  HOME_WIDGET_WEEK_COUNT,
} = require('../../.test-dist/lib/widgetPayload.js');
const { WIDGET_LINK_PREFIX } = require('../../.test-dist/lib/widgetDeepLink.js');

const FILES = widgetResources();
const paths = Object.keys(FILES);

function pathsIn(prefix, suffix = '.xml') {
  return paths.filter((entry) => entry.startsWith(prefix) && entry.endsWith(suffix));
}

function basename(entry) {
  return entry.slice(entry.lastIndexOf('/') + 1).replace(/\.xml$/, '');
}

const layoutPaths = pathsIn('res/layout/');
const realLayouts = layoutPaths.filter((entry) => !entry.includes('_preview'));
const previewLayouts = layoutPaths.filter((entry) => entry.includes('_preview'));
const kotlinPaths = paths.filter((entry) => entry.endsWith('.kt'));
const kotlin = kotlinPaths.map((entry) => FILES[entry]).join('\n');

const drawableNames = new Set(pathsIn('res/drawable/').map(basename));
const layoutNames = new Set(layoutPaths.map(basename));
const definedIds = new Set();
for (const entry of realLayouts) {
  for (const match of FILES[entry].matchAll(/@\+id\/([a-z0-9_]+)/g)) {
    definedIds.add(match[1]);
  }
}

function stringNames(xml) {
  return new Set([...xml.matchAll(/<string name="([a-z0-9_]+)">/g)].map((match) => match[1]));
}
const enStrings = stringNames(FILES['res/values/widget_strings.xml']);
const fiStrings = stringNames(FILES['res/values-fi/widget_strings.xml']);

module.exports = [
  {
    name: 'widgetResources: every R.* the Kotlin names exists as a resource',
    run() {
      const missing = [];
      for (const [, kind, name] of kotlin.matchAll(/R\.(drawable|layout|id|string)\.([a-z0-9_]+)/g)) {
        const known =
          kind === 'drawable'
            ? drawableNames.has(name)
            : kind === 'layout'
              ? layoutNames.has(name)
              : kind === 'id'
                ? definedIds.has(name)
                : enStrings.has(name);
        if (!known) {
          missing.push(`R.${kind}.${name}`);
        }
      }
      assert.deepEqual(missing, [], `Kotlin references resources that are not generated: ${missing.join(', ')}`);
    },
  },
  {
    name: 'widgetResources: every drawable and string a layout names exists',
    run() {
      const missing = [];
      for (const entry of layoutPaths) {
        for (const [, name] of FILES[entry].matchAll(/@drawable\/([a-z0-9_]+)/g)) {
          if (!drawableNames.has(name)) {
            missing.push(`${entry} → @drawable/${name}`);
          }
        }
        for (const [, name] of FILES[entry].matchAll(/@string\/([a-z0-9_]+)/g)) {
          if (!enStrings.has(name)) {
            missing.push(`${entry} → @string/${name}`);
          }
        }
      }
      assert.deepEqual(missing, []);
    },
  },
  {
    name: 'widgetResources: previews borrow ids rather than defining them twice',
    run() {
      // Two layouts may not both define the same id, and the previews are
      // deliberately the same layouts with the text filled in.
      for (const entry of previewLayouts) {
        assert.ok(!FILES[entry].includes('@+id/'), `${entry} defines ids instead of referencing them`);
        for (const [, name] of FILES[entry].matchAll(/@id\/([a-z0-9_]+)/g)) {
          assert.ok(definedIds.has(name), `${entry} references @id/${name}, which no layout defines`);
        }
      }
    },
  },
  {
    name: 'widgetResources: the previews are not blank, which is the bug they fix',
    run() {
      // The picker used to show the app icon because previewImage was the app
      // icon. A preview layout whose text is empty would be worse.
      for (const entry of previewLayouts) {
        // Only what the picker actually shows. A layout carries the slot for
        // every state, and the ones this preview does not use are hidden.
        const texts = FILES[entry]
          .split('<TextView')
          .slice(1)
          .filter((element) => !element.includes('android:visibility="gone"'))
          .map((element) => element.match(/android:text="([^"]*)"/)?.[1] ?? '');
        assert.ok(texts.length > 0, `${entry} has no text at all`);
        assert.ok(
          texts.every((text) => text.length > 0),
          `${entry} still has an empty android:text — the picker would show a blank card`,
        );
        // Every visible word is a resource, so the picker speaks the phone's
        // language rather than whatever was hardcoded here. Date numbers are
        // the exception: they are the same in every language.
        assert.ok(
          texts.every((text) => text.startsWith('@string/') || /^\d{1,2}(\/\d{1,2})?$/.test(text)),
          `${entry} hardcodes copy instead of using @string/`,
        );
      }
    },
  },
  {
    name: 'widgetResources: a preview shows more than one state',
    run() {
      // A preview where every bar is the same colour teaches nothing about what
      // the widget does.
      for (const entry of previewLayouts) {
        const bars = new Set(
          [...FILES[entry].matchAll(/@drawable\/(widget_bar_[a-z0-9_]+)/g)].map((match) => match[1]),
        );
        assert.ok(bars.size >= 3, `${entry} previews only ${bars.size} bar state(s)`);
      }
    },
  },
  {
    name: 'widgetResources: four layouts, two receivers',
    run() {
      assert.deepEqual(
        realLayouts.map(basename).sort(),
        ['home_widget_day', 'home_widget_month', 'home_widget_row', 'home_widget_square'],
      );
      // The four-week grid still exists, but it is not offered in the picker:
      // a 4×4 is a quarter of a home screen. It is what the size ladder draws
      // when either widget is stretched tall.
      assert.equal(PROVIDERS.length, 2);
      assert.ok(
        !PROVIDERS.some((provider) => provider.info.layout === 'home_widget_month'),
        'the four-week grid is back in the widget picker',
      );
      assert.ok(kotlin.includes('R.layout.home_widget_month'), 'nothing can reach the four-week grid');
      for (const provider of PROVIDERS) {
        assert.ok(
          provider.info.maxHeight >= 220,
          `${provider.className} cannot be stretched far enough to reach the four-week grid`,
        );
      }

      for (const provider of PROVIDERS) {
        const info = FILES[`res/xml/${provider.infoFile}.xml`];
        assert.ok(info, `${provider.infoFile}.xml is not generated`);
        // The fix for "the picker only shows the logo".
        assert.match(info, /android:previewLayout="@layout\/[a-z0-9_]+"/);
        assert.ok(enStrings.has(provider.label), `${provider.label} is missing from strings.xml`);
        assert.ok(enStrings.has(provider.description), `${provider.description} is missing from strings.xml`);
        assert.ok(
          kotlin.includes(`class ${provider.className}`),
          `${provider.className} has no Kotlin class`,
        );
      }

      // Every receiver gets its own name and its own preview, or the rows in the
      // picker are indistinguishable.
      assert.equal(new Set(PROVIDERS.map((provider) => provider.label)).size, PROVIDERS.length);
      assert.equal(new Set(PROVIDERS.map((provider) => provider.info.preview)).size, PROVIDERS.length);
    },
  },
  {
    name: 'widgetResources: the 4x2 keeps the class name already pinned to home screens',
    run() {
      // Renaming it would orphan every widget a user has already added.
      assert.ok(PROVIDERS.some((provider) => provider.className === 'HomeWidgetProvider'));
      assert.ok(kotlin.includes('open class HomeWidgetProvider : AppWidgetProvider()'));
    },
  },
  {
    name: 'widgetResources: both palettes exist for every bar state',
    run() {
      for (const theme of ['light', 'dark']) {
        assert.ok(drawableNames.has(`widget_card_${theme}`));
        for (const state of ['done', 'plan', 'off']) {
          assert.ok(drawableNames.has(`widget_bar_${state}_${theme}`), `bar missing: ${state}/${theme}`);
        }
      }
      // One bar drawable per state per theme, and nothing else: a 999dp corner
      // clamps to a pill at any height, so no size needs its own copy.
      assert.equal(drawableNames.size, 8);
    },
  },
  {
    name: 'widgetResources: every size with room for it has the one big number',
    run() {
      // The finding from a phone: every widget the system ships anchors on one
      // clearly-largest element, and ours had four type sizes within 6sp of each
      // other. The 4×1 row is the one size with nowhere to put it.
      for (const entry of realLayouts) {
        const hasHero = FILES[entry].includes('@+id/widget_count"');
        assert.equal(
          hasHero,
          !entry.includes('home_widget_row'),
          `${entry}: hero number ${hasHero ? 'should not be' : 'is not'} here`,
        );
      }
      // And it is genuinely the largest thing on the card.
      const day = FILES['res/layout/home_widget_day.xml'];
      const sizeAfter = (id) =>
        Number(day.slice(day.indexOf(`@+id/${id}"`)).match(/android:textSize="([\d.]+)sp"/)[1]);
      assert.ok(
        sizeAfter('widget_count') > sizeAfter('widget_title'),
        'the workout name is still bigger than the number meant to anchor the card',
      );
      assert.ok(kotlin.includes('R.id.widget_hero'), 'the provider never fills or hides the hero');
    },
  },
  {
    name: 'widgetResources: the card is opaque, because the text cannot afford otherwise',
    run() {
      // A translucent card composites the wallpaper into itself. Measured worst
      // case — a pale wallpaper under the dark palette — put the 9sp faint label
      // at a contrast ratio of 1.59 against WCAG's 3.0 floor for large text.
      // Opaque, that pair is 3.59, which is the app's own dark-theme floor.
      for (const theme of ['light', 'dark']) {
        const fill = FILES[`res/drawable/widget_card_${theme}.xml`].match(/<solid android:color="(#[0-9A-Fa-f]{6,8})"/)[1];
        assert.equal(fill.length, 9, `${theme} card fill should state its alpha`);
        assert.equal(
          parseInt(fill.slice(1, 3), 16),
          0xff,
          `${theme} card is translucent again — re-measure the faint label before trusting it`,
        );
      }
    },
  },
  {
    name: 'widgetResources: the size ladder tests height before width',
    run() {
      // Found by stretching a widget on a home screen: with the width test
      // first, a 2-cell-wide widget stretched tall stayed on the two-week
      // layout and left most of the card empty, and the four-week grid was
      // unreachable from anything but the wide widget.
      const ladder = kotlin.slice(kotlin.indexOf('fun layoutFor'));
      const body = ladder.slice(0, ladder.indexOf('}'));
      assert.ok(
        body.indexOf('home_widget_month') < body.indexOf('home_widget_square'),
        'the width test runs before the height test, so a tall narrow widget never reaches the four-week grid',
      );
    },
  },
  {
    name: 'widgetResources: the 2×2 draws last week and this one, with dates',
    run() {
      // One row of bars left most of a 205dp square empty — the fix that came
      // out of putting it on a home screen.
      const square = FILES['res/layout/home_widget_square.xml'];
      for (const index of [0, 1, 2, 3, 4, 5, 6]) {
        for (const id of [
          `widget_day_label_${index}`,
          `widget_day_date_${index}`,
          `widget_day_bar_${index}`,
          `widget_day_tall_${index}`,
          `widget_prev_date_${index}`,
          `widget_prev_bar_${index}`,
        ]) {
          assert.ok(square.includes(`@+id/${id}"`), `the 2×2 is missing ${id}`);
        }
        // Last week cannot contain today, so it gets no second bar to reveal.
        assert.ok(!square.includes(`@+id/widget_prev_tall_${index}"`));
      }
      assert.ok(kotlin.includes('prevDateIds'), 'the provider never fills last week');
      // Chronological: last week is drawn above the row that can hold today.
      assert.ok(
        square.indexOf('widget_prev_date_0') < square.indexOf('widget_day_date_0'),
        'this week is drawn above last week',
      );
      assert.ok(
        kotlin.includes('CURRENT_WEEK_INDEX - 1'),
        'the provider does not read the week before this one',
      );
    },
  },
  {
    name: 'widgetResources: planned and free are not the same colour in either theme',
    run() {
      // This is the failure that only showed up on a device last time: two pale
      // purples two steps apart are one colour on a 5dp bar.
      for (const theme of ['light', 'dark']) {
        // The card fill carries alpha; the bars do not. Compare the RGB only.
        const rgb = (value) => `#${value.slice(-6).toUpperCase()}`;
        const colorOf = (state) =>
          rgb(FILES[`res/drawable/widget_bar_${state}_${theme}.xml`].match(/android:color="(#[0-9A-Fa-f]{6,8})"/)[1]);
        const [plan, off, done, card] = [
          colorOf('plan'),
          colorOf('off'),
          colorOf('done'),
          rgb(FILES[`res/drawable/widget_card_${theme}.xml`].match(/<solid android:color="(#[0-9A-Fa-f]{6,8})"/)[1]),
        ];
        assert.equal(new Set([plan, off, done, card]).size, 4, `${theme}: a bar state shares a colour`);
      }
    },
  },
  {
    name: 'widgetResources: today has a second bar to reveal, since heights cannot be set',
    run() {
      // RemoteViews cannot change a view's height before Android 12, so the
      // double-height "today" bar has to exist in the layout already.
      for (const index of [0, 1, 2, 3, 4, 5, 6]) {
        assert.ok(definedIds.has(`widget_day_bar_${index}`));
        assert.ok(definedIds.has(`widget_day_tall_${index}`));
        assert.ok(definedIds.has(`widget_axis_${index}`));
      }
      // The month grid only needs one, in the row that contains today.
      for (let cell = 0; cell < HOME_WIDGET_WEEK_COUNT * 7; cell += 1) {
        assert.ok(definedIds.has(`widget_cell_bar_${cell}`), `widget_cell_bar_${cell} missing`);
        assert.ok(definedIds.has(`widget_cell_date_${cell}`), `widget_cell_date_${cell} missing`);
        const inCurrentWeek = Math.floor(cell / 7) === HOME_WIDGET_CURRENT_WEEK_INDEX;
        assert.equal(
          definedIds.has(`widget_cell_tall_${cell}`),
          inCurrentWeek,
          `widget_cell_tall_${cell} should exist only in the current week's row`,
        );
      }
    },
  },
  {
    name: 'widgetResources: the payload contract matches on both sides of the process boundary',
    run() {
      // Nothing can import TypeScript into a launcher process, so these two
      // numbers are copies. A mismatch means the widget silently ignores every
      // payload the app writes.
      assert.ok(kotlin.includes(`PAYLOAD_VERSION = ${HOME_WIDGET_PAYLOAD_VERSION}`));
      assert.ok(kotlin.includes(`CURRENT_WEEK_INDEX = ${HOME_WIDGET_CURRENT_WEEK_INDEX}`));
      assert.ok(kotlin.includes(`WEEK_COUNT = ${HOME_WIDGET_WEEK_COUNT}`));
      assert.ok(kotlin.includes('PAYLOAD_FILE = "vinha-widget.json"'));

      // And the link prefix the widget builds has to be the one the app parses.
      assert.ok(
        kotlin.includes(`LINK_PREFIX = "${WIDGET_LINK_PREFIX}"`),
        `Kotlin does not build ${WIDGET_LINK_PREFIX}`,
      );
    },
  },
  {
    name: 'widgetResources: every key is translated, and the copy the widget owns is small',
    run() {
      assert.deepEqual([...fiStrings].sort(), [...enStrings].sort());
      // The widget owns copy only where no payload can reach it: the picker and
      // a fresh install. Everything else arrives pre-translated.
      assert.ok(enStrings.has('widget_setup'));
      assert.ok(enStrings.has('widget_setup_short'));
      assert.ok(enStrings.size <= 20, `the widget owns ${enStrings.size} strings — that is a translation surface`);
    },
  },
  {
    name: 'widgetResources: an axis letter or a date can never wrap',
    run() {
      // Found on a device: a 2×2 column is about 18dp wide, and Android breaks
      // a word that does not fit across lines, so "MON" rendered as three
      // stacked letters. Every label that lives in a seven-column row is now
      // pinned to one line and given the whole column to sit in.
      for (const entry of layoutPaths) {
        const elements = FILES[entry].split('<TextView').slice(1);
        for (const element of elements) {
          const id = element.match(/android:id="@\+?id\/([a-z0-9_]+)"/)?.[1];
          if (!id || !/^widget_(day_label|axis|cell_date)_\d+$/.test(id)) {
            continue;
          }
          assert.match(element, /android:maxLines="1"/, `${entry} → ${id} may wrap`);
          assert.ok(
            !/android:layout_width="wrap_content"/.test(element),
            `${entry} → ${id} is only as wide as its text, so the column's padding squeezes it`,
          );
        }
      }
    },
  },
  {
    name: 'widgetResources: every generated XML file is well-formed',
    run() {
      // Not pedantry: the layouts are built by string concatenation, and the
      // failure this catches is a duplicate attribute — which aapt rejects, ten
      // minutes into a native build. xml2js comes in with @expo/config-plugins,
      // which this plugin already depends on.
      const xml2js = require('xml2js');
      const parser = new xml2js.Parser();
      for (const entry of paths.filter((name) => name.endsWith('.xml'))) {
        let error = null;
        // Synchronous when the parser has no async option set.
        parser.parseString(FILES[entry], (parseError) => {
          error = parseError;
        });
        assert.equal(error, null, `${entry} is not well-formed XML: ${error && error.message}`);
      }
    },
  },
  {
    name: 'widgetResources: an attribute past the closing bracket is not an attribute',
    run() {
      // Well-formed is not the same as correct. `...dp">${margin}${pad}` parses
      // cleanly and reads right, but everything after the `>` is character
      // data: aapt2 drops it without a word, and the bars lose the gap between
      // them and the one under the date.
      for (const entry of layoutPaths) {
        assert.ok(
          !/>\s*android:/.test(FILES[entry]),
          `${entry} carries android: attributes as text, which never reach the layout`,
        );
      }
      // And the spacing that goes through that path is really in the file.
      const square = FILES['res/layout/home_widget_square.xml'];
      assert.match(square, /android:paddingStart="[\d.]+dp"/);
      assert.match(square, /android:layout_marginTop="[\d.]+dp"/);
    },
  },
  {
    name: 'widgetResources: a manifest built by an older version is brought up to date',
    run() {
      // prebuild merges into the manifest already there, so the interesting
      // case is not the empty one. A tree from before the family had labels
      // still carries the receiver, and skipping it left the picker showing
      // rows with nothing but the app's name on them.
      const application = {
        receiver: [
          { $: { 'android:name': '.HomeWidgetProvider', 'android:exported': 'true' } },
          { $: { 'android:name': '.RetiredWidgetProvider', 'android:exported': 'true' } },
        ],
      };

      applyWidgetReceivers(application);

      const names = application.receiver.map((entry) => entry.$['android:name']);
      assert.deepEqual(names.sort(), PROVIDERS.map((provider) => `.${provider.className}`).sort());
      for (const provider of PROVIDERS) {
        const entry = application.receiver.find((item) => item.$['android:name'] === `.${provider.className}`);
        assert.equal(entry.$['android:label'], `@string/${provider.label}`);
        assert.equal(entry['meta-data'][0].$['android:resource'], `@xml/${provider.infoFile}`);
      }
      // Every row answers to its own name, which is the whole point of a label.
      assert.equal(new Set(application.receiver.map((entry) => entry.$['android:label'])).size, PROVIDERS.length);

      // Running twice is running once — prebuild does.
      applyWidgetReceivers(application);
      assert.equal(application.receiver.length, PROVIDERS.length);
    },
  },
  {
    name: 'widgetResources: nothing the design cut has come back',
    run() {
      const everything = paths.join('\n') + kotlin + layoutPaths.map((entry) => FILES[entry]).join('\n');
      for (const gone of ['widget_cta', 'widget_pill', 'widget_play', 'widget_mark', 'widget_next_meta', 'gradient']) {
        assert.ok(!everything.includes(gone), `${gone} is still in the generated widget`);
      }
    },
  },
];
