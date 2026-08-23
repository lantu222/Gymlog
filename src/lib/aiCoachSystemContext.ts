import { AICoachTrainingContext } from '../types/aiCoach';

function line(label: string, value: string) {
  return `${label}: ${value}`;
}

function section(heading: string, lines: string[]) {
  if (lines.length === 0) return null;
  return [`## ${heading}`, ...lines].join('\n');
}

function kg(value: number) {
  return `${Math.round(value)} kg`;
}

function trim(value: number) {
  return `${Math.round(value * 10) / 10}`;
}

export function buildAiCoachSystemContext(context: AICoachTrainingContext): string {
  const u = context.unitPreference;
  const blocks: string[] = [];

  // Load & fatigue — always present, first so LLM sees it immediately
  const { signal, acwr, recoveryScore, sessionCount7d, confident } = context.fatigue;
  blocks.push(
    section('Load', [
      // ACWR off four weeks of data is a ratio, not a reading. Stating the
      // signal as fact is how one logged session becomes "you are overtrained".
      line(
        'This week',
        confident
          ? `${sessionCount7d} session${sessionCount7d === 1 ? '' : 's'} | ACWR ${acwr} (${signal}) | Recovery ${recoveryScore}/100`
          : `${sessionCount7d} session${sessionCount7d === 1 ? '' : 's'} | too little history to read load or recovery — do not comment on fatigue`,
      ),
      line('Last 30 days', `${context.sessionsLast30Days} sessions`),
    ])!,
  );

  // Active session
  if (context.activeSession) {
    const next = context.activeSession.nextExercise ? ` → ${context.activeSession.nextExercise} next` : '';
    blocks.push(section('Active session', [`${context.activeSession.title}${next}`])!);
  }

  // Recent sessions — only when the history block below is empty, which means
  // the user is returning after a long break. Otherwise this is the same list
  // twice, and a model that sees a session in two places may count it twice.
  if (context.history.sessionCount === 0) {
    const recentLines = context.recentCompletedSessions.map((s) => {
      const parts: string[] = [s.title];
      if (s.durationMinutes) parts.push(`${s.durationMinutes} min`);
      if (s.setsCompleted) parts.push(`${s.setsCompleted} sets`);
      parts.push(s.performedAt.slice(0, 10));
      return `- ${parts.join(' | ')}`;
    });
    const recentBlock = section('Recent sessions (before this window)', recentLines);
    if (recentBlock) blocks.push(recentBlock);
  }

  // Tracked lifts
  const liftLines = context.trackedLifts.map((lift) => {
    const weight = lift.latestWeight !== null ? `${lift.latestWeight} ${u}` : '—';
    const best = lift.bestWeight !== null ? ` (best: ${lift.bestWeight} ${u})` : '';
    return `- ${lift.name}: ${weight} x ${lift.latestReps}${best}`;
  });
  const liftBlock = section('Tracked lifts', liftLines);
  if (liftBlock) blocks.push(liftBlock);

  // Training history — the block a reader can reconstruct the window from.
  const history = context.history;

  const weekLines = history.weeks.map((week) => {
    const done =
      week.plannedSessions === null
        ? `${week.sessions} session${week.sessions === 1 ? '' : 's'}`
        : `${week.sessions}/${week.plannedSessions} planned`;
    return `- week of ${week.weekStart}: ${done} | ${kg(week.volumeKg)}`;
  });
  const weekBlock = section(`Weeks (last ${history.windowDays} days)`, weekLines);
  if (weekBlock) blocks.push(weekBlock);

  const sessionLines = history.sessions.map((entry) => {
    const parts: string[] = [entry.performedAt.slice(0, 10), entry.name];
    if (entry.durationMinutes) parts.push(`${entry.durationMinutes} min`);
    parts.push(`${entry.setCount} sets across ${entry.exerciseCount} exercises`);
    if (entry.volumeKg !== null) parts.push(kg(entry.volumeKg));
    return `- ${parts.join(' | ')}`;
  });
  if (sessionLines.length > 0) {
    const heading = history.truncated
      ? `Sessions (oldest first, ${sessionLines.length} of ${history.sessionCount} shown)`
      : 'Sessions (oldest first)';
    blocks.push(section(heading, sessionLines)!);
  }

  const trajectoryLines = history.lifts.map((lift) => {
    const series = lift.weightSeriesKg.map(trim).join(' → ');
    const flat = `flat at ${trim(lift.latestWeightKg)} kg for ${lift.stalledSessions} session${lift.stalledSessions === 1 ? '' : 's'}`;
    const moved = `${lift.changeKg > 0 ? '+' : ''}${trim(lift.changeKg)} kg over ${lift.spanDays} day${lift.spanDays === 1 ? '' : 's'}`;
    // A lift can be up over the window and stuck right now. Reporting only the
    // window change hides the stall, which is the part worth acting on.
    const move =
      lift.changeKg === 0
        ? flat
        : lift.stalledSessions >= 3
          ? `${moved}, but ${flat}`
          : moved;
    const best =
      lift.bestWeightKg > lift.latestWeightKg ? `, best ${trim(lift.bestWeightKg)} kg` : '';
    return `- ${lift.name}: ${move}${best} | top sets ${series} | latest ${trim(lift.latestWeightKg)} kg x ${lift.latestReps}`;
  });
  const liftHistoryBlock = section('Lift trajectories (top set per session)', trajectoryLines);
  if (liftHistoryBlock) blocks.push(liftHistoryBlock);

  if (history.schedule) {
    const s = history.schedule;
    blocks.push(
      section('Schedule', [
        line('Planned', `${s.plannedPerWeek}x/week on ${s.trainingDays.join(', ')}`),
        line('Adherence', `${s.completedSessions} done of ${s.plannedSessions} planned in this window`),
      ])!,
    );
  }

  if (history.sessionCount === 0) {
    blocks.push(
      section('Training history', [
        'No sessions logged in this window. Do not describe trends, volume, or progress.',
      ])!,
    );
  } else if (history.sessionCount < 3) {
    // The live eval caught "progress" and "consistent" written over one
    // logged session. A single data point is a fact, not a direction.
    blocks.push(
      section('Reading note', [
        `Only ${history.sessionCount} session${history.sessionCount === 1 ? '' : 's'} in this window: not a trend. Do not describe progress, consistency, or momentum.`,
      ])!,
    );
  }

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
