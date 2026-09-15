const { AndroidConfig, withAndroidManifest } = require('@expo/config-plugins');

/**
 * Android's own backup of the app's data is off.
 *
 * `android:allowBackup` defaults to true, and Expo's template leaves it unset,
 * so the whole AsyncStorage — every logged session, the signed-in account's
 * email and Google subject, the coach's memory — went into the device's
 * Google backup and could be pulled off an unlocked phone with `adb backup`
 * (security review, 2026-09-14). The app has its own backup, the one the
 * privacy policy describes: opt-in, EU-hosted, tied to a Google sign-in. That
 * is the only copy that should exist. `false` covers cloud backup and
 * device-to-device transfer on every Android version; on 12+ it makes
 * `dataExtractionRules` moot.
 *
 * Same reason as the other plugins for living here: `android/` is regenerated
 * by `expo prebuild`, so an attribute set there by hand does not last.
 */
function applyAllowBackup(manifest) {
  const application = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);
  application.$['android:allowBackup'] = 'false';
  return manifest;
}

module.exports = function withAllowBackup(config) {
  return withAndroidManifest(config, (config) => {
    applyAllowBackup(config.modResults);
    return config;
  });
};

module.exports.applyAllowBackup = applyAllowBackup;
