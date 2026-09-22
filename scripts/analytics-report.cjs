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
 * page; both share fetchEvents/aggregate below so they cannot disagree. The
 * arithmetic is exported on its own too, and tests/scripts/analyticsReport
 * holds it to fixed events (analytics audit, 2026-09-21).
 */
const fs = require('node:fs');
const path = require('node:path');

/**
 * A day is a day where the readers live. `iso.slice(0, 10)` was the UTC
 * date, and midnight in Helsinki is 21:00 or 22:00 UTC: a reader who opened
 * the app at 23:30 and again at 00:30 had opened it twice on one day, so
 * they never "came back the next day".
 */
const TIME_ZONE = 'Europe/Helsinki';
/** Batches per request; the endpoint caps a page at this. */
const PAGE_SIZE = 500;
/** A server whose `next` never ends must not keep this running all night. */
const MAX_PAGES = 400;

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

/**
 * Every batch the query matches, page by page, flattened into events.
 *
 * The request used to be one `limit=2000`, and past 2000 batches the server
 * kept the newest and said nothing: the report shrank without a word. Now
 * each page names the next, and what could not be read is counted, so the
 * caller can say when the numbers are not everything. `fetchImpl` is the
 * test's way in.
 */
async function fetchEventPages({ url, secret, since, fetchImpl = fetch }) {
  const events = [];
  let batchTotal = 0;
  let batchesFetched = 0;
  let unreadable = 0;
  let cursor;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const request = new URL(url);
    if (since) request.searchParams.set('since', since);
    request.searchParams.set('limit', String(PAGE_SIZE));
    if (cursor) request.searchParams.set('cursor', cursor);
    const response = await fetchImpl(request.toString(), { headers: { 'x-analytics-secret': secret } });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }
    const payload = await response.json();
    // The first page carries the total; the others carry none.
    batchTotal = Math.max(batchTotal, Number(payload.total) || 0);
    unreadable += Number(payload.unreadable) || 0;
    for (const batch of payload.batches ?? []) {
      batchesFetched += 1;
      for (const event of batch.events ?? []) {
        events.push({ installId: batch.installId, name: event.name, at: event.at, props: event.props ?? {} });
      }
    }
    // A server from before paging sends no `next`; one page is then all
    // there is, and the coverage line says what it missed.
    if (typeof payload.next !== 'string' || payload.next === cursor) {
      break;
    }
    cursor = payload.next;
  }
  events.sort((a, b) => a.at.localeCompare(b.at));
  return { events, batchTotal, batchesFetched, unreadable };
}

/** Pulls and flattens the events. Shared with the HTML dashboard. */
async function fetchEvents(since) {
  const vars = env();
  const url = (vars.EXPO_PUBLIC_ANALYTICS_URL ?? '').trim();
  const secret = (vars.ANALYTICS_READ_SECRET ?? '').trim();
  if (!url || !secret) {
    throw new Error('Need EXPO_PUBLIC_ANALYTICS_URL and ANALYTICS_READ_SECRET in .env.local');
  }
  return fetchEventPages({ url, secret, since });
}

/** One line when the numbers below are not from every batch, or null. */
function coverageWarning({ batchesFetched, batchTotal, unreadable }) {
  if (batchesFetched >= batchTotal) {
    return null;
  }
  const unread = unreadable > 0 ? `, ${unreadable} lukukelvotonta` : '';
  return `VAROITUS: luettiin ${batchesFetched}/${batchTotal} erää${unread} — alla olevat luvut eivät kata kaikkea.`;
}

const dayFormatters = new Map();

/** The calendar date of an instant in `timeZone`, as YYYY-MM-DD, or null. */
function localDay(iso, timeZone = TIME_ZONE) {
  const instant = new Date(iso);
  if (Number.isNaN(instant.getTime())) {
    return null;
  }
  let format = dayFormatters.get(timeZone);
  if (!format) {
    format = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
    dayFormatters.set(timeZone, format);
  }
  const parts = Object.fromEntries(format.formatToParts(instant).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/**
 * A calendar date `offset` days on. Stepped by date, not by 24 hours: the
 * night the clocks change is 23 or 25 hours long.
 */
function addDays(day, offset) {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, date + offset)).toISOString().slice(0, 10);
}

/**
 * The two return windows, named for the days they cover.
 *
 * They were printed as "D2" and "D7" while counting a return on day 1 or 2
 * and on day 6, 7 or 8 after the first open — a wider question than the
 * names asked. The windows are kept; the names now say what they are.
 */
const RETENTION_WINDOWS = [
  { key: 'days1to2', from: 1, to: 2, label: 'palasi 1.–2. päivänä' },
  { key: 'days6to8', from: 6, to: 8, label: 'palasi 6.–8. päivänä' },
];

/**
 * Of the installs whose window is over, how many opened the app again in it.
 *
 * Every install used to be in the denominator, including one first opened
 * this morning that cannot yet have come back on day 7 — so the newer the
 * installs, the worse retention looked, whatever people did. An install
 * counts for a window once the window's last day is before the horizon: the
 * last day the data reaches, which may itself still be going on, and never
 * later than `today`.
 */
function retention(events, today) {
  const openDays = new Map();
  let latest = null;
  for (const event of events) {
    const key = localDay(event.at);
    if (!key) continue;
    if (latest === null || key > latest) latest = key;
    if (event.name !== 'app_open') continue;
    if (!openDays.has(event.installId)) openDays.set(event.installId, new Set());
    openDays.get(event.installId).add(key);
  }
  // A phone with its clock in the future cannot move the horizon past today.
  const horizon = latest === null || latest > today ? today : latest;
  const installs = [...openDays.values()].map((days) => ({ first: [...days].sort()[0], days }));
  return {
    installs: installs.length,
    horizon,
    windows: RETENTION_WINDOWS.map((window) => {
      const eligible = installs.filter((install) => addDays(install.first, window.to) < horizon);
      const returned = eligible.filter((install) => {
        for (let offset = window.from; offset <= window.to; offset += 1) {
          if (install.days.has(addDays(install.first, offset))) return true;
        }
        return false;
      });
      return { ...window, eligible: eligible.length, returned: returned.length };
    }),
  };
}

/**
 * The questionnaire's stages in the order it asks them — the names
 * OnboardingScreen sends in `path`. tests/scripts/analyticsReport holds this
 * list to the screen's own.
 */
const QUESTIONNAIRE_STAGES = ['location', 'goal', 'level', 'days', 'avoid', 'planning', 'review'];

const stageLabels = {
  location: 'kysely: välineet',
  goal: 'kysely: tavoite',
  level: 'kysely: taso',
  days: 'kysely: treenipäivät',
  avoid: 'kysely: vältettävät',
  planning: 'kysely: painopiste',
  review: 'kysely: ohjelma näytetty',
};

/**
 * The onboarding funnel, one branch at a time.
 *
 * It was one straight line through all three branches with every install as
 * its denominator: "ready_catalog" sat under "questionnaire" as though one
 * led to the other, and a branch chosen by a tenth of readers read as a
 * ninety-percent drop. Each branch starts at the fork now, and each row is a
 * share of the installs that reached the branch's first row — so a row can
 * only lose people the row above it had.
 *
 * A row is [kind, value, label]: a `step` reached, an onboarding finish by
 * `completed` path ('*' for any), or an `event` sent at all.
 */
const FUNNELS = [
  {
    key: 'entry',
    title: 'Alku — kaikki polut',
    rows: [
      ['step', 'welcome', 'tervetuloa (welcome)'],
      ['step', 'path', 'polun valinta (path)'],
    ],
  },
  {
    key: 'build',
    title: 'Rakenna ohjelma',
    rows: [
      ['step', 'path', 'polun valinta (path)'],
      ['step', 'about', 'perustiedot (about)'],
      ['step', 'questionnaire', 'kysely alkoi (questionnaire)'],
      ...QUESTIONNAIRE_STAGES.map((stage) => ['step', stage, `${stageLabels[stage]} (${stage})`]),
      ['completed', 'build', 'onboarding valmis'],
    ],
  },
  {
    key: 'ready',
    title: 'Valitse valmis ohjelma',
    rows: [
      ['step', 'path', 'polun valinta (path)'],
      ['step', 'ready_catalog', 'valmiskatalogi (ready_catalog)'],
      ['completed', 'ready_catalog', 'onboarding valmis'],
    ],
  },
  {
    key: 'empty',
    title: 'Aloita tyhjänä',
    rows: [
      ['step', 'path', 'polun valinta (path)'],
      ['completed', 'empty', 'onboarding valmis'],
    ],
  },
  {
    key: 'after',
    title: 'Onboardingin jälkeen',
    rows: [
      ['completed', '*', 'onboarding valmis (mikä tahansa polku)'],
      ['event', 'plan_adopted', 'ohjelma käytössä'],
      ['event', 'workout_started', 'treeni aloitettu'],
      ['event', 'workout_completed', 'treeni kirjattu'],
    ],
  },
];

function buildFunnels(events) {
  const byInstall = new Map();
  const record = (installId) => {
    if (!byInstall.has(installId)) byInstall.set(installId, { steps: new Set(), completed: new Set(), events: new Set() });
    return byInstall.get(installId);
  };
  for (const event of events) {
    const install = record(event.installId);
    install.events.add(event.name);
    if (event.name === 'onboarding_step' && typeof event.props.path === 'string') {
      install.steps.add(event.props.path);
    }
    if (event.name === 'onboarding_completed') {
      install.completed.add('*');
      if (typeof event.props.path === 'string') install.completed.add(event.props.path);
    }
  }
  const reached = (install, [kind, value]) =>
    kind === 'step' ? install.steps.has(value) : kind === 'completed' ? install.completed.has(value) : install.events.has(value);

  return FUNNELS.map((funnel) => {
    const base = [...byInstall.values()].filter((install) => reached(install, funnel.rows[0]));
    return {
      key: funnel.key,
      title: funnel.title,
      base: base.length,
      rows: funnel.rows.map((row) => ({ label: row[2], count: base.filter((install) => reached(install, row)).length })),
    };
  });
}

/** Every number both renderers print, from one pass over the events. */
function aggregate(events, { now = new Date() } = {}) {
  const byDay = new Map();
  for (const event of events) {
    const key = localDay(event.at);
    if (!key) continue;
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
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, row]) => ({ day: key, actives: row.installs.size, opens: row.opens, workouts: row.workouts, coach: row.coach, paywall: row.paywall }));

  return {
    dailies,
    funnels: buildFunnels(events),
    retention: retention(events, localDay(now.toISOString())),
    installsSeen: new Set(events.map((event) => event.installId)).size,
  };
}

const share = (count, base) => (base ? Math.round((count / base) * 100) : 0);

module.exports = {
  fetchEvents,
  fetchEventPages,
  coverageWarning,
  aggregate,
  buildFunnels,
  retention,
  localDay,
  addDays,
  share,
  FUNNELS,
  QUESTIONNAIRE_STAGES,
  RETENTION_WINDOWS,
  TIME_ZONE,
};

async function main() {
  const sinceArg = process.argv.indexOf('--since');
  const since = sinceArg !== -1 ? process.argv[sinceArg + 1] : undefined;
  const fetched = await fetchEvents(since);
  const warning = coverageWarning(fetched);
  if (warning) console.warn(`\n${warning}`);
  const { events } = fetched;
  if (events.length === 0) {
    console.log('No events yet.');
    return;
  }
  const { dailies, funnels, retention: back, installsSeen } = aggregate(events);

  console.log(`\nPÄIVITTÄIN, ${TIME_ZONE}  (aktiiviset · avaukset · treenit · coach-kysymykset · paywall)`);
  for (const row of dailies) {
    console.log(
      `  ${row.day}   ${String(row.actives).padStart(3)} · ${String(row.opens).padStart(3)} · ${String(row.workouts).padStart(3)} · ${String(row.coach).padStart(3)} · ${String(row.paywall).padStart(3)}`,
    );
  }
  console.log(`\nSUPPILO  (${installsSeen} asennusta nähty; osuus = haaran ensimmäisen rivin saavuttaneista)`);
  for (const funnel of funnels) {
    console.log(`  ${funnel.title}  (${funnel.base})`);
    for (const row of funnel.rows) {
      console.log(`    ${String(row.count).padStart(4)}  (${String(share(row.count, funnel.base)).padStart(3)} %)  ${row.label}`);
    }
  }
  console.log(`\nPALUU  (ensimmäisestä avauksesta; mukana asennukset, joiden ikkuna päättyi ennen ${back.horizon})`);
  for (const window of back.windows) {
    console.log(`  ${window.label}: ${window.returned}/${window.eligible}  (${share(window.returned, window.eligible)} %)`);
  }
  console.log(`\n${events.length} events from ${fetched.batchesFetched}/${fetched.batchTotal} batches.`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
