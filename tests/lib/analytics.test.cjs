const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  ANALYTICS_EVENTS,
  MAX_QUEUED_EVENTS,
  appendToQueue,
  isValidEvent,
  validateBatch,
} = require('../../.test-dist/lib/analytics.js');

const INSTALL = '12345678-1234-4123-8123-123456789abc';
const ok = (name, props) => ({ name, at: '2026-08-25T10:00:00.000Z', ...(props ? { props } : {}) });

module.exports = [
  {
    name: 'analytics: the allowlist is the whole vocabulary, and nothing outside it validates',
    run() {
      for (const name of ANALYTICS_EVENTS) {
        assert.equal(isValidEvent(ok(name)), true, name);
      }
      // The privacy policy stakes its claim on this list being closed.
      assert.equal(isValidEvent(ok('exercise_logged')), false, 'an uninvented event does not pass');
      assert.equal(isValidEvent(ok('screen_view')), false);
      assert.equal(isValidEvent({ ...ok('app_open'), extra: 'x' }), false, 'unknown top-level key rejects');
      assert.equal(isValidEvent(ok('onboarding_step', { step: 3 })), true);
      assert.equal(isValidEvent(ok('onboarding_step', { path: 'questionnaire' })), true);
      // An open props bag is how "just one extra field" becomes tracking.
      assert.equal(isValidEvent(ok('onboarding_step', { weightKg: 82.5 })), false);
      assert.equal(isValidEvent(ok('onboarding_step', { path: 'x'.repeat(33) })), false, 'free text has a cap');
    },
  },
  {
    name: 'analytics: a batch is accepted whole or rejected whole',
    run() {
      const good = { installId: INSTALL, sentAt: '2026-08-25T10:00:00.000Z', events: [ok('app_open')] };
      assert.ok(validateBatch(good));

      // One bad event rejects the batch: a client outside the vocabulary is a
      // bug worth surfacing, not trimming.
      assert.equal(validateBatch({ ...good, events: [ok('app_open'), ok('made_up')] }), null);
      assert.equal(validateBatch({ ...good, installId: 'not-a-uuid' }), null);
      assert.equal(validateBatch({ ...good, events: [] }), null);
      assert.equal(
        validateBatch({ ...good, events: Array.from({ length: 101 }, () => ok('app_open')) }),
        null,
        'an oversized batch means a stuck queue, not a busy user',
      );
    },
  },
  {
    name: 'analytics: the device queue drops the oldest past its cap',
    run() {
      let queue = [];
      for (let index = 0; index < MAX_QUEUED_EVENTS + 25; index += 1) {
        queue = appendToQueue(queue, ok('app_open', { step: index }));
      }
      assert.equal(queue.length, MAX_QUEUED_EVENTS);
      // The recent funnel outlives the stale one.
      assert.equal(queue[queue.length - 1].props.step, MAX_QUEUED_EVENTS + 24);
      assert.equal(queue[0].props.step, 25);
    },
  },
  {
    name: 'analytics: the endpoint validates with the same code the client uses',
    run() {
      // Client and server drift is how an allowlist stops being one.
      const endpoint = fs.readFileSync(path.join(__dirname, '../../api/events.ts'), 'utf8');
      assert.match(endpoint, /import \{ validateBatch \} from '\.\.\/src\/lib\/analytics'/);
      assert.match(endpoint, /access: 'private'/);
      assert.match(endpoint, /x-analytics-secret/);
      assert.match(endpoint, /ANALYTICS_READ_SECRET/);

      // The client goes silently dark without its URL — the fourth variable
      // in the family — and never blocks a caller.
      const client = fs.readFileSync(
        path.join(__dirname, '../../src/features/analytics/analyticsClient.ts'),
        'utf8',
      );
      assert.match(client, /EXPO_PUBLIC_ANALYTICS_URL/);
      assert.match(client, /if \(!ANALYTICS_URL\) \{\s*\r?\n\s*return;/);
    },
  },
  {
    name: 'analytics: the privacy policy tells the truth about it, in both languages',
    run() {
      const legal = fs.readFileSync(path.join(__dirname, '../../src/lib/legalDocuments.ts'), 'utf8');
      assert.match(legal, /Usage statistics/);
      assert.match(legal, /Käyttötilastot/);
      // The old absolute claim would now be a lie.
      assert.doesNotMatch(legal, /The app measures nothing about you/);
      assert.doesNotMatch(legal, /Sovellus ei mittaa sinusta mitään/);
      // And the camera claim died with the photo import, not with analytics —
      // but it dies here, checked.
      assert.doesNotMatch(legal, /No access to location, contacts, camera/);
      // The switch (2026-09-04) is named where the reader would look for it.
      assert.match(legal, /Settings → Usage statistics/);
      assert.match(legal, /Asetukset → Käyttötilastot/);
    },
  },
  {
    name: 'analytics: every event in the vocabulary has a call site',
    run() {
      // A vocabulary entry nothing sends is a promise of measurement that
      // does not happen — the same class as a button that does nothing.
      const roots = ['App.tsx', 'src'];
      let sources = '';
      const walk = (dir) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) walk(full);
          else if (/\.(ts|tsx)$/.test(entry.name)) sources += fs.readFileSync(full, 'utf8');
        }
      };
      const base = path.join(__dirname, '../..');
      sources += fs.readFileSync(path.join(base, 'App.tsx'), 'utf8');
      walk(path.join(base, 'src'));
      for (const name of ANALYTICS_EVENTS) {
        assert.ok(sources.includes(`trackEvent('${name}'`), `no call site for ${name}`);
      }
    },
  },
];
