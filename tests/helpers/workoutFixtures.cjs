function createSet(overrides = {}) {
  return {
    setIndex: 0,
    plannedLoadKg: 80,
    plannedRepsMin: 6,
    plannedRepsMax: 8,
    draftLoadText: '80',
    draftRepsText: '8',
    actualLoadKg: 80,
    actualReps: 8,
    status: 'completed',
    effort: null,
    completedAt: '2026-03-19T10:05:00.000Z',
    edited: true,
    ...overrides,
  };
}

function createExercise(overrides = {}) {
  return {
    templateExerciseId: 'upper_a_bench_press',
    slotId: 'tpl_4_day_upper_lower_v1:upper_a:primary_press_1',
    templateSlotId: 'primary_press_1',
    exerciseName: 'Bench Press',
    role: 'primary',
    progressionPriority: 'high',
    trackingMode: 'load_and_reps',
    restSecondsMin: 120,
    restSecondsMax: 180,
    substitutionGroup: 'horizontal_press',
    orderIndex: 0,
    sets: [createSet(), createSet({ setIndex: 1, actualLoadKg: 82.5, actualReps: 7, completedAt: '2026-03-19T10:08:00.000Z' })],
    status: 'completed',
    libraryItemId: null,
    sessionInserted: false,
    sourceExerciseName: undefined,
    notes: undefined,
    isExpanded: true,
    ...overrides,
  };
}

function createCompletedSession(overrides = {}) {
  return {
    sessionId: 'workout_session_001',
    templateId: 'tpl_4_day_upper_lower_v1',
    templateName: '4-Day Upper/Lower',
    status: 'completed',
    startedAt: '2026-03-19T10:00:00.000Z',
    updatedAt: '2026-03-19T10:35:00.000Z',
    completedAt: '2026-03-19T10:35:00.000Z',
    elapsedSeconds: 2100,
    activePlanMode: 'rolling_sequence',
    exercises: [createExercise()],
    restTimer: {
      status: 'idle',
      exerciseSlotId: null,
      setIndex: null,
      startedAtMs: null,
      endsAtMs: null,
      durationSeconds: 0,
    },
    ui: {
      activeSlotId: null,
      activeSetIndex: 0,
      focusedField: null,
      noteEditorSlotId: null,
      swapSheetSlotId: null,
      expandedSlotIds: [],
      finishSummaryOpen: true,
    },
    sessionOrderIndex: 4,
    ...overrides,
  };
}

module.exports = {
  createCompletedSession,
  createExercise,
  createSet,
};
