import { WorkoutTemplateV1 } from '../features/workout/workoutTypes';

/**
 * How long a ready program runs (user decision 2026-08-23: nothing is offered
 * as a four-week block any more — either it runs 8-12 weeks or it is not in
 * the catalog).
 *
 * Four weeks was too short to be a block. A beginner has barely stopped
 * thinking about the movement by the time the programme claims to be over,
 * and the number invited the reader to judge the app by a month that never
 * changed anything.
 *
 * Amateur length is a *dose*, not a date. A first block has done its job after
 * roughly 24 sessions, so the calendar follows the weekly frequency rather
 * than the tier: two sessions a week needs twice the weeks of four. The tiers
 * above already train densely enough that their own tier length holds.
 *
 *   Amateur (beginner)      → 24 sessions' worth, kept inside the band
 *   Advanced (intermediate) → 8 weeks
 *   Pro (advanced)          → 12 weeks
 *
 * A template can still override with its own `blockLengthWeeks`; the rule is
 * the default, not a cage. Overrides outside the band are ignored, so the
 * floor cannot be reopened one template at a time.
 */
const BLOCK_WEEKS_BY_LEVEL: Record<WorkoutTemplateV1['level'], number> = {
  beginner: 8,
  intermediate: 8,
  advanced: 12,
};

/**
 * Sessions a first block delivers before it has done its job.
 *
 * 24 is what makes 3×/week land on 8 and 2×/week land on 12 — the two shapes
 * most of the Amateur tier actually has. Denser weeks reach it sooner and are
 * held at the floor, because a block shorter than eight weeks is the thing
 * this rule exists to prevent.
 */
const BEGINNER_BLOCK_SESSIONS = 24;

export const READY_PROGRAM_MIN_BLOCK_WEEKS = 8;
export const READY_PROGRAM_MAX_BLOCK_WEEKS = 12;

function clampToBand(weeks: number): number {
  return Math.min(READY_PROGRAM_MAX_BLOCK_WEEKS, Math.max(READY_PROGRAM_MIN_BLOCK_WEEKS, weeks));
}

export function getReadyProgramBlockWeeks(
  template: Pick<WorkoutTemplateV1, 'level' | 'blockLengthWeeks' | 'sessions'>,
): number {
  const override = template.blockLengthWeeks;
  if (typeof override === 'number' && override >= READY_PROGRAM_MIN_BLOCK_WEEKS && override <= READY_PROGRAM_MAX_BLOCK_WEEKS) {
    return override;
  }

  if (template.level === 'beginner') {
    const sessionsPerWeek = template.sessions?.length ?? 0;
    if (sessionsPerWeek > 0) {
      return clampToBand(Math.ceil(BEGINNER_BLOCK_SESSIONS / sessionsPerWeek));
    }
  }

  return BLOCK_WEEKS_BY_LEVEL[template.level] ?? READY_PROGRAM_MIN_BLOCK_WEEKS;
}
