const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  PRO_CHAT_MAX_BARS,
  buildProChatHeroScript,
  countTrailingStall,
} = require('../../.test-dist/lib/proChatHero.js');
const { setNumberLanguage } = require('../../.test-dist/lib/format.js');

const chart = (points, projectedNext) => ({
  liftName: 'Bench press',
  points,
  latest: points[points.length - 1],
  projectedNext,
  sessions: points.length,
});

module.exports = [
  {
    name: 'proChatHero: the conversation is built from the reader’s own numbers',
    run() {
      const script = buildProChatHeroScript(
        chart([60, 62.5, 65, 67.5], 70),
        'kg',
        3,
        'Example lift',
      );

      assert.equal(script.personal, true);
      assert.equal(script.liftName, 'Bench press');
      assert.equal(script.lines.length, 4);
      assert.deepEqual(
        script.lines.map((line) => line.who),
        ['user', 'coach', 'user', 'coach'],
      );

      // Every figure in the copy traces to the log, not to the script.
      const opener = script.lines[0];
      assert.equal(opener.vars.lift, 'Bench press');
      const answer = script.lines[1];
      // Formatted, not raw. i18n stringifies whatever it is given, so a raw
      // 67.5 wrote "67.5 kg" into a Finnish sentence while every other screen
      // said 67,5 — the whole point of routing these through the formatter.
      setNumberLanguage('fi');
      const fi = buildProChatHeroScript(chart([60, 62.5, 65, 67.5], 70), 'kg', 3, 'x');
      assert.equal(fi.lines[1].vars.to, '67,5');
      setNumberLanguage('en');

      assert.equal(answer.vars.from, '60');
      assert.equal(answer.vars.to, '67.5');
      assert.equal(answer.vars.next, '70');
      assert.equal(answer.vars.unit, 'kg');

      // The follow-up quotes the frequency they gave in onboarding.
      assert.equal(script.lines[2].vars.days, 3);
    },
  },
  {
    name: 'proChatHero: a stalled lift gets the stall conversation, not the rising one',
    run() {
      // Three sessions on one load is the app's own plateau threshold
      // (PLATEAU_STALL_SESSIONS), so the opener has to change at exactly the
      // point Home would start showing the plateau card. Two different
      // thresholds would have the page and the app disagreeing about whether
      // this reader is stuck.
      const rising = buildProChatHeroScript(chart([80, 82.5, 85, 85], 87.5), 'kg', 2, 'x');
      assert.equal(rising.lines[0].key, 'pro.v4.line.rising.q');

      const stalled = buildProChatHeroScript(chart([80, 85, 85, 85], 87.5), 'kg', 2, 'x');
      assert.equal(stalled.lines[0].key, 'pro.v4.line.stalled.q');
      assert.equal(stalled.lines[0].vars.count, 3);
      assert.equal(stalled.lines[0].vars.weight, '85');
      assert.equal(stalled.lines[1].key, 'pro.v4.line.stalled.a');
    },
  },
  {
    name: 'proChatHero: countTrailingStall counts the run on the current load only',
    run() {
      assert.equal(countTrailingStall([]), 0);
      assert.equal(countTrailingStall([80]), 1);
      assert.equal(countTrailingStall([80, 82.5]), 1);
      assert.equal(countTrailingStall([85, 85, 80]), 1);
      assert.equal(countTrailingStall([80, 85, 85, 85]), 3);
      // An earlier run at the same weight does not add to the current one —
      // the lift moved away and came back, which is not a plateau.
      assert.equal(countTrailingStall([85, 85, 90, 85, 85]), 2);
    },
  },
  {
    name: 'proChatHero: exactly one bar is plan, and it is the app’s real next step',
    run() {
      const script = buildProChatHeroScript(chart([60, 62.5, 65], 67.5), 'kg', 3, 'x');
      const { chart: bars } = script.lines[1];

      // Three logged + one projected. The mock drew three yellow bars; two of
      // them would have been invented, because the app computes one step.
      assert.deepEqual(bars.bars, [60, 62.5, 65, 67.5]);
      assert.equal(bars.projected, 1);
      assert.equal(bars.sessions, 3);
      assert.equal(bars.bars[bars.bars.length - 1], 67.5, 'the plan bar is projectedNext');
    },
  },
  {
    name: 'proChatHero: a long history is trimmed from the head, never the tail',
    run() {
      const points = Array.from({ length: 40 }, (_, index) => 50 + index);
      const script = buildProChatHeroScript(chart(points, 90), 'kg', 3, 'x');
      const { chart: bars } = script.lines[1];

      assert.equal(bars.bars.length, PRO_CHAT_MAX_BARS);
      // The recent sessions are the ones the conversation is about. Dropping
      // the tail instead would draw a trend that stops before the weight the
      // opener quotes.
      assert.equal(bars.bars[bars.bars.length - 1], 90);
      assert.equal(bars.bars[bars.bars.length - 2], 89);
      // Fifteen logged sessions plus the one projected bar.
      assert.equal(bars.bars[0], 75);
    },
  },
  {
    name: 'proChatHero: no log means a sample conversation that admits it is one',
    run() {
      const script = buildProChatHeroScript(null, 'kg', 3, 'Bench press');

      // This is the flag the screen hangs its EXAMPLE chip on. Sample figures
      // shown as the reader's own is exactly the seed-data lie this codebase
      // already shipped once.
      assert.equal(script.personal, false);
      assert.equal(script.liftName, 'Bench press');
      assert.ok(script.lines.length >= 4, 'the sample runs the same shape, not a shorter one');
      assert.ok(script.lines.some((line) => line.chart), 'including the chart');
    },
  },
  {
    name: 'proChatHero: a reader who never gave a frequency still gets a follow-up',
    run() {
      // setupDaysPerWeek is nullable — onboarding can be skipped. Quoting
      // "only null times a week" is the failure this replaces.
      const script = buildProChatHeroScript(chart([60, 62.5], 65), 'kg', null, 'x');
      assert.equal(script.lines.length, 4);
      assert.equal(script.lines[2].key, 'pro.v4.line.missed.q');
      assert.equal(script.lines[3].key, 'pro.v4.line.missed.a');
      for (const line of script.lines) {
        for (const value of Object.values(line.vars ?? {})) {
          assert.notEqual(value, null);
          assert.notEqual(value, undefined);
        }
      }
    },
  },
  {
    name: 'proChatHero: the sample never claims the reader’s frequency',
    run() {
      // With no log, daysPerWeek belongs to the sample too. Mixing a real
      // frequency into sample lifts would make the EXAMPLE chip a half-truth.
      const script = buildProChatHeroScript(null, 'kg', 5, 'x');
      assert.equal(script.personal, false);
      assert.notEqual(script.lines[2].vars?.days, 5);
    },
  },
  {
    name: 'proChatHero: the hero does not end on a lock',
    run() {
      // The mock closed the conversation with "the rest of this answer is in
      // Pro" and "3 / 3 free questions used". Both were cut (user decision):
      // the quota line is false for anyone who has not spent theirs, and a
      // page whose job is to close should not spend its hero withholding.
      // The paywall moments on Home and in the chat already do that, in the
      // place where the reader actually hit the wall.
      // Checked by what the component can render, not by the word: the header
      // comment explains the removal and has to be allowed to say "lock".
      const source = fs.readFileSync(
        path.join(__dirname, '..', '..', 'src', 'components', 'ProChatHero.tsx'),
        'utf8',
      );
      assert.doesNotMatch(source, /'pro\.v4\.(lock|quota)/);
      const i18n = fs.readFileSync(
        path.join(__dirname, '..', '..', 'src', 'lib', 'i18n.ts'),
        'utf8',
      );
      assert.doesNotMatch(i18n, /'pro\.v4\.(lock|quota)/, 'the lock copy must not come back by key');

      const script = buildProChatHeroScript(chart([60, 62.5], 65), 'kg', 2, 'x');
      const last = script.lines[script.lines.length - 1];
      assert.equal(last.who, 'coach', 'the loop ends on a complete answer');
    },
  },
];
