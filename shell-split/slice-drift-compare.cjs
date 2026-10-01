#!/usr/bin/env node
// node slice-drift-compare.cjs base.json head.json
const fs = require('node:fs');
const a = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const b = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
const rows = [];
for (const [k, la] of Object.entries(a)) {
  const lb = b[k];
  if (!lb) {
    rows.push(['GONE', k, la.join(','), '-']);
    continue;
  }
  const n = Math.max(la.length, lb.length);
  for (let i = 0; i < n; i++) {
    const x = la[i];
    const y = lb[i];
    if (x === undefined || y === undefined) {
      rows.push(['COUNT', k, la.join(','), lb.join(',')]);
      break;
    }
    const d = y - x;
    if (Math.abs(d) > 200 && (y > x * 1.15 || y < x * 0.85)) rows.push([d > 0 ? 'GREW' : 'SHRANK', k, String(x), String(y)]);
  }
}
for (const [k, lb] of Object.entries(b)) if (!a[k]) rows.push(['NEW', k, '-', lb.join(',')]);
const order = { GREW: 0, SHRANK: 1, COUNT: 2, GONE: 3, NEW: 4 };
rows.sort((p, q) => order[p[0]] - order[q[0]] || p[1].localeCompare(q[1]));
for (const r of rows) console.log(`${r[0]}\t${r[2]} -> ${r[3]}\t${r[1]}`);
