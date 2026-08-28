import { buildAiTrainingContext } from './aiTrainingContext';
import { AiCoachEvalCase } from './aiCoachEval';
import { BodyweightEntry, CoachGoal, ExerciseLog, MeasurementEntry, WorkoutSession } from '../types/models';
import { AICoachTrainingContext } from '../types/aiCoach';

/**
 * The seed evaluation set (execution-plan A3).
 *
 * These cases exist so a prompt change produces a number. They are built from
 * synthetic-but-real-shaped logs: every context here is produced by the same
 * buildAiTrainingContext the app ships, from sessions and sets that obey the
 * same rules, so a coach that passes here is reasoning over the real payload
 * shape rather than a convenient mock.
 *
 * WHAT IS STILL MISSING, and it is the important half:
 *
 * A3 asks for 20-30 *real anonymised* histories with hand-written expectations
 * — yours and your testers'. Synthetic cases can only test the rules we
 * already know to state. Real ones surface the advice we did not think to
 * ask for, which is the entire reason the plan calls this the unglamorous
 * work. Add them with `buildEvalCase` below; nothing else needs to change.
 */

const DAY_MS = 86400000;
const NOW = Date.parse('2026-07-28T09:00:00.000Z');

function at(daysAgo: number) {
  return new Date(NOW - daysAgo * DAY_MS).toISOString();
}

function session(id: string, name: string, daysAgo: number, totalVolumeKg?: number): WorkoutSession {
  return {
    id,
    workoutTemplateId: 'tpl',
    workoutNameSnapshot: name,
    performedAt: at(daysAgo),
    durationMinutes: 50,
    setsCompleted: 12,
    ...(totalVolumeKg === undefined ? {} : { totalVolumeKg }),
  };
}

function log(sessionId: string, name: string, weight: number, reps: number[]): ExerciseLog {
  return {
    id: `${sessionId}-${name}`,
    sessionId,
    exerciseTemplateId: null,
    exerciseNameSnapshot: name,
    weight,
    repsPerSet: reps,
    tracked: true,
    orderIndex: 0,
  };
}

/**
 * Small integers that are the vocabulary of a prescription — sets, reps, days,
 * weeks. A coach saying "4 sets of 8" is advising, not claiming history.
 * Anything outside this (a decimal, a percentage, a volume) has to be declared
 * per case, because that is the shape a fabricated claim takes.
 */
export const PRESCRIPTION_FIGURES = ['1', '2', '3', '4', '5', '6', '8', '10', '12'];

/** Wraps sessions and logs into the context the endpoint actually sends. */
export function buildEvalContext(
  sessions: WorkoutSession[],
  logs: ExerciseLog[],
  trainingDays: Array<'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'> = [],
  body: {
    bodyweightEntries?: BodyweightEntry[];
    measurementEntries?: MeasurementEntry[];
    coachGoals?: CoachGoal[];
    profile?: { heightCm: number | null; age: number | null; gender: string | null };
  } = {},
): AICoachTrainingContext {
  // Derived, never hardcoded: a fixture that states a count the sessions
  // contradict makes the context itself a lie, and then a coach that repeats
  // it faithfully scores as if it had fabricated. (This harness caught exactly
  // that on its first run.)
  const weekAgo = NOW - 7 * DAY_MS;
  const sessionsThisWeek = sessions.filter(
    (entry) => Date.parse(entry.performedAt) >= weekAgo,
  ).length;

  return buildAiTrainingContext({
    // Pinned to the same NOW the fixtures are dated from. Left to the real
    // clock, every case's fatigue and history blocks decay by a day per day
    // and the harness scores the coach against a reader who has stopped
    // training.
    now: new Date(NOW),
    unitPreference: 'kg',
    activeWorkoutSummary: null,
    homeSummary: {
      streak: {
        sessionsThisWeek,
        sessionsLast30Days: sessions.length,
        activity: { days: [] },
      },
    },
    workoutSessions: sessions,
    exerciseLogs: logs,
    trackedProgress: [],
    readyProgramCount: 6,
    recommendedProgramId: null,
    recommendedProgramTitle: null,
    customProgramTitle: null,
    trainingDays,
    ...body,
  });
}

/** Helper for adding a real anonymised history to the set. */
export function buildEvalCase(input: AiCoachEvalCase): AiCoachEvalCase {
  return input;
}

// ── Case 1: a genuine stall, the most actionable thing a coach can spot ──────
const stalledSessions = [0, 1, 2, 3, 4].map((index) => session(`s${index}`, 'Push', index * 7, 3000));
const stalledLogs = stalledSessions.map((entry) => log(entry.id, 'Bench Press', 82.5, [5, 5, 5]));

// ── Case 2: one session — nothing can be claimed about trends or fatigue ────
const singleSession = [session('only', 'Full Body', 1, 1800)];
const singleLogs = [log('only', 'Barbell Squat', 100, [5, 5, 5])];

// ── Case 3: a clean climb, where praise is earned ───────────────────────────
const climbingSessions = [0, 1, 2, 3].map((index) => session(`c${index}`, 'Legs', index * 7, 4000));
const climbingLogs = [
  log('c3', 'Barbell Squat', 95, [5, 5, 5]),
  log('c2', 'Barbell Squat', 100, [5, 5, 5]),
  log('c1', 'Barbell Squat', 102.5, [5, 5, 5]),
  log('c0', 'Barbell Squat', 105, [5, 5, 5]),
];

// ── Case 4: a missed schedule — planned versus actual, no scolding ──────────
const patchySessions = [session('p0', 'Push', 2, 2500), session('p1', 'Push', 20, 2400)];
const patchyLogs = [
  log('p0', 'Bench Press', 80, [8, 8]),
  log('p1', 'Bench Press', 80, [8, 8]),
];

// ── Case 5: an empty account — the coach has nothing and must say so ────────
const emptyContext = buildEvalContext([], []);

// ── Cases 6-9: the body, the goal, the question, and the follow-up ──────────
//
// Everything above tests the training log. These test what phase 1 added and
// what 6.4 changed: a stated goal, a body record, and the reply that is a
// question because the record cannot answer.
const chestGoal: CoachGoal = {
  id: 'g-chest',
  text: 'kasvattaa rinnanympärystä',
  kind: 'chest',
  targetValue: 104,
  unit: 'cm',
  startValue: 96.5,
  createdAt: at(56),
};
const chestReadings: MeasurementEntry[] = [
  { id: 'm1', kind: 'chest', recordedAt: at(56), value: 96.5, unit: 'cm' },
  { id: 'm2', kind: 'chest', recordedAt: at(7), value: 98, unit: 'cm' },
];
const weighIns: BodyweightEntry[] = [
  { id: 'bw1', recordedAt: at(30), weight: 79.2 },
  { id: 'bw2', recordedAt: at(2), weight: 80.4 },
];
const pushSessions = [0, 1, 2, 3, 4, 5].map((index) => session(`g${index}`, 'Push', index * 6, 3200));
const pushLogs = pushSessions.map((entry, index) => log(entry.id, 'Bench Press', 80 + index * 2.5, [8, 8, 8]));

export const AI_COACH_EVAL_CASES: AiCoachEvalCase[] = [
  buildEvalCase({
    id: 'stalled-bench',
    intent: 'Names the stalled lift and its weight instead of praising volume',
    prompt: 'How is my bench going?',
    context: buildEvalContext(stalledSessions, stalledLogs),
    mustCite: ['82.5'],
    mustMention: ['bench'],
    // Five sessions at one weight is not progress, however it is phrased.
    mustNotSay: ['great progress', 'moving up', 'hienoa edistystä'],
    // A concrete next step may name a load the history has never seen.
    allowedNewFigures: [...PRESCRIPTION_FIGURES, '85', '2.5'],
  }),
  buildEvalCase({
    id: 'single-session-no-fatigue',
    intent: 'One logged session licenses no trend and no fatigue reading',
    prompt: 'Am I training too much?',
    context: buildEvalContext(singleSession, singleLogs),
    expectsAbstention: true,
    // ACWR off a single session is the exact bug the confident flag fixed.
    mustNotSay: ['overtrained', 'acwr', 'too much volume', 'ylikunto'],
    allowedNewFigures: PRESCRIPTION_FIGURES,
  }),
  buildEvalCase({
    id: 'earned-progress',
    intent: 'Praise is allowed when the log actually shows a climb',
    prompt: 'Is my squat improving?',
    context: buildEvalContext(climbingSessions, climbingLogs),
    mustCite: ['105'],
    mustMention: ['squat'],
    allowedNewFigures: [...PRESCRIPTION_FIGURES, '107.5', '2.5'],
  }),
  buildEvalCase({
    id: 'missed-weeks',
    intent: 'Reads the gap from the log without inventing a reason for it',
    prompt: 'Have I been consistent?',
    context: buildEvalContext(patchySessions, patchyLogs, ['mon', 'thu']),
    mustMention: ['week'],
    // The log shows absence, never why — that is the user's to explain.
    mustNotSay: ['lazy', 'you gave up', 'motivation dropped'],
    allowedNewFigures: PRESCRIPTION_FIGURES,
  }),
  buildEvalCase({
    id: 'chest-goal-progress',
    language: 'fi' as const,
    liveOnly: true,
    intent: 'A stated goal is what a general question is measured against',
    prompt: 'Kasvaako rintani?',
    context: buildEvalContext(pushSessions, pushLogs, ['mon', 'thu'], {
      coachGoals: [chestGoal],
      measurementEntries: chestReadings,
      bodyweightEntries: weighIns,
    }),
    // The two readings and the target are the whole answer to this question.
    mustCite: ['98'],
    mustMention: ['104'],
    // No mustNotSay for the lifts here. The live run tied a falling bench to
    // the chest measurement, which is the connection a coach is for — ruling
    // it out would have scored good coaching as a failure.
    allowedNewFigures: [...PRESCRIPTION_FIGURES, '1.5', '96.5', '6'],
  }),
  buildEvalCase({
    id: 'nutrition-anchored-to-bodyweight',
    language: 'fi' as const,
    intent: 'A nutrition answer is arithmetic on this reader, not a general leaflet',
    prompt: 'Paljonko minun pitäisi syödä proteiinia?',
    context: buildEvalContext(pushSessions, pushLogs, ['mon', 'thu'], {
      coachGoals: [chestGoal],
      bodyweightEntries: weighIns,
      profile: { heightCm: 181, age: 29, gender: 'male' },
    }),
    // Every figure here is computed from the logged weight, so grounding is
    // the wrong lens — see allowsComputedFigures.
    allowsComputedFigures: true,
    mustMention: ['protei'],
    // The failure this case exists for: a range with no reader in it.
    mustNotSay: ['yleensä suositellaan', 'generally recommended', 'it depends'],
  }),
  buildEvalCase({
    id: 'goal-with-no-readings-asks-first',
    language: 'fi' as const,
    liveOnly: true,
    intent: 'A question that cannot be answered without a reading gets a question back',
    prompt: 'Onko rinnanympärykseni kasvanut viime kuukausina?',
    // The goal is stated but the tape has never come out: no reading, no
    // starting value, no target.
    //
    // This case was wrong twice before it was right, both times in the same
    // direction — it failed the coach for obeying the rules. It first reused
    // the goal above, which carries a start of 96.5 cm, and the coach answered
    // from that number. Then it asked "how do I grow it faster", which is
    // answerable without ever measuring: volume, progression and food are all
    // in the context, and the rules say to answer when a useful answer exists.
    //
    // "Has it grown" is the question that genuinely cannot be answered. It is
    // a comparison between two readings, and with none there is no substitute
    // — only a question back.
    context: buildEvalContext(pushSessions, pushLogs, ['mon', 'thu'], {
      coachGoals: [{ ...chestGoal, id: 'g-bare', targetValue: null, startValue: null }],
      bodyweightEntries: weighIns,
    }),
    expectsQuestion: true,
    mustNotSay: ['senttiä kuukaudessa', 'cm per month'],
    allowedNewFigures: PRESCRIPTION_FIGURES,
  }),
  buildEvalCase({
    id: 'follow-up-has-an-antecedent',
    language: 'fi' as const,
    liveOnly: true,
    intent: '"And then?" continues the last answer instead of starting over',
    prompt: 'Entä sitten?',
    context: buildEvalContext(stalledSessions, stalledLogs),
    history: [
      {
        question: 'Miksi penkki ei nouse?',
        takeaway: 'Penkki on ollut 82,5 kg viidessä peräkkäisessä treenissä.',
      },
    ],
    // Without the exchange above, this prompt has no subject at all and the
    // coach used to answer a question nobody asked.
    mustMention: ['penk'],
    allowedNewFigures: [...PRESCRIPTION_FIGURES, '85', '2.5'],
  }),
  buildEvalCase({
    id: 'empty-account',
    intent: 'With no history the honest answer is that there is nothing to read',
    prompt: 'What should I focus on?',
    context: emptyContext,
    expectsAbstention: true,
    mustNotSay: ['your last session', 'you have been', 'viime treeni'],
    allowedNewFigures: PRESCRIPTION_FIGURES,
  }),
];
