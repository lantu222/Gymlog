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
      assert.match(read, /if \(granted\) \{\s*return;\s*\}\s*setSystemBlocked\(true\);\s*onChange\(\{ pushEnabled: false \}\);/);

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
  {
    // Recheck round, 2026-09-29: AppState firing 'active' twice in quick
    // succession started two checks together, and whichever answer landed
    // last won — a slower stale "denied" resolving after a fresher "granted"
    // flipped the master off under a permission that was actually still
    // there. Only the call that is still the latest when it resolves may act.
    name: 'notifications: a stale scheduled-permission answer cannot act once a newer check has started',
    run() {
      const code = strip(screen);
      const readStart = code.indexOf('const readScheduledAccess = useCallback(');
      assert.ok(readStart >= 0, 'readScheduledAccess is gone');
      const readEnd = code.indexOf('}, []);', readStart);
      const read = code.slice(readStart, readEnd);

      // A generation is taken before the async check starts, and read back
      // — from the same ref, not a value captured in the closure — once its
      // own answer lands.
      assert.match(
        read,
        /const generation = \+\+scheduledAccessGenerationRef\.current;\s*void checkPermission\(\)\.then\(\(granted\) => \{\s*if \(scheduledAccessGenerationRef\.current !== generation\) \{\s*return;\s*\}/,
        'the check does not guard against a newer call starting before it resolves',
      );
      // The guard sits above the ref declaration, outside any effect
      // dependency array — every call bumps the same counter.
      assert.match(code, /const scheduledAccessGenerationRef = useRef\(0\);/);
    },
  },
  {
    // The other half of the same recheck: once the master card has flipped
    // pushEnabled off and shown "blocked", re-granting the permission in
    // Android settings and coming back must not leave no way to turn
    // notifications on again. The master's own toggle is that way back —
    // unlike the workout-alerts card, it is never disabled by systemBlocked,
    // and turning it on asks for permission fresh (requestNotificationPermission
    // reads the OS state itself rather than a cached decision), which clears
    // systemBlocked when the OS already says yes.
    name: 'notifications: the master toggle stays the way back once a re-granted permission returns',
    run() {
      const code = strip(screen);

      // The master's ToggleSwitch is wired to handleMasterChange
      // unconditionally — not skipped, disabled or hidden while systemBlocked
      // is true.
      const masterCardStart = code.indexOf('<View style={[styles.card, styles.masterCard,');
      assert.ok(masterCardStart >= 0, 'the master card is gone');
      const masterCardEnd = code.indexOf('{prefs.pushEnabled && onTrainingBreak', masterCardStart);
      const masterCard = code.slice(masterCardStart, masterCardEnd);
      assert.match(
        masterCard,
        /<ToggleSwitch\s*label=\{t\(language, 'notif\.push'\)\}\s*value=\{prefs\.pushEnabled\}\s*onChange=\{handleMasterChange\}\s*\/>/,
        'the master toggle is gated on systemBlocked, or no longer calls handleMasterChange',
      );
      assert.doesNotMatch(masterCard.slice(masterCard.indexOf('<ToggleSwitch')), /disabled/);

      // handleMasterChange asks for permission fresh rather than trusting a
      // stored answer, and clears systemBlocked from what it gets back.
      const handleStart = code.indexOf('const handleMasterChange = (next: boolean) => {');
      assert.ok(handleStart >= 0);
      const handleEnd = code.indexOf('\n  };', handleStart);
      const handle = code.slice(handleStart, handleEnd);
      assert.match(handle, /void requestPermission\(\)\.then\(\(granted\) => \{\s*setSystemBlocked\(!granted\);/);
    },
  },
];
