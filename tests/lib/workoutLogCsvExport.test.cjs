const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  WORKOUT_LOG_CSV_HEADER,
  buildWorkoutLogCsv,
  summarizeWorkoutLog,
} = require('../../.test-dist/lib/workoutLogCsvExport.js');

function read(...segments) {
  return fs.readFileSync(path.join(__dirname, '..', '..', ...segments), 'utf8');
}

const SESSIONS = [
  { id: 's1', workoutTemplateId: 't', workoutNameSnapshot: 'Push A', performedAt: '2026-03-01T10:00:00.000Z' },
  { id: 's2', workoutTemplateId: 't', workoutNameSnapshot: 'Pull, heavy', performedAt: '2026-03-05T10:00:00.000Z' },
];

module.exports = [
  {
    name: 'the log export carries every set, newest session first',
    run() {
      const csv = buildWorkoutLogCsv({
        sessions: SESSIONS,
        logs: [
          {
            id: 'l1',
            sessionId: 's1',
            exerciseNameSnapshot: 'Bench Press',
            weight: 60,
            repsPerSet: [],
            orderIndex: 0,
            tracked: true,
            sets: [
              { orderIndex: 0, weight: 60, reps: 8, kind: 'working', outcome: null, status: 'completed' },
              { orderIndex: 1, weight: 60, reps: 7, kind: 'working', outcome: null, status: 'skipped' },
            ],
          },
        ],
      });
      const lines = csv.split('\n');
      assert.equal(lines[0], WORKOUT_LOG_CSV_HEADER);
      assert.equal(lines.length, 3);
      assert.equal(lines[1], '2026-03-01,Push A,Bench Press,1,8,60,yes');
      // A skipped set is exported and says so, rather than being dropped: the
      // file is a record of what happened, not a highlight reel.
      assert.equal(lines[2], '2026-03-01,Push A,Bench Press,2,7,60,no');
    },
  },
  {
    name: 'the export survives the shape older logs were stored in',
    run() {
      // Entries from before per-set records carry only repsPerSet and one
      // weight. Reading `sets` alone would export nothing for them — a silent
      // hole in exactly the years of history this feature exists to hand back.
      const csv = buildWorkoutLogCsv({
        sessions: [SESSIONS[0]],
        logs: [
          {
            id: 'l1',
            sessionId: 's1',
            exerciseNameSnapshot: 'Back Squat',
            weight: 100,
            repsPerSet: [5, 5, 4],
            orderIndex: 0,
            tracked: true,
          },
        ],
      });
      const lines = csv.split('\n').slice(1);
      assert.equal(lines.length, 3);
      assert.equal(lines[0], '2026-03-01,Push A,Back Squat,1,5,100,yes');
      assert.equal(lines[2], '2026-03-01,Push A,Back Squat,3,4,100,yes');
    },
  },
  {
    name: 'a comma in a name does not become a column',
    run() {
      const csv = buildWorkoutLogCsv({
        sessions: [SESSIONS[1]],
        logs: [
          {
            id: 'l1',
            sessionId: 's2',
            exerciseNameSnapshot: 'Rows (Bar or Rings), wide',
            weight: 40,
            repsPerSet: [10],
            orderIndex: 0,
            tracked: true,
          },
        ],
      });
      const row = csv.split('\n')[1];
      // Both the workout name and the exercise name contain a comma. Unquoted,
      // each turns one field into two and shifts every value after it — the
      // spreadsheet still opens, and every weight is in the wrong column.
      assert.equal(row, '2026-03-05,"Pull, heavy","Rows (Bar or Rings), wide",1,10,40,yes');
      assert.equal(row.split(',').length > 7, true, 'quoted commas are still commas inside the field');
    },
  },
  {
    name: 'a session with nothing logged contributes nothing, and the summary agrees',
    run() {
      const input = {
        sessions: SESSIONS,
        logs: [
          { id: 'l1', sessionId: 's1', exerciseNameSnapshot: 'Bench', weight: 60, repsPerSet: [8, 8], orderIndex: 0, tracked: true },
          // Belongs to a session that is not in the export.
          { id: 'l2', sessionId: 'gone', exerciseNameSnapshot: 'Ghost', weight: 50, repsPerSet: [5], orderIndex: 0, tracked: true },
        ],
      };
      assert.equal(buildWorkoutLogCsv(input).split('\n').length, 3);
      assert.deepEqual(summarizeWorkoutLog(input), { sessions: 1, sets: 2 });
      assert.deepEqual(summarizeWorkoutLog({ sessions: [], logs: [] }), { sessions: 0, sets: 0 });
    },
  },
  {
    name: 'the log export is free, and the three positioning claims are true',
    run() {
      const screen = read('src', 'screens', 'ExportPlanScreen.tsx');
      // No entitlement check anywhere on this screen. An export you have to
      // pay for is a hostage negotiation, and it would break the one claim
      // that a competitor has demonstrably failed.
      assert.doesNotMatch(screen, /proUnlocked|isProUnlocked|onOpenPremium/);
      assert.match(screen, /buildWorkoutLogCsv\(log\)/);

      const app = read('App.tsx');
      assert.match(app, /log=\{\{ sessions: database\.workoutSessions, logs: database\.exerciseLogs \}\}/);

      // The claims themselves, each checked against the code that backs it.
      // i18n.ts is copy, not code: "no feed, no followers" IS the claim,
      // and a grep that cannot tell prose from a symbol fails on the very
      // sentence it exists to check. Comments are skipped for the same reason.
      const src = ['src/screens', 'src/features']
        .flatMap((dir) => fs.readdirSync(path.join(__dirname, '..', '..', dir)).map((f) => path.join(dir, f)))
        .filter((f) => f.endsWith('.ts') || f.endsWith('.tsx'))
        .map((f) => read(...f.split('/')))
        .join(String.fromCharCode(10))
        .split(String.fromCharCode(10))
        .filter((line) => {
          const trimmed = line.trim();
          return !trimmed.startsWith('//') && !trimmed.startsWith('*') && !trimmed.startsWith('/*');
        })
        .join(String.fromCharCode(10));
      assert.doesNotMatch(src, /follower|leaderboard|newsfeed/i, 'no social graph');
      // The single-outbound-request claim has its own guard in
      // legalDocuments.test.cjs, which walks the whole tree rather than two
      // directories. Asserting it twice, less well, would only drift.

      const i18n = read('src', 'lib', 'i18n.ts');
      for (const key of ['pro.page.stand.noSocial', 'pro.page.stand.offline', 'pro.page.stand.yours']) {
        const lines = i18n.split(String.fromCharCode(10)).filter((line) => line.includes(`'${key}':`));
        assert.equal(lines.length, 2, `${key} in both languages`);
      }
      // The offline claim names its own exception rather than overclaiming.
      const offline = i18n.split(String.fromCharCode(10)).filter((l) => l.includes("'pro.page.stand.offline':"));
      assert.match(offline[0], /AI coach needs one/);
      assert.match(offline[1], /AI-valmentaja tarvitsee/);
    },
  },
];
