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
    const planned = s.cycle
      ? `${s.cycle.onDays} days on, ${s.cycle.offDays} off, repeating every ${s.cycle.length} days (~${s.plannedPerWeek}x/week). Not tied to weekdays.`
      : `${s.plannedPerWeek}x/week on ${s.trainingDays.join(', ')}`;
    blocks.push(
      section(
        'Schedule',
        [
          line('Planned', planned),
          s.nextTrainingDate ? line('Next training day', s.nextTrainingDate) : null,
          line('Adherence', `${s.completedSessions} done of ${s.plannedSessions} planned in this window`),
        ].filter((entry): entry is string => entry !== null),
      )!,
    );
  }

  if (history.sessionCount === 0) {
    blocks.push(
      section('Training history', [
        'No sessions logged in this window. Do not describe trends, volume, or progress.',
      ])!,
    );
  } else if (history.confidence === 'low') {
    // The live eval caught "progress" and "consistent" written over one
    // logged session. A single data point is a fact, not a direction.
    blocks.push(
      section('Reading note', [
        `Only ${history.sessionCount} session${history.sessionCount === 1 ? '' : 's'} in this window: not a trend. Do not describe progress, consistency, or momentum.`,
      ])!,
    );
  } else if (history.confidence === 'medium') {
    // How sure the record allows the answer to sound. Counted from the log,
    // never asked of the model — a model rating its own confidence hedges
    // everything and the hedge stops carrying information.
    blocks.push(
      section('Reading note', [
        `${history.sessionCount} sessions in the last ${history.windowDays} days: enough to read a direction, not enough to call it settled. Qualify the reading once, in the sentence it belongs to — not in front of every claim.`,
      ])!,
    );
  } else {
    blocks.push(
      section('Reading note', [
        `${history.sessionCount} sessions across the last ${history.windowDays} days: a long enough record to state findings plainly. Do not hedge.`,
      ])!,
    );
  }

  // Body record — weight trend and measured sites. Dates stay ISO here; the
  // rules tell the model to rewrite them for the reader's language.
  if (context.body) {
    const b = context.body;
    const bodyLines: string[] = [];
    if (b.weightKg !== null) {
      const parts = [`${trim(b.weightKg)} kg (${b.weightAt})`];
      if (b.weightChange30d) {
        parts.push(`${b.weightChange30d.deltaKg > 0 ? '+' : ''}${trim(b.weightChange30d.deltaKg)} kg over last ${b.weightChange30d.spanDays} days`);
      }
      if (b.weightChange90d && (!b.weightChange30d || b.weightChange90d.spanDays > b.weightChange30d.spanDays)) {
        parts.push(`90d: ${b.weightChange90d.deltaKg > 0 ? '+' : ''}${trim(b.weightChange90d.deltaKg)} kg over ${b.weightChange90d.spanDays} days`);
      }
      bodyLines.push(line('Weight', parts.join(' | ')));
    }
    for (const m of b.measurements) {
      const prev = m.previousValue !== null ? ` | previous ${trim(m.previousValue)} ${m.unit} (${m.previousAt})` : ' | only one reading — not a trend';
      bodyLines.push(line(m.kind, `${trim(m.latestValue)} ${m.unit} (${m.latestAt})${prev}`));
    }
    const bodyBlock = section('Body record', bodyLines);
    if (bodyBlock) blocks.push(bodyBlock);
  }

  const goalLines = (context.goals ?? []).map((goal) => {
    const parts: string[] = [];
    if (goal.startValue !== null) parts.push(`start ${trim(goal.startValue)} ${goal.unit ?? ''}`.trim());
    if (goal.currentValue !== null) parts.push(`now ${trim(goal.currentValue)} ${goal.unit ?? ''}`.trim());
    if (goal.targetValue !== null) parts.push(`target ${trim(goal.targetValue)} ${goal.unit ?? ''}`.trim());
    const detail = parts.length > 0 ? ` — ${parts.join(', ')}` : '';
    const setAt = goal.setAt ? ` (set ${goal.setAt})` : '';
    // The flag has to reach the text or it does not exist: the model reads
    // this rendering, not the object.
    const lead = goal.isPrimary ? '[primary] ' : '';
    return `- ${lead}"${goal.text}"${setAt}${detail}`;
  });
  const goalBlock = section(
    'Goals — stated by the user; tie advice to these. [primary] is the one a general question is answered against',
    goalLines,
  );
  if (goalBlock) blocks.push(goalBlock);

  if (context.profile) {
    const p = context.profile;
    const profileParts: string[] = [];
    if (p.gender) profileParts.push(p.gender);
    if (p.age !== null) profileParts.push(`${p.age} y`);
    if (p.heightCm !== null) profileParts.push(`${p.heightCm} cm`);
    if (profileParts.length > 0) blocks.push(section('Profile', [profileParts.join(' | ')])!);
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
