const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const screen = fs.readFileSync(
  path.join(__dirname, '..', '..', 'src', 'screens', 'EmptyWorkoutScreen.tsx'),
  'utf8',
);

/**
 * The freestyle header, from #bugs 2026-08-28: "kello vähän sivussa
 * ylhäällä".
 *
 * The title and clock sat in a `flex: 1` slot between a 24px chevron and a
 * ~60px "Lopeta", so they centred on the leftover space — about 35px left of
 * the screen's middle. A source guard, because the layout that was wrong
 * type-checked and rendered; only the geometry was off, and the geometry is
 * these three styles.
 */
/**
 * The text between two markers, and a failure when either is missing.
 *
 * `source.slice(indexOf(a), indexOf(b))` with a marker gone yields '' — and
 * every doesNotMatch below passes on '' (PR #42 review). A guard whose
 * anchors can vanish without it noticing is not guarding the anchors.
 */
function between(source, start, end) {
  const from = source.indexOf(start);
  assert.ok(from >= 0, `marker not found: ${start}`);
  const to = source.indexOf(end, from + start.length);
  assert.ok(to > from, `end marker not found after ${start}: ${end}`);
  return source.slice(from, to);
}

module.exports = [
  {
    name: 'empty workout header: both sides share one flexible width and the centre only takes its own',
    run() {
      const header = between(screen, '<View style={styles.header}>', '{/* stat strip */}');

      // Two side slots, one of them the end-aligned variant, around one centre.
      assert.equal((header.match(/styles\.headerSide\b/g) ?? []).length, 2, 'expected exactly two side slots');
      assert.match(header, /\[styles\.headerSide, styles\.headerSideEnd\]/);
      assert.equal((header.match(/styles\.headerCenter/g) ?? []).length, 1);

      const styles = between(screen, 'headerSide: {', 'headerTitle: {');
      // Equal flexible sides: grow from a zero basis, so "Lopeta" being wider
      // than the chevron changes nothing about where the middle lands.
      assert.match(styles, /headerSide: \{[^}]*flexGrow: 1,[^}]*flexBasis: 0,/s);
      assert.match(styles, /headerSideEnd: \{[^}]*alignItems: 'flex-end',/s);
      // And the centre is NOT the flexible one — that is the exact shape that
      // shipped off-centre.
      const centre = between(styles, 'headerCenter: {', '}');
      assert.doesNotMatch(centre, /flex: 1|flexGrow/);

      // Android clips a Pressable's hitSlop to its parent. The slots stretch
      // to the row's height and carry the row's padding, so the chevron's
      // 44dp target is not cut to its 24px glyph (PR review). The row itself
      // must therefore hold no padding — put it back there and the slots
      // shrink to their buttons again.
      assert.match(styles, /headerSide: \{[^}]*alignSelf: 'stretch',[^}]*paddingLeft: 16,/s);
      assert.match(styles, /headerSideEnd: \{[^}]*paddingRight: 16,/s);
      // The block only, up to its closing brace: a comment after it that
      // mentions padding must not be what satisfies (or fails) this.
      const row = between(screen, '  header: {', '},');
      assert.doesNotMatch(row, /padding/);
    },
  },
];
