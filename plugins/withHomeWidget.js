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
 */

const PACKAGE = 'com.lantu66.gymlog';
const PROVIDER_CLASS = 'HomeWidgetProvider';
const PAYLOAD_FILE = 'gymlog-widget.json';
/** Android's own floor. Anything smaller is silently rounded up to this. */
const UPDATE_PERIOD_MS = 1800000;

// The app's light palette (src/lightTheme.ts). Kept literal: the widget is
// drawn outside the app and cannot read the theme.
const COLORS = {
  surface: '#FFFFFF',
  bg: '#F7F3FF',
  ink: '#101828',
  muted: '#5B6472',
  faint: '#867E9C',
  border: '#E4D8FF',
  purple: '#7C3AED',
  purpleLight: '#EFE7FF',
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

const CARD_DRAWABLE = `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
    <solid android:color="${COLORS.surface}" />
    <corners android:radius="20dp" />
    <stroke android:width="1dp" android:color="${COLORS.border}" />
</shape>
`;

const DAY_PILL_PLAIN = `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
    <solid android:color="@android:color/transparent" />
    <corners android:radius="999dp" />
</shape>
`;

const DAY_PILL_TRAINING = `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
    <solid android:color="${COLORS.purpleLight}" />
    <corners android:radius="999dp" />
</shape>
`;

const DAY_PILL_TODAY = `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
    <solid android:color="${COLORS.purple}" />
    <corners android:radius="999dp" />
</shape>
`;

/** One column of the week strip: weekday label above a date pill. */
function dayCell(index) {
  return `        <LinearLayout
            android:layout_width="0dp"
            android:layout_height="wrap_content"
            android:layout_weight="1"
            android:orientation="vertical"
            android:gravity="center">
            <TextView
                android:id="@+id/widget_day_label_${index}"
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:textSize="9sp"
                android:textStyle="bold"
                android:textColor="${COLORS.faint}"
                android:text="" />
            <TextView
                android:id="@+id/widget_day_date_${index}"
                android:layout_width="26dp"
                android:layout_height="26dp"
                android:layout_marginTop="3dp"
                android:gravity="center"
                android:textSize="11sp"
                android:textStyle="bold"
                android:textColor="${COLORS.ink}"
                android:background="@drawable/widget_day_plain"
                android:text="" />
        </LinearLayout>`;
}

const LAYOUT_XML = `<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:id="@+id/widget_root"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:orientation="vertical"
    android:background="@drawable/widget_card"
    android:padding="14dp"
    android:gravity="center_vertical">

    <TextView
        android:id="@+id/widget_plan_name"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:maxLines="1"
        android:ellipsize="end"
        android:textSize="10sp"
        android:textStyle="bold"
        android:letterSpacing="0.08"
        android:textColor="${COLORS.faint}"
        android:text="" />

    <LinearLayout
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:layout_marginTop="8dp"
        android:orientation="horizontal">
${[0, 1, 2, 3, 4, 5, 6].map(dayCell).join('\n')}
    </LinearLayout>

    <TextView
        android:id="@+id/widget_next_title"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:layout_marginTop="10dp"
        android:maxLines="1"
        android:ellipsize="end"
        android:textSize="15sp"
        android:textStyle="bold"
        android:textColor="${COLORS.ink}"
        android:text="" />

    <TextView
        android:id="@+id/widget_next_meta"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:layout_marginTop="1dp"
        android:maxLines="1"
        android:ellipsize="end"
        android:textSize="11sp"
        android:textColor="${COLORS.muted}"
        android:text="" />
</LinearLayout>
`;

const PROVIDER_KT = `package ${PACKAGE}

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
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
 */
class ${PROVIDER_CLASS} : AppWidgetProvider() {

    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        for (id in ids) {
            manager.updateAppWidget(id, buildViews(context))
        }
    }

    private fun buildViews(context: Context): RemoteViews {
        val views = RemoteViews(context.packageName, R.layout.home_widget)
        val payload = readPayload(context)

        // No file yet (fresh install, widget added before the app has run) or
        // unreadable: show a prompt rather than an empty rectangle.
        if (payload == null) {
            views.setTextViewText(R.id.widget_plan_name, "")
            views.setTextViewText(R.id.widget_next_title, context.getString(R.string.app_name))
            views.setTextViewText(R.id.widget_next_meta, "")
            applyLaunchIntent(context, views)
            return views
        }

        views.setTextViewText(R.id.widget_plan_name, payload.optString("planName"))
        views.setTextViewText(R.id.widget_next_title, payload.optString("nextTitle"))

        val whenLabel = payload.optString("nextWhen")
        val meta = payload.optString("nextMeta")
        val subtitle = when {
            whenLabel.isNotEmpty() && meta.isNotEmpty() -> whenLabel + " · " + meta
            whenLabel.isNotEmpty() -> whenLabel
            else -> meta
        }
        views.setTextViewText(R.id.widget_next_meta, subtitle)

        val days = payload.optJSONArray("days")
        for (index in 0 until DAY_COUNT) {
            val day = days?.optJSONObject(index)
            views.setTextViewText(labelIds[index], day?.optString("label") ?: "")
            views.setTextViewText(dateIds[index], day?.optString("dateLabel") ?: "")

            val isToday = day?.optBoolean("isToday") ?: false
            val isTraining = day?.optBoolean("isTraining") ?: false
            views.setInt(
                dateIds[index],
                "setBackgroundResource",
                when {
                    isToday -> R.drawable.widget_day_today
                    isTraining -> R.drawable.widget_day_training
                    else -> R.drawable.widget_day_plain
                },
            )
            views.setTextColor(
                dateIds[index],
                if (isToday) android.graphics.Color.WHITE else android.graphics.Color.parseColor("${COLORS.ink}"),
            )
        }

        applyLaunchIntent(context, views)
        return views
    }

    private fun applyLaunchIntent(context: Context, views: RemoteViews) {
        val launch = context.packageManager.getLaunchIntentForPackage(context.packageName) ?: return
        val flags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        val pending = PendingIntent.getActivity(context, 0, launch, flags)
        views.setOnClickPendingIntent(R.id.widget_root, pending)
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
        private const val PAYLOAD_VERSION = 1
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

        private val dateIds = intArrayOf(
            R.id.widget_day_date_0,
            R.id.widget_day_date_1,
            R.id.widget_day_date_2,
            R.id.widget_day_date_3,
            R.id.widget_day_date_4,
            R.id.widget_day_date_5,
            R.id.widget_day_date_6,
        )
    }
}
`;

function writeFile(target, contents) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, contents, 'utf8');
}

function withHomeWidgetFiles(config) {
  return withDangerousMod(config, [
    'android',
    (config) => {
      const main = path.join(config.modRequest.platformProjectRoot, 'app', 'src', 'main');

      writeFile(path.join(main, 'res', 'xml', 'home_widget_info.xml'), WIDGET_INFO_XML);
      writeFile(path.join(main, 'res', 'layout', 'home_widget.xml'), LAYOUT_XML);
      writeFile(path.join(main, 'res', 'drawable', 'widget_card.xml'), CARD_DRAWABLE);
      writeFile(path.join(main, 'res', 'drawable', 'widget_day_plain.xml'), DAY_PILL_PLAIN);
      writeFile(path.join(main, 'res', 'drawable', 'widget_day_training.xml'), DAY_PILL_TRAINING);
      writeFile(path.join(main, 'res', 'drawable', 'widget_day_today.xml'), DAY_PILL_TODAY);
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
