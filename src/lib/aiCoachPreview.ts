import { buildAiCoachActions } from './aiCoachActions';
import { AICoachAdvice, AICoachTrainingContext } from '../types/aiCoach';

function formatActiveContext(context: AICoachTrainingContext) {
  if (!context.activeSession) {
    return null;
  }

  if (context.activeSession.nextExercise) {
    return `Now: ${context.activeSession.title} -> ${context.activeSession.nextExercise}`;
  }

  return `Now: ${context.activeSession.title}`;
}

function formatLiftLine(context: AICoachTrainingContext) {
  const firstLift = context.trackedLifts[0];
  if (!firstLift) {
    return null;
  }

  const latest = firstLift.latestWeight !== null ? `${firstLift.latestWeight} ${context.unitPreference}` : 'no load data';
  return `${firstLift.name}: ${latest} x ${firstLift.latestReps}`;
}

function formatTopSetLine(context: AICoachTrainingContext) {
  const latestTopSet = context.latestTopSets[0];
  if (!latestTopSet) {
    return null;
  }

  const weight = latestTopSet.weight !== null ? `${latestTopSet.weight} ${context.unitPreference}` : 'no weight';
  return `${latestTopSet.exerciseName}: ${weight} x ${latestTopSet.reps}`;
}

function formatRecentSessionLine(context: AICoachTrainingContext) {
  const session = context.recentCompletedSessions[0];
  if (!session) {
    return null;
  }

  return `Last: ${session.title}`;
}

function formatFatigueLine(context: AICoachTrainingContext): string | null {
  const { signal, acwr, sessionCount7d } = context.fatigue;
  if (signal === 'optimal') {
    return null;
  }
  if (signal === 'undertrained') {
    return sessionCount7d === 0
      ? 'No sessions logged this week.'
      : `Load is low this week (${sessionCount7d} session${sessionCount7d === 1 ? '' : 's'}).`;
  }
  if (signal === 'elevated') {
    return `Load is elevated this week (ACWR ${acwr}). Watch recovery.`;
  }
  return `Load is high this week (ACWR ${acwr}). Deload risk zone.`;
}

function findMatchingPlateau(lower: string, context: AICoachTrainingContext) {
  return context.plateaus.find((p) => lower.includes(p.name.toLowerCase()) || lower.includes(p.exerciseKey));
}

export function buildAiCoachPreviewAnswer(prompt: string, context: AICoachTrainingContext): AICoachAdvice {
  const lower = prompt.toLowerCase();
  const activeContext = formatActiveContext(context);
  const liftLine = formatLiftLine(context);
  const topSetLine = formatTopSetLine(context);
  const recentSessionLine = formatRecentSessionLine(context);
  const fatigueLine = formatFatigueLine(context);

  if (lower.includes('20 km') || lower.includes('juosta') || lower.includes('juoks') || lower.includes('run') || lower.includes('challenge')) {
    return {
      takeaway: 'Start with 3 runs a week.',
      why: [
        'Rhythm beats random hard days.',
        'One longer run drives the build.',
        `${context.sessionsLast30Days} sessions lately. Match that pace.`,
      ],
      nextSteps: [
        'Keep 1 run clearly longer.',
        'Hold 1 easy day after each run.',
        'Track weekly distance.',
      ],
      plan: [
        'W1: 3 x 3-4 km.',
        'W2: 2 x 4 km + 1 x 5 km.',
        'W3: 2 x 4-5 km + 1 x 6 km.',
        'W4: easy start, then 5 km test.',
      ],
      assumptions: [
        'Preview answer.',
        'Build slower if your base is low.',
      ],
      actions: buildAiCoachActions(prompt, context),
    };
  }

  if (lower.includes('palautu') || lower.includes('väsy') || lower.includes('recovery') || lower.includes('fatigue') || lower.includes('tired') || lower.includes('overtraining')) {
    const { signal, acwr, recoveryScore, sessionCount7d } = context.fatigue;
    const isHigh = signal === 'elevated' || signal === 'high';
    return {
      takeaway: isHigh
        ? 'Back off before the body decides for you.'
        : signal === 'undertrained'
          ? 'Volume is low. You have room to add.'
          : 'Load looks balanced. Keep the rhythm.',
      why: [
        signal === 'high'
          ? `ACWR ${acwr} — well above the safe zone (0.8–1.3).`
          : signal === 'elevated'
            ? `ACWR ${acwr} — slightly above optimal. Still manageable.`
            : signal === 'undertrained'
              ? `ACWR ${acwr} — below 0.8. Either a deload week or missed sessions.`
              : `ACWR ${acwr} — inside the optimal window.`,
        `Recovery score: ${recoveryScore}/100.`,
        `${sessionCount7d} session${sessionCount7d === 1 ? '' : 's'} this week.`,
      ],
      nextSteps: isHigh
        ? [
            'Cut volume by 30–40% this week.',
            'Keep intensity but drop total sets.',
            'Prioritise sleep and food.',
          ]
        : signal === 'undertrained'
          ? [
              'Add one session this week.',
              'Keep loads the same — just more exposure.',
              'Check if something is blocking training.',
            ]
          : [
              'Stick to the plan.',
              'Add load only where the last session felt easy.',
              'No changes needed this week.',
            ],
      plan: isHigh
        ? [
            'This week: 2 sessions max.',
            'Next week: return to normal volume.',
            'Then reassess.',
          ]
        : [
            'Continue as planned.',
            'Flag next hard week in advance.',
          ],
      assumptions: [
        'Preview answer.',
        'Based on logged session volume.',
      ],
      actions: buildAiCoachActions(prompt, context),
    };
  }

  if (lower.includes('bench') || lower.includes('penk') || lower.includes('squat') || lower.includes('kyyk') || lower.includes('deadlift') || lower.includes('maasta')) {
    const plateau = findMatchingPlateau(lower, context);

    if (plateau) {
      const weight = plateau.topWeightKg !== null ? `${plateau.topWeightKg} ${context.unitPreference}` : 'same weight';
      return {
        takeaway: `${plateau.name} is stuck. Change the stimulus, not just the weight.`,
        why: [
          `${plateau.stagnantSessions} sessions at ${weight} without progress.`,
          'The body has adapted — adding load alone won\'t break the plateau.',
          fatigueLine ?? `${context.sessionsThisWeek} sessions this week.`,
        ],
        nextSteps: [
          'Drop to 80% load for one week and focus on bar speed.',
          'Swap one session for a close variation (pause rep, tempo, etc.).',
          'Return to normal load the week after.',
        ],
        plan: [
          'W1: deload at 80%, same sets.',
          'W2: back to working weight + variation.',
          'W3: attempt a new top set.',
        ],
        assumptions: [
          'Preview answer.',
          'Plateau defined as no weight increase over 3+ sessions.',
        ],
        actions: buildAiCoachActions(prompt, context),
      };
    }

    return {
      takeaway: 'Train it twice a week.',
      why: [
        'Stalls usually need repeat exposure.',
        `${context.sessionsThisWeek} sessions this week. Fit frequency to that.`,
        topSetLine ?? liftLine ?? 'Check the latest work sets first.',
      ],
      nextSteps: [
        'Keep it in twice a week.',
        'Add load only after all work sets land.',
        'Set one short target.',
      ],
      plan: [
        'Day 1: 4 work sets, 6-8 reps.',
        'Day 2: 3 lighter sets, 6-10 reps.',
        'Add 1-2 support lifts.',
      ],
      assumptions: [
        'Preview answer.',
      ],
      actions: buildAiCoachActions(prompt, context),
    };
  }

  if (lower.includes('program') || lower.includes('ohjelma') || lower.includes('split') || lower.includes('treenijako')) {
    const plateauNames = context.plateaus.map((p) => p.name).join(', ');
    return {
      takeaway: 'Set the week first.',
      why: [
        'The week matters more than one exercise list.',
        `${context.readyProgramCount} ready plans in Gymlog.`,
        plateauNames
          ? `Stuck lifts to address in the new split: ${plateauNames}.`
          : (activeContext ?? recentSessionLine ?? 'Recent work should shape the split.'),
      ],
      nextSteps: [
        'Lock training days first.',
        'Pick 1-2 main lifts per day.',
        'Keep one clear goal.',
      ],
      plan: [
        '3 days: main lift + 2-3 supports.',
        '4 days: upper/lower or push/pull.',
        'Leave one easier day.',
      ],
      assumptions: [
        'Preview answer.',
      ],
      actions: buildAiCoachActions(prompt, context),
    };
  }

  return {
    takeaway: 'Ask one clear question.',
    why: [
      'Best answers need goal + week + recent work.',
      `${context.sessionsLast30Days} in 30 days. ${context.sessionsThisWeek} this week.`,
      fatigueLine ?? (activeContext ?? recentSessionLine ?? 'Recent work gives the answer context.'),
    ],
    nextSteps: [
      'Name the goal.',
      'Name the timeline.',
      'Name the training days.',
    ],
    plan: [
      'Best 3-day plan?',
      'Bench stuck?',
      'Fix my split?',
    ],
    assumptions: [
      'Preview answer.',
    ],
    actions: buildAiCoachActions(prompt, context),
  };
}
