const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { readAppWiring } = require('../helpers/appWiringSource.cjs');

const root = path.join(__dirname, '..', '..');
/** Comments out, so a guard is matched against code and not against its own explanation. */
const code = (text) =>
  text
    .replace(/\r\n/g, '\n')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
const read = (...parts) => code(fs.readFileSync(path.join(root, ...parts), 'utf8'));

/**
 * Where the account hook meets the screens, the providers and the server
 * (audit round 2, 2026-09-16). The hook itself is run in
 * tests/features/account/accountBackupHook; these pin the wiring around it,
 * which is React and Vercel and does not run under Node.
 */
module.exports = [
  {
    name: 'account wiring: the restore question shows both sides and asks again before a keep that shrinks the cloud copy',
    run() {
      const app = code(readAppWiring());
      const start = app.indexOf('const presentAccountOutcome = useCallback(');
      const presenter = app.slice(start, app.indexOf('const handleAccountSignIn = useCallback(', start));
      assert.match(presenter, /const copy = restoreQuestionCopy\(outcome\.summary, language\);/);
      assert.doesNotMatch(presenter, /toLocaleDateString/, 'the date followed the phone, not the app');
      // "Use the data on this phone": straight to the upload only when nothing shrinks.
      assert.match(presenter, /text: copy\.keepLocal,\s*onPress: \(\) => \{\s*const replace = copy\.replace;\s*if \(!replace\) \{\s*keepLocal\(\);\s*return;\s*\}\s*Alert\.alert\(/);
      assert.match(
        presenter,
        /\{ text: replace\.back, style: 'cancel', onPress: ask \},\s*\{ text: replace\.confirm, style: 'destructive', onPress: keepLocal \},/,
      );
      assert.equal((presenter.match(/resolveRestoreChoice\('keep_local'\)/g) ?? []).length, 1, 'a second path uploads without the question');
      assert.equal((presenter.match(/cancelable: false/g) ?? []).length, 2, 'a dismissable dialog leaves the choice dangling');
      assert.match(presenter, /ask\(\);\s*return outcome\.kind;/);
    },
  },
  {
    name: 'account wiring: signed in without a backup says the backup failed, not the sign-in',
    run() {
      const app = code(readAppWiring());
      assert.match(app, /if \(outcome\.kind === 'not_backed_up'\) \{\s*showToast\(t\(language, 'account\.backupFailed'\)\);/);
      const hook = read('src', 'features', 'account', 'useAccountBackup.ts');
      const settle = hook.slice(hook.indexOf('const settleWithRemote = useCallback('), hook.indexOf('const signIn = useCallback('));
      assert.doesNotMatch(settle, /kind: 'failed'/, 'a signed-in reader was told sign-in failed');
    },
  },
  {
    name: 'account wiring: delete speaks when it fails, and the server stops calling a failed delete a success',
    run() {
      const profile = read('src', 'app', 'renderProfileTab.tsx');
      assert.match(
        profile,
        /void accountBackup\.deleteRemoteBackup\(\)\.then\(\(result\) => \{\s*if \(result === 'failed'\) \{\s*showToast\(t\(preferences\.appLanguage, 'account\.deleteRemote\.failed'\)\);/,
      );
      assert.match(profile, /busy: accountBackup\.phase !== 'idle',/);

      const api = read('api', 'backup.ts');
      const remove = api.slice(api.indexOf("if (req.method === 'DELETE')"), api.indexOf("res.status(405)"));
      assert.match(
        remove,
        /catch \(error\) \{\s*if \(!\(error instanceof BlobNotFoundError\)\) \{[\s\S]*?res\.status\(502\)\.json\(\{ ok: false, error: 'STORE_UNAVAILABLE' \}\);\s*return;\s*\}\s*\}/,
      );
      assert.doesNotMatch(remove, /catch \{/, 'every store error answered ok: true');

      const client = read('src', 'features', 'account', 'backupApi.ts');
      const del = client.slice(client.indexOf('export async function deleteBackup'));
      assert.match(del, /return \{ ok: response\.ok && body\?\.ok === true \};/);
    },
  },
  {
    name: 'account wiring: Reset waits for a running account operation, and signs out before it wipes',
    run() {
      const settings = read('src', 'screens', 'SettingsScreen.tsx');
      const reset = settings.slice(settings.lastIndexOf('<Row', settings.indexOf("title={t(language, 'settings.resetData')}")));
      const resetRow = reset.slice(0, reset.indexOf('/>'));
      assert.match(resetRow, /disabled=\{account\?\.busy === true\}/);
      // And says why, instead of a red row that silently ignores the tap.
      assert.match(resetRow, /sub=\{t\(language, account\?\.busy \? 'settings\.resetData\.busy' : 'settings\.resetData\.sub'\)\}/);
      // Every account row shows its busy state the same way.
      for (const handler of ['onSignIn', 'onBackupNow', 'onDeleteRemote', 'onSignOut']) {
        assert.match(settings, new RegExp(`disabled=\\{account\\.busy\\}\\s*onPress=\\{account\\.${handler}\\}`), handler);
      }
      assert.doesNotMatch(settings, /busy \? undefined/, 'a busy row dropped its handler and looked live');
      // A disabled row renders without a press handler, dimmed, and says so to a screen reader.
      const row = settings.slice(settings.indexOf('function Row('), settings.indexOf('export function SettingsScreen('));
      assert.match(row, /disabled && styles\.rowDisabled/);
      assert.match(
        row,
        /if \(disabled\) \{\s*return \(\s*<View accessible accessibilityRole="button" accessibilityState=\{\{ disabled: true \}\}>\s*\{inner\}\s*<\/View>\s*\);\s*\}/,
      );

      const profile = read('src', 'app', 'renderProfileTab.tsx');
      const handler = profile.slice(profile.indexOf('onResetAllData={async () => {'));
      assert.ok(handler.indexOf('await accountBackup.signOut();') < handler.indexOf('await resetAllData();'));

      // Sign-out ends what was running before it awaits anything.
      const hook = read('src', 'features', 'account', 'useAccountBackup.ts');
      const signOut = hook.slice(hook.indexOf('const signOut = useCallback('), hook.indexOf('const deleteRemoteBackup = useCallback('));
      assert.match(signOut, /^const signOut = useCallback\(async \(\) => \{\s*generationRef\.current \+= 1;/);
      assert.ok(signOut.indexOf('generationRef.current += 1;') < signOut.indexOf('await '));
    },
  },
  {
    name: 'account wiring: a restore writes the workout history before it reports, and keeps the loader step',
    run() {
      const provider = read('src', 'features', 'workout', 'WorkoutProvider.tsx');
      const restore = provider.slice(provider.indexOf('async restoreHistoryFromBackup(history) {'));
      // The free workout's board is named with the other two: what the
      // restore puts away is what the question counted (hasWorkoutInProgress).
      assert.match(
        restore,
        /^async restoreHistoryFromBackup\(history\) \{\s*const bundle = normalizeWorkoutBundle\(\{ activeSession: null, history, activeCardio: null, freestyleDraft: null \}\);\s*await saveWorkoutBundle\(bundle\);\s*dispatch\(\{ type: 'session\/hydrate', payload: bundle \}\);\s*return bundle\.history;/,
      );
      // PR #133's load path stays as it was.
      assert.match(provider, /const result = await loadWithRetry\(loadWorkoutBundle, \{/);

      const app = code(readAppWiring());
      assert.match(app, /restoreDatabase: restoreDatabaseFromBackup,\s*restoreWorkoutHistory: workout\.restoreHistoryFromBackup,/);
      // Both stores loaded, and a live workout counts as something to ask about.
      const hookCall = app.slice(app.indexOf('const accountBackup = useAccountBackup({'), app.indexOf('});', app.indexOf('const accountBackup = useAccountBackup({')));
      assert.match(hookCall, /hydrated: hydrated && workout\.hydrated,/, 'the backup ran before the workout history had loaded');
      // Through the shared rule, which counts the free workout too. This
      // pinned `activeSession !== null || activeCardio !== null` written out
      // here, and a free workout left open was restored over unasked
      // (persistence audit, 2026-09-20).
      assert.match(hookCall, /liveSession: hasWorkoutInProgress\(workout\),/);
      assert.match(app, /import \{ hasWorkoutInProgress \} from '\.\/src\/lib\/accountBackup';/);
      const accountHook = read('src', 'features', 'account', 'useAccountBackup.ts');
      assert.match(accountHook, /if \(hasLocalDataWorthKeeping\(latestRef\.current\.database, latestRef\.current\.liveSession\)\) \{/);
      // Both sides of the question counted per store, the history included.
      assert.match(
        accountHook,
        /describeRestoreChoice\(\s*payload,\s*latestRef\.current\.database,\s*latestRef\.current\.liveSession,\s*latestRef\.current\.workoutHistory,\s*\)/,
      );

      const appProvider = read('src', 'state', 'AppProvider.tsx');
      const restoreDb = appProvider.slice(appProvider.indexOf('function restoreDatabaseFromBackup'), appProvider.indexOf('const value = useMemo<AppContextValue>'));
      assert.match(restoreDb, /await commit\(next\);\s*return next;/);

      const hook = read('src', 'features', 'account', 'useAccountBackup.ts');
      const apply = hook.slice(hook.indexOf('const applyRestore = useCallback('), hook.indexOf('const askRestoreOrKeep = useCallback('));
      assert.match(
        apply,
        /const database = await restoreDatabase\(payload\.database\);\s*ensureCurrent\(generation\);\s*let history: WorkoutHistoryStore;\s*try \{\s*history = await restoreWorkoutHistory\(payload\.workoutHistory\);\s*\} catch \(error\) \{\s*if \(generationRef\.current === generation\) \{\s*try \{\s*await restoreDatabase\(previous\);[\s\S]*?throw error;\s*\}\s*ensureCurrent\(generation\);/,
      );
    },
  },
  {
    name: 'account wiring: the backup row writes its date in the app language',
    run() {
      const settings = read('src', 'screens', 'SettingsScreen.tsx');
      assert.doesNotMatch(settings, /toLocaleDateString/);
      assert.match(settings, /return `\$\{formatDateNumeric\(date, language\)\} \$\{hh\}:\$\{mm\}`;/);
      assert.match(settings, /backupTimeLabel\(account\.lastBackupAt, language\)/);
    },
  },
];
