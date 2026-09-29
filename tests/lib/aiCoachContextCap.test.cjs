const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { AI_COACH_MAX_PROMPT_CHARS, DEFAULT_BUDGET_LIMITS, checkBudget, createBudgetState } = require('../../.test-dist/lib/aiCoachBudget.js');
const { buildAiCoachContextText, buildAiCoachSystemContext } = require('../../.test-dist/lib/aiCoachSystemContext.js');
const {
  buildAiTrainingContext,
  fitAiCoachContextToCap,
  normalizeAiCoachTrainingContext,
} = require('../../.test-dist/lib/aiTrainingContext.js');
const { heavyCoachContext } = require('../helpers/coachContextFixture.cjs');

/**
 * A heavy reader was answered offline (server audit, 2026-09-21).
 *
 * The endpoint counted its own ~11 KB of rules against the 24 KB context cap,
 * leaving the reader's data about 12.6 KB — and the app's own caps allow more
 * than that: a full week of programme rows, eight weeks of sessions and lift
 * trajectories. The refusal came back as a 502 with the offline answer. The
 * rules are now charged, not counted against the cap, and the app sheds what
 * it must so that whatever it builds, the endpoint takes.
 */

const root = path.join(__dirname, '..', '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8').replace(/\r\n/g, '\n');
const code = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
/**
 * The text the endpoint sends and measures, after the repair it applies first.
 * Spelled out rather than borrowed from buildAiCoachContextText, so this suite
 * measures the same thing on a tree without it; the first case pins the two
 * together.
 */
const sent = (context) => `# Training context\n\n${buildAiCoachSystemContext(normalizeAiCoachTrainingContext(context))}`;

/** How long the endpoint's rules are, read from api/ai-coach.ts. */
function rulesLength(name) {
  const source = read('api', 'ai-coach.ts');
  const head = `const ${name} = [`;
  const start = source.indexOf(head);
  const end = source.indexOf("].join('\\n')", start);
  return Function(`return [${source.slice(start + head.length, end)}]`)().join('\n').length;
}

const NOW = 1_700_000_000_000;

module.exports = [
  {
    name: 'coach context: a reader at every one of the app\'s own limits is answered, and loses nothing to fit',
    run() {
      const context = heavyCoachContext();
      const text = sent(context);
      const rules = rulesLength('COACH_SYSTEM_RULES');
      assert.equal(buildAiCoachContextText(normalizeAiCoachTrainingContext(context)), text, 'the endpoint measures something else');

      // The old measurement refused this reader: context and rules together.
      assert.ok(text.length + rules > DEFAULT_BUDGET_LIMITS.maxContextChars, 'the fixture no longer shows the refusal it guards');

      // The endpoint's measurement now: the reader's context against the cap,
      // the rules charged. A full question and a full conversation ride too.
      const decision = checkBudget(
        { promptChars: AI_COACH_MAX_PROMPT_CHARS, historyChars: DEFAULT_BUDGET_LIMITS.maxHistoryChars, contextChars: text.length, fixedChars: rules },
        createBudgetState(NOW),
        NOW,
      );
      assert.equal(decision.allowed, true, `refused: ${JSON.stringify(decision.rejection)}`);

      // Under the cap, the app sends it exactly as built.
      assert.equal(fitAiCoachContextToCap(context), context);
    },
  },
  {
    name: 'coach context: whatever the reader named things, the app sends what the endpoint takes',
    run() {
      // Names and goals are the reader's own words, with no length; plateaus
      // have no cap in the builder.
      const context = heavyCoachContext({ nameLength: 120, goalLength: AI_COACH_MAX_PROMPT_CHARS, plateaus: 60 });
      assert.ok(sent(context).length > DEFAULT_BUDGET_LIMITS.maxContextChars);
      const fitted = fitAiCoachContextToCap(context);
      assert.ok(sent(fitted).length <= DEFAULT_BUDGET_LIMITS.maxContextChars, `still ${sent(fitted).length} characters`);
      // The least-needed parts went first: the lead goal is still there.
      assert.ok((fitted.goals ?? []).some((goal) => goal.isPrimary));
      // A trimmed history says so rather than reading as a shorter record.
      assert.equal(fitted.history.truncated, true);

      // Past every step, the last one still fits it.
      const absurd = heavyCoachContext({ nameLength: 4000, goalLength: 4000, plateaus: 200 });
      assert.ok(sent(fitAiCoachContextToCap(absurd)).length <= DEFAULT_BUDGET_LIMITS.maxContextChars);
    },
  },
  {
    name: 'coach context: the builder fits what it builds, and the chat fits what it sends',
    run() {
      // One goal per measured site, each stated in a long chat message.
      const kinds = ['bodyfat', 'shoulders', 'chest', 'back', 'arms', 'forearms', 'waist', 'hips', 'thighs', 'calves', 'neck'];
      const context = buildAiTrainingContext({
        unitPreference: 'kg',
        activeWorkoutSummary: null,
        homeSummary: { streak: { sessionsThisWeek: 0, sessionsLast30Days: 0, activity: { days: [] } } },
        workoutSessions: [],
        exerciseLogs: [],
        trackedProgress: [],
        readyProgramCount: 57,
        recommendedProgramId: null,
        recommendedProgramTitle: null,
        customProgramTitle: null,
        coachGoals: kinds.map((kind, index) => ({
          id: `goal-${index}`,
          text: `${kind} `.repeat(400).slice(0, AI_COACH_MAX_PROMPT_CHARS),
          kind,
          targetValue: 100,
          unit: 'cm',
          startValue: 90,
          createdAt: '2026-09-01T10:00:00.000Z',
        })),
        now: new Date('2026-09-21T10:00:00.000Z'),
      });
      assert.ok(sent(context).length <= DEFAULT_BUDGET_LIMITS.maxContextChars, 'the builder made a context the endpoint refuses');

      // The chat puts its pinned memory back into the context it was handed,
      // so it fits the result again.
      const chat = code(read('src', 'screens', 'AICoachChatScreen.tsx'));
      assert.match(chat, /fitAiCoachContextToCap\(\{ \.\.\.trainingContext, coachMemory: pinnedCoachMemory \}\)/);
    },
  },
  {
    name: 'coach context: the question box stops where the endpoint does',
    run() {
      // Both places a reader types a question for the coach.
      for (const screen of ['AICoachChatScreen.tsx', 'OnboardingScreen.tsx']) {
        const source = code(read('src', 'screens', screen));
        assert.match(source, /maxLength=\{AI_COACH_MAX_PROMPT_CHARS\}/, `${screen}: a question longer than the endpoint takes can be typed`);
      }
      assert.equal(DEFAULT_BUDGET_LIMITS.maxPromptChars, AI_COACH_MAX_PROMPT_CHARS);
      // And the conversation that rides with a question fits its own limit,
      // however long the endpoint lets each side be.
      const endpoint = read('api', 'ai-coach.ts');
      const turns = Number(endpoint.match(/const MAX_HISTORY_TURNS = (\d+);/)[1]);
      const perSide = Number(endpoint.match(/const MAX_HISTORY_CHARS = (\d+);/)[1]);
      assert.ok(turns * 2 * perSide <= DEFAULT_BUDGET_LIMITS.maxHistoryChars, 'a trimmed conversation can still be refused');
    },
  },
  {
    name: 'a history row without its shape is dropped, and the context is still written (break round 2026-09-28)',
    run() {
      const context = heavyCoachContext();
      const goodLift = context.history.lifts[0];
      const goodSession = context.history.sessions[0];
      const goodWeek = context.history.weeks[0];
      assert.ok(goodLift && goodSession && goodWeek, 'the fixture carries a row of each');
      const broken = {
        ...context,
        history: {
          ...context.history,
          lifts: [{ name: 'Bench Press', stalledSessions: 1 }, null, 'x', { ...goodLift, weightSeriesKg: [80, 'x'] }, goodLift],
          sessions: [{ name: 'Upper' }, goodSession],
          weeks: [{ weekStart: 1 }, goodWeek],
        },
      };
      const normalized = normalizeAiCoachTrainingContext(broken);
      assert.deepEqual(normalized.history.lifts, [goodLift]);
      assert.deepEqual(normalized.history.sessions, [goodSession]);
      assert.deepEqual(normalized.history.weeks, [goodWeek]);
      // What threw "Cannot read properties of undefined (reading 'map')".
      assert.doesNotThrow(() => buildAiCoachContextText(normalized, 'fi'));
      assert.ok(buildAiCoachContextText(normalized).includes(goodLift.name), 'the good row is still in the text');
      // A schedule without its day list is repaired, not thrown on.
      const scheduled = normalizeAiCoachTrainingContext({
        ...context,
        history: { ...context.history, schedule: { plannedPerWeek: 3, nextTrainingDate: 7 } },
      });
      assert.deepEqual(scheduled.history.schedule.trainingDays, []);
      assert.equal(scheduled.history.schedule.nextTrainingDate, null);
      assert.doesNotThrow(() => buildAiCoachContextText(scheduled, 'fi'));
      assert.equal(normalizeAiCoachTrainingContext({ history: { schedule: 'x' } }).history.schedule, null);
      // A thinner row from an older app is not a broken one: kept.
      const older = normalizeAiCoachTrainingContext({
        history: { sessionCount: 1, sessions: [{ sessionId: 's0', performedAt: '2026-09-01T09:00:00.000Z' }] },
      });
      assert.equal(older.history.sessions.length, 1);
      assert.doesNotThrow(() => buildAiCoachContextText(older, 'fi'));
      // A well-formed history comes through whole.
      assert.deepEqual(normalizeAiCoachTrainingContext(context).history.lifts, context.history.lifts);
    },
  },
  {
    name: 'an oversized posted history is capped like the device\'s own builder caps it',
    run() {
      // normalizeLastSession and normalizeCardio already bound what they
      // accept; normalizeHistory did not, so a posted context with far more
      // rows than the app itself ever sends rendered close to a megabyte and a
      // half before the size check ever saw it (server audit, 2026-09-29).
      const goodSession = { sessionId: 's0', performedAt: '2026-09-01T09:00:00.000Z', name: 'Upper' };
      const goodLift = { name: 'Bench Press', weightSeriesKg: [80, 82.5] };
      const goodWeek = { weekStart: '2026-07-06', sessions: 3, volumeKg: 12000, plannedSessions: 4 };
      const oversized = {
        history: {
          sessions: Array.from({ length: 20000 }, () => ({ ...goodSession })),
          lifts: Array.from({ length: 500 }, () => ({ ...goodLift })),
          repsLifts: Array.from({ length: 500 }, () => ({ name: 'Pull-up', reps: [8, 9, 10] })),
          weeks: Array.from({ length: 500 }, () => ({ ...goodWeek })),
        },
      };
      const normalized = normalizeAiCoachTrainingContext(oversized);
      assert.ok(normalized.history.sessions.length <= 24, `sessions not capped: ${normalized.history.sessions.length}`);
      assert.ok(normalized.history.lifts.length <= 10, `lifts not capped: ${normalized.history.lifts.length}`);
      assert.ok(normalized.history.repsLifts.length <= 10, `repsLifts not capped: ${normalized.history.repsLifts.length}`);
      assert.ok(normalized.history.weeks.length <= 12, `weeks not capped: ${normalized.history.weeks.length}`);
      // The rendered text this feeds the model stays small, which is the
      // actual point — the size check runs on this text, not on the arrays.
      assert.ok(buildAiCoachContextText(normalized, 'fi').length < 20000, 'an oversized posted history still rendered close to full size');
    },
  },
];
