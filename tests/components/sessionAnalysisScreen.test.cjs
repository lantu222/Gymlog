const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', '..');
// Line endings normalised: a Windows checkout writes CRLF, and the anchors below end on "\n}\n".
const source = fs
  .readFileSync(path.join(root, 'src', 'screens', 'SessionAnalysisScreen.tsx'), 'utf8')
  .replace(/\r\n/g, '\n');

/** The text between two anchors; throws when either is missing, so a renamed anchor cannot empty the slice. */
function between(text, from, to) {
  const start = text.indexOf(from);
  assert.notEqual(start, -1, `anchor missing: ${from}`);
  const end = text.indexOf(to, start + from.length);
  assert.notEqual(end, -1, `anchor missing: ${to}`);
  return text.slice(start, end + to.length);
}

module.exports = [
  {
    name: 'the full-analysis screen follows the theme instead of a fixed dark palette',
    run() {
      // User 2026-09-13: under the light theme the page stayed dark while the
      // tab bar floating over it was light — reached from a coach chat that had
      // already gone light. The screen now builds its styles per theme.
      assert.match(source, /useThemedStyles\(makeStyles\)/);
      assert.match(source, /const makeStyles = \(theme: Theme\) => StyleSheet\.create\(\{/);
      assert.doesNotMatch(source, /from '\.\.\/lightTheme'/, 'no fixed light-theme palette import');
      assert.doesNotMatch(source, /from '\.\.\/darkTheme'/, 'no fixed dark palette import');

      // No colour of its own. The one place a colour string is built is the
      // tint helper, which only re-expresses a palette colour with alpha.
      const helper = between(source, 'function tint(', '\n}\n');
      const rest = source.replace(helper, '');
      assert.doesNotMatch(rest, /#[0-9A-Fa-f]{3,8}\b/, 'no hex colour literals');
      assert.doesNotMatch(rest, /rgba?\(/, 'no rgb/rgba literals');
    },
  },
  {
    name: 'the full-analysis screen keeps its gold readable and its button on the action colour',
    run() {
      // Gold small type on the pale light page is unreadable, so light reads the
      // palette's deep gold ink; dark keeps the gold it always had.
      const goldText = between(source, 'function goldText(', '\n}\n');
      assert.match(goldText, /theme === darkTheme \? theme\.gold : theme\.amberInk/);

      // Labels and highlights go through it rather than raw gold…
      assert.match(between(source, '  eyebrow: {', '},'), /color: goldText\(theme\)/);
      assert.match(between(source, '  sectionLabel: {', '},'), /color: goldText\(theme\)/);
      // …while the current bar is a fill, where gold reads on either ground.
      assert.match(between(source, '  barCurrent: {', '},'), /backgroundColor: theme\.gold/);

      // "Ask the coach" is pressable: the theme's action colour, and the ink
      // made for text on it.
      assert.match(between(source, '  askButton: {', '},'), /backgroundColor: theme\.highlight/);
      assert.match(between(source, '  askButtonText: {', '},'), /color: theme\.onHighlight/);
    },
  },
];
