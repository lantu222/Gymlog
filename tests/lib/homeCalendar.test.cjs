const assert = require('node:assert/strict');

const {
  getHomeCarouselCalendarDays,
  getHomeDayView,
  getHomeMiniCalendarDays,
} = require('../../.test-dist/lib/homeCalendar.js');

module.exports = [
  {
    name: 'home mini calendar rolls from two days before today to four days after',
    run() {
      const days = getHomeMiniCalendarDays(new Date('2026-05-25T12:00:00.000Z'));

      assert.deepEqual(
        days.map((day) => day.label),
        ['SAT', 'SUN', '25/05', 'TUE', 'WED', 'THU', 'FRI'],
      );
      assert.deepEqual(
        days.map((day) => day.dateLabel),
        ['', '', '25/05', '', '', '', ''],
      );
      assert.equal(days.find((day) => day.isToday)?.weekdayLabel, 'MON');
    },
  },
  {
    name: 'home mini calendar advances one day at a time',
    run() {
      const days = getHomeMiniCalendarDays(new Date('2026-05-26T12:00:00.000Z'));

      assert.deepEqual(
        days.map((day) => day.label),
        ['SUN', 'MON', '26/05', 'WED', 'THU', 'FRI', 'SAT'],
      );
      assert.deepEqual(
        days.map((day) => day.dateLabel),
        ['', '', '26/05', '', '', '', ''],
      );
      assert.equal(days.find((day) => day.isToday)?.weekdayLabel, 'TUE');
    },
  },
  {
    name: 'home carousel calendar includes past days, today, and future days',
    run() {
      const days = getHomeCarouselCalendarDays(new Date('2026-05-25T12:00:00.000Z'));

      assert.equal(days.length, 22);
      assert.equal(days[0].weekdayLabel, 'MON');
      assert.equal(days[0].label, 'MON');
      assert.equal(days[7].weekdayLabel, 'MON');
      assert.equal(days[7].label, '25/05');
      assert.equal(days[7].dateLabel, '25/05');
      assert.equal(days[7].isToday, true);
      assert.equal(days[21].weekdayLabel, 'MON');
    },
  },
  {
    name: 'home day view shows recovery when selected day is outside the plan rhythm',
    run() {
      const [monday, tuesday, wednesday] = getHomeMiniCalendarDays(new Date('2026-05-25T12:00:00.000Z')).slice(2, 5);
      const sessions = [
        { id: 'upper', title: 'Upper', duration: '~50 min', exercises: [], hiddenExerciseCount: 0 },
        { id: 'lower', title: 'Lower', duration: '~50 min', exercises: [], hiddenExerciseCount: 0 },
      ];

      assert.equal(getHomeDayView(monday, [0, 2, 4], sessions).kind, 'training');
      assert.equal(getHomeDayView(monday, [0, 2, 4], sessions).ctaEyebrow, 'NO EXCUSES');
      assert.equal(getHomeDayView(monday, [0, 2, 4], sessions).ctaTitle, 'JUST RESULTS');
      assert.equal(getHomeDayView(tuesday, [0, 2, 4], sessions).kind, 'recovery');
      assert.equal(getHomeDayView(wednesday, [0, 2, 4], sessions).session?.id, 'lower');
      assert.equal(getHomeDayView(wednesday, [0, 2, 4], sessions).ctaEyebrow, 'TRAINING');
      assert.equal(getHomeDayView(wednesday, [0, 2, 4], sessions).ctaTitle, 'TODAY');
    },
  },
  {
    name: 'home day view treats Tuesday as recovery for a two day plan',
    run() {
      const [, , , tuesday] = getHomeMiniCalendarDays(new Date('2026-05-25T12:00:00.000Z'));
      const sessions = [
        {
          id: 'minimal_a',
          title: 'Minimal A',
          duration: '~45 min',
          exercises: [{ name: 'Bodyweight Squat', setsLabel: '3 sets' }],
          hiddenExerciseCount: 0,
        },
        {
          id: 'minimal_b',
          title: 'Minimal B',
          duration: '~45 min',
          exercises: [{ name: 'Incline Push-Up', setsLabel: '3 sets' }],
          hiddenExerciseCount: 0,
        },
      ];
      const view = getHomeDayView(tuesday, [0, 3], sessions);

      assert.equal(tuesday.weekdayLabel, 'TUE');
      assert.equal(view.kind, 'recovery');
      assert.equal(view.session, null);
      assert.equal(view.ctaEyebrow, 'RECOVERY');
    },
  },
];
