package expo.modules.exactalarm

import android.app.Activity
import android.app.AlarmManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Whether the end-of-rest alert can ring on the second, and the way to the
 * one switch that decides it.
 *
 * expo-notifications arms every scheduled notification through AlarmManager
 * and asks `canScheduleExactAlarms()` first: with the answer "no" it falls
 * back to an inexact alarm that Android may deliver minutes late. From
 * Android 14 that is the answer for a fresh install until the reader allows
 * "Alarms & reminders" for the app — the app declares SCHEDULE_EXACT_ALARM,
 * but declaring is not granting. Nothing in expo-notifications or React
 * Native asks the question or opens that page for this app, so this module
 * does both and nothing else.
 */
class ExactAlarmModule : Module() {

  override fun definition() = ModuleDefinition {
    Name("ExactAlarm")

    /** True below Android 12, where exact alarms need no grant. */
    AsyncFunction<Boolean>("canScheduleExactAlarms") {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
        return@AsyncFunction true
      }
      val context = appContext.reactContext ?: return@AsyncFunction false
      try {
        val manager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager
        manager?.canScheduleExactAlarms() ?: false
      } catch (error: Exception) {
        false
      }
    }

    /**
     * Opens "Alarms & reminders" on this app's own page. Returns whether the
     * page was opened — not whether the reader allowed anything, which the
     * caller reads again with `canScheduleExactAlarms` when the app returns.
     */
    AsyncFunction<Boolean>("openSettings") {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
        return@AsyncFunction false
      }
      val context = appContext.reactContext ?: return@AsyncFunction false
      try {
        val intent = Intent(
          Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM,
          Uri.parse("package:${context.packageName}"),
        )
        val activity: Activity? = appContext.currentActivity
        if (activity != null) {
          activity.startActivity(intent)
        } else {
          intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
          context.startActivity(intent)
        }
        true
      } catch (error: Exception) {
        false
      }
    }
  }
}
