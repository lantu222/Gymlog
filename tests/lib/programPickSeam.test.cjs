const assert = require('node:assert/strict');

const {
  PICK_BOTTOM_CLEARANCE,
  PICK_SEAM_BOTTOM_SELECTED,
  PICK_SEAM_TOP_SELECTED,
  PICK_TOP_CLEARANCE,
  PICK_TOP_PADDING,
  resolvePickSeam,
} = require('../../.test-dist/lib/programPickSeam.js');

/**
 * "Your programme is ready": the second programme's name went behind the
 * first programme's half (device, 2026-09-16).
 */

const CTA = 140;

/** The box each half gets, in points, for a seam. */
function boxes(seam, height) {
  const low = Math.min(...seam);
  const high = Math.max(...seam);
  return {
    top: (low - PICK_TOP_CLEARANCE) * height,
    bottom: height - CTA - (high + PICK_BOTTOM_CLEARANCE) * height,
  };
}

module.exports = [
  {
    name: 'pick seam: a chosen lower card that grew moves the seam up instead of hiding its name',
    run() {
      // The week strip made the chosen card ~300 points; the fixed seam gave
      // the lower box under 200, bottom-anchored, so the name rose behind the
      // upper half.
      const height = 650;
      const fixed = boxes(PICK_SEAM_BOTTOM_SELECTED, height);
      assert.ok(fixed.bottom < 300, 'the fixed seam really was too low for it');

      const seam = resolvePickSeam({
        height,
        topSelected: false,
        selectedContentHeight: 300,
        collapsedContentHeight: 80,
        ctaRoom: CTA,
      });
      const room = boxes(seam, height);
      assert.ok(room.bottom >= 300 - 0.5, `chosen card has ${room.bottom}`);
      assert.ok(room.top >= 80 + PICK_TOP_PADDING - 0.5, `collapsed name has ${room.top}`);
      // The slant is the same slant.
      assert.ok(Math.abs((seam[0] - seam[1]) - (PICK_SEAM_BOTTOM_SELECTED[0] - PICK_SEAM_BOTTOM_SELECTED[1])) < 1e-9);
    },
  },
  {
    name: 'pick seam: the collapsed name keeps its room before the chosen card grows into it',
    run() {
      const height = 650;
      const seam = resolvePickSeam({
        height,
        topSelected: true,
        selectedContentHeight: 300,
        collapsedContentHeight: 80,
        ctaRoom: CTA,
      });
      const room = boxes(seam, height);
      assert.ok(room.bottom >= 80 - 0.5, `collapsed name has ${room.bottom}`);
      assert.ok(room.top >= 300 + PICK_TOP_PADDING - 0.5, `chosen card has ${room.top}`);

      // A screen too short for both: the collapsed name is still readable,
      // and the chosen card takes what is left rather than the other way round.
      const tight = resolvePickSeam({
        height: 420,
        topSelected: true,
        selectedContentHeight: 320,
        collapsedContentHeight: 80,
        ctaRoom: CTA,
      });
      assert.ok(boxes(tight, 420).bottom >= 80 - 0.5);
    },
  },
  {
    name: 'pick seam: nothing measured is the designed seam, and nothing leaves the screen',
    run() {
      assert.deepEqual(
        resolvePickSeam({ height: 0, topSelected: true, selectedContentHeight: 0, collapsedContentHeight: 0, ctaRoom: CTA }),
        [...PICK_SEAM_TOP_SELECTED],
      );
      // Enough room already: the seam stays where it was designed.
      assert.deepEqual(
        resolvePickSeam({ height: 900, topSelected: true, selectedContentHeight: 200, collapsedContentHeight: 70, ctaRoom: CTA }),
        [...PICK_SEAM_TOP_SELECTED],
      );
      // Absurd measurements are clamped rather than drawn off the screen.
      const wild = resolvePickSeam({ height: 300, topSelected: false, selectedContentHeight: 5000, collapsedContentHeight: 10, ctaRoom: CTA });
      for (const end of wild) {
        assert.ok(end >= 0.08 && end <= 0.92, String(end));
      }
    },
  },
  {
    name: 'pick seam: the screen measures both cards and asks the rule where the seam goes',
    run() {
      const fs = require('node:fs');
      const path = require('node:path');
      const screen = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'screens', 'ProgramPickScreen.tsx'), 'utf8');
      assert.match(screen, /const \[l, r\] = resolvePickSeam\(\{/);
      assert.match(screen, /selectedContentHeight: chosen \? contentHeights\[`\$\{chosen\.id\}:selected`\]/);
      assert.match(screen, /collapsedContentHeight: collapsed \? contentHeights\[`\$\{collapsed\.id\}:collapsed`\]/);
      assert.match(screen, /onLayout=\{measureContent\(`\$\{option\.id\}:\$\{selected \? 'selected' : 'collapsed'\}`\)\}/);
      // The fixed fractions are no longer read by the screen itself.
      assert.doesNotMatch(screen, /CUT_TOP|CUT_BOTTOM/);
    },
  },
];
