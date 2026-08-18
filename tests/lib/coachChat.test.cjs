const assert = require('node:assert/strict');

const {
  buildCoachContextChips,
  buildCoachContextReadout,
  buildCoachOpeningLine,
  buildCoachNoticed,
} = require('../../.test-dist/lib/coachChat.js');

function row(overrides) {
  return {
    key: 'squat',
    tone: 'green',
    name: 'Squat',
    status: 'Improving',
    meta: '+5 kg in 4 weeks',
    bars: [0.4, 0.6, 0.8],
    locked: null,
    ...overrides,
  };
}

const STALLED = row({ key: 'squat', tone: 'amber', status: 'Stalled', meta: 'Same top set × 4', locked: { teaser: 'One fix', body: 'Hold the weight and cut one set.' } });
const IMPROVING = row({ key: 'bench', name: 'Bench press', tone: 'green', status: 'Improving' });
const RECOVERY = row({ key: 'recovery', name: 'Recovery', tone: 'red', status: 'Running low', meta: '6 sessions in 7 days', locked: { teaser: 'Why', body: 'Too much this week.' } });

function intro(overrides) {
  return { todaySessionTitle: null, sessionsThisWeek: 0, weeklyRead: [], fatigue: null, ...overrides };
}

module.exports = [
  {
    name: 'coachChat: the context strip states facts and stays empty without any',
    run() {
      assert.deepEqual(buildCoachContextChips(intro({}), 'en'), [], 'a fresh user gets no invented status');

      const chips = buildCoachContextChips(
        intro({ todaySessionTitle: 'Push A', weeklyRead: [STALLED, RECOVERY] }),
        'en',
      );
      assert.equal(chips.length, 3);
      assert.equal(chips[0].label, 'Push A today');
      assert.equal(chips[0].tone, 'plan');
      assert.equal(chips[1].label, 'Squat · Stalled');
      assert.equal(chips[2].label, 'Recovery · Running low');
    },
  },
  {
    name: 'coachChat: a healthy recovery row is not worth a chip',
    run() {
      const chips = buildCoachContextChips(
        intro({ weeklyRead: [row({ key: 'recovery', name: 'Recovery', tone: 'green', status: 'On track' })] }),
        'en',
      );
      assert.equal(chips.length, 0);
    },
  },
  {
    name: 'coachChat: the strip never grows past three chips',
    run() {
      const chips = buildCoachContextChips(
        intro({ todaySessionTitle: 'Push A', weeklyRead: [STALLED, RECOVERY, IMPROVING] }),
        'en',
      );
      assert.ok(chips.length <= 3);
    },
  },
  {
    name: 'coachChat: the opening line names what it can see, and admits when it cannot',
    run() {
      assert.match(
        buildCoachOpeningLine(intro({ todaySessionTitle: 'Push A', sessionsThisWeek: 3, weeklyRead: [STALLED] }), 'en'),
        /3× this week[\s\S]*squat[\s\S]*Push A/,
      );
      assert.match(buildCoachOpeningLine(intro({ weeklyRead: [STALLED] }), 'en'), /squat has not moved/);
      assert.match(buildCoachOpeningLine(intro({ todaySessionTitle: 'Push A' }), 'en'), /Push A is on the plan/);
      assert.match(buildCoachOpeningLine(intro({ sessionsThisWeek: 2 }), 'en'), /2 sessions logged/);
      // Nothing logged: it says so instead of claiming a trend.
      assert.match(buildCoachOpeningLine(intro({}), 'en'), /Log a session/);
    },
  },
  {
    name: 'coachChat: Pro opens with problems first, then earned progress, capped at two',
    run() {
      const items = buildCoachNoticed([IMPROVING, STALLED, RECOVERY], 'en');
      assert.equal(items.length, 2);
      // Amber and red outrank a green row even when green comes first.
      assert.equal(items[0].key, 'squat');
      assert.equal(items[1].key, 'recovery');
      // The body is the real conclusion, not the headline again.
      assert.equal(items[0].body, 'Hold the weight and cut one set.');
      assert.match(items[0].question, /squat/);
    },
  },
  {
    name: 'coachChat: a green-only week still gets an opener',
    run() {
      const items = buildCoachNoticed([IMPROVING], 'en');
      assert.equal(items.length, 1);
      assert.equal(items[0].tone, 'plan');
      assert.equal(items[0].body, '+5 kg in 4 weeks');
    },
  },
  {
    name: 'coachChat: nothing logged means nothing claimed',
    run() {
      assert.deepEqual(buildCoachNoticed([], 'en'), []);
    },
  },
  {
    name: 'coachChat: the last-session row names the session in the reader\'s language',
    run() {
      // Seen on a phone: "Rintavoima · Amateur - Day 2: Deadlift & Press"
      // under a Finnish "Viime treeni" label, beside a lift row that had
      // already translated its lift. The stored name is the catalog's English;
      // the row now runs it through the same localiser History uses.
      const context = {
        unitPreference: 'kg',
        activeSession: null,
        recentCompletedSessions: [
          {
            sessionId: 's1',
            title: 'Rintavoima · Amateur - Day 2: Deadlift & Press',
            performedAt: '2026-08-18T09:00:00.000Z',
            durationMinutes: 20,
            setsCompleted: 1,
            swappedExercises: 0,
            noteCount: 0,
          },
        ],
        trackedLifts: [],
        latestTopSets: [],
        sessionsThisWeek: 1,
        sessionsLast30Days: 0,
        rhythm: [],
        readyProgramCount: 0,
      };
      const rows = buildCoachContextReadout(context, 'fi');
      const last = rows.find((row) => row.key === 'lastSession');
      assert.ok(last);
      assert.match(last.value, /Päivä 2: Maastaveto & Pystypunnerrus/);
      assert.doesNotMatch(last.value, /Deadlift/);
      // English stays English.
      assert.match(buildCoachContextReadout(context, 'en')[0].value, /Day 2: Deadlift & Press/);
    },
  },
];
