const assert = require('node:assert/strict');

const {
  getPopularExerciseLibraryItems,
  getPopularExerciseLibraryOrder,
} = require('../../.test-dist/lib/exerciseSuggestions.js');

const library = [
  { id: 'axle_deadlift', name: 'Axle Deadlift', category: 'compound', bodyPart: 'back', equipment: 'barbell' },
  { id: 'bench', name: 'Barbell Bench Press - Medium Grip', category: 'compound', bodyPart: 'chest', equipment: 'barbell' },
  { id: 'squat', name: 'Barbell Squat', category: 'compound', bodyPart: 'legs', equipment: 'barbell' },
  { id: 'deadlift', name: 'Barbell Deadlift', category: 'compound', bodyPart: 'back', equipment: 'barbell' },
  { id: 'pulldown', name: 'Wide-Grip Lat Pulldown', category: 'compound', bodyPart: 'back', equipment: 'cable' },
  { id: 'hip_thrust', name: 'Barbell Hip Thrust', category: 'compound', bodyPart: 'glutes', equipment: 'barbell' },
  { id: 'curl', name: 'Dumbbell Bicep Curl', category: 'isolation', bodyPart: 'biceps', equipment: 'dumbbell' },
  { id: 'press', name: 'Shoulder Press', category: 'compound', bodyPart: 'shoulders', equipment: 'dumbbell' },
  { id: 'rdl', name: 'Romanian Deadlift', category: 'compound', bodyPart: 'legs', equipment: 'barbell' },
];

module.exports = [
  {
    name: 'popular exercise list balances beginner-friendly and core strength picks',
    run() {
      const popular = getPopularExerciseLibraryItems(library).map((item) => item.id);

      assert.deepEqual(popular, [
        'bench',
        'squat',
        'deadlift',
        'pulldown',
        'hip_thrust',
        'curl',
        'press',
        'rdl',
      ]);
    },
  },
  {
    name: 'popular exercise order ranks exact preferred variants before generic matches',
    run() {
      const order = getPopularExerciseLibraryOrder(library);

      assert.equal(order.get('deadlift'), 2);
      assert.equal(order.has('axle_deadlift'), false);
    },
  },
];
