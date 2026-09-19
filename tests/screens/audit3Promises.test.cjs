const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const read = (...parts) => fs.readFileSync(path.join(ROOT, ...parts), 'utf8').replace(/\r\n/g, '\n');
const strip = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const i18n = read('src', 'lib', 'i18n.ts');

function bothLanguages(key) {
  assert.equal(i18n.split(`'${key}':`).length - 1, 2, `${key} is missing one of its two languages`);
}

/**
 * What the app promises and what it does — audit round 3, 2026-09-19.
 *
 * Wiring guards, comments stripped: every fix below explains the old shape in
 * a comment, and a guard a comment can satisfy guards nothing.
 */
module.exports = [
  {
    name: 'photo import: the notice the privacy policy promises is shown before the photo leaves',
    run() {
      const app = strip(read('App.tsx'));

      // The policy, in both languages, says the online mode is entered by
      // reading a notice — and names importing from a photo as one of its
      // three doors. The notice lived only in the chat screen.
      for (const file of ['privacy.en.md', 'privacy.fi.md']) {
        const policy = read('docs', 'legal', file);
        assert.match(policy, /photo|valokuva/i, `${file} no longer mentions the photo path`);
      }

      // One gate, in the one function every entry point goes through: the
      // sheet is rendered from three screens, and a gate placed in it would be
      // missed by a fourth.
      assert.match(app, /function askPhotoOnlineNotice\(\): Promise<boolean> \{/);
      assert.match(app, /if \(preferences\.aiOnlineNoticeAcknowledged\) \{\s*return Promise\.resolve\(true\);\s*\}/);
      assert.match(
        app,
        /async function pickProgramImageForImport\(\): Promise<ProgramImageImportResult> \{\s*if \(!\(await askPhotoOnlineNotice\(\)\)\) \{/,
        'the notice must be asked before anything else in the import',
      );
      // Acknowledged once, for the coach as a whole — the chat reads the same
      // flag and must not ask again.
      assert.match(app, /void updatePreferences\(\{ aiOnlineNoticeAcknowledged: true \}\);/);
      // And the notice is asked BEFORE the picker opens, not after a photo has
      // been chosen.
      assert.ok(
        app.indexOf('askPhotoOnlineNotice()') < app.indexOf('await pickProgramImage()'),
        'the photo is picked only after the notice is answered',
      );

      for (const key of [
        'csv.photo.notice.title',
        'csv.photo.notice.body',
        'csv.photo.notice.continue',
        'csv.photo.notice.cancel',
      ]) {
        bothLanguages(key);
      }
    },
  },
  {
    name: 'photo import: a reader who backs out is not told their photo was unreadable',
    run() {
      const app = strip(read('App.tsx'));
      const sheet = strip(read('src', 'components', 'NewProgramSheet.tsx'));

      // Four endings, three answers: read, the reader ended it, or it failed.
      assert.match(read('src', 'utils', 'programImagePicker.ts'), /export type ProgramImageImportResult =/);
      assert.match(app, /if \(picked\.status === 'cancelled'\) \{\s*return \{ status: 'cancelled' \};/);
      assert.match(app, /\? \{ status: 'read', csv: programTableToCsv\(rows\) \} : \{ status: 'failed' \};/);
      // The sheet speaks only for a real failure.
      assert.match(sheet, /if \(result\.status === 'read'\) \{\s*setCsvText\(result\.csv\);\s*\} else if \(result\.status === 'failed'\) \{/);
      assert.doesNotMatch(sheet, /const csv = await onPickImage\(\)/, 'the sheet reads the old null-for-everything shape');
    },
  },
  {
    name: 'programme import: the free cap keeps the table the photo cost, rather than closing over it',
    run() {
      const sheet = strip(read('src', 'components', 'NewProgramSheet.tsx'));
      const handler = sheet.slice(sheet.indexOf('async function handleImport()'), sheet.indexOf('return (', sheet.indexOf('async function handleImport()')));
      assert.ok(handler.length > 0, 'the import handler moved');
      // `createUnlessAtLimit` shows the limit sheet and RESOLVES, so awaiting
      // it said nothing: the sheet closed and reset() threw the table away.
      assert.match(handler, /const saved = await onImportProgram\(/);
      assert.match(handler, /if \(saved === false\) \{\s*return;\s*\}/);
      assert.ok(handler.indexOf('if (saved === false)') < handler.indexOf('handleClose()'), 'closed only on a save that happened');
      assert.match(handler, /catch \{\s*setImportError\(t\(language, 'csv\.import\.failed'\)\);/);
      bothLanguages('csv.import.failed');

      // And every caller answers it.
      for (const file of [['App.tsx'], ['src', 'app', 'renderProfileTab.tsx'], ['src', 'app', 'renderWorkoutTab.tsx']]) {
        const source = strip(read(...file));
        const at = source.indexOf('onImportProgram={async (draft) => {');
        assert.notEqual(at, -1, `${file.join('/')} no longer imports programmes`);
        const wiring = source.slice(at, source.indexOf('}}', at));
        assert.match(wiring, /if \(!workoutTemplateId\) \{[\s\S]{0,200}return false;/, `${file.join('/')} does not report a refusal`);
        assert.match(wiring, /return true;/, `${file.join('/')} does not report a save`);
      }
    },
  },
  {
    name: 'progress: a refused weigh-in or measurement write is said out loud',
    run() {
      const tab = strip(read('src', 'app', 'renderProgressTab.tsx'));

      // The success buzz used to fire on the line after a fire-and-forget
      // delete, before the write had resolved, with the rejection dropped.
      assert.doesNotMatch(tab, /void deleteBodyweightEntry\(/);
      assert.doesNotMatch(tab, /void deleteMeasurementEntry\(/);
      for (const call of ['deleteBodyweightEntry', 'deleteMeasurementEntry']) {
        assert.match(
          tab,
          new RegExp(`${call}\\(entryId\\)\\s*\\.then\\(\\(\\) => haptics\\.success\\(\\)\\)\\s*\\.catch\\(`),
          `${call} still buzzes before the write lands`,
        );
      }
      assert.equal(tab.split("'toast.entryDeleteFailed'").length - 1, 2);
      assert.equal(tab.split("'toast.entrySaveFailed'").length - 1, 2);
      assert.equal(tab.split('haptics.error()').length - 1, 4, 'every refused write buzzes as one');
      bothLanguages('toast.entryDeleteFailed');
      bothLanguages('toast.entrySaveFailed');

      // The tab had no way to say anything at all.
      assert.match(tab, /showToast: \(message: string\) => void;/);
      assert.match(strip(read('App.tsx')), /content = renderProgressTab\(\{[\s\S]{0,2000}showToast,/);
    },
  },
  {
    name: 'log export: a share the phone refuses is reported, not swallowed',
    run() {
      const screen = strip(read('src', 'screens', 'ExportPlanScreen.tsx'));
      const handler = screen.slice(screen.indexOf('async function shareLog()'), screen.indexOf('return (', screen.indexOf('async function shareLog()')));
      assert.ok(handler.length > 0, 'the log share moved');
      // A log past what an intent can carry used to land in the same catch as
      // a dismissed sheet, under "nothing to recover from".
      assert.match(handler, /catch \(error\) \{[\s\S]{0,200}setLogError\(t\(language, 'export\.log\.tooBig'\)\);/);
      assert.doesNotMatch(handler, /\} catch \{/, 'a bare catch cannot tell a refusal from a dismissal');
      // Dismissing the sheet is still not a failure.
      assert.match(handler, /if \(result\.action === Share\.dismissedAction\) \{\s*return;\s*\}/);
      assert.match(screen, /\{logError \? <Text style=\{styles\.rowError\}>\{logError\}<\/Text> : null\}/);
      bothLanguages('export.log.tooBig');
    },
  },
];
