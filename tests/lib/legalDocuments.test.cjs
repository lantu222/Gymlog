const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  LEGAL_ENTITY,
  LEGAL_LAST_UPDATED,
  buildLegalDocument,
  renderLegalDocumentMarkdown,
} = require('../../.test-dist/lib/legalDocuments.js');

const root = path.join(__dirname, '..', '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

const IDS = ['privacy', 'terms'];
const LANGUAGES = ['en', 'fi'];

module.exports = [
  {
    name: 'both documents build in both languages with no empty sections',
    run() {
      for (const id of IDS) {
        for (const language of LANGUAGES) {
          const doc = buildLegalDocument(id, language);
          assert.equal(doc.id, id);
          assert.ok(doc.title.length > 3, `${id}/${language} needs a title`);
          assert.ok(doc.summary.length > 20, `${id}/${language} needs a summary`);
          assert.ok(doc.updatedLabel.includes(LEGAL_LAST_UPDATED.slice(0, 4)));
          assert.ok(doc.sections.length >= 8, `${id}/${language} is too thin`);
          for (const section of doc.sections) {
            assert.ok(section.heading.length > 2, `${id}/${language} empty heading`);
            const lines = [...(section.body ?? []), ...(section.bullets ?? [])];
            assert.ok(lines.length > 0, `${id}/${language} "${section.heading}" has no content`);
            for (const line of lines) {
              assert.ok(line.trim().length > 0, `${id}/${language} blank line`);
            }
          }
        }
      }
    },
  },
  {
    name: 'the two languages stay structurally parallel',
    run() {
      for (const id of IDS) {
        const en = buildLegalDocument(id, 'en');
        const fi = buildLegalDocument(id, 'fi');
        assert.equal(
          en.sections.length,
          fi.sections.length,
          `${id}: a section exists in one language only — a translated policy that omits a clause is not the same policy`,
        );
        en.sections.forEach((section, index) => {
          const other = fi.sections[index];
          assert.equal(
            (section.body ?? []).length,
            (other.body ?? []).length,
            `${id} section ${index} ("${section.heading}") has a different paragraph count in Finnish`,
          );
          assert.equal(
            (section.bullets ?? []).length,
            (other.bullets ?? []).length,
            `${id} section ${index} ("${section.heading}") has a different bullet count in Finnish`,
          );
        });
      }
    },
  },
  {
    name: 'every document carries the contact address and the publisher',
    run() {
      for (const id of IDS) {
        for (const language of LANGUAGES) {
          const text = renderLegalDocumentMarkdown(buildLegalDocument(id, language));
          assert.ok(text.includes(LEGAL_ENTITY.email), `${id}/${language} has no contact address`);
          assert.ok(text.includes(LEGAL_ENTITY.name), `${id}/${language} does not name the publisher`);
        }
      }
    },
  },
  {
    name: 'the terms carry the health warning in both languages',
    run() {
      const en = renderLegalDocumentMarkdown(buildLegalDocument('terms', 'en')).toLowerCase();
      const fi = renderLegalDocumentMarkdown(buildLegalDocument('terms', 'fi')).toLowerCase();
      // A fitness app that ships terms without these is a liability, not a document.
      for (const needle of ['not medical advice', 'doctor', 'own risk']) {
        assert.ok(en.includes(needle), `English terms are missing "${needle}"`);
      }
      for (const needle of ['ei ole lääketieteellistä', 'lääkär', 'omalla vastuullasi']) {
        assert.ok(fi.includes(needle), `Finnish terms are missing "${needle}"`);
      }
    },
  },
  {
    name: 'the privacy claims still match what the code does',
    run() {
      // Each of these is a factual claim in the policy. If the app grows a new
      // network call, an analytics SDK or a third storage key, this fails
      // before the policy becomes a lie.
      const srcFiles = [];
      const walk = (dir) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) walk(full);
          else if (/\.tsx?$/.test(entry.name)) srcFiles.push(full);
        }
      };
      walk(path.join(root, 'src'));

      // Comments and copy are not call sites. A prose mention of the word
      // was enough to fail this with "update the policy or remove the call",
      // which is a confusing way to be told a sentence was worded badly.
      const isCallSite = (source) =>
        source
          .split(String.fromCharCode(10))
          .filter((line) => {
            const trimmed = line.trim();
            return !trimmed.startsWith('//') && !trimmed.startsWith('*') && !trimmed.startsWith('/*');
          })
          .some((line) => /\bfetch\s*\(/.test(line));
      const fetchSites = srcFiles.filter((file) => isCallSite(fs.readFileSync(file, 'utf8')));
      assert.deepEqual(
        fetchSites.map((file) => path.basename(file)),
        ['aiCoachClient.ts'],
        'The policy says the app has exactly one outbound request. Update the policy or remove the call.',
      );

      const allSource = srcFiles.map((file) => fs.readFileSync(file, 'utf8')).join('\n');
      for (const banned of ['firebase', 'amplitude', 'mixpanel', 'segment.com', 'Sentry', 'AppsFlyer']) {
        assert.ok(
          !allSource.includes(banned),
          `The policy says there is no analytics or crash reporting, but ${banned} appears in src/`,
        );
      }

      // The live keys are @vinha/*. Two @gymlog/* constants also remain — the
      // pre-rename fallback that loadDatabase/loadWorkoutBundle read once — and
      // they are the same two stores, so they are not a third thing to declare.
      // Two live stores, plus the quarantine slot an unreadable database is
      // moved to rather than deleted. The policy declares that one too, in
      // "Where it is stored" — it holds the reader's own data.
      const keys = new Set(allSource.match(/@vinha\/[a-z0-9/]+/g) ?? []);
      assert.deepEqual(
        [...keys].sort(),
        ['@vinha/database/corrupt', '@vinha/database/v1', '@vinha/workout/v1'],
        'The policy declares these storage keys. A new one needs a line in "Where it is stored".',
      );
      const legacy = new Set(allSource.match(/@gymlog\/[a-z0-9/]+/g) ?? []);
      assert.deepEqual(
        [...legacy].sort(),
        ['@gymlog/database/v1', '@gymlog/workout/v1'],
        'The only pre-rename keys left should be the two migration fallbacks.',
      );
    },
  },
  {
    name: 'the settings analytics row states a fact instead of offering a switch',
    run() {
      const settings = read('src/screens/SettingsScreen.tsx');
      const rowBlock = settings.slice(settings.indexOf('icon="analytics"'), settings.indexOf('icon="analytics"') + 400);
      assert.ok(
        !/ToggleSwitch/.test(rowBlock),
        'The analytics row must not be a toggle — the app sends nothing, so a switch is untrue in both positions',
      );
      const i18n = read('src/lib/i18n.ts');
      assert.ok(i18n.includes("'settings.analytics': 'No analytics'"));
      assert.ok(i18n.includes("'settings.analytics': 'Ei analytiikkaa'"));
    },
  },
  {
    name: 'no surface claims push notifications the app cannot send',
    run() {
      // The policy says notifications are scheduled locally and no device token
      // exists. Settings used to say "Push and reminders", which contradicted it.
      const i18n = read('src/lib/i18n.ts');
      // The Settings row and the master switch on the Notifications screen both
      // name the feature, so both have to stay honest about what it is.
      for (const key of ['settings.notifications.sub', 'notif.push']) {
        const line = i18n.split('\n').filter((row) => row.includes(`'${key}'`));
        assert.equal(line.length, 2, `expected an English and a Finnish value for ${key}`);
        for (const row of line) {
          // Only the value: the key itself is allowed to be called notif.push.
          const value = row.slice(row.indexOf(':') + 1);
          assert.ok(
            !/push/i.test(value),
            `"${row.trim()}" promises push notifications; the app schedules them locally`,
          );
        }
      }
    },
  },
  {
    name: 'no surface offers an account the app does not have',
    run() {
      // The policy says there is no account, no sign-in and no server-side
      // profile. Settings used to carry "Sign out" and "Delete account" rows
      // with chevrons and no handler — a promise of something that does not
      // exist anywhere in the app.
      const i18n = read('src/lib/i18n.ts');
      for (const key of ['settings.signOut', 'settings.deleteAccount']) {
        assert.ok(
          !i18n.includes(`'${key}'`),
          `${key} is back. The app has no account, so nothing can sign out of or delete one.`,
        );
      }

      const settings = read('src/screens/SettingsScreen.tsx');
      assert.ok(
        !/signOut|deleteAccount/.test(settings),
        'Settings references an account action again.',
      );
    },
  },
  {
    name: 'the CSV rows in settings reach a real importer and exporter',
    run() {
      // These two sat inert for months. Wired now: import opens the same paste
      // sheet the Programs tab uses, export shares the plan as CSV text.
      const settings = read('src/screens/SettingsScreen.tsx');
      assert.ok(settings.includes('onPress={onImportPlan}'), 'Import plan (CSV) does nothing again');
      assert.ok(settings.includes('onPress={onExportPlan}'), 'Export plan (CSV) does nothing again');

      // The row promised a download for months; there is no file to download.
      const i18n = read('src/lib/i18n.ts');
      const subs = i18n.split('\n').filter((row) => row.includes("'settings.exportCsv.sub'"));
      assert.equal(subs.length, 2, 'expected an English and a Finnish export subtitle');
      for (const row of subs) {
        assert.ok(
          !/download|lataa/i.test(row.slice(row.indexOf(':') + 1)),
          `"${row.trim()}" promises a download; the plan is shared as text.`,
        );
      }
    },
  },
  {
    name: 'both documents are reachable from settings and from the Pro page',
    run() {
      const settings = read('src/screens/SettingsScreen.tsx');
      assert.ok(settings.includes("onOpenLegal('privacy')"), 'Settings privacy row does not open anything');
      assert.ok(settings.includes("onOpenLegal('terms')"), 'Settings terms row does not open anything');

      const premium = read('src/screens/PremiumScreen.tsx');
      assert.ok(premium.includes("onOpenLegal('privacy')"), 'Pro page privacy link is inert text');
      assert.ok(premium.includes("onOpenLegal('terms')"), 'Pro page terms link is inert text');

      const app = read('App.tsx');
      assert.ok(app.includes('<LegalDocumentScreen'), 'The legal screen is never rendered');
      assert.ok(
        (app.match(/screen: 'legal', document/g) ?? []).length >= 2,
        'Both entry points must navigate to the legal route',
      );
    },
  },
  {
    name: 'the exported Markdown matches the in-app documents',
    run() {
      for (const id of IDS) {
        for (const language of LANGUAGES) {
          const file = path.join(root, 'docs', 'legal', `${id}.${language}.md`);
          assert.ok(fs.existsSync(file), `Missing export: run node scripts/export-legal.cjs`);
          // Line endings are git's business, not the document's: checked out on
          // Windows these files are CRLF and the renderer emits LF, so a
          // byte-for-byte comparison failed on every machine that has one —
          // which is a guard nobody can read, not a guard.
          assert.equal(
            fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n'),
            renderLegalDocumentMarkdown(buildLegalDocument(id, language)),
            `docs/legal/${id}.${language}.md is stale — re-run node scripts/export-legal.cjs`,
          );
        }
      }
    },
  },
];
