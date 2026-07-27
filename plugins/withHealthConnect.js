const { withAndroidManifest, withGradleProperties, withMainActivity } = require('@expo/config-plugins');

/**
 * Recreates the Health Connect native setup on every `expo prebuild`.
 *
 * android/ is gitignored in this repo, so anything edited there by hand is
 * lost the next time the native project is regenerated. Everything the
 * integration needs lives here instead:
 *
 * 1. Health read permissions (weight, height) in the manifest.
 * 2. The permission-rationale intent filter on MainActivity (Android 13 flow)
 *    and the VIEW_PERMISSION_USAGE activity-alias (Android 14+ flow) — without
 *    these the app never appears in Health Connect's permission UI.
 * 3. HealthConnectPermissionDelegate registration in MainActivity.onCreate —
 *    without it requestPermission crashes on an uninitialized lateinit.
 * 4. minSdkVersion 26, required by androidx.health.connect:connect-client.
 */

const HEALTH_PERMISSIONS = ['android.permission.health.READ_WEIGHT', 'android.permission.health.READ_HEIGHT'];

const DELEGATE_IMPORT = 'import dev.matinzd.healthconnect.permissions.HealthConnectPermissionDelegate';
const DELEGATE_CALL = 'HealthConnectPermissionDelegate.setPermissionDelegate(this)';

function withHealthConnectManifest(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;

    manifest['uses-permission'] = manifest['uses-permission'] ?? [];
    for (const name of HEALTH_PERMISSIONS) {
      if (!manifest['uses-permission'].some((entry) => entry.$['android:name'] === name)) {
        manifest['uses-permission'].push({ $: { 'android:name': name } });
      }
    }

    const application = manifest.application?.[0];
    const mainActivity = application?.activity?.find((activity) => activity.$['android:name'] === '.MainActivity');
    if (mainActivity) {
      mainActivity['intent-filter'] = mainActivity['intent-filter'] ?? [];
      const hasRationale = mainActivity['intent-filter'].some((filter) =>
        filter.action?.some((action) => action.$['android:name'] === 'androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE'),
      );
      if (!hasRationale) {
        mainActivity['intent-filter'].push({
          action: [{ $: { 'android:name': 'androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE' } }],
        });
      }
    }

    if (application) {
      application['activity-alias'] = application['activity-alias'] ?? [];
      const hasAlias = application['activity-alias'].some(
        (alias) => alias.$['android:name'] === 'ViewPermissionUsageActivity',
      );
      if (!hasAlias) {
        application['activity-alias'].push({
          $: {
            'android:name': 'ViewPermissionUsageActivity',
            'android:exported': 'true',
            'android:targetActivity': '.MainActivity',
            'android:permission': 'android.permission.START_VIEW_PERMISSION_USAGE',
          },
          'intent-filter': [
            {
              action: [{ $: { 'android:name': 'android.intent.action.VIEW_PERMISSION_USAGE' } }],
              category: [{ $: { 'android:name': 'android.intent.category.HEALTH_PERMISSIONS' } }],
            },
          ],
        });
      }
    }

    return config;
  });
}

function withHealthConnectDelegate(config) {
  return withMainActivity(config, (config) => {
    let contents = config.modResults.contents;

    if (!contents.includes(DELEGATE_IMPORT)) {
      contents = contents.replace(
        'import expo.modules.ReactActivityDelegateWrapper',
        `import expo.modules.ReactActivityDelegateWrapper\n\n${DELEGATE_IMPORT}`,
      );
    }

    if (!contents.includes(DELEGATE_CALL)) {
      contents = contents.replace(/super\.onCreate\(null\)/, `super.onCreate(null)\n    ${DELEGATE_CALL}`);
    }

    config.modResults.contents = contents;
    return config;
  });
}

function withHealthConnectMinSdk(config) {
  return withGradleProperties(config, (config) => {
    const existing = config.modResults.find(
      (item) => item.type === 'property' && item.key === 'android.minSdkVersion',
    );
    if (existing) {
      existing.value = '26';
    } else {
      config.modResults.push({ type: 'property', key: 'android.minSdkVersion', value: '26' });
    }
    return config;
  });
}

module.exports = function withHealthConnect(config) {
  return withHealthConnectMinSdk(withHealthConnectDelegate(withHealthConnectManifest(config)));
};
