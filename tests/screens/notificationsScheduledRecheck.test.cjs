const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (...parts) => fs.readFileSync(path.join(__dirname, '..', '..', ...parts), 'utf8').replace(/\r\n/g, '\n');
const screen = read('src', 'screens', 'NotificationsScreen.tsx');
const strip = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/**
 * #bugs, 2026-09-29: the scheduled-notifications master card checked the OS
 * permission once on mount, while the workout-alerts card beside it already
 * re-checks on every return to the foreground (#bugs, 2026-09-26, see
 * restAlertsAsk.test.cjs). Revoke permission from Android settings and come
 * back, and the master card — and every toggle it governs — kept showing On.
 *
 * Source guards, the same convention as the rest of this screen's tests
 * (notificationGroups.test.cjs, restAlertsAsk.test.cjs): the screen returns
 * JSX, which the hook harness used for useAccountBackup and the rest-alert
 * moment cannot render.
 */
module.exports = [
  {
    name: 'notifications: the scheduled-notifications permission check is read fresh on every return to the foreground',
    run() {
      const code = strip(screen);

      // The old mount-only effect is gone.
      assert.doesNotMatch(code, /Runs once: re-running on every prefs change would fight/);

      // The check itself: same consequence as before (block, then flip the
      // master off) when the OS says the permission is gone.
      const readStart = code.indexOf('const readScheduledAccess = useCallback(');
      assert.ok(readStart >= 0, 'readScheduledAccess is gone');
      const readEnd = code.indexOf('}, []);', readStart);
      const read = code.slice(readStart, readEnd);
      assert.match(read, /if \(!pushEnabled \|\| !checkPermission\) \{\s*return;\s*\}/);
      assert.match(read, /void checkPermission\(\)\.then\(\(granted\) => \{\s*if \(granted\) \{\s*return;\s*\}\s*setSystemBlocked\(true\);\s*onChange\(\{ pushEnabled: false \}\);/);

      // Read through a ref rather than closed-over props, so the effect that
      // calls it does not have to depend on prefs.pushEnabled — re-checking on
      // every foreground must not also mean re-checking on every toggle.
      assert.match(read, /latestScheduledRef\.current;/);
      assert.match(code, /latestScheduledRef\.current = \{ pushEnabled: prefs\.pushEnabled, checkPermission, onChange \};/);

      // Both checks share the one AppState subscription: on mount, and again
      // on every 'active'.
      const effectStart = code.indexOf('useEffect(() => {\n    readWorkoutAccess();');
      assert.ok(effectStart >= 0, 'the combined mount/foreground effect is gone');
      const effectEnd = code.indexOf('}, [readWorkoutAccess, readScheduledAccess]);', effectStart);
      const effect = code.slice(effectStart, effectEnd);
      assert.match(effect, /readWorkoutAccess\(\);\s*readScheduledAccess\(\);\s*const subscription = AppState\.addEventListener\('change', \(state\) => \{\s*if \(state === 'active'\) \{\s*readWorkoutAccess\(\);\s*readScheduledAccess\(\);/);
    },
  },
];
