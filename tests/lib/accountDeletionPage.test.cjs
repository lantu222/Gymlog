const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { APPLE_DELETION_MARKER_DAYS, buildAccountDeletionPage } = require('../../.test-dist/lib/accountDeletionPage.js');
const { ANALYTICS_RETENTION_MONTHS } = require('../../.test-dist/lib/analyticsRetention.js');
const { t } = require('../../.test-dist/lib/i18n.js');
const { LEGAL_ENTITY, buildLegalDocument } = require('../../.test-dist/lib/legalDocuments.js');

const root = path.join(__dirname, '..', '..');
const LANGUAGES = ['fi', 'en'];

const pageText = (page) =>
  [
    page.title,
    page.summary,
    ...page.sections.flatMap((s) => [s.heading, ...(s.steps ?? []), ...(s.body ?? []), ...(s.bullets ?? [])]),
  ].join('\n');

const policyText = (language) =>
  buildLegalDocument('privacy', language)
    .sections.flatMap((s) => [...(s.body ?? []), ...(s.bullets ?? [])])
    .join('\n');

module.exports = [
  {
    name: 'account deletion page: the steps name the buttons by the app’s own labels',
    run() {
      for (const language of LANGUAGES) {
        const page = buildAccountDeletionPage(language);
        const steps = page.sections[0].steps.join('\n');
        for (const key of ['tabs.profile', 'settings.title', 'account.deleteAccount']) {
          assert.ok(steps.includes(t(language, key)), `${language}: steps should name ${key} ("${t(language, key)}")`);
        }
        const dangerZone = t(language, 'settings.section.dangerZone');
        assert.ok(
          steps.toLocaleLowerCase().includes(dangerZone.toLocaleLowerCase()),
          `${language}: steps should name the ${dangerZone} section`,
        );
        const text = pageText(page);
        assert.ok(text.includes(t(language, 'settings.resetData')), `${language}: names Reset all data`);
        assert.ok(text.includes(t(language, 'account.deleteRemote')), `${language}: names Delete cloud backup`);
      }
    },
  },
  {
    name: 'account deletion page: names the publisher and the privacy contact',
    run() {
      for (const language of LANGUAGES) {
        const text = pageText(buildAccountDeletionPage(language));
        assert.ok(text.includes(LEGAL_ENTITY.name), `${language}: publisher`);
        assert.ok(text.includes(LEGAL_ENTITY.email), `${language}: contact`);
      }
    },
  },
  {
    name: 'account deletion page: retention periods match the server and the privacy policy',
    run() {
      const backup = fs.readFileSync(path.join(root, 'api', 'backup.ts'), 'utf8');
      const serverDays = Number(/const APPLE_SESSION_DAYS = (\d+);/.exec(backup)?.[1]);
      assert.equal(APPLE_DELETION_MARKER_DAYS, serverDays, 'Apple marker days = api/backup.ts APPLE_SESSION_DAYS');
      for (const language of LANGUAGES) {
        const text = pageText(buildAccountDeletionPage(language));
        const unit = language === 'fi' ? 'kuukautta' : 'months';
        assert.ok(text.includes(`${ANALYTICS_RETENTION_MONTHS} ${unit}`), `${language}: statistics retention`);
        assert.ok(text.includes(`${APPLE_DELETION_MARKER_DAYS} `), `${language}: Apple marker days`);
        const policy = policyText(language);
        assert.ok(policy.includes(`${ANALYTICS_RETENTION_MONTHS} ${unit}`), `${language}: policy states the same months`);
        assert.ok(policy.includes(`${APPLE_DELETION_MARKER_DAYS} `), `${language}: policy states the same days`);
        assert.ok(policy.includes(t(language, 'account.deleteAccount')), `${language}: policy names the same button`);
      }
    },
  },
  {
    name: 'account deletion page: Finnish and English have the same shape',
    run() {
      const [fi, en] = LANGUAGES.map(buildAccountDeletionPage);
      assert.equal(fi.sections.length, en.sections.length);
      fi.sections.forEach((section, i) => {
        for (const field of ['steps', 'body', 'bullets']) {
          assert.equal(section[field]?.length ?? 0, en.sections[i][field]?.length ?? 0, `section ${i} ${field}`);
        }
      });
      assert.ok(fi.sections[0].steps.length >= 3, 'the steps come first');
    },
  },
];
