/**
 * Builds tests/fixtures/storage-history/*.json — what past releases wrote to
 * AsyncStorage, for tests/storage/storageLoadInvariant.test.cjs.
 *
 * Not run by the test suite; run it by hand when the corpus should grow:
 *
 *   node tests/fixtures/storage-history/build-corpus.cjs <workdir> <sha> [sha ...]
 *
 * What is real and what is modelled, per release:
 *
 * - REAL: the release's own source, taken from git (`git archive <sha> src`)
 *   and compiled in <workdir>. Its createSeedDatabase() gives the templates,
 *   exercise templates and plans exactly as that version shaped them, its
 *   normalizeDatabase / normalizeWorkoutBundle run over the filled data, and
 *   its own saveDatabase / saveWorkoutBundle write the rows (so the key names
 *   and the JSON layout are that release's, not ours).
 * - MODELLED: the sessions, logs, sets, cardio, bodyweight, measurements,
 *   name book, preferences and the active session are built here, in the
 *   newest shape, then cut down to the fields that release's type files
 *   declare (a field name absent from its models.ts / workoutTypes.ts is
 *   dropped), then passed through that release's own normaliser. A release
 *   that did not know a field cannot have written it.
 *
 * Nothing here ran on a phone. The shapes are those the code would produce
 * for a realistically filled install; they are not copies of anyone's data.
 */
/* eslint-disable */
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const Module = require('node:module');

const REPO = path.resolve(__dirname, '..', '..', '..');
const OUT = __dirname;
const WORK = path.resolve(process.argv[2] || path.join(REPO, '..', 'storage-history-work'));
const SHAS = process.argv.slice(3);
const TSC = path.join(REPO, 'node_modules', 'typescript', 'bin', 'tsc');

function git(args, options = {}) {
  return cp.execFileSync('git', args, { cwd: REPO, maxBuffer: 256 * 1024 * 1024, ...options });
}

function show(sha, file) {
  try {
    return git(['show', `${sha}:${file}`], { stdio: ['ignore', 'pipe', 'ignore'] }).toString('utf8');
  } catch {
    return '';
  }
}

// ---------------------------------------------------------------- compile

function compile(sha) {
  const dir = path.join(WORK, sha);
  if (fs.existsSync(path.join(dir, 'dist', 'storage', 'database.js'))) {
    return dir;
  }
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const tar = cp.spawnSync('tar', ['-x'], {
    cwd: dir,
    input: git(['archive', sha, 'src']),
    maxBuffer: 256 * 1024 * 1024,
  });
  if (tar.status !== 0) {
    throw new Error(`tar failed for ${sha}: ${String(tar.stderr).slice(0, 300)}`);
  }
  const roots = ['src/storage/database.ts', 'src/data/seed.ts', 'src/features/workout/workoutPersistence.ts', 'src/features/workout/workoutCatalog.ts'];
  fs.writeFileSync(
    path.join(dir, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: {
        module: 'commonjs',
        target: 'ES2020',
        moduleResolution: 'node',
        outDir: 'dist',
        noEmitOnError: false,
        jsx: 'react-jsx',
        skipLibCheck: true,
        esModuleInterop: true,
        resolveJsonModule: true,
        strict: false,
        types: [],
      },
      files: roots.filter((file) => fs.existsSync(path.join(dir, file))),
    }),
  );
  cp.spawnSync('node', [TSC, '-p', dir], { encoding: 'utf8' });
  const dbJs = path.join(dir, 'dist', 'storage', 'database.js');
  if (!fs.existsSync(dbJs)) {
    throw new Error(`no database.js emitted for ${sha}`);
  }
  // The normaliser was private in the early releases; the corpus needs it to
  // exist as a function, not to be exported by the app.
  let js = fs.readFileSync(dbJs, 'utf8');
  if (!/exports\.normalizeDatabase\s*=/.test(js) && /function normalizeDatabase\(/.test(js)) {
    js += '\nexports.normalizeDatabase = normalizeDatabase;\n';
    fs.writeFileSync(dbJs, js);
  }
  return dir;
}

// ----------------------------------------------------- runtime stubs / fake

let currentFake = null;
function createFake() {
  const rows = new Map();
  return {
    rows,
    async getItem(key) {
      return rows.has(key) ? rows.get(key) : null;
    },
    async setItem(key, value) {
      rows.set(key, String(value));
    },
    async removeItem(key) {
      rows.delete(key);
    },
    async multiSet(pairs) {
      for (const [key, value] of pairs) rows.set(key, String(value));
    },
    async multiGet(keys) {
      return keys.map((key) => [key, rows.has(key) ? rows.get(key) : null]);
    },
    async multiRemove(keys) {
      for (const key of keys) rows.delete(key);
    },
    async getAllKeys() {
      return [...rows.keys()];
    },
  };
}

const noop = new Proxy(function () {}, {
  get: (_, prop) => (prop === '__esModule' ? false : noop),
  apply: () => noop,
});
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === '@react-native-async-storage/async-storage') {
    const delegate = new Proxy({}, { get: (_, prop) => (...args) => currentFake[prop](...args) });
    return { __esModule: true, default: delegate };
  }
  if (request === 'react-native') {
    return { I18nManager: { getConstants: () => ({}) }, NativeModules: {}, Platform: { OS: 'android' } };
  }
  try {
    return originalLoad.apply(this, arguments);
  } catch (error) {
    if (!request.startsWith('.') && !path.isAbsolute(request)) {
      return noop;
    }
    throw error;
  }
};

// ---------------------------------------------------------------- the data

/** A tiny deterministic generator so a rebuild changes nothing. */
function rng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

const SESSIONS = 5;

function iso(day, hour = 18, minute = 0) {
  return new Date(Date.UTC(2026, 5, day, hour, minute, 0)).toISOString();
}

function drop(value, typesText, skipKeys = new Set(), shallow = false) {
  if (Array.isArray(value)) {
    return value.map((item) => drop(item, typesText, skipKeys, shallow));
  }
  if (!value || typeof value !== 'object') {
    return value;
  }
  const next = {};
  for (const [key, child] of Object.entries(value)) {
    if (!skipKeys.has(key) && !new RegExp(`\\b${key}\\b`).test(typesText)) {
      continue;
    }
    next[key] = shallow ? child : drop(child, typesText, skipKeys, shallow);
  }
  return next;
}

function fillDatabase(base, typesText) {
  const random = rng(20260521);
  const templates = [...base.workoutTemplates];
  const exerciseTemplates = [...base.exerciseTemplates];

  const customSessionA = 'custom_tpl_1_s1';
  const customSessionB = 'custom_tpl_1_s2';
  templates.push({
    id: 'custom_tpl_1',
    name: 'Oma ohjelma 💪',
    exerciseIds: ['ex_c1', 'ex_c2', 'ex_c3', 'ex_c4', 'ex_c5'],
    sessions: [
      { id: customSessionA, name: 'Päivä A', orderIndex: 0, exerciseIds: ['ex_c1', 'ex_c2', 'ex_c3'] },
      { id: customSessionB, name: 'Päivä B', orderIndex: 1, exerciseIds: ['ex_c4', 'ex_c5'] },
    ],
    createdAt: iso(1),
    updatedAt: iso(20),
    origin: 'authored',
    sourceTemplateId: 'tpl_4_day_upper_lower_v1',
  });
  templates.push({
    id: 'freestyle_tpl_1',
    name: 'Vapaa treeni',
    exerciseIds: ['ex_f1'],
    sessions: [{ id: 'freestyle_tpl_1_s1', name: 'Vapaa treeni', orderIndex: 0, exerciseIds: ['ex_f1'] }],
    createdAt: iso(3),
    updatedAt: iso(3),
    origin: 'freestyle',
  });
  const custom = [
    ['ex_c1', customSessionA, 'Penkkipunnerrus', 4, 5, 8, 150, 'ss1'],
    ['ex_c2', customSessionA, 'Kulmasoutu', 4, 8, 10, 120, 'ss1'],
    ['ex_c3', customSessionA, 'Pystypunnerrus', 3, 6, 8, 120, null],
    ['ex_c4', customSessionB, 'Takakyykky', 5, 3, 5, 180, null],
    ['ex_c5', customSessionB, 'Pohkeet', 3, 12, 15, 60, null],
  ];
  custom.forEach(([id, sessionId, name, targetSets, repMin, repMax, restSeconds, supersetGroup], index) => {
    exerciseTemplates.push({
      id,
      workoutTemplateId: 'custom_tpl_1',
      workoutTemplateSessionId: sessionId,
      name,
      targetSets,
      repMin,
      repMax,
      restSeconds,
      trackedDefault: index < 4,
      orderIndex: index < 3 ? index : index - 3,
      libraryItemId: null,
      persistedExerciseTemplateId: null,
      supersetGroup,
    });
  });
  exerciseTemplates.push({
    id: 'ex_f1',
    workoutTemplateId: 'freestyle_tpl_1',
    workoutTemplateSessionId: 'freestyle_tpl_1_s1',
    name: 'Hauiskääntö',
    targetSets: 3,
    repMin: 8,
    repMax: 12,
    restSeconds: 90,
    trackedDefault: true,
    orderIndex: 0,
    libraryItemId: null,
  });

  const workoutSessions = [];
  const exerciseLogs = [];
  const feels = ['easy', 'right', 'hard', 'too_hard', null];
  const efforts = ['easy', 'good', 'hard', null];
  for (let index = 0; index < SESSIONS; index += 1) {
    const template = templates[index % templates.length];
    const session = template.sessions[index % template.sessions.length];
    const templateExercises = exerciseTemplates.filter((item) => item.workoutTemplateSessionId === session.id);
    const sessionId = `session_hist_${index + 1}`;
    const performedAt = iso(1 + index * 2, 17 + (index % 3), 5 * index);
    let setsCompleted = 0;
    let volume = 0;
    templateExercises.slice(0, 3).forEach((exercise, exerciseIndex) => {
      const ramp = exerciseIndex === 0 && index % 2 === 0;
      const baseWeight = 40 + exerciseIndex * 10 + index;
      const sets = [];
      if (exerciseIndex === 0) {
        sets.push({ orderIndex: 0, weight: 20, reps: 10, kind: 'warmup', outcome: 'completed', status: 'completed', effort: null, completedAt: performedAt });
      }
      for (let setIndex = 0; setIndex < exercise.targetSets && setIndex < 3; setIndex += 1) {
        const weight = ramp ? baseWeight + setIndex * 10 : baseWeight;
        const reps = ramp ? 10 - setIndex * 2 : exercise.repMax - (setIndex > 1 ? 1 : 0);
        sets.push({
          orderIndex: sets.length,
          weight,
          reps,
          kind: setIndex === 3 && exerciseIndex === 1 ? 'drop' : 'working',
          outcome: 'completed',
          status: 'completed',
          effort: efforts[(index + setIndex) % efforts.length],
          completedAt: performedAt,
          skippedReason: null,
          planned: {
            loadKg: weight,
            repsMin: exercise.repMin,
            repsMax: exercise.repMax,
            targetReps: ramp ? reps : null,
            basis: ['repeat', 'progressed', 'borrowed', 'added', 'none'][(index + setIndex) % 5],
            fromKg: null,
            fromReps: null,
            cautionArea: null,
          },
        });
      }
      const working = sets.filter((set) => set.kind !== 'warmup');
      setsCompleted += working.length;
      volume += working.reduce((total, set) => total + set.weight * set.reps, 0);
      exerciseLogs.push({
        id: `log_hist_${index + 1}_${exerciseIndex}`,
        sessionId,
        exerciseTemplateId: exercise.id,
        exerciseNameSnapshot: exerciseIndex === 2 && index % 3 === 0 ? 'Vinopenkki ✓' : exercise.name,
        weight: working[0].weight,
        repsPerSet: working.map((set) => set.reps),
        sets,
        tracked: exercise.trackedDefault,
        orderIndex: exerciseIndex,
        skipped: false,
        sessionInserted: false,
        status: 'completed',
        slotId: `slot_${exerciseIndex}`,
        templateSlotId: `slot_${exerciseIndex}`,
        templateExerciseId: exercise.id,
        notes: index % 4 === 0 && exerciseIndex === 0 ? 'Tuntui "raskaalta"\nolka kipeä' : null,
        swappedFrom: index % 5 === 0 && exerciseIndex === 1 ? 'Kulmasoutu' : null,
      });
    });
    workoutSessions.push({
      id: sessionId,
      workoutTemplateId: template.id,
      workoutTemplateSessionId: session.id,
      workoutNameSnapshot: template.name,
      sessionNotes: index % 3 === 0 ? 'Hyvä päivä' : null,
      feel: feels[index % feels.length],
      performedAt,
      startedAt: iso(1 + index * 2, 16 + (index % 3), 30),
      durationMinutes: 45 + index,
      setsCompleted,
      exercisesCompleted: Math.min(4, templateExercises.length),
      exercisesSkipped: 0,
      exercisesSwapped: index % 5 === 0 ? 1 : 0,
      totalVolumeKg: volume,
      trackedExercisesUpdated: 1,
      noteCount: index % 4 === 0 ? 1 : 0,
      sessionInsertedCount: 0,
    });
  }

  const cardioSessions = ['run', 'cycle', 'row', 'walk'].map((activityType, index) => ({
    id: `cardio_${index + 1}`,
    activityType,
    startedAt: iso(2 + index * 5, 7, 0),
    performedAt: iso(2 + index * 5, 7, 40),
    durationSec: 2400 + index * 300,
    distanceKm: index % 2 === 0 ? 6.5 + index : null,
    feel: ['easy', 'steady', 'hard', 'max'][index],
  }));
  const bodyweightEntries = Array.from({ length: 12 }, (_, index) => ({
    id: `bw_${index + 1}`,
    recordedAt: iso(1 + index, 7, 30),
    weight: Math.round((82 - index * 0.1 + random() * 0.4) * 10) / 10,
  }));
  const kinds = ['chest', 'waist', 'hips', 'arms', 'thighs', 'shoulders'];
  const measurementEntries = Array.from({ length: 6 }, (_, index) => ({
    id: `meas_${index + 1}`,
    kind: kinds[index % kinds.length],
    recordedAt: iso(1 + index * 2, 8, 0),
    value: 30 + index * 2.5,
    unit: 'cm',
  }));
  const exerciseNameBook = [
    { alias: 'penkki', wrote: 'Penkki', exerciseName: 'Barbell Bench Press', libraryItemId: null, learnedAt: iso(10) },
    { alias: 'maastis', wrote: 'Maastis 🏋️', exerciseName: 'Deadlift', libraryItemId: null, learnedAt: iso(11) },
    { alias: 'soutu', wrote: 'Soutu', exerciseName: 'Barbell Row', libraryItemId: null, learnedAt: iso(12) },
  ];

  const preferenceOverrides = {
    appLanguage: 'fi',
    darkThemeEnabled: true,
    defaultRestSeconds: 105,
    profileName: 'Testi Käyttäjä',
    onboardingCompleted: true,
    setupCompleted: true,
    entryFlowCompleted: true,
    hasOpenedAppBefore: true,
    firstLaunchAt: iso(1, 9, 0),
    setupGoal: 'strength',
    setupLevel: 'beginner',
    setupDaysPerWeek: 4,
    setupCurrentWeightKg: 81.5,
    setupHeightCm: 180,
    setupAge: 34,
    setupEquipment: 'full_gym',
    setupFocusAreas: ['chest', 'back'],
    setupEquipmentItems: ['barbell', 'dumbbell'],
    proTrialStartedAt: iso(2, 9, 0),
    proTrialUntil: iso(16, 9, 0),
    coachDemoMomentsUsed: ['day7'],
    activePlanId: 'plan_push_pull_legs',
    activePlanIds: ['plan_push_pull_legs'],
    readerSessionNames: { custom_tpl_1_s1: 'Rinta ja selkä' },
    exerciseTechniqueChecks: { 'Barbell Squat': [1, 2] },
    dismissedTipIds: ['tip_1'],
    seenServerNoticeIds: ['n1'],
    legalAcceptance: { termsVersion: 1, privacyVersion: 1, acceptedAt: iso(1, 9, 5) },
  };
  const preferences = { ...base.preferences };
  for (const [key, value] of Object.entries(preferenceOverrides)) {
    if (key in base.preferences) {
      preferences[key] = value;
    }
  }
  if ('notificationPrefs' in preferences && preferences.notificationPrefs && typeof preferences.notificationPrefs === 'object') {
    preferences.notificationPrefs = { ...preferences.notificationPrefs, reminderTime: '06:45' };
  }

  const filled = {
    ...base,
    workoutTemplates: templates,
    exerciseTemplates,
    exerciseLibrary: [],
    workoutSessions,
    cardioSessions,
    exerciseLogs,
    bodyweightEntries,
    measurementEntries,
    exerciseNameBook,
    preferences,
  };
  // Each collection is cut to the fields the release declared.
  for (const key of ['workoutTemplates', 'exerciseTemplates', 'workoutSessions', 'cardioSessions', 'exerciseLogs', 'bodyweightEntries', 'measurementEntries', 'exerciseNameBook']) {
    filled[key] = drop(filled[key], typesText, new Set(), false);
  }
  // A release without the collection did not write it (the early installs
  // had no cardio, no measurements, no name book).
  for (const key of ['cardioSessions', 'measurementEntries', 'exerciseNameBook']) {
    if (!(key in base)) {
      delete filled[key];
    }
  }
  return filled;
}

function fillBundle(catalog, usesScopedSlots) {
  const templates = Object.values(catalog)
    .filter((value) => Array.isArray(value) && value.length && value[0] && Array.isArray(value[0].sessions) && value[0].sessions[0] && Array.isArray(value[0].sessions[0].exercises))
    .flat();
  const template = templates.find((item) => item.id === 'tpl_4_day_upper_lower_v1') || templates[0];
  const tplSession = template.sessions[0];
  const sessions = [];
  const slotHistory = {};
  for (let index = 0; index < SESSIONS; index += 1) {
    const session = template.sessions[index % template.sessions.length];
    const sessionId = `wk_hist_${index + 1}`;
    const performedAt = iso(1 + index * 2, 18, 0);
    sessions.push({
      sessionId,
      templateId: template.id,
      templateSessionId: session.id,
      templateName: template.name,
      performedAt,
      durationMinutes: 50 + index,
      setsCompleted: 12 + index,
      exercisesCompleted: 4,
      exercisesSkipped: 0,
      exercisesSwapped: index % 4 === 0 ? 1 : 0,
      totalVolumeKg: 4000 + index * 100,
    });
    session.exercises.slice(0, 2).forEach((exercise) => {
      const slot = `${template.id}:${session.id}:${exercise.slotId}`;
      (slotHistory[slot] ||= []).unshift({
        slotId: slot,
        templateId: template.id,
        templateName: template.name,
        exerciseName: exercise.exerciseName,
        substitutionGroup: exercise.substitutionGroup,
        performedAt,
        sessionId,
        sets: [0, 1].map((setIndex) => ({
          setIndex,
          loadKg: 40 + setIndex * 10 + index,
          reps: 10 - setIndex * 2,
          completedAt: performedAt,
          effort: ['easy', 'good', 'hard'][setIndex],
        })),
        skipped: false,
        swappedFrom: index % 4 === 0 ? 'Kulmasoutu' : undefined,
        targetReps: index % 3 === 0 ? 7 : undefined,
      });
    });
  }
  for (const entries of Object.values(slotHistory)) {
    entries.length = Math.min(entries.length, 10);
  }
  const exercises = tplSession.exercises.slice(0, 5).map((exercise, exerciseIndex) => ({
    templateExerciseId: exercise.id,
    persistedExerciseTemplateId: null,
    slotId: usesScopedSlots ? `${template.id}:${tplSession.id}:${exercise.slotId}` : exercise.slotId,
    templateSlotId: exercise.slotId,
    exerciseName: exercise.exerciseName,
    role: exercise.role,
    progressionPriority: exercise.progressionPriority,
    trackingMode: exercise.trackingMode,
    restSecondsMin: exercise.restSecondsMin,
    restSecondsMax: exercise.restSecondsMax,
    substitutionGroup: exercise.substitutionGroup,
    supersetGroup: exerciseIndex === 1 || exerciseIndex === 2 ? 'ss1' : null,
    orderIndex: exerciseIndex,
    status: exerciseIndex === 0 ? 'completed' : exerciseIndex === 1 ? 'active' : 'pending',
    libraryItemId: null,
    sessionInserted: false,
    sourceExerciseName: exerciseIndex === 3 ? 'Kulmasoutu' : undefined,
    notes: exerciseIndex === 0 ? 'jalka tuntui oudolta' : undefined,
    isExpanded: exerciseIndex === 1,
    swappedAfterSetIndex: exerciseIndex === 3 ? 0 : undefined,
    sets: [0, 1, 2].map((setIndex) => {
      const done = exerciseIndex === 0 || (exerciseIndex === 1 && setIndex === 0);
      return {
        setIndex,
        plannedLoadKg: 50 + setIndex * 10,
        plannedRepsMin: exercise.repsMin,
        plannedRepsMax: exercise.repsMax,
        draftLoadText: done ? String(50 + setIndex * 10) : '',
        draftRepsText: done ? String(10 - setIndex * 2) : '',
        autoProgressedFromKg: setIndex === 0 ? 47.5 : undefined,
        heldForFatigue: setIndex === 1 ? true : undefined,
        heldForCautionArea: setIndex === 2 ? 'shoulder' : undefined,
        addedMidSession: setIndex === 2 && exerciseIndex === 4 ? true : undefined,
        prefilledFromPerformedAt: setIndex === 0 ? iso(3) : undefined,
        plannedTargetReps: exercise.trackingMode === 'bodyweight' ? 12 : undefined,
        autoProgressedFromReps: exercise.trackingMode === 'bodyweight' ? 10 : undefined,
        rampTargetReps: 10 - setIndex * 2,
        actualLoadKg: done ? 50 + setIndex * 10 : undefined,
        actualReps: done ? 10 - setIndex * 2 : undefined,
        status: done ? 'completed' : 'pending',
        effort: done ? 'good' : null,
        completedAt: done ? iso(20, 18, 10 + setIndex) : undefined,
        edited: setIndex === 0,
        loggedAs: done ? { exerciseName: exercise.exerciseName, trackingMode: exercise.trackingMode } : undefined,
      };
    }),
  }));
  const activeSession = {
    sessionId: 'wk_active_1',
    templateId: template.id,
    templateSessionId: tplSession.id,
    templateName: template.name,
    status: 'active',
    startedAt: iso(20, 17, 55),
    updatedAt: iso(20, 18, 20),
    elapsedSeconds: 1500,
    pausedMs: 60000,
    pausedAt: null,
    pausedMsAtLastSet: 30000,
    activePlanMode: 'rolling_sequence',
    exercises,
    restTimer: {
      status: 'running',
      exerciseSlotId: exercises[1].slotId,
      setIndex: 0,
      startedAtMs: Date.UTC(2026, 5, 20, 18, 10),
      endsAtMs: Date.UTC(2026, 5, 20, 18, 12),
      durationSeconds: 120,
    },
    ui: {
      activeSlotId: exercises[1].slotId,
      activeSetIndex: 1,
      focusedField: 'reps',
      noteEditorSlotId: null,
      swapSheetSlotId: null,
      expandedSlotIds: [exercises[1].slotId],
      finishSummaryOpen: false,
      guidedStepIndex: 4,
      guidedResumeAnchor: { type: 'set', phase: 'work', slotId: exercises[1].slotId, setIndex: 1 },
    },
    sessionOrderIndex: 12,
  };
  return {
    activeSession,
    history: { sessions, slotHistory, lastSelectedTemplateId: template.id },
    activeCardio: {
      activityType: 'run',
      startedAt: iso(21, 7, 0),
      accumulatedMs: 600000,
      resumedAt: null,
      pausedAt: iso(21, 7, 10),
    },
    freestyleDraft: {
      exercises: [
        {
          localKey: 'f1',
          name: 'Barbell Curl',
          libraryItemId: null,
          imageUrl: null,
          repMin: 8,
          repMax: 12,
          restSeconds: 90,
          trackedDefault: true,
          sets: [
            { localKey: 'f1s1', kg: '30', reps: '10', done: true },
            { localKey: 'f1s2', kg: '30', reps: '', done: false },
          ],
          supersetGroup: null,
          displayName: 'Hauiskääntö',
          initials: 'HK',
          metaLabel: 'Käsipaino',
          isBarbell: false,
        },
      ],
      startedAtMs: Date.UTC(2026, 5, 22, 18, 0),
      rest: null,
      savedAtMs: Date.UTC(2026, 5, 22, 18, 20),
    },
  };
}

// -------------------------------------------------------------------- main

async function buildOne(sha) {
  const dir = compile(sha);
  const dist = path.join(dir, 'dist');
  const typesText = [
    'src/types/models.ts',
    'src/features/workout/workoutTypes.ts',
    'src/lib/cardio.ts',
    'src/lib/emptyWorkoutSession.ts',
  ]
    .map((file) => show(sha, file))
    .join('\n');
  const meta = git(['show', '-s', '--format=%ad|%s', '--date=short', sha]).toString('utf8').trim().split('|');

  currentFake = createFake();
  const seed = require(path.join(dist, 'data', 'seed.js'));
  const database = require(path.join(dist, 'storage', 'database.js'));
  const persistence = require(path.join(dist, 'features', 'workout', 'workoutPersistence.js'));
  const catalogFile = path.join(dist, 'features', 'workout', 'workoutCatalog.js');
  const catalog = fs.existsSync(catalogFile) ? require(catalogFile) : {};

  const base = seed.createSeedDatabase();
  const filled = fillDatabase(base, typesText);
  const normalised = database.normalizeDatabase ? database.normalizeDatabase(filled) : filled;
  await database.saveDatabase(normalised);

  const usesScoped = /buildScopedSlotId/.test(show(sha, 'src/features/workout/workoutPersistence.ts'));
  const bundle = fillBundle(catalog, usesScoped);
  const bundleCut = drop(bundle, typesText, new Set(['slotHistory']), false);
  // slotHistory's own keys are slot ids; its entries are still cut to fields.
  bundleCut.history.slotHistory = Object.fromEntries(
    Object.entries(bundle.history.slotHistory).map(([slot, entries]) => [slot, drop(entries, typesText)]),
  );
  const bundleNormalised = persistence.normalizeWorkoutBundle ? persistence.normalizeWorkoutBundle(bundleCut) : bundleCut;
  await persistence.saveWorkoutBundle(bundleNormalised);

  // The release has to open its own output, or the fixture is not what it wrote.
  const reread = await database.loadDatabase();
  if (reread.workoutSessions.length !== normalised.workoutSessions.length) {
    throw new Error(`${sha}: the release itself reloads ${reread.workoutSessions.length} of ${normalised.workoutSessions.length} sessions`);
  }

  const rows = {};
  for (const [key, value] of currentFake.rows) {
    if (key.includes('/corrupt')) continue;
    rows[key] = value;
  }
  const fixture = {
    sha,
    date: meta[0],
    subject: meta.slice(1).join('|').slice(0, 100),
    rows,
  };
  const file = path.join(OUT, `${meta[0]}-${sha}.json`);
  fs.writeFileSync(file, JSON.stringify(fixture, null, 1) + '\n');
  console.log(sha, meta[0], Object.keys(rows).join(','), fs.statSync(file).size);
}

(async () => {
  for (const sha of SHAS) {
    try {
      await buildOne(sha);
    } catch (error) {
      console.error('FAILED', sha, error && error.stack ? error.stack.split('\n').slice(0, 6).join('\n') : error);
    }
  }
})();
