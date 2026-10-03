const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { APPLE_DELETION_MARKER_DAYS, buildAccountDeletionPage } = require('../../.test-dist/lib/accountDeletionPage.js');
const { ANALYTICS_RETENTION_MONTHS } = require('../../.test-dist/lib/analyticsRetention.js');
const { t } = require('../../.test-dist/lib/i18n.js');
const { LEGAL_ENTITY, buildLegalDocument } = require('../../.test-dist/lib/legalDocuments.js');
const { WEB_DELETION_ENDPOINT } = require('../../.test-dist/lib/webAccountDeletion.js');

const root = path.join(__dirname, '..', '..');
const LANGUAGES = ['fi', 'en'];

const pageText = (page) =>
  [
    page.title,
    page.summary,
    ...page.sections.flatMap((s) => [s.heading, ...(s.steps ?? []), ...(s.body ?? []), ...(s.bullets ?? [])]),
    ...Object.values(page.web),
  ].join('\n');

const policyText = (language) =>
  buildLegalDocument('privacy', language)
    .sections.flatMap((s) => [...(s.body ?? []), ...(s.bullets ?? [])])
    .join('\n');

module.exports = [
  {
    name: 'account deletion page: deleting on the page comes first, the app second (Play: without the app)',
    run() {
      for (const language of LANGUAGES) {
        const page = buildAccountDeletionPage(language);
        assert.equal(page.sections[0].webDeletion, true, `${language}: the browser form is the first section`);
        assert.equal(page.sections.filter((s) => s.webDeletion).length, 1, `${language}: one form`);
        assert.ok(page.sections[1].steps?.length >= 3, `${language}: the app's steps follow`);
      }
    },
  },
  {
    name: 'account deletion page: the steps and the form name the buttons by the app’s own labels',
    run() {
      for (const language of LANGUAGES) {
        const page = buildAccountDeletionPage(language);
        const steps = page.sections.find((s) => s.steps).steps.join('\n');
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
        assert.equal(page.web.confirmButton, t(language, 'account.deleteAccount'), `${language}: the form's button`);
        assert.ok(page.web.confirm.includes('{email}') && page.web.done.includes('{email}'), `${language}: names the account`);
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
    name: 'account deletion page: retention periods and the retry wait match the server and the privacy policy',
    run() {
      const backup = fs.readFileSync(path.join(root, 'api', 'backup.ts'), 'utf8');
      const serverDays = Number(/const APPLE_SESSION_DAYS = (\d+);/.exec(backup)?.[1]);
      assert.equal(APPLE_DELETION_MARKER_DAYS, serverDays, 'Apple marker days = api/backup.ts APPLE_SESSION_DAYS');
      const windowMs = /const RATE_LIMIT_WINDOW_MS = Number\(process\.env\.BACKUP_RATE_LIMIT_WINDOW_MS \?\? 10 \* 60 \* 1000\);/;
      assert.match(backup, windowMs, 'the form says "ten minutes": the rate-limit window must stay 10 minutes');
      for (const language of LANGUAGES) {
        const text = pageText(buildAccountDeletionPage(language));
        const unit = language === 'fi' ? 'kuukau' : 'months';
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
        assert.equal(Boolean(section.webDeletion), Boolean(en.sections[i].webDeletion), `section ${i} form`);
      });
      assert.deepEqual(Object.keys(fi.web).sort(), Object.keys(en.web).sort());
    },
  },
  {
    name: 'account deletion page: the built page carries the form, the client id and the endpoint',
    run() {
      const out = fs.mkdtempSync(path.join(os.tmpdir(), 'legal-site-'));
      try {
        execFileSync(process.execPath, [path.join(root, 'scripts', 'build-legal-site.cjs')], {
          env: { ...process.env, LEGAL_SITE_OUT_DIR: out, GOOGLE_WEB_CLIENT_ID: 'test-web-client</script>' },
          stdio: 'pipe',
        });
        for (const language of LANGUAGES) {
          const html = fs.readFileSync(path.join(out, `delete-account.${language}.html`), 'utf8');
          assert.ok(html.includes('https://accounts.google.com/gsi/client'), `${language}: loads Google sign-in`);
          assert.ok(html.includes(JSON.stringify(WEB_DELETION_ENDPOINT)), `${language}: sends to the endpoint`);
          assert.ok(html.includes('"action":"delete-account"'), `${language}: as Delete account`);
          assert.ok(html.includes('test-web-client\\u003c/script>'), `${language}: the client id, unable to close the tag`);
          assert.equal(html.split('</script>').length - 1, 2, `${language}: only the page's own two script tags close`);
          assert.ok(html.indexOf('id="gsi-button"') < html.indexOf('<ol>'), `${language}: the form before the app's steps`);
        }
        const index = fs.readFileSync(path.join(out, 'index.html'), 'utf8');
        assert.ok(index.includes('delete-account.fi.html') && index.includes('delete-account.en.html'));
      } finally {
        fs.rmSync(out, { recursive: true, force: true });
      }
    },
  },
];
