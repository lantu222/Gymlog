package expo.modules.homewidget

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Intent
import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * The three questions the app needs to ask Android about the home-screen
 * widget, and nothing else.
 *
 * The widget itself needs no native module — it reads a JSON file the app
 * writes (plugins/withHomeWidget.js). This exists only so the app can offer to
 * add the widget instead of telling the user to go hunting in the launcher.
 *
 * `isSupported` matters: pinning needs Android 8 and a launcher that opted in.
 * Where it is unsupported the app must not show the offer at all, rather than
 * show a button that does nothing.
 */
class HomeWidgetModule : Module() {

  /**
   * The one the app offers to add: the 4×2, which is what the offer's own copy
   * describes. Its class name predates the family and is kept because widgets
   * already on a home screen are bound to it.
   */
  private val provider: ComponentName
    get() = componentFor("HomeWidgetProvider")

  /**
   * Every receiver in the family. `isAdded` has to check both, or adding the
   * 2×2 would leave the app still offering to add a widget.
   */
  private val allProviders: List<ComponentName>
    get() = listOf("HomeWidgetProvider", "WeekWidgetProvider").map(::componentFor)

  private fun componentFor(className: String): ComponentName {
    val packageName = appContext.reactContext!!.packageName
    return ComponentName(packageName, "$packageName.$className")
  }

  override fun definition() = ModuleDefinition {
    Name("HomeWidget")

    AsyncFunction<Boolean>("isSupported") {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
        return@AsyncFunction false
      }
      val context = appContext.reactContext ?: return@AsyncFunction false
      try {
        AppWidgetManager.getInstance(context)?.isRequestPinAppWidgetSupported ?: false
      } catch (error: Exception) {
        false
      }
    }

    /** True when any of the family's widgets is already on a home screen. */
    AsyncFunction<Boolean>("isAdded") {
      val context = appContext.reactContext ?: return@AsyncFunction false
      try {
        val manager = AppWidgetManager.getInstance(context) ?: return@AsyncFunction false
        allProviders.any { (manager.getAppWidgetIds(it)?.size ?: 0) > 0 }
      } catch (error: Exception) {
        false
      }
    }

    /**
     * Opens the system's "add widget" dialog. Returns whether the dialog was
     * shown — not whether the user accepted, which Android never tells us
     * without a callback we do not need. The caller must not claim the widget
     * was added on the strength of this.
     */
    AsyncFunction<Boolean>("requestPin") {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
        return@AsyncFunction false
      }
      val context = appContext.reactContext ?: return@AsyncFunction false
      try {
        val manager = AppWidgetManager.getInstance(context) ?: return@AsyncFunction false
        if (!manager.isRequestPinAppWidgetSupported) {
          return@AsyncFunction false
        }
        manager.requestPinAppWidget(provider, null, null)
      } catch (error: Exception) {
        false
      }
    }

    /**
     * Redraws every widget of ours that is on a home screen, right now.
     *
     * Android will not update a widget more often than every 30 minutes on its
     * own, and that delay used to be the accepted price of a file-only bridge.
     * It stopped being acceptable the day a payload version bump left the widget
     * telling a reader with months of history to create their first programme —
     * for up to half an hour, with the correct file already on disk.
     *
     * Broadcasting APPWIDGET_UPDATE at large is a protected action. Sending it to
     * our own receiver, named explicitly, is ours to send.
     *
     * Returns whether anything was asked to redraw: false means no widget is
     * placed, which is not a failure.
     */
    AsyncFunction<Boolean>("refresh") {
      val context = appContext.reactContext ?: return@AsyncFunction false
      try {
        val manager = AppWidgetManager.getInstance(context) ?: return@AsyncFunction false
        var asked = false
        for (component in allProviders) {
          val ids = manager.getAppWidgetIds(component)
          if (ids == null || ids.isEmpty()) {
            continue
          }
          val intent = Intent(AppWidgetManager.ACTION_APPWIDGET_UPDATE)
          intent.component = component
          intent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids)
          context.sendBroadcast(intent)
          asked = true
        }
        asked
      } catch (error: Exception) {
        false
      }
    }
  }
}
