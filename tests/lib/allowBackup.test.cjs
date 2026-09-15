const assert = require('node:assert/strict');

/**
 * Android's own backup of the app's data is off, and the setting is real.
 *
 * `android:allowBackup` defaults to true, so the whole AsyncStorage — every
 * session, the account email, the coach's memory — went into the device's
 * Google backup and `adb backup` (security review, 2026-09-14). The app has
 * its own backup, the one the privacy policy describes; that is the only
 * copy that should exist.
 *
 * Expo already owns this attribute: `expo.android.allowBackup` in app.json is
 * written into the manifest by its built-in mod on every prebuild, so no
 * plugin of our own is needed — and a value set in `android/` by hand would
 * revert on the next prebuild anyway.
 */
const { AndroidConfig } = require('@expo/config-plugins');
const appConfig = require('../../app.json');

module.exports = [
  {
    name: 'allowBackup: app.json turns the device backup off',
    run() {
      assert.equal(appConfig.expo.android.allowBackup, false);
      // The field Expo reads, spelled the way it reads it.
      assert.equal(AndroidConfig.AllowBackup.getAllowBackup(appConfig.expo), false);
    },
  },
  {
    name: 'allowBackup: the built-in mod writes false into the manifest, over a template that said true',
    run() {
      const manifest = {
        manifest: {
          $: { 'xmlns:android': 'http://schemas.android.com/apk/res/android' },
          application: [{ $: { 'android:name': '.MainApplication', 'android:allowBackup': 'true' }, activity: [] }],
        },
      };
      const written = AndroidConfig.AllowBackup.setAllowBackup(appConfig.expo, manifest);
      assert.equal(written.manifest.application[0].$['android:allowBackup'], 'false');
      assert.equal(AndroidConfig.AllowBackup.getAllowBackupFromManifest(written), false);
      // Everything else the template wrote is left alone.
      assert.equal(written.manifest.application[0].$['android:name'], '.MainApplication');
    },
  },
];
