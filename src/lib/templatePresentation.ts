import { WorkoutTemplateV1 } from '../features/workout/workoutTypes';
import { AppLanguage } from '../types/models';
import { formatWorkoutDisplayLabel } from './displayLabel';
import { I18nKey, t } from './i18n';
import { getReadyProgramContent } from './readyProgramContent';

export interface CustomTemplatePresentationInput {
  name: string;
  sessionCount: number;
  exerciseCount: number;
}

export interface TemplatePresentation {
  title: string;
  subtitle: string;
  tags: string[];
}

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function includesAny(value: string, terms: string[]) {
  return terms.some((term) => value.includes(term));
}

function dedupeTags(tags: string[]) {
  return [...new Set(tags)].slice(0, 3);
}

/**
 * Custom programs are named by the user, so the shape of the week is inferred
 * from that name. Titles and blurbs come from the dictionary; the user's own
 * name is only replaced when the inference is confident enough to name a shape.
 */
export function getCustomTemplatePresentation(
  template: CustomTemplatePresentationInput,
  language: AppLanguage = 'en',
): TemplatePresentation {
  const normalized = normalize(template.name);

  const isUpper = includesAny(normalized, ['upper', 'ylä', 'yla', 'push', 'chest', 'back', 'shoulder', 'arms']);
  const isLower = includesAny(normalized, ['lower', 'ala', 'legs', 'leg', 'glute', 'quad', 'hamstring']);
  const isFullBody = includesAny(normalized, ['full body', 'fullbody', 'koko', 'body']);
  const isHeavy = includesAny(normalized, ['heavy', 'strength', 'voima', 'power']);
  const isPump = includesAny(normalized, ['pump', 'volume', 'mass', 'hypertrophy', 'growth']);
  const isRun = includesAny(normalized, ['run', 'running', 'tempo', 'cardio', 'conditioning']);
  const isGlutes = includesAny(normalized, ['glute', 'glutes', 'pakara']);
  const isChest = includesAny(normalized, ['chest', 'rinta', 'bench', 'penk']);
  const isBack = includesAny(normalized, ['back', 'row', 'pull', 'selkä', 'selka']);

  let title = formatWorkoutDisplayLabel(template.name, t(language, 'prog.custom.fallbackName'));
  let subtitle = t(language, 'prog.custom.counts', {
    sessions: template.sessionCount,
    exercises: template.exerciseCount,
  });
  const tagKeys: I18nKey[] = [];

  if (isUpper) {
    tagKeys.push('prog.tag.upper');
  } else if (isLower) {
    tagKeys.push('prog.tag.lower');
  } else if (isFullBody) {
    tagKeys.push('prog.tag.fullBody');
  }

  if (isGlutes) {
    tagKeys.push('prog.tag.glutes');
  } else if (isChest) {
    tagKeys.push('prog.tag.chest');
  } else if (isBack) {
    tagKeys.push('prog.tag.back');
  } else if (isRun) {
    tagKeys.push('prog.tag.conditioning');
  }

  if (isHeavy) {
    tagKeys.push('prog.tag.heavy');
  } else if (isPump) {
    tagKeys.push('prog.tag.mass');
  }

  /** Named shapes, most specific first — the first match wins. */
  const shape =
    [
      { when: isUpper && isHeavy, slug: 'upperHeavy' },
      { when: isUpper && isPump, slug: 'upperPump' },
      { when: isLower && isHeavy, slug: 'lowerHeavy' },
      { when: isLower && isPump, slug: 'lowerPump' },
      { when: isGlutes && isPump, slug: 'gluteGrowth' },
      { when: isChest && isPump, slug: 'chestBuilder' },
      { when: isChest && isHeavy, slug: 'pressFocus' },
      { when: isBack && isPump, slug: 'backDensity' },
      { when: isRun, slug: 'conditioning' },
      { when: isFullBody && isHeavy, slug: 'fullBodyStrength' },
      { when: isFullBody && isPump, slug: 'fullBodyVolume' },
    ].find((entry) => entry.when) ?? null;

  if (shape) {
    title = t(language, `prog.custom.${shape.slug}.title` as I18nKey);
    subtitle = t(language, `prog.custom.${shape.slug}.sub` as I18nKey);
  } else if (template.sessionCount >= 4) {
    subtitle = t(language, 'prog.custom.sub.fourPlus');
  } else if (template.sessionCount === 3) {
    subtitle = t(language, 'prog.custom.sub.three');
  }

  return {
    title,
    subtitle,
    tags: dedupeTags(tagKeys.map((key) => t(language, key))),
  };
}

/**
 * Curated presentation for the ready programs. The family name (STRONG, HUGE,
 * FIT…) is the product's own, so only the blurb and tags are translated.
 */
const READY_TEMPLATE_PRESENTATION: Record<string, { title: string; tagKeys: I18nKey[] }> = {
  tpl_2_day_beginner_strength_v1: {
    title: 'STRONG Starter',
    tagKeys: ['prog.tag.strength', 'prog.tag.beginner'],
  },
  tpl_2_day_minimal_full_body_v1: {
    title: 'HOME Starter',
    tagKeys: ['prog.tag.fullBody', 'prog.tag.minimal'],
  },
  tpl_2_day_mobility_reset_v1: {
    title: 'RESET',
    tagKeys: ['prog.tag.recovery', 'prog.tag.mobility'],
  },
  tpl_2_day_yoga_recovery_v1: {
    title: 'RESET Yoga',
    tagKeys: ['prog.tag.recovery', 'prog.tag.yoga'],
  },
  tpl_3_day_full_body_v1: {
    title: 'FIT',
    tagKeys: ['prog.tag.fullBody', 'prog.tag.balanced'],
  },
  tpl_3_day_strength_base_v1: {
    title: 'STRONG',
    tagKeys: ['prog.tag.strength', 'prog.tag.heavy'],
  },
  tpl_3_day_upper_lower_lite_v1: {
    title: 'FIT Lite',
    tagKeys: ['prog.tag.upperLower', 'prog.tag.balanced'],
  },
  tpl_3_day_push_pull_legs_v1: {
    title: 'HUGE',
    tagKeys: ['prog.tag.ppl', 'prog.tag.mass'],
  },
  tpl_3_day_run_mobility_v1: {
    title: 'RUN',
    tagKeys: ['prog.tag.conditioning', 'prog.tag.recovery'],
  },
  tpl_4_day_upper_lower_v1: {
    title: 'HUGE Pro',
    tagKeys: ['prog.tag.upperLower', 'prog.tag.mass'],
  },
  tpl_4_day_muscle_builder_v1: {
    title: 'HUGE Builder',
    tagKeys: ['prog.tag.mass', 'prog.tag.growth'],
  },
  tpl_4_day_powerbuilding_v1: {
    title: 'POWERBUILD',
    tagKeys: ['prog.tag.strength', 'prog.tag.mass'],
  },
  tpl_4_day_strength_size_v1: {
    title: 'STRONG Pro',
    tagKeys: ['prog.tag.strength', 'prog.tag.size'],
  },
  tpl_5_day_hybrid_v1: {
    title: 'HUGE Advanced',
    tagKeys: ['prog.tag.hybrid', 'prog.tag.mass'],
  },
};

/** Day counts on the curated cards, e.g. "3 Days" / "3 pv". */
const CURATED_DAYS: Record<string, number> = {
  tpl_2_day_beginner_strength_v1: 2,
  tpl_2_day_minimal_full_body_v1: 2,
  tpl_2_day_mobility_reset_v1: 2,
  tpl_2_day_yoga_recovery_v1: 2,
  tpl_3_day_full_body_v1: 3,
  tpl_3_day_strength_base_v1: 3,
  tpl_3_day_upper_lower_lite_v1: 3,
  tpl_3_day_push_pull_legs_v1: 3,
  tpl_3_day_run_mobility_v1: 3,
  tpl_4_day_upper_lower_v1: 4,
  tpl_4_day_muscle_builder_v1: 4,
  tpl_4_day_powerbuilding_v1: 4,
  tpl_4_day_strength_size_v1: 4,
  tpl_5_day_hybrid_v1: 5,
};

function formatSplitTagKey(template: WorkoutTemplateV1): I18nKey {
  if (template.splitType === 'upper_lower') {
    return 'prog.tag.upperLower';
  }

  if (template.splitType === 'full_body') {
    return 'prog.tag.fullBody';
  }

  return 'prog.tag.hybrid';
}

function formatGoalTagKey(template: WorkoutTemplateV1): I18nKey {
  if (template.goalType === 'strength') {
    return 'prog.tag.strength';
  }

  if (template.goalType === 'hypertrophy') {
    return 'prog.tag.mass';
  }

  return 'prog.tag.balanced';
}

export function getReadyTemplatePresentation(
  template: WorkoutTemplateV1,
  language: AppLanguage = 'en',
): TemplatePresentation {
  const curated = READY_TEMPLATE_PRESENTATION[template.id];
  if (curated) {
    return {
      title: curated.title,
      subtitle: t(language, `prog.sub.${template.id}` as I18nKey),
      tags: dedupeTags([
        ...curated.tagKeys.map((key) => t(language, key)),
        t(language, 'prog.tag.days', { count: CURATED_DAYS[template.id] ?? template.daysPerWeek }),
      ]),
    };
  }

  const content = getReadyProgramContent(template.id, language);

  return {
    title: formatWorkoutDisplayLabel(template.name, t(language, 'prog.custom.fallbackName')),
    subtitle:
      content?.summary ?? t(language, 'prog.sub.fallback', { days: template.daysPerWeek, goal: template.goalType }),
    tags: dedupeTags([
      t(language, formatSplitTagKey(template)),
      t(language, formatGoalTagKey(template)),
      t(language, 'prog.tag.days', { count: template.daysPerWeek }),
    ]),
  };
}
