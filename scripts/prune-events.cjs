#!/usr/bin/env node
/**
 * Runs the usage-event retention prune by hand — the same endpoint Vercel's
 * monthly cron calls (api/prune-events.ts), proven with the analytics read
 * secret instead of CRON_SECRET.
 *
 *   node scripts/prune-events.cjs --dry     # count what would go, delete nothing
 *   node scripts/prune-events.cjs           # delete batches past the window
 *
 * Needs EXPO_PUBLIC_ANALYTICS_URL and ANALYTICS_READ_SECRET in .env.local
 * (the same two the report script uses). The prune URL is the events URL
 * with its last path segment swapped.
 */
const fs = require('node:fs');
const path = require('node:path');

function env() {
  const out = {};
  const full = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(full)) return out;
  for (const line of fs.readFileSync(full, 'utf8').split(/\r?\n/)) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (match) out[match[1]] = match[2];
  }
  return out;
}

async function main() {
  const dry = process.argv.includes('--dry');
  const vars = env();
  const eventsUrl = (vars.EXPO_PUBLIC_ANALYTICS_URL ?? '').trim();
  const secret = (vars.ANALYTICS_READ_SECRET ?? '').trim();
  if (!eventsUrl || !secret) {
    throw new Error('Need EXPO_PUBLIC_ANALYTICS_URL and ANALYTICS_READ_SECRET in .env.local');
  }
  const pruneUrl = eventsUrl.replace(/\/api\/events\/?$/, '/api/prune-events');
  if (pruneUrl === eventsUrl) {
    throw new Error(`EXPO_PUBLIC_ANALYTICS_URL does not end in /api/events: ${eventsUrl}`);
  }
  const response = await fetch(pruneUrl + (dry ? '?dry=1' : ''), {
    headers: { 'x-analytics-secret': secret },
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${text}`);
  }
  const result = JSON.parse(text);
  console.log(
    `${dry ? 'Would delete' : 'Deleted'} ${result.expired} of ${result.scanned} batches ` +
      `from before ${result.cutoffDay} (retention ${result.retentionMonths} months).`,
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
