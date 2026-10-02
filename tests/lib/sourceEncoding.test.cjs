const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// A Windows-1252 em dash (0x97) typed into a comment makes a file that is no
// longer UTF-8: git shows it, a strict decoder refuses it, and the next editor
// that re-saves it as UTF-8 turns it into a replacement character (2026-10-02).
const ROOT = path.join(__dirname, '..', '..');
const SOURCE = /\.(ts|tsx|js|cjs|mjs|json)$/;

function walk(dir, found) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, found);
    else if (SOURCE.test(entry.name)) found.push(full);
  }
  return found;
}

module.exports = [
  {
    name: 'source encoding: every file under src, api and tests is valid UTF-8',
    run() {
      const decoder = new TextDecoder('utf-8', { fatal: true });
      const bad = [];
      for (const dir of ['src', 'api', 'tests']) {
        const full = path.join(ROOT, dir);
        if (!fs.existsSync(full)) continue;
        for (const file of walk(full, [])) {
          try {
            decoder.decode(fs.readFileSync(file));
          } catch {
            bad.push(path.relative(ROOT, file));
          }
        }
      }
      assert.deepEqual(bad, [], `not valid UTF-8: ${bad.join(', ')}`);
    },
  },
];
