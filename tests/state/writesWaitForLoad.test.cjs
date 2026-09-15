const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..', '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8').replace(/\r\n/g, '\n');
/** Comments out, so a guard is matched against code and not against its own explanation. */
const code = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

/**
 * Data-loss audit, 2026-09-15. Each of these let a write land on top of data
 * the app had not read yet, or had read and was about to throw away.
 *
 * Source-level, like commitSavesPreferences and corruptDatabase beside them:
 * the providers and hooks are React on AsyncStorage, which does not run under
 * Node. So these pin the shape of each fix, and each was mutated back to the
 * old shape to see it fail.
 */
module.exports = [
  {
    name: 'writesWaitForLoad: the provider queues every write behind the load',
    run() {
      const provider = code(read('src', 'state', 'AppProvider.tsx'));
      // The first task in the write queue is the gate, so every write waits.
      assert.match(
        provider,
        /runExclusiveRef\.current = createSerialTaskQueue\(\);\s*const gate = hydrationGateRef\.current;\s*void runExclusiveRef\.current\(\(\) => gate\.promise\);/,
      );
      // The gate opens on a load that landed, and nowhere else.
      const opens = provider.match(/hydrationGateRef\.current\?\.open\(\)/g) ?? [];
      assert.equal(opens.length, 1, 'the gate opens in exactly one place');
      const hydrate = provider.slice(provider.indexOf('async function hydrate()'), provider.indexOf('hydrate();'));
      assert.ok(
        hydrate.indexOf('databaseRef.current = nextDatabase;') < hydrate.indexOf('hydrationGateRef.current?.open()'),
        'the gate opens after the loaded database is in the ref',
      );
      // A failed load is not a new install: no empty database is put in its place.
      assert.doesNotMatch(hydrate, /createEmptyDatabase/);
      assert.match(hydrate, /setLoadFailed\(true\)/);
      assert.match(provider, /if \(loadFailed\) \{\s*return \(\s*<StorageLoadFailedScreen/);
    },
  },
  {
    name: 'writesWaitForLoad: the workout store neither hangs nor saves an empty bundle over a failed read',
    run() {
      const provider = code(read('src', 'features', 'workout', 'WorkoutProvider.tsx'));
      const hydrate = provider.slice(provider.indexOf('async function hydrate()'), provider.indexOf('hydrate();'));
      assert.match(hydrate, /catch \(error\)/, 'a read that throws has to be caught, or the splash never goes');
      const catchBlock = hydrate.slice(hydrate.indexOf('catch (error)'));
      assert.doesNotMatch(catchBlock, /session\/hydrate/, 'hydrating on a failed read saves the empty bundle over the stored one');
      assert.match(provider, /if \(loadFailed\) \{\s*return \(\s*<StorageLoadFailedScreen/);

      // A bundle that reads but will not parse is set aside first, and a reset removes the copy.
      const persistence = code(read('src', 'features', 'workout', 'workoutPersistence.ts'));
      const load = persistence.slice(persistence.indexOf('export async function loadWorkoutBundle'), persistence.indexOf('export async function saveWorkoutBundle'));
      const parseCatch = load.slice(load.indexOf('catch {'));
      assert.ok(parseCatch.indexOf('setLargeItem(CORRUPT_STORAGE_KEY, raw)') >= 0, 'the unparseable bundle is not kept');
      assert.ok(parseCatch.indexOf('setLargeItem(CORRUPT_STORAGE_KEY, raw)') < parseCatch.indexOf('createEmptyWorkoutHistory()'));
      const clear = persistence.slice(persistence.indexOf('export async function clearWorkoutBundle'));
      assert.match(clear, /removeLargeItem\(CORRUPT_STORAGE_KEY\)/);
    },
  },
  {
    name: 'writesWaitForLoad: the Google name is adopted only after the stored preferences loaded',
    run() {
      const app = code(read('App.tsx'));
      const at = app.indexOf('const googleName = accountBackup.state.name?.trim();');
      assert.notEqual(at, -1);
      const effect = app.slice(app.lastIndexOf('useEffect(() => {', at), app.indexOf('}, [', at) + 120);
      assert.match(effect, /if \(!appHydrated\) \{\s*return;\s*\}/);
      assert.ok(effect.indexOf('!appHydrated') < effect.indexOf('updatePreferences('), 'the guard comes before the write');
      assert.match(effect, /\}, \[[^\]]*appHydrated[^\]]*\]\);/);
    },
  },
  {
    name: 'writesWaitForLoad: the route-level back listener does not re-subscribe on every workout tick',
    run() {
      const app = code(read('App.tsx'));
      const at = app.indexOf("BackHandler.addEventListener('hardwareBackPress', () => {\n      const nextRoute = getBackRoute(route, workoutHomeRoute);");
      assert.notEqual(at, -1);
      const deps = app.slice(app.indexOf('}, [', at), app.indexOf(']);', at) + 3);
      // The context is a new object every second while a rest timer or cardio
      // runs; depending on it made this the newest listener every second.
      assert.doesNotMatch(deps, /\bworkout\b/);
      assert.match(app.slice(at, app.indexOf(']);', at)), /workoutRef\.current\.clearCompletedWorkout\(\)/);
    },
  },
  {
    name: 'writesWaitForLoad: restore-or-keep answers with the account it was asked for, and nothing uploads meanwhile',
    run() {
      const hook = code(read('src', 'features', 'account', 'useAccountBackup.ts'));
      const resolve = hook.slice(hook.indexOf('const resolveRestoreChoice = useCallback('), hook.indexOf('const backupNow = useCallback('));
      // The dialog calls the function from the render that started sign-in,
      // when `account` was still null.
      assert.match(resolve, /const current = pending\.account;/);
      assert.doesNotMatch(resolve, /=\s*account\b/);
      assert.doesNotMatch(resolve.slice(resolve.lastIndexOf('[')), /\baccount\b/);

      const backupNow = hook.slice(hook.indexOf('const backupNow = useCallback('), hook.indexOf('const signOut = useCallback('));
      assert.match(backupNow, /if \(pendingRestoreRef\.current\) \{\s*return false;/);

      // The automatic path will not replace a much fuller cloud copy.
      assert.match(hook, /if \(autoBackupWouldShrinkLog\(latestRef\.current\.database\.workoutSessions\.length, accountRef\.current\?\.lastBackupSessionCount \?\? null\)\) \{\s*return;\s*\}\s*void backupNowRef\.current\(\);/);
    },
  },
  {
    name: 'writesWaitForLoad: only a missing blob is "no backup"',
    run() {
      const api = code(read('api', 'backup.ts'));
      const get = api.slice(api.indexOf("if (req.method === 'GET')"), api.indexOf("if (req.method === 'DELETE')"));
      const failure = get.slice(get.indexOf('catch'), get.indexOf('if (!stored'));
      assert.match(failure, /res\.status\(502\)/);
      assert.doesNotMatch(failure, /stored = null|NO_BACKUP/, 'a store error answered as NO_BACKUP makes the app upload over the backup');

      const client = code(read('src', 'features', 'account', 'backupApi.ts'));
      assert.match(client, /if \(response\.status === 404 && body\.error === 'NO_BACKUP'\)/);
    },
  },
  {
    name: 'writesWaitForLoad: leaving a free workout with logged sets asks first, from the chevron and from back',
    run() {
      const screen = code(read('src', 'screens', 'EmptyWorkoutScreen.tsx'));
      assert.match(screen, /accessibilityLabel=\{t\(language, 'emptyWorkout\.a11y\.back'\)\} onPress=\{requestLeave\}/);
      assert.doesNotMatch(screen, /onPress=\{onBack\}/);
      assert.match(screen, /BackHandler\.addEventListener\('hardwareBackPress'/);
      const request = screen.slice(screen.indexOf('const requestLeave = () => {'), screen.indexOf('const hasLoggedSets'));
      assert.ok(request.indexOf('setConfirmingLeave(true)') < request.indexOf('onBack()'), 'with sets logged, the question comes before leaving');
      assert.match(screen, /<ConfirmDialog[\s\S]*?visible=\{confirmingLeave\}/);
    },
  },
];
