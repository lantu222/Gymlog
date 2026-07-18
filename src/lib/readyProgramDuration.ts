import { WorkoutTemplateV1 } from '../features/workout/workoutTypes';

/**
 * Catalog block-length rule (user decision 2026-07-18): ready programs run
 * 4–12 weeks, scaled by tier — Amateur blocks stay short and repeatable,
 * Pro blocks run a full cycle. A template can override with its own
 * `blockLengthWeeks`; the rule is the default, not a cage.
 *
 *   beginner      → 4 weeks   (UI tier: Beginner / Amateur)
 *   intermediate  → 8 weeks   (UI tier: Advanced)
 *   advanced      → 12 weeks  (UI tier: Pro)
 */
const BLOCK_WEEKS_BY_LEVEL: Record<WorkoutTemplateV1['level'], number> = {
  beginner: 4,
  intermediate: 8,
  advanced: 12,
};

export const READY_PROGRAM_MIN_BLOCK_WEEKS = 4;
export const READY_PROGRAM_MAX_BLOCK_WEEKS = 12;

export function getReadyProgramBlockWeeks(
  template: Pick<WorkoutTemplateV1, 'level' | 'blockLengthWeeks'>,
): number {
  const override = template.blockLengthWeeks;
  if (typeof override === 'number' && override >= READY_PROGRAM_MIN_BLOCK_WEEKS && override <= READY_PROGRAM_MAX_BLOCK_WEEKS) {
    return override;
  }

  return BLOCK_WEEKS_BY_LEVEL[template.level] ?? READY_PROGRAM_MIN_BLOCK_WEEKS;
}
