const assert = require('node:assert/strict');

const {
  parseSchemeLabelSeconds,
  buildGuidedDrillsFromBlock,
  buildGuidedSteps,
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
