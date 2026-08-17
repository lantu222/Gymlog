const fs = require('node:fs');
const path = require('node:path');
const { withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');

/**
 * Recreates the home-screen widget family's native side on every
 * `expo prebuild`.
 *
 * android/ is gitignored in this repo, so every file the widgets need is
 * written from here: two provider metadata files, four layouts, two picker
 * previews, the drawables, two string tables, the Kotlin providers and the
 * manifest receivers.
 *
 * The widgets read a JSON file the app writes (see src/utils/homeWidget.ts).
 * That is the entire data bridge — no broadcast, no shared preferences. In
 * exchange they refresh on Android's own schedule, whose floor is 30 minutes.
 *
 * Everything drawn is a finished string. No dates are formatted and nothing is
 * translated here, because a launcher process has none of the app's context and
 * this is the worst possible place to rediscover that. The exception is the
 * copy for states where no payload exists yet: those live in strings.xml, get
 * translated by the system locale, and are the only words the widget owns.
 *
 * THEMING. The widget cannot read `src/theming.ts` — it is drawn by the
 * launcher, in another process, from RemoteViews. So both palettes are written
 * out as drawables and colour literals below, and the payload carries the
 * *resolved* theme name. The tables below name their source so the two can be
 * diffed by eye.
 *
 * THE FAMILY. Two receivers, because the widget picker lists receivers and a
 * size nobody can find is a size nobody uses:
 *
 *   HomeWidgetProvider  4×2  "Day"   next session + this week
 *   WeekWidgetProvider  2×2  "Week"  two weeks of calendar, nothing else
 *
 * There were three. The 4×4 four-week grid was its own row until it went on a
 * home screen and turned out to be a quarter of it — so the layout stayed and
 * the picker row went. Both receivers pick their layout from the size Android
 * reports, so stretching either one tall still lands on the four-week grid.
 *
 * `HomeWidgetProvider` keeps its class name on purpose: widgets already pinned
 * to a home screen are bound to that component and would otherwise vanish.
 */

const PACKAGE = 'app.vinha';
const PAYLOAD_FILE = 'vinha-widget.json';
/** Must match HOME_WIDGET_PAYLOAD_VERSION in src/lib/widgetPayload.ts. */
const PAYLOAD_VERSION = 3;
/** Must match HOME_WIDGET_CURRENT_WEEK_INDEX in src/lib/widgetPayload.ts. */
const CURRENT_WEEK_INDEX = 2;
const WEEK_COUNT = 4;
/** Must match WIDGET_LINK_SCHEME/HOST in src/lib/widgetDeepLink.ts. */
const LINK_PREFIX = 'vinha://widget/';
/** Android's own floor. Anything smaller is silently rounded up to this. */
const UPDATE_PERIOD_MS = 1800000;

/**
 * Copies of src/lightTheme.ts and src/darkTheme.ts as the widget design resolved
 * them. If a token moves there, move it here too — nothing enforces it, because
 * nothing on this side of the process boundary can import TypeScript.
 *
 * Two values deliberately differ from the app's tokens, both because a 5dp bar
 * is not a card: `barOff` is darker than the app's neutral track (the old value
 * was the card fill's neighbour and vanished into it), and `barPlan` is the full
 * brand violet rather than the pale tint, because the difference between
 * planned and free has to survive at 5dp on an unknown wallpaper.
 */
const LIGHT = {
  card: '#FFFFFF',
  border: '#D8CBEE',
  ink: '#17131F',
  muted: '#5E5670',
  faint: '#8A82A0',
  barOff: '#CFC7DE',
  barPlan: '#6D28D9',
  barDone: '#16A34A',
};

const DARK = {
  card: '#241D45',
  border: '#332A4E',
  ink: '#F4F1FF',
  muted: '#A79FC4',
  faint: '#7C739E',
  barOff: '#3A3363',
  barPlan: '#9B6DFF',
  barDone: '#FF8A4C',
};

const THEMES = [
  ['light', LIGHT],
  ['dark', DARK],
];

/**
 * Per-size geometry, in dp/sp.
 *
 * The design's table was drawn for a 155×140dp square. A real 2×2 cell is about
 * 205×205dp, so a single row of bars sat as a thin band in a mostly empty card —
 * visible only once it was on a home screen. The 2×2 now draws what the 4×4
 * draws, two weeks of it: the same cell (a date over a bar), scaled up. One
 * marking language across the family, and the only things that change with size
 * are how many weeks fit and how big the type is.
 */
const SIZES = {
  // 2×2 — this week and the next, with their dates. No session name: the tap
  // answers "what", the bars answer "whether".
  square: {
    pad: 14,
    box: 16,
    bar: 8,
    tall: 16,
    gap: 5,
    // The design asked for 11sp letters with 0.04 tracking. "WED" — the widest
    // label this app draws — is 22dp at 11sp and clipped even at 9.5sp in the
    // picker's narrow preview card, so this size drops a step and gives up its
    // tracking. Finnish had room either way; English may not render as "MO".
    label: 9,
    labelSpacing: null,
    axisGap: 12,
    date: 11.5,
    dateGap: 4,
    rowGap: 20,
  },
  // 4×1 — one row.
  row: { pad: 12, box: 10, bar: 5, tall: 10, gap: 5, label: 9, labelGap: 5 },
  // 4×2 — the default.
  day: { pad: 16, box: 12, bar: 6, tall: 12, gap: 6, label: 9.5, labelGap: 8 },
  // Four weeks. No longer its own entry in the widget picker — a 4×4 is a
  // quarter of a home screen and nobody picks it — but the size ladder still
  // lands here when either widget is stretched tall.
  month: { pad: 16, box: 10, bar: 5, tall: 10, gap: 6, label: 9.5, date: 11, dateGap: 5 },
};

// ── Provider metadata ──────────────────────────────────────────────────────

/**
 * `previewLayout` is what fixes the picker showing the app icon: the launcher
 * inflates a layout resource instead. It inflates it *statically* — no provider
 * callback runs, so every string in a preview layout is hardcoded. That is why
 * the previews are separate files rather than the real layouts, whose text is
 * empty until the provider fills it.
 *
 * `previewLayout`, `description`, `targetCellWidth/Height` and
 * `maxResizeWidth/Height` are all Android 12+. Older devices ignore them and
 * fall back to `previewImage`, `minWidth` and `minHeight`, which is why those
 * are still here.
 */
function providerInfo({ layout, preview, description, minWidth, minHeight, cells, maxWidth, maxHeight, resize }) {
  return `<?xml version="1.0" encoding="utf-8"?>
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"
    android:initialLayout="@layout/${layout}"
    android:previewLayout="@layout/${preview}"
    android:previewImage="@mipmap/ic_launcher"
    android:description="@string/${description}"
    android:minWidth="${minWidth}dp"
    android:minHeight="${minHeight}dp"
    android:targetCellWidth="${cells[0]}"
    android:targetCellHeight="${cells[1]}"
    android:maxResizeWidth="${maxWidth}dp"
    android:maxResizeHeight="${maxHeight}dp"
    android:resizeMode="${resize}"
    android:widgetCategory="home_screen"
    android:updatePeriodMillis="${UPDATE_PERIOD_MS}" />
`;
}

const PROVIDERS = [
  {
    // The original component. Renaming it would orphan every widget already on
    // a home screen, so the 4×2 keeps the old name whatever its label says.
    className: 'HomeWidgetProvider',
    infoFile: 'home_widget_info',
    label: 'widget_day_name',
    description: 'widget_day_description',
    defaultLayout: 'home_widget_day',
    info: {
      layout: 'home_widget_day',
      preview: 'home_widget_day_preview',
      description: 'widget_day_description',
      minWidth: 250,
      minHeight: 110,
      cells: [4, 2],
      maxWidth: 400,
      // Tall enough to reach the four-week grid, which is what the size ladder
      // draws past 220dp. That is the only way to that layout now.
      maxHeight: 460,
      resize: 'horizontal|vertical',
    },
  },
  {
    className: 'WeekWidgetProvider',
    infoFile: 'week_widget_info',
    label: 'widget_week_name',
    description: 'widget_week_description',
    defaultLayout: 'home_widget_square',
    info: {
      layout: 'home_widget_square',
      preview: 'home_widget_square_preview',
      description: 'widget_week_description',
      minWidth: 140,
      minHeight: 110,
      cells: [2, 2],
      maxWidth: 400,
      maxHeight: 460,
      resize: 'horizontal|vertical',
    },
  },
];

// ── Drawables ──────────────────────────────────────────────────────────────

/** The card: one opaque fill and a hairline. No gradient — the design cut it. */
function cardDrawable(palette) {
  return `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
    <solid android:color="${palette.card}" />
    <corners android:radius="20dp" />
    <stroke android:width="1dp" android:color="${palette.border}" />
</shape>
`;
}

function barDrawable(color, radius) {
  return `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
    <solid android:color="${color}" />
    <corners android:radius="${radius}" />
</shape>
`;
}

const BAR_STATES = ['done', 'plan', 'off'];

function barResourceName(state, theme) {
  return `widget_bar_${state}_${theme}`;
}

function drawables() {
  const files = {};
  for (const [theme, palette] of THEMES) {
    files[`widget_card_${theme}.xml`] = cardDrawable(palette);
    for (const state of BAR_STATES) {
      const color = state === 'done' ? palette.barDone : state === 'plan' ? palette.barPlan : palette.barOff;
      // 999dp clamps to a pill at any height, so one drawable serves every size.
      files[`${barResourceName(state, theme)}.xml`] = barDrawable(color, '999dp');
    }
  }
  return files;
}

// ── Layout building blocks ─────────────────────────────────────────────────

/**
 * One bar. Two ImageViews, not one: "today" is drawn as a double-height bar,
 * and a view's height cannot be changed from RemoteViews before Android 12. So
 * both heights exist in the layout and the provider shows one of them. The
 * bars are ImageViews because RemoteViews accepts a fixed list of view classes
 * and a bare View is not on it.
 */
function barStack(size, idPrefix, index, theme, { sidePadding = 0, marginTop = 0, tall = true } = {}) {
  const off = barResourceName('off', theme);
  const pad = sidePadding
    ? `
                    android:paddingStart="${sidePadding}dp"
                    android:paddingEnd="${sidePadding}dp"`
    : '';
  const margin = marginTop ? `\n                    android:layout_marginTop="${marginTop}dp"` : '';
  // A week with no "today" in it — next week, or a past one — needs no second
  // bar, because nothing there can be double height.
  const tallBar = tall
    ? `
                    <ImageView
                        android:id="@+id/${idPrefix}_tall_${index}"
                        android:layout_width="match_parent"
                        android:layout_height="${size.tall}dp"
                        android:layout_gravity="bottom"
                        android:visibility="gone"
                        android:contentDescription="@null"
                        android:background="@drawable/${off}" />`
    : '';
  return `                <FrameLayout
                    android:layout_width="match_parent"
                    android:layout_height="${size.box}dp">${margin}${pad}
                    <ImageView
                        android:id="@+id/${idPrefix}_bar_${index}"
                        android:layout_width="match_parent"
                        android:layout_height="${size.bar}dp"
                        android:layout_gravity="bottom"
                        android:contentDescription="@null"
                        android:background="@drawable/${off}" />${tallBar}
                </FrameLayout>`;
}

/**
 * One column of the week strip: a bar above its weekday letter.
 *
 * The column itself has no side padding and the letter spans its full width.
 * The gap between bars comes from the bar's own padding instead, because a
 * `wrap_content` letter inside a padded column had barely 13dp to sit in — and
 * Android's answer to a word that does not fit is to break it across lines, so
 * "MON" came out as three stacked letters on the 2×2. Found on a device; no
 * amount of reading the XML would have shown it.
 */
function weekColumn(size, index, theme, { labelText = '' } = {}) {
  const half = size.gap / 2;
  return `            <LinearLayout
                android:layout_width="0dp"
                android:layout_height="wrap_content"
                android:layout_weight="1"
                android:orientation="vertical"
                android:gravity="center_horizontal">
${barStack(size, 'widget_day', index, theme, { sidePadding: half })}
                <TextView
                    android:id="@+id/widget_day_label_${index}"
                    android:layout_width="match_parent"
                    android:layout_height="wrap_content"
                    android:layout_marginTop="${size.labelGap}dp"
                    android:maxLines="1"
                    android:gravity="center_horizontal"
                    android:textSize="${size.label}sp"
                    android:textStyle="bold"${size.labelSpacing === null ? '' : '\n                    android:letterSpacing="0.04"'}
                    android:textColor="${theme === 'light' ? LIGHT.faint : DARK.faint}"
                    android:text="${labelText}" />
            </LinearLayout>`;
}

function weekStrip(size, theme, { id = 'widget_week', width = 'match_parent', marginTop = 0, labels = null } = {}) {
  const columns = [0, 1, 2, 3, 4, 5, 6]
    .map((index) => weekColumn(size, index, theme, { labelText: labels ? labels[index] : '' }))
    .join('\n');
  return `        <LinearLayout
            android:id="@+id/${id}"
            android:layout_width="${width}"
            android:layout_height="wrap_content"${marginTop ? `\n            android:layout_marginTop="${marginTop}dp"` : ''}
            android:orientation="horizontal">
${columns}
        </LinearLayout>`;
}

function root(theme, { orientation = 'vertical', gravity = null, padding, paddingHorizontal = null, children }) {
  const pad = paddingHorizontal
    ? `android:paddingStart="${paddingHorizontal}dp"
    android:paddingEnd="${paddingHorizontal}dp"
    android:paddingTop="${padding}dp"
    android:paddingBottom="${padding}dp"`
    : `android:padding="${padding}dp"`;
  return `<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:id="@+id/widget_root"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:orientation="${orientation}"${gravity ? `\n    android:gravity="${gravity}"` : ''}
    android:background="@drawable/widget_card_${theme}"
    ${pad}>

${children}
</LinearLayout>
`;
}

function textView(id, { size, style = 'bold', color, marginTop = 0, maxLines = 1, allCaps = false, letterSpacing = null, text = '', visibility = null, weight = false, gravity = null }) {
  return `        <TextView
            android:id="@+id/${id}"
            android:layout_width="match_parent"
            android:layout_height="${weight ? '0dp' : 'wrap_content'}"${weight ? '\n            android:layout_weight="1"' : ''}${marginTop ? `\n            android:layout_marginTop="${marginTop}dp"` : ''}
            android:maxLines="${maxLines}"
            android:ellipsize="end"
            android:textSize="${size}sp"${style === 'normal' ? '' : `\n            android:textStyle="${style}"`}${allCaps ? '\n            android:textAllCaps="true"' : ''}${letterSpacing ? `\n            android:letterSpacing="${letterSpacing}"` : ''}${gravity ? `\n            android:gravity="${gravity}"` : ''}${visibility ? `\n            android:visibility="${visibility}"` : ''}
            android:textColor="${color}"
            android:text="${text}" />`;
}

// ── The four layouts ───────────────────────────────────────────────────────

/**
 * One row of a dated calendar: a date over a bar, seven times. The same cell the
 * 4×4 draws, which is why the 2×2 reads as a calendar rather than as a row of
 * coloured marks.
 */
function datedWeekRow(size, theme, { idPrefix, tall, marginTop = 0, dates = null, color }) {
  const half = size.gap / 2;
  const cells = [0, 1, 2, 3, 4, 5, 6]
    .map(
      (index) => `                <LinearLayout
                    android:layout_width="0dp"
                    android:layout_height="wrap_content"
                    android:layout_weight="1"
                    android:orientation="vertical"
                    android:gravity="center_horizontal">
                    <TextView
                        android:id="@+id/${idPrefix}_date_${index}"
                        android:layout_width="match_parent"
                        android:layout_height="wrap_content"
                        android:maxLines="1"
                        android:gravity="center_horizontal"
                        android:textSize="${size.date}sp"
                        android:textColor="${color}"
                        android:text="${dates ? dates[index] : ''}" />
${barStack(size, idPrefix, index, theme, { sidePadding: half, marginTop: size.dateGap, tall })}
                </LinearLayout>`,
    )
    .join('\n');

  return `            <LinearLayout
                android:layout_width="match_parent"
                android:layout_height="wrap_content"${marginTop ? `\n                android:layout_marginTop="${marginTop}dp"` : ''}
                android:orientation="horizontal">
${cells}
            </LinearLayout>`;
}

/**
 * 2×2. The calendar and nothing else — but two weeks of it, with dates, because
 * a 2×2 cell is ~205dp square and a single row of bars left most of the card
 * empty.
 *
 * Last week on top, this week below it with today double-height. Chronological,
 * like the 4×4, and it means the card always has something green in it: a
 * forward-looking pair showed nothing but planned days every Monday, which is
 * true but says less than "you trained three times last week".
 *
 * The session's name is not in this size at all: the tap answers "what", the
 * bars answer "whether".
 */
function squareLayout(theme, { previewLabels = null, previewPrompt = null, previewDates = null } = {}) {
  const size = SIZES.square;
  const ink = theme === 'light' ? LIGHT.ink : DARK.ink;
  const muted = theme === 'light' ? LIGHT.muted : DARK.muted;
  const faint = theme === 'light' ? LIGHT.faint : DARK.faint;

  const prompt = textView('widget_prompt', {
    size: 14,
    color: ink,
    maxLines: 2,
    text: previewPrompt ?? '',
    visibility: previewPrompt ? null : 'gone',
  });

  const axis = [0, 1, 2, 3, 4, 5, 6]
    .map(
      (index) => `                <TextView
                    android:id="@+id/widget_day_label_${index}"
                    android:layout_width="0dp"
                    android:layout_height="wrap_content"
                    android:layout_weight="1"
                    android:maxLines="1"
                    android:gravity="center_horizontal"
                    android:textSize="${size.label}sp"
                    android:textStyle="bold"
                    android:textColor="${faint}"
                    android:text="${previewLabels ? previewLabels[index] : ''}" />`,
    )
    .join('\n');

  const calendar = previewPrompt
    ? ''
    : `
        <LinearLayout
            android:id="@+id/widget_week"
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:orientation="vertical">
            <LinearLayout
                android:layout_width="match_parent"
                android:layout_height="wrap_content"
                android:orientation="horizontal">
${axis}
            </LinearLayout>
${datedWeekRow(size, theme, {
  idPrefix: 'widget_prev',
  tall: false,
  marginTop: size.axisGap,
  dates: previewDates ? previewDates.slice(0, 7) : null,
  color: muted,
})}
${datedWeekRow(size, theme, {
  // `widget_day_*` is the current week in every layout, so it stays the name of
  // the row that can contain today.
  idPrefix: 'widget_day',
  tall: true,
  marginTop: size.rowGap,
  dates: previewDates ? previewDates.slice(7, 14) : null,
  color: muted,
})}
        </LinearLayout>`;

  return root(theme, {
    gravity: 'center_vertical',
    padding: size.pad,
    children: `${prompt}${calendar}`,
  });
}

/** 4×1. When · what on the left, the week on the right. */
function rowLayout(theme, { previewLabels = null, previewWhen = null, previewTitle = null } = {}) {
  const size = SIZES.row;
  const ink = theme === 'light' ? LIGHT.ink : DARK.ink;
  const faint = theme === 'light' ? LIGHT.faint : DARK.faint;
  return `<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:id="@+id/widget_root"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:orientation="horizontal"
    android:gravity="center_vertical"
    android:background="@drawable/widget_card_${theme}"
    android:paddingStart="16dp"
    android:paddingEnd="16dp"
    android:paddingTop="${size.pad}dp"
    android:paddingBottom="${size.pad}dp">

        <LinearLayout
            android:id="@+id/widget_text"
            android:layout_width="0dp"
            android:layout_height="wrap_content"
            android:layout_weight="1"
            android:orientation="vertical">
${textView('widget_when', { size: 9, color: faint, allCaps: true, letterSpacing: '0.12', text: previewWhen ?? '' })}
${textView('widget_title', { size: 14.5, color: ink, text: previewTitle ?? '' })}
        </LinearLayout>

${weekStrip(size, theme, { width: '150dp', labels: previewLabels })}
</LinearLayout>
`;
}

/**
 * 4×2. Three texts: when, what, and the axis. The title takes the slack so the
 * week strip stays pinned to the bottom edge whether the name wraps or not —
 * RemoteViews has no spacer view to push it there.
 */
function dayLayout(theme, { previewLabels = null, previewWhen = null, previewTitle = null } = {}) {
  const size = SIZES.day;
  const ink = theme === 'light' ? LIGHT.ink : DARK.ink;
  const faint = theme === 'light' ? LIGHT.faint : DARK.faint;
  const children = [
    textView('widget_when', { size: 10, color: faint, allCaps: true, letterSpacing: '0.1', text: previewWhen ?? '' }),
    textView('widget_title', { size: 20, color: ink, marginTop: 2, maxLines: 2, weight: true, text: previewTitle ?? '' }),
    // Same slot, smaller type: an instruction is not a workout's name.
    textView('widget_prompt', { size: 17, color: ink, marginTop: 2, maxLines: 2, weight: true, visibility: 'gone' }),
    weekStrip(size, theme, { labels: previewLabels }),
  ].join('\n');
  return root(theme, { padding: size.pad, children });
}

/**
 * 4×4. The same marking language as a four-week grid: two past weeks, this
 * week, next week. Only the current week's row carries a today bar, so only
 * those seven cells need the second ImageView.
 */
function monthLayout(theme, { previewLabels = null, previewTitle = null, previewDates = null } = {}) {
  const size = SIZES.month;
  const ink = theme === 'light' ? LIGHT.ink : DARK.ink;
  const muted = theme === 'light' ? LIGHT.muted : DARK.muted;
  const faint = theme === 'light' ? LIGHT.faint : DARK.faint;
  const half = size.gap / 2;

  const axis = [0, 1, 2, 3, 4, 5, 6]
    .map(
      (index) => `            <TextView
                android:id="@+id/widget_axis_${index}"
                android:layout_width="0dp"
                android:layout_height="wrap_content"
                android:layout_weight="1"
                android:maxLines="1"
                android:gravity="center_horizontal"
                android:textSize="${size.label}sp"
                android:textStyle="bold"
                android:letterSpacing="0.04"
                android:textColor="${faint}"
                android:text="${previewLabels ? previewLabels[index] : ''}" />`,
    )
    .join('\n');

  const rows = Array.from({ length: WEEK_COUNT }, (_, weekIndex) => {
    const cells = Array.from({ length: 7 }, (_, dayIndex) => {
      const cellIndex = weekIndex * 7 + dayIndex;
      const isCurrentWeek = weekIndex === CURRENT_WEEK_INDEX;
      const off = barResourceName('off', theme);
      const date = previewDates ? previewDates[cellIndex] : '';
      const tall = isCurrentWeek
        ? `
                    <ImageView
                        android:id="@+id/widget_cell_tall_${cellIndex}"
                        android:layout_width="match_parent"
                        android:layout_height="${size.tall}dp"
                        android:layout_gravity="bottom"
                        android:visibility="gone"
                        android:contentDescription="@null"
                        android:background="@drawable/${off}" />`
        : '';
      return `                <LinearLayout
                    android:layout_width="0dp"
                    android:layout_height="wrap_content"
                    android:layout_weight="1"
                    android:orientation="vertical"
                    android:gravity="center_horizontal"
                    android:paddingStart="${half}dp"
                    android:paddingEnd="${half}dp">
                    <TextView
                        android:id="@+id/widget_cell_date_${cellIndex}"
                        android:layout_width="match_parent"
                        android:layout_height="wrap_content"
                        android:maxLines="1"
                        android:gravity="center_horizontal"
                        android:textSize="${size.date}sp"
                        android:textColor="${muted}"
                        android:text="${date}" />
                    <FrameLayout
                        android:layout_width="match_parent"
                        android:layout_height="${size.box}dp"
                        android:layout_marginTop="${size.dateGap}dp">
                        <ImageView
                            android:id="@+id/widget_cell_bar_${cellIndex}"
                            android:layout_width="match_parent"
                            android:layout_height="${size.bar}dp"
                            android:layout_gravity="bottom"
                            android:contentDescription="@null"
                            android:background="@drawable/${off}" />${tall}
                    </FrameLayout>
                </LinearLayout>`;
    }).join('\n');

    // Weighted rather than a fixed 24dp gap: a launcher hands out whatever
    // height its grid has, and on a tall screen a 4×4 cell is well over the
    // design's 300dp. With fixed spacing the calendar sat in the top half and
    // left the rest of the card empty. Spreading the rows keeps the design's
    // rhythm at 300dp and fills anything larger.
    return `            <LinearLayout
                android:layout_width="match_parent"
                android:layout_height="0dp"
                android:layout_weight="1"
                android:gravity="center_vertical"
                android:orientation="horizontal">
${cells}
            </LinearLayout>`;
  }).join('\n');

  const children = `${textView('widget_title', { size: 18, color: ink, text: previewTitle ?? '' })}
${textView('widget_prompt', { size: 17, color: ink, maxLines: 2, visibility: 'gone' })}
        <LinearLayout
            android:id="@+id/widget_axis"
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:layout_marginTop="16dp"
            android:orientation="horizontal">
${axis}
        </LinearLayout>

        <LinearLayout
            android:id="@+id/widget_grid"
            android:layout_width="match_parent"
            android:layout_height="0dp"
            android:layout_weight="1"
            android:layout_marginTop="8dp"
            android:orientation="vertical">
${rows}
        </LinearLayout>`;

  return root(theme, { padding: size.pad, children });
}

// ── Picker previews ────────────────────────────────────────────────────────

/**
 * The picker previews. Static by necessity, light palette by choice: the
 * preview is inflated with no provider running, so it cannot know which theme
 * the reader bought, and light is what a fresh install resolves.
 *
 * The example week is Thursday: two done, today planned, one more planned
 * later. It shows three of the four marks in one glance, which is the whole
 * point of a preview.
 */
const PREVIEW_LABELS = Array.from({ length: 7 }, (_, index) => `@string/widget_preview_axis_${index}`);
const PREVIEW_MONTH_STATES = [
  'done', 'off', 'done', 'off', 'off', 'done', 'off',
  'done', 'off', 'done', 'done', 'off', 'done', 'off',
  'done', 'off', 'done', 'plan', 'off', 'plan', 'off',
  'plan', 'off', 'plan', 'plan', 'off', 'plan', 'off',
];
const PREVIEW_MONTH_DATES = [
  '3', '4', '5', '6', '7', '8', '9',
  '10', '11', '12', '13', '14', '15', '16',
  '17', '18', '19', '20', '21', '22', '23',
  '24', '25', '26', '27', '28', '29', '30',
];
/** Which cell the preview calls today. Index 17 = Thursday of the third row. */
const PREVIEW_TODAY_CELL = 17;
const PREVIEW_TODAY_COLUMN = 3;
/** The 2×2 previews the same two weeks the month preview shows above its middle. */
const PREVIEW_PREV_STATES = PREVIEW_MONTH_STATES.slice(7, 14);
const PREVIEW_WEEK_STATES = PREVIEW_MONTH_STATES.slice(14, 21);
const PREVIEW_WEEK_DATES = PREVIEW_MONTH_DATES.slice(7, 21);

/**
 * Paints example states into a generated layout by rewriting the drawable each
 * bar defaults to, and swapping the two visibilities on today's column. Done
 * textually so the preview cannot drift from the layout it previews.
 *
 * `rows` is a list of `{ idPrefix, states, todayIndex }`; a row with no today in
 * it passes -1.
 */
function paintPreview(xml, rows) {
  let out = xml;

  for (const { idPrefix, states, todayIndex } of rows) {
    states.forEach((state, cellIndex) => {
      const drawable = barResourceName(state, 'light');
      for (const id of [`${idPrefix}_bar_${cellIndex}`, `${idPrefix}_tall_${cellIndex}`]) {
        out = out.replace(
          new RegExp(`(android:id="@\\+id/${id}"[\\s\\S]*?android:background="@drawable/)[a-z0-9_]+(")`),
          `$1${drawable}$2`,
        );
      }
    });

    if (todayIndex < 0) {
      continue;
    }

    // Today: hide the short bar and show the tall one.
    out = out.replace(
      new RegExp(`(android:id="@\\+id/${idPrefix}_bar_${todayIndex}"[\\s\\S]*?android:layout_gravity="bottom")`),
      '$1\n                        android:visibility="gone"',
    );
    out = out.replace(
      new RegExp(`(android:id="@\\+id/${idPrefix}_tall_${todayIndex}"[\\s\\S]*?)android:visibility="gone"\\s*\n`, 'm'),
      '$1',
    );
  }

  return out;
}

/**
 * Repaints one element's `textColor`. Rewriting the existing attribute rather
 * than adding one, because two `android:textColor` attributes on one element is
 * an aapt error, not a last-one-wins.
 */
function recolor(xml, id, color) {
  return xml.replace(
    new RegExp(`(android:id="@\\+id/${id}"[\\s\\S]*?android:textColor=")#[0-9A-Fa-f]{6}(")`),
    `$1${color}$2`,
  );
}

function squarePreview() {
  let xml = squareLayout('light', { previewLabels: PREVIEW_LABELS, previewDates: PREVIEW_WEEK_DATES });
  xml = paintPreview(xml, [
    { idPrefix: 'widget_prev', states: PREVIEW_PREV_STATES, todayIndex: -1 },
    { idPrefix: 'widget_day', states: PREVIEW_WEEK_STATES, todayIndex: PREVIEW_TODAY_COLUMN },
  ]);
  xml = recolor(xml, `widget_day_label_${PREVIEW_TODAY_COLUMN}`, LIGHT.ink);
  xml = recolor(xml, `widget_day_date_${PREVIEW_TODAY_COLUMN}`, LIGHT.ink);
  return stripIds(xml);
}

function dayPreview() {
  let xml = dayLayout('light', {
    previewLabels: PREVIEW_LABELS,
    previewWhen: '@string/widget_preview_when',
    previewTitle: '@string/widget_preview_title',
  });
  xml = paintPreview(xml, [
    { idPrefix: 'widget_day', states: PREVIEW_WEEK_STATES, todayIndex: PREVIEW_TODAY_COLUMN },
  ]);
  xml = recolor(xml, `widget_day_label_${PREVIEW_TODAY_COLUMN}`, LIGHT.ink);
  return stripIds(xml);
}

/**
 * Previews reference the same ids as the real layouts, and two layouts may not
 * both *define* an id. `@+id/x` becomes `@id/x` so the previews reuse the
 * definitions instead of fighting over them.
 */
function stripIds(xml) {
  return xml.replace(/@\+id\//g, '@id/');
}

// ── Strings ────────────────────────────────────────────────────────────────

/**
 * The only copy the widget owns. Everything else arrives pre-translated in the
 * payload — but these are the states where there is no payload (a fresh
 * install) or no widget yet (the picker), so they have to live in the APK and
 * follow the system locale.
 */
const STRINGS = {
  en: {
    widget_day_name: 'Vinha · Day',
    widget_day_description: 'Your next session and the week around it.',
    widget_week_name: 'Vinha · Week',
    widget_week_description: 'This week and the next, in one small square.',
    widget_setup: 'Create your first program',
    widget_setup_short: 'Create a program',
    widget_preview_when: 'Today',
    widget_preview_title: 'Upper body A',
    widget_preview_axis: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
  },
  fi: {
    widget_day_name: 'Vinha · Päivä',
    widget_day_description: 'Seuraava treeni ja sen ympärillä oleva viikko.',
    widget_week_name: 'Vinha · Viikko',
    widget_week_description: 'Tämä viikko ja seuraava yhdessä pienessä ruudussa.',
    widget_setup: 'Tee ensimmäinen ohjelma',
    widget_setup_short: 'Tee ohjelma',
    widget_preview_when: 'Tänään',
    widget_preview_title: 'Ylävartalo A',
    widget_preview_axis: ['MA', 'TI', 'KE', 'TO', 'PE', 'LA', 'SU'],
  },
};

/**
 * Android's string parser treats a bare apostrophe as an error, so the copy
 * above uses typographic ones — this only has to cover the XML metacharacters.
 */
function escapeXml(value) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/'/g, '&apos;');
}

function stringsXml(table) {
  const entries = Object.entries(table).flatMap(([name, value]) =>
    Array.isArray(value)
      ? value.map((item, index) => `    <string name="${name}_${index}">${escapeXml(item)}</string>`)
      : [`    <string name="${name}">${escapeXml(value)}</string>`],
  );
  return `<?xml version="1.0" encoding="utf-8"?>
<resources>
${entries.join('\n')}
</resources>
`;
}

// ── Kotlin ─────────────────────────────────────────────────────────────────

function paletteLiteral(name, palette, theme) {
  const bar = (state) => barResourceName(state, theme);
  return `    private val ${name} = Palette(
        card = R.drawable.widget_card_${theme},
        ink = Color.parseColor("${palette.ink}"),
        muted = Color.parseColor("${palette.muted}"),
        faint = Color.parseColor("${palette.faint}"),
        bars = mapOf(
            "done" to R.drawable.${bar('done')},
            "plan" to R.drawable.${bar('plan')},
            "off" to R.drawable.${bar('off')},
        ),
    )`;
}

function idArray(name, count, pattern) {
  const entries = Array.from({ length: count }, (_, index) => `            R.id.${pattern(index)},`).join('\n');
  return `        private val ${name} = intArrayOf(
${entries}
        )`;
}

const BASE_PROVIDER_KT = `package ${PACKAGE}

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.view.View
import android.widget.RemoteViews
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

/**
 * Draws the home-screen widget family from the JSON the app writes to filesDir.
 *
 * Deliberately dumb: it reads finished strings and puts them on TextViews, and
 * reads three state names and puts a drawable behind an ImageView. All dates,
 * translation and pluralisation happened in JS (src/lib/widgetPayload.ts) where
 * they are covered by tests. Generated by plugins/withHomeWidget.js — edit it
 * there, not here, because android/ is regenerated by prebuild.
 *
 * Two decisions are made on this side, and neither is a judgement call:
 * which of the two palettes to paint (the payload says, Pro gate included) and
 * which of the four layouts fits the size Android reports.
 *
 * This class is also the 4×2 receiver. It keeps the name it shipped with,
 * because widgets already pinned to a home screen are bound to this component.
 */
open class HomeWidgetProvider : AppWidgetProvider() {

    /** Every colour and drawable the widget can paint, for one theme. */
    private class Palette(
        val card: Int,
        val ink: Int,
        val muted: Int,
        val faint: Int,
        val bars: Map<String, Int>,
    ) {
        /** Anything unrecognised draws as a free day rather than as nothing. */
        fun bar(state: String?): Int = bars[state] ?: bars["off"] ?: 0
    }

${paletteLiteral('light', LIGHT, 'light')}

${paletteLiteral('dark', DARK, 'dark')}

    /** The layout this receiver draws before Android has reported a size. */
    protected open fun defaultLayout(): Int = R.layout.home_widget_day

    /**
     * Which layout fits. One rule for all three receivers, so stretching any of
     * them lands on the layout built for that shape rather than on a stretched
     * version of the one it started as.
     */
    protected open fun layoutFor(width: Int, height: Int): Int = when {
        width <= 0 || height <= 0 -> defaultLayout()
        // Height decides first, and it has to: with the width test in front, a
        // 2-cell-wide widget stretched tall stayed on the two-week layout and
        // left two thirds of the card empty, and the four-week grid could only
        // be reached from the wide one. Four weeks fit seven columns of dates in
        // 205dp perfectly well.
        height >= 220 -> R.layout.home_widget_month
        height < 100 && width >= 220 -> R.layout.home_widget_row
        width < 220 -> R.layout.home_widget_square
        else -> R.layout.home_widget_day
    }

    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        for (id in ids) {
            render(context, manager, id, optionsOf(manager, id))
        }
    }

    /** Resizing is the only way to change layout, so it has to redraw. */
    override fun onAppWidgetOptionsChanged(
        context: Context,
        manager: AppWidgetManager,
        id: Int,
        newOptions: Bundle?,
    ) {
        render(context, manager, id, newOptions)
    }

    private fun optionsOf(manager: AppWidgetManager, id: Int): Bundle? = try {
        manager.getAppWidgetOptions(id)
    } catch (error: Exception) {
        null
    }

    private fun render(context: Context, manager: AppWidgetManager, id: Int, options: Bundle?) {
        val width = options?.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0) ?: 0
        val height = options?.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 0) ?: 0
        try {
            manager.updateAppWidget(id, buildViews(context, layoutFor(width, height)))
        } catch (error: Exception) {
            // A widget that fails to draw must not take the app's process with
            // it. The next update is 30 minutes away and costs nothing.
        }
    }

    private fun buildViews(context: Context, layoutId: Int): RemoteViews {
        val views = RemoteViews(context.packageName, layoutId)
        val payload = readPayload(context)
        // Light with no payload: that is what a fresh install resolves, and the
        // dark theme is something the reader buys and chooses.
        val palette = if (payload?.optString("theme") == "dark") dark else light

        views.setInt(R.id.widget_root, "setBackgroundResource", palette.card)

        if (payload == null) {
            renderSetup(context, views, layoutId, palette)
            views.setOnClickPendingIntent(R.id.widget_root, launchIntent(context))
            return views
        }

        when (layoutId) {
            R.layout.home_widget_square -> renderSquare(context, views, payload, palette)
            R.layout.home_widget_row -> renderRow(context, views, payload, palette)
            R.layout.home_widget_month -> renderMonth(context, views, payload, palette)
            else -> renderDay(context, views, payload, palette)
        }

        return views
    }

    /**
     * No file yet: the widget was added before the app ever ran. The only words
     * it can use are its own, from the APK, in the system's language.
     */
    private fun renderSetup(context: Context, views: RemoteViews, layoutId: Int, palette: Palette) {
        val squareLayout = layoutId == R.layout.home_widget_square
        val text = context.getString(if (squareLayout) R.string.widget_setup_short else R.string.widget_setup)

        if (squareLayout) {
            views.setViewVisibility(R.id.widget_week, View.GONE)
            views.setViewVisibility(R.id.widget_prompt, View.VISIBLE)
            views.setTextViewText(R.id.widget_prompt, text)
            views.setTextColor(R.id.widget_prompt, palette.ink)
            return
        }

        if (layoutId == R.layout.home_widget_row) {
            views.setViewVisibility(R.id.widget_week, View.GONE)
            views.setTextViewText(R.id.widget_when, "")
            views.setTextViewText(R.id.widget_title, text)
            views.setTextColor(R.id.widget_title, palette.ink)
            return
        }

        if (layoutId == R.layout.home_widget_month) {
            views.setViewVisibility(R.id.widget_axis, View.GONE)
            views.setViewVisibility(R.id.widget_grid, View.GONE)
        } else {
            views.setViewVisibility(R.id.widget_week, View.GONE)
            views.setTextViewText(R.id.widget_when, "")
        }
        views.setViewVisibility(R.id.widget_title, View.GONE)
        views.setViewVisibility(R.id.widget_prompt, View.VISIBLE)
        views.setTextViewText(R.id.widget_prompt, text)
        views.setTextColor(R.id.widget_prompt, palette.ink)
    }

    /**
     * The 2×2: the weekday axis, this week, and next week. Two weeks because one
     * row of bars left most of a 205dp square empty, and dates because that is
     * what makes it read as a calendar.
     */
    private fun renderSquare(context: Context, views: RemoteViews, payload: JSONObject, palette: Palette) {
        val prompt = payload.optBoolean("isPrompt")

        // With no schedule there is no calendar to draw, so the card stops being
        // a calendar and becomes the instruction instead.
        views.setViewVisibility(R.id.widget_prompt, if (prompt) View.VISIBLE else View.GONE)
        views.setViewVisibility(R.id.widget_week, if (prompt) View.GONE else View.VISIBLE)

        if (prompt) {
            views.setTextViewText(R.id.widget_prompt, payload.optString("title"))
            views.setTextColor(R.id.widget_prompt, palette.ink)
        } else {
            val labels = payload.optJSONArray("weekdayLabels")
            val week = currentWeek(payload)
            val previous = payload.optJSONArray("weeks")?.optJSONArray(CURRENT_WEEK_INDEX - 1)

            for (index in 0 until DAY_COUNT) {
                val day = week?.optJSONObject(index)
                val today = day?.optBoolean("isToday") == true
                val drawable = palette.bar(day?.optString("state"))

                views.setTextViewText(dayLabelIds[index], labels?.optString(index) ?: "")
                views.setTextColor(dayLabelIds[index], if (today) palette.ink else palette.faint)
                views.setTextViewText(dayDateIds[index], day?.optString("dateLabel") ?: "")
                views.setTextColor(dayDateIds[index], if (today) palette.ink else palette.muted)
                views.setInt(dayBarIds[index], "setBackgroundResource", drawable)
                views.setInt(dayTallIds[index], "setBackgroundResource", drawable)
                views.setViewVisibility(dayBarIds[index], if (today) View.GONE else View.VISIBLE)
                views.setViewVisibility(dayTallIds[index], if (today) View.VISIBLE else View.GONE)

                // Last week cannot contain today, so it has no tall bar either.
                val before = previous?.optJSONObject(index)
                views.setTextViewText(prevDateIds[index], before?.optString("dateLabel") ?: "")
                views.setTextColor(prevDateIds[index], palette.muted)
                views.setInt(prevBarIds[index], "setBackgroundResource", palette.bar(before?.optString("state")))
            }
        }

        // One target only: a 155dp square with nothing visibly pressable is no
        // place to hide two destinations.
        views.setOnClickPendingIntent(R.id.widget_root, targetIntent(context, payload.optString("cardTarget")))
    }

    private fun renderRow(context: Context, views: RemoteViews, payload: JSONObject, palette: Palette) {
        views.setTextViewText(R.id.widget_when, payload.optString("when"))
        views.setTextColor(R.id.widget_when, palette.faint)
        views.setTextViewText(R.id.widget_title, payload.optString("title"))
        views.setTextColor(R.id.widget_title, palette.ink)
        views.setViewVisibility(R.id.widget_week, View.VISIBLE)
        paintWeek(views, payload, palette)

        views.setOnClickPendingIntent(R.id.widget_text, targetIntent(context, payload.optString("textTarget")))
        views.setOnClickPendingIntent(R.id.widget_week, targetIntent(context, "calendar"))
        // Whatever is left of the card. The two blocks above already offer the
        // workout and the calendar, so the leftover strip goes Home.
        views.setOnClickPendingIntent(R.id.widget_root, targetIntent(context, "home"))
    }

    private fun renderDay(context: Context, views: RemoteViews, payload: JSONObject, palette: Palette) {
        val prompt = payload.optBoolean("isPrompt")

        views.setTextViewText(R.id.widget_when, payload.optString("when"))
        views.setTextColor(R.id.widget_when, palette.faint)
        views.setViewVisibility(R.id.widget_title, if (prompt) View.GONE else View.VISIBLE)
        views.setViewVisibility(R.id.widget_prompt, if (prompt) View.VISIBLE else View.GONE)
        views.setTextViewText(if (prompt) R.id.widget_prompt else R.id.widget_title, payload.optString("title"))
        views.setTextColor(if (prompt) R.id.widget_prompt else R.id.widget_title, palette.ink)

        // The empty week is drawn rather than hidden: an honest empty row says
        // more about a missing rhythm than a blank card does.
        views.setViewVisibility(R.id.widget_week, View.VISIBLE)
        paintWeek(views, payload, palette)

        views.setOnClickPendingIntent(
            R.id.widget_title,
            targetIntent(context, payload.optString("textTarget")),
        )
        views.setOnClickPendingIntent(
            R.id.widget_prompt,
            targetIntent(context, payload.optString("textTarget")),
        )
        views.setOnClickPendingIntent(R.id.widget_when, targetIntent(context, payload.optString("textTarget")))
        views.setOnClickPendingIntent(R.id.widget_week, targetIntent(context, "calendar"))
        // Whatever is left of the card. The two blocks above already offer the
        // workout and the calendar, so the leftover strip goes Home.
        views.setOnClickPendingIntent(R.id.widget_root, targetIntent(context, "home"))
    }

    private fun renderMonth(context: Context, views: RemoteViews, payload: JSONObject, palette: Palette) {
        val prompt = payload.optBoolean("isPrompt")

        views.setViewVisibility(R.id.widget_title, if (prompt) View.GONE else View.VISIBLE)
        views.setViewVisibility(R.id.widget_prompt, if (prompt) View.VISIBLE else View.GONE)
        views.setTextViewText(if (prompt) R.id.widget_prompt else R.id.widget_title, payload.optString("title"))
        views.setTextColor(if (prompt) R.id.widget_prompt else R.id.widget_title, palette.ink)
        views.setViewVisibility(R.id.widget_axis, View.VISIBLE)
        views.setViewVisibility(R.id.widget_grid, View.VISIBLE)

        val labels = payload.optJSONArray("weekdayLabels")
        val todayColumn = todayColumnOf(currentWeek(payload))
        for (index in 0 until DAY_COUNT) {
            views.setTextViewText(axisIds[index], labels?.optString(index) ?: "")
            // Today's letter is the only one in the header that is not muted.
            views.setTextColor(axisIds[index], if (index == todayColumn) palette.ink else palette.faint)
        }

        val weeks = payload.optJSONArray("weeks")
        for (weekIndex in 0 until WEEK_COUNT) {
            val week = weeks?.optJSONArray(weekIndex)
            for (dayIndex in 0 until DAY_COUNT) {
                val cellIndex = weekIndex * DAY_COUNT + dayIndex
                val day = week?.optJSONObject(dayIndex)
                val today = day?.optBoolean("isToday") == true
                val drawable = palette.bar(day?.optString("state"))

                views.setTextViewText(cellDateIds[cellIndex], day?.optString("dateLabel") ?: "")
                // Today's number is the only one that gets the ink colour.
                views.setTextColor(cellDateIds[cellIndex], if (today) palette.ink else palette.muted)
                views.setInt(cellBarIds[cellIndex], "setBackgroundResource", drawable)

                // Only the current week's row has a tall bar to reveal.
                if (weekIndex == CURRENT_WEEK_INDEX) {
                    val tallId = cellTallIds[dayIndex]
                    views.setInt(tallId, "setBackgroundResource", drawable)
                    views.setViewVisibility(tallId, if (today) View.VISIBLE else View.GONE)
                    views.setViewVisibility(cellBarIds[cellIndex], if (today) View.GONE else View.VISIBLE)
                }
            }
        }

        views.setOnClickPendingIntent(R.id.widget_title, targetIntent(context, payload.optString("textTarget")))
        views.setOnClickPendingIntent(R.id.widget_prompt, targetIntent(context, payload.optString("textTarget")))
        views.setOnClickPendingIntent(R.id.widget_axis, targetIntent(context, "calendar"))
        views.setOnClickPendingIntent(R.id.widget_grid, targetIntent(context, "calendar"))
        views.setOnClickPendingIntent(R.id.widget_root, targetIntent(context, "home"))
    }

    /** The current week, for the three sizes that draw one row. */
    private fun paintWeek(views: RemoteViews, payload: JSONObject, palette: Palette) {
        val labels = payload.optJSONArray("weekdayLabels")
        val week = currentWeek(payload)

        for (index in 0 until DAY_COUNT) {
            val day = week?.optJSONObject(index)
            val today = day?.optBoolean("isToday") == true
            val drawable = palette.bar(day?.optString("state"))

            views.setTextViewText(dayLabelIds[index], labels?.optString(index) ?: "")
            views.setTextColor(dayLabelIds[index], if (today) palette.ink else palette.faint)
            views.setInt(dayBarIds[index], "setBackgroundResource", drawable)
            views.setInt(dayTallIds[index], "setBackgroundResource", drawable)
            views.setViewVisibility(dayBarIds[index], if (today) View.GONE else View.VISIBLE)
            views.setViewVisibility(dayTallIds[index], if (today) View.VISIBLE else View.GONE)
        }
    }

    private fun currentWeek(payload: JSONObject): JSONArray? =
        payload.optJSONArray("weeks")?.optJSONArray(CURRENT_WEEK_INDEX)

    /** Which column is today, or -1 when the week does not contain it. */
    private fun todayColumnOf(week: JSONArray?): Int {
        for (index in 0 until DAY_COUNT) {
            if (week?.optJSONObject(index)?.optBoolean("isToday") == true) {
                return index
            }
        }
        return -1
    }

    /**
     * A link back into the app. The slug travels, not a session id: the file
     * this was read from can be half an hour old, and the app resolves what the
     * slug means against live state when it opens.
     */
    private fun targetIntent(context: Context, target: String?): PendingIntent {
        val slug = if (target.isNullOrEmpty()) "home" else target
        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(LINK_PREFIX + slug))
            .setPackage(context.packageName)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)

        // An APK that cannot handle its own scheme would leave a dead tap, so
        // fall back to simply opening the app.
        if (context.packageManager.resolveActivity(intent, 0) == null) {
            return launchIntent(context)
        }

        val flags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        return PendingIntent.getActivity(context, requestCodeFor(slug), intent, flags)
    }

    private fun launchIntent(context: Context): PendingIntent {
        val launch = context.packageManager.getLaunchIntentForPackage(context.packageName)
            ?: Intent(Intent.ACTION_MAIN).setPackage(context.packageName)
        val flags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        return PendingIntent.getActivity(context, 0, launch, flags)
    }

    /** Distinct per destination, so one target's intent cannot replace another's. */
    private fun requestCodeFor(slug: String): Int = when (slug) {
        "session" -> 1
        "calendar" -> 2
        "programs" -> 3
        "schedule" -> 4
        else -> 5
    }

    private fun readPayload(context: Context): JSONObject? {
        return try {
            val file = File(context.filesDir, PAYLOAD_FILE)
            if (!file.exists()) {
                return null
            }
            val parsed = JSONObject(file.readText())
            // A payload from another app version may mean anything; ignore it
            // rather than draw a guess.
            if (parsed.optInt("version", -1) != PAYLOAD_VERSION) null else parsed
        } catch (error: Exception) {
            null
        }
    }

    companion object {
        private const val PAYLOAD_FILE = "${PAYLOAD_FILE}"
        private const val PAYLOAD_VERSION = ${PAYLOAD_VERSION}
        private const val LINK_PREFIX = "${LINK_PREFIX}"
        private const val DAY_COUNT = 7
        private const val WEEK_COUNT = ${WEEK_COUNT}
        private const val CURRENT_WEEK_INDEX = ${CURRENT_WEEK_INDEX}

${idArray('dayLabelIds', 7, (index) => `widget_day_label_${index}`)}

${idArray('dayBarIds', 7, (index) => `widget_day_bar_${index}`)}

${idArray('dayTallIds', 7, (index) => `widget_day_tall_${index}`)}

${idArray('dayDateIds', 7, (index) => `widget_day_date_${index}`)}

${idArray('prevDateIds', 7, (index) => `widget_prev_date_${index}`)}

${idArray('prevBarIds', 7, (index) => `widget_prev_bar_${index}`)}

${idArray('axisIds', 7, (index) => `widget_axis_${index}`)}

${idArray('cellDateIds', 28, (index) => `widget_cell_date_${index}`)}

${idArray('cellBarIds', 28, (index) => `widget_cell_bar_${index}`)}

${idArray('cellTallIds', 7, (index) => `widget_cell_tall_${CURRENT_WEEK_INDEX * 7 + index}`)}
    }
}
`;

/**
 * The other two receivers. They exist to be two more rows in the widget picker
 * — one per question the family answers — and differ only in which layout they
 * start at.
 */
function subclassKt(className, defaultLayout, comment) {
  return `package ${PACKAGE}

/**
 * ${comment}
 *
 * Generated by plugins/withHomeWidget.js. All drawing lives in
 * HomeWidgetProvider; this only says where the size ladder starts.
 */
class ${className} : HomeWidgetProvider() {
    override fun defaultLayout(): Int = R.layout.${defaultLayout}
}
`;
}

// ── Writing it all out ─────────────────────────────────────────────────────

function writeFile(target, contents) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, contents, 'utf8');
}

/** Every generated file, keyed by its path under app/src/main. Exported for tests. */
function widgetResources() {
  const files = {
    'res/layout/home_widget_square.xml': squareLayout('light'),
    'res/layout/home_widget_row.xml': rowLayout('light'),
    'res/layout/home_widget_day.xml': dayLayout('light'),
    'res/layout/home_widget_month.xml': monthLayout('light'),
    'res/layout/home_widget_square_preview.xml': squarePreview(),
    'res/layout/home_widget_day_preview.xml': dayPreview(),
    'res/values/widget_strings.xml': stringsXml(STRINGS.en),
    'res/values-fi/widget_strings.xml': stringsXml(STRINGS.fi),
    [`java/${PACKAGE.split('.').join('/')}/HomeWidgetProvider.kt`]: BASE_PROVIDER_KT,
    [`java/${PACKAGE.split('.').join('/')}/WeekWidgetProvider.kt`]: subclassKt(
      'WeekWidgetProvider',
      'home_widget_square',
      'The 2×2: two weeks of calendar, and nothing else.',
    ),
  };

  for (const provider of PROVIDERS) {
    files[`res/xml/${provider.infoFile}.xml`] = providerInfo(provider.info);
  }
  for (const [name, contents] of Object.entries(drawables())) {
    files[`res/drawable/${name}`] = contents;
  }

  return files;
}

function withHomeWidgetFiles(config) {
  return withDangerousMod(config, [
    'android',
    (config) => {
      const main = path.join(config.modRequest.platformProjectRoot, 'app', 'src', 'main');
      for (const [relativePath, contents] of Object.entries(widgetResources())) {
        writeFile(path.join(main, ...relativePath.split('/')), contents);
      }
      return config;
    },
  ]);
}

function withHomeWidgetReceivers(config) {
  return withAndroidManifest(config, (config) => {
    const application = config.modResults.manifest.application?.[0];
    if (!application) {
      return config;
    }

    const wanted = PROVIDERS.map((provider) => `.${provider.className}`);

    // Prune first. `expo prebuild` merges into an existing manifest rather than
    // rewriting it, so a receiver this plugin used to add stays behind after it
    // is removed here — pointing at an @xml resource that no longer exists,
    // which fails resource linking. Dropping a widget has to be as easy as
    // adding one.
    application.receiver = (application.receiver ?? []).filter((entry) => {
      const name = entry.$?.['android:name'] ?? '';
      const isWidgetReceiver = /WidgetProvider$/.test(name);
      return !isWidgetReceiver || wanted.includes(name);
    });

    for (const provider of PROVIDERS) {
      const name = `.${provider.className}`;
      if (application.receiver.some((entry) => entry.$['android:name'] === name)) {
        continue;
      }

      application.receiver.push({
        $: {
          'android:name': name,
          // The launcher is a different app, so the receiver has to be exported
          // for it to deliver APPWIDGET_UPDATE at all.
          'android:exported': 'true',
          // What the widget picker calls this one.
          'android:label': `@string/${provider.label}`,
        },
        'intent-filter': [
          {
            action: [{ $: { 'android:name': 'android.appwidget.action.APPWIDGET_UPDATE' } }],
          },
        ],
        'meta-data': [
          {
            $: {
              'android:name': 'android.appwidget.provider',
              'android:resource': `@xml/${provider.infoFile}`,
            },
          },
        ],
      });
    }

    return config;
  });
}

module.exports = function withHomeWidget(config) {
  return withHomeWidgetReceivers(withHomeWidgetFiles(config));
};

// Exported so a test can cross-check the generated XML against the Kotlin that
// references it, which is cheaper than a 10-minute native build.
module.exports.widgetResources = widgetResources;
module.exports.PROVIDERS = PROVIDERS;
