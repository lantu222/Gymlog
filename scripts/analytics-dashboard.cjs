#!/usr/bin/env node
/**
 * The same numbers as analytics-report.cjs, as a local HTML page — "an own
 * app on this machine to look at" (user, 2026-08-25). Fetches with the same
 * shared code, writes dist-analytics/dashboard.html, opens it in the browser.
 * The page is self-contained and static: the numbers are baked in at build
 * time, nothing in the browser calls anywhere, and the read secret never
 * leaves this script.
 *
 *   node scripts/analytics-dashboard.cjs        # or double-click analytics.cmd
 */
const fs = require('node:fs');
const path = require('node:path');
const { execFile } = require('node:child_process');

const { fetchEvents, aggregate } = require('./analytics-report.cjs');

/**
 * The coach log, for the same page. Best-effort: the transcript tap is a
 * development switch, so when it is off (as it must be by release) this
 * returns null and the dashboard simply drops the section.
 */
async function fetchTranscripts() {
  try {
    const raw = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');
    const get = (key) => (raw.match(new RegExp('^' + key + '=(.*)$', 'm')) ?? [])[1]?.trim();
    const base = (get('EXPO_PUBLIC_AI_COACH_API_URL') ?? '').replace('/ai-coach', '/transcripts');
    const secret = get('TRANSCRIPT_READ_SECRET') ?? '';
    if (!base || !secret) return null;
    const response = await fetch(`${base}?limit=40`, { headers: { 'x-transcript-secret': secret } });
    if (!response.ok) return null;
    const payload = await response.json();
    return (payload.entries ?? [])
      .map((entry) => ({
        at: String(entry.at ?? ''),
        prompt: String(entry.prompt ?? ''),
        takeaway: String(entry.answer?.takeaway ?? ''),
        source: String(entry.source ?? ''),
        reporter: entry.reporter ? String(entry.reporter) : null,
      }))
      .filter((entry) => entry.prompt);
  } catch {
    return null;
  }
}

const esc = (value) => String(value).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function render({ dailies, funnel, funnelTotal, retention }, transcripts, meta) {
  const maxActives = Math.max(1, ...dailies.map((row) => row.actives));
  const dayBars = dailies
    .slice(-30)
    .map((row) => {
      const height = Math.max(4, Math.round((row.actives / maxActives) * 120));
      return `<div class="bar" title="${esc(row.day)}: ${row.actives} aktiivista, ${row.opens} avausta">
        <div class="fill" style="height:${height}px"></div>
        <span>${esc(row.day.slice(8))}</span>
      </div>`;
    })
    .join('');

  const maxFunnel = Math.max(1, ...funnel.map(([, count]) => count), funnelTotal);
  const funnelRows = funnel
    .map(([label, count]) => {
      const width = Math.round((count / maxFunnel) * 100);
      const share = funnelTotal ? Math.round((count / funnelTotal) * 100) : 0;
      return `<div class="frow">
        <span class="flabel">${esc(label)}</span>
        <div class="ftrack"><div class="fbar" style="width:${width}%"></div></div>
        <span class="fcount">${count} <em>(${share} %)</em></span>
      </div>`;
    })
    .join('');

  const dailyRows = dailies
    .slice()
    .reverse()
    .map(
      (row) => `<tr><td>${esc(row.day)}</td><td>${row.actives}</td><td>${row.opens}</td><td>${row.workouts}</td><td>${row.coach}</td><td>${row.paywall}</td></tr>`,
    )
    .join('');

  const transcriptSection = transcripts === null
    ? ''
    : `<div class="card wide"><h2>AI-loki — viimeisimmät keskustelut</h2>${
        transcripts.length === 0
          ? '<p class="meta">ei keskusteluja vielä</p>'
          : transcripts
              .slice(0, 20)
              .map(
                (entry) => `<div class="chat">
        <div class="chatmeta">${esc(entry.at.slice(0, 16).replace('T', ' '))} · ${esc(entry.source)}${entry.reporter ? ' · ' + esc(entry.reporter) : ''}</div>
        <div class="q">${esc(entry.prompt)}</div>
        <div class="a">${esc(entry.takeaway)}</div>
      </div>`,
              )
              .join('')
      }<p class="meta" style="margin-top:10px">Kehitysajan loki — sammuu ennen julkaisua, jolloin tämä osio katoaa sivulta itsestään.</p></div>`;

  return `<!doctype html>
<html lang="fi"><head><meta charset="utf-8">
<title>Vinha — käyttötilastot</title>
<style>
  :root { --bg:#15122b; --card:#1e1a3a; --ink:#efeaff; --muted:#9a92c4; --accent:#ff7a3c; --purple:#8b6cf0; --line:#2c2750; }
  * { box-sizing:border-box; margin:0; }
  body { background:var(--bg); color:var(--ink); font:15px/1.5 system-ui,'Segoe UI',sans-serif; padding:28px; }
  h1 { font-size:22px; } h1 b { color:var(--purple); }
  .meta { color:var(--muted); font-size:12.5px; margin:4px 0 22px; }
  .grid { display:grid; grid-template-columns:1fr 1fr; gap:18px; max-width:1080px; }
  .card { background:var(--card); border:1px solid var(--line); border-radius:14px; padding:18px; }
  .card h2 { font-size:12px; letter-spacing:1.2px; text-transform:uppercase; color:var(--muted); margin-bottom:14px; }
  .kpis { display:flex; gap:26px; }
  .kpi b { font-size:30px; display:block; } .kpi span { color:var(--muted); font-size:12px; }
  .bars { display:flex; align-items:flex-end; gap:5px; height:150px; }
  .bar { display:flex; flex-direction:column; align-items:center; justify-content:flex-end; flex:1; height:100%; }
  .bar .fill { width:100%; max-width:26px; background:var(--accent); border-radius:4px 4px 0 0; }
  .bar span { font-size:10px; color:var(--muted); margin-top:4px; }
  .frow { display:flex; align-items:center; gap:10px; margin:7px 0; }
  .flabel { width:230px; font-size:13px; }
  .ftrack { flex:1; background:var(--bg); border-radius:6px; height:16px; overflow:hidden; }
  .fbar { height:100%; background:linear-gradient(90deg,var(--purple),var(--accent)); border-radius:6px; }
  .fcount { width:90px; text-align:right; font-variant-numeric:tabular-nums; } .fcount em { color:var(--muted); font-style:normal; font-size:11.5px; }
  table { width:100%; border-collapse:collapse; font-variant-numeric:tabular-nums; }
  th,td { text-align:right; padding:5px 8px; border-bottom:1px solid var(--line); font-size:13px; }
  th:first-child, td:first-child { text-align:left; }
  th { color:var(--muted); font-weight:600; font-size:11px; text-transform:uppercase; letter-spacing:0.8px; }
  .wide { grid-column:1 / -1; }
  .note { color:var(--muted); font-size:12px; margin-top:20px; }
  .chat { border-top:1px solid var(--line); padding:10px 0; }
  .chat:first-of-type { border-top:none; }
  .chatmeta { color:var(--muted); font-size:11px; }
  .q { font-weight:700; margin:2px 0; }
  .a { color:var(--muted); font-size:13.5px; }
</style></head><body>
<h1>Vinha <b>käyttötilastot</b></h1>
<p class="meta">Päivitetty ${esc(meta.generatedAt)} · ${meta.eventCount} tapahtumaa palvelimella · lataukset ja rahat: Play Console</p>
<div class="grid">
  <div class="card"><h2>Paluu</h2><div class="kpis">
    <div class="kpi"><b>${retention.installs}</b><span>asennusta nähty</span></div>
    <div class="kpi"><b>${retention.d2}</b><span>palasi D2</span></div>
    <div class="kpi"><b>${retention.d7}</b><span>palasi D7</span></div>
  </div></div>
  <div class="card"><h2>Aktiiviset / päivä (30 pv)</h2><div class="bars">${dayBars || '<span class="meta">ei vielä dataa</span>'}</div></div>
  <div class="card wide"><h2>Suppilo — missä matka katkeaa</h2>${funnelRows}</div>
  <div class="card wide"><h2>Päivittäin</h2>
    <table><tr><th>Päivä</th><th>Aktiiviset</th><th>Avaukset</th><th>Treenit</th><th>Coach</th><th>Paywall</th></tr>${dailyRows}</table>
  </div>
  ${transcriptSection}
</div>
<p class="note">Sivu on staattinen: luvut haettiin skriptillä koneellesi, selain ei kutsu mitään eikä lukusalaisuus ole tässä tiedostossa. Päivitä ajamalla analytics.cmd uudestaan.</p>
</body></html>`;
}

async function main() {
  const { events, batchTotal } = await fetchEvents(undefined);
  const transcripts = await fetchTranscripts();
  const summary = aggregate(events);
  const html = render(summary, transcripts, {
    generatedAt: new Date().toLocaleString('fi-FI'),
    eventCount: events.length,
    batchTotal,
  });
  const outDir = path.join(__dirname, '..', 'dist-analytics');
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, 'dashboard.html');
  fs.writeFileSync(outFile, html);
  console.log(`Wrote ${outFile}`);
  if (process.platform === 'win32' && !process.argv.includes('--no-open')) {
    execFile('cmd', ['/c', 'start', '', outFile]);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
