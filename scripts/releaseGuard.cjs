/**
 * The guard in front of every store build.
 *
 *   node scripts/releaseGuard.cjs --platform ios       before a store build
 *   node scripts/releaseGuard.cjs --platform ios --mark   after the store accepted it
 *
 * Build numbers raise themselves (EAS autoIncrement); the version the store
 * shows (`expo.version` in app.json) does not, and a build carrying the
 * version already in the store is one nobody meant to make. So a store
 * release leaves a tag, `<platform>-v<version>`, and the guard refuses a build
 * whose version has that tag already or is not above the last one. A second
 * TestFlight build of a version not yet released passes: the tag is set only
 * with --mark, once that version is live.
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

/**
 * Whether a store build of `version` may go ahead.
 * `{ ok: true, previous }` or `{ ok: false, reason }`; previous is the last
 * released version, null before the first release.
 */
function decide({ platform, version, tags }) {
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

function readVersion() {
  return JSON.parse(fs.readFileSync(path.join(ROOT, 'app.json'), 'utf8'))?.expo?.version;
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
  const version = readVersion();
  try {
    // The tags another machine set: best effort, offline still checks local ones.
    git(['fetch', '--tags', '--quiet']);
  } catch {
    console.warn('Tagien haku epäonnistui, tarkistetaan vain paikalliset tagit.');
  }
  const tags = git(['tag', '--list']).split('\n').filter(Boolean);

  if (args.includes('--mark')) {
    const tag = tagFor(platform, version);
    if (!PLATFORMS.includes(platform)) {
      console.error('Käytä --platform ios tai --platform android.');
      return 1;
    }
    if (tags.includes(tag)) {
      console.log(`${tag} on jo merkitty.`);
      return 0;
    }
    git(['tag', tag]);
    git(['push', 'origin', tag]);
    console.log(`Merkitty julkaistuksi: ${tag}. Seuraava kauppabuildi vaatii uuden version.`);
    return 0;
  }

  const decision = decide({ platform, version, tags });
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
  console.log(`\nKauppabuildi: ${platform} ${version} (buildinumero nousee automaattisesti).`);
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

module.exports = { compareVersions, decide, releaseNotes, releasedVersions, tagFor };
