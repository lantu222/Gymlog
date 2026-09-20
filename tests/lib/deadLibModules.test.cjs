const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');

/**
 * Every module in src/lib is imported by something that runs.
 *
 * `workoutIntelligence.ts` — a progression-suggestion engine, 121 lines — had
 * no importer anywhere: not the app, not the API, not a script, not a test.
 * It was the fourth batch of round 3 in miniature (three screens nothing could
 * open, 3 150 lines behind them), found the same way: by asking who reaches a
 * file rather than whether it reads well (2026-09-20).
 *
 * What counts as reaching: an import from src/ (any layer, lib included),
 * App.tsx, api/, scripts/ or modules/. A test alone does not — a module that
 * exists to pass its own test is the dead code the test keeps warm.
 *
 * PARKED is the list of modules kept on purpose with nothing wired to them
 * yet. Each entry names why; the guard fails if a parked module gains an
 * importer (take it off the list) or loses its file (same).
 */
const PARKED = new Map([
  // The coaching stack's profile layer. Designed and documented
  // (docs/coaching-architecture.md, docs/system-architecture.md §Profile
  // layer, glossary) as the derived UserFitnessProfile that the recommendation
  // and coaching engines will read; the engines are not wired yet. Its own
  // test keeps the derivation honest until they are.
  ['userFitnessProfile', 'coaching profile layer, documented and awaiting its readers'],
]);

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const next = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      out.push(...walk(next));
    } else if (/\.(ts|tsx|cjs|js|mjs)$/.test(entry.name)) {
      out.push(next);
    }
  }
  return out;
}

/** Module names that some running file imports, by the last path segment of the import. */
function importedLibModules() {
  const sources = ['App.tsx', ...walk('src'), ...(fs.existsSync(path.join(ROOT, 'api')) ? walk('api') : []), ...(fs.existsSync(path.join(ROOT, 'scripts')) ? walk('scripts') : []), ...(fs.existsSync(path.join(ROOT, 'modules')) ? walk('modules') : [])];
  const reached = new Map();
  for (const file of sources) {
    const text = fs.readFileSync(path.join(ROOT, file), 'utf8');
    // import ... from '<spec>' | require('<spec>') | import('<spec>')
    for (const m of text.matchAll(/(?:from|require\(|import\()\s*['"]([^'"]+)['"]/g)) {
      const spec = m[1];
      if (!/(^|\/)lib\/[^/]+$|^\.\/[^/]+$/.test(spec)) continue;
      const name = spec.split('/').pop().replace(/\.(js|ts)$/, '');
      // A relative sibling import counts only from inside src/lib itself.
      if (/^\.\/[^/]+$/.test(spec) && !file.startsWith('src/lib/')) continue;
      const importerModule = file.startsWith('src/lib/') ? path.basename(file).replace(/\.ts$/, '') : null;
      if (importerModule === name) continue;
      if (!reached.has(name)) reached.set(name, new Set());
      reached.get(name).add(file);
    }
    // The cost simulations require the compiled module by a joined path:
    // `require(path.join(DIST, 'aiCoachCostModel.js'))`. The file name is
    // still a string literal, and a script that names it reaches it.
    if (file.startsWith('scripts/')) {
      for (const m of text.matchAll(/['"]([A-Za-z0-9_]+)\.js['"]/g)) {
        if (!reached.has(m[1])) reached.set(m[1], new Set());
        reached.get(m[1]).add(file);
      }
    }
  }
  return reached;
}

module.exports = [
  {
    name: 'dead code: every src/lib module is imported by something that runs, or parked by name',
    run() {
      const modules = fs
        .readdirSync(path.join(ROOT, 'src', 'lib'))
        .filter((name) => name.endsWith('.ts'))
        .map((name) => name.replace(/\.ts$/, ''));
      assert.ok(modules.length > 100, `only ${modules.length} modules found — the scan is looking in the wrong place`);
      const reached = importedLibModules();

      const dead = modules.filter((name) => !reached.has(name) && !PARKED.has(name)).sort();
      assert.deepEqual(dead, [], `nothing that runs imports: ${dead.join(', ')} — delete the module, or park it here with a reason`);

      for (const [name, reason] of PARKED) {
        assert.ok(modules.includes(name), `${name} is parked (${reason}) but the file is gone — take it off the list`);
        const importer = reached.has(name) ? [...reached.get(name)][0] : null;
        assert.equal(importer, null, `${name} is parked (${reason}) but ${importer} imports it now — take it off the list`);
      }
    },
  },
];
