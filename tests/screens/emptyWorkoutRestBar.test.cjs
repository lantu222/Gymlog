const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const screen = fs.readFileSync(
  path.join(__dirname, '..', '..', 'src', 'screens', 'EmptyWorkoutScreen.tsx'),
  'utf8',
);
const bar = fs.readFileSync(
  path.join(__dirname, '..', '..', 'src', 'components', 'RestBar.tsx'),
  'utf8',
);

/**
 * The freestyle rest bar, from #bugs 2026-08-28: "muistaakseni tätä lepoa ei
 * tullut kun tein penkkiä", "lepo sekosi enemmän ei näy mitään" and "ohita
 * nappi oudon värinen".
 *
 * These are source guards on purpose. The bug was a CONDITION at the call
 * site, not a wrong number inside a helper — the pure function passed its own
 * tests the whole time it was being called from behind a gate that made the
 * timer unreachable. Only reading the call site can hold that line.
 */
module.exports = [
  {
    name: 'empty workout: ticking a set is not gated on another set already waiting',
    run() {
      const handler = screen.slice(
        screen.indexOf('const toggleSetDone ='),
        screen.indexOf('const adjustRest ='),
      );
      assert.ok(handler.length > 0, 'toggleSetDone not found');

      // The rest duration comes from the lib, which owns the whole rule.
      assert.match(handler, /freestyleRestSecondsForTick\(exercise, set, defaultRestSeconds\)/);

      // And nothing between the tick and setRest asks what else is pending.
      // This is the exact shape that shipped: `if (freestyleHasSetAfter(...))`
      // around the setRest, which in a logger where the next set is created
      // AFTER the tick was false nearly every time.
      assert.doesNotMatch(handler, /hasSetAfter|SetAfter|\.some\([^)]*!\w*\.done/);
      const restStart = handler.slice(handler.indexOf('const duration ='));
      assert.match(restStart, /if \(duration !== null\) \{/);
    },
  },
  {
    name: 'empty workout: a rest carries the identity that separates it from an extension',
    run() {
      // ±15s moves the deadline of the SAME rest. Keying once-per-rest work on
      // endsAtMs re-opened the permission sheet on top of a running rest.
      assert.match(screen, /startedAtMs: number/);
      assert.match(screen, /\}, \[rest\?\.startedAtMs\]\)/);
      // The end cue is the opposite case: it must re-arm when +15s revives a
      // rest that had already finished, so it keys on the deadline.
      assert.match(screen, /restDoneCuedRef\.current !== rest\.endsAtMs/);
      assert.match(screen, /startedAtMs: current\.startedAtMs/);
    },
  },
  {
    name: 'empty workout: the room kept for the floating bar is measured, not guessed',
    run() {
      // A flat 118 holds at the default font size and stops holding at the
      // accessibility sizes, where the bar's three lines grow and it goes back
      // to covering "Lopeta treeni" — the failure the old gate existed for.
      assert.doesNotMatch(screen, /paddingBottom: \(rest \? 118 : 24\)/);
      assert.match(screen, /REST_BAR_BOTTOM \+ restBarHeight/);
      assert.match(screen, /onMeasure=\{setRestBarHeight\}/);
      assert.match(bar, /export const REST_BAR_BOTTOM = 30;/);
      assert.match(bar, /bottom: REST_BAR_BOTTOM,/);
      // Both branches of the bar report, or the done state is unmeasured.
      assert.equal((bar.match(/onLayout=\{handleLayout\}/g) ?? []).length, 2);
    },
  },
  {
    name: 'rest bar: what sits on the purple field does not follow the theme',
    run() {
      // theme.surface is #FFFFFF on light and #191436 on dark, but the bar is
      // purple in BOTH — so on dark the Skip pill became a near-black hole
      // lettered in the same purple as the bar behind it.
      const styles = bar.slice(bar.indexOf('const makeStyles ='));
      const solid = styles.slice(styles.indexOf('pillSolid: {'), styles.indexOf('pillText: {'));
      assert.match(solid, /backgroundColor: '#FFFFFF'/);
      const solidText = styles.slice(styles.indexOf('pillTextSolid: {'), styles.indexOf('pillTextOnGreen'));
      assert.doesNotMatch(solidText, /theme\./);
      const fill = styles.slice(styles.indexOf('progressFill: {'));
      assert.doesNotMatch(fill, /theme\.surface/);
    },
  },
];
