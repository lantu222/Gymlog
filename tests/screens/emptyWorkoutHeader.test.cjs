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
module.exports = [
  {
    name: 'empty workout header: both sides share one flexible width and the centre only takes its own',
    run() {
      const header = screen.slice(
        screen.indexOf('<View style={styles.header}>'),
        screen.indexOf('{/* stat strip */}'),
      );
      assert.ok(header.length > 0, 'header block not found');

      // Two side slots, one of them the end-aligned variant, around one centre.
      assert.equal((header.match(/styles\.headerSide\b/g) ?? []).length, 2, 'expected exactly two side slots');
      assert.match(header, /\[styles\.headerSide, styles\.headerSideEnd\]/);
      assert.equal((header.match(/styles\.headerCenter/g) ?? []).length, 1);

      const styles = screen.slice(screen.indexOf('headerSide: {'), screen.indexOf('headerTitle: {'));
      // Equal flexible sides: grow from a zero basis, so "Lopeta" being wider
      // than the chevron changes nothing about where the middle lands.
      assert.match(styles, /headerSide: \{[^}]*flexGrow: 1,[^}]*flexBasis: 0,/s);
      assert.match(styles, /headerSideEnd: \{[^}]*alignItems: 'flex-end',/s);
      // And the centre is NOT the flexible one — that is the exact shape that
      // shipped off-centre.
      const centre = styles.slice(styles.indexOf('headerCenter: {'), styles.indexOf('}', styles.indexOf('headerCenter: {')));
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
      const rowStart = screen.indexOf('  header: {');
      const row = screen.slice(rowStart, screen.indexOf('},', rowStart));
      assert.doesNotMatch(row, /padding/);
    },
  },
];
