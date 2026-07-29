import { buildAiCoachActions } from './aiCoachActions';
import { t } from './i18n';
import { AICoachAdvice, AICoachPlateauSummary, AICoachTrainingContext } from '../types/aiCoach';
import { AppLanguage } from '../types/models';

/**
 * The offline coach.
 *
 * This is not a fallback in practice — the endpoint is not deployed, so every
 * install answers from here. It shipped hardcoded in English inside a Finnish
 * app, which meant the paid feature spoke the wrong language to every user who
 * tried it. Every string now goes through the dictionary.
 *
 * The rules are the live coach's rules: no number that is not in the context,
 * no comment on a signal the window cannot support, and every answer says it
 * is a preview.
 */

function formatActiveContext(context: AICoachTrainingContext, language: AppLanguage) {
  if (!context.activeSession) return null;
  if (context.activeSession.nextExercise) {
    return t(language, 'coachPreview.nowNext', {
      title: context.activeSession.title,
      next: context.activeSession.nextExercise,
    });
  }
  return t(language, 'coachPreview.now', { title: context.activeSession.title });
}

function formatLiftLine(context: AICoachTrainingContext, language: AppLanguage) {
  const firstLift = context.trackedLifts[0];
  if (!firstLift) return null;
  const latest =
    firstLift.latestWeight !== null
      ? `${firstLift.latestWeight} ${context.unitPreference}`
      : t(language, 'coachPreview.noLoad');
  return `${firstLift.name}: ${latest} × ${firstLift.latestReps}`;
}

function formatTopSetLine(context: AICoachTrainingContext, language: AppLanguage) {
  const latestTopSet = context.latestTopSets[0];
  if (!latestTopSet) return null;
  const weight =
    latestTopSet.weight !== null
      ? `${latestTopSet.weight} ${context.unitPreference}`
      : t(language, 'coachPreview.noLoad');
  return `${latestTopSet.exerciseName}: ${weight} × ${latestTopSet.reps}`;
}

function formatRecentSessionLine(context: AICoachTrainingContext, language: AppLanguage) {
  const session = context.recentCompletedSessions[0];
  if (!session) return null;
  return t(language, 'coachPreview.last', { title: session.title });
}

function findMatchingPlateau(lower: string, context: AICoachTrainingContext) {
  return context.plateaus.find((p) => {
    if (lower.includes(p.exerciseKey)) return true;
    // match on any meaningful word in the exercise name (min 4 chars to avoid false positives)
    return p.name.toLowerCase().split(/\s+/).some((word) => word.length >= 4 && lower.includes(word));
  });
}

function plateauWeight(p: AICoachPlateauSummary, unit: string, language: AppLanguage) {
  return p.topWeightKg !== null ? `${p.topWeightKg} ${unit}` : t(language, 'coachPreview.sameWeight');
}

/** Finnish needs its own singular; one key per case is the only honest way. */
function sessionsWord(count: number, language: AppLanguage) {
  return count === 1
    ? t(language, 'coachPreview.sessionOne')
    : t(language, 'coachPreview.sessionMany', { count });
}

function previewAssumption(language: AppLanguage) {
  return t(language, 'coachPreview.assume.preview');
}

function buildCombinedResponse(
  prompt: string,
  plateau: AICoachPlateauSummary,
  context: AICoachTrainingContext,
  language: AppLanguage,
): AICoachAdvice {
  const { acwr, recoveryScore, signal } = context.fatigue;
  const weight = plateauWeight(plateau, context.unitPreference, language);
  return {
    takeaway: t(language, 'coachPreview.combined.takeaway', { lift: plateau.name }),
    why: [
      t(language, 'coachPreview.combined.why1', {
        lift: plateau.name,
        weight,
        count: plateau.stagnantSessions,
      }),
      t(language, 'coachPreview.combined.why2', { signal, acwr, recovery: recoveryScore }),
      t(language, 'coachPreview.combined.why3'),
    ],
    nextSteps: [
      t(language, 'coachPreview.combined.next1'),
      t(language, 'coachPreview.combined.next2', { lift: plateau.name }),
      t(language, 'coachPreview.combined.next3'),
    ],
    plan: [
      t(language, 'coachPreview.combined.plan1'),
      t(language, 'coachPreview.combined.plan2', { lift: plateau.name }),
      t(language, 'coachPreview.combined.plan3'),
    ],
    assumptions: [previewAssumption(language), t(language, 'coachPreview.assume.deload')],
    actions: buildAiCoachActions(prompt, context),
  };
}

function buildPlateauResponse(
  prompt: string,
  plateau: AICoachPlateauSummary,
  context: AICoachTrainingContext,
  language: AppLanguage,
): AICoachAdvice {
  const weight = plateauWeight(plateau, context.unitPreference, language);
  const extraPlateaus = context.plateaus.length - 1;
  return {
    takeaway: t(language, 'coachPreview.plateau.takeaway', {
      lift: plateau.name,
      count: plateau.stagnantSessions,
    }),
    why: [
      t(language, 'coachPreview.plateau.why1', { count: plateau.stagnantSessions, weight }),
      t(language, 'coachPreview.plateau.why2'),
      extraPlateaus > 0
        ? extraPlateaus === 1
          ? t(language, 'coachPreview.plateau.why3One')
          : t(language, 'coachPreview.plateau.why3Many', { count: extraPlateaus })
        : t(language, 'coachPreview.plateau.why3None', { count: context.sessionsThisWeek }),
    ],
    nextSteps: [
      t(language, 'coachPreview.plateau.next1', { lift: plateau.name }),
      t(language, 'coachPreview.plateau.next2'),
      t(language, 'coachPreview.plateau.next3'),
    ],
    plan: [
      t(language, 'coachPreview.plateau.plan1'),
      t(language, 'coachPreview.plateau.plan2'),
      t(language, 'coachPreview.plateau.plan3'),
    ],
    assumptions: [
      previewAssumption(language),
      t(language, 'coachPreview.assume.plateau', { count: plateau.stagnantSessions }),
    ],
    actions: buildAiCoachActions(prompt, context),
  };
}

function buildHighFatigueResponse(
  prompt: string,
  context: AICoachTrainingContext,
  language: AppLanguage,
): AICoachAdvice {
  const { acwr, recoveryScore, sessionCount7d, signal } = context.fatigue;
  return {
    takeaway: t(
      language,
      signal === 'high' ? 'coachPreview.fatigue.takeawayHigh' : 'coachPreview.fatigue.takeawayElevated',
    ),
    why: [
      t(language, 'coachPreview.fatigue.why1', { acwr, signal }),
      t(language, 'coachPreview.fatigue.why2', { recovery: recoveryScore }),
      t(language, 'coachPreview.fatigue.why3', { sessions: sessionsWord(sessionCount7d, language) }),
    ],
    nextSteps: [
      t(language, 'coachPreview.fatigue.next1'),
      t(language, 'coachPreview.fatigue.next2'),
      t(language, 'coachPreview.fatigue.next3'),
    ],
    plan: [
      t(language, 'coachPreview.fatigue.plan1'),
      t(language, 'coachPreview.fatigue.plan2'),
      t(language, 'coachPreview.fatigue.plan3'),
    ],
    assumptions: [previewAssumption(language), t(language, 'coachPreview.assume.volume28')],
    actions: buildAiCoachActions(prompt, context),
  };
}

export function buildAiCoachPreviewAnswer(
  prompt: string,
  context: AICoachTrainingContext,
  language: AppLanguage = 'en',
): AICoachAdvice {
  const lower = prompt.toLowerCase();
  const activeContext = formatActiveContext(context, language);
  const liftLine = formatLiftLine(context, language);
  const topSetLine = formatTopSetLine(context, language);
  const recentSessionLine = formatRecentSessionLine(context, language);

  // Only call the load high when the window actually supports it; otherwise a
  // first-ever workout reads as a 4x spike and the coach tells a beginner to
  // cut volume.
  const hasHighFatigue =
    context.fatigue.confident &&
    (context.fatigue.signal === 'elevated' || context.fatigue.signal === 'high');
  const hasPlateau = context.plateaus.length > 0;
  const primaryPlateau = context.plateaus[0];

  // Running questions bypass all context signals — different domain
  if (lower.includes('20 km') || lower.includes('juosta') || lower.includes('juoks') || lower.includes('run') || lower.includes('challenge')) {
    return {
      takeaway: t(language, 'coachPreview.run.takeaway'),
      why: [
        t(language, 'coachPreview.run.why1'),
        t(language, 'coachPreview.run.why2'),
        t(language, 'coachPreview.run.why3', { count: context.sessionsLast30Days }),
      ],
      nextSteps: [
        t(language, 'coachPreview.run.next1'),
        t(language, 'coachPreview.run.next2'),
        t(language, 'coachPreview.run.next3'),
      ],
      plan: [
        t(language, 'coachPreview.run.plan1'),
        t(language, 'coachPreview.run.plan2'),
        t(language, 'coachPreview.run.plan3'),
        t(language, 'coachPreview.run.plan4'),
      ],
      assumptions: [previewAssumption(language), t(language, 'coachPreview.assume.runBase')],
      actions: buildAiCoachActions(prompt, context),
    };
  }

  // Explicit recovery question: show detailed fatigue breakdown regardless of signal level
  if (lower.includes('palautu') || lower.includes('väsy') || lower.includes('recovery') || lower.includes('fatigue') || lower.includes('tired') || lower.includes('overtraining')) {
    const { signal, acwr, recoveryScore, sessionCount7d } = context.fatigue;
    const isHigh = signal === 'elevated' || signal === 'high';
    return {
      takeaway: t(
        language,
        isHigh
          ? 'coachPreview.recovery.takeawayHigh'
          : signal === 'undertrained'
            ? 'coachPreview.recovery.takeawayLow'
            : 'coachPreview.recovery.takeawayOk',
      ),
      why: [
        t(
          language,
          signal === 'high'
            ? 'coachPreview.recovery.why1High'
            : signal === 'elevated'
              ? 'coachPreview.recovery.why1Elevated'
              : signal === 'undertrained'
                ? 'coachPreview.recovery.why1Under'
                : 'coachPreview.recovery.why1Ok',
          { acwr },
        ),
        t(language, 'coachPreview.fatigue.why2', { recovery: recoveryScore }),
        t(language, 'coachPreview.recovery.why3', { sessions: sessionsWord(sessionCount7d, language) }),
      ],
      nextSteps: isHigh
        ? [
            t(language, 'coachPreview.recovery.highNext1'),
            t(language, 'coachPreview.recovery.highNext2'),
            t(language, 'coachPreview.recovery.highNext3'),
          ]
        : signal === 'undertrained'
          ? [
              t(language, 'coachPreview.recovery.lowNext1'),
              t(language, 'coachPreview.recovery.lowNext2'),
              t(language, 'coachPreview.recovery.lowNext3'),
            ]
          : [
              t(language, 'coachPreview.recovery.okNext1'),
              t(language, 'coachPreview.recovery.okNext2'),
              t(language, 'coachPreview.recovery.okNext3'),
            ],
      plan: isHigh
        ? [
            t(language, 'coachPreview.recovery.highPlan1'),
            t(language, 'coachPreview.recovery.highPlan2'),
            t(language, 'coachPreview.recovery.highPlan3'),
          ]
        : [t(language, 'coachPreview.recovery.okPlan1'), t(language, 'coachPreview.recovery.okPlan2')],
      assumptions: [previewAssumption(language), t(language, 'coachPreview.assume.volume')],
      actions: buildAiCoachActions(prompt, context),
    };
  }

  // Specific lift question — check for matching plateau, then fatigue
  if (lower.includes('bench') || lower.includes('penk') || lower.includes('squat') || lower.includes('kyyk') || lower.includes('deadlift') || lower.includes('maasta')) {
    const plateau = findMatchingPlateau(lower, context);

    if (plateau && hasHighFatigue) {
      return buildCombinedResponse(prompt, plateau, context, language);
    }

    if (plateau) {
      return buildPlateauResponse(prompt, plateau, context, language);
    }

    return {
      takeaway: t(language, 'coachPreview.lift.takeaway'),
      why: [
        t(language, 'coachPreview.lift.why1'),
        t(language, 'coachPreview.lift.why2', { count: context.sessionsThisWeek }),
        topSetLine ?? liftLine ?? t(language, 'coachPreview.lift.why3Fallback'),
      ],
      nextSteps: [
        t(language, 'coachPreview.lift.next1'),
        t(language, 'coachPreview.lift.next2'),
        t(language, 'coachPreview.lift.next3'),
      ],
      plan: [
        t(language, 'coachPreview.lift.plan1'),
        t(language, 'coachPreview.lift.plan2'),
        t(language, 'coachPreview.lift.plan3'),
      ],
      assumptions: [previewAssumption(language)],
      actions: buildAiCoachActions(prompt, context),
    };
  }

  // Context-priority for general questions: fires before program/default branches
  if (hasHighFatigue && hasPlateau) {
    return buildCombinedResponse(prompt, primaryPlateau, context, language);
  }

  if (hasHighFatigue) {
    return buildHighFatigueResponse(prompt, context, language);
  }

  if (hasPlateau) {
    return buildPlateauResponse(prompt, primaryPlateau, context, language);
  }

  // Program or split question — no urgent signals, give structural advice
  if (lower.includes('program') || lower.includes('ohjelma') || lower.includes('split') || lower.includes('treenijako')) {
    const plateauNames = context.plateaus.map((p) => p.name).join(', ');
    return {
      takeaway: t(language, 'coachPreview.program.takeaway'),
      why: [
        t(language, 'coachPreview.program.why1'),
        t(language, 'coachPreview.program.why2', { count: context.readyProgramCount }),
        plateauNames
          ? t(language, 'coachPreview.program.why3Stuck', { lifts: plateauNames })
          : (activeContext ?? recentSessionLine ?? t(language, 'coachPreview.program.why3Fallback')),
      ],
      nextSteps: [
        t(language, 'coachPreview.program.next1'),
        t(language, 'coachPreview.program.next2'),
        t(language, 'coachPreview.program.next3'),
      ],
      plan: [
        t(language, 'coachPreview.program.plan1'),
        t(language, 'coachPreview.program.plan2'),
        t(language, 'coachPreview.program.plan3'),
      ],
      assumptions: [previewAssumption(language)],
      actions: buildAiCoachActions(prompt, context),
    };
  }

  // Default — no signals, no keywords matched
  return {
    takeaway: t(language, 'coachPreview.default.takeaway'),
    why: [
      t(language, 'coachPreview.default.why1'),
      t(language, 'coachPreview.default.why2', {
        month: context.sessionsLast30Days,
        week: context.sessionsThisWeek,
      }),
      activeContext ?? recentSessionLine ?? t(language, 'coachPreview.default.why3Fallback'),
    ],
    nextSteps: [
      t(language, 'coachPreview.default.next1'),
      t(language, 'coachPreview.default.next2'),
      t(language, 'coachPreview.default.next3'),
    ],
    plan: [
      t(language, 'coachPreview.default.plan1'),
      t(language, 'coachPreview.default.plan2'),
      t(language, 'coachPreview.default.plan3'),
    ],
    assumptions: [previewAssumption(language)],
    actions: buildAiCoachActions(prompt, context),
  };
}
