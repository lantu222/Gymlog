import { AICoachTrainingContext } from '../types/aiCoach';

function line(label: string, value: string) {
  return `${label}: ${value}`;
}

function section(heading: string, lines: string[]) {
  if (lines.length === 0) return null;
  return [`## ${heading}`, ...lines].join('\n');
}

export function buildAiCoachSystemContext(context: AICoachTrainingContext): string {
  const u = context.unitPreference;
  const blocks: string[] = [];

  // Load & fatigue — always present, first so LLM sees it immediately
  const { signal, acwr, recoveryScore, sessionCount7d } = context.fatigue;
  blocks.push(
    section('Load', [
      line('This week', `${sessionCount7d} session${sessionCount7d === 1 ? '' : 's'} | ACWR ${acwr} (${signal}) | Recovery ${recoveryScore}/100`),
      line('Last 30 days', `${context.sessionsLast30Days} sessions`),
    ])!,
  );

  // Active session
  if (context.activeSession) {
    const next = context.activeSession.nextExercise ? ` → ${context.activeSession.nextExercise} next` : '';
    blocks.push(section('Active session', [`${context.activeSession.title}${next}`])!);
  }

  // Recent sessions
  const recentLines = context.recentCompletedSessions.map((s) => {
    const parts: string[] = [s.title];
    if (s.durationMinutes) parts.push(`${s.durationMinutes} min`);
    if (s.setsCompleted) parts.push(`${s.setsCompleted} sets`);
    parts.push(s.performedAt.slice(0, 10));
    return `- ${parts.join(' | ')}`;
  });
  const recentBlock = section('Recent sessions', recentLines);
  if (recentBlock) blocks.push(recentBlock);

  // Tracked lifts
  const liftLines = context.trackedLifts.map((lift) => {
    const weight = lift.latestWeight !== null ? `${lift.latestWeight} ${u}` : '—';
    const best = lift.bestWeight !== null ? ` (best: ${lift.bestWeight} ${u})` : '';
    return `- ${lift.name}: ${weight} x ${lift.latestReps}${best}`;
  });
  const liftBlock = section('Tracked lifts', liftLines);
  if (liftBlock) blocks.push(liftBlock);

  // Plateaus — prominent, with actionable phrasing
  const plateauLines = context.plateaus.map((p) => {
    const weight = p.topWeightKg !== null ? `${p.topWeightKg} ${u}` : '—';
    return `- ${p.name}: ${p.stagnantSessions} sessions at ${weight} without improvement`;
  });
  const plateauBlock = section('Plateaus detected', plateauLines);
  if (plateauBlock) blocks.push(plateauBlock);

  // Plans
  const planParts: string[] = [];
  if (context.recommendedProgramTitle) planParts.push(`recommended: ${context.recommendedProgramTitle}`);
  if (context.customProgramTitle) planParts.push(`custom: ${context.customProgramTitle}`);
  planParts.push(`${context.readyProgramCount} ready programs available`);
  blocks.push(section('Plans', [planParts.join(' | ')])!);

  // Planner setup — only if configured
  if (context.plannerSetup) {
    const s = context.plannerSetup;
    const setupParts: string[] = [];
    if (s.goal) setupParts.push(`goal: ${s.goal}`);
    if (s.daysPerWeek) setupParts.push(`${s.daysPerWeek}d/week`);
    if (s.experience) setupParts.push(s.experience);
    if (s.equipment) setupParts.push(s.equipment);
    if (s.recovery) setupParts.push(`recovery: ${s.recovery}`);

    const setupLines: string[] = [];
    if (setupParts.length > 0) setupLines.push(setupParts.join(' | '));
    if (s.mustInclude.length > 0) setupLines.push(`must include: ${s.mustInclude.join(', ')}`);
    if (s.avoid.length > 0) setupLines.push(`avoid: ${s.avoid.join(', ')}`);
    if (s.limitations.length > 0) setupLines.push(`limitations: ${s.limitations.join(', ')}`);

    const setupBlock = section('Athlete profile', setupLines);
    if (setupBlock) blocks.push(setupBlock);
  }

  return blocks.join('\n\n');
}
