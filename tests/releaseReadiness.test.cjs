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
      // The onboarding paywall makes the same promise, louder and to every new
      // user, so it is covered by the same guard.
      const paywall = read('src/screens/ProPaywallScreen.tsx');
      const advertisesTrial = /'pro\.v2\.cta'/.test(screen) || /'paywall\.cta'/.test(paywall);
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
        'A paywall advertises a 7-day free trial, no billing library is installed, and ' +
          'app.json no longer declares extra.demoBuild. One of the three has to give: wire ' +
          'billing, take the trial copy off the CTA, or admit this is still a demo.',
      );
    },
  },
  {
    name: 'release: nothing that needs a server ships pretending it has one',
    run() {
      // Two placeholders are allowed to exist while this is a demo, and both
      // become lies the moment it is not. Same shape as the paywall's invented
      // cohort: the flag is the permission slip, and this test is what makes
      // the permission expire.
      const demoBuild = readJson('app.json')?.expo?.extra?.demoBuild === true;

      // 1 · Trending. Social proof needs other people; this device only knows
      //     what its owner did. Real numbers need a server that counts starts.
      const trending = read('src/lib/programTrendingDemo.ts');
      assert.match(
        trending,
        /return isDemoBuild\(\) \? DEMO_TRENDING : null/,
        'the invented start counts must be unreachable outside a demo build',
      );

      // 2 · "Continue with Google" and "Continue with Apple". Both currently
      //     call the same handler and sign nobody in. A user who presses one
      //     reasonably believes their data is now tied to that account; it is
      //     not, and a reinstall takes everything.
      const welcome = read('src/screens/WelcomeScreen.tsx');
      const providerHandlers = (welcome.match(/onPress=\{onContinue\}/g) ?? []).length;
      const providersAreDecorative = providerHandlers > 1;

      if (!demoBuild) {
        // Collected rather than thrown one at a time: on the day this fires,
        // the person reading it wants the whole list, not the first item and
        // another run to find the second.
        const problems = [];
        if (providersAreDecorative) {
          problems.push(
            'Welcome still routes both provider buttons to the same onContinue, so neither '
              + 'signs anyone in. Wire the providers to real identity, or take the buttons off '
              + 'the screen.',
          );
        }

        // A start counter is collection, and Settings currently promises the
        // opposite. Shipping the row without rewriting that sentence would
        // make the app lie in Settings to sell a row on the Programs tab.
        const i18n = read('src/lib/i18n.ts');
        const claimsNoCollection = /'settings\.analytics\.sub': 'We collect nothing/.test(i18n);
        const rendersTrending = /trendingItems && trendingItems\.length > 0/.test(
          read('src/screens/ProgramsHomeScreen.tsx'),
        );
        if (rendersTrending && claimsNoCollection) {
          problems.push(
            'The Programs tab renders a start counter and Settings still says "We collect '
              + 'nothing". A server-backed counter is collection: rewrite the Settings copy, '
              + 'or drop the row.',
          );
        }

        assert.deepEqual(problems, [], problems.join(String.fromCharCode(10)));
      }
    },
  },
  {
    name: 'release: the paywall does not quote a study nobody ran',
    run() {
      // "1.9x faster to a new PR · 200+ decisions automated · +34% more volume,
      // n = 4,812" is a made-up cohort. The design it came from says so in its
      // own note ("Hero numbers are still placeholders"), and it is the same
      // class of claim the 2026-07-28 Pro audit already stripped once.
      //
      // So the figures hang off the demo flag, and this asserts the wiring
      // rather than the taste: a release build must not be able to render them.
      const paywall = read('src/screens/ProPaywallScreen.tsx');
      assert.match(
        paywall,
        /const showStats = isDemoBuild\(\)/,
        'the hero statistics must stay behind the demo flag until they are measured',
      );
      assert.match(
        paywall,
        /\{showStats \? \(/,
        'the statistics block must be gated by showStats, not merely computed',
      );
    },
  },
];
