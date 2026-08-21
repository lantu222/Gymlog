const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { workoutSessionRepository } = require('../../.test-dist/storage/repositories.js');

const historySource = fs.readFileSync(
  path.join(__dirname, '..', '..', 'src', 'screens', 'HistoryScreen.tsx'),
  'utf8',
);
const i18nSource = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'lib', 'i18n.ts'), 'utf8');

function database() {
  return {
    workoutSessions: [
      { id: 's1', workoutTemplateId: 't1', workoutNameSnapshot: 'Lower', performedAt: '2026-08-21T10:00:00.000Z' },
      { id: 's2', workoutTemplateId: 't1', workoutNameSnapshot: 'Upper', performedAt: '2026-08-20T10:00:00.000Z' },
    ],
    exerciseLogs: [
      { id: 'l1', sessionId: 's1', exerciseNameSnapshot: 'Squat', tracked: true },
      { id: 'l2', sessionId: 's1', exerciseNameSnapshot: 'Leg curl', tracked: true },
      { id: 'l3', sessionId: 's2', exerciseNameSnapshot: 'Bench', tracked: true },
    ],
  };
}

module.exports = [
  {
    name: 'history delete: the sets go with the workout',
    run() {
      // Records, trends and the coach's read are all computed from the logs.
      // Left behind, they would have the app claim a personal best from a
      // workout the reader had just deleted.
      const next = workoutSessionRepository.remove(database(), 's1');

      assert.deepEqual(next.workoutSessions.map((session) => session.id), ['s2']);
      assert.deepEqual(next.exerciseLogs.map((log) => log.id), ['l3']);
    },
  },
  {
    name: 'history delete: deleting nothing changes nothing',
    run() {
      const before = database();
      const next = workoutSessionRepository.remove(before, 'gone');

      assert.equal(next.workoutSessions.length, 2);
      assert.equal(next.exerciseLogs.length, 3);
      // And the input is not mutated on the way through.
      assert.equal(before.workoutSessions.length, 2);
      assert.equal(before.exerciseLogs.length, 3);
    },
  },
  {
    name: 'history delete: the reader is told what it costs before it happens',
    run() {
      assert.match(historySource, /<ConfirmDialog[\s\S]{0,300}visible=\{pendingDelete !== null\}/);
      assert.match(historySource, /destructive/);
      // The message names the consequence rather than only asking twice.
      assert.match(i18nSource, /'history\.delete\.body': 'Treeni ja sen sarjat poistuvat\./);
      assert.match(i18nSource, /Ennätykset ja käyrät lasketaan uudelleen ilman sitä/);
      // Absent handler means no button at all, not an inert one.
      assert.match(historySource, /onDelete=\{onDeleteSession \? \(\) => setPendingDelete\(session\) : undefined\}/);
    },
  },
  {
    name: 'history chip: it speaks only when a lift is out of the trend',
    run() {
      // A chip that is on for nearly every row says nothing — and being on for
      // every row is exactly what made a reader ask what it meant.
      assert.doesNotMatch(historySource, /'history\.badge\.tracked'/);
      assert.match(historySource, /!log\.tracked && !log\.skipped \?/);
      for (const [language, expected] of [['en', 'Not tracked'], ['fi', 'Ei seurannassa']]) {
        assert.ok(
          i18nSource.includes(`'history.badge.untracked': '${expected}'`),
          `history.badge.untracked missing for ${language}`,
        );
      }
    },
  },
];
