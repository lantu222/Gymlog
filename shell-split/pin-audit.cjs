#!/usr/bin/env node
// One-off pin audit (not committed). Usage, from the worktree root on UNMOVED code:
//   TZ=Europe/Helsinki node g1-pinaudit.cjs 561-579 781-804
// Runs every suite in tests/run-tests.cjs in-process with string/regex lookups
// instrumented. For any lookup over a string that contains code from the given
// App.tsx line ranges it records:
//   POS  a match that lands inside the moved code (a pin anchored in it)
//   NEG  a lookup that found nothing over a string that contains the moved code
//        (an absence pin whose text covers it)
// plus whether the string was App.tsx alone ("APP"), the wiring concat ("WIRING")
// or something else ("OTHER").
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = process.cwd();
const appText = fs.readFileSync(path.join(root, 'App.tsx'), 'utf8');
const appLines = appText.split('\n');
const ranges = process.argv.slice(2).map((r) => r.split('-').map(Number));

const oIndexOf = String.prototype.indexOf;
const oLastIndexOf = String.prototype.lastIndexOf;
const oIncludes = String.prototype.includes;
const oExec = RegExp.prototype.exec;
const oTest = RegExp.prototype.test;
const oSlice = String.prototype.slice;
const oTrim = String.prototype.trim;

// Fingerprints: moved code lines, trimmed, >= 20 chars, unique in App.tsx.
const count = (hay, needle) => {
  let n = 0;
  let i = oIndexOf.call(hay, needle);
  while (i >= 0) { n += 1; i = oIndexOf.call(hay, needle, i + 1); }
  return n;
};
const blocks = ranges.map(([a, b]) => {
  const fps = [];
  for (let n = a; n <= b; n += 1) {
    const t = oTrim.call(appLines[n - 1]);
    if (t.length >= 20 && count(appText, t) === 1) fps.push(t);
  }
  return { a, b, fps };
});
for (const b of blocks) console.log(`block ${b.a}-${b.b}: ${b.fps.length} fingerprints`);

let busy = false;
const cache = new Map();
function regionsIn(s) {
  if (typeof s !== 'string' || s.length < 400) return null;
  if (cache.has(s)) return cache.get(s);
  const out = [];
  for (const b of blocks) {
    let lo = Infinity;
    let hi = -1;
    for (const fp of b.fps) {
      const i = oIndexOf.call(s, fp);
      if (i >= 0) { lo = Math.min(lo, i); hi = Math.max(hi, i + fp.length); }
    }
    if (hi >= 0) out.push([lo, hi, `${b.a}-${b.b}`]);
  }
  const r = out.length ? out : null;
  if (cache.size > 3000) cache.clear();
  cache.set(s, r);
  return r;
}
function kindOf(s) {
  if (oIncludes.call(s, 'function VinhaApp()')) {
    return oIncludes.call(s, 'export function renderProfileTab(') ? 'WIRING' : 'APP';
  }
  return 'OTHER';
}
let current = '?';
const hits = new Map();
function record(kind, s, pattern, at) {
  const regs = regionsIn(s);
  if (!regs) return;
  let label = null;
  if (kind === 'POS') {
    for (const [lo, hi, name] of regs) if (at >= lo - 200 && at < hi + 50) label = name;
    if (!label) return;
  } else {
    label = regs.map((r) => r[2]).join(',');
  }
  const key = `${current} | ${kind} ${kindOf(s)} [${label}] len=${s.length} :: ${String(pattern).slice(0, 160)}`;
  hits.set(key, (hits.get(key) || 0) + 1);
}
function guard(fn) {
  if (busy) return;
  busy = true;
  try { fn(); } finally { busy = false; }
}

String.prototype.indexOf = function (needle, from) {
  const r = oIndexOf.call(this, needle, from);
  guard(() => { if (r >= 0) record('POS', String(this), `indexOf ${JSON.stringify(needle)}`, r); else if (!from) record('NEG', String(this), `indexOf ${JSON.stringify(needle)}`); });
  return r;
};
String.prototype.lastIndexOf = function (needle, from) {
  const r = oLastIndexOf.call(this, needle, from);
  guard(() => { if (r >= 0) record('POS', String(this), `lastIndexOf ${JSON.stringify(needle)}`, r); else record('NEG', String(this), `lastIndexOf ${JSON.stringify(needle)}`); });
  return r;
};
String.prototype.includes = function (needle, from) {
  const r = oIncludes.call(this, needle, from);
  guard(() => {
    if (r) record('POS', String(this), `includes ${JSON.stringify(needle)}`, oIndexOf.call(this, needle, from));
    else record('NEG', String(this), `includes ${JSON.stringify(needle)}`);
  });
  return r;
};
RegExp.prototype.exec = function (s) {
  const start = this.lastIndex;
  const r = oExec.call(this, s);
  guard(() => {
    if (r) record('POS', String(s), `re ${this}`, r.index);
    else if (!(this.global || this.sticky) || start === 0) record('NEG', String(s), `re ${this}`);
  });
  return r;
};
RegExp.prototype.test = function (s) {
  return this.exec(s) !== null;
};
const oMatch = assert.match;
const oDoesNotMatch = assert.doesNotMatch;
assert.match = function (s, re, ...rest) {
  guard(() => { const m = oExec.call(new RegExp(re.source, re.flags.replace('g', '')), s); if (m) record('POS', String(s), `assert.match ${re}`, m.index); });
  return oMatch.call(this, s, re, ...rest);
};
assert.doesNotMatch = function (s, re, ...rest) {
  guard(() => record('NEG', String(s), `assert.doesNotMatch ${re}`));
  return oDoesNotMatch.call(this, s, re, ...rest);
};

const runner = fs.readFileSync(path.join(root, 'tests/run-tests.cjs'), 'utf8');
const files = [...runner.matchAll(/require\('\.\/([^']+\.test\.cjs)'\)/g)].map((m) => m[1]);
(async () => {
  let pass = 0;
  let fail = 0;
  for (const rel of files) {
    let suites;
    current = `tests/${rel} :: <load>`;
    try { suites = require(path.join(root, 'tests', rel)); } catch (e) { console.log(`LOADFAIL ${rel} ${e.message}`); continue; }
    for (const s of suites) {
      current = `tests/${rel} :: ${s.name}`;
      try { await s.run(); pass += 1; } catch (e) { fail += 1; console.log(`FAIL ${current} :: ${String(e.message).split('\n')[0].slice(0, 160)}`); }
    }
  }
  console.log(`pass=${pass} fail=${fail}`);
  const lines = [...hits.entries()].map(([k, n]) => `${n > 1 ? `x${n} ` : ''}${k}`).sort();
  for (const l of lines) console.log(l);
})();
