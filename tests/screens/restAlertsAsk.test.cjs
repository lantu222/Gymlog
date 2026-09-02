const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (...parts) => fs.readFileSync(path.join(__dirname, '..', '..', ...parts), 'utf8');
const empty = read('src', 'screens', 'EmptyWorkoutScreen.tsx');
const guided = read('src', 'screens', 'GuidedPlayerScreen.tsx');
const tab = read('src', 'app', 'renderWorkoutTab.tsx');
const i18n = read('src', 'lib', 'i18n.ts');

/**
 * The first-rest permission moment, measured on the emulator 2026-09-02:
 * three rests in an empty workout, one ladder. The ask granted the OS
 * permission and mirrored the rest that prompted it, and never touched the
 * master switch every later rest was gated on. The guided player never
 * asked at all. Source guards, because the moment is wiring across four
 * files and the pure rule is tested in tests/lib/restAlertAnswer.test.cjs.
 */
module.exports = [
  {
    name: 'rest alerts: both workout screens ask at the first rest through the one hook, and render the sheet',
    run() {
      for (const [name, src] of [['EmptyWorkoutScreen', empty], ['GuidedPlayerScreen', guided]]) {
        assert.match(src, /useRestAlertPermissionMoment\(\{/, `${name} does not use the shared moment`);
        assert.match(src, /<RestAlertsSheet\s+visible=\{restAsk\.sheetOpen\}/, `${name} does not render the sheet from it`);
        assert.match(src, /onAnswered: onRestAlertsAnswered,/, `${name} does not report the answer`);
      }
      // And the hook asks only once the OS answer is in: a screen that mounts
      // onto a running rest must not show the sheet for a permission that was
      // never undetermined.
      const hook = read('src', 'hooks', 'useRestAlertPermissionMoment.ts');
      assert.match(hook, /useState<RestAlertPermission \| null>\(null\)/);
      assert.match(hook, /if \(!resolved \|\| !restRunning \|\| restKey === null\)/);
      assert.match(hook, /\}, \[restKey, resolved\]\);/);
      // The empty workout no longer keeps its own copy of the moment.
      assert.doesNotMatch(empty, /const \[permissionSheetOpen|const allowAlerts = async/);
    },
  },
  {
    name: 'rest alerts: the guided player honours the master switch like the empty workout does',
    run() {
      // The OS mirror goes through one wrapper that reads restAlerts.alerts;
      // the raw hook result is only handed the rest again when permission
      // has just landed.
      assert.match(guided, /syncRestEndAlert\(restAlerts\.alerts \? endsAtMs : null, nextName\)/);
      const rawCalls = (guided.match(/syncRestEndAlert\(/g) ?? []).length;
      assert.equal(rawCalls, 1, 'the raw sync is called from the wrapper only');
      // The sheet freezes the step, so a short rest cannot expire behind the
      // ask; unfreezing re-runs the step effect, which mirrors the rest.
      assert.match(guided, /const frozen = paused \|\| howtoOpen \|\| exitOpen \|\| pauseSheetOpen \|\| swapOpen \|\| ownBlock !== null \|\| restAsk\.sheetOpen;/);
      assert.match(guided, /restAlerts\?: \{ alerts: boolean; warning: boolean; ongoing: boolean; asked: boolean \};/);
    },
  },
  {
    name: 'rest alerts: the app records the answer through the one rule, for both screens',
    run() {
      assert.match(tab, /import \{ restAlertsAnswered \} from '\.\.\/lib\/restAlertAnswer';/);
      const writes = tab.match(/notificationPrefs: restAlertsAnswered\(preferences\.notificationPrefs, outcome\)/g) ?? [];
      assert.equal(writes.length, 2, 'both screens write the answer through restAlertsAnswered');
      assert.doesNotMatch(tab, /onRestAlertsAsked/);
      // Both screens are told whether the ask has happened.
      assert.equal((tab.match(/asked: preferences\.notificationPrefs\.restAlertsAsked,/g) ?? []).length, 2);
    },
  },
  {
    name: 'rest alerts: the sheet promises what the card does — an end time, and a tap back in',
    run() {
      // The card states the wall-clock end (not a countdown) and every action
      // opens the app (opensAppToForeground), so the old "Countdown on the
      // lock screen, skip without unlocking" promised two things it did not do.
      const b2 = [...i18n.matchAll(/'rest\.perm\.b2': '([^']*)'/g)].map((m) => m[1]);
      assert.equal(b2.length, 2, 'EN and FI');
      for (const line of b2) {
        assert.doesNotMatch(line, /Countdown|without unlocking|Laskuri|ilman avaamista/i);
      }
    },
  },
];
