import { WorkoutTemplateV1 } from '../features/workout/workoutTypes';
import { I18nKey } from './i18n';

/**
 * Recommendations that follow the program you actually chose.
 *
 * The old "For you" row had one source: the onboarding questionnaire. Skip the
 * questionnaire, or pick a ready program straight off the catalog, and the row
 * was empty forever — which is most people, because the reader had already told
 * us what they want by choosing a program. Choosing STRONG Starter is a
 * statement of intent every bit as strong as answering "strength" in a form,
 * and it is more recent.
 *
 * So this reads the active program and finds neighbours in the catalog. Every
 * suggestion carries the reason it is a neighbour, and the reason is derived
 * from fields the template really declares — goal, level, days per week — not
 * written per program by hand. A recommendation that cannot say why it is here
 * does not belong in the row.
 *
 * Deliberately NOT labelled AI. `aiInfo.never.2` says the model is never used
 * to pick a programme, and it is not: this is four comparisons and a sort.
 */

export type AffinityReason =
  /** Same goal, one level up — the obvious next block. */
  | 'nextLevel'
  /** Same goal, same level, a different split. */
  | 'sameGoalOtherSplit'
  /** Same days per week, different goal — fits the week you already train. */
  | 'sameDays'
  /** Same goal, fewer days — for a week that got busier. */
  | 'lighterWeek';

export interface AffinityMatch {
  templateId: string;
  reason: AffinityReason;
}

export const AFFINITY_REASON_KEYS: Record<AffinityReason, I18nKey> = {
  nextLevel: 'programs.affinity.nextLevel',
  sameGoalOtherSplit: 'programs.affinity.sameGoalOtherSplit',
  sameDays: 'programs.affinity.sameDays',
  lighterWeek: 'programs.affinity.lighterWeek',
};

const LEVEL_ORDER = ['beginner', 'intermediate', 'advanced'] as const;

function levelIndex(level: string | undefined): number {
  const index = LEVEL_ORDER.indexOf((level ?? '') as (typeof LEVEL_ORDER)[number]);
  return index === -1 ? 1 : index;
}

/**
 * Neighbours of the active program, best reason first.
 *
 * Reasons are ranked, not the programs: "the same goal one level up" is a
 * better thing to say than "this also runs three days a week", so every
 * nextLevel match is offered before any sameDays one. Within a reason the
 * catalog order stands — there is no score here to pretend otherwise.
 */
export function resolveProgramAffinity(
  activeTemplate: WorkoutTemplateV1 | null | undefined,
  catalog: readonly WorkoutTemplateV1[],
  limit = 4,
): AffinityMatch[] {
  if (!activeTemplate) {
    return [];
  }

  const activeLevel = levelIndex(activeTemplate.level);
  const buckets: Record<AffinityReason, string[]> = {
    nextLevel: [],
    sameGoalOtherSplit: [],
    sameDays: [],
    lighterWeek: [],
  };

  for (const template of catalog) {
    if (template.id === activeTemplate.id) {
      continue;
    }
    const sameGoal = template.goalType === activeTemplate.goalType;
    const level = levelIndex(template.level);

    if (sameGoal && level === activeLevel + 1) {
      buckets.nextLevel.push(template.id);
    } else if (sameGoal && level === activeLevel && template.daysPerWeek !== activeTemplate.daysPerWeek) {
      buckets.sameGoalOtherSplit.push(template.id);
    } else if (sameGoal && template.daysPerWeek < activeTemplate.daysPerWeek) {
      buckets.lighterWeek.push(template.id);
    } else if (!sameGoal && template.daysPerWeek === activeTemplate.daysPerWeek) {
      buckets.sameDays.push(template.id);
    }
  }

  const order: AffinityReason[] = ['nextLevel', 'sameGoalOtherSplit', 'lighterWeek', 'sameDays'];
  const matches: AffinityMatch[] = [];
  const seen = new Set<string>();

  // ONE card per reason. Two cards side by side carrying the identical
  // sentence — "Sama tavoite, taso ylöspäin" twice — reads as a rendering
  // fault, and a catalog with 21 hypertrophy programs would otherwise spend
  // every slot on "same goal, different split" and never reach the level-up
  // card. The row is at most four cards, and each says something different.
  const perReason = 1;
  for (const reason of order) {
    for (const templateId of buckets[reason].slice(0, perReason)) {
      if (seen.has(templateId) || matches.length >= limit) {
        continue;
      }
      seen.add(templateId);
      matches.push({ templateId, reason });
    }
  }

  return matches.slice(0, limit);
}
