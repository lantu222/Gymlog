#!/usr/bin/env node
/**
 * The daily glance: pulls the anonymous usage events and prints the numbers
 * the events exist to answer — dailies, the onboarding funnel, and retention.
 *
 *   node scripts/analytics-report.cjs                  # everything
 *   node scripts/analytics-report.cjs --since 2026-08-25
 *
 * Needs EXPO_PUBLIC_ANALYTICS_URL and ANALYTICS_READ_SECRET in .env.local.
 * Downloads and money are not here — Play Console owns those.
 *
 * scripts/analytics-dashboard.cjs draws the same numbers as a local HTML
 * page; both share fetchEvents/aggregate below so they cannot disagree.
 */
const fs = require('node:fs');
const path = require('node:path');

function env() {
  const out = {};
  for (const file of ['.env.local']) {
    const full = path.join(__dirname, '..', file);
    if (!fs.existsSync(full)) continue;
    for (const line of fs.readFileSync(full, 'utf8').split(/\r?\n/)) {
      const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
      if (match) out[match[1]] = match[2];
    }
  }
  return out;
}

/** Pulls and flattens the events. Shared with the HTML dashboard. */
async function fetchEvents(since) {
  const vars = env();
  const url = (vars.EXPO_PUBLIC_ANALYTICS_URL ?? '').trim();
  const secret = (vars.ANALYTICS_READ_SECRET ?? '').trim();
  if (!url || !secret) {
    throw new Error('Need EXPO_PUBLIC_ANALYTICS_URL and ANALYTICS_READ_SECRET in .env.local');
  }
  const query = since ? `?since=${since}&limit=2000` : '?limit=2000';
  const response = await fetch(url + query, { headers: { 'x-analytics-secret': secret } });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  }
  const payload = await response.json();
  const events = [];
  for (const batch of payload.batches ?? []) {
    for (const event of batch.events ?? []) {
      events.push({ installId: batch.installId, name: event.name, at: event.at, props: event.props ?? {} });
    }
  }
  events.sort((a, b) => a.at.localeCompare(b.at));
  return { events, batchTotal: payload.total ?? 0 };
}

const day = (iso) => iso.slice(0, 10);

/** Every number both renderers print, from one pass over the events. */
function aggregate(events) {
  const byDay = new Map();
  for (const event of events) {
    const key = day(event.at);
    if (!byDay.has(key)) byDay.set(key, { installs: new Set(), opens: 0, workouts: 0, coach: 0, paywall: 0 });
    const row = byDay.get(key);
    if (event.name === 'app_open') {
      row.opens += 1;
      row.installs.add(event.installId);
    }
    if (event.name === 'workout_completed') row.workouts += 1;
    if (event.name === 'coach_question_asked') row.coach += 1;
    if (event.name === 'paywall_viewed') row.paywall += 1;
  }
  const dailies = [...byDay.entries()]
    .sort()
    .map(([key, row]) => ({ day: key, actives: row.installs.size, opens: row.opens, workouts: row.workouts, coach: row.coach, paywall: row.paywall }));

  const stepsByInstall = new Map();
  const completed = new Set();
  const adopted = new Set();
  const startedWorkout = new Set();
  const finishedWorkout = new Set();
  for (const event of events) {
    if (event.name === 'onboarding_step' && typeof event.props.path === 'string') {
      if (!stepsByInstall.has(event.installId)) stepsByInstall.set(event.installId, new Set());
      stepsByInstall.get(event.installId).add(event.props.path);
    }
    if (event.name === 'onboarding_completed') completed.add(event.installId);
    if (event.name === 'plan_adopted') adopted.add(event.installId);
    if (event.name === 'workout_started') startedWorkout.add(event.installId);
    if (event.name === 'workout_completed') finishedWorkout.add(event.installId);
  }
  const reached = (step) => [...stepsByInstall.values()].filter((set) => set.has(step)).length;
  const total = new Set(events.map((event) => event.installId)).size;
  const funnel = [
    ['aloitti onboardingin (path)', reached('path')],
    ['perustiedot (about)', reached('about')],
    ['kysely (questionnaire)', reached('questionnaire')],
    ['valmiskatalogi (ready_catalog)', reached('ready_catalog')],
    ['onboarding valmis', completed.size],
    ['ohjelma käytössä', adopted.size],
    ['treeni aloitettu', startedWorkout.size],
    ['treeni kirjattu', finishedWorkout.size],
  ];

  const firstOpen = new Map();
  const openDays = new Map();
  for (const event of events) {
    if (event.name !== 'app_open') continue;
    const key = day(event.at);
    if (!firstOpen.has(event.installId)) firstOpen.set(event.installId, key);
    if (!openDays.has(event.installId)) openDays.set(event.installId, new Set());
    openDays.get(event.installId).add(key);
  }
  const within = (installId, from, to) => {
    const start = new Date(firstOpen.get(installId));
    const days = openDays.get(installId);
    for (let offset = from; offset <= to; offset += 1) {
      const probe = new Date(start.getFullYear(), start.getMonth(), start.getDate() + offset);
      const key = `${probe.getFullYear()}-${String(probe.getMonth() + 1).padStart(2, '0')}-${String(probe.getDate()).padStart(2, '0')}`;
      if (days.has(key)) return true;
    }
    return false;
  };
  const installs = [...firstOpen.keys()];
  const retention = {
    installs: installs.length,
    d2: installs.filter((id) => within(id, 1, 2)).length,
    d7: installs.filter((id) => within(id, 6, 8)).length,
  };

  return { dailies, funnel, funnelTotal: total, retention };
}

module.exports = { fetchEvents, aggregate };

async function main() {
  const sinceArg = process.argv.indexOf('--since');
  const since = sinceArg !== -1 ? process.argv[sinceArg + 1] : undefined;
  const { events, batchTotal } = await fetchEvents(since);
  if (events.length === 0) {
    console.log('No events yet.');
    return;
  }
  const { dailies, funnel, funnelTotal, retention } = aggregate(events);

  console.log('\nPÄIVITTÄIN  (aktiiviset · avaukset · treenit · coach-kysymykset · paywall)');
  for (const row of dailies) {
    console.log(
      `  ${row.day}   ${String(row.actives).padStart(3)} · ${String(row.opens).padStart(3)} · ${String(row.workouts).padStart(3)} · ${String(row.coach).padStart(3)} · ${String(row.paywall).padStart(3)}`,
    );
  }
  console.log(`\nSUPPILO  (${funnelTotal} asennusta nähty)`);
  for (const [label, count] of funnel) {
    const share = funnelTotal ? Math.round((count / funnelTotal) * 100) : 0;
    console.log(`  ${String(count).padStart(4)}  (${String(share).padStart(3)} %)  ${label}`);
  }
  console.log(`\nPALUU  D2: ${retention.d2}/${retention.installs}   D7: ${retention.d7}/${retention.installs}`);
  console.log(`\n${events.length} events, ${batchTotal} batches on the server.`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
