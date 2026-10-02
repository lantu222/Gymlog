/**
 * The guard in front of every store build.
 *
 *   node scripts/releaseGuard.cjs --platform ios       before a store build
 *   node scripts/releaseGuard.cjs --platform ios --mark   after the store accepted it
 *
 * iOS build numbers raise themselves (EAS autoIncrement); the version the
 * store shows (`expo.version` in app.json) does not, and a build carrying the
 * version already in the store is one nobody meant to make. So a store
 * release leaves a tag, `<platform>-v<version>`, and the guard refuses a build
 * whose version has that tag already or is not above the last one. A second
 * TestFlight build of a version not yet released passes: the tag is set only
 * with --mark, once that version is live.
 *
 * Android is built locally with Gradle, which reads `android.versionCode` from
 * app.json as it stands — EAS autoIncrement never runs for it. So the Android
 * tag is annotated with the code it shipped (`versionCode=N`) and the guard
 * refuses a build whose code is not above the last released one: Google Play
 * rejects a repeated code, and the build only finds that out after it is done.
 *
 * It also prints what went in since the last release, the start of the
 * "what's new" text, and writes it to release-notes/<platform>-<version>.md
 * for editing — the stores want it, and one person cannot remember it.
 */
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');

const ROOT = path.join(__dirname, '..');
const PLATFORMS = ['ios', 'android'];

function parseVersion(text) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(text ?? '').trim());
  return match ? match.slice(1).map(Number) : null;
}

function compareVersions(a, b) {
  const left = parseVersion(a);
  const right = parseVersion(b);
  for (let i = 0; i < 3; i += 1) {
    if (left[i] !== right[i]) {
      return left[i] < right[i] ? -1 : 1;
    }
  }
  return 0;
}

function tagFor(platform, version) {
  return `${platform}-v${version}`;
}

/** The released versions of a platform, from its tags, newest first. */
function releasedVersions(platform, tags) {
  const prefix = `${platform}-v`;
  return tags
    .filter((tag) => tag.startsWith(prefix) && parseVersion(tag.slice(prefix.length)))
    .map((tag) => tag.slice(prefix.length))
    .sort((a, b) => compareVersions(b, a));
}

/** The versionCode a tag message records, or null when it records none. */
function parseVersionCode(message) {
  const match = /(?:^|\s)versionCode=(\d+)(?:\s|$)/.exec(String(message ?? ''));
  return match ? Number(match[1]) : null;
}

/** The annotation `--mark` puts on a tag: the Android build number it shipped. */
function tagMessageFor({ platform, versionCode }) {
  return platform === 'android' ? `versionCode=${versionCode}` : null;
}

function isBuildCode(value) {
  return Number.isInteger(value) && value > 0;
}

/** What the guard prints about the build number — true for the platform. */
function buildLine({ platform, version, versionCode }) {
  if (platform === 'android') {
    return (
      `Kauppabuildi: android ${version}, versionCode ${versionCode} ` +
      '(Gradle ei nosta sitä: se luetaan app.jsonista, nosta se käsin ennen jokaista julkaisua).'
    );
  }
  return `Kauppabuildi: ${platform} ${version} (buildinumero nousee automaattisesti, EAS).`;
}

/**
 * Whether a store build of `version` may go ahead.
 * `{ ok: true, previous }` or `{ ok: false, reason }`; previous is the last
 * released version, null before the first release.
 *
 * For Android also `versionCode` (what app.json says) and `releasedCodes` (the
 * codes the android tags record; empty when an older tag recorded none).
 */
function decide({ platform, version, tags, versionCode, releasedCodes = [] }) {
  if (!PLATFORMS.includes(platform)) {
    return { ok: false, reason: `Tuntematon alusta "${platform}". Käytä --platform ios tai --platform android.` };
  }
  if (!parseVersion(version)) {
    return { ok: false, reason: `app.jsonin expo.version "${version}" ei ole muotoa X.Y.Z.` };
  }
  const released = releasedVersions(platform, tags);
  const previous = released[0] ?? null;
  if (released.includes(version)) {
    return {
      ok: false,
      previous,
      reason:
        `Versio ${version} on jo julkaistu (${platform}). Nosta expo.version app.jsonissa ` +
        `(esim. ${suggestNext(version)}) ennen uutta kauppabuildia.`,
    };
  }
  if (previous && compareVersions(version, previous) < 0) {
    return {
      ok: false,
      previous,
      reason: `Versio ${version} on pienempi kuin viimeksi julkaistu ${previous} (${platform}). Kaupat eivät ota sitä vastaan.`,
    };
  }
  if (platform === 'android') {
    if (!isBuildCode(versionCode)) {
      return {
        ok: false,
        previous,
        reason: `app.jsonin expo.android.versionCode "${versionCode}" ei ole positiivinen kokonaisluku.`,
      };
    }
    if (previous) {
      const recorded = releasedCodes.filter(isBuildCode);
      const last = recorded.length > 0 ? Math.max(...recorded) : null;
      // An older tag carries no number. app.json has said 1 since before the
      // first build, so 1 is the most that can be ruled out.
      const floor = last ?? 1;
      if (versionCode <= floor) {
        const known =
          last !== null
            ? `viimeksi julkaistun buildin (${tagFor(platform, previous)}) versionCode oli ${last}`
            : `tagiin ${tagFor(platform, previous)} ei ole tallennettu versionCodea, joten vaaditaan yli ${floor}`;
        return {
          ok: false,
          previous,
          reason:
            `app.jsonin expo.android.versionCode on ${versionCode}, mutta ${known}. ` +
            `Google Play ei ota vastaan jo käytettyä koodia. Nosta versionCode arvoon ${floor + 1} tai ylemmäs ` +
            'app.jsonissa ennen buildia (Gradle ei nosta sitä itse).',
        };
      }
    }
  }
  return { ok: true, previous };
}

function suggestNext(version) {
  const [major, minor] = parseVersion(version);
  return `${major}.${minor + 1}.0`;
}

/** The "what's new" draft from commit subjects since the last release. */
function releaseNotes({ platform, version, previous, subjects }) {
  const lines = [`# ${platform === 'ios' ? 'iOS' : 'Android'} ${version}`, ''];
  lines.push(previous ? `Muutokset version ${previous} jälkeen:` : 'Ensimmäinen julkaisu.');
  if (previous) {
    lines.push('');
    if (subjects.length === 0) {
      lines.push('- (ei committeja edellisen julkaisun jälkeen)');
    }
    for (const subject of subjects) {
      lines.push(`- ${subject}`);
    }
  }
  return `${lines.join('\n')}\n`;
}

function git(args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
}

function readApp() {
  const expo = JSON.parse(fs.readFileSync(path.join(ROOT, 'app.json'), 'utf8'))?.expo;
  return { version: expo?.version, versionCode: expo?.android?.versionCode };
}

/** The versionCodes the android tags record, read from their annotations. */
function readReleasedCodes() {
  const rows = git(['for-each-ref', 'refs/tags/android-v*', '--format=%(objecttype)%09%(contents:subject)']);
  return rows
    .split('\n')
    .map((row) => row.split('\t'))
    .filter(([type]) => type === 'tag')
    .map(([, subject]) => parseVersionCode(subject))
    .filter((code) => code !== null);
}

/**
 * Tag a released version and make sure origin has the tag. `run` is `git` that
 * throws on failure, so a failed push cannot read as a finished mark. Returns
 * `{ code, lines }`: what to print, and the exit code.
 *
 * A tag that exists here but not on origin is the leftover of a push that
 * failed; marking again pushes it, and a remote that cannot be asked fails the
 * run rather than assuming the tag went up.
 */
function markRelease({ platform, version, versionCode, run }) {
  if (!PLATFORMS.includes(platform)) {
    return { code: 1, lines: ['Käytä --platform ios tai --platform android.'] };
  }
  if (platform === 'android' && !isBuildCode(versionCode)) {
    return { code: 1, lines: [`app.jsonin expo.android.versionCode "${versionCode}" ei ole positiivinen kokonaisluku.`] };
  }
  const tag = tagFor(platform, version);
  const retry = `Tagi ${tag} on vain tällä koneella. Aja sama komento uudelleen kun origin vastaa.`;
  const pushIt = () => {
    try {
      run(['push', 'origin', tag]);
      return null;
    } catch (error) {
      return `Tagin ${tag} työntö originiin epäonnistui: ${String(error?.message ?? error).split('\n')[0]}\n${retry}`;
    }
  };

  if (run(['tag', '--list', tag]) === tag) {
    const sha = run(['rev-list', '-n', '1', '--abbrev-commit', tag]);
    let onOrigin;
    try {
      onOrigin = run(['ls-remote', '--tags', 'origin', `refs/tags/${tag}`]) !== '';
    } catch {
      return {
        code: 1,
        lines: [`Tagi ${tag} (${sha}) on olemassa, mutta originiin ei saada yhteyttä: ei tiedetä onko se työnnetty. ${retry}`],
      };
    }
    if (onOrigin) {
      return { code: 0, lines: [`${tag} on jo merkitty (${sha}).`] };
    }
    const failure = pushIt();
    if (failure) {
      return { code: 1, lines: [failure] };
    }
    return { code: 0, lines: [`Tagi ${tag} (${sha}) oli vain tällä koneella; työnnetty originiin. Seuraava kauppabuildi vaatii uuden version.`] };
  }

  const lines = [];
  const sha = run(['rev-parse', '--short', 'HEAD']);
  if (run(['status', '--porcelain', '--untracked-files=no']) !== '') {
    lines.push('Varoitus: työpuussa on tallentamattomia muutoksia; tagi osoittaa silti HEADiin eikä sisällä niitä.');
  }
  const message = tagMessageFor({ platform, versionCode });
  run(message ? ['tag', '-a', tag, '-m', message] : ['tag', tag]);
  lines.push(`Tagi ${tag} asetettu commitiin ${sha} (HEAD).`);
  const failure = pushIt();
  if (failure) {
    return { code: 1, lines: [...lines, failure] };
  }
  lines.push(`Merkitty julkaistuksi: ${tag}. Seuraava kauppabuildi vaatii uuden version.`);
  return { code: 0, lines };
}

function argValue(args, name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

async function confirm(question) {
  if (!process.stdin.isTTY || process.env.CI) {
    return true;
  }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise((resolve) => rl.question(question, resolve));
  rl.close();
  return /^(k|kyllä|y|yes)$/i.test(answer.trim());
}

async function main(args) {
  const platform = argValue(args, '--platform');
  const { version, versionCode } = readApp();
  try {
    // The tags another machine set: best effort, offline still checks local ones.
    git(['fetch', '--tags', '--quiet']);
  } catch {
    console.warn('Tagien haku epäonnistui, tarkistetaan vain paikalliset tagit.');
  }
  const tags = git(['tag', '--list']).split('\n').filter(Boolean);

  if (args.includes('--mark')) {
    const result = markRelease({ platform, version, versionCode, run: git });
    for (const line of result.lines) {
      (result.code === 0 ? console.log : console.error)(line);
    }
    return result.code;
  }

  const releasedCodes = platform === 'android' ? readReleasedCodes() : [];
  const decision = decide({ platform, version, tags, versionCode, releasedCodes });
  if (!decision.ok) {
    console.error(`\n✋ ${decision.reason}\n`);
    return 1;
  }
  let subjects = [];
  if (decision.previous) {
    subjects = git(['log', '--no-merges', '--pretty=%s', `${tagFor(platform, decision.previous)}..HEAD`])
      .split('\n')
      .filter(Boolean);
  }
  const notes = releaseNotes({ platform, version, previous: decision.previous, subjects });
  const notesFile = path.join(ROOT, 'release-notes', `${platform}-${version}.md`);
  if (!fs.existsSync(notesFile)) {
    fs.mkdirSync(path.dirname(notesFile), { recursive: true });
    fs.writeFileSync(notesFile, notes);
  }
  console.log(`\n${buildLine({ platform, version, versionCode })}`);
  console.log(`Viimeksi julkaistu: ${decision.previous ?? 'ei vielä mitään'}.\n`);
  console.log(notes);
  console.log(`Muutosluonnos: ${path.relative(ROOT, notesFile)}\n`);
  if (!(await confirm(`Onko ${version} oikea versio tälle julkaisulle? (k/e) `))) {
    console.error('Peruttu. Nosta expo.version app.jsonissa ja aja uudelleen.');
    return 1;
  }
  return 0;
}

if (require.main === module) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (error) => {
      console.error(error);
      process.exit(1);
    },
  );
}

module.exports = {
  buildLine,
  compareVersions,
  decide,
  markRelease,
  parseVersionCode,
  releaseNotes,
  releasedVersions,
  tagFor,
  tagMessageFor,
};
