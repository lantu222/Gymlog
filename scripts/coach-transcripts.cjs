#!/usr/bin/env node
/**
 * TEMPORARY development tool: print the coach transcript log.
 *
 * Reads api/transcripts.ts on the deployed backend (same origin as
 * EXPO_PUBLIC_AI_COACH_API_URL) with TRANSCRIPT_READ_SECRET from .env.local,
 * and prints each conversation: who asked (signed-in email or "anonymous"),
 * when, the question, and the coach's answer as sections.
 *
 *   node scripts/coach-transcripts.cjs                 # everything, newest first
 *   node scripts/coach-transcripts.cjs --since 2026-08-23
 *   node scripts/coach-transcripts.cjs --who puoliso@example.com
 *   node scripts/coach-transcripts.cjs --limit 20 --json
 *
 * Delete together with api/transcripts.ts before Play — the release guard
 * in tests/releaseReadiness.test.cjs lists both.
 */
const fs = require('node:fs');
const path = require('node:path');

function readEnvLocal() {
  const file = path.join(__dirname, '..', '.env.local');
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^"|"$/g, '');
  }
  return out;
}

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
}

(async () => {
  const env = { ...readEnvLocal(), ...process.env };
  const base = (env.EXPO_PUBLIC_AI_COACH_API_URL || '').replace(/\/api\/ai-coach$/, '');
  const secret = env.TRANSCRIPT_READ_SECRET;
  if (!base || !secret) {
    console.error('Need EXPO_PUBLIC_AI_COACH_API_URL and TRANSCRIPT_READ_SECRET in .env.local');
    process.exit(1);
  }
  const since = arg('since');
  const who = arg('who');
  const limit = arg('limit', '200');
  const url = new URL('/api/transcripts', base);
  if (since) url.searchParams.set('since', since);
  url.searchParams.set('limit', limit);

  const res = await fetch(url, { headers: { 'x-transcript-secret': secret } });
  if (!res.ok) {
    console.error(`HTTP ${res.status}: ${await res.text()}`);
    process.exit(1);
  }
  const data = await res.json();
  let entries = data.entries.filter((e) => !e.corrupt);
  if (who) entries = entries.filter((e) => (e.reporter || '').toLowerCase().includes(who.toLowerCase()));

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(entries, null, 2));
    return;
  }

  // Oldest first when reading; the endpoint returns newest first.
  entries.reverse();
  let lastDay = '';
  for (const e of entries) {
    const at = new Date(e.at);
    const day = at.toLocaleDateString('fi-FI');
    if (day !== lastDay) {
      console.log(`\n━━━ ${day} ━━━`);
      lastDay = day;
    }
    const time = at.toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' });
    const who = e.reporter || 'anonymous';
    const meta = `${e.source}${e.model ? ` · ${e.model}` : ''}${e.durationMs ? ` · ${(e.durationMs / 1000).toFixed(1)} s` : ''}`;
    console.log(`\n[${time}] ${who}  (${meta})`);
    console.log(`  Q: ${e.prompt}`);
    const a = e.answer;
    if (!a) {
      console.log('  A: (no answer)');
      continue;
    }
    console.log(`  A: ${a.takeaway}`);
    for (const [key, mark] of [['why', '•'], ['nextSteps', '#'], ['plan', '→']]) {
      for (const line of a[key] || []) console.log(`     ${mark} ${line}`);
    }
  }
  console.log(`\n${entries.length} of ${data.total} conversation(s)${since ? ` since ${since}` : ''}.`);
})();
