const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

/**
 * The release manifest asks for nothing the app does not use (native audit,
 * 2026-09-21).
 *
 * The APK of 21 September declared the microphone, the camera, drawing over
 * other apps and a media-playback foreground service — none of them used,
 * every one of them a question in Play's review and on the Data safety form,
 * which says the microphone and camera "must stay absent". They came from
 * defaults, not from code:
 *
 *  - expo-audio's plugin turns background playback ON unless told otherwise,
 *    which adds FOREGROUND_SERVICE, FOREGROUND_SERVICE_MEDIA_PLAYBACK and the
 *    AudioControlsService (type mediaPlayback) — and its library manifest
 *    declares RECORD_AUDIO whatever the plugin says.
 *  - expo-image-picker's plugin adds RECORD_AUDIO unless
 *    `microphonePermission: false`, and its library manifest declares CAMERA.
 *  - Expo's template manifest declares SYSTEM_ALERT_WINDOW.
 *
 * The app plays short cues in the foreground only (src/utils/sound.ts) and
 * picks programme photos from the library only (programImagePicker.ts). So
 * the defaults are switched off at the plugin, and whatever a library
 * manifest still declares is removed at the manifest merge: Expo writes each
 * `android.blockedPermissions` entry as `tools:node="remove"`.
 *
 * The manifest here is the one prebuild would write, computed by Expo's own
 * config pipeline in introspect mode — nothing is written to disk. A change
 * takes a `npx expo prebuild --clean` to reach `android/`.
 */
const ROOT = path.join(__dirname, '..', '..');
const appConfig = require('../../app.json');

const UNUSED = [
  'android.permission.RECORD_AUDIO',
  'android.permission.CAMERA',
  'android.permission.SYSTEM_ALERT_WINDOW',
  'android.permission.FOREGROUND_SERVICE',
  'android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK',
];

/** What the app does use, so a block that went too far fails too. */
const USED = ['android.permission.POST_NOTIFICATIONS', 'android.permission.SCHEDULE_EXACT_ALARM'];

function pluginOptions(name) {
  const entry = appConfig.expo.plugins.find((item) => (Array.isArray(item) ? item[0] : item) === name);
  assert.ok(entry, `${name} is not in app.json's plugins`);
  return Array.isArray(entry) ? entry[1] ?? {} : {};
}

/** The AndroidManifest prebuild would write for this app.json, in memory. */
async function introspectManifest() {
  const { getPrebuildConfigAsync } = require('@expo/prebuild-config');
  const { compileModsAsync } = require('@expo/config-plugins');
  // Plugins warn about things this test is not about (expo-system-ui); keep
  // the runner's output about tests.
  const saved = { warn: console.warn, log: console.log };
  console.warn = () => undefined;
  console.log = () => undefined;
  try {
    const { exp } = await getPrebuildConfigAsync(ROOT, { platforms: ['android'] });
    const config = await compileModsAsync(exp, {
      projectRoot: ROOT,
      introspect: true,
      platforms: ['android'],
      assertMissingModProviders: false,
    });
    return config._internal.modResults.android.manifest.manifest;
  } finally {
    console.warn = saved.warn;
    console.log = saved.log;
  }
}

module.exports = [
  {
    name: 'android permissions: app.json switches off the plugin defaults and blocks what libraries still declare',
    run() {
      const audio = pluginOptions('expo-audio');
      // The option name expo-audio/plugin/build/withAudio.js reads; it
      // defaults to true.
      assert.equal(audio.enableBackgroundPlayback, false, 'expo-audio adds a mediaPlayback foreground service');
      assert.equal(audio.recordAudioAndroid, false);
      assert.equal(audio.microphonePermission, false);

      const picker = pluginOptions('expo-image-picker');
      // Only `=== false` blocks; an absent key adds RECORD_AUDIO.
      assert.equal(picker.cameraPermission, false, 'expo-image-picker leaves CAMERA in');
      assert.equal(picker.microphonePermission, false, 'expo-image-picker adds RECORD_AUDIO');

      const blocked = appConfig.expo.android.blockedPermissions ?? [];
      for (const permission of UNUSED) {
        assert.ok(blocked.includes(permission), `${permission} is not in android.blockedPermissions`);
      }
      for (const permission of USED) {
        assert.ok(!blocked.includes(permission), `${permission} is blocked, and the app needs it`);
        assert.ok(appConfig.expo.android.permissions.includes(permission));
      }
    },
  },
  {
    name: 'android permissions: the manifest prebuild writes removes every unused one and has no foreground service',
    async run() {
      const manifest = await introspectManifest();
      const entries = manifest['uses-permission'] ?? [];
      for (const permission of UNUSED) {
        const named = entries.filter((entry) => entry.$['android:name'] === permission);
        // Present AND marked remove: a library manifest (expo-audio's
        // RECORD_AUDIO, expo-image-picker's CAMERA) is merged by Gradle after
        // prebuild, and only this marker takes it out again.
        assert.ok(named.length > 0, `${permission} has no remove marker, so a library can still add it`);
        for (const entry of named) {
          assert.equal(entry.$['tools:node'], 'remove', `${permission} is requested`);
        }
      }
      for (const permission of USED) {
        const named = entries.filter((entry) => entry.$['android:name'] === permission);
        assert.equal(named.length, 1, `${permission} is missing`);
        assert.equal(named[0].$['tools:node'], undefined, `${permission} is removed`);
      }

      const services = (manifest.application?.[0]?.service ?? []).map((service) => service.$);
      assert.deepEqual(
        services.filter((service) => service['android:foregroundServiceType']).map((service) => service['android:name']),
        [],
        'a foreground service is declared',
      );
      assert.ok(!services.some((service) => /AudioControlsService/.test(service['android:name'])));
    },
  },
  {
    name: 'android permissions: nothing in the app needs what the manifest removes',
    run() {
      // A camera capture, a recording or lock-screen media controls would now
      // fail at runtime; the block has to be lifted in the same change.
      const files = [];
      const walk = (dir) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) walk(full);
          else if (/\.tsx?$/.test(entry.name)) files.push(full);
        }
      };
      walk(path.join(ROOT, 'src'));
      files.push(path.join(ROOT, 'App.tsx'));
      const forbidden =
        /launchCameraAsync|requestCameraPermissionsAsync|useAudioRecorder|requestRecordingPermissionsAsync|setActiveForLockScreen|shouldPlayInBackground:\s*true/;
      for (const file of files) {
        const source = fs.readFileSync(file, 'utf8');
        assert.doesNotMatch(source, forbidden, `${path.relative(ROOT, file)} uses a blocked capability`);
      }
      const sound = fs.readFileSync(path.join(ROOT, 'src', 'utils', 'sound.ts'), 'utf8');
      assert.match(sound, /shouldPlayInBackground: false,/);
      const picker = fs.readFileSync(path.join(ROOT, 'src', 'utils', 'programImagePicker.ts'), 'utf8');
      assert.match(picker, /ImagePicker\.launchImageLibraryAsync\(/);
    },
  },
];
