const assert = require('node:assert/strict');

const {
  getSessionFocusTitle,
  getSessionBodyFocusLabel,
  getPlanWeekPhase,
  buildSessionEquipmentLabel,
  inferEquipmentFromExerciseName,
  getDefaultWarmup,
  getDefaultCooldown,
  getAdaptTrimEstimate,
} = require('../../.test-dist/lib/homeSessionHero.js');

module.exports = [
  {
    name: 'session focus title strips A/B/C and day-number suffixes',
    run() {
      assert.equal(getSessionFocusTitle('Strength A'), 'Strength');
      assert.equal(getSessionFocusTitle('Strength B', null), 'Strength');
      assert.equal(getSessionFocusTitle('Push A: Chest Focus'), 'Push');
      assert.equal(getSessionFocusTitle('Upper 2'), 'Upper');
      assert.equal(getSessionFocusTitle('Lower Focus'), 'Lower Focus');
      // Falls back to the plan title when the session has no name.
      assert.equal(getSessionFocusTitle(null, '3-Day Strength Base'), '3-Day Strength Base');
      assert.equal(getSessionFocusTitle('', ''), 'Workout');
    },
  },
  {
    name: 'body focus label humanizes split types',
    run() {
      assert.equal(getSessionBodyFocusLabel('full_body'), 'Full body');
      assert.equal(getSessionBodyFocusLabel('upper_lower'), 'Upper / lower');
      assert.equal(getSessionBodyFocusLabel('push_pull_legs'), 'Push / pull / legs');
      assert.equal(getSessionBodyFocusLabel(undefined), 'Full body');
      assert.equal(getSessionBodyFocusLabel(''), 'Full body');
    },
  },
  {
    name: 'plan week phase moves building -> progressing -> peaking',
    run() {
      assert.equal(getPlanWeekPhase(1, 8), 'building');
      assert.equal(getPlanWeekPhase(2, 8), 'building');
      assert.equal(getPlanWeekPhase(4, 8), 'progressing');
      assert.equal(getPlanWeekPhase(7, 8), 'peaking');
      assert.equal(getPlanWeekPhase(8, 8), 'peaking');
      // Clamped inputs stay sane.
      assert.equal(getPlanWeekPhase(0, 8), 'building');
      assert.equal(getPlanWeekPhase(12, 8), 'peaking');
      assert.equal(getPlanWeekPhase(1, 0), 'peaking');
    },
  },
  {
    name: 'equipment label joins unique equipment and hides bodyweight-only sessions',
    run() {
      const library = [
        { name: 'Back Squat', equipment: 'barbell' },
        { name: 'Bench Press', equipment: 'barbell' },
        { name: 'Incline Dumbbell Press', equipment: 'dumbbell' },
        { name: 'Cable Crunch', equipment: 'cable' },
        { name: 'Plank', equipment: 'bodyweight' },
      ];

      assert.equal(
        buildSessionEquipmentLabel(['Back Squat', 'Bench Press', 'Plank'], library),
        'Barbell',
      );
      assert.equal(
        buildSessionEquipmentLabel(['Back Squat', 'Incline Dumbbell Press', 'Cable Crunch'], library),
        'Barbell, Dumbbells & Cables',
      );
      // Case-insensitive name matching.
      assert.equal(buildSessionEquipmentLabel(['back squat'], library), 'Barbell');
      // Bodyweight-only or unknown names -> null (row hidden).
      assert.equal(buildSessionEquipmentLabel(['Plank'], library), null);
      assert.equal(buildSessionEquipmentLabel(['Mystery Move'], library), null);
      assert.equal(buildSessionEquipmentLabel([], library), null);
    },
  },
  {
    name: 'equipment inference covers plan names the library does not know verbatim',
    run() {
      // The generated library has "Barbell Squat" etc., not "Back Squat" —
      // name inference must fill the gap so the equipment row stays truthful.
      assert.equal(inferEquipmentFromExerciseName('Back Squat'), 'barbell');
      assert.equal(inferEquipmentFromExerciseName('Bench Press'), 'barbell');
      assert.equal(inferEquipmentFromExerciseName('Romanian Deadlift'), 'barbell');
      assert.equal(inferEquipmentFromExerciseName('Incline Dumbbell Press'), 'dumbbell');
      assert.equal(inferEquipmentFromExerciseName('Cable Crunch'), 'cable');
      assert.equal(inferEquipmentFromExerciseName('Lat Pulldown'), 'cable');
      assert.equal(inferEquipmentFromExerciseName('Leg Press'), 'machine');
      assert.equal(inferEquipmentFromExerciseName('Plank'), 'bodyweight');
      assert.equal(inferEquipmentFromExerciseName('Push-Up'), 'bodyweight');
      // Ambiguous rows stay unknown rather than guessing.
      assert.equal(inferEquipmentFromExerciseName('Chest-Supported Row'), null);

      // Full fallback path with an empty library.
      assert.equal(
        buildSessionEquipmentLabel(['Back Squat', 'Bench Press', 'Chest-Supported Row', 'Cable Crunch'], []),
        'Barbell & Cables',
      );
      assert.equal(buildSessionEquipmentLabel(['Plank', 'Push-Up'], []), null);
      // Exact library data still wins over inference.
      assert.equal(
        buildSessionEquipmentLabel(['Back Squat'], [{ name: 'Back Squat', equipment: 'machine' }]),
        'Machines',
      );
    },
  },
  {
    name: 'default warmup and cooldown blocks vary by focus and stay well-formed',
    run() {
      const focuses = ['Strength', 'Push', 'Pull', 'Anything Else'];
      for (const focus of focuses) {
        const warmup = getDefaultWarmup(focus);
        const cooldown = getDefaultCooldown(focus);
        assert.ok(warmup.drills.length >= 2, `${focus} warmup has drills`);
        assert.ok(cooldown.drills.length >= 2, `${focus} cooldown has drills`);
        assert.ok(warmup.minutes > 0 && cooldown.minutes > 0);
        for (const drill of [...warmup.drills, ...cooldown.drills]) {
          assert.ok(drill.name.length > 0);
          assert.ok(drill.schemeLabel.length > 0);
        }
      }
      // Focus-specific content actually differs.
      assert.notDeepEqual(getDefaultWarmup('Push').drills, getDefaultWarmup('Pull').drills);
      assert.notDeepEqual(getDefaultCooldown('Push').drills, getDefaultCooldown('Strength').drills);
    },
  },
  {
    name: 'adapt trim estimate matches the mock numbers and clamps low inputs',
    run() {
      // 14 sets / ~55 min -> drops 4 sets, trims to ~35 min (prototype copy).
      assert.deepEqual(getAdaptTrimEstimate(14, 55), { trimmedMinutes: 35, droppedSets: 4 });
      assert.deepEqual(getAdaptTrimEstimate(2, 20), { trimmedMinutes: 15, droppedSets: 1 });
    },
  },
];
