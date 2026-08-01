const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

/**
 * Guards for the things that block a Play release and are invisible while
 * developing — nothing here fails at runtime, so only a test notices.
 */

const root = path.join(__dirname, '..');
const readJson = (relative) => JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

module.exports = [
  {
    name: 'release: app.json declares an Android versionCode',
    run() {
      const app = readJson('app.json');
      const versionCode = app?.expo?.android?.versionCode;

      // Without this, prebuild regenerates versionCode 1 every time. Play takes
      // 1 once and then rejects every later upload, with nothing in the repo to
      // bump — the failure lands at submission, not in the build.
      assert.equal(
        typeof versionCode,
        'number',
        'app.json is missing expo.android.versionCode; Play needs it to be declared and bumped.',
      );
      assert.ok(Number.isInteger(versionCode) && versionCode >= 1, 'versionCode must be a positive integer');
    },
  },
  {
    name: 'release: app.json and package.json agree on the version',
    run() {
      const app = readJson('app.json');
      const pkg = readJson('package.json');
      assert.equal(
        app?.expo?.version,
        pkg.version,
        'The store listing reads app.json and the repo reads package.json. They must not drift.',
      );
    },
  },
  {
    name: 'release: no document in docs/ still carries a fill-in placeholder',
    run() {
      // The old draft policy shipped with "[Your name or company name]" in it,
      // sitting next to the real documents where a release could grab the wrong
      // one. Anything bracket-shaped in docs/ is unfinished by definition.
      const offenders = [];
      const walk = (dir) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            walk(full);
          } else if (entry.name.endsWith('.md')) {
            const body = fs.readFileSync(full, 'utf8');
            if (/\[Your [^\]]+\]/i.test(body)) {
              offenders.push(path.relative(root, full));
            }
          }
        }
      };
      walk(path.join(root, 'docs'));

      assert.deepEqual(offenders, [], `Unfilled placeholders in: ${offenders.join(', ')}`);
    },
  },
  {
    name: 'release: docs/privacy-policy.md points at the real policy instead of being one',
    run() {
      // It is not the source of truth and must never look like it again.
      const stub = read('docs/privacy-policy.md');
      assert.ok(stub.length < 2000, 'docs/privacy-policy.md has grown back into a second policy');
      assert.ok(
        stub.includes('legalDocuments.ts'),
        'docs/privacy-policy.md should point at the single source of truth',
      );
    },
  },
  {
    name: 'release: the paywall does not sell a trial the app cannot deliver',
    run() {
      // The Pro page advertises a 7-day free trial and a monthly price. That is
      // deliberate and fine in a demo build (user decision 2026-08-01), and a
      // consumer-law problem the moment it reaches a store: there is no billing,
      // no trial, and nothing to cancel.
      //
      // A guard that is permanently red teaches people to ignore the suite, so
      // this one does not fail on the demo. It fails when the two facts stop
      // agreeing — which is exactly the release step: flip extra.demoBuild to
      // false, and this test names what became a lie.
      const screen = read('src/screens/PremiumScreen.tsx');
      const advertisesTrial = /'pro\.v2\.cta'/.test(screen);
      if (!advertisesTrial) {
        return;
      }

      // Whatever ends up implementing purchases will name one of these.
      const billingMarkers = ['react-native-iap', 'expo-in-app-purchases', 'revenuecat', 'purchases'];
      const pkg = read('package.json').toLowerCase();
      const billingExists = billingMarkers.some((marker) => pkg.includes(marker));
      const demoBuild = readJson('app.json')?.expo?.extra?.demoBuild === true;

      assert.ok(
        billingExists || demoBuild,
        'PremiumScreen advertises a 7-day free trial, no billing library is installed, and ' +
          'app.json no longer declares extra.demoBuild. One of the three has to give: wire ' +
          'billing, take the trial copy off the CTA, or admit this is still a demo.',
      );
    },
  },
];
