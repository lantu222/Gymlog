import { WorkoutTemplateV1 } from '../features/workout/workoutTypes';
import { formatWorkoutDisplayLabel } from './displayLabel';
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

export function getCustomTemplatePresentation(template: CustomTemplatePresentationInput): TemplatePresentation {
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

  let title = formatWorkoutDisplayLabel(template.name, 'Template');
  let subtitle = `${template.sessionCount} sessions · ${template.exerciseCount} exercises`;
  const tags: string[] = [];

  if (isUpper) {
    tags.push('Upper');
  } else if (isLower) {
    tags.push('Lower');
  } else if (isFullBody) {
    tags.push('Full Body');
  }

  if (isGlutes) {
    tags.push('Glutes');
  } else if (isChest) {
    tags.push('Chest');
  } else if (isBack) {
    tags.push('Back');
  } else if (isRun) {
    tags.push('Conditioning');
  }

  if (isHeavy) {
    tags.push('Heavy');
  } else if (isPump) {
    tags.push('Mass');
  }

  if (isUpper && isHeavy) {
    title = 'Upper Heavy';
    subtitle = 'Big presses and upper-body compounds.';
  } else if (isUpper && isPump) {
    title = 'Upper Pump';
    subtitle = 'Chest, delts, arms, and more volume.';
  } else if (isLower && isHeavy) {
    title = 'Lower Heavy';
    subtitle = 'Squat, hinge, and lower-body strength.';
  } else if (isLower && isPump) {
    title = 'Lower Pump';
    subtitle = 'Glutes, quads, and volume work.';
  } else if (isGlutes && isPump) {
    title = 'Glute Growth';
    subtitle = 'Glute-focused work with higher volume.';
  } else if (isChest && isPump) {
    title = 'Chest Builder';
    subtitle = 'Pressing and chest volume that adds up.';
  } else if (isChest && isHeavy) {
    title = 'Press Focus';
    subtitle = 'Heavy pressing and clean upper-body work.';
  } else if (isBack && isPump) {
    title = 'Back Density';
    subtitle = 'Rows, pulldowns, and back volume that sticks.';
  } else if (isRun) {
    title = 'Conditioning Block';
    subtitle = 'Pace, engine, and movement work.';
  } else if (isFullBody && isHeavy) {
    title = 'Full Body Strength';
    subtitle = 'Compounds first, accessories after.';
  } else if (isFullBody && isPump) {
    title = 'Full Body Volume';
    subtitle = 'More total work across the whole body.';
  } else if (template.sessionCount >= 4) {
    subtitle = 'A fuller weekly split with room to rotate focus.';
  } else if (template.sessionCount === 3) {
    subtitle = 'A balanced weekly split you can repeat cleanly.';
  }

  return {
    title,
    subtitle,
    tags: dedupeTags(tags),
  };
}

const READY_TEMPLATE_PRESENTATION: Record<string, TemplatePresentation> = {
  tpl_2_day_beginner_strength_v1: {
    title: 'Strength Kickoff',
    subtitle: 'Simple barbell progress with low weekly friction.',
    tags: ['Strength', 'Beginner', '2 Days'],
  },
  tpl_2_day_minimal_full_body_v1: {
    title: 'Minimal Full Body',
    subtitle: 'Two efficient sessions that still cover the big patterns.',
    tags: ['Full Body', 'Minimal', '2 Days'],
  },
  tpl_2_day_mobility_reset_v1: {
    title: 'Mobility Reset',
    subtitle: 'Low-stress movement, recovery, and breathing work.',
    tags: ['Recovery', 'Mobility', '2 Days'],
  },
  tpl_2_day_yoga_recovery_v1: {
    title: 'Yoga Recovery',
    subtitle: 'A calmer reset block for movement quality and breathing.',
    tags: ['Recovery', 'Yoga', '2 Days'],
  },
  tpl_3_day_full_body_v1: {
    title: 'Full Body Base',
    subtitle: 'Frequent practice on the main lifts without overcomplicating the week.',
    tags: ['Full Body', 'Balanced', '3 Days'],
  },
  tpl_3_day_strength_base_v1: {
    title: 'Strength Base',
    subtitle: 'Heavy enough to progress, simple enough to repeat.',
    tags: ['Strength', 'Heavy', '3 Days'],
  },
  tpl_3_day_upper_lower_lite_v1: {
    title: 'Upper Lower Lite',
    subtitle: 'A softer split that keeps the week moving without long sessions.',
    tags: ['Upper/Lower', 'Balanced', '3 Days'],
  },
  tpl_3_day_push_pull_legs_v1: {
    title: 'Push Pull Legs',
    subtitle: 'Classic body-part rhythm with cleaner progression rails.',
    tags: ['PPL', 'Mass', '3 Days'],
  },
  tpl_3_day_run_mobility_v1: {
    title: 'Run + Mobility',
    subtitle: 'Conditioning blocks with a built-in reset day.',
    tags: ['Conditioning', 'Recovery', '3 Days'],
  },
  tpl_4_day_upper_lower_v1: {
    title: 'Upper Lower Mass',
    subtitle: 'A balanced four-day split built around repeatable growth work.',
    tags: ['Upper/Lower', 'Mass', '4 Days'],
  },
  tpl_4_day_muscle_builder_v1: {
    title: 'Muscle Builder',
    subtitle: 'A more approachable growth split with enough total weekly work.',
    tags: ['Mass', 'Growth', '4 Days'],
  },
  tpl_4_day_powerbuilding_v1: {
    title: 'Powerbuilding',
    subtitle: 'Strength-first early week, bodybuilding volume later.',
    tags: ['Strength', 'Mass', '4 Days'],
  },
  tpl_4_day_strength_size_v1: {
    title: 'Strength + Size',
    subtitle: 'Performance days up front, growth days behind them.',
    tags: ['Strength', 'Size', '4 Days'],
  },
  tpl_5_day_hybrid_v1: {
    title: 'Hybrid Builder',
    subtitle: 'More weekly frequency for lifters who recover well.',
    tags: ['Hybrid', 'Mass', '5 Days'],
  },
};

function formatSplitTag(template: WorkoutTemplateV1) {
  if (template.splitType === 'upper_lower') {
    return 'Upper/Lower';
  }

  if (template.splitType === 'full_body') {
    return 'Full Body';
  }

  return 'Hybrid';
}

function formatGoalTag(template: WorkoutTemplateV1) {
  if (template.goalType === 'strength') {
    return 'Strength';
  }

  if (template.goalType === 'hypertrophy') {
    return 'Mass';
  }

  return 'Balanced';
}

export function getReadyTemplatePresentation(template: WorkoutTemplateV1): TemplatePresentation {
  const curated = READY_TEMPLATE_PRESENTATION[template.id];
  if (curated) {
    return curated;
  }

  const content = getReadyProgramContent(template.id);

  return {
    title: formatWorkoutDisplayLabel(template.name, 'Template'),
    subtitle: content?.summary ?? `${template.daysPerWeek} training days built around ${template.goalType} work.`,
    tags: dedupeTags([formatSplitTag(template), formatGoalTag(template), `${template.daysPerWeek} Days`]),
  };
}
