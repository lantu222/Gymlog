// Run at BASE worktree root. For every slice/substring on an App-sized string, flag slices whose END (or start)
// falls inside a moved block, judged by the text right after the end (or at start) being moved text.
const path = require('path'); const fs = require('fs');
const base = fs.readFileSync(path.resolve('App.tsx'), 'utf8').split('\n');
const ranges = JSON.parse(process.env.RANGES);
const movedLines = new Set();
for (const [a, b] of ranges) for (let i = a - 1; i < b; i++) { const t = base[i].trim(); if (t.length > 25) movedLines.add(t); }
const isMovedText = (s) => {
  // first non-trivial line(s) of s
  const lines = s.split('\n').map((l) => l.trim()).filter((l) => l.length > 25);
  return lines.length > 0 && movedLines.has(lines[0]) ? lines[0] : null;
};
const files = fs.readFileSync(process.argv[2], 'utf8').trim().split('\n');
let current = null; const hits = new Map();
const big = (s) => typeof s === 'string' && s.length > 150000 && s.includes('function VinhaApp');
const origSlice = String.prototype.slice;
for (const m of ['slice', 'substring']) {
  const orig = String.prototype[m];
  String.prototype[m] = function (...a) {
    const s = String(this);
    const r = orig.apply(this, a);
    if (current && big(s) && r.length < s.length * 0.9) {
      let [st, en] = a; const L = s.length;
      if (st === undefined) st = 0; if (en === undefined) en = L;
      if (m === 'slice') { if (st < 0) st = Math.max(L + st, 0); if (en < 0) en = Math.max(L + en, 0); }
      else { st = Math.max(0, st); en = Math.max(0, en); if (st > en) [st, en] = [en, st]; }
      const after = origSlice.call(s, en, en + 400);
      const atStart = origSlice.call(s, st, st + 400);
      // line containing end
      const lineStartE = s.lastIndexOf('\n', en - 1) + 1;
      const endLine = origSlice.call(s, lineStartE, s.indexOf('\n', en) < 0 ? L : s.indexOf('\n', en));
      const f1 = isMovedText(after) || (movedLines.has(endLine.trim()) ? endLine.trim() : null);
      const f2 = isMovedText(atStart);
      if (f1 || f2) {
        const e = hits.get(current) || new Set();
        e.add(`${m} head=${JSON.stringify(origSlice.call(r, 0, 60))} ${f1 ? 'END-IN-MOVED: ' + f1.slice(0, 70) : ''} ${f2 ? 'START-IN-MOVED: ' + f2.slice(0, 70) : ''}`);
        hits.set(current, e);
      }
    }
    return r;
  };
}
(async () => {
  process.on('unhandledRejection', () => {});
  const o = [console.log, console.error, console.warn];
  for (const f of files) {
    let suites; try { current = f + ' :: <load>'; suites = require(path.resolve(f)); } catch (e) { continue; }
    for (const s of suites) {
      current = f.replace(/^tests\//, '') + ' :: ' + s.name;
      console.log = console.error = console.warn = () => {};
      try { const r = s.run(); if (r && r.then) await r; } catch (e) {}
      [console.log, console.error, console.warn] = o;
    }
  }
  current = null;
  for (const [k, v] of hits) { console.log(k); for (const x of v) console.log('    ' + x); }
  process.exit(0);
})();
