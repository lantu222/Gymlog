/**
 * Builds tests/fixtures/backup-history/*.json - the body an OLDER release would
 * have uploaded as a cloud backup, for tests/features/account/backupRoundTripInvariant.test.cjs.
 *
 * Not run by the test suite; run it by hand when the corpus should grow:
 *
 *   node tests/fixtures/backup-history/build-payloads.cjs <workdir> <sha> [sha ...]
 *
 * Each <sha> must also be in tests/fixtures/storage-history (the rows that
 * release had on a phone).
 *
 * What is real and what is modelled, per release:
 *
 * - REAL: the release's own source, taken from git (`git archive <sha> src`) and
 *   compiled in <workdir>. Its loadDatabase / loadWorkoutBundle open the
 *   storage-history rows of the same release, and its own
 *   buildAccountBackupPayload (and encodeAccountBackupBody, when it had one)
 *   turns what it loaded into the request body its upload would have sent.
 * - MODELLED: the data itself (see storage-history/build-corpus.cjs) and
 *   `exportedAt`, a fixed timestamp.
 *
 * Nothing here ran on a phone.
 */
/* eslint-disable */
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const Module = require('node:module');

const REPO = path.resolve(__dirname, '..', '..', '..');
const OUT = __dirname;
const CORPUS = path.join(REPO, 'tests', 'fixtures', 'storage-history');
const WORK = path.resolve(process.argv[2] || path.join(REPO, '..', 'backup-history-work'));
const SHAS = process.argv.slice(3);
const TSC = path.join(REPO, 'node_modules', 'typescript', 'bin', 'tsc');

function git(args, options = {}) {
  return cp.execFileSync('git', args, { cwd: REPO, maxBuffer: 256 * 1024 * 1024, ...options });
}

function compile(sha) {
  const dir = path.join(WORK, sha);
  if (fs.existsSync(path.join(dir, 'dist', 'lib', 'accountBackup.js'))) {
    return dir;
  }
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const tar = cp.spawnSync('tar', ['-x'], { cwd: dir, input: git(['archive', sha, 'src']), maxBuffer: 256 * 1024 * 1024 });
  if (tar.status !== 0) {
    throw new Error(`tar failed for ${sha}: ${String(tar.stderr).slice(0, 300)}`);
  }
  const roots = [
    'src/lib/accountBackup.ts',
    'src/storage/database.ts',
    'src/features/workout/workoutPersistence.ts',
  ];
  fs.writeFileSync(
    path.join(dir, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: {
        module: 'commonjs',
        target: 'ES2020',
        moduleResolution: 'node',
        outDir: 'dist',
        noEmitOnError: false,
        jsx: 'react-jsx',
        skipLibCheck: true,
        esModuleInterop: true,
        resolveJsonModule: true,
        strict: false,
        types: [],
      },
      files: roots.filter((file) => fs.existsSync(path.join(dir, file))),
    }),
  );
  cp.spawnSync('node', [TSC, '-p', dir], { encoding: 'utf8' });
  if (!fs.existsSync(path.join(dir, 'dist', 'lib', 'accountBackup.js'))) {
    throw new Error(`no accountBackup.js emitted for ${sha}`);
  }
  return dir;
}

let currentFake = null;
function createFake() {
  const rows = new Map();
  return {
    rows,
    async getItem(key) {
      return rows.has(key) ? rows.get(key) : null;
    },
    async setItem(key, value) {
      rows.set(key, String(value));
    },
    async removeItem(key) {
      rows.delete(key);
    },
    async multiSet(pairs) {
      for (const [key, value] of pairs) rows.set(key, String(value));
    },
    async multiGet(keys) {
      return keys.map((key) => [key, rows.has(key) ? rows.get(key) : null]);
    },
    async multiRemove(keys) {
      for (const key of keys) rows.delete(key);
    },
    async getAllKeys() {
      return [...rows.keys()];
    },
  };
}

const noop = new Proxy(function () {}, {
  get: (_, prop) => (prop === '__esModule' ? false : noop),
  apply: () => noop,
});
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === '@react-native-async-storage/async-storage') {
    const delegate = new Proxy({}, { get: (_, prop) => (...args) => currentFake[prop](...args) });
    return { __esModule: true, default: delegate };
  }
  if (request === 'react-native') {
    return { I18nManager: { getConstants: () => ({}) }, NativeModules: {}, Platform: { OS: 'android' } };
  }
  try {
    return originalLoad.apply(this, arguments);
  } catch (error) {
    if (!request.startsWith('.') && !path.isAbsolute(request)) {
      // A package the compiled release imports (fflate): the repo's own copy.
      try {
        return originalLoad.call(this, path.join(REPO, 'node_modules', request), parent, isMain);
      } catch {
        return noop;
      }
    }
    throw error;
  }
};

async function buildOne(sha) {
  const corpusFile = fs.readdirSync(CORPUS).find((name) => name.endsWith(`-${sha}.json`));
  if (!corpusFile) {
    throw new Error(`${sha} is not in storage-history`);
  }
  const corpus = JSON.parse(fs.readFileSync(path.join(CORPUS, corpusFile), 'utf8'));
  const dir = compile(sha);
  const dist = path.join(dir, 'dist');

  currentFake = createFake();
  for (const [key, value] of Object.entries(corpus.rows)) {
    currentFake.rows.set(key, value);
  }
  const database = require(path.join(dist, 'storage', 'database.js'));
  const persistence = require(path.join(dist, 'features', 'workout', 'workoutPersistence.js'));
  const backup = require(path.join(dist, 'lib', 'accountBackup.js'));

  const loaded = await database.loadDatabase();
  const bundle = await persistence.loadWorkoutBundle();
  const payload = backup.buildAccountBackupPayload(loaded, bundle.history, '2026-10-01T08:00:00.000Z');
  const body = backup.encodeAccountBackupBody ? backup.encodeAccountBackupBody(payload) : JSON.stringify(payload);
  const fixture = { sha: corpus.sha, date: corpus.date, subject: corpus.subject, body };
  const file = path.join(OUT, `${corpus.date}-${sha}.json`);
  fs.writeFileSync(file, JSON.stringify(fixture) + '\n');
  console.log(sha, corpus.date, `${body.length} chars`, `${loaded.workoutSessions.length} sessions`);
}

(async () => {
  for (const sha of SHAS) {
    try {
      await buildOne(sha);
    } catch (error) {
      console.error('FAILED', sha, error && error.stack ? error.stack.split('\n').slice(0, 6).join('\n') : error);
    }
  }
})();
