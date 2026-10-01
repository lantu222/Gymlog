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
  const open = bodyOpen(source, i + 1);
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

/**
 * The `{` that opens a function's body, scanning from just after its
 * parameter list. A return type is stepped over: braces inside `<…>`, `(…)` or
 * `[…]` belong to the type (`Promise<{ id: string } | null>`), and so does an
 * object type written straight after `:`, `|`, `&` or `,`. -1 if none.
 */
function bodyOpen(source, from) {
  let at = from;
  while (at < source.length && /\s/.test(source[at])) at += 1;
  if (source[at] !== ':') return source.indexOf('{', from);
  let nesting = 0;
  let previous = ':';
  for (let i = at + 1; i < source.length; i += 1) {
    const char = source[i];
    if (char === '(' || char === '[' || char === '<') nesting += 1;
    else if (char === ')' || char === ']' || (char === '>' && source[i - 1] !== '=')) nesting -= 1;
    else if (char === '{') {
      if (nesting === 0 && !':|&,'.includes(previous)) return i;
      let braces = 0;
      for (; i < source.length; i += 1) {
        if (source[i] === '{') braces += 1;
        else if (source[i] === '}') {
          braces -= 1;
          if (braces === 0) break;
        }
      }
    }
    if (!/\s/.test(source[i])) previous = source[i];
  }
  return -1;
}

/** The `n` characters before `anchor`, which must be unique and at least `n` characters in. */
function windowBefore(source, anchor, n) {
  const at = source.indexOf(anchor);
  assert.ok(at >= 0, `anchor missing: ${anchor}`);
  assert.equal(source.indexOf(anchor, at + 1), -1, `anchor not unique: ${anchor}`);
  assert.ok(at >= n, `anchor is only ${at} characters in, window needs ${n}: ${anchor}`);
  return source.slice(at - n, at);
}

module.exports = { between, functionBody, windowBefore };
