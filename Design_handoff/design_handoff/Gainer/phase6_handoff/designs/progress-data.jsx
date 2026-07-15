/* GAINER — Progress data (realistic invented trends).
   Shapes mirror src/lib/progression.ts (ExerciseProgressSummary) and the
   ProgressScreen sections: Overview / Tracked / Measures. kg throughout. */

// signal vocabulary from getExerciseProgressSignal — honest, no gamification
const SIGNALS = {
  new_best:   { label: 'New best',   fg: '#157A3A', bg: '#E4F6EA', dot: '#1FA64E' },
  moving_up:  { label: 'Moving up',  fg: '#157A3A', bg: '#E9F6EE', dot: '#37C46B' },
  building:   { label: 'Building',   fg: '#5B21B6', bg: '#EFE7FF', dot: '#8B5CF6' },
  below_last: { label: 'Below last', fg: '#9A5B16', bg: '#FBEFDD', dot: '#E0922F' },
  starting:   { label: 'Starting',   fg: '#667085', bg: '#EEF0F4', dot: '#98A2B3' },
};

// month label for an index counting back from "now" (16 biweekly points ≈ 8 months)
const M = ['Nov', 'Nov', 'Dec', 'Dec', 'Jan', 'Jan', 'Feb', 'Feb', 'Mar', 'Mar', 'Apr', 'Apr', 'May', 'May', 'Jun', 'Jun'];
const series = (vals) => vals.map((v, i) => ({ label: M[i], value: v }));

const LIFTS = [
  {
    key: 'squat', name: 'Back Squat', bodyPart: 'Legs', signal: 'new_best',
    start: 60, latest: 92.5, reps: 5, when: 'Today',
    logs: series([60, 62.5, 65, 67.5, 70, 72.5, 72.5, 75, 77.5, 80, 82.5, 85, 87.5, 90, 90, 92.5]),
  },
  {
    key: 'deadlift', name: 'Deadlift', bodyPart: 'Back', signal: 'building',
    start: 80, latest: 130, reps: 3, when: '2 days ago',
    logs: series([80, 85, 90, 95, 100, 105, 110, 110, 115, 120, 122.5, 125, 127.5, 130, 130, 130]),
  },
  {
    key: 'bench', name: 'Bench Press', bodyPart: 'Chest', signal: 'moving_up',
    start: 50, latest: 72.5, reps: 6, when: '3 days ago',
    logs: series([50, 50, 52.5, 55, 55, 57.5, 60, 60, 62.5, 65, 65, 67.5, 70, 70, 72.5, 72.5]),
  },
  {
    key: 'ohp', name: 'Overhead Press', bodyPart: 'Shoulders', signal: 'below_last',
    start: 30, latest: 42.5, reps: 5, when: '4 days ago',
    logs: series([30, 30, 32.5, 32.5, 35, 35, 37.5, 37.5, 40, 40, 42.5, 42.5, 45, 45, 45, 42.5]),
  },
  {
    key: 'row', name: 'Barbell Row', bodyPart: 'Back', signal: 'moving_up',
    start: 50, latest: 72.5, reps: 8, when: '3 days ago',
    logs: series([50, 52.5, 55, 55, 57.5, 60, 60, 62.5, 65, 65, 67.5, 70, 70, 70, 72.5, 72.5]),
  },
  {
    key: 'curl', name: 'Barbell Curl', bodyPart: 'Biceps', signal: 'building',
    start: 20, latest: 32.5, reps: 10, when: '6 days ago',
    logs: series([20, 20, 22.5, 22.5, 25, 25, 25, 27.5, 27.5, 30, 30, 30, 32.5, 32.5, 32.5, 32.5]),
  },
];

// Overview trend metrics (each is a list of {label, value})
const TRENDS = {
  volume:   { unit: 't', label: 'Weekly volume', range: { '1m': series([8.2, 9.1, 8.8, 9.6].concat([])).slice(0,4), } },
};

// per-range overview points (weekly buckets). value units differ per metric.
const OVERVIEW = {
  volume: {
    suffix: ' t', name: 'Volume',
    '1m': series([8.4, 9.1, 8.7, 9.8]).slice(0, 4),
    '3m': series([6.9, 7.4, 7.1, 7.8, 8.0, 8.4, 8.1, 8.9, 8.6, 9.1, 8.7, 9.8]),
    '6m': series([5.1, 5.8, 6.2, 6.7, 7.0, 7.6, 7.9, 8.3, 8.6, 9.0, 9.2, 9.8]),
    all: series([3.4, 4.0, 4.6, 5.2, 5.8, 6.4, 6.9, 7.4, 7.9, 8.3, 8.7, 9.0, 9.3, 9.5, 9.6, 9.8]),
  },
  duration: {
    suffix: ' min', name: 'Duration',
    '1m': series([58, 64, 55, 67]).slice(0, 4),
    '3m': series([52, 55, 58, 54, 61, 57, 63, 59, 66, 62, 64, 67]),
    '6m': series([48, 51, 53, 55, 57, 56, 60, 59, 62, 63, 65, 67]),
    all: series([42, 45, 47, 49, 51, 53, 54, 56, 58, 59, 61, 62, 64, 65, 66, 67]),
  },
  bodyweight: {
    suffix: ' kg', name: 'Bodyweight',
    '1m': series([80.1, 80.4, 80.6, 80.8]).slice(0, 4),
    '3m': series([78.9, 79.1, 79.3, 79.5, 79.6, 79.9, 80.0, 80.2, 80.3, 80.5, 80.6, 80.8]),
    '6m': series([77.4, 77.8, 78.2, 78.5, 78.9, 79.2, 79.5, 79.8, 80.0, 80.3, 80.5, 80.8]),
    all: series([76.0, 76.4, 76.8, 77.2, 77.6, 78.0, 78.3, 78.7, 79.0, 79.3, 79.6, 79.9, 80.1, 80.4, 80.6, 80.8]),
  },
};

const OVERVIEW_METRICS = [
  { key: 'volume', label: 'Volume' },
  { key: 'duration', label: 'Duration' },
  { key: 'bodyweight', label: 'Bodyweight' },
];
const RANGES = [
  { key: '1m', label: '1M' },
  { key: '3m', label: '3M' },
  { key: '6m', label: '6M' },
  { key: 'all', label: 'All' },
];

// Weekly training rhythm — sessions per week over recent weeks.
// Honest consistency over time (philosophy: "weeks with at least one session"),
// NOT a daily streak. Last entry = current week (in progress).
const RHYTHM = {
  weeksInRow: 10,
  thisWeekDone: 3,
  thisWeekPlanned: 3,
  weeks: [3, 2, 3, 3, 2, 3, 4, 3, 2, 3], // oldest → current
};

// This-month signal stats
const MONTH_STATS = [
  { label: 'Sessions', value: '11', meta: 'this month' },
  { label: 'Volume', value: '38.2 t', meta: 'lifted' },
  { label: 'Avg time', value: '64 min', meta: 'per session' },
];

// Body measurements — latest + small history + trend over 3m
const MEASURES = [
  { key: 'bodyweight', label: 'Body weight', icon: 'scale', unit: 'kg', value: 80.8, delta: +2.6, hist: [78.2, 78.6, 79.0, 79.4, 79.8, 80.2, 80.8] },
  { key: 'bodyfat',    label: 'Body fat',    icon: 'drop',  unit: '%',  value: 15.4, delta: -1.8, hist: [17.2, 16.9, 16.5, 16.1, 15.9, 15.6, 15.4] },
  { key: 'waist',      label: 'Waist',       icon: 'tape',  unit: 'cm', value: 81,   delta: -3,   hist: [84, 83.5, 83, 82.5, 82, 81.5, 81] },
  { key: 'chest',      label: 'Chest',       icon: 'tape',  unit: 'cm', value: 104,  delta: +2,   hist: [102, 102.3, 102.7, 103, 103.3, 103.6, 104] },
  { key: 'shoulders',  label: 'Shoulders',   icon: 'tape',  unit: 'cm', value: 124,  delta: +1.5, hist: [122.5, 122.7, 123, 123.2, 123.5, 123.7, 124] },
  { key: 'thighs',     label: 'Thighs',      icon: 'tape',  unit: 'cm', value: 61,   delta: +2,   hist: [59, 59.3, 59.7, 60, 60.3, 60.6, 61] },
];

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'new_best', label: 'New' },
  { key: 'moving_up', label: 'Up' },
  { key: 'building', label: 'Building' },
  { key: 'below_last', label: 'Below' },
];

// Build current-month calendar matrix (Mon-first weeks). activeDays = set of day numbers.
function buildMonth(activeDays) {
  const now = new Date();
  const year = now.getFullYear(), month = now.getMonth(), today = now.getDate();
  const first = new Date(year, month, 1);
  const startDow = (first.getDay() + 6) % 7; // Mon=0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, active: activeDays.has(d), today: d === today });
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  const monthLabel = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(now);
  return { weeks, monthLabel };
}

// mock active training days in the current month (relative to today)
function recentActiveDays() {
  const now = new Date();
  const today = now.getDate();
  const set = new Set();
  // typical Mon/Wed/Fri/Sat pattern across the month, only up to today
  for (let d = 1; d <= today; d++) {
    const dow = new Date(now.getFullYear(), now.getMonth(), d).getDay();
    if ([1, 3, 5].includes(dow) && d !== today) set.add(d); // Mon/Wed/Fri done
  }
  return set;
}

const CAL = buildMonth(recentActiveDays());

Object.assign(window, {
  SIGNALS, LIFTS, OVERVIEW, OVERVIEW_METRICS, RANGES, MONTH_STATS, MEASURES, FILTERS, CAL, RHYTHM,
});
