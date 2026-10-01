#!/usr/bin/env node
// Usage: node verify-moves.cjs <baseRef> [<headRef>]   (run from the repo/worktree root; headRef defaults to the working tree)
// Compares code removed from App.tsx (vs baseRef) with code added anywhere in
// the diff. Lines are compared trimmed, as a multiset, so a verbatim move shows
// up as "removed == added" and only the glue (call sites, imports, interfaces,
// destructuring) is left over for a human to read.
const cp = require('node:child_process');

const base = process.argv[2] || 'HEAD';
const head = process.argv[3] || '';
const sh = (cmd) => cp.execSync(cmd, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });

const diff = sh(`git diff --unified=0 --no-color ${base} ${head} -- . ':(exclude)package-lock.json'`);
const removed = new Map();
const added = new Map();
let file = null;
for (const line of diff.split('\n')) {
  if (line.startsWith('+++ ')) { file = line.slice(6); continue; }
  if (line.startsWith('--- ')) continue;
  if (line.startsWith('+')) bump(added, line.slice(1), file);
  else if (line.startsWith('-')) bump(removed, line.slice(1), file);
}
function bump(map, raw, f) {
  const key = raw.trim();
  if (!key) return;
  const e = map.get(key) || { n: 0, files: new Set() };
  e.n += 1; e.files.add(f); map.set(key, e);
}
const onlyRemoved = [];
const onlyAdded = [];
for (const [k, e] of removed) {
  const a = added.get(k)?.n ?? 0;
  if (e.n > a) onlyRemoved.push([e.n - a, k]);
}
for (const [k, e] of added) {
  const r = removed.get(k)?.n ?? 0;
  if (e.n > r) onlyAdded.push([e.n - r, k, [...e.files].join(',')]);
}
const total = (m) => [...m.values()].reduce((s, e) => s + e.n, 0);
console.log(`removed lines: ${total(removed)}, added lines: ${total(added)}`);
console.log(`\n=== removed but NOT re-added anywhere (${onlyRemoved.reduce((s, x) => s + x[0], 0)}) ===`);
for (const [n, k] of onlyRemoved) console.log(`${n > 1 ? `x${n} ` : ''}- ${k}`);
console.log(`\n=== added but NOT moved from anywhere (glue / new code) (${onlyAdded.reduce((s, x) => s + x[0], 0)}) ===`);
for (const [n, k, f] of onlyAdded) console.log(`${n > 1 ? `x${n} ` : ''}+ ${k}    [${f}]`);
