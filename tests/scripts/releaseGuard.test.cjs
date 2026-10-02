const assert = require('node:assert/strict');

const guard = require('../../scripts/releaseGuard.cjs');

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
     * `npm run release:android` is a local Gradle build, which takes
     * android.versionCode from app.json as it stands (constant 1 for as long as
     * nobody edits it). EAS autoIncrement never runs for it, so the guard
     * cannot promise a rising build number there — it has to check one.
     */
    name: 'release guard: an Android build needs a versionCode above the last released one',
    run() {
      const base = { platform: 'android', version: '1.2.0', tags: ['android-v1.1.0'] };

      // Released with code 3: 3 is the same build number again, 4 is next.
      const same = guard.decide({ ...base, versionCode: 3, releasedCodes: [3] });
      assert.equal(same.ok, false);
      assert.match(same.reason, /versionCode/);
      assert.match(same.reason, /4/, 'it says what to set');
      assert.equal(guard.decide({ ...base, versionCode: 2, releasedCodes: [3] }).ok, false);
      assert.equal(guard.decide({ ...base, versionCode: 4, releasedCodes: [3] }).ok, true);
      // The highest recorded code counts, whatever order the tags come in.
      assert.equal(guard.decide({ ...base, versionCode: 4, releasedCodes: [5, 3] }).ok, false);

      // An older tag with no number: all that is known is that something was
      // released, and app.json has said 1 since before the first build.
      const unknown = guard.decide({ ...base, versionCode: 1, releasedCodes: [] });
      assert.equal(unknown.ok, false);
      assert.match(unknown.reason, /android-v1\.1\.0/);
      assert.equal(guard.decide({ ...base, versionCode: 2, releasedCodes: [] }).ok, true);

      // Before the first Android release any positive code goes, 1 included.
      assert.equal(guard.decide({ platform: 'android', version: '1.1.0', tags: [], versionCode: 1, releasedCodes: [] }).ok, true);
      // A malformed code is refused rather than compared.
      for (const bad of [undefined, 0, -1, 1.5, '2', null]) {
        assert.equal(guard.decide({ ...base, tags: [], versionCode: bad, releasedCodes: [] }).ok, false, String(bad));
      }
      // iOS build numbers belong to EAS: the code is not looked at.
      assert.equal(guard.decide({ platform: 'ios', version: '1.2.0', tags: ['ios-v1.1.0'] }).ok, true);
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
      assert.match(android, /app\.json/);
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
      const fs = require('node:fs');
      const os = require('node:os');
      const path = require('node:path');
      const { execFileSync, spawnSync } = require('node:child_process');

      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'release-guard-'));
      try {
        const git = (cwd, ...args) =>
          execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
        const remote = path.join(dir, 'remote.git');
        const broken = path.join(dir, 'does-not-exist.git');
        const work = path.join(dir, 'work');
        git(dir, 'init', '--bare', '--quiet', remote);
        fs.mkdirSync(path.join(work, 'scripts'), { recursive: true });
        fs.copyFileSync(path.join(__dirname, '../../scripts/releaseGuard.cjs'), path.join(work, 'scripts', 'releaseGuard.cjs'));
        const setApp = (versionCode) =>
          fs.writeFileSync(
            path.join(work, 'app.json'),
            JSON.stringify({ expo: { version: '1.2.0', android: { versionCode } } }),
          );
        setApp(4);
        git(work, 'init', '--quiet');
        git(work, 'config', 'user.name', 'Test');
        git(work, 'config', 'user.email', 'test@example.com');
        git(work, 'config', 'commit.gpgsign', 'false');
        git(work, 'config', 'tag.gpgsign', 'false');
        git(work, 'add', '.');
        git(work, 'commit', '--quiet', '-m', 'First');
        git(work, 'remote', 'add', 'origin', broken);

        const run = (...args) => {
          const result = spawnSync(process.execPath, [path.join(work, 'scripts', 'releaseGuard.cjs'), ...args], {
            cwd: work,
            encoding: 'utf8',
            env: { ...process.env, CI: '1', GIT_TERMINAL_PROMPT: '0' },
          });
          return { code: result.status, out: `${result.stdout}${result.stderr}` };
        };

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
        const sameCode = run('--platform', 'android');
        assert.notEqual(sameCode.code, 0, sameCode.out);
        // 1.2.0 is released, so a new version is needed too: bump both.
        fs.writeFileSync(
          path.join(work, 'app.json'),
          JSON.stringify({ expo: { version: '1.3.0', android: { versionCode: 4 } } }),
        );
        const stale = run('--platform', 'android');
        assert.notEqual(stale.code, 0, stale.out);
        assert.match(stale.out, /versionCode/);
        fs.writeFileSync(
          path.join(work, 'app.json'),
          JSON.stringify({ expo: { version: '1.3.0', android: { versionCode: 5 } } }),
        );
        const fresh = run('--platform', 'android');
        assert.equal(fresh.code, 0, fresh.out);
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    },
  },
];
