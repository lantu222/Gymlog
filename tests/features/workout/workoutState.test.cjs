const assert = require('node:assert/strict');

const {
  completeWorkoutSession,
  workoutReducer,
  workoutInitialState,
} = require('../../../.test-dist/features/workout/workoutState.js');
const { createCompletedSession, createExercise, createSet } = require('../../helpers/workoutFixtures.cjs');
const {
  buildExerciseLogDraftsFromWorkoutSession,
} = require('../../../.test-dist/features/workout/workoutAppAdapter.js');

module.exports = [
  {
    name: 'finishWorkout can lock a custom performedAt into the completion summary',
    run() {
      const activeSession = createCompletedSession({
        status: 'active',
        completedAt: undefined,
        ui: {
          activeSlotId: null,
          activeSetIndex: 0,
          focusedField: null,
          noteEditorSlotId: null,
          swapSheetSlotId: null,
          expandedSlotIds: [],
          finishSummaryOpen: false,
        },
      });

      const performedAt = '2026-03-31T10:30:00.000Z';
      const nextState = completeWorkoutSession(
        {
          ...workoutInitialState,
          activeSession,
        },
        performedAt,
      );

      assert.equal(nextState.activeSession.status, 'completed');
      assert.equal(nextState.activeSession.completedAt, performedAt);
      assert.equal(nextState.completionSummary.performedAt, performedAt);
    },
  },
  {
    name: 'tick does not keep completed workouts running in the background',
    run() {
      const completedAt = '2026-03-31T10:30:00.000Z';
      const activeSession = createCompletedSession({
        status: 'completed',
        completedAt,
        startedAt: '2026-03-31T09:30:00.000Z',
        updatedAt: completedAt,
        elapsedSeconds: 3600,
        restTimer: {
          status: 'idle',
          exerciseSlotId: null,
          setIndex: null,
          startedAtMs: null,
          endsAtMs: null,
          durationSeconds: 0,
        },
      });

      const nextState = workoutReducer(
        {
          ...workoutInitialState,
          activeSession,
          nowMs: Date.parse(completedAt),
        },
        { type: 'session/tick', payload: { nowMs: Date.parse(completedAt) + 8 * 60 * 60 * 1000 } },
      );

      assert.equal(nextState.activeSession.elapsedSeconds, 3600);
      assert.equal(nextState.activeSession.restTimer.status, 'idle');
      assert.equal(nextState.activeSession.updatedAt, completedAt);
    },
  },
  {
    name: 'discardWorkout clears the active session without creating a completion summary',
    run() {
      const activeSession = createCompletedSession({
        status: 'active',
        completedAt: undefined,
      });

      const nextState = workoutReducer(
        {
          ...workoutInitialState,
          activeSession,
        },
        { type: 'session/discardWorkout' },
      );

      assert.equal(nextState.activeSession, null);
      assert.equal(nextState.completionSummary, null);
      assert.equal(nextState.history.sessions.length, 0);
    },
  },
  {
    name: 'recordSetEffort stores a quick effort read on a completed set',
    run() {
      const activeSession = createCompletedSession({
        status: 'active',
        completedAt: undefined,
        exercises: [
          createExercise({
            sets: [
              createSet({
                setIndex: 0,
                status: 'completed',
                effort: null,
                actualLoadKg: 90,
                actualReps: 6,
              }),
            ],
          }),
        ],
      });

      const nextState = workoutReducer(
        {
          ...workoutInitialState,
          activeSession,
        },
        { type: 'set/recordEffort', payload: { slotId: activeSession.exercises[0].slotId, setIndex: 0, effort: 'hard' } },
      );

      assert.equal(nextState.activeSession.exercises[0].sets[0].effort, 'hard');
    },
  },
  {
    name: 'completing the last set of a session starts no rest',
    run() {
      // Rest is the gap before the next set. Reported from the phone: the bar
      // opened on the final tick, counted down to a set that did not exist,
      // and covered the finish button while it did.
      const lastSet = createSet({ setIndex: 0, status: 'pending', actualReps: null, completedAt: null });
      const exercise = createExercise({ sets: [lastSet], status: 'active' });
      const activeSession = createCompletedSession({
        status: 'active',
        completedAt: undefined,
        exercises: [exercise],
      });

      const nextState = workoutReducer(
        { ...workoutInitialState, nowMs: 1000, activeSession },
        {
          type: 'set/complete',
          payload: { slotId: exercise.slotId, setIndex: 0, nowMs: 1000, unitPreference: 'kg' },
        },
      );

      assert.equal(nextState.activeSession.exercises[0].sets[0].status, 'completed');
      assert.equal(nextState.activeSession.restTimer.status, 'idle');
    },
  },
  {
    name: 'completing a set with another still pending starts the rest',
    run() {
      const exercise = createExercise({
        sets: [
          createSet({ setIndex: 0, status: 'pending', actualReps: null, completedAt: null }),
          createSet({ setIndex: 1, status: 'pending', actualReps: null, completedAt: null }),
        ],
        status: 'active',
      });
      const activeSession = createCompletedSession({
        status: 'active',
        completedAt: undefined,
        exercises: [exercise],
      });

      const nextState = workoutReducer(
        { ...workoutInitialState, nowMs: 1000, activeSession },
        {
          type: 'set/complete',
          payload: { slotId: exercise.slotId, setIndex: 0, nowMs: 1000, unitPreference: 'kg' },
        },
      );

      assert.equal(nextState.activeSession.restTimer.status, 'running');
      assert.equal(nextState.activeSession.restTimer.durationSeconds, exercise.restSecondsMin);
    },
  },
  {
    name: 'timer override resets a running rest timer to the premium suggestion',
    run() {
      const activeSession = createCompletedSession({
        status: 'active',
        completedAt: undefined,
        restTimer: {
          status: 'running',
          exerciseSlotId: 'slot-1',
          setIndex: 0,
          startedAtMs: 1000,
          endsAtMs: 121000,
          durationSeconds: 120,
        },
      });

      const nextState = workoutReducer(
        {
          ...workoutInitialState,
          nowMs: 1000,
          activeSession,
        },
        { type: 'timer/override', payload: { durationSeconds: 150, nowMs: 5000 } },
      );

      assert.equal(nextState.activeSession.restTimer.durationSeconds, 150);
      assert.equal(nextState.activeSession.restTimer.startedAtMs, 5000);
      assert.equal(nextState.activeSession.restTimer.endsAtMs, 155000);
    },
  },
  {
    name: 'timer override updates paused rest duration without resuming',
    run() {
      const activeSession = createCompletedSession({
        status: 'active',
        completedAt: undefined,
        restTimer: {
          status: 'paused',
          exerciseSlotId: 'slot-1',
          setIndex: 0,
          startedAtMs: 1000,
          endsAtMs: null,
          durationSeconds: 60,
        },
      });

      const nextState = workoutReducer(
        {
          ...workoutInitialState,
          nowMs: 1000,
          activeSession,
        },
        { type: 'timer/override', payload: { durationSeconds: 90, nowMs: 5000 } },
      );

      assert.equal(nextState.activeSession.restTimer.status, 'paused');
      assert.equal(nextState.activeSession.restTimer.durationSeconds, 90);
      assert.equal(nextState.activeSession.restTimer.endsAtMs, null);
    },
  },
  {
    name: 'swapping an exercise renames it and drops the old prefilled load',
    run() {
      const activeSession = createCompletedSession({
        status: 'active',
        completedAt: undefined,
        exercises: [
          createExercise({
            exerciseName: 'Leg Press',
            substitutionGroup: 'squat_pattern',
            status: 'active',
            sets: [
              createSet({ setIndex: 0, actualLoadKg: 150, draftLoadText: '150', plannedLoadKg: 150 }),
              createSet({
                setIndex: 1,
                status: 'pending',
                plannedLoadKg: 150,
                draftLoadText: '150',
                draftRepsText: '',
                actualLoadKg: undefined,
                actualReps: undefined,
                completedAt: undefined,
                edited: false,
                autoProgressedFromKg: 147.5,
              }),
            ],
          }),
        ],
      });

      const nextState = workoutReducer(
        { ...workoutInitialState, activeSession },
        {
          type: 'exercise/swap',
          payload: {
            slotId: activeSession.exercises[0].slotId,
            exerciseName: 'Front Squat',
            substitutionGroup: 'squat_pattern',
            unitPreference: 'kg',
          },
        },
      );

      const swapped = nextState.activeSession.exercises[0];
      assert.equal(swapped.exerciseName, 'Front Squat');
      assert.equal(swapped.sourceExerciseName, 'Leg Press');
      assert.equal(swapped.status, 'swapped');

      // What was actually lifted stays on the record.
      assert.equal(swapped.sets[0].actualLoadKg, 150);

      // Never squatted before, so the field opens empty rather than on the leg
      // press weight — and automated progression cannot claim it picked one.
      assert.equal(swapped.sets[1].draftLoadText, '');
      assert.equal(swapped.sets[1].plannedLoadKg, undefined);
      assert.equal(swapped.sets[1].autoProgressedFromKg, undefined);
      assert.equal(swapped.sets[1].prefilledFromPerformedAt, undefined);
    },
  },
  {
    name: 'swapping to a lift you have done elsewhere prefills what you lifted',
    run() {
      const activeSession = createCompletedSession({
        status: 'active',
        completedAt: undefined,
        exercises: [
          createExercise({
            exerciseName: 'Leg Press',
            substitutionGroup: 'squat_pattern',
            status: 'active',
            sets: [
              createSet({
                setIndex: 0,
                status: 'pending',
                plannedLoadKg: 150,
                draftLoadText: '150',
                draftRepsText: '',
                actualLoadKg: undefined,
                actualReps: undefined,
                completedAt: undefined,
                edited: false,
              }),
            ],
          }),
        ],
      });

      // Front squats done in a DIFFERENT program. Slot-keyed history cannot
      // reach this; the name lookup can, and it is a weight the user actually
      // lifted rather than anything estimated.
      const history = {
        sessions: [],
        lastSelectedTemplateId: null,
        slotHistory: {
          'tpl_other:day_2:legs_1': [
            {
              slotId: 'tpl_other:day_2:legs_1',
              templateId: 'tpl_other',
              templateName: 'Other plan',
              exerciseName: 'Front Squat',
              substitutionGroup: 'squat_pattern',
              performedAt: '2026-07-12T09:00:00.000Z',
              sessionId: 'session_x',
              sets: [{ setIndex: 0, loadKg: 65, reps: 6, completedAt: '2026-07-12T09:05:00.000Z' }],
              skipped: false,
            },
          ],
        },
      };

      const nextState = workoutReducer(
        { ...workoutInitialState, history, activeSession },
        {
          type: 'exercise/swap',
          payload: {
            slotId: activeSession.exercises[0].slotId,
            exerciseName: 'Front Squat',
            substitutionGroup: 'squat_pattern',
            unitPreference: 'kg',
          },
        },
      );

      const swapped = nextState.activeSession.exercises[0];
      assert.equal(swapped.sets[0].draftLoadText, '65');
      assert.equal(swapped.sets[0].plannedLoadKg, 65);
      // Borrowed history never feeds the progression gate, so no AUTO badge…
      assert.equal(swapped.sets[0].autoProgressedFromKg, undefined);
      // …but the weight says where it came from instead of appearing from air.
      assert.equal(swapped.sets[0].prefilledFromPerformedAt, '2026-07-12T09:00:00.000Z');
    },
  },
  {
    name: 'a brand-new slot prefills from the same lift done in another program',
    run() {
      // Nothing has ever been logged on this slot. The lift itself has been —
      // in a different plan. Slot-keyed history is blind to that, which is why
      // a lift you have done for months used to open at zero in a new program.
      const history = {
        sessions: [],
        lastSelectedTemplateId: null,
        slotHistory: {
          'tpl_other:day_2:legs_1': [
            {
              slotId: 'tpl_other:day_2:legs_1',
              templateId: 'tpl_other',
              templateName: 'Other plan',
              exerciseName: 'Front Squat',
              substitutionGroup: 'squat_pattern',
              performedAt: '2026-07-12T09:00:00.000Z',
              sessionId: 'session_x',
              sets: [
                { setIndex: 0, loadKg: 65, reps: 8, completedAt: '2026-07-12T09:05:00.000Z' },
                { setIndex: 1, loadKg: 67.5, reps: 8, completedAt: '2026-07-12T09:10:00.000Z' },
              ],
              skipped: false,
            },
          ],
        },
      };

      const template = {
        id: 'tpl_new',
        name: 'New plan',
        defaultScheduleMode: 'rolling_sequence',
        sessions: [
          {
            id: 'day_1',
            name: 'Legs',
            orderIndex: 0,
            exercises: [
              {
                id: 'ex_1',
                exerciseName: 'Front Squat',
                slotId: 'primary_squat',
                role: 'primary',
                progressionPriority: 'high',
                trackingMode: 'load_and_reps',
                sets: 2,
                repsMin: 6,
                repsMax: 8,
                restSecondsMin: 120,
                restSecondsMax: 180,
                substitutionGroup: 'squat_pattern',
              },
            ],
          },
        ],
      };

      const nextState = workoutReducer(
        { ...workoutInitialState, history },
        {
          type: 'session/startFromRuntimeTemplate',
          payload: {
            template,
            sessionOrderIndex: 0,
            unitPreference: 'kg',
            // ON, and a rep ceiling was cleared on every set of that session —
            // the gate would happily add 2.5 kg if it were fed this history.
            progression: { automatedProgressionEnabled: true, setupLevel: 'beginner' },
          },
        },
      );

      const sets = nextState.activeSession.exercises[0].sets;
      assert.equal(sets[0].draftLoadText, '65');
      assert.equal(sets[0].plannedLoadKg, 65);
      assert.equal(sets[1].plannedLoadKg, 67.5);

      // Decision A: borrowed history seeds the number and NOTHING else. The
      // gate judges "rep ceiling cleared" against this template's rep range,
      // and those sets were performed under another prescription — so it must
      // not move a weight off sessions it never watched, and the AUTO badge
      // must not appear on one.
      assert.equal(sets[0].autoProgressedFromKg, undefined);
      assert.equal(sets[1].autoProgressedFromKg, undefined);

      // Decision B: the weight says where it came from.
      assert.equal(sets[0].prefilledFromPerformedAt, '2026-07-12T09:00:00.000Z');

      // Reps stay empty either way — entering them is what logs the set.
      assert.equal(sets[0].draftRepsText, '');
    },
  },
  {
    name: 'a set logged before "skip this exercise" survives into the saved log',
    run() {
      // Seen on a phone: one set of squats logged, then "Ohita tämä liike" to
      // move on. The completion screen celebrated a new record; Progress said
      // 0 kg, 0 sets; Ennätykset said no records. The skip had marked the
      // whole exercise `skipped`, and `skipped` is what drops a log from every
      // stat. The set that happened has to stay a set.
      const pending = (setIndex) =>
        createSet({
          setIndex,
          status: 'pending',
          actualLoadKg: null,
          actualReps: null,
          completedAt: undefined,
          draftRepsText: '',
          edited: false,
        });
      const exercise = createExercise({
        slotId: 'slot_squat',
        exerciseName: 'Back Squat',
        status: 'active',
        sets: [
          createSet({ setIndex: 0, actualLoadKg: 20, actualReps: 6 }),
          pending(1),
          pending(2),
          pending(3),
        ],
      });
      const activeSession = createCompletedSession({
        status: 'active',
        completedAt: undefined,
        exercises: [exercise],
      });

      const nextState = workoutReducer(
        { ...workoutInitialState, activeSession },
        { type: 'exercise/skip', payload: { slotId: 'slot_squat' } },
      );

      const skipped = nextState.activeSession.exercises[0];
      // The remaining sets are skipped; the logged one is untouched.
      assert.deepEqual(
        skipped.sets.map((set) => set.status),
        ['completed', 'skipped', 'skipped', 'skipped'],
      );
      // And the exercise is done, not skipped — one set was.
      assert.equal(skipped.status, 'completed');

      // What reaches the database carries the set and is not filtered out.
      const [draft] = buildExerciseLogDraftsFromWorkoutSession(nextState.activeSession);
      assert.equal(draft.skipped, false);
      assert.equal(draft.sets.filter((set) => set.outcome === 'completed').length, 1);
      assert.equal(draft.sets[0].weight, 20);
    },
  },
  {
    name: 'skipping an exercise with nothing logged still marks it skipped',
    run() {
      // The other half of the rule: no set done, the exercise reads skipped
      // and stays out of the stats — as before.
      const pending = (setIndex) =>
        createSet({ setIndex, status: 'pending', actualLoadKg: null, actualReps: null, completedAt: undefined, edited: false });
      const activeSession = createCompletedSession({
        status: 'active',
        completedAt: undefined,
        exercises: [createExercise({ slotId: 'slot_bench', status: 'active', sets: [pending(0), pending(1)] })],
      });

      const nextState = workoutReducer(
        { ...workoutInitialState, activeSession },
        { type: 'exercise/skip', payload: { slotId: 'slot_bench' } },
      );

      assert.equal(nextState.activeSession.exercises[0].status, 'skipped');
      const [draft] = buildExerciseLogDraftsFromWorkoutSession(nextState.activeSession);
      assert.equal(draft.skipped, true);
    },
  },
  {
    /**
     * The gate can be right and the badge still never appear.
     * materializeExercise builds each set by listing its fields by hand, and
     * heldForFatigue was never on that list: the gate computed the hold,
     * resolveHistoricalSetDraft carried it, and the set dropped it. So the
     * recovery badge — a Pro behaviour the paywall sells by name — had never
     * once been shown. Guarded here rather than in the gate's own tests,
     * because the gate was right the whole time; it was the hop into the set
     * that lost it.
     */
    name: 'a recovery hold survives the hop from the gate into the set',
    run() {
      const SLOT = 'primary_press_1';
      const DAY_MS = 86400000;
      const now = Date.parse('2026-08-24T09:00:00.000Z');
      const ceilingEntry = (daysAgo) => ({
        slotId: SLOT,
        templateId: 'tpl',
        templateName: 'Push',
        exerciseName: 'Bench Press',
        substitutionGroup: 'horizontal_press',
        performedAt: new Date(now - daysAgo * DAY_MS).toISOString(),
        sessionId: 'sess-' + daysAgo,
        sets: [0, 1, 2].map((setIndex) => ({
          setIndex,
          loadKg: 60,
          reps: 12,
          completedAt: new Date(now - daysAgo * DAY_MS).toISOString(),
        })),
        skipped: false,
      });

      const start = (fatigueSignal) =>
        workoutReducer(
          {
            ...workoutInitialState,
            history: {
              sessions: [],
              lastSelectedTemplateId: null,
              slotHistory: { [SLOT]: [ceilingEntry(0), ceilingEntry(3)] },
            },
          },
          {
            type: 'session/startFromRuntimeTemplate',
            payload: {
              template: {
                id: 'tpl',
                name: 'Push',
                defaultScheduleMode: 'weekday',
                sessions: [
                  {
                    id: 'push_a',
                    name: 'Push A',
                    orderIndex: 1,
                    exercises: [
                      {
                        id: 'ex_bench',
                        exerciseName: 'Bench Press',
                        slotId: SLOT,
                        role: 'primary',
                        progressionPriority: 'high',
                        trackingMode: 'load_and_reps',
                        sets: 3,
                        repsMin: 8,
                        repsMax: 12,
                        restSecondsMin: 120,
                        restSecondsMax: 150,
                        substitutionGroup: 'horizontal_press',
                      },
                    ],
                  },
                ],
              },
              sessionOrderIndex: 1,
              unitPreference: 'kg',
              progression: {
                automatedProgressionEnabled: true,
                setupLevel: 'beginner',
                fatigueSignal,
              },
            },
          },
        ).activeSession.exercises[0].sets[0];

      // Both sessions cleared the ceiling: rested, the load moves.
      const rested = start(undefined);
      assert.equal(rested.plannedLoadKg, 62.5);
      assert.equal(rested.heldForFatigue, undefined);

      // Cooked: the load stays AND the set says why.
      const cooked = start('high');
      assert.equal(cooked.plannedLoadKg, 60);
      assert.equal(cooked.heldForFatigue, true);
    },
  },
];