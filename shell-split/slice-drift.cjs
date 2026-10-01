#!/usr/bin/env node
// Usage (from a checkout root, .test-dist compiled): node slice-drift.cjs <suite-list-file> <out.json>
// Records every slice/substring taken from a shell-sized string (App.tsx alone, stripped or raw, or the
// App.tsx + src/app wiring) while each suite runs. Key: suite name + the slice's first 80 chars
// (whitespace-collapsed). Value: list of slice lengths in call order. Compare two runs with
// slice-drift-compare.cjs to find guards whose slices grew or shrank across a refactor.
const path = require('node:path');
const fs = require('node:fs');

const files = fs.readFileSync(process.argv[2], 'utf8').trim().split('\n');
const out = process.argv[3];
const appSig = 'function VinhaApp';
let current = null;
const rec = new Map();
const oSlice = String.prototype.slice;
const oSubstring = String.prototype.substring;
const oIncludes = String.prototype.includes;
const oReplace = String.prototype.replace;
const big = (s) => typeof s === 'string' && s.length > 20000;
const norm = (s) => oSlice.call(oReplace.call(oSlice.call(s, 0, 400), /\s+/g, ' '), 0, 80);
let busy = false;
for (const [m, orig] of [['slice', oSlice], ['substring', oSubstring]]) {
  String.prototype[m] = function (...a) {
    const r = orig.apply(this, a);
    if (!busy && current && big(String(this)) && r.length > 40 && r.length < String(this).length * 0.9) {
      busy = true;
      try {
        const key = `${current} :: ${norm(r)}`;
        const e = rec.get(key) || [];
        e.push(r.length);
        rec.set(key, e);
      } finally {
        busy = false;
      }
    }
    return r;
  };
}
(async () => {
  process.on('unhandledRejection', () => {});
  const o = [console.log, console.error, console.warn];
  for (const f of files) {
    let suites;
    try {
      current = `${f} :: <load>`;
      suites = require(path.resolve(f));
    } catch (e) {
      continue;
    }
    for (const s of suites) {
      current = `${f.replace(/^tests\//, '')} :: ${s.name}`;
      console.log = console.error = console.warn = () => {};
      try {
        const r = s.run();
        if (r && r.then) await r;
      } catch (e) {}
      [console.log, console.error, console.warn] = o;
    }
  }
  current = null;
  fs.writeFileSync(out, JSON.stringify(Object.fromEntries(rec)));
  console.log(`recorded ${rec.size} slice keys`);
  process.exit(0);
})();
