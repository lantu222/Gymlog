const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

const guard = require('../../scripts/releaseGuard.cjs');

/** What `expo prebuild` writes into android/app/build.gradle, trimmed. */
const GRADLE_FIXTURE = (code, name) => `android {
    namespace "app.vinha"
    defaultConfig {
        applicationId "app.vinha"
        minSdkVersion rootProject.ext.minSdkVersion
        versionCode ${code}
        versionName "${name}"
    }
}
`;

module.exports = [
  {
    name: 'release guard: a store build needs a version the store has not had',
    run() {
      // Before the first release anything well-formed goes.
      assert.deepEqual(guard.decide({ platform: 'ios', version: '1.1.0', tags: [] }), { ok: true, previous: null });
      // A second TestFlight build of an unreleased version is fine.
      assert.equal(guard.decide({ platform: 'ios', version: '1.1.0', tags: ['android-v1.1.0'] }).ok, true);

      const released = guard.decide({ platform: 'ios', version: '1.1.0', tags: ['ios-v1.1.0'] });
      assert.equal(released.ok, false);
      assert.match(released.reason, /on jo julkaistu/);
      assert.match(released.reason, /1\.2\.0/);

      const lower = guard.decide({ platform: 'android', version: '1.1.9', tags: ['android-v1.1.0', 'android-v1.2.0'] });
      assert.equal(lower.ok, false);
      assert.match(lower.reason, /pienempi/);

      // Numbers, not strings: 1.10.0 is after 1.9.0.
      assert.deepEqual(guard.decide({ platform: 'ios', version: '1.10.0', tags: ['ios-v1.9.0', 'ios-v1.2.0'] }), {
        ok: true,
        previous: '1.9.0',
      });

      assert.equal(guard.decide({ platform: 'web', version: '1.1.0', tags: [] }).ok, false);
      assert.equal(guard.decide({ platform: 'ios', version: '1.1', tags: [] }).ok, false);
    },
  },
  {
    name: 'release guard: the what’s-new draft lists the commits since the last release',
    run() {
      assert.equal(
        guard.releaseNotes({ platform: 'ios', version: '1.2.0', previous: '1.1.0', subjects: ['Fix a', 'Add b'] }),
        '# iOS 1.2.0\n\nMuutokset version 1.1.0 jälkeen:\n\n- Fix a\n- Add b\n',
      );
      assert.match(guard.releaseNotes({ platform: 'android', version: '1.1.0', previous: null, subjects: [] }), /Ensimmäinen julkaisu/);
      assert.equal(guard.tagFor('android', '1.1.0'), 'android-v1.1.0');
    },
  },
  {
    /**
     * `npm run release:android` is a local Gradle build. EAS autoIncrement
     * never runs for it, so the guard cannot promise a rising build number
     * there — it has to check one.
     */
    name: 'release guard: an Android build needs a versionCode above the last released one',
    run() {
      const base = {
        platform: 'android',
        version: '1.2.0',
        tags: ['android-v1.1.0'],
        gradle: { versionCode: 4, versionName: '1.2.0' },
      };
      const at = (code, taggedCodes, extra = {}) =>
        guard.decide({ ...base, versionCode: code, gradle: { versionCode: code, versionName: '1.2.0' }, taggedCodes, ...extra });

      // Released with code 3: 3 is the same build number again, 4 is next.
      const same = at(3, { '1.1.0': 3 });
      assert.equal(same.ok, false);
      assert.match(same.reason, /versionCode/);
      assert.match(same.reason, /4/, 'it says what to set');
      assert.equal(at(2, { '1.1.0': 3 }).ok, false);
      assert.equal(at(4, { '1.1.0': 3 }).ok, true);

      // The highest recorded code counts, whatever order the tags come in.
      const two = { tags: ['android-v1.0.0', 'android-v1.1.0'] };
      assert.equal(at(4, { '1.0.0': 5, '1.1.0': 3 }, two).ok, false);
      assert.equal(at(6, { '1.0.0': 5, '1.1.0': 3 }, two).ok, true);

      // Before the first Android release any positive code goes, 1 included.
      assert.equal(at(1, {}, { tags: [] }).ok, true);
      // A malformed code is refused rather than compared.
      for (const bad of [undefined, 0, -1, 1.5, '2', null]) {
        assert.equal(guard.decide({ ...base, tags: [], versionCode: bad, taggedCodes: {} }).ok, false, String(bad));
      }
      // iOS build numbers belong to EAS: the code is not looked at.
      assert.equal(guard.decide({ platform: 'ios', version: '1.2.0', tags: ['ios-v1.1.0'] }).ok, true);
    },
  },
  {
    /**
     * The newest tag is the release the next build follows. If it records no
     * number (an older tag, or a lightweight one set by hand) the floor cannot
     * be read off an OLDER tag instead: that one may be far below what shipped.
     * The operator says what the code was, once.
     */
    name: 'release guard: when the newest Android release records no versionCode, the operator has to give it',
    run() {
      const base = { platform: 'android', version: '1.3.0', tags: ['android-v1.1.0', 'android-v1.2.0'] };
      const at = (code, taggedCodes, declaredCode) =>
        guard.decide({
          ...base,
          versionCode: code,
          gradle: { versionCode: code, versionName: '1.3.0' },
          taggedCodes,
          declaredCode,
        });

      // Newest (1.2.0) is bare, the older one says 5: not "above 5".
      const bare = at(6, { '1.1.0': 5, '1.2.0': null });
      assert.equal(bare.ok, false);
      assert.match(bare.reason, /android-v1\.2\.0/);
      assert.match(bare.reason, /--record-code/);
      // Only bare tags.
      assert.equal(at(2, { '1.1.0': null, '1.2.0': null }).ok, false);
      // Declared: the code that build shipped, and the build goes above it.
      assert.equal(at(6, { '1.1.0': 5, '1.2.0': null }, 9).ok, false);
      assert.equal(at(10, { '1.1.0': 5, '1.2.0': null }, 9).ok, true);
      assert.equal(at(2, { '1.1.0': null, '1.2.0': null }, 1).ok, true);
      assert.equal(at(1, { '1.1.0': null, '1.2.0': null }, 1).ok, false);
      // A recorded newest tag needs no declaration; an older bare one does not matter.
      assert.equal(at(6, { '1.1.0': null, '1.2.0': 5 }).ok, true);
    },
  },
  {
    /**
     * Gradle does not read app.json: android/ is generated by `expo prebuild`,
     * which writes versionCode and versionName into android/app/build.gradle,
     * and the release build only runs gradlew. Bumping app.json and building
     * ships the old code, which Play rejects after the build is done.
     */
    name: 'release guard: the Android build must come from a prebuild of the current app.json',
    run() {
      assert.deepEqual(guard.parseGradleVersion(GRADLE_FIXTURE(7, '1.2.0')), { versionCode: 7, versionName: '1.2.0' });
      assert.deepEqual(guard.parseGradleVersion('android { }'), { versionCode: null, versionName: null });
      assert.deepEqual(guard.parseGradleVersion(GRADLE_FIXTURE(7, '1.2.0').replace(/\n/g, '\r\n')), {
        versionCode: 7,
        versionName: '1.2.0',
      });

      const base = { platform: 'android', version: '1.2.0', tags: [], versionCode: 4, taggedCodes: {} };
      assert.equal(guard.decide({ ...base, gradle: { versionCode: 4, versionName: '1.2.0' } }).ok, true);

      // app.json bumped, prebuild not re-run.
      const stale = guard.decide({ ...base, gradle: { versionCode: 3, versionName: '1.2.0' } });
      assert.equal(stale.ok, false);
      assert.match(stale.reason, /3/);
      assert.match(stale.reason, /4/);
      assert.match(stale.reason, /expo prebuild --clean/);
      const renamed = guard.decide({ ...base, gradle: { versionCode: 4, versionName: '1.1.0' } });
      assert.equal(renamed.ok, false);
      assert.match(renamed.reason, /1\.1\.0/);
      assert.match(renamed.reason, /expo prebuild --clean/);
      // An unreadable file is as good as none.
      assert.equal(guard.decide({ ...base, gradle: { versionCode: null, versionName: null } }).ok, false);

      // No android/ folder at all.
      const missing = guard.decide({ ...base, gradle: null });
      assert.equal(missing.ok, false);
      assert.match(missing.reason, /expo prebuild --clean/);
      assert.match(missing.reason, /android\//);

      // The line the guard prints no longer claims app.json is what Gradle reads.
      assert.doesNotMatch(guard.buildLine({ platform: 'android', version: '1.2.0', versionCode: 4 }), /luetaan app\.jsonista/);
    },
  },
  {
    name: 'release guard: the build-number line says what is true for the platform',
    run() {
      const ios = guard.buildLine({ platform: 'ios', version: '1.1.0', versionCode: 1 });
      assert.match(ios, /nousee automaattisesti/);
      const android = guard.buildLine({ platform: 'android', version: '1.1.0', versionCode: 4 });
      assert.doesNotMatch(android, /automaattisesti/, 'Gradle does not raise it');
      assert.match(android, /versionCode 4/);
      assert.match(android, /prebuild/);
    },
  },
  {
    name: 'release guard: the versionCode of a release is read back from its tag message',
    run() {
      assert.equal(guard.parseVersionCode('versionCode=12'), 12);
      assert.equal(guard.parseVersionCode('android 1.2.0\n\nversionCode=7\n'), 7);
      assert.equal(guard.parseVersionCode(''), null);
      assert.equal(guard.parseVersionCode('Merge pull request #1'), null);
      assert.equal(guard.parseVersionCode(undefined), null);
      assert.equal(guard.tagMessageFor({ platform: 'android', versionCode: 5 }), 'versionCode=5');
      assert.equal(guard.tagMessageFor({ platform: 'ios', versionCode: 5 }), null);
    },
  },
  {
    /**
     * `git tag` then `git push origin <tag>`: when the push failed, the tag
     * stayed behind locally and the next run said "already marked" and
     * exited 0 — no other checkout ever saw it, and the version could be
     * released again. Real git, a real bare remote and a real broken one.
     */
    name: 'release guard --mark: a tag whose push failed is pushed on the next run, or the run fails',
    run() {
      const { dir, git, remote, work, setApp, run, cleanup } = makeRepo();
      try {
        const broken = path.join(dir, 'does-not-exist.git');
        setApp('1.2.0', 4);
        git(work, 'add', '.');
        git(work, 'commit', '--quiet', '-m', 'First');
        git(work, 'remote', 'add', 'origin', broken);

        // The push fails: the tag is made, the run says it is not finished.
        const first = run('--platform', 'android', '--mark');
        assert.notEqual(first.code, 0, first.out);
        assert.match(git(work, 'tag', '--list'), /android-v1\.2\.0/);
        assert.equal(git(work, 'tag', '--list', '--format=%(contents:subject)', 'android-v1.2.0'), 'versionCode=4');

        // Again with the remote still gone: never "already marked".
        const second = run('--platform', 'android', '--mark');
        assert.notEqual(second.code, 0, second.out);
        assert.doesNotMatch(second.out, /on jo merkitty/);

        // The remote is back: the local-only tag goes up.
        git(work, 'remote', 'set-url', 'origin', remote);
        const third = run('--platform', 'android', '--mark');
        assert.equal(third.code, 0, third.out);
        assert.match(third.out, /työnnetty/);
        assert.match(git(dir, 'ls-remote', '--tags', remote), /refs\/tags\/android-v1\.2\.0/);

        // And now it really is marked.
        const fourth = run('--platform', 'android', '--mark');
        assert.equal(fourth.code, 0, fourth.out);
        assert.match(fourth.out, /on jo merkitty/);

        // The guard reads the released code back from that tag.
        setApp('1.3.0', 4);
        const stale = run('--platform', 'android');
        assert.notEqual(stale.code, 0, stale.out);
        assert.match(stale.out, /versionCode/);
        setApp('1.3.0', 5);
        const fresh = run('--platform', 'android');
        assert.equal(fresh.code, 0, fresh.out);

        // A tag made on another commit while origin held its own is not "already
        // marked": the two disagree about what the release was.
        const originCommit = git(work, 'rev-parse', '--short', 'android-v1.2.0^{commit}');
        setApp('1.2.0', 4);
        fs.writeFileSync(path.join(work, 'notes.txt'), 'later');
        git(work, 'add', '.');
        git(work, 'commit', '--quiet', '-m', 'Second');
        git(work, 'tag', '-d', 'android-v1.2.0');
        git(work, 'tag', '-a', 'android-v1.2.0', '-m', 'versionCode=4');
        const here = git(work, 'rev-parse', '--short', 'HEAD');
        assert.notEqual(here, originCommit);
        const diverged = run('--platform', 'android', '--mark');
        assert.notEqual(diverged.code, 0, diverged.out);
        assert.doesNotMatch(diverged.out, /on jo merkitty/);
        assert.ok(diverged.out.includes(originCommit), diverged.out);
        assert.ok(diverged.out.includes(here), diverged.out);
      } finally {
        cleanup();
      }
    },
  },
  {
    /**
     * Reads the tags the way the guard does: a message of several paragraphs
     * (the tested parser accepts one), and a newest tag that records nothing.
     */
    name: 'release guard: the tag annotations are read whole, and a bare newest tag needs the code declared',
    run() {
      const { git, work, setApp, run, cleanup } = makeRepo();
      try {
        setApp('1.1.0', 7);
        git(work, 'add', '.');
        git(work, 'commit', '--quiet', '-m', 'First');
        git(work, 'tag', '-a', 'android-v1.0.0', '-m', 'Release 1.0.0', '-m', 'Shipped on Tuesday.', '-m', 'versionCode=7');

        // The code sits in the third paragraph; reading only the subject loses it.
        const same = run('--platform', 'android');
        assert.notEqual(same.code, 0, same.out);
        assert.match(same.out, /versionCode on 7/);
        setApp('1.1.0', 8);
        const next = run('--platform', 'android');
        assert.equal(next.code, 0, next.out);

        // A lightweight tag set by hand is the newest; the older annotated one
        // (7) is no longer the floor.
        git(work, 'tag', 'android-v1.1.0');
        setApp('1.2.0', 8);
        const bare = run('--platform', 'android');
        assert.notEqual(bare.code, 0, bare.out);
        assert.match(bare.out, /android-v1\.1\.0/);
        assert.match(bare.out, /--record-code/);
        const low = run('--platform', 'android', '--released-code', '8');
        assert.notEqual(low.code, 0, low.out);
        setApp('1.2.0', 9);
        const declared = run('--platform', 'android', '--released-code', '8');
        assert.equal(declared.code, 0, declared.out);

        // The gradle file is checked on the real run too.
        const gradle = path.join(work, 'android', 'app', 'build.gradle');
        fs.writeFileSync(gradle, GRADLE_FIXTURE(8, '1.2.0'));
        const unbuilt = run('--platform', 'android', '--released-code', '8');
        assert.notEqual(unbuilt.code, 0, unbuilt.out);
        assert.match(unbuilt.out, /expo prebuild --clean/);
        fs.rmSync(path.join(work, 'android'), { recursive: true, force: true });
        const none = run('--platform', 'android', '--released-code', '8');
        assert.notEqual(none.code, 0, none.out);
        assert.match(none.out, /expo prebuild --clean/);
      } finally {
        cleanup();
      }
    },
  },
  {
    /**
     * `--released-code N` could not pass through `npm run release:android`
     * (npm hands extra arguments to the last command of the script) and was
     * not remembered. `--record-code N` annotates the existing tag with the
     * code and pushes it, so the guard remembers; run with node directly.
     */
    name: 'release guard --record-code: annotates the newest bare tag on its own commit and pushes it',
    run() {
      const { git, remote, work, setApp, run, cleanup } = makeRepo();
      try {
        git(work, 'remote', 'add', 'origin', remote);
        setApp('1.1.0', 8);
        git(work, 'add', '.');
        git(work, 'commit', '--quiet', '-m', 'First');
        const shipped = git(work, 'rev-parse', 'HEAD');
        git(work, 'tag', 'android-v1.1.0'); // set by hand: records nothing
        git(work, 'push', '--quiet', 'origin', 'android-v1.1.0');
        fs.writeFileSync(path.join(work, 'later.txt'), 'later');
        git(work, 'add', '.');
        git(work, 'commit', '--quiet', '-m', 'Second');
        setApp('1.2.0', 9);

        // The stop message names the remedy that works from this shell.
        const stopped = run('--platform', 'android');
        assert.notEqual(stopped.code, 0, stopped.out);
        assert.match(stopped.out, /node scripts\/releaseGuard\.cjs --platform android --record-code N/);
        assert.match(stopped.out, /npm run release:android -- /);

        // Bad numbers are errors, not silence (--released-code used to be ignored).
        assert.notEqual(run('--platform', 'android', '--record-code').code, 0);
        assert.notEqual(run('--platform', 'android', '--record-code', 'abc').code, 0);
        assert.notEqual(run('--platform', 'android', '--released-code=abc').code, 0);
        // The equals form is read, for one run.
        assert.equal(run('--platform', 'android', '--released-code=8').code, 0);
        assert.notEqual(run('--platform', 'android', '--released-code=9').code, 0);

        const recorded = run('--platform', 'android', '--record-code=8');
        assert.equal(recorded.code, 0, recorded.out);
        assert.equal(git(work, 'cat-file', '-t', 'android-v1.1.0'), 'tag');
        assert.equal(git(work, 'tag', '--list', '--format=%(contents)', 'android-v1.1.0'), 'versionCode=8');
        assert.equal(git(work, 'rev-parse', 'android-v1.1.0^{commit}'), shipped, 'the commit is the one that shipped');
        // On origin too: a lightweight tag was replaced by the annotated one.
        const onOrigin = git(work, 'ls-remote', '--tags', remote);
        assert.match(onOrigin, /refs\/tags\/android-v1\.1\.0\^\{\}/);
        assert.ok(onOrigin.includes(shipped));

        // Remembered: no flag needed now.
        assert.equal(run('--platform', 'android').code, 0);
        setApp('1.2.0', 8);
        assert.notEqual(run('--platform', 'android').code, 0);
        setApp('1.2.0', 9);

        // Again: nothing to do. A different number is two stories: refused.
        const again = run('--platform', 'android', '--record-code', '8');
        assert.equal(again.code, 0, again.out);
        assert.match(again.out, /myös originissa/);
        const other = run('--platform', 'android', '--record-code', '7');
        assert.notEqual(other.code, 0, other.out);
        assert.equal(git(work, 'tag', '--list', '--format=%(contents)', 'android-v1.1.0'), 'versionCode=8');
      } finally {
        cleanup();
      }
    },
  },
  {
    name: 'release guard --record-code: a tag that points elsewhere on origin is left alone, an unreachable origin retries',
    run() {
      const { dir, git, remote, work, setApp, run, cleanup } = makeRepo();
      try {
        git(work, 'remote', 'add', 'origin', remote);
        setApp('1.1.0', 8);
        git(work, 'add', '.');
        git(work, 'commit', '--quiet', '-m', 'First');
        git(work, 'tag', 'android-v1.1.0');
        git(work, 'push', '--quiet', 'origin', 'android-v1.1.0');
        // Locally the tag moves to another commit (made on another machine's story).
        fs.writeFileSync(path.join(work, 'later.txt'), 'later');
        git(work, 'add', '.');
        git(work, 'commit', '--quiet', '-m', 'Second');
        git(work, 'tag', '-f', 'android-v1.1.0');
        const diverged = run('--platform', 'android', '--record-code', '8');
        assert.notEqual(diverged.code, 0, diverged.out);
        assert.match(diverged.out, /eri julkaisusta/);
        assert.match(git(work, 'ls-remote', '--tags', remote), /android-v1\.1\.0$/m, 'origin is untouched');

        // Origin gone: annotated here, said so, and the same command finishes it later.
        git(work, 'tag', '-f', 'android-v1.1.0', 'HEAD~1');
        git(work, 'remote', 'set-url', 'origin', path.join(dir, 'does-not-exist.git'));
        const offline = run('--platform', 'android', '--record-code', '8');
        assert.notEqual(offline.code, 0, offline.out);
        assert.match(offline.out, /ei saada yhteyttä/);
        assert.equal(git(work, 'tag', '--list', '--format=%(contents)', 'android-v1.1.0'), 'versionCode=8');
        git(work, 'remote', 'set-url', 'origin', remote);
        const back = run('--platform', 'android', '--record-code', '8');
        assert.equal(back.code, 0, back.out);
        assert.match(back.out, /työnnetty/);
      } finally {
        cleanup();
      }
    },
  },
  {
    /**
     * A failed push hid git's own words behind "epäonnistui", and an origin
     * that was down read the same as one that said no.
     */
    name: 'release guard: a failed tag push says what git said, and whether origin was unreachable or refused it',
    run() {
      const down = guard.describePushFailure('android-v1.1.0', {
        message: 'Command failed: git push',
        stderr:
          "fatal: unable to access 'https://example.invalid/r.git/': Could not resolve host: example.invalid\n",
      });
      assert.match(down, /origin ei vastaa/);
      assert.match(down, /Could not resolve host: example\.invalid/);
      assert.match(down, /Aja sama komento uudelleen/);

      const refused = guard.describePushFailure('android-v1.1.0', {
        message: 'Command failed: git push',
        stderr:
          'To origin\n ! [rejected]        android-v1.1.0 -> android-v1.1.0 (already exists)\nerror: failed to push some refs\n',
      });
      assert.match(refused, /origin hylkäsi/);
      assert.match(refused, /already exists/);
      assert.doesNotMatch(refused, /Aja sama komento uudelleen/, 'retrying does not help a refusal');

      // Through the real script: a remote that is not there.
      const { dir, git, work, setApp, run, cleanup } = makeRepo();
      try {
        setApp('1.2.0', 4);
        git(work, 'add', '.');
        git(work, 'commit', '--quiet', '-m', 'First');
        git(work, 'remote', 'add', 'origin', path.join(dir, 'does-not-exist.git'));
        const result = run('--platform', 'android', '--mark');
        assert.notEqual(result.code, 0, result.out);
        assert.match(result.out, /origin ei vastaa/);
        assert.match(result.out, /does not appear to be a git repository|Could not read from remote/i);
      } finally {
        cleanup();
      }
    },
  },
  {
    name: 'release guard: the prebuild remedy is runnable from PowerShell as well as bash',
    run() {
      const reasons = [
        guard.buildLine({ platform: 'android', version: '1.1.0', versionCode: 4 }),
        guard.decide({
          platform: 'android',
          version: '1.1.0',
          tags: [],
          versionCode: 4,
          gradle: null,
        }).reason,
        guard.decide({
          platform: 'android',
          version: '1.1.0',
          tags: [],
          versionCode: 4,
          gradle: { versionCode: 3, versionName: '1.1.0' },
        }).reason,
      ];
      for (const text of reasons) {
        assert.ok(text.includes('$env:CI=1; npx expo prebuild --clean'), text);
        assert.ok(text.includes('CI=1 npx expo prebuild --clean'), text);
      }
      // The docs give the same two forms.
      const docs = fs.readFileSync(path.join(__dirname, '../../docs/ios-launch.md'), 'utf8');
      assert.ok(docs.includes('$env:CI=1; npx expo prebuild --clean'));
      assert.match(docs, /--record-code N/);
    },
  },
];

/** A throwaway repo with the guard copied in, and a bare remote beside it. */
function makeRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'release-guard-'));
  const git = (cwd, ...args) =>
    execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const remote = path.join(dir, 'remote.git');
  const work = path.join(dir, 'work');
  git(dir, 'init', '--bare', '--quiet', remote);
  fs.mkdirSync(path.join(work, 'scripts'), { recursive: true });
  fs.copyFileSync(path.join(__dirname, '../../scripts/releaseGuard.cjs'), path.join(work, 'scripts', 'releaseGuard.cjs'));
  git(work, 'init', '--quiet');
  git(work, 'config', 'user.name', 'Test');
  git(work, 'config', 'user.email', 'test@example.com');
  git(work, 'config', 'commit.gpgsign', 'false');
  git(work, 'config', 'tag.gpgsign', 'false');
  // app.json is tracked; android/ is generated and ignored, as in the app.
  fs.writeFileSync(path.join(work, '.gitignore'), 'android/\nrelease-notes/\n');
  const setApp = (version, versionCode) => {
    fs.writeFileSync(path.join(work, 'app.json'), JSON.stringify({ expo: { version, android: { versionCode } } }));
    fs.mkdirSync(path.join(work, 'android', 'app'), { recursive: true });
    fs.writeFileSync(path.join(work, 'android', 'app', 'build.gradle'), GRADLE_FIXTURE(versionCode, version));
  };
  const run = (...args) => {
    const result = spawnSync(process.execPath, [path.join(work, 'scripts', 'releaseGuard.cjs'), ...args], {
      cwd: work,
      encoding: 'utf8',
      env: { ...process.env, CI: '1', GIT_TERMINAL_PROMPT: '0' },
    });
    return { code: result.status, out: `${result.stdout}${result.stderr}` };
  };
  const cleanup = () => fs.rmSync(dir, { recursive: true, force: true });
  return { dir, git, remote, work, setApp, run, cleanup };
}
