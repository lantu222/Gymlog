import { AICoachAction, AICoachTrainingContext } from '../types/vallu';

function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

function includesAny(value: string, patterns: string[]) {
  return patterns.some((pattern) => value.includes(pattern));
}

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function buildSetupActionLabel(prompt: string) {
  if (includesAny(prompt, ['2 day', '2-day', 'two day'])) {
    return 'Adapt setup to 2 days';
  }

  if (includesAny(prompt, ['home gym', 'home', 'minimal equipment', 'equipment'])) {
    return 'Swap setup for home gym';
  }

  if (includesAny(prompt, ['schedule', 'days per week', 'weekly rhythm'])) {
    return 'Review weekly setup';
  }

  return 'Review setup';
}

function buildEditorPrefillName(prompt: string, context: AICoachTrainingContext) {
  const normalizedPrompt = prompt.replace(/[?!.,]+/g, ' ').trim();
  const daysMatch = normalizedPrompt.match(/\b([2-5])\s*-?\s*days?\b/i);

  if (daysMatch) {
    return `${daysMatch[1]}-Day AI Coach Plan`;
  }

  const matchedLift = context.trackedLifts.find((lift) =>
    normalizeText(normalizedPrompt).includes(normalizeText(lift.name)),
  );
  if (matchedLift) {
    return `${matchedLift.name} Fix`;
  }

  if (includesAny(normalizeText(normalizedPrompt), ['split', 'program', 'plan'])) {
    return 'AI Coach custom plan';
  }

  return 'AI Coach custom workout';
}

function buildLastSessionDescription(context: AICoachTrainingContext) {
  const lastSession = context.recentCompletedSessions[0];
  if (!lastSession) {
    return 'Latest saved session.';
  }

  const highlights = [
    typeof lastSession.setsCompleted === 'number' && lastSession.setsCompleted > 0
      ? pluralize(lastSession.setsCompleted, 'set')
      : null,
    lastSession.swappedExercises > 0 ? pluralize(lastSession.swappedExercises, 'swap') : null,
    lastSession.noteCount > 0 ? pluralize(lastSession.noteCount, 'note') : null,
  ].filter(Boolean);

  return highlights.length > 0 ? `${lastSession.title} · ${highlights.join(' · ')}` : lastSession.title;
}

function buildLiftActionDescription(context: AICoachTrainingContext, exerciseKey: string) {
  const lift = context.trackedLifts.find((item) => item.key === exerciseKey);
  if (!lift) {
    return 'Tracked lift detail.';
  }

  if (lift.latestWeight !== null && lift.bestWeight !== null) {
    return 'Latest vs best.';
  }

  return 'Recent trend.';
}

function resolveMatchedLift(prompt: string, context: AICoachTrainingContext) {
  const normalizedPrompt = normalizeText(prompt);
  return (
    context.trackedLifts.find((lift) => normalizedPrompt.includes(normalizeText(lift.name))) ??
    (includesAny(normalizedPrompt, ['bench', 'penk']) ? context.trackedLifts.find((lift) => normalizeText(lift.name).includes('bench')) : null) ??
    (includesAny(normalizedPrompt, ['squat', 'kyyk']) ? context.trackedLifts.find((lift) => normalizeText(lift.name).includes('squat')) : null) ??
    (includesAny(normalizedPrompt, ['deadlift', 'maasta']) ? context.trackedLifts.find((lift) => normalizeText(lift.name).includes('deadlift')) : null)
  );
}

function dedupeActions(actions: AICoachAction[]) {
  const seen = new Set<string>();
  return actions.filter((action) => {
    const key = `${action.kind}:${action.sessionId ?? ''}:${action.exerciseKey ?? ''}:${action.programId ?? ''}:${action.prefillName ?? ''}`;
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

export function buildAiCoachActions(prompt: string, context: AICoachTrainingContext): AICoachAction[] {
  const normalizedPrompt = normalizeText(prompt);
  const actions: AICoachAction[] = [];
  const matchedLift = resolveMatchedLift(prompt, context);
  const lastSession = context.recentCompletedSessions[0] ?? null;
  const liftPrompt = includesAny(normalizedPrompt, ['bench', 'penk', 'squat', 'kyyk', 'deadlift', 'maasta', 'stuck', 'plateau', 'lift']);
  const programPrompt = includesAny(normalizedPrompt, ['program', 'ohjelma', 'split', 'treenijako', 'plan', 'custom', 'build']);
  const currentWorkoutPrompt = includesAny(normalizedPrompt, ['next move', 'current workout', 'today', 'this workout', 'current session']);
  const setupPrompt = includesAny(normalizedPrompt, ['2 day', '2-day', 'two day', 'home gym', 'home', 'equipment', 'schedule', 'days per week']);

  if (currentWorkoutPrompt && context.activeSession) {
    actions.push({
      kind: 'resume_workout',
      label: 'Resume current workout',
      description: `Back to ${context.activeSession.title}.`,
    });
  }

  if (matchedLift && liftPrompt) {
    actions.push({
      kind: 'open_lift_progress',
      label: `Review ${matchedLift.name} trend`,
      description: buildLiftActionDescription(context, matchedLift.key),
      exerciseKey: matchedLift.key,
    });
  } else if (liftPrompt && context.trackedLifts[0]) {
    actions.push({
      kind: 'open_lift_progress',
      label: `Review ${context.trackedLifts[0].name} trend`,
      description: buildLiftActionDescription(context, context.trackedLifts[0].key),
      exerciseKey: context.trackedLifts[0].key,
    });
  }

  if ((liftPrompt || currentWorkoutPrompt || normalizedPrompt.includes('last session')) && lastSession) {
    actions.push({
      kind: 'open_last_session',
      label: 'Review last session',
      description: buildLastSessionDescription(context),
      sessionId: lastSession.sessionId,
    });
  }

  if (programPrompt && context.recommendedProgramId) {
    actions.push({
      kind: 'open_recommended_program',
      label: 'Why this plan fits',
      description: context.recommendedProgramTitle ? `${context.recommendedProgramTitle} fit notes.` : 'Plan fit notes.',
      programId: context.recommendedProgramId,
    });
  }

  if (setupPrompt || programPrompt) {
    actions.push({
      kind: 'review_setup',
      label: buildSetupActionLabel(normalizedPrompt),
      description: 'Edit days, gear, guidance.',
    });
  }

  if (programPrompt) {
    actions.push({
      kind: 'open_custom_editor',
      label: 'Apply this to custom editor',
      description: 'Start a custom draft.',
      prefillName: buildEditorPrefillName(prompt, context),
    });
  }

  if (!programPrompt && context.readyProgramCount > 0) {
    actions.push({
      kind: 'browse_ready_plans',
      label: 'Browse ready plans',
      description: 'Compare the ready plans.',
    });
  }

  if (!matchedLift && context.trackedLifts.length > 0) {
    actions.push({
      kind: 'open_progress',
      label: 'Open progress',
      description: 'Lift trends.',
    });
  }

  if (!actions.length && context.activeSession) {
    actions.push({
      kind: 'resume_workout',
      label: 'Resume current workout',
      description: `Back to ${context.activeSession.title}.`,
    });
  }

  if (!actions.length && lastSession) {
    actions.push({
      kind: 'open_last_session',
      label: 'Review last session',
      description: buildLastSessionDescription(context),
      sessionId: lastSession.sessionId,
    });
  }

  return dedupeActions(actions).slice(0, 3);
}
