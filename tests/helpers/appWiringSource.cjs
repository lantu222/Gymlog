const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..', '..');

/**
 * App.tsx plus every module the phase-A split moved its wiring into
 * (src/app/, 2026-08-26). Guards that pin how a screen is wired read this
 * concatenation, so extracting a tab from the switchboard does not read as
 * the wiring disappearing — and the next extraction needs no test edit.
 *
 * App.tsx comes first and the modules follow in name order, so assertions
 * about ordering WITHIN App.tsx keep their meaning. Cross-file [\s\S]*
 * patterns can span the joins; a guard that starts failing after an
 * extraction is telling you it matched across two files, not that the
 * wiring broke.
 */
function readAppWiring() {
  const appDir = path.join(root, 'src', 'app');
  const parts = [fs.readFileSync(path.join(root, 'App.tsx'), 'utf8')];
  for (const name of fs.readdirSync(appDir).sort()) {
    if (name.endsWith('.ts') || name.endsWith('.tsx')) {
      parts.push(fs.readFileSync(path.join(appDir, name), 'utf8'));
    }
  }
  return parts.join('\n');
}

module.exports = { readAppWiring };
