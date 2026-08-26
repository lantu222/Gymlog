const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  buildProgramCapNotice,
  programCapNoticeKey,
} = require('../../.test-dist/lib/programCapNotice.js');
const {
  FREE_ACTIVE_PROGRAM_CAP,
  PRO_ACTIVE_PROGRAM_CAP,
} = require('../../.test-dist/lib/activeProgramSet.js');

module.exports = [
  {
    name: 'cap notice: the first programme is explained in words, not as a fraction',
    run() {
      // The cap was enforced and never mentioned until the try that failed, so
      // the reader met it as a wall instead of a number they had been watching
      // (user 2026-08-26). "1/2" means nothing to someone seeing it first.
      const first = buildProgramCapNotice({ activePlanIds: [], proUnlocked: false });
      assert.equal(first.used, 1);
      assert.equal(first.cap, FREE_ACTIVE_PROGRAM_CAP);
      assert.equal(first.explain, true);
      assert.equal(programCapNoticeKey(first), 'first');
    },
  },
  {
    name: 'cap notice: it counts the state the reader is about to be in',
    run() {
      // Reporting the set they are leaving would say "0/2 running" on the
      // screen that just started one.
      const second = buildProgramCapNotice({ activePlanIds: ['plan_a'], proUnlocked: false });
      assert.equal(second.used, 2);
      assert.equal(second.explain, false);
      assert.equal(second.atCap, true, 'two of two is the last place on the free tier');
      assert.equal(programCapNoticeKey(second), 'last');

      const roomy = buildProgramCapNotice({ activePlanIds: ['plan_a'], proUnlocked: true });
      assert.equal(roomy.cap, PRO_ACTIVE_PROGRAM_CAP);
      assert.equal(roomy.atCap, false);
      assert.equal(programCapNoticeKey(roomy), 'count');
    },
  },
  {
    name: 'cap notice: a repeated id from an older build does not report a full set',
    run() {
      // The set is de-duplicated wherever it is written, but a stored list can
      // still hold a repeat — counting one twice would tell a reader with one
      // programme that they are at the limit.
      const notice = buildProgramCapNotice({
        activePlanIds: ['plan_a', 'plan_a'],
        proUnlocked: false,
      });
      assert.equal(notice.used, 2);
      assert.equal(notice.explain, false);
    },
  },
  {
    name: 'cap notice: a Pro reader at the cap is told to drop one, never to buy',
    run() {
      const full = buildProgramCapNotice({
        activePlanIds: ['a', 'b', 'c', 'd'],
        proUnlocked: true,
      });
      assert.equal(full.used, PRO_ACTIVE_PROGRAM_CAP);
      assert.equal(programCapNoticeKey(full), 'last');
      const fi = fs.readFileSync(path.join(__dirname, '../../src/lib/i18n.ts'), 'utf8');
      const line = fi.match(/'programs\.cap\.last': 'Sinulla.*|'programs\.cap\.last': '\{program\}.*/g) ?? [];
      assert.ok(line.length >= 1, 'the last-place wording must exist in Finnish and English');
      for (const wording of line) {
        assert.doesNotMatch(
          wording,
          /\bPro\b|\bosta\b|\bupgrade\b|\bpäivitä\b/i,
          `selling to someone at the cap: ${wording}`,
        );
      }
    },
  },
  {
    name: 'cap notice: all three adoption paths speak through one helper',
    run() {
      const app = require('../helpers/appWiringSource.cjs').readAppWiring();
      // Three separately worded toasts is how they drift apart.
      assert.doesNotMatch(app, /'season\.joined'/);
      assert.equal(app.split('showToast(programCapToast(plan.name));').length - 1, 3);
      // Counted from the set BEFORE the write, which is what this closure holds.
      assert.match(app, /activePlanIds: preferences\.activePlanIds,\s*\n\s*proUnlocked: resolveProEntitlement/);
    },
  },
];
