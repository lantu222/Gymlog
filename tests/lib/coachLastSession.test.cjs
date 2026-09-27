const assert = require('node:assert/strict');

const { buildAiCoachSystemContext, buildAiCoachContextText } = require('../../.test-dist/lib/aiCoachSystemContext.js');
const {
  buildAiCoachLastSession,
  normalizeAiCoachTrainingContext,
} = require('../../.test-dist/lib/aiTrainingContext.js');

// "Analysoi viime treenini" answered about the session before the last one,
// in both languages, and in Finnish with the last one's date on it; the
// Finnish answer named lifts "Overhead Press" and the day "Day 3: Upper Body"
// (emulator, 2026-09-27).

function history(overrides = {}) {
  return {
    windowDays: 56,
    sessionCount: 0,
    totalVolumeKg: 0,
    sessions: [],
    lifts: [],
    weeks: [],
    schedule: null,
    truncated: false,
    ...overrides,
  };
}

function baseContext(overrides = {}) {
  return {
    unitPreference: 'kg',
    activeSession: null,
    recentCompletedSessions: [],
    trackedLifts: [],
    latestTopSets: [],
    sessionsThisWeek: 2,
    sessionsLast30Days: 8,
    rhythm: [],
    readyProgramCount: 5,
    recommendedProgramId: null,
    recommendedProgramTitle: null,
    customProgramTitle: null,
    plateaus: [],
    fatigue: { acwr: 1.05, recoveryScore: 98, signal: 'optimal', sessionCount7d: 2, confident: true },
    history: history(),
    ...overrides,
  };
}

const HISTORY_SESSIONS = [
  { sessionId: 's3', name: 'Day 3: Upper Body', performedAt: '2026-09-24T16:05:30.000Z', day: '2026-09-24', durationMinutes: 66, volumeKg: 7705, setCount: 18, exerciseCount: 8 },
  { sessionId: 's4', name: 'Day 4: Lower Body', performedAt: '2026-09-26T08:46:40.000Z', day: '2026-09-26', durationMinutes: 55, volumeKg: 14031, setCount: 14, exerciseCount: 6 },
];

const LAST_SESSION = {
  day: '2026-09-26',
  name: 'Day 4: Lower Body',
  exercises: [
    { name: 'Leg Press', sets: [{ weightKg: 215, reps: 10 }, { weightKg: 215, reps: 9 }] },
    { name: 'Leg Curl', sets: [{ weightKg: 50, reps: 12 }] },
  ],
  truncated: false,
};

function session(id, performedAt, name = 'Day 1: Upper Body') {
  return { id, workoutTemplateId: 'tpl', workoutNameSnapshot: name, performedAt };
}

function log(sessionId, name, orderIndex, sets, extra = {}) {
  return {
    id: `${sessionId}-${name}`,
    sessionId,
    exerciseTemplateId: null,
    exerciseNameSnapshot: name,
    weight: sets[0]?.weight ?? 0,
    repsPerSet: sets.map((set) => set.reps),
    sets: sets.map((set, index) => ({ orderIndex: index, outcome: 'completed', status: 'completed', kind: 'working', ...set })),
    tracked: true,
    orderIndex,
    ...extra,
  };
}

module.exports = [
  {
    name: 'the last session block carries the newest session set by set, under its own date, in the reader\'s language',
    run() {
      const fi = buildAiCoachSystemContext(
        baseContext({ history: history({ sessionCount: 2, sessions: HISTORY_SESSIONS }), lastSession: LAST_SESSION }),
        'fi',
      );
      assert.ok(fi.includes('## Last session'), fi);
      assert.ok(fi.includes('Date: 2026-09-26 (write it as 26.9.)'));
      assert.ok(fi.includes('Name: Päivä 4: Alavartalo'));
      assert.ok(fi.includes('- Jalkaprässi: 215 kg x 10 | 215 kg x 9'));
      assert.ok(fi.includes('- Takareisikoukistus: 50 kg x 12'));
      assert.ok(fi.includes('Finnish — dates like 26.9., decimals like 82,5 kg'));

      const en = buildAiCoachSystemContext(
        baseContext({ history: history({ sessionCount: 2, sessions: HISTORY_SESSIONS }), lastSession: LAST_SESSION }),
        'en',
      );
      assert.ok(en.includes('Date: 2026-09-26 (write it as 26 Sep)'));
      assert.ok(en.includes('- Leg Press: 215 kg x 10 | 215 kg x 9'));
      assert.ok(en.includes('English — dates like 26 Sep, decimals like 82.5 kg'));
    },
  },
  {
    name: 'an older app with no last session still gets the block, from the newest history line',
    run() {
      // Listed out of order on purpose: "newest" is the latest day, not the last row.
      const out = buildAiCoachSystemContext(
        baseContext({ history: history({ sessionCount: 2, sessions: [HISTORY_SESSIONS[1], HISTORY_SESSIONS[0]] }) }),
        'fi',
      );
      assert.ok(out.includes('## Last session'));
      assert.ok(out.includes('Date: 2026-09-26 (write it as 26.9.)'));
      assert.ok(out.includes('Name: Päivä 4: Alavartalo'));
      assert.ok(out.includes('14 sets across 6 exercises | 14031 kg'));
      assert.ok(out.includes('no set-by-set detail'));
    },
  },
  {
    name: 'every name in the context reads in the reader\'s language, and the default stays the stored id',
    run() {
      const context = baseContext({
        trackedLifts: [{ key: 'bench', name: 'Bench Press', latestWeight: 80, bestWeight: 82.5, latestReps: 8 }],
        plateaus: [{ exerciseKey: 'overhead press', name: 'Overhead Press', stagnantSessions: 3, topWeightKg: 52.5 }],
        history: history({
          sessionCount: 2,
          sessions: HISTORY_SESSIONS,
          lifts: [
            { name: 'Overhead Press', sessions: 5, firstWeightKg: 47.5, latestWeightKg: 52.5, latestReps: 8, bestWeightKg: 52.5, changeKg: 5, spanDays: 33, stalledSessions: 2, weightSeriesKg: [47.5, 50, 52.5] },
          ],
        }),
        programme: {
          title: 'Rintamassa',
          source: 'ready',
          daysPerWeek: 4,
          days: [{ dayLabel: 'MA', name: 'Day 1: Upper Body', estimatedMinutes: 60, exercises: [{ name: 'Bench Press', scheme: '3 × 8' }] }],
          truncated: false,
        },
      });
      const fi = buildAiCoachSystemContext(context, 'fi');
      for (const english of ['Overhead Press', 'Bench Press', 'Upper Body', 'Lower Body']) {
        assert.ok(!fi.includes(english), `"${english}" reached the Finnish context:\n${fi}`);
      }
      assert.ok(fi.includes('- Pystypunnerrus: +5 kg over 33 days'));
      assert.ok(fi.includes('- Penkkipunnerrus: 80 kg x 8'));
      assert.ok(fi.includes('- Pystypunnerrus: 3 sessions at 52.5 kg'));
      assert.ok(fi.includes('  - Penkkipunnerrus: 3 × 8'));
      assert.ok(fi.includes('MA · Päivä 1: Ylävartalo'));

      // The composer reads the ids and the app resolves its answer back to
      // library rows by them: the default rendering must not translate.
      const ids = buildAiCoachContextText(context);
      assert.ok(ids.includes('- Overhead Press: +5 kg over 33 days'));
      assert.ok(ids.includes('  - Bench Press: 3 × 8'));
      assert.ok(ids.includes('Name: Day 4: Lower Body'));
    },
  },
  {
    name: 'with no language the context keeps every stored id, even the ones an English label renames',
    run() {
      // exerciseNameLabel('en', …) is a label, not the id: it reads "Triceps
      // Pushdown - Rope Attachment" as "Rope Pushdown". The composer answers in
      // ids the app resolves back to library rows, so it must see them as stored.
      const context = baseContext({
        history: history({ sessionCount: 1, sessions: [HISTORY_SESSIONS[1]] }),
        lastSession: { ...LAST_SESSION, exercises: [{ name: 'Triceps Pushdown - Rope Attachment', sets: [{ weightKg: 30, reps: 12 }] }] },
        programme: {
          title: 'Oma',
          source: 'custom',
          daysPerWeek: 1,
          days: [{ dayLabel: 'MA', name: 'Day 1: Upper Body', estimatedMinutes: 40, exercises: [{ name: 'Leverage Chest Press', scheme: '3 × 10' }] }],
          truncated: false,
        },
      });
      const ids = buildAiCoachContextText(context);
      assert.ok(ids.includes('- Triceps Pushdown - Rope Attachment: 30 kg x 12'), ids);
      assert.ok(ids.includes('  - Leverage Chest Press: 3 × 10'));
      assert.ok(!ids.includes('Rope Pushdown') && !ids.includes('Machine Chest Press'));
      // …and no format line: there is no reader language to state.
      assert.ok(!ids.includes('Reader writes'));
      assert.ok(ids.includes('Date: 2026-09-26\n'));
    },
  },
  {
    name: 'a run newer than the last lift is named in the block; an older one is not',
    run() {
      const cardio = (day) => ({
        windowDays: 56,
        sessionCount: 1,
        totalMinutes: 30,
        sessionsLast7Days: 1,
        sessionsLast30Days: 1,
        sessions: [{ day, activity: 'run', minutes: 30, distanceKm: 5 }],
        truncated: false,
      });
      const newer = buildAiCoachSystemContext(baseContext({ lastSession: LAST_SESSION, cardio: cardio('2026-09-27') }), 'fi');
      const block = newer.split('\n\n').find((entry) => entry.startsWith('## Last session'));
      assert.ok(block.includes('Newer than any lifting:') && block.includes('2026-09-27, 30 min'), block);

      const older = buildAiCoachSystemContext(baseContext({ lastSession: LAST_SESSION, cardio: cardio('2026-09-20') }), 'fi');
      assert.ok(!older.includes('Newer than any lifting'));

      // Only runs logged: the block still exists, and says so.
      const runsOnly = buildAiCoachSystemContext(baseContext({ cardio: cardio('2026-09-27') }), 'fi');
      assert.ok(runsOnly.includes('- No lifting logged.'));
      assert.ok(runsOnly.includes('Newer than any lifting:'));
    },
  },
  {
    name: 'a set with no added load says so instead of "0 kg"',
    run() {
      const out = buildAiCoachSystemContext(
        baseContext({ lastSession: { ...LAST_SESSION, exercises: [{ name: 'Pull-Up', sets: [{ weightKg: 0, reps: 10 }, { weightKg: 10, reps: 6 }] }] } }),
        'en',
      );
      assert.ok(out.includes(': 10 with no added load | 10 kg x 6'), out);
      assert.ok(!out.includes('0 kg x 10'));
    },
  },
  {
    name: 'two sessions of the same name on the same day: only the newest row is the last session',
    run() {
      const restart = { ...HISTORY_SESSIONS[1], sessionId: 's4a', performedAt: '2026-09-26T07:10:00.000Z', volumeKg: 900, setCount: 2, exerciseCount: 1 };
      const out = buildAiCoachSystemContext(
        baseContext({ history: history({ sessionCount: 3, sessions: [HISTORY_SESSIONS[0], restart, HISTORY_SESSIONS[1]] }), lastSession: LAST_SESSION }),
        'fi',
      );
      const marked = out.split('\n').filter((row) => row.includes('the Last session above'));
      assert.equal(marked.length, 1, out);
      assert.ok(marked[0].includes('14031 kg'));
    },
  },
  {
    name: 'the last session is the newest one up to now, its lifts in order, completed working sets only',
    run() {
      const now = new Date('2026-09-27T07:50:00.000Z');
      const sessions = [
        session('old', '2026-09-24T16:05:30.000Z', 'Day 3: Upper Body'),
        session('last', '2026-09-26T08:46:40.000Z', 'Day 4: Lower Body'),
        // A clock set wrong once wrote a session into the future; it is not "last".
        session('future', '2026-09-30T08:00:00.000Z', 'Day 1: Upper Body'),
      ];
      const logs = [
        log('last', 'Leg Curl', 1, [{ weight: 50, reps: 12 }]),
        log('last', 'Leg Press', 0, [
          { weight: 100, reps: 10, kind: 'warmup' },
          { weight: 215, reps: 10 },
          { weight: 215, reps: 0, status: 'pending' },
          { weight: 215, reps: 9 },
        ]),
        log('last', 'Calf Raise', 2, [{ weight: 100, reps: 15 }], { skipped: true }),
        log('old', 'Bench Press', 0, [{ weight: 80, reps: 8 }]),
      ];
      const last = buildAiCoachLastSession(sessions, logs, now);
      assert.equal(last.day, '2026-09-26');
      assert.equal(last.name, 'Day 4: Lower Body');
      assert.deepEqual(
        last.exercises.map((exercise) => [exercise.name, exercise.sets.map((set) => `${set.weightKg}x${set.reps}`).join(' ')]),
        [
          ['Leg Press', '215x10 215x9'],
          ['Leg Curl', '50x12'],
        ],
      );
      assert.equal(last.truncated, false);
      assert.equal(buildAiCoachLastSession([], [], now), null);
    },
  },
  {
    name: 'a posted last session is re-parsed, not trusted, and an older client\'s absence is null',
    run() {
      assert.equal(normalizeAiCoachTrainingContext({}).lastSession, null);
      assert.equal(normalizeAiCoachTrainingContext({ lastSession: 'x' }).lastSession, null);
      assert.equal(normalizeAiCoachTrainingContext({ lastSession: { ...LAST_SESSION, day: 'yesterday' } }).lastSession, null);

      const parsed = normalizeAiCoachTrainingContext({
        lastSession: {
          day: '2026-09-26',
          name: '  Day 4: Lower Body ',
          exercises: [
            { name: 'Leg Press', sets: [{ weightKg: 215, reps: 10 }, { weightKg: -5, reps: 3 }, { weightKg: 215, reps: 2.5 }, { weightKg: '215', reps: 9 }, { weightKg: 215, reps: 0 }, { weightKg: 20, reps: 9000 }] },
            { name: 42, sets: [{ weightKg: 50, reps: 12 }] },
            { name: 'Leg Curl', sets: [] },
          ],
          truncated: 'yes',
        },
      }).lastSession;
      assert.deepEqual(parsed, {
        day: '2026-09-26',
        name: 'Day 4: Lower Body',
        exercises: [{ name: 'Leg Press', sets: [{ weightKg: 215, reps: 10 }] }],
        truncated: false,
      });
    },
  },
];
