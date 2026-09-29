const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const playerSource = fs.readFileSync(
  path.join(__dirname, '..', '..', 'src', 'screens', 'GuidedPlayerScreen.tsx'),
  'utf8',
);

/**
 * Each set's opening weight is deliberately carried from the SAME set index
 * last time (workoutState.ts resolveHistoricalSetDraft), so a ramp stays a
 * ramp — but every summary on this screen used to collapse it to one weight.
 * A real case (#bugs 2026-09-29): Lantionnosto laitteessa went 16,25×8,
 * 16,25×8, 30×6, 30×6, 30×6; the set card said "30 kg · 8 8 6 6 6" and set 3
 * "suddenly" opened at 30 with nothing on screen explaining why. Owner's call,
 * decision "a": keep the per-set replay, make it visible instead of smoothing
 * it away. The formatting decision itself lives in a pure lib helper
 * (guidedSetWeightSummary.ts, its own suite); these guards are only that the
 * screen actually asks it, on both surfaces that used to print one number.
 */
module.exports = [
  {
    name: 'guided set card: a ramp gets per-set weight×reps chips, a uniform set keeps its one number',
    run() {
      assert.match(
        playerSource,
        /const historyChips = panels\?\.history \? summarizeHistoricalSetChips\(panels\.history\.sets\) : null;/,
      );
      // The heading number only renders for a uniform session — a ramp has no
      // single weight to lead with, and the chips already say the whole thing.
      assert.match(playerSource, /historyChips\?\.uniform !== false \? \(/);
      // Each chip reads from the summary, falling back to the plain rep only
      // if for some reason the summary and the history sets disagree in length.
      assert.match(playerSource, /\{historyChips\?\.chips\[index\] \?\? set\.reps\}/);
    },
  },
  {
    name: 'guided walk-up: NYT and VIIMEKSI show a range when the plan or the log was not one weight',
    run() {
      // Today's plan is read across every set of the lift, not only set 1.
      assert.match(
        playerSource,
        /const todayLoads = instance\.sets\.map\(\(_, index\) => resolveTarget\(step\.slotId, index\)\?\.loadKg \?\? null\)/,
      );
      assert.match(playerSource, /formatLoadOrRange\(todayLoads\) \?\? formatWeight\(target\.loadKg, unitPreference\)/);
      // Last time's span uses the same rule the set card's chips do — one
      // weight when every set matched, the range when they did not.
      assert.match(playerSource, /lastValue: formatLoadOrRange\(last\?\.sets\.map\(\(set\) => set\.loadKg\) \?\? \[\]\),/);
    },
  },
  {
    name: 'guided player: the ramp-visibility decision is a pure lib helper, not inline formatting',
    run() {
      assert.match(
        playerSource,
        /import \{ formatLoadOrRange, summarizeHistoricalSetChips \} from '\.\.\/lib\/guidedSetWeightSummary';/,
      );
    },
  },
];
