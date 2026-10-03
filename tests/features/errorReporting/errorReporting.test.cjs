const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');

const { flush, requireWithStubs } = require('../../helpers/hookHarness.cjs');

/**
 * Error reporting on the phone (2026-10-03): the boundary, the global
 * handlers, the reporter's budget and, end to end, the reader's switch.
 *
 * The client and reporter run for real against a fake AsyncStorage and a fake
 * fetch; the boundary is transpiled from its .tsx and driven without a
 * renderer (React's own element objects are what is inspected).
 */

const ROOT = path.join(__dirname, '..', '..', '..');
const SRC = path.join(ROOT, 'src');
const DIST = path.join(ROOT, '.test-dist');
const STORAGE_KEY = '@vinha/analytics/v1';
const URL = 'https://example.test/api/events';

const read = (...parts) => fs.readFileSync(path.join(ROOT, ...parts), 'utf8');

// ---------------------------------------------------------------------------
// Fakes and loaders
// ---------------------------------------------------------------------------

function memoryStorage() {
  const items = new Map();
  const storage = {
    items,
    writes: 0,
    async getItem(key) {
      return items.has(key) ? items.get(key) : null;
    },
    async setItem(key, value) {
      storage.writes += 1;
      items.set(key, value);
    },
    async removeItem(key) {
      items.delete(key);
    },
  };
  return storage;
}

/** The compiled client against `storage`, built with its URL configured. */
function loadClient(storage) {
  const saved = process.env.EXPO_PUBLIC_ANALYTICS_URL;
  process.env.EXPO_PUBLIC_ANALYTICS_URL = URL;
  try {
    return requireWithStubs(path.join(DIST, 'features', 'analytics', 'analyticsClient.js'), {
      '@react-native-async-storage/async-storage': { __esModule: true, default: storage },
    });
  } finally {
    if (saved === undefined) {
      delete process.env.EXPO_PUBLIC_ANALYTICS_URL;
    } else {
      process.env.EXPO_PUBLIC_ANALYTICS_URL = saved;
    }
  }
}

/** The compiled reporter, sending through `client` (the real one) or a recorder. */
function loadReporter(client) {
  return requireWithStubs(path.join(DIST, 'features', 'errorReporting', 'errorReporter.js'), {
    '../analytics/analyticsClient': client,
  });
}

function recorder() {
  const sent = [];
  return {
    sent,
    trackEvent(name, props, options) {
      sent.push({ name, props, options });
    },
  };
}

/** Fake fetch, restored by the caller. */
function withFetch(work) {
  const calls = [];
  const saved = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    return { ok: true, json: async () => ({}) };
  };
  return Promise.resolve(work(calls)).finally(() => {
    globalThis.fetch = saved;
  });
}

/** Transpile and run a .tsx from src, with stubs for what is not Node's. */
function loadTsx(file, stubs, cache = new Map()) {
  if (cache.has(file)) {
    return cache.get(file);
  }
  const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  }).outputText;
  const module_ = { exports: {} };
  cache.set(file, module_.exports);
  const localRequire = (specifier) => {
    if (Object.prototype.hasOwnProperty.call(stubs, specifier)) {
      return stubs[specifier];
    }
    if (specifier.startsWith('.')) {
      const absolute = path.resolve(path.dirname(file), specifier);
      if (fs.existsSync(`${absolute}.tsx`)) {
        return loadTsx(`${absolute}.tsx`, stubs, cache);
      }
      return require(path.join(DIST, path.relative(SRC, absolute)));
    }
    return require(specifier);
  };
  new Function('require', 'module', 'exports', js)(localRequire, module_, module_.exports);
  cache.set(file, module_.exports);
  return module_.exports;
}

const appError = (message = 'x') => {
  const error = new TypeError(message);
  error.stack = [
    `TypeError: ${message}`,
    '    at anonymous (address at index.android.bundle:1:1234567)',
    '    at renderWithHooks (address at index.android.bundle:1:98765)',
  ].join('\n');
  return error;
};

module.exports = [
  {
    name: 'error reporter: a report names the screen, version and platform, and carries no message',
    run() {
      const { registerAppIdentity } = require(path.join(DIST, 'features', 'appUpdate', 'appUpdateSignal.js'));
      registerAppIdentity('1.1.0', 'android');
      const client = recorder();
      const reporter = loadReporter(client);
      reporter.resetErrorReportBudget();

      reporter.noteRenderedScreen(false, { tab: 'workout', screen: 'programDay' });
      reporter.reportAppError('js_error', appError("Cannot find exercise Jussi's squat — santeri@example.com"));
      assert.equal(client.sent.length, 1);
      const { name, props } = client.sent[0];
      assert.equal(name, 'app_error');
      assert.equal(props.screen, 'workout/programDay');
      assert.equal(props.appVersion, '1.1.0');
      assert.equal(props.platform, 'android');
      assert.equal(props.name, 'TypeError');
      assert.deepEqual(props.frames, ['index.android.bundle:1:1234567', 'index.android.bundle:1:98765']);
      assert.ok(!JSON.stringify(props).includes('Jussi') && !JSON.stringify(props).includes('santeri'));

      reporter.noteRenderedScreen(true, { tab: 'home', screen: 'dashboard' });
      reporter.reportAppError('render', 'a thrown string with a name in it');
      assert.equal(client.sent[1].props.screen, 'onboarding');
      assert.equal(client.sent[1].props.name, 'NonError');
      reporter.resetErrorReportBudget();
      registerAppIdentity(undefined, undefined);
    },
  },
  {
    name: 'error reporter: the budget holds — one per signature, ten errors and twenty failures a launch',
    run() {
      const client = recorder();
      const reporter = loadReporter(client);
      reporter.resetErrorReportBudget();

      const same = appError();
      for (let index = 0; index < 5; index += 1) {
        reporter.reportAppError('js_error', same);
      }
      assert.equal(client.sent.length, 1, 'the same bug five times is one report');

      // A flood of distinct errors: a different frame each time.
      for (let index = 0; index < 40; index += 1) {
        const error = new RangeError('x');
        error.stack = `RangeError: x\n    at f (address at index.android.bundle:1:${1000 + index})`;
        reporter.reportAppError('js_error', error);
      }
      assert.equal(client.sent.filter((event) => event.name === 'app_error').length, 10);

      const OPS = ['workout_save', 'backup_upload', 'backup_restore', 'database_load', 'workout_load', 'account_delete', 'sign_in'];
      const CODES = ['NETWORK', 'STORE_UNAVAILABLE', 'QUOTA', 'STORAGE_FAILED'];
      for (const op of OPS) {
        for (const code of CODES) {
          reporter.reportOperationFailed(op, code);
          reporter.reportOperationFailed(op, code);
        }
      }
      assert.equal(client.sent.filter((event) => event.name === 'operation_failed').length, 20);
      const first = client.sent.find((event) => event.name === 'operation_failed');
      assert.deepEqual(first.props, { op: 'workout_save', code: 'NETWORK' });
      reporter.resetErrorReportBudget();
    },
  },
  {
    name: 'error reporter: never recursive, never throws, and a development build reports nothing',
    run() {
      // A sink that reports from inside itself, and one that throws.
      let reporter;
      let depth = 0;
      const nested = {
        sent: 0,
        trackEvent() {
          nested.sent += 1;
          depth += 1;
          reporter.reportAppError('js_error', appError('inner'));
          reporter.reportOperationFailed('sign_in');
        },
      };
      reporter = loadReporter(nested);
      reporter.resetErrorReportBudget();
      reporter.reportAppError('js_error', appError('outer'));
      assert.equal(nested.sent, 1, 'an error raised while reporting is dropped');
      assert.equal(depth, 1);

      reporter = loadReporter({
        trackEvent() {
          throw new Error('the sink broke');
        },
      });
      reporter.resetErrorReportBudget();
      assert.doesNotThrow(() => reporter.reportAppError('js_fatal', appError(), { urgent: true }));
      assert.doesNotThrow(() => reporter.reportOperationFailed('workout_save', new Error('x')));
      // …and the guard is released: the next report still works.
      const client = recorder();
      reporter = loadReporter(client);
      reporter.reportAppError('js_error', appError('after'));
      assert.equal(client.sent.length, 1);

      globalThis.__DEV__ = true;
      try {
        reporter.resetErrorReportBudget();
        const before = client.sent.length;
        reporter.reportAppError('js_error', appError('dev'));
        reporter.reportOperationFailed('workout_save', 'NETWORK');
        assert.equal(client.sent.length, before, 'a development build sends nothing');
      } finally {
        delete globalThis.__DEV__;
        reporter.resetErrorReportBudget();
      }
    },
  },
  {
    name: 'error reporting: the global handler reports fatal and non-fatal errors, chains the previous one, and hooks rejections',
    run() {
      const reports = [];
      const calls = [];
      const install = requireWithStubs(path.join(DIST, 'features', 'errorReporting', 'installErrorReporting.js'), {
        './errorReporter': {
          isDevelopmentBuild: () => true, // the module-load install is a no-op here
          reportAppError: () => undefined,
        },
      });
      const report = (...args) => reports.push(args);

      let handler = (error, isFatal) => calls.push(['previous', error, isFatal]);
      const errorUtils = {
        getGlobalHandler: () => handler,
        setGlobalHandler: (next) => {
          handler = next;
        },
      };
      let tracker = null;
      const scope = { ErrorUtils: errorUtils, HermesInternal: { enablePromiseRejectionTracker: (options) => (tracker = options) } };

      install.resetInstallForTests();
      install.installErrorReporting({ scope, report, development: false });

      const boom = new Error('boom');
      handler(boom, true);
      handler(boom, false);
      assert.deepEqual(reports[0], ['js_fatal', boom, { urgent: true }], 'a fatal error is urgent: written before the process ends');
      assert.deepEqual(reports[1], ['js_error', boom, undefined]);
      assert.deepEqual(calls.map((call) => call[0]), ['previous', 'previous'], 'the previous handler still runs, after the report');
      assert.equal(calls[0][2], true);

      assert.ok(tracker, 'the rejection tracker was enabled');
      assert.equal(tracker.allRejections, true);
      tracker.onUnhandled(1, boom);
      assert.deepEqual(reports[2], ['unhandled_rejection', boom]);

      // A report that throws must not stop the original handler.
      install.resetInstallForTests();
      calls.length = 0;
      handler = (error, isFatal) => calls.push(['previous', error, isFatal]);
      install.installErrorReporting({
        scope,
        report: () => {
          throw new Error('reporting broke');
        },
        development: false,
      });
      assert.doesNotThrow(() => handler(boom, true));
      assert.equal(calls.length, 1);

      // A runtime with none of it (web, tests): nothing to hook, nothing thrown.
      install.resetInstallForTests();
      assert.doesNotThrow(() => install.installErrorReporting({ scope: {}, report, development: false }));
      install.resetInstallForTests();
      assert.doesNotThrow(() =>
        install.installErrorReporting({ scope: { ErrorUtils: {}, HermesInternal: {} }, report, development: false }),
      );

      // A development build leaves the red box and Metro's tracker alone.
      install.resetInstallForTests();
      let touched = false;
      install.installErrorReporting({
        scope: { ErrorUtils: { setGlobalHandler: () => (touched = true) } },
        report,
        development: true,
      });
      assert.equal(touched, false);
      install.resetInstallForTests();
    },
  },
  {
    name: 'error reporting: reports obey the reader\'s switch — off queues nothing and sends nothing',
    async run() {
      await withFetch(async (fetchCalls) => {
        // Off from the start (the stored preference said no).
        let storage = memoryStorage();
        let client = loadClient(storage);
        let reporter = loadReporter(client);
        client.setUsageStatisticsEnabled(false);
        await flush();
        reporter.resetErrorReportBudget();
        reporter.reportAppError('js_error', appError());
        reporter.reportOperationFailed('workout_save', 'NETWORK');
        await flush();
        assert.equal(storage.items.size, 0, 'nothing is queued while the switch is off');
        assert.equal(storage.writes, 0);
        assert.equal(fetchCalls.length, 0);

        // Raised before the preference was read, then the answer is no: dropped.
        storage = memoryStorage();
        client = loadClient(storage);
        reporter = loadReporter(client);
        reporter.resetErrorReportBudget();
        reporter.reportAppError('js_error', appError());
        await flush();
        client.setUsageStatisticsEnabled(false);
        await flush();
        assert.equal(storage.items.size, 0, 'what queued while the answer was unknown is thrown away');
        assert.equal(fetchCalls.length, 0);

        // On: queued like any usage event, in the same key.
        storage = memoryStorage();
        client = loadClient(storage);
        reporter = loadReporter(client);
        reporter.resetErrorReportBudget();
        client.setUsageStatisticsEnabled(true);
        await flush();
        reporter.reportAppError('js_error', appError());
        reporter.reportOperationFailed('backup_upload', 'HTTP_503');
        await flush();
        const queued = JSON.parse(storage.items.get(STORAGE_KEY)).queue;
        assert.deepEqual(queued.map((event) => event.name), ['app_error', 'operation_failed']);
        assert.deepEqual(queued[1].props, { op: 'backup_upload', code: 'SERVER_ERROR' });
        client.setUsageStatisticsEnabled(false); // clears the flush timer, and the queue
        await flush();
        assert.equal(storage.items.size, 0);
        reporter.resetErrorReportBudget();
      });
    },
  },
  {
    name: 'error reporting: a fatal error is written to the queue before the handler returns',
    async run() {
      await withFetch(async () => {
        const storage = memoryStorage();
        const client = loadClient(storage);
        const reporter = loadReporter(client);
        reporter.resetErrorReportBudget();
        client.setUsageStatisticsEnabled(true);
        await flush();
        // Loads the queue into memory, as the launch's app_open does.
        client.trackEvent('app_open');
        await flush();
        const writesBefore = storage.writes;

        // No await between the report and the look: the process may be gone by then.
        reporter.reportAppError('js_fatal', appError(), { urgent: true });
        assert.equal(storage.writes, writesBefore + 1, 'the write was issued synchronously');
        const stored = JSON.parse(storage.items.get(STORAGE_KEY)).queue;
        assert.equal(stored[stored.length - 1].name, 'app_error');
        assert.equal(stored[stored.length - 1].props.kind, 'js_fatal');

        // After the switch goes off, even an urgent one is not kept.
        client.setUsageStatisticsEnabled(false);
        const writes = storage.writes;
        reporter.resetErrorReportBudget();
        reporter.reportAppError('js_fatal', appError(), { urgent: true });
        await flush();
        assert.equal(storage.writes, writes);
        assert.equal(storage.items.size, 0);
        reporter.resetErrorReportBudget();
      });
    },
  },
  {
    name: 'error boundary: a render error shows the recovery screen and reports it, and Try again remounts',
    run() {
      const reported = [];
      const stubs = {
        'react-native': {
          View: 'View',
          Text: 'Text',
          Pressable: 'Pressable',
          StyleSheet: { create: (styles) => styles },
        },
        'expo-splash-screen': { hideAsync: async () => undefined },
        '../storage/deviceLocale': { resolveDeviceLanguage: () => 'fi' },
        './errorReporter': { reportAppError: (...args) => reported.push(args) },
      };
      const cache = new Map();
      const { AppErrorBoundary } = loadTsx(path.join(SRC, 'features', 'errorReporting', 'AppErrorBoundary.tsx'), stubs, cache);
      const { AppCrashScreen } = loadTsx(path.join(SRC, 'components', 'AppCrashScreen.tsx'), stubs, cache);

      // The two halves React calls on a throw.
      assert.equal(typeof AppErrorBoundary.getDerivedStateFromError, 'function', 'a class without it is not a boundary');
      assert.equal(AppErrorBoundary.getDerivedStateFromError(new Error('x')).failed, true);

      const boundary = new AppErrorBoundary({ children: 'the app' });
      boundary.setState = (update) => {
        boundary.state = { ...boundary.state, ...(typeof update === 'function' ? update(boundary.state) : update) };
      };
      let out = boundary.render();
      assert.equal(out.type, React.Fragment);
      assert.equal(out.props.children, 'the app', 'healthy: the app');
      assert.equal(out.key, '0');

      const error = new TypeError('Cannot read sets of Jussi');
      boundary.state = { ...boundary.state, ...AppErrorBoundary.getDerivedStateFromError(error) };
      boundary.componentDidCatch(error);
      assert.deepEqual(reported, [['render', error]]);

      out = boundary.render();
      assert.equal(out.type, AppCrashScreen, 'failed: the recovery screen, not the app');
      assert.equal(typeof out.props.onRetry, 'function');

      out.props.onRetry();
      out = boundary.render();
      assert.equal(out.type, React.Fragment, 'Try again shows the app again');
      assert.equal(out.key, '1', 'under a new key, so every child mounts from scratch');
    },
  },
  {
    name: 'error boundary: the recovery screen says nothing was deleted, in English and Finnish, and touches no data',
    run() {
      const { t } = require(path.join(DIST, 'lib', 'i18n.js'));
      assert.match(t('en', 'appCrash.body'), /Nothing has been deleted/);
      assert.match(t('fi', 'appCrash.body'), /Mitään ei ole poistettu/);
      assert.equal(t('en', 'appCrash.retry'), 'Try again');
      assert.equal(t('fi', 'appCrash.retry'), 'Yritä uudelleen');
      assert.notEqual(t('en', 'appCrash.title'), t('fi', 'appCrash.title'));

      const screen = read('src', 'components', 'AppCrashScreen.tsx');
      const boundary = read('src', 'features', 'errorReporting', 'AppErrorBoundary.tsx');
      for (const key of ['appCrash.title', 'appCrash.body', 'appCrash.retry']) {
        assert.ok(screen.includes(`'${key}'`), `the screen must use ${key}`);
      }
      // "Nothing was deleted" must stay true: neither file writes or clears anything.
      for (const source of [screen, boundary]) {
        assert.doesNotMatch(source, /AsyncStorage|removeItem|resetAllData|clearWorkoutBundle|deleteDatabase|multiRemove/);
      }
      assert.match(screen, /from '\.\.\/theme'/, 'the fixed palette from theme.ts');
    },
  },
  {
    name: 'error reporting: the app is wrapped in the boundary, the handlers install first, and every operation has a call site',
    run() {
      const app = read('App.tsx');
      assert.match(
        app,
        /<AppErrorBoundary>\s*<AppProvider>\s*<ThemedRoot \/>\s*<\/AppProvider>\s*<\/AppErrorBoundary>/,
        'the boundary sits outside both providers',
      );
      assert.match(app, /noteRenderedScreen\(onboardingActive, route\);/);

      const index = read('index.ts');
      const firstImport = /^import .*$/m.exec(index.replace(/^\s*\/\/.*$/gm, ''))[0];
      assert.match(firstImport, /installErrorReporting/, 'installed before the rest of the app loads');

      let sources = app;
      const walk = (dir) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) walk(full);
          else if (/\.(ts|tsx)$/.test(entry.name)) sources += fs.readFileSync(full, 'utf8');
        }
      };
      walk(SRC);
      const { FAILED_OPERATIONS } = require(path.join(DIST, 'lib', 'errorReport.js'));
      for (const op of FAILED_OPERATIONS) {
        assert.ok(sources.includes(`reportOperationFailed('${op}'`), `no call site reports ${op}`);
      }
      assert.match(sources, /reportAppError\('render'/);
    },
  },
  {
    name: 'error reporting: the privacy policy says error reports are included, what they carry and what they never do',
    run() {
      const { buildLegalDocument, renderLegalDocumentMarkdown } = require(path.join(DIST, 'lib', 'legalDocuments.js'));
      for (const [language, needles] of [
        ['en', [/error reports/i, /the type of error/i, /where in the app’s code/i, /never sent/i, /error messages/i, /Settings → Usage statistics/]],
        ['fi', [/virheraportit/i, /virheen tyyppi/i, /sovelluksen koodissa/i, /ei koskaan lähetetä/i, /virheilmoitusten tekstejä/i, /Asetukset → Käyttötilastot/]],
      ]) {
        const policy = renderLegalDocumentMarkdown(buildLegalDocument('privacy', language, 'both'));
        const section = policy.slice(policy.indexOf(language === 'en' ? '## Usage statistics' : '## Käyttötilastot'));
        const usage = section.slice(0, section.indexOf('\n## ', 5));
        for (const needle of needles) {
          assert.match(usage, needle, `the ${language} usage-statistics section must say ${needle}`);
        }
      }
    },
  },
];
