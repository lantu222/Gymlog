const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { classifyCoachKeyProbe, coachKeyAlertText } = require('../../.test-dist/lib/coachKeyHealth.js');

const root = path.join(__dirname, '..', '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8').replace(/\r\n/g, '\n');

/**
 * The daily coach key check (2026-09-14). The production key had been refused
 * by Anthropic for an unknown stretch — every answer the on-device fallback —
 * and nothing told anyone who could fix it.
 */
module.exports = [
  {
    name: 'coachKeyHealth: a refused or missing key alerts, a bad minute does not',
    run() {
      assert.deepEqual(classifyCoachKeyProbe({ keyConfigured: true, status: 200 }), { state: 'ok', alert: false });
      assert.deepEqual(classifyCoachKeyProbe({ keyConfigured: true, status: 401 }), { state: 'rejected', alert: true });
      assert.deepEqual(classifyCoachKeyProbe({ keyConfigured: true, status: 403 }), { state: 'rejected', alert: true });
      assert.deepEqual(classifyCoachKeyProbe({ keyConfigured: false, status: null }), { state: 'missing', alert: true });
      // Anthropic or the network having a bad minute: tomorrow's run asks again.
      for (const status of [null, 429, 500, 503, 529, 400]) {
        assert.deepEqual(
          classifyCoachKeyProbe({ keyConfigured: true, status }),
          { state: 'unreachable', alert: false },
          `status ${status}`,
        );
      }
    },
  },
  {
    name: 'coachKeyHealth: the note names the status and the fix, and only when there is one',
    run() {
      const rejected = coachKeyAlertText({ state: 'rejected', alert: true }, 401);
      assert.match(rejected, /Anthropic vastasi 401/);
      assert.match(rejected, /ANTHROPIC_API_KEY/);
      assert.match(rejected, /Redeploy/);
      assert.match(coachKeyAlertText({ state: 'missing', alert: true }, null), /puuttuu/);
      assert.equal(coachKeyAlertText({ state: 'ok', alert: false }, 200), null);
      assert.equal(coachKeyAlertText({ state: 'unreachable', alert: false }, 503), null);
    },
  },
  {
    name: 'coachKeyHealth: the endpoint is scheduled daily, spends no tokens and never leaks the key',
    run() {
      const config = JSON.parse(read('vercel.json'));
      const cron = (config.crons ?? []).find((entry) => entry.path === '/api/coach-health');
      assert.ok(cron, 'vercel.json must schedule /api/coach-health');
      // The Hobby plan refuses anything more often than daily, at deploy time.
      assert.match(cron.schedule, /^\d{1,2} \d{1,2} \* \* \*$/, `schedule "${cron.schedule}" is not a fixed daily run`);

      const source = read('api', 'coach-health.ts');
      // The model list needs a valid key and costs nothing; /v1/messages would bill a call a day.
      assert.match(source, /https:\/\/api\.anthropic\.com\/v1\/models/);
      assert.doesNotMatch(source, /\/v1\/messages/);
      assert.match(source, /classifyCoachKeyProbe\(/);
      assert.match(source, /coachKeyAlertText\(/);

      // Only the cron or a person with the reader secret may run it.
      assert.match(source, /process\.env\.CRON_SECRET/);
      assert.match(source, /if \(!authorized\(req\)\) \{\s*res\.status\(401\)/);

      // The alert goes where the reader already looks, through the channel's own webhook.
      assert.match(source, /process\.env\.SLACK_WEBHOOK_BUGS/);

      // The key goes into the request header and nowhere else.
      const keyUses = source.match(/\bapiKey\b/g) ?? [];
      assert.ok(keyUses.length > 0);
      for (const line of source.split('\n').filter((l) => /\bapiKey\b/.test(l))) {
        assert.doesNotMatch(line, /console\.|\.json\(|JSON\.stringify|text/, `the key may leak on: ${line.trim()}`);
      }
      assert.doesNotMatch(source, /console\.[a-z]+\([^)]*ANTHROPIC_API_KEY/);
    },
  },
];
