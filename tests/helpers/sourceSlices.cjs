const assert = require('node:assert/strict');

/**
 * Bounded slices of source text for the guards that pin wiring by regex.
 *
 * The phase-B split (2026-09-30) moves blocks of VinhaApp into src/app hooks,
 * and a guard that sliced App.tsx with a bare indexOf can go quiet when its
 * anchor leaves the file: indexOf returns -1, the slice becomes the tail of
 * the file, and a doesNotMatch over it passes about nothing. Every helper here
 * asserts its anchors, so a moved or renamed anchor fails loudly instead.
 */

/** From `from` up to (not including) the first `to` after it. Both must exist. */
function between(source, from, to) {
  const start = source.indexOf(from);
  assert.ok(start >= 0, `anchor missing: ${from}`);
  const end = source.indexOf(to, start + from.length);
  assert.ok(end > start, `anchor missing after ${from}: ${to}`);
  return source.slice(start, end);
}

/**
 * From `start` through the bracket that closes the first `opener` at or after
 * it — `through(src, 'useEffect(() => {', '{')` is that effect's body.
 */
function through(source, start, opener = '{') {
  const pairs = { '{': '}', '(': ')', '[': ']' };
  const closer = pairs[opener];
  assert.ok(closer, `unknown opener: ${opener}`);
  const from = source.indexOf(start);
  assert.ok(from >= 0, `anchor missing: ${start}`);
  const open = source.indexOf(opener, from);
  assert.ok(open >= 0, `no ${opener} after ${start}`);
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === opener) depth += 1;
    else if (source[i] === closer) {
      depth -= 1;
      if (depth === 0) return source.slice(from, i + 1);
    }
  }
  assert.fail(`unbalanced ${opener} after ${start}`);
}

/**
 * The whole declaration that starts at `signature` (which must be unique):
 * the parameter list is skipped by paren matching, then the body is matched
 * brace for brace. The body must close on a line that is exactly the
 * signature's own indentation plus `}` — a check that the match landed on
 * the declaration's end, not somewhere inside it.
 */
function functionBody(source, signature) {
  const start = source.indexOf(signature);
  assert.ok(start >= 0, `signature missing: ${signature}`);
  assert.equal(source.indexOf(signature, start + 1), -1, `signature not unique: ${signature}`);
  const lineStart = source.lastIndexOf('\n', start) + 1;
  const indent = source.slice(lineStart, start + signature.length).match(/^[ \t]*/)[0];
  let i = source.indexOf('(', start);
  assert.ok(i >= 0, `no parameter list after ${signature}`);
  let depth = 0;
  for (; i < source.length; i += 1) {
    if (source[i] === '(') depth += 1;
    else if (source[i] === ')') {
      depth -= 1;
      if (depth === 0) break;
    }
  }
  const open = source.indexOf('{', i);
  assert.ok(open >= 0, `no body after ${signature}`);
  depth = 0;
  for (let j = open; j < source.length; j += 1) {
    if (source[j] === '{') depth += 1;
    else if (source[j] === '}') {
      depth -= 1;
      if (depth === 0) {
        const closeLineStart = source.lastIndexOf('\n', j) + 1;
        assert.equal(
          source.slice(closeLineStart, j + 1),
          `${indent}}`,
          `${signature} did not close at its own indentation`,
        );
        return source.slice(start, j + 1);
      }
    }
  }
  assert.fail(`unbalanced body after ${signature}`);
}

/** The `n` characters before `anchor`, which must be unique and at least `n` characters in. */
function windowBefore(source, anchor, n) {
  const at = source.indexOf(anchor);
  assert.ok(at >= 0, `anchor missing: ${anchor}`);
  assert.equal(source.indexOf(anchor, at + 1), -1, `anchor not unique: ${anchor}`);
  assert.ok(at >= n, `anchor is only ${at} characters in, window needs ${n}: ${anchor}`);
  return source.slice(at - n, at);
}

/**
 * From `anchor` to the end of the source. A presence assert to put in front of
 * any doesNotMatch, so the absence is checked over code that is really there.
 */
function region(source, anchor) {
  const at = source.indexOf(anchor);
  assert.ok(at >= 0, `anchor missing: ${anchor}`);
  return source.slice(at);
}

module.exports = { between, through, functionBody, windowBefore, region };
