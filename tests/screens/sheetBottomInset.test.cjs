const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..', '..');
const SRC_ROOT = path.join(REPO_ROOT, 'src');

/**
 * `useSafeAreaInsets().bottom` reads 0 in this app when it is called inside
 * the same function that renders a React Native `<Modal>` — verified on a
 * device with three-button navigation (see AddExerciseSheet.tsx history,
 * 027604b3 -> 2d63a0f5, and the sheets fixed alongside this guard,
 * 2026-09-26). The working shape is: the SCREEN that mounts the sheet reads
 * the inset (outside any Modal) and hands it down as a `bottomInset` prop;
 * the sheet takes the prop and never calls the hook itself.
 *
 * This scans source function-by-function (not file-by-file) for the broken
 * shape: a function that both calls `useSafeAreaInsets()` and uses that same
 * variable to pad a `<Modal>` it renders. A screen that reads the inset and
 * hands it to a *separate* sheet component is the correct pattern and must
 * not trip this — which is why the check requires the hook's own variable to
 * be referenced *inside* that Modal's subtree, not merely present somewhere
 * in the same file.
 */

function walkTsx(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkTsx(full, out);
    } else if (entry.name.endsWith('.tsx')) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Finds the index of the bracket matching `text[openIndex]` (one of
 * `( { [`), skipping over string/template literals and comments so a brace
 * inside a quoted string or a comment never throws the count off.
 */
function findMatchingBracket(text, openIndex) {
  const openChar = text[openIndex];
  const closeChar = { '(': ')', '{': '}', '[': ']' }[openChar];
  if (!closeChar) return -1;
  let depth = 0;
  for (let i = openIndex; i < text.length; i++) {
    const ch = text[i];
    if (ch === '/' && text[i + 1] === '/') {
      const nl = text.indexOf('\n', i);
      i = nl === -1 ? text.length : nl;
      continue;
    }
    if (ch === '/' && text[i + 1] === '*') {
      const end = text.indexOf('*/', i + 2);
      i = end === -1 ? text.length : end + 1;
      continue;
    }
    if (ch === '"' || ch === "'") {
      const quote = ch;
      i++;
      while (i < text.length && text[i] !== quote) {
        if (text[i] === '\\') i++;
        i++;
      }
      continue;
    }
    if (ch === '`') {
      i++;
      let tplDepth = 0;
      while (i < text.length) {
        if (text[i] === '\\') {
          i++;
        } else if (text[i] === '`' && tplDepth === 0) {
          break;
        } else if (text[i] === '$' && text[i + 1] === '{') {
          tplDepth++;
          i++;
        } else if (text[i] === '}' && tplDepth > 0) {
          tplDepth--;
        }
        i++;
      }
      continue;
    }
    if (ch === openChar) depth++;
    else if (ch === closeChar) {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * Every top-level `function Name(...) { ... }` (optionally exported)
 * declaration's body span `[bodyOpenIndex, bodyCloseIndex]`. Sub-components
 * defined as their own top-level `function` (the norm in this codebase — see
 * GPSheet vs. GuidedPlayer) are separate spans, which is the point: reading
 * the inset in one function and rendering a sheet component defined in
 * another is the fix, not the bug.
 */
function findFunctionBodies(text) {
  const bodies = [];
  const re = /^(?:export\s+)?function\s+[A-Za-z0-9_]+\s*\(/gm;
  let match;
  while ((match = re.exec(text))) {
    const parenOpen = match.index + match[0].length - 1;
    const parenClose = findMatchingBracket(text, parenOpen);
    if (parenClose === -1) continue;
    const braceOpen = text.indexOf('{', parenClose + 1);
    if (braceOpen === -1) continue;
    const braceClose = findMatchingBracket(text, braceOpen);
    if (braceClose === -1) continue;
    bodies.push([braceOpen, braceClose]);
  }
  return bodies;
}

/**
 * Every `<Modal ...>...</Modal>` (or self-closing `<Modal ... />`) span
 * within `body`, as `[tagStart, subtreeEnd]` pairs.
 */
function findModalSpans(body) {
  const spans = [];
  let i = 0;
  while (i < body.length) {
    const openIdx = body.indexOf('<Modal', i);
    if (openIdx === -1) break;
    const after = body[openIdx + 6];
    if (after !== ' ' && after !== '>' && after !== '\n' && after !== '\t' && after !== '/') {
      i = openIdx + 6;
      continue;
    }
    const tagEnd = body.indexOf('>', openIdx);
    if (tagEnd === -1) {
      i = openIdx + 6;
      continue;
    }
    if (body[tagEnd - 1] === '/') {
      spans.push([openIdx, tagEnd + 1]);
      i = tagEnd + 1;
      continue;
    }
    let depth = 1;
    let cursor = tagEnd + 1;
    let closeIdx = -1;
    while (cursor < body.length) {
      const nextOpen = body.indexOf('<Modal', cursor);
      const nextClose = body.indexOf('</Modal>', cursor);
      if (nextClose === -1) break;
      if (nextOpen !== -1 && nextOpen < nextClose) {
        const innerTagEnd = body.indexOf('>', nextOpen);
        if (innerTagEnd !== -1 && body[innerTagEnd - 1] !== '/') {
          depth++;
        }
        cursor = nextOpen + 6;
      } else {
        depth--;
        cursor = nextClose + '</Modal>'.length;
        if (depth === 0) {
          closeIdx = cursor;
          break;
        }
      }
    }
    if (closeIdx !== -1) {
      spans.push([openIdx, closeIdx]);
      i = closeIdx;
    } else {
      i = tagEnd + 1;
    }
  }
  return spans;
}

function scanFile(filePath, relPath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const violations = [];
  for (const [bodyStart, bodyEnd] of findFunctionBodies(text)) {
    const body = text.slice(bodyStart, bodyEnd + 1);
    const hookMatch = /const\s+(\w+)\s*=\s*useSafeAreaInsets\(\)/.exec(body);
    if (!hookMatch) continue;
    const varName = hookMatch[1];
    const usageRe = new RegExp('\\b' + varName + '\\.');
    for (const [mStart, mEnd] of findModalSpans(body)) {
      const subtree = body.slice(mStart, mEnd);
      if (usageRe.test(subtree)) {
        const globalIndex = bodyStart + mStart;
        const line = text.slice(0, globalIndex).split('\n').length;
        violations.push(`${relPath}:${line} — "${varName}" (useSafeAreaInsets, same function) pads a <Modal> it renders`);
      }
    }
  }
  return violations;
}

function scanTree() {
  const violations = [];
  for (const file of walkTsx(SRC_ROOT)) {
    const rel = path.relative(REPO_ROOT, file).split(path.sep).join('/');
    violations.push(...scanFile(file, rel));
  }
  return violations;
}

module.exports = [
  {
    name: 'no component reads useSafeAreaInsets and uses it to pad a <Modal> it renders itself (always 0 there on device)',
    run() {
      const violations = scanTree();
      assert.deepStrictEqual(
        violations,
        [],
        `useSafeAreaInsets() read in the same function as a <Modal> it pads — that value is 0 on a real device (#bugs 2026-08-28):\n${violations.join('\n')}`,
      );
    },
  },
  {
    // A pinned CTA that grows by the inset needs the list above it to grow by
    // the same amount, or its last rows sit under it (review of #193).
    name: 'the category sheet list clears its pinned CTA by the same inset the CTA carries',
    run() {
      const source = fs.readFileSync(path.join(SRC_ROOT, 'screens', 'ProgramsHomeScreen.tsx'), 'utf8');
      assert.match(source, /\{ paddingBottom: 34 \+ bottomInset \}/);
      assert.match(
        source,
        /contentContainerStyle=\{\[styles\.catSheetListInner, \{ paddingBottom: 108 \+ bottomInset \}\]\}/,
      );
      assert.doesNotMatch(source, /catSheetListInner: \{[^}]*paddingBottom: 108/);
    },
  },
];
