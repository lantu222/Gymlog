const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { buildAiCoachPreviewAnswer } = require('../../.test-dist/lib/aiCoachPreview.js');
const { t } = require('../../.test-dist/lib/i18n.js');

function context(overrides = {}) {
  return {
    unitPreference: 'kg',
    sessionsThisWeek: 2,
    sessionsLast30Days: 7,
    recentCompletedSessions: [
      {
        sessionId: 's1',
        title: 'Kyykky & Penkki',
        performedAt: new Date(2026, 7, 6, 12).toISOString(),
        durationMinutes: 48,
        setsCompleted: 14,
        swappedExercises: 0,
        noteCount: 0,
      },
    ],
    trackedLifts: [{ name: 'Penkkipunnerrus', latestWeight: 80, latestReps: '5' }],
    latestTopSets: [{ exerciseName: 'Penkkipunnerrus', weight: 80, reps: 5 }],
    plateaus: [],
    fatigue: { signal: 'steady', confident: true, acwr: 1, recoveryScore: 70, sessionCount7d: 2 },
    activeProgram: null,
    ...overrides,
  };
}

/** The chips the app offers with one tap, in both languages. */
const CHIP_KEYS = ['coach.chip.analyze', 'coach.chip.program', 'coach.chip.protein'];

module.exports = [
  {
    name: 'every quick-ask chip gets a real answer, in both languages',
    run() {
      for (const key of CHIP_KEYS) {
        for (const language of ['en', 'fi']) {
          const prompt = t(language, key);
          assert.ok(prompt && prompt !== key, `${key} missing from ${language}`);
          const answer = buildAiCoachPreviewAnswer(prompt, context(), language);
          // The app offering a question it cannot answer, and charging one of
          // three weekly questions for the privilege, is the bug this pins.
          assert.notEqual(
            answer.unanswered,
            true,
            `"${prompt}" fell through to the default "ask a clearer question"`,
          );
          assert.ok(answer.takeaway.length > 0);
        }
      }
    },
  },
  {
    name: 'the last-workout answer is read from the session, not invented',
    run() {
      const answer = buildAiCoachPreviewAnswer('Analysoi viime treenini', context(), 'fi');
      assert.match(answer.takeaway, /Kyykky & Penkki/);
      assert.ok(answer.why.some((line) => line.includes('14')), 'the set count it recorded');
      assert.ok(answer.why.some((line) => line.includes('48')), 'the duration it recorded');
      assert.ok(answer.why.some((line) => line.includes('80')), 'the top set it recorded');

      // Nothing logged: it says so rather than describing a session.
      const empty = buildAiCoachPreviewAnswer(
        'Analysoi viime treenini',
        context({ recentCompletedSessions: [] }),
        'fi',
      );
      assert.equal(empty.unanswered, true, 'and it costs nothing');
    },
  },
  {
    name: 'an unanswerable question is still flagged, and the quota respects it',
    run() {
      const answer = buildAiCoachPreviewAnswer('asdfgh', context(), 'fi');
      assert.equal(answer.unanswered, true);

      // The screen charges on answer, and skips the charge when the coach
      // could only ask for a clearer question.
      const screen = fs.readFileSync(
        path.join(__dirname, '..', '..', 'src', 'screens', 'AICoachChatScreen.tsx'),
        'utf8',
      );
      assert.match(screen, /if \(!proUnlocked && !answer\.unanswered\) \{\s*onFreeQuestionUsed\(\);/);
    },
  },
  {
    name: 'the protein answer says Vinha cannot see what you eat',
    run() {
      const answer = buildAiCoachPreviewAnswer('Paljonko proteiinia?', context(), 'fi');
      assert.match(answer.takeaway, /1,6/);
      // The app tracks no food, and an answer that implied otherwise would be
      // the coach claiming a reading it does not have.
      assert.ok(
        [...answer.why, ...answer.assumptions].some((line) => /ei seuraa|yleinen haarukka/i.test(line)),
      );
    },
  },
];
