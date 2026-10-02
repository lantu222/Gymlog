const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..', '..');

/**
 * App.tsx plus every module the shell's splits moved its wiring into: the
 * phase-A render functions (src/app/, 2026-08-26) and the phase-B hooks and
 * factory VinhaApp calls where their code used to stand (2026-09-30). Guards
 * that pin how a screen is wired read this concatenation, so extracting a
 * tab or a hook from the switchboard does not read as the wiring
 * disappearing — and the next extraction needs no test edit. It reads
 * src/app one level deep, so the modules stay flat there.
 *
 * App.tsx comes first and the modules follow in name order, so assertions
 * about ordering WITHIN App.tsx keep their meaning. Cross-file [\s\S]*
 * patterns can span the joins; a guard that starts failing after an
 * extraction is telling you it matched across two files, not that the
 * wiring broke.
 *
 * Line endings are normalised to LF. A Windows checkout holds CRLF and CI holds
 * LF, and a guard that measures a window in characters (`slice(start, start +
 * N)`, `[\s\S]{0,N}`) would otherwise pass on one and fail on the other: the
 * same stretch of source is about 2% longer with CRLF.
 */
function readAppWiring() {
  const appDir = path.join(root, 'src', 'app');
  const parts = [fs.readFileSync(path.join(root, 'App.tsx'), 'utf8')];
  for (const name of fs.readdirSync(appDir).sort()) {
    if (name.endsWith('.ts') || name.endsWith('.tsx')) {
      parts.push(fs.readFileSync(path.join(appDir, name), 'utf8'));
    }
  }
  return parts.join('\n').replace(/\r\n/g, '\n');
}

module.exports = { readAppWiring };
