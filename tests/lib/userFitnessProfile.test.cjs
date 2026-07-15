const assert = require('node:assert/strict');

const { createEmptyDatabase } = require('../../.test-dist/data/seed.js');
const { buildUserFitnessProfile } = require('../../.test-dist/lib/userFitnessProfile.js');

module.exports = [
  {
    name: 'userFitnessProfile: empty preferences produce safe null defaults',
    run() {
      const { preferences: prefs } = createEmptyDatabase();
      const profile = buildUserFitnessProfile(prefs);

      assert.equal(profile.level, null);
      assert.equal(profile.primaryGoal, null);
      assert.deepEqual(profile.secondaryGoals, []);
      assert.equal(profile.daysPerWeek, null);
      assert.equal(profile.weeklyMinutes, null);
      assert.equal(profile.equipment, null);
      assert.equal(profile.trainingEnvironment, null);
      assert.deepEqual(profile.focusAreas, []);
      assert.equal(profile.currentWeightKg, null);
    },
  },

  {
    name: 'userFitnessProfile: fully populated preferences map all fields correctly',
    run() {
      const { preferences: prefs } = createEmptyDatabase();

      prefs.setupLevel = 'advanced';
      prefs.setupGoal = 'muscle';
      prefs.setupGoals = ['muscle', 'strength'];
      prefs.setupDaysPerWeek = 4;
      prefs.setupWeeklyMinutes = 240;
      prefs.setupEquipment = 'gym';
      prefs.setupTrainingEnvironment = 'full_gym';
      prefs.setupFocusAreas = ['chest', 'back'];
      prefs.setupTrainingFeel = 'challenging';
      prefs.setupCurrentWeightKg = 80;
      prefs.unitPreference = 'kg';

      const profile = buildUserFitnessProfile(prefs);

      assert.equal(profile.level, 'advanced');
      assert.equal(profile.primaryGoal, 'muscle');
      assert.deepEqual(profile.secondaryGoals, ['strength']);
      assert.equal(profile.daysPerWeek, 4);
      assert.equal(profile.weeklyMinutes, 240);
      assert.equal(profile.equipment, 'gym');
      assert.equal(profile.trainingEnvironment, 'full_gym');
      assert.deepEqual(profile.focusAreas, ['chest', 'back']);
      assert.equal(profile.trainingFeel, 'challenging');
      assert.equal(profile.currentWeightKg, 80);
      assert.equal(profile.unitPreference, 'kg');
    },
  },

  {
    name: 'userFitnessProfile: setupGoal null falls back to first entry of setupGoals',
    run() {
      const { preferences: prefs } = createEmptyDatabase();

      prefs.setupGoal = null;
      prefs.setupGoals = ['strength', 'general'];

      const profile = buildUserFitnessProfile(prefs);

      assert.equal(profile.primaryGoal, 'strength');
      assert.deepEqual(profile.secondaryGoals, ['general']);
    },
  },

  {
    name: 'userFitnessProfile: primaryGoal excluded from secondaryGoals when present in setupGoals',
    run() {
      const { preferences: prefs } = createEmptyDatabase();

      prefs.setupGoal = 'muscle';
      prefs.setupGoals = ['muscle', 'strength', 'general'];

      const profile = buildUserFitnessProfile(prefs);

      assert.equal(profile.primaryGoal, 'muscle');
      assert.deepEqual(profile.secondaryGoals, ['strength', 'general']);
      assert.ok(!profile.secondaryGoals.includes('muscle'));
    },
  },

  {
    name: 'userFitnessProfile: setupGoals matching only the primary produces empty secondaryGoals',
    run() {
      const { preferences: prefs } = createEmptyDatabase();

      prefs.setupGoal = 'strength';
      prefs.setupGoals = ['strength'];

      const profile = buildUserFitnessProfile(prefs);

      assert.equal(profile.primaryGoal, 'strength');
      assert.deepEqual(profile.secondaryGoals, []);
    },
  },

  {
    name: 'userFitnessProfile: joint-friendly flags — neutral produces false',
    run() {
      const { preferences: prefs } = createEmptyDatabase();

      prefs.setupShoulderFriendlySwaps = 'neutral';
      prefs.setupElbowFriendlySwaps = 'neutral';
      prefs.setupKneeFriendlySwaps = 'neutral';

      const profile = buildUserFitnessProfile(prefs);

      assert.equal(profile.shoulderFriendly, false);
      assert.equal(profile.elbowFriendly, false);
      assert.equal(profile.kneeFriendly, false);
    },
  },

  {
    name: 'userFitnessProfile: joint-friendly flags — prefer and prioritize both produce true',
    run() {
      const { preferences: prefs } = createEmptyDatabase();

      prefs.setupShoulderFriendlySwaps = 'prefer';
      prefs.setupElbowFriendlySwaps = 'prioritize';
      prefs.setupKneeFriendlySwaps = 'prefer';

      const profile = buildUserFitnessProfile(prefs);

      assert.equal(profile.shoulderFriendly, true);
      assert.equal(profile.elbowFriendly, true);
      assert.equal(profile.kneeFriendly, true);
    },
  },

  {
    name: 'userFitnessProfile: unit preference flows through from preferences',
    run() {
      const { preferences: prefs } = createEmptyDatabase();

      prefs.unitPreference = 'lb';
      const profile = buildUserFitnessProfile(prefs);
      assert.equal(profile.unitPreference, 'lb');

      prefs.unitPreference = 'kg';
      const profile2 = buildUserFitnessProfile(prefs);
      assert.equal(profile2.unitPreference, 'kg');
    },
  },

  {
    name: 'userFitnessProfile: trainingFeel comes directly from preferences without mutation',
    run() {
      const { preferences: prefs } = createEmptyDatabase();

      // seed default is 'challenging'
      const profile = buildUserFitnessProfile(prefs);
      assert.equal(profile.trainingFeel, 'challenging');

      prefs.setupTrainingFeel = 'intense';
      const profile2 = buildUserFitnessProfile(prefs);
      assert.equal(profile2.trainingFeel, 'intense');
    },
  },
];
