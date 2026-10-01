#!/usr/bin/env node
// Usage: node hook-order.cjs <baseRef> [<headRef>] [--show]   (run from the repo/worktree root; headRef defaults to the working tree)
// Flattens VinhaApp's top-level hook calls, inlining any hook imported from
// ./src/app/useX (recursively), and compares the sequence at <baseRef> with the
// working tree. Each entry carries the hook kind, its deps text and a hash of
// its whitespace-normalised callback/initialiser, so a verbatim move keeps the
// sequence identical and any reorder, deps edit or body edit shows up.
const ts = require(require('node:path').join(process.cwd(), 'node_modules', 'typescript'));
const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = process.cwd();
const positional = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const base = positional[0] || 'HEAD';
const head = positional[1] || null;

function readAt(ref, rel) {
  if (ref === null) {
    const p = path.join(ROOT, rel);
    return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
  }
  try {
    return cp.execSync(`git show ${ref}:${rel}`, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return null;
  }
}

const norm = (s) => s.replace(/\s+/g, ' ').trim();
const hash = (s) => crypto.createHash('sha1').update(norm(s)).digest('hex').slice(0, 10);

function resolveModule(ref, fromRel, spec) {
  if (!spec.startsWith('.')) return null;
  const dir = path.posix.dirname(fromRel);
  const baseRel = path.posix.normalize(path.posix.join(dir, spec));
  for (const ext of ['.ts', '.tsx', '/index.ts', '/index.tsx']) {
    const rel = baseRel + ext;
    if (readAt(ref, rel) !== null) return rel;
  }
  return null;
}

function importsOf(sf) {
  const map = new Map();
  for (const st of sf.statements) {
    if (!ts.isImportDeclaration(st) || !st.importClause) continue;
    const spec = st.moduleSpecifier.text;
    const nb = st.importClause.namedBindings;
    if (nb && ts.isNamedImports(nb)) {
      for (const el of nb.elements) map.set(el.name.text, { spec, imported: (el.propertyName ?? el.name).text });
    }
  }
  return map;
}

function findFunction(sf, name) {
  for (const st of sf.statements) {
    if (ts.isFunctionDeclaration(st) && st.name && st.name.text === name && st.body) return st;
  }
  return null;
}

function hookCalls(node, sf) {
  // Hook calls in this statement, not descending into nested functions.
  const out = [];
  const visit = (n) => {
    if (ts.isFunctionLike(n) && n !== node) return;
    if (ts.isCallExpression(n)) {
      const callee = n.expression;
      let name = null;
      if (ts.isIdentifier(callee)) name = callee.text;
      else if (ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.expression) && callee.expression.text === 'React') name = callee.name.text;
      if (name && /^use[A-Z]/.test(name)) {
        out.push({ name, call: n });
        // arguments may hold further hook calls only in pathological code; do not descend into callbacks
        n.arguments.forEach((a) => { if (!ts.isFunctionLike(a)) ts.forEachChild(a, visit); });
        return;
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(node);
  return out;
}

function flatten(ref, rel, fnName, depth, out, trail) {
  const text = readAt(ref, rel);
  if (text === null) throw new Error(`cannot read ${rel} at ${ref ?? 'worktree'}`);
  const sf = ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true, rel.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const fn = findFunction(sf, fnName);
  if (!fn) throw new Error(`no function ${fnName} in ${rel}`);
  const imports = importsOf(sf);
  let returned = false;
  for (const st of fn.body.statements) {
    // An inlined src/app hook's own closing `return { … }` (its last statement)
    // is how it hands values back, not an early return.
    const trailingHookReturn = depth > 0 && ts.isReturnStatement(st) && st === fn.body.statements[fn.body.statements.length - 1];
    if (!trailingHookReturn && (ts.isReturnStatement(st) || (ts.isIfStatement(st) && containsReturn(st)))) {
      // record early returns so a hook placed below one shows up
      out.push(`${'  '.repeat(depth)}<early-return ${trail}>`);
      returned = true;
    }
    for (const { name, call } of hookCalls(st, sf)) {
      const imp = imports.get(name);
      const modRel = imp ? resolveModule(ref, rel, imp.spec) : null;
      if (modRel && /(^|\/)src\/app\//.test(modRel)) {
        out.push(`${'  '.repeat(depth)}>> ${name} (${modRel})`);
        flatten(ref, modRel, imp.imported, depth + 1, out, name);
        out.push(`${'  '.repeat(depth)}<< ${name}`);
        continue;
      }
      const args = call.arguments;
      let desc = name;
      if (['useEffect', 'useLayoutEffect', 'useMemo', 'useCallback'].includes(name)) {
        const deps = args[1] ? norm(args[1].getText(sf)) : '<none>';
        desc += ` deps=${deps} body#${args[0] ? hash(args[0].getText(sf)) : '-'}`;
      } else if (['useState', 'useRef', 'useReducer'].includes(name)) {
        desc += ` init#${args[0] ? hash(args[0].getText(sf)) : '-'}`;
      } else {
        desc += ` args#${hash(args.map((a) => a.getText(sf)).join(','))}`;
      }
      if (returned) desc += '  !!! BELOW EARLY RETURN';
      out.push(`${'  '.repeat(depth)}${desc}`);
    }
  }
}

function containsReturn(n) {
  let found = false;
  const v = (x) => { if (found || ts.isFunctionLike(x)) return; if (ts.isReturnStatement(x)) { found = true; return; } ts.forEachChild(x, v); };
  v(n);
  return found;
}

function seq(ref) {
  const out = [];
  flatten(ref, 'App.tsx', 'VinhaApp', 0, out, 'VinhaApp');
  return out;
}

const a = seq(base);
const b = seq(head);
const strip = (l) => l.trim();
const aa = a.filter((l) => !/^\s*(>>|<<)/.test(l)).map(strip);
const bb = b.filter((l) => !/^\s*(>>|<<)/.test(l)).map(strip);
console.log(`base hooks: ${aa.length}, worktree hooks (flattened): ${bb.length}`);
let diffs = 0;
const n = Math.max(aa.length, bb.length);
for (let i = 0; i < n; i++) {
  if (aa[i] !== bb[i]) {
    diffs++;
    if (diffs <= 20) console.log(`#${i}\n  base: ${aa[i]}\n  now : ${bb[i]}`);
  }
}
if (process.argv.includes('--show')) console.log(b.join('\n'));
if (b.some((l) => l.includes('BELOW EARLY RETURN'))) { console.log('FAIL: hook below early return'); process.exit(1); }
console.log(diffs === 0 ? 'OK: flattened hook sequence identical (kind, deps, body hash, order)' : `FAIL: ${diffs} differing positions`);
process.exit(diffs === 0 ? 0 : 1);
