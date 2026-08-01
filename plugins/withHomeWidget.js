const fs = require('node:fs');
const path = require('node:path');
const { withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');

/**
 * Recreates the home-screen widget's native side on every `expo prebuild`.
 *
 * android/ is gitignored in this repo, so every file the widget needs is
 * written from here: the provider metadata, the layout, its drawables and the
 * Kotlin provider itself, plus the manifest receiver.
 *
 * The widget reads a JSON file the app writes (see src/utils/homeWidget.ts).
 * That is the entire data bridge — no native module, no broadcast, no shared
 * preferences. In exchange the widget refreshes on Android's own schedule,
 * whose floor is 30 minutes.
 *
 * Everything the widget draws is a finished string. No dates are formatted and
 * nothing is translated here, because a launcher process has none of the app's
 * context and this is the worst possible place to rediscover that.
 *
 * THEMING. The widget cannot read `src/theming.ts` — it is drawn by the
 * launcher, in another process, from RemoteViews. So both palettes are written
 * out as drawables and colour literals below, and the payload carries the
 * *resolved* theme name. The values are copies of the app's tokens, which is
 * the one place in this repo where a copied palette value is unavoidable; the
 * table below names its source so the two can be diffed by eye.
 */

const PACKAGE = 'app.vinha';
const PROVIDER_CLASS = 'HomeWidgetProvider';
const PAYLOAD_FILE = 'vinha-widget.json';
const PAYLOAD_VERSION = 2;
/** Android's own floor. Anything smaller is silently rounded up to this. */
const UPDATE_PERIOD_MS = 1800000;

/**
 * Copies of src/lightTheme.ts and src/darkTheme.ts. If a token moves there,
 * move it here too — nothing enforces it, because nothing on this side of the
 * process boundary can import TypeScript.
 */
const LIGHT = {
  cardTop: '#FFFFFF',
  cardBottom: '#FFFFFF',
  border: '#D8CBEE',
  ink: '#17131F',
  muted: '#5E5670',
  faint: '#8A82A0',
  mark: '#6D28D9',
  pillFill: '#F2ECFF',
  pillInk: '#5B21B6',
  // The action accent: green in light, orange in dark — the same split the app
  // makes, so the widget's button and the app's Start button agree.
  accent: '#16A34A',
  onAccent: '#FFFFFF',
  barDone: '#16A34A',
  barToday: '#6D28D9',
  // 'plan' has to be clearly darker than 'off' — the app's pale purpleLight
  // and the neutral track were within a couple of points of each other, so a
  // planned day and a free day read identically on a 5dp bar.
  barPlan: '#C4B5FD',
  barOff: '#EAE4F5',
};

const DARK = {
  cardTop: '#241D45',
  cardBottom: '#1C1636',
  border: '#332A4E',
  ink: '#F4F1FF',
  muted: '#A79FC4',
  faint: '#7C739E',
  mark: '#9B6DFF',
  pillFill: '#2C2350',
  pillInk: '#CDB6FF',
  accent: '#FF8A4C',
  onAccent: '#241203',
  barDone: '#37D08A',
  barToday: '#9B6DFF',
  barPlan: '#5B4A93',
  barOff: '#2A2340',
};

const WIDGET_INFO_XML = `<?xml version="1.0" encoding="utf-8"?>
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"
    android:initialLayout="@layout/home_widget"
    android:minWidth="250dp"
    android:minHeight="110dp"
    android:targetCellWidth="4"
    android:targetCellHeight="2"
    android:previewImage="@mipmap/ic_launcher"
    android:resizeMode="horizontal|vertical"
    android:widgetCategory="home_screen"
    android:updatePeriodMillis="${UPDATE_PERIOD_MS}" />
`;

/** The card itself: a vertical gradient in dark, flat white in light. */
function cardDrawable(palette) {
  return `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
    <gradient
        android:angle="270"
        android:startColor="${palette.cardTop}"
        android:endColor="${palette.cardBottom}" />
    <corners android:radius="24dp" />
    <stroke android:width="1dp" android:color="${palette.border}" />
</shape>
`;
}

function solidDrawable(color, radius) {
  return `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
    <solid android:color="${color}" />
    <corners android:radius="${radius}" />
</shape>
`;
}

/** The play triangle on the Start button. Tinted from Kotlin per theme. */
const PLAY_VECTOR = `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="14dp" android:height="14dp"
    android:viewportWidth="24" android:viewportHeight="24">
    <path android:fillColor="#FFFFFF" android:pathData="M7,4 L20,12 L7,20 Z" />
</vector>
`;

/**
 * One column of the week strip: a bar above its weekday letter.
 *
 * The bar is an ImageView, not a View — RemoteViews only accepts a fixed list
 * of view classes and a bare View is not on it.
 */
function dayCell(index) {
  return `        <LinearLayout
            android:layout_width="0dp"
            android:layout_height="wrap_content"
            android:layout_weight="1"
            android:orientation="vertical"
            android:gravity="center"
            android:paddingStart="3dp"
            android:paddingEnd="3dp">
            <ImageView
                android:id="@+id/widget_day_bar_${index}"
                android:layout_width="match_parent"
                android:layout_height="5dp"
                android:contentDescription="@null"
                android:background="@drawable/widget_bar_off_dark" />
            <TextView
                android:id="@+id/widget_day_label_${index}"
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:layout_marginTop="5dp"
                android:textSize="9sp"
                android:textStyle="bold"
                android:letterSpacing="0.04"
                android:textColor="${DARK.faint}"
                android:text="" />
        </LinearLayout>`;
}

const LAYOUT_XML = `<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:id="@+id/widget_root"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:orientation="vertical"
    android:background="@drawable/widget_card_dark"
    android:padding="16dp">

    <!-- Wordmark + plan name -->
    <LinearLayout
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:orientation="horizontal"
        android:gravity="center_vertical">
        <TextView
            android:id="@+id/widget_mark"
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:textSize="10sp"
            android:textStyle="bold"
            android:letterSpacing="0.16"
            android:textColor="${DARK.mark}"
            android:text="VINHA" />
        <TextView
            android:id="@+id/widget_plan_name"
            android:layout_width="0dp"
            android:layout_height="wrap_content"
            android:layout_weight="1"
            android:layout_marginStart="10dp"
            android:paddingStart="8dp"
            android:paddingEnd="8dp"
            android:paddingTop="3dp"
            android:paddingBottom="3dp"
            android:maxLines="1"
            android:ellipsize="end"
            android:gravity="end"
            android:textSize="9.5sp"
            android:textStyle="bold"
            android:letterSpacing="0.06"
            android:background="@drawable/widget_pill_dark"
            android:textColor="${DARK.pillInk}"
            android:text="" />
    </LinearLayout>

    <TextView
        android:id="@+id/widget_day_line"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:layout_marginTop="11dp"
        android:maxLines="1"
        android:ellipsize="end"
        android:textSize="10sp"
        android:textStyle="bold"
        android:letterSpacing="0.1"
        android:textAllCaps="true"
        android:textColor="${DARK.faint}"
        android:text="" />

    <TextView
        android:id="@+id/widget_next_title"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:layout_marginTop="2dp"
        android:maxLines="1"
        android:ellipsize="end"
        android:textSize="21sp"
        android:textStyle="bold"
        android:textColor="${DARK.ink}"
        android:text="" />

    <TextView
        android:id="@+id/widget_next_meta"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:layout_marginTop="3dp"
        android:maxLines="1"
        android:ellipsize="end"
        android:textSize="11.5sp"
        android:textColor="${DARK.muted}"
        android:text="" />

    <!-- The one thing the widget exists for. -->
    <LinearLayout
        android:id="@+id/widget_cta"
        android:layout_width="match_parent"
        android:layout_height="46dp"
        android:layout_marginTop="13dp"
        android:orientation="horizontal"
        android:gravity="center"
        android:background="@drawable/widget_cta_dark">
        <ImageView
            android:id="@+id/widget_cta_icon"
            android:layout_width="13dp"
            android:layout_height="13dp"
            android:layout_marginEnd="8dp"
            android:contentDescription="@null"
            android:src="@drawable/widget_play" />
        <TextView
            android:id="@+id/widget_cta_label"
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:textSize="14.5sp"
            android:textStyle="bold"
            android:textColor="${DARK.onAccent}"
            android:text="" />
    </LinearLayout>

    <LinearLayout
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:layout_marginTop="14dp"
        android:orientation="horizontal">
${[0, 1, 2, 3, 4, 5, 6].map(dayCell).join('\n')}
    </LinearLayout>
</LinearLayout>
`;

const PROVIDER_KT = `package ${PACKAGE}

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.graphics.Color
import android.widget.RemoteViews
import org.json.JSONObject
import java.io.File

/**
 * Draws the home-screen widget from the JSON the app writes to filesDir.
 *
 * Deliberately dumb: it reads finished strings and puts them on TextViews. All
 * dates, translation and pluralisation happened in JS (src/lib/widgetPayload.ts)
 * where they are covered by tests. Generated by plugins/withHomeWidget.js —
 * edit it there, not here, because android/ is regenerated by prebuild.
 *
 * The one decision made on this side is which of the two palettes to paint,
 * and even that is not decided here: the payload says which theme the app
 * resolved, Pro gate included.
 */
class ${PROVIDER_CLASS} : AppWidgetProvider() {

    /** Every colour the widget can paint, for one theme. */
    private data class Palette(
        val card: Int,
        val pill: Int,
        val cta: Int,
        val ink: Int,
        val muted: Int,
        val faint: Int,
        val mark: Int,
        val pillInk: Int,
        val onAccent: Int,
        val barDone: Int,
        val barToday: Int,
        val barPlan: Int,
        val barOff: Int,
    )

    private val light = Palette(
        card = R.drawable.widget_card_light,
        pill = R.drawable.widget_pill_light,
        cta = R.drawable.widget_cta_light,
        ink = Color.parseColor("${LIGHT.ink}"),
        muted = Color.parseColor("${LIGHT.muted}"),
        faint = Color.parseColor("${LIGHT.faint}"),
        mark = Color.parseColor("${LIGHT.mark}"),
        pillInk = Color.parseColor("${LIGHT.pillInk}"),
        onAccent = Color.parseColor("${LIGHT.onAccent}"),
        barDone = R.drawable.widget_bar_done_light,
        barToday = R.drawable.widget_bar_today_light,
        barPlan = R.drawable.widget_bar_plan_light,
        barOff = R.drawable.widget_bar_off_light,
    )

    private val dark = Palette(
        card = R.drawable.widget_card_dark,
        pill = R.drawable.widget_pill_dark,
        cta = R.drawable.widget_cta_dark,
        ink = Color.parseColor("${DARK.ink}"),
        muted = Color.parseColor("${DARK.muted}"),
        faint = Color.parseColor("${DARK.faint}"),
        mark = Color.parseColor("${DARK.mark}"),
        pillInk = Color.parseColor("${DARK.pillInk}"),
        onAccent = Color.parseColor("${DARK.onAccent}"),
        barDone = R.drawable.widget_bar_done_dark,
        barToday = R.drawable.widget_bar_today_dark,
        barPlan = R.drawable.widget_bar_plan_dark,
        barOff = R.drawable.widget_bar_off_dark,
    )

    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        for (id in ids) {
            manager.updateAppWidget(id, buildViews(context))
        }
    }

    private fun buildViews(context: Context): RemoteViews {
        val views = RemoteViews(context.packageName, R.layout.home_widget)
        val payload = readPayload(context)

        // Dark is the default with no payload: a widget sits on a wallpaper,
        // and a white rectangle is the more intrusive guess of the two.
        val palette = if (payload?.optString("theme") == "light") light else dark
        applyPalette(views, palette)

        // No file yet (fresh install, widget added before the app has run) or
        // unreadable: show a prompt rather than an empty rectangle.
        if (payload == null) {
            views.setTextViewText(R.id.widget_plan_name, "")
            views.setTextViewText(R.id.widget_day_line, "")
            views.setTextViewText(R.id.widget_next_title, context.getString(R.string.app_name))
            views.setTextViewText(R.id.widget_next_meta, "")
            views.setTextViewText(R.id.widget_cta_label, "")
            views.setViewVisibility(R.id.widget_cta, android.view.View.GONE)
            for (index in 0 until DAY_COUNT) {
                views.setTextViewText(labelIds[index], "")
                views.setInt(barIds[index], "setBackgroundResource", palette.barOff)
            }
            applyLaunchIntent(context, views)
            return views
        }

        views.setViewVisibility(R.id.widget_cta, android.view.View.VISIBLE)
        views.setTextViewText(R.id.widget_plan_name, payload.optString("planName").uppercase())
        views.setTextViewText(R.id.widget_next_title, payload.optString("nextTitle"))
        views.setTextViewText(R.id.widget_cta_label, payload.optString("ctaLabel"))

        // The line above the title: "TODAY · THURSDAY" when the payload knows
        // it is today, otherwise the plain "when" it already computed.
        val dayLine = payload.optString("dayLine")
        views.setTextViewText(
            R.id.widget_day_line,
            if (dayLine.isNotEmpty()) dayLine else payload.optString("nextWhen"),
        )
        views.setTextViewText(R.id.widget_next_meta, payload.optString("nextMeta"))

        val days = payload.optJSONArray("days")
        for (index in 0 until DAY_COUNT) {
            val day = days?.optJSONObject(index)
            views.setTextViewText(labelIds[index], day?.optString("label") ?: "")
            views.setInt(
                barIds[index],
                "setBackgroundResource",
                when (day?.optString("state")) {
                    "done" -> palette.barDone
                    "today" -> palette.barToday
                    "plan" -> palette.barPlan
                    else -> palette.barOff
                },
            )
            // Today's letter is the only one that gets the accent treatment.
            views.setTextColor(
                labelIds[index],
                if (day?.optBoolean("isToday") == true) palette.mark else palette.faint,
            )
        }

        applyLaunchIntent(context, views)
        return views
    }

    private fun applyPalette(views: RemoteViews, palette: Palette) {
        views.setInt(R.id.widget_root, "setBackgroundResource", palette.card)
        views.setInt(R.id.widget_plan_name, "setBackgroundResource", palette.pill)
        views.setInt(R.id.widget_cta, "setBackgroundResource", palette.cta)
        views.setTextColor(R.id.widget_mark, palette.mark)
        views.setTextColor(R.id.widget_plan_name, palette.pillInk)
        views.setTextColor(R.id.widget_day_line, palette.faint)
        views.setTextColor(R.id.widget_next_title, palette.ink)
        views.setTextColor(R.id.widget_next_meta, palette.muted)
        views.setTextColor(R.id.widget_cta_label, palette.onAccent)
        // The play glyph ships white; tint it to whatever reads on the accent.
        views.setInt(R.id.widget_cta_icon, "setColorFilter", palette.onAccent)
    }

    private fun applyLaunchIntent(context: Context, views: RemoteViews) {
        val launch = context.packageManager.getLaunchIntentForPackage(context.packageName) ?: return
        val flags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        val pending = PendingIntent.getActivity(context, 0, launch, flags)
        views.setOnClickPendingIntent(R.id.widget_root, pending)
        // The button opens the same place for now. It is a separate target so
        // a deep link can be pointed at it without touching the layout.
        views.setOnClickPendingIntent(R.id.widget_cta, pending)
    }

    private fun readPayload(context: Context): JSONObject? {
        return try {
            val file = File(context.filesDir, PAYLOAD_FILE)
            if (!file.exists()) {
                return null
            }
            val parsed = JSONObject(file.readText())
            // A payload from a newer app version may mean anything; ignore it
            // rather than draw a guess.
            if (parsed.optInt("version", -1) != PAYLOAD_VERSION) null else parsed
        } catch (error: Exception) {
            null
        }
    }

    companion object {
        private const val PAYLOAD_FILE = "${PAYLOAD_FILE}"
        private const val PAYLOAD_VERSION = ${PAYLOAD_VERSION}
        private const val DAY_COUNT = 7

        private val labelIds = intArrayOf(
            R.id.widget_day_label_0,
            R.id.widget_day_label_1,
            R.id.widget_day_label_2,
            R.id.widget_day_label_3,
            R.id.widget_day_label_4,
            R.id.widget_day_label_5,
            R.id.widget_day_label_6,
        )

        private val barIds = intArrayOf(
            R.id.widget_day_bar_0,
            R.id.widget_day_bar_1,
            R.id.widget_day_bar_2,
            R.id.widget_day_bar_3,
            R.id.widget_day_bar_4,
            R.id.widget_day_bar_5,
            R.id.widget_day_bar_6,
        )
    }
}
`;

function writeFile(target, contents) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, contents, 'utf8');
}

/** Every drawable the widget needs, for both palettes. */
function drawables() {
  const files = {
    'widget_play.xml': PLAY_VECTOR,
  };
  for (const [suffix, palette] of [
    ['light', LIGHT],
    ['dark', DARK],
  ]) {
    files[`widget_card_${suffix}.xml`] = cardDrawable(palette);
    files[`widget_pill_${suffix}.xml`] = solidDrawable(palette.pillFill, '999dp');
    files[`widget_cta_${suffix}.xml`] = solidDrawable(palette.accent, '15dp');
    files[`widget_bar_done_${suffix}.xml`] = solidDrawable(palette.barDone, '999dp');
    files[`widget_bar_today_${suffix}.xml`] = solidDrawable(palette.barToday, '999dp');
    files[`widget_bar_plan_${suffix}.xml`] = solidDrawable(palette.barPlan, '999dp');
    files[`widget_bar_off_${suffix}.xml`] = solidDrawable(palette.barOff, '999dp');
  }
  return files;
}

function withHomeWidgetFiles(config) {
  return withDangerousMod(config, [
    'android',
    (config) => {
      const main = path.join(config.modRequest.platformProjectRoot, 'app', 'src', 'main');

      writeFile(path.join(main, 'res', 'xml', 'home_widget_info.xml'), WIDGET_INFO_XML);
      writeFile(path.join(main, 'res', 'layout', 'home_widget.xml'), LAYOUT_XML);
      for (const [name, contents] of Object.entries(drawables())) {
        writeFile(path.join(main, 'res', 'drawable', name), contents);
      }
      writeFile(
        path.join(main, 'java', ...PACKAGE.split('.'), `${PROVIDER_CLASS}.kt`),
        PROVIDER_KT,
      );

      return config;
    },
  ]);
}

function withHomeWidgetReceiver(config) {
  return withAndroidManifest(config, (config) => {
    const application = config.modResults.manifest.application?.[0];
    if (!application) {
      return config;
    }

    application.receiver = application.receiver ?? [];
    const name = `.${PROVIDER_CLASS}`;
    if (application.receiver.some((entry) => entry.$['android:name'] === name)) {
      return config;
    }

    application.receiver.push({
      $: {
        'android:name': name,
        // The launcher is a different app, so the receiver has to be exported
        // for it to deliver APPWIDGET_UPDATE at all.
        'android:exported': 'true',
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
            'android:resource': '@xml/home_widget_info',
          },
        },
      ],
    });

    return config;
  });
}

module.exports = function withHomeWidget(config) {
  return withHomeWidgetReceiver(withHomeWidgetFiles(config));
};
