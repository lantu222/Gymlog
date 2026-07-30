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

      const fetchSites = srcFiles.filter((file) => /\bfetch\s*\(/.test(fs.readFileSync(file, 'utf8')));
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

      const keys = new Set(allSource.match(/@gymlog\/[a-z0-9/]+/g) ?? []);
      assert.deepEqual(
        [...keys].sort(),
        ['@gymlog/database/v1', '@gymlog/workout/v1'],
        'The policy says two storage keys. A new one needs a line in "What the app stores".',
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
          assert.equal(
            fs.readFileSync(file, 'utf8'),
            renderLegalDocumentMarkdown(buildLegalDocument(id, language)),
            `docs/legal/${id}.${language}.md is stale — re-run node scripts/export-legal.cjs`,
          );
        }
      }
    },
  },
];
