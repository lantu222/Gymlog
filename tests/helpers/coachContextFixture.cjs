/**
 * A coach context at every limit the app's own builder sets (server audit,
 * 2026-09-21): 24 sessions and 10 lift trajectories of 24 top sets
 * (aiTrainingContext), 12 cardio lines, a 7-day week of 12 exercises each
 * (aiCoachProgramme), 10 lines of past advice (coachAdviceMemory), a goal and a
 * measurement for every kind, three tracked lifts. The free text — names and
 * goals, the reader's own words — is as long as the caller asks.
 *
 * `plateaus` defaults to the lift cap; the builder itself has no cap on them.
 */
function heavyCoachContext({ nameLength = 30, goalLength = 80, plateaus = 10, goals = 14 } = {}) {
  const name = (index) => `${'Barbell exercise with a long name '.repeat(8).slice(0, Math.max(0, nameLength - 2))}${String(index).padStart(2, '0')}`;
  return {
    unitPreference: 'kg',
    activeSession: { title: name(0), nextExercise: name(1), meta: '12 sets left' },
    recentCompletedSessions: [],
    trackedLifts: Array.from({ length: 3 }, (_, index) => ({ key: `k${index}`, name: name(index), latestWeight: 102.5, bestWeight: 110, latestReps: '8' })),
    latestTopSets: [],
    sessionsThisWeek: 4,
    sessionsLast30Days: 18,
    rhythm: [],
    readyProgramCount: 57,
    recommendedProgramId: 'tpl_x',
    recommendedProgramTitle: name(2),
    customProgramTitle: name(3),
    programme: {
      title: name(4),
      source: 'custom',
      daysPerWeek: 7,
      truncated: true,
      days: Array.from({ length: 7 }, (_, day) => ({
        name: name(day),
        dayLabel: 'Monday',
        estimatedMinutes: 75,
        exercises: Array.from({ length: 12 }, (_, exercise) => ({ name: name(exercise), scheme: '4 × 8–12 @ RPE 8' })),
      })),
    },
    plateaus: Array.from({ length: plateaus }, (_, index) => ({ exerciseKey: `p${index}`, name: name(index), stagnantSessions: 5, topWeightKg: 100 })),
    fatigue: { acwr: 1.12, recoveryScore: 71, signal: 'optimal', sessionCount7d: 4, confident: true },
    history: {
      windowDays: 56,
      sessionCount: 40,
      totalVolumeKg: 300000,
      truncated: true,
      confidence: 'high',
      sessions: Array.from({ length: 24 }, (_, index) => ({
        sessionId: `s${index}`,
        name: name(index),
        performedAt: '2026-09-01T10:00:00.000Z',
        day: '2026-09-01',
        durationMinutes: 75,
        volumeKg: 12345,
        setCount: 24,
        exerciseCount: 8,
      })),
      lifts: Array.from({ length: 10 }, (_, index) => ({
        name: name(index),
        sessions: 16,
        firstWeightKg: 80,
        latestWeightKg: 102.5,
        latestReps: 8,
        bestWeightKg: 110,
        changeKg: 22.5,
        spanDays: 55,
        stalledSessions: 4,
        weightSeriesKg: Array.from({ length: 24 }, (_, point) => 80 + point * 1.25),
      })),
      weeks: Array.from({ length: 9 }, () => ({ weekStart: '2026-07-06', sessions: 5, volumeKg: 40000, plannedSessions: 5 })),
      schedule: {
        trainingDays: ['mon', 'tue', 'wed', 'thu', 'fri'],
        cycle: null,
        nextTrainingDate: '2026-09-22',
        plannedPerWeek: 5,
        plannedSessions: 40,
        completedSessions: 38,
      },
    },
    cardio: {
      windowDays: 56,
      sessionCount: 30,
      totalMinutes: 900,
      sessionsLast7Days: 3,
      sessionsLast30Days: 14,
      truncated: true,
      sessions: Array.from({ length: 12 }, () => ({ day: '2026-09-01', activity: 'run', minutes: 45, distanceKm: 8.4 })),
    },
    plannerSetup: {
      goal: 'hypertrophy',
      daysPerWeek: 5,
      experience: 'advanced',
      sessionMinutes: 75,
      equipment: 'full_gym',
      recovery: 'good',
      mustInclude: ['squat', 'bench'],
      avoid: ['overhead'],
      limitations: ['knee'],
    },
    body: {
      weightKg: 82.4,
      weightAt: '2026-09-20',
      weightChange30d: { deltaKg: -1.2, spanDays: 29 },
      weightChange90d: { deltaKg: -3.1, spanDays: 88 },
      measurements: Array.from({ length: 12 }, (_, index) => ({
        kind: `site${index}`,
        unit: 'cm',
        latestValue: 104.5,
        latestAt: '2026-09-20',
        previousValue: 103.5,
        previousAt: '2026-08-20',
      })),
    },
    goals: Array.from({ length: goals }, (_, index) => ({
      text: 'g'.repeat(goalLength),
      kind: `site${index}`,
      targetValue: 110,
      unit: 'cm',
      startValue: 100,
      currentValue: 104.5,
      setAt: '2026-08-01',
      isPrimary: index === 0,
    })),
    profile: { heightCm: 180, age: null, ageRange: '31_40', gender: 'male' },
    homeState: { pinnedStatCardKeys: ['weight', 'bodyfat', 'chest', 'arms', 'waist', 'thighs'], weighInReminderEnabled: true, silencedSuggestions: ['pin_card', 'weigh_in_reminder'] },
    coachMemory: Array.from({ length: 10 }, (_, index) => ({ day: '2026-09-01', takeaway: `${'t'.repeat(98)}${index}` })),
  };
}

module.exports = { heavyCoachContext };
