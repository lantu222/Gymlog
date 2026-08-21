const assert = require('node:assert/strict');

/**
 * These assert English copy, so they assert English number formatting with it.
 * removeTrailingZeros reads a module-level decimal mark (lib/format.ts) that
 * the app sets from preferences and that defaults to Finnish, so a suite that
 * wants points rather than commas has to say so — otherwise it passes or fails
 * on whichever suite ran before it.
 */
const { setNumberLanguage } = require('../../.test-dist/lib/format.js');
setNumberLanguage('en');

const {
  parseSchemeLabelSeconds,
  buildGuidedDrillsFromBlock,
  buildGuidedSteps,
  getGuidedPhaseSkipTargetIndex,
  findGuidedPhaseStart,
  getGuidedPhaseLabel,
  getGuidedStepLabel,
  getGuidedNextPreview,
  getGuidedNextName,
  resolveGuidedSetTarget,
  getGuidedStepPlanKey,
  resolveGuidedResumeIndex,
  getGuidedSkipTargetIndex,
  getGuidedBackTargetIndex,
  getGuidedSessionTitle,
  findGuidedSessionPr,
  findGuidedTopSet,
  buildGuidedCoachMessage,
  formatGuidedCountdown,
  formatGuidedTarget,
  findGuidedLibraryIndex,
  getGuidedInitials,
  isGuidedExerciseOut,
  getGuidedStepAnchor,
  findGuidedStepIndexByAnchor,
  dialHoldIntervalMs,
  GUIDED_POSITION_SECONDS,
} = require('../../.test-dist/lib/guidedPlayer.js');

const WARMUP = [
  { name: 'Rowing machine', seconds: 180 },
  { name: 'Band pull-aparts', seconds: 75 },
];
const COOLDOWN = [{ name: 'Chest doorway stretch', seconds: 90 }];
const EXERCISES = [
  { slotId: 'a', name: 'Bench Press', restSeconds: 120, setCount: 3, skipped: false },
  { slotId: 'b', name: 'Overhead Press', restSeconds: 90, setCount: 2, skipped: false },
];

function buildPlan() {
  return buildGuidedSteps({ warmup: WARMUP, exercises: EXERCISES, cooldown: COOLDOWN });
}

module.exports = [
  {
    name: 'parseSchemeLabelSeconds handles min, timed sets, plain seconds and rep sets',
    run() {
      assert.equal(parseSchemeLabelSeconds('3 min'), 180);
      assert.equal(parseSchemeLabelSeconds('2 × 45s'), 90);
      assert.equal(parseSchemeLabelSeconds('2 x 30s'), 60);
      assert.equal(parseSchemeLabelSeconds('45s'), 45);
      // 2 × 8 reps → 48s of work → rounded up to 50.
      assert.equal(parseSchemeLabelSeconds('2 × 8'), 50);
      // Floor for tiny rep schemes.
      assert.equal(parseSchemeLabelSeconds('2 × 3'), 30);
      // Unparseable → 40s default, never zero.
      assert.equal(parseSchemeLabelSeconds('to failure'), 40);
    },
  },
  {
    name: 'buildGuidedDrillsFromBlock converts a home-hero block to timed drills',
    run() {
      const drills = buildGuidedDrillsFromBlock({
        minutes: 6,
        drills: [
          { name: 'Rowing machine', schemeLabel: '3 min' },
          { name: 'Hip openers', schemeLabel: '2 × 8' },
        ],
      });
      assert.deepEqual(drills, [
        { name: 'Rowing machine', seconds: 180 },
        { name: 'Hip openers', seconds: 50 },
      ]);
    },
  },
  {
    name: 'skipping a block leaves the block, not the session',
    run() {
      const { steps } = buildPlan();
      const phaseOf = (index) => ('phase' in steps[index] ? steps[index].phase : null);

      // From the warmup splash, past every drill in it, to the first thing that
      // is not warmup. Five drills used to be five taps to the bar.
      const warmupStart = steps.findIndex((step) => 'phase' in step && step.phase === 'warmup');
      const afterWarmup = getGuidedPhaseSkipTargetIndex(steps, warmupStart);
      assert.notEqual(phaseOf(afterWarmup), 'warmup');
      assert.equal(phaseOf(afterWarmup), 'work');

      // Mid-block does the same thing: the escape is from the block.
      const midWarmup = steps.findIndex((step) => step.type === 'drill' && step.phase === 'warmup');
      assert.equal(getGuidedPhaseSkipTargetIndex(steps, midWarmup), afterWarmup);

      // The cooldown lands on the finish card, which has no phase at all.
      const cooldownStart = steps.findIndex((step) => 'phase' in step && step.phase === 'cooldown');
      const afterCooldown = getGuidedPhaseSkipTargetIndex(steps, cooldownStart);
      assert.equal(steps[afterCooldown].type, 'finish');

      // The work block is the session. It does not answer to this.
      const work = steps.findIndex((step) => step.type === 'set');
      assert.equal(getGuidedPhaseSkipTargetIndex(steps, work), work);
      // Nor does anything off the end of the plan.
      assert.equal(getGuidedPhaseSkipTargetIndex(steps, steps.length - 1), steps.length - 1);
      assert.equal(getGuidedPhaseSkipTargetIndex(steps, 999), 999);
    },
  },
  {
    name: 'buildGuidedSteps produces splash/ready/drill/position/set/rest/finish in order',
    run() {
      const { steps, groups } = buildPlan();
      const kinds = steps.map((step) => step.type);
      assert.deepEqual(kinds, [
        'splash',
        'ready',
        'drill',
        'ready',
        'drill',
        'splash',
        'position',
        'set',
        'rest',
        'set',
        'rest',
        'set',
        'rest',
        'position',
        'set',
        'rest',
        'set',
        'splash',
        'ready',
        'drill',
        'finish',
      ]);
      // No rest after the final set of the final exercise (index 16 → cooldown splash).
      assert.equal(steps[16].type, 'set');
      assert.equal(steps[16].setIndex, 1);
      assert.equal(steps[17].type, 'splash');
      assert.equal(steps[17].doneLabel, 'Workout complete');
      // Groups: 2 warmup + 2 work (with set counts) + 1 cooldown.
      assert.equal(groups.length, 5);
      assert.deepEqual(groups[2], { phase: 'work', setCount: 3 });
      // Work splash reports totals.
      assert.equal(steps[5].sub, '2 exercises · 5 sets');
      assert.equal(steps[5].doneLabel, 'Warm-up complete');
    },
  },
  {
    name: 'buildGuidedSteps skips skipped exercises and empty blocks',
    run() {
      const { steps } = buildGuidedSteps({
        warmup: [],
        exercises: [
          { slotId: 'a', name: 'Bench Press', restSeconds: 120, setCount: 2, skipped: true },
          { slotId: 'b', name: 'Row', restSeconds: 90, setCount: 1, skipped: false },
        ],
        cooldown: [],
      });
      assert.deepEqual(
        steps.map((step) => step.type),
        ['splash', 'position', 'set', 'finish'],
      );
      // No warmup → the work splash has no "complete" chip.
      assert.equal(steps[0].doneLabel, null);
    },
  },
  {
    name: 'a skipped exercise keeps its place in the header numbering',
    run() {
      // Seen on a phone: skip two of six and the third read "EXERCISE 1 OF 4",
      // the last "1 OF 1". The plan is rebuilt after every skip and numbered
      // the survivors from one. Skipped lifts get no steps, but the count is
      // over the whole session and the position is the lift's real place.
      const { steps } = buildGuidedSteps({
        warmup: [],
        exercises: [
          { slotId: 'a', name: 'Squat', restSeconds: 120, setCount: 1, skipped: true },
          { slotId: 'b', name: 'Bench', restSeconds: 120, setCount: 1, skipped: true },
          { slotId: 'c', name: 'Row', restSeconds: 90, setCount: 1, skipped: false },
          { slotId: 'd', name: 'Curl', restSeconds: 60, setCount: 1, skipped: false },
        ],
        cooldown: [],
      });
      const setSteps = steps.filter((step) => step.type === 'set');
      assert.deepEqual(
        setSteps.map((step) => getGuidedPhaseLabel(step)),
        ['WORKOUT · EXERCISE 3 OF 4', 'WORKOUT · EXERCISE 4 OF 4'],
      );
      // The work splash still counts what is left to do.
      assert.equal(steps[0].sub, '2 exercises · 2 sets');
      // And the last surviving set is still the last set of the session — no
      // rest step after it.
      assert.equal(steps[steps.length - 2].type, 'set');
      assert.equal(steps[steps.length - 1].type, 'finish');
    },
  },
  {
    name: 'an exercise leaves the plan when nothing is left and something was skipped',
    run() {
      // The plan and the save answer different questions with the same word.
      // A lift with one logged set and the rest skipped is completed for the
      // save (the set counts) and out of the plan (nothing left to do).
      const set = (status) => ({ status });
      assert.equal(isGuidedExerciseOut({ status: 'skipped', sets: [set('skipped'), set('skipped')] }), true);
      assert.equal(isGuidedExerciseOut({ status: 'completed', sets: [set('completed'), set('skipped')] }), true);
      // Cleanly finished: stays, so the walk back through it still works.
      assert.equal(isGuidedExerciseOut({ status: 'completed', sets: [set('completed'), set('completed')] }), false);
      // Still in progress: stays.
      assert.equal(isGuidedExerciseOut({ status: 'active', sets: [set('completed'), set('pending')] }), false);
      assert.equal(isGuidedExerciseOut({ status: 'active', sets: [set('skipped'), set('pending')] }), false);
    },
  },
  {
    name: 'phase labels match the handoff copy',
    run() {
      const { steps } = buildPlan();
      assert.equal(getGuidedPhaseLabel(steps[2]), 'WARM-UP · 1 OF 2');
      assert.equal(getGuidedPhaseLabel(steps[6]), 'WORKOUT · EXERCISE 1 OF 2');
      assert.equal(getGuidedPhaseLabel(steps[8]), 'WORKOUT · REST');
      assert.equal(getGuidedPhaseLabel(steps[19]), 'COOLDOWN · 1 OF 1');
      assert.equal(getGuidedPhaseLabel(steps[20]), 'DONE');
      assert.equal(getGuidedStepLabel(steps[9]), 'Bench Press set 2');
      // Every label this module returns is localized, including the lift's
      // name. The resume chip used to offer "Front Squat sarja 3" for a screen
      // that then said "Etukyykky".
      assert.equal(getGuidedStepLabel(steps[9], 'fi'), 'Penkkipunnerrus sarja 2');
      assert.equal(getGuidedNextName(steps, 8, 'fi'), 'Penkkipunnerrus');
      assert.equal(
        getGuidedNextPreview(steps, 8, () => ({ reps: 8, loadKg: 60 }), 'fi').line,
        'Penkkipunnerrus · 8 × 60 kg',
      );
    },
  },
  {
    name: 'next preview skips ready/rest/position and resolves set targets',
    run() {
      const { steps } = buildPlan();
      const resolve = () => ({ reps: 8, loadKg: 60 });
      // From warmup splash → first drill.
      assert.deepEqual(getGuidedNextPreview(steps, 0, resolve), {
        title: 'Rowing machine',
        sub: '180s',
        line: 'Rowing machine · 180s',
      });
      // From last warmup drill → Workout splash.
      assert.equal(getGuidedNextPreview(steps, 4, resolve).line, 'Workout');
      // From a set's rest → next set with target.
      assert.equal(getGuidedNextPreview(steps, 8, resolve).line, 'Bench Press · 8 × 60 kg');
      assert.equal(getGuidedNextPreview(steps, 8, resolve).title, 'Bench Press — Set 2 of 3');
      // Bodyweight target renders without kg.
      assert.equal(
        getGuidedNextPreview(steps, 8, () => ({ reps: 12, loadKg: null })).line,
        'Bench Press · 12 reps',
      );
      // Final drill previews the finish.
      assert.equal(getGuidedNextPreview(steps, 19, resolve).line, 'Finish');
      assert.equal(getGuidedNextPreview(steps, 20, resolve), null);
    },
  },
  {
    name: 'next name reports the bare drill/exercise/block ahead (set screen v4)',
    run() {
      const { steps } = buildPlan();
      // Warmup splash → first drill; last warmup drill → the Workout block.
      assert.equal(getGuidedNextName(steps, 0), 'Rowing machine');
      assert.equal(getGuidedNextName(steps, 4), 'Workout');
      // From a set's rest → the next set's exercise, with no target appended.
      assert.equal(getGuidedNextName(steps, 8), 'Bench Press');
      // Nothing but the finish step remains.
      assert.equal(getGuidedNextName(steps, 19), null);
      assert.equal(getGuidedNextName(steps, 20), null);
    },
  },
  {
    name: 'resolveGuidedSetTarget prefers draft prefill, then plan, then previous set',
    run() {
      const sets = [
        {
          setIndex: 0,
          status: 'completed',
          plannedRepsMin: 6,
          plannedRepsMax: 8,
          draftLoadText: '60',
          draftRepsText: '',
          actualLoadKg: 62.5,
          actualReps: 7,
        },
        {
          setIndex: 1,
          status: 'pending',
          plannedRepsMin: 6,
          plannedRepsMax: 8,
          draftLoadText: '62,5',
          draftRepsText: '',
        },
        {
          setIndex: 2,
          status: 'pending',
          plannedRepsMin: 6,
          plannedRepsMax: 8,
          draftLoadText: '',
          draftRepsText: '',
        },
      ];
      // Draft (comma decimal) wins; reps follow the previous completed set.
      assert.deepEqual(resolveGuidedSetTarget(sets, 1, 'load_and_reps'), {
        reps: 7,
        loadKg: 62.5,
        autoProgressedFromKg: null,
        prefilledFromPerformedAt: null,
        heldForFatigue: false,
      });
      // No draft, no plan → previous actual load.
      assert.deepEqual(resolveGuidedSetTarget(sets, 2, 'load_and_reps'), {
        reps: 7,
        loadKg: 62.5,
        autoProgressedFromKg: null,
        prefilledFromPerformedAt: null,
        heldForFatigue: false,
      });
      // First set, no history: planned max reps, null load.
      const fresh = [
        { setIndex: 0, status: 'pending', plannedRepsMin: 6, plannedRepsMax: 10, draftLoadText: '', draftRepsText: '' },
      ];
      assert.deepEqual(resolveGuidedSetTarget(fresh, 0, 'load_and_reps'), {
        reps: 10,
        loadKg: null,
        autoProgressedFromKg: null,
        prefilledFromPerformedAt: null,
        heldForFatigue: false,
      });
      // Bodyweight never carries a load.
      assert.deepEqual(resolveGuidedSetTarget(sets, 1, 'bodyweight'), {
        reps: 7,
        loadKg: null,
        autoProgressedFromKg: null,
        prefilledFromPerformedAt: null,
        heldForFatigue: false,
      });
      assert.equal(resolveGuidedSetTarget(sets, 9, 'load_and_reps'), null);
      assert.equal(formatGuidedTarget({ reps: 8, loadKg: 62.5 }), '8 × 62.5 kg');
      assert.equal(formatGuidedTarget({ reps: 12, loadKg: null }), '12 reps');
    },
  },
  {
    name: 'the step-plan key notices a swap, because the steps carry the name',
    run() {
      const before = getGuidedStepPlanKey(EXERCISES);

      // A swap changes nothing else: same slot, same set count, not skipped.
      // If this key does not move, the player never rebuilds its steps and the
      // swapped exercise stays on screen under its old name.
      const swapped = EXERCISES.map((exercise, index) =>
        index === 0 ? { ...exercise, name: 'Dumbbell Bench Press' } : exercise,
      );
      assert.notEqual(getGuidedStepPlanKey(swapped), before);

      // And the steps it guards really do bake the name in, which is why.
      const steps = buildGuidedSteps({ warmup: [], exercises: swapped, cooldown: [] }).steps;
      const firstSet = steps.find((step) => step.type === 'set');
      assert.equal(firstSet.exerciseName, 'Dumbbell Bench Press');

      // The things it already tracked still move it.
      assert.notEqual(getGuidedStepPlanKey(EXERCISES.map((e, i) => (i === 0 ? { ...e, setCount: 4 } : e))), before);
      assert.notEqual(getGuidedStepPlanKey(EXERCISES.map((e, i) => (i === 0 ? { ...e, skipped: true } : e))), before);
      // Rest length is not baked into a set step, so it is not identity.
      assert.equal(getGuidedStepPlanKey(EXERCISES.map((e) => ({ ...e, restSeconds: 999 }))), before);
    },
  },
  {
    name: 'carry-forward does not reach back over a mid-exercise swap',
    run() {
      // Two sets of leg press are in the book, then the rack frees up and you
      // swap to front squat for the rest. Set 3 must not open on the leg press
      // weight — which is exactly what the device did before this: 2.5 kg of
      // one lift shown as the target for another.
      const sets = [
        {
          setIndex: 0,
          status: 'completed',
          plannedRepsMin: 6,
          plannedRepsMax: 8,
          draftLoadText: '150',
          draftRepsText: '',
          actualLoadKg: 150,
          actualReps: 10,
        },
        {
          setIndex: 1,
          status: 'completed',
          plannedRepsMin: 6,
          plannedRepsMax: 8,
          draftLoadText: '150',
          draftRepsText: '',
          actualLoadKg: 150,
          actualReps: 10,
        },
        { setIndex: 2, status: 'pending', plannedRepsMin: 6, plannedRepsMax: 8, draftLoadText: '', draftRepsText: '' },
      ];

      // Without the boundary this is the old behaviour, kept for every set
      // that was NOT swapped across.
      assert.deepEqual(resolveGuidedSetTarget(sets, 2, 'load_and_reps'), {
        reps: 10,
        loadKg: 150,
        autoProgressedFromKg: null,
        prefilledFromPerformedAt: null,
        heldForFatigue: false,
      });

      // Swapped after set 2 (index 1): neither the load nor the reps of the
      // old lift may cross the line. Reps fall back to the planned ceiling.
      assert.deepEqual(resolveGuidedSetTarget(sets, 2, 'load_and_reps', 1), {
        reps: 8,
        loadKg: null,
        autoProgressedFromKg: null,
        prefilledFromPerformedAt: null,
        heldForFatigue: false,
      });

      // A set logged AFTER the swap carries forward normally again.
      const afterSwap = [
        ...sets.slice(0, 2),
        { ...sets[2], status: 'completed', actualLoadKg: 60, actualReps: 6 },
        { setIndex: 3, status: 'pending', plannedRepsMin: 6, plannedRepsMax: 8, draftLoadText: '', draftRepsText: '' },
      ];
      assert.equal(resolveGuidedSetTarget(afterSwap, 3, 'load_and_reps', 1).loadKg, 60);
      assert.equal(resolveGuidedSetTarget(afterSwap, 3, 'load_and_reps', 1).reps, 6);
    },
  },
  {
    name: 'an automated-progression load is flagged only while it is untouched',
    run() {
      const progressed = (draftLoadText) => ({
        setIndex: 0,
        status: 'pending',
        plannedLoadKg: 62.5,
        autoProgressedFromKg: 60,
        plannedRepsMin: 6,
        plannedRepsMax: 8,
        draftLoadText,
        draftRepsText: '',
      });

      // The prefill the gate wrote: badge-worthy, and it knows the step it took.
      assert.deepEqual(resolveGuidedSetTarget([progressed('62.5')], 0, 'load_and_reps'), {
        reps: 8,
        loadKg: 62.5,
        autoProgressedFromKg: 60,
        prefilledFromPerformedAt: null,
        heldForFatigue: false,
      });

      // Typed over in the list logger — this is the user's weight now, and
      // claiming the app chose it would be a lie about a Pro feature.
      assert.deepEqual(resolveGuidedSetTarget([progressed('65')], 0, 'load_and_reps'), {
        reps: 8,
        loadKg: 65,
        autoProgressedFromKg: null,
        prefilledFromPerformedAt: null,
        heldForFatigue: false,
      });

      // Bodyweight never carries a load, so it never carries the badge either.
      assert.equal(
        resolveGuidedSetTarget([progressed('62.5')], 0, 'bodyweight').autoProgressedFromKg,
        null,
      );

      // Automated progression off (or free): no origin recorded, no badge.
      const plain = {
        setIndex: 0,
        status: 'pending',
        plannedLoadKg: 60,
        plannedRepsMin: 6,
        plannedRepsMax: 8,
        draftLoadText: '60',
        draftRepsText: '',
      };
      assert.equal(resolveGuidedSetTarget([plain], 0, 'load_and_reps').autoProgressedFromKg, null);
    },
  },
  {
    name: 'resume: stored index rolls past sets completed in list view',
    run() {
      const { steps } = buildPlan();
      const completed = new Set(['a:0', 'a:1']);
      const isDone = (slotId, setIndex) => completed.has(`${slotId}:${setIndex}`);
      // Stored on set a:0 (index 7) → both a:0 and a:1 done → lands on a:2 (index 11).
      assert.equal(resolveGuidedResumeIndex(steps, 7, isDone), 11);
      // Stored mid-warmup stays put.
      assert.equal(resolveGuidedResumeIndex(steps, 3, isDone), 3);
      // Clamps overshoot.
      assert.equal(resolveGuidedResumeIndex(steps, 99, isDone), steps.length - 1);
    },
  },
  {
    name: 'resume without a stored index derives position from logged sets',
    run() {
      const { steps } = buildPlan();
      const none = () => false;
      assert.equal(resolveGuidedResumeIndex(steps, null, none), 0);
      // First incomplete is b:0 → land on exercise b's position step (index 13).
      const aDone = (slotId) => slotId === 'a';
      assert.equal(resolveGuidedResumeIndex(steps, null, aDone), 13);
      assert.equal(steps[13].type, 'position');
      // Everything logged → cooldown splash.
      const allDone = () => true;
      assert.equal(resolveGuidedResumeIndex(steps, null, allDone), 17);
      assert.equal(steps[17].type, 'splash');
      assert.equal(findGuidedPhaseStart(steps, 'cooldown'), 17);
    },
  },
  {
    name: 'resume: the anchor finds the same step after the plan changes shape',
    run() {
      // Seen on a phone: a session left on Takakyykky set 2, then Takakyykky
      // skipped and the app relaunched. The plan was rebuilt without it, the
      // stored index now pointed inside the next lift, and the entry screen
      // offered "Jatka treeniä · Penkkipunnerrus sarja 2" for a session that
      // had never touched the bench. The anchor names the step, not its seat.
      const before = buildPlan().steps;
      const bSet1 = before.findIndex((s) => s.type === 'set' && s.slotId === 'b' && s.setIndex === 1);
      const anchor = getGuidedStepAnchor(before[bSet1]);
      assert.deepEqual(anchor, { type: 'set', phase: 'work', slotId: 'b', setIndex: 1 });

      // Now lift a is skipped: the plan is shorter and every later index shifts.
      const after = buildGuidedSteps({
        warmup: WARMUP,
        exercises: [{ ...EXERCISES[0], skipped: true }, EXERCISES[1]],
        cooldown: COOLDOWN,
      }).steps;
      const none = () => false;
      const resumed = resolveGuidedResumeIndex(after, bSet1, none, anchor);
      assert.equal(after[resumed].type, 'set');
      assert.equal(after[resumed].slotId, 'b');
      assert.equal(after[resumed].setIndex, 1);
      // The bare index would have landed somewhere else entirely.
      assert.notEqual(resumed, bSet1);

      // Anchored to a step that left the plan → neither the anchor nor the
      // stale index is trusted; land from the sets like a fresh resume.
      const aSet2 = before.findIndex((s) => s.type === 'set' && s.slotId === 'a' && s.setIndex === 2);
      const goneAnchor = getGuidedStepAnchor(before[aSet2]);
      assert.equal(findGuidedStepIndexByAnchor(after, goneAnchor), null);
      assert.equal(resolveGuidedResumeIndex(after, aSet2, none, goneAnchor), 0);
      // With b:0 done it lands on b's next set instead.
      const bDone0 = (slotId, setIndex) => slotId === 'b' && setIndex === 0;
      const landed = resolveGuidedResumeIndex(after, aSet2, bDone0, goneAnchor);
      assert.equal(after[landed].type, 'set');
      assert.equal(after[landed].setIndex, 1);

      // Drills anchor by name, and survive an exercise leaving too.
      const drill = before.findIndex((s) => s.type === 'drill');
      const drillAnchor = getGuidedStepAnchor(before[drill]);
      assert.equal(after[findGuidedStepIndexByAnchor(after, drillAnchor)].drillName, before[drill].drillName);

      // No anchor at all (a session persisted before this existed): the index
      // still works as before.
      assert.equal(resolveGuidedResumeIndex(before, 3, none, null), 3);
    },
  },
  {
    name: 'a held dial button speeds up but never stops slowing enough to land on a number',
    run() {
      // Slow at first, so a short hold can stop on the number wanted; fast
      // later, because 100 kg from zero is forty ticks and forty ticks at the
      // opening pace is a long hold. Monotone: it never speeds up and then
      // slows down again mid-hold, which would feel like a stutter.
      const schedule = Array.from({ length: 40 }, (_, tick) => dialHoldIntervalMs(tick));
      for (let index = 1; index < schedule.length; index += 1) {
        assert.ok(schedule[index] <= schedule[index - 1], `interval rose at tick ${index}`);
      }
      assert.ok(schedule[0] >= 120, 'the first repeats are too fast to stop on a number');
      assert.ok(schedule[schedule.length - 1] <= 60, 'a long hold never gets quick');
      // Zero to 100 kg in 2.5 kg steps, held: under 4 seconds all told.
      const totalMs = schedule.reduce((sum, ms) => sum + ms, 0);
      assert.ok(totalMs < 4000, `forty ticks take ${totalMs} ms`);
    },
  },
  {
    name: 'skip jumps over the rest after a set; back skips rest/ready backwards',
    run() {
      const { steps } = buildPlan();
      // Skipping set a:0 (index 7) jumps over its rest to set a:1 (index 9).
      assert.equal(getGuidedSkipTargetIndex(steps, 7), 9);
      // Skipping a drill just advances one.
      assert.equal(getGuidedSkipTargetIndex(steps, 2), 3);
      // Back from set a:1 (index 9) skips the rest to set a:0 (index 7).
      assert.equal(getGuidedBackTargetIndex(steps, 9), 7);
      // Back from first drill (index 2) skips ready → warmup splash.
      assert.equal(getGuidedBackTargetIndex(steps, 2), 0);
      assert.equal(getGuidedBackTargetIndex(steps, 0), 0);
    },
  },
  {
    name: 'session title',
    run() {
      // The duration estimate moved to lib/sessionDuration, which Home and the
      // player share — see sessionDuration.test.cjs.
      assert.equal(getGuidedSessionTitle('STRONG Elite - Day 1: Upper (Heavy)'), 'Upper (Heavy)');
      assert.equal(getGuidedSessionTitle('Push Day A'), 'Push Day A');
      assert.equal(getGuidedSessionTitle(''), 'Workout');
      assert.equal(GUIDED_POSITION_SECONDS, 15);
    },
  },
  {
    name: 'PR detection requires history and a heavier lift',
    run() {
      const exercises = [
        {
          exerciseName: 'Bench Press',
          sets: [
            { status: 'completed', actualLoadKg: 60 },
            { status: 'completed', actualLoadKg: 57.5 },
          ],
        },
        {
          exerciseName: 'Overhead Press',
          sets: [{ status: 'completed', actualLoadKg: 40 }],
        },
      ];
      // Bench beats its 57.5 history best; OHP has no history → no PR for it.
      const pr = findGuidedSessionPr(exercises, (index) => (index === 0 ? 57.5 : null));
      assert.deepEqual(pr, { exerciseName: 'Bench Press', bestKg: 60, deltaKg: 2.5 });
      // Equal weight is not a record.
      assert.equal(findGuidedSessionPr(exercises, () => 60), null);
      const top = findGuidedTopSet(exercises);
      assert.equal(top.exerciseName, 'Bench Press');
      assert.equal(top.loadKg, 60);
    },
  },
  {
    name: 'coach message tiers: PR, top set, empty',
    run() {
      const withPr = buildGuidedCoachMessage({
        pr: { exerciseName: 'Bench Press', bestKg: 60, deltaKg: 2.5 },
        topSet: { exerciseName: 'Bench Press', loadKg: 60, reps: 8 },
      });
      assert.ok(withPr.message.includes('new best'));
      assert.ok(withPr.sub.includes('62.5 kg'));
      const noPr = buildGuidedCoachMessage({
        pr: null,
        topSet: { exerciseName: 'Squat', loadKg: 80, reps: 5 },
      });
      assert.ok(noPr.message.includes('Squat'));
      assert.ok(noPr.sub.includes('× 6'));
      const empty = buildGuidedCoachMessage({ pr: null, topSet: null });
      assert.equal(empty.sub, null);
    },
  },
  {
    name: 'countdown formatting matches the mock (plain under 60s, m:ss above)',
    run() {
      assert.equal(formatGuidedCountdown(45.2), '46');
      assert.equal(formatGuidedCountdown(90), '1:30');
      assert.equal(formatGuidedCountdown(0), '0');
      assert.equal(formatGuidedCountdown(-2), '0');
    },
  },
  {
    name: 'library matching: exact, alias, containment — no wild guesses',
    run() {
      const names = [
        'Barbell Bench Press - Medium Grip',
        'Standing Military Press',
        'Side Lateral Raise',
        'Front Barbell Squat',
        'Pushups',
      ];
      assert.equal(findGuidedLibraryIndex('Standing Military Press', names), 1);
      assert.equal(findGuidedLibraryIndex('Bench Press', names), 0);
      assert.equal(findGuidedLibraryIndex('Overhead Press', names), 1);
      assert.equal(findGuidedLibraryIndex('Lateral Raise', names), 2);
      assert.equal(findGuidedLibraryIndex('Front Squat', names), 3);
      assert.equal(findGuidedLibraryIndex('Push-ups', names), 4);
      assert.equal(findGuidedLibraryIndex('Cable Woodchopper', names), null);
      assert.equal(getGuidedInitials('Bench Press'), 'BP');
      assert.equal(getGuidedInitials('Deep Squat Rotations'), 'DS');
    },
  },
  {
    name: 'skipping an exercise lands on the next one, never back at the warm-up',
    run() {
      // The guided player used to ask resolveGuidedResumeIndex where to go
      // after a skip, and that resolver answers 0 when no set has been
      // completed yet. So skipping the very first exercise before logging
      // anything — the rack is taken, you move on — threw the user back to the
      // start of the warm-up. This pins the arithmetic the screen now uses.
      const before = buildGuidedSteps({ warmup: WARMUP, exercises: EXERCISES, cooldown: COOLDOWN }).steps;
      const blockStart = before.findIndex(
        (step) => (step.type === 'position' || step.type === 'set') && step.slotId === 'a',
      );
      assert.ok(blockStart > 0, 'the first exercise should start after the warm-up');

      const after = buildGuidedSteps({
        warmup: WARMUP,
        exercises: [
          { ...EXERCISES[0], skipped: true },
          EXERCISES[1],
        ],
        cooldown: COOLDOWN,
      }).steps;

      // Everything that followed the skipped block slides down into the index
      // that block started at, so that index IS the next exercise.
      const landing = after[Math.min(blockStart, after.length - 1)];
      assert.ok(landing, 'the landing index must exist in the rebuilt plan');
      assert.ok(
        landing.type !== 'drill' && landing.type !== 'ready',
        `skipping landed back in the warm-up (${landing.type})`,
      );
      assert.equal(
        landing.type === 'position' || landing.type === 'set' ? landing.slotId : 'b',
        'b',
        'skipping the first exercise should land on the second',
      );

      // And the resolver alone would have sent us to 0 — the bug this replaces.
      assert.equal(resolveGuidedResumeIndex(after, null, () => false), 0);
    },
  },
];
