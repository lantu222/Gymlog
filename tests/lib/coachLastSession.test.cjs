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
      assert.ok(fi.includes('- Jalkaprässi — 2 sets this session: 215 kg x 10, 215 kg x 9'), fi);
      assert.ok(fi.includes('- Takareisikoukistus — 1 set this session: 50 kg x 12'));
      assert.ok(fi.includes('Finnish — dates like 26.9., decimals like 82,5 kg'));

      const en = buildAiCoachSystemContext(
        baseContext({ history: history({ sessionCount: 2, sessions: HISTORY_SESSIONS }), lastSession: LAST_SESSION }),
        'en',
      );
      assert.ok(en.includes('Date: 2026-09-26 (write it as 26 Sep)'));
      assert.ok(en.includes('- Leg Press — 2 sets this session: 215 kg x 10, 215 kg x 9'));
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
      assert.ok(ids.includes('- Triceps Pushdown - Rope Attachment — 1 set this session: 30 kg x 12'), ids);
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
      assert.ok(out.includes('this session: 10 with no added load, 10 kg x 6'), out);
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
    name: 'after a long break the recent-sessions row that is the last session is marked too',
    run() {
      // History window empty, the last session older than it: the same session
      // is the Last session and the newest Recent row (PR review, 2026-09-27).
      const old = { ...LAST_SESSION, day: '2026-06-01' };
      const out = buildAiCoachSystemContext(
        baseContext({
          lastSession: old,
          recentCompletedSessions: [
            { sessionId: 'a', title: 'Day 4: Lower Body', performedAt: '2026-06-01T08:00:00.000Z', day: '2026-06-01', durationMinutes: 50, setsCompleted: 14, swappedExercises: 0, noteCount: 0 },
            { sessionId: 'b', title: 'Day 3: Upper Body', performedAt: '2026-05-30T08:00:00.000Z', day: '2026-05-30', durationMinutes: 60, setsCompleted: 18, swappedExercises: 0, noteCount: 0 },
          ],
        }),
        'fi',
      );
      assert.ok(out.includes('## Recent sessions'), out);
      const marked = out.split('\n').filter((row) => row.includes('the Last session above'));
      assert.equal(marked.length, 1, out);
      assert.ok(marked[0].includes('2026-06-01'));
    },
  },
  {
    name: 'an older app back from a break with only a run in the window: the last lift comes from the recent rows, never "no lifting"',
    run() {
      // No lastSession (older app), an empty window, lifting only in the
      // unwindowed recent rows, and a run last week (PR review, 2026-09-27).
      const out = buildAiCoachSystemContext(
        baseContext({
          recentCompletedSessions: [
            { sessionId: 'a', title: 'Day 4: Lower Body', performedAt: '2026-06-01T08:00:00.000Z', day: '2026-06-01', durationMinutes: 50, setsCompleted: 14, swappedExercises: 0, noteCount: 0 },
            { sessionId: 'b', title: 'Day 3: Upper Body', performedAt: '2026-05-30T08:00:00.000Z', day: '2026-05-30', durationMinutes: 60, setsCompleted: 18, swappedExercises: 0, noteCount: 0 },
          ],
          cardio: {
            windowDays: 56,
            sessionCount: 1,
            totalMinutes: 30,
            sessionsLast7Days: 1,
            sessionsLast30Days: 1,
            sessions: [{ day: '2026-09-20', activity: 'run', minutes: 30, distanceKm: 5 }],
            truncated: false,
          },
        }),
        'fi',
      );
      assert.ok(!out.includes('No lifting logged'), out);
      const block = out.split('\n\n').find((entry) => entry.startsWith('## Last session'));
      assert.ok(block.includes('Date: 2026-06-01 (write it as 1.6.)'), block);
      assert.ok(block.includes('Name: Päivä 4: Alavartalo'));
      assert.ok(block.includes('Newer than any lifting:'));
      const marked = out.split('\n').filter((row) => row.includes('the Last session above'));
      assert.equal(marked.length, 1);
      assert.ok(marked[0].includes('2026-06-01'));
    },
  },
  {
    name: 'a history trimmed to fit is not "before the window": the recent row stands in, said so plainly',
    run() {
      // The shedding step empties history.sessions and keeps sessionCount; the
      // recent rows survive, and the newest may be yesterday's (PR review).
      const out = buildAiCoachSystemContext(
        baseContext({
          history: history({ sessionCount: 20, sessions: [], truncated: true }),
          recentCompletedSessions: [
            { sessionId: 'a', title: 'Day 4: Lower Body', performedAt: '2026-09-26T08:46:40.000Z', day: '2026-09-26', durationMinutes: 52, setsCompleted: 14, swappedExercises: 0, noteCount: 0 },
          ],
        }),
        'fi',
      );
      const block = out.split('\n\n').find((entry) => entry.startsWith('## Last session'));
      assert.ok(block.includes('Date: 2026-09-26 (write it as 26.9.)'), block);
      assert.ok(block.includes('history rows were left out for this payload'));
      assert.ok(!block.includes('before the history window'));
    },
  },
  {
    name: 'trimming a context to fit calls the last session cut only when it was',
    run() {
      const { fitAiCoachContextToCap } = require('../../.test-dist/lib/aiTrainingContext.js');
      const many = Array.from({ length: 9 }, (_, i) => ({ name: `Lift ${i}`, sets: [{ weightKg: 50, reps: 10 }] }));
      // A cap nothing fits under runs every shedding step, the one that trims
      // the last session included (PR review, 2026-09-27).
      const small = fitAiCoachContextToCap(normalizeAiCoachTrainingContext(baseContext({ lastSession: LAST_SESSION })), 10);
      assert.equal(small.lastSession.exercises.length, 2);
      assert.equal(small.lastSession.truncated, false);
      const big = fitAiCoachContextToCap(normalizeAiCoachTrainingContext(baseContext({ lastSession: { ...LAST_SESSION, exercises: many } })), 10);
      assert.equal(big.lastSession.exercises.length, 6);
      assert.equal(big.lastSession.truncated, true);
    },
  },
  {
    name: 'each lift says what it did the time before and how long it has sat at this weight, so sets are never read as sessions',
    run() {
      // Aleksi, 2026-09-27: trap bar 140 → 145 → 150 → 150 → 155. Three sets
      // of 155 × 6 were read as "155 kg three sessions in a row".
      const now = new Date('2026-09-27T07:50:00.000Z');
      const days = ['2026-08-24', '2026-08-31', '2026-09-07', '2026-09-17', '2026-09-26'];
      const loads = [140, 145, 150, 150, 155];
      const sessions = days.map((day, i) => session(`d4-${i}`, `${day}T09:00:00.000Z`, 'Day 4: Lower Body'));
      sessions.push(session('d2', '2026-09-22T09:00:00.000Z', 'Day 2: Lower Body'));
      // Written into the future by a wrong clock: neither "last" nor "before".
      sessions.push(session('future', '2026-10-05T09:00:00.000Z', 'Day 4: Lower Body'));
      const three = (weight) => [{ weight, reps: 6 }, { weight, reps: 6 }, { weight, reps: 6 }];
      const logs = [
        ...days.map((_, i) => log(`d4-${i}`, 'Trap Bar Deadlift', 0, three(loads[i]))),
        ...days.slice(2).map((_, i) => log(`d4-${i + 2}`, 'Leg Curl', 1, [{ weight: 50, reps: 12 }])),
        log('d4-4', 'Calf Raise', 2, [{ weight: 100, reps: 15 }]),
        // The other lower day trains the same lift heavier; it is still "the time before".
        log('d2', 'Leg Curl', 0, [{ weight: 50, reps: 10 }]),
        log('future', 'Trap Bar Deadlift', 0, three(200)),
      ];
      const last = buildAiCoachLastSession(sessions, logs, now);
      const trap = last.exercises.find((exercise) => exercise.name === 'Trap Bar Deadlift');
      assert.deepEqual(trap.previous, { day: '2026-09-17', sets: three(150).map(({ weight, reps }) => ({ weightKg: weight, reps })) });
      assert.equal(trap.sessionsAtThisWeight, 1);
      const curl = last.exercises.find((exercise) => exercise.name === 'Leg Curl');
      assert.equal(curl.previous.day, '2026-09-22');
      assert.equal(curl.sessionsAtThisWeight, 4);
      assert.equal(last.exercises.find((exercise) => exercise.name === 'Calf Raise').previous, null);
      // The same session, not the heavier other day.
      assert.equal(last.previousSameName.day, '2026-09-17');

      const out = buildAiCoachSystemContext(baseContext({ lastSession: last }), 'fi');
      assert.ok(
        out.includes('- Trap bar -maastaveto — 3 sets this session: 155 kg x 6, 155 kg x 6, 155 kg x 6 | time before (2026-09-17): 150 kg x 6, 150 kg x 6, 150 kg x 6 | first session at 155 kg'),
        out,
      );
      assert.ok(out.includes('4 sessions in a row at 50 kg, this one included'));
      assert.ok(out.includes('Pohjenosto — 1 set this session: 100 kg x 15 | first time logged'));
      assert.ok(out.includes('Same session the time before: 2026-09-17 |'));
    },
  },
  {
    name: 'an app from before these fields is not told every lift is a first',
    run() {
      // #196's build sends sets only. Absent must stay absent through the
      // endpoint's re-parse, or the context claims "first time logged".
      const parsed = normalizeAiCoachTrainingContext({ lastSession: LAST_SESSION }).lastSession;
      assert.ok(!('previous' in parsed.exercises[0]));
      const out = buildAiCoachSystemContext(baseContext({ lastSession: parsed }), 'fi');
      assert.ok(!out.includes('first time logged'), out);
      assert.ok(!out.includes('first session at'));

      // A malformed "previous" is dropped, not turned into a first.
      const junk = normalizeAiCoachTrainingContext({
        lastSession: { ...LAST_SESSION, exercises: [{ ...LAST_SESSION.exercises[0], previous: { day: 'x', sets: [] }, sessionsAtThisWeight: -2 }] },
      }).lastSession;
      assert.ok(!('previous' in junk.exercises[0]));
      assert.ok(!('sessionsAtThisWeight' in junk.exercises[0]));
    },
  },
  {
    name: 'the next training day carries the reader\'s date format too',
    run() {
      const out = buildAiCoachSystemContext(
        baseContext({
          history: history({
            sessionCount: 1,
            sessions: [HISTORY_SESSIONS[1]],
            schedule: { trainingDays: ['mon', 'thu'], nextTrainingDate: '2026-09-28', plannedPerWeek: 2, plannedSessions: 8, completedSessions: 5 },
          }),
        }),
        'en',
      );
      assert.ok(out.includes('Next training day: 2026-09-28 (write it as 28 Sep)'), out);
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
        previousSameName: null,
      });
    },
  },
];
