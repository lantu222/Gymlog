package expo.modules.homewidget

import android.appwidget.AppWidgetManager
import android.content.ComponentName
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

  private val provider: ComponentName
    get() = ComponentName(
      appContext.reactContext!!.packageName,
      appContext.reactContext!!.packageName + ".HomeWidgetProvider",
    )

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

    /** True when at least one instance is already on a home screen. */
    AsyncFunction<Boolean>("isAdded") {
      val context = appContext.reactContext ?: return@AsyncFunction false
      try {
        val ids = AppWidgetManager.getInstance(context)?.getAppWidgetIds(provider)
        (ids?.size ?: 0) > 0
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
  }
}
