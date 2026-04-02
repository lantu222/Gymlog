import { buildValluActions } from './valluActions';
import { ValluAdvice, ValluTrainingContext } from '../types/vallu';

function formatActiveContext(context: ValluTrainingContext) {
  if (!context.activeSession) {
    return null;
  }

  if (context.activeSession.nextExercise) {
    return `Now: ${context.activeSession.title} -> ${context.activeSession.nextExercise}`;
  }

  return `Now: ${context.activeSession.title}`;
}

function formatLiftLine(context: ValluTrainingContext) {
  const firstLift = context.trackedLifts[0];
  if (!firstLift) {
    return null;
  }

  const latest = firstLift.latestWeight !== null ? `${firstLift.latestWeight} ${context.unitPreference}` : 'no load data';
  return `${firstLift.name}: ${latest} x ${firstLift.latestReps}`;
}

function formatTopSetLine(context: ValluTrainingContext) {
  const latestTopSet = context.latestTopSets[0];
  if (!latestTopSet) {
    return null;
  }

  const weight = latestTopSet.weight !== null ? `${latestTopSet.weight} ${context.unitPreference}` : 'no weight';
  return `${latestTopSet.exerciseName}: ${weight} x ${latestTopSet.reps}`;
}

function formatRecentSessionLine(context: ValluTrainingContext) {
  const session = context.recentCompletedSessions[0];
  if (!session) {
    return null;
  }

  return `Last: ${session.title}`;
}

export function buildValluPreviewAnswer(prompt: string, context: ValluTrainingContext): ValluAdvice {
  const lower = prompt.toLowerCase();
  const activeContext = formatActiveContext(context);
  const liftLine = formatLiftLine(context);
  const topSetLine = formatTopSetLine(context);
  const recentSessionLine = formatRecentSessionLine(context);

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
      actions: buildValluActions(prompt, context),
    };
  }

  if (lower.includes('bench') || lower.includes('penk') || lower.includes('squat') || lower.includes('kyyk') || lower.includes('deadlift') || lower.includes('maasta')) {
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
      actions: buildValluActions(prompt, context),
    };
  }

  if (lower.includes('program') || lower.includes('ohjelma') || lower.includes('split') || lower.includes('treenijako')) {
    return {
      takeaway: 'Set the week first.',
      why: [
        'The week matters more than one exercise list.',
        `${context.readyProgramCount} ready plans in Gymlog.`,
        activeContext ?? recentSessionLine ?? 'Recent work should shape the split.',
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
      actions: buildValluActions(prompt, context),
    };
  }

  return {
    takeaway: 'Ask one clear question.',
    why: [
      'Best answers need goal + week + recent work.',
      `${context.sessionsLast30Days} in 30 days. ${context.sessionsThisWeek} this week.`,
      activeContext ?? recentSessionLine ?? 'Recent work gives the answer context.',
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
    actions: buildValluActions(prompt, context),
  };
}
