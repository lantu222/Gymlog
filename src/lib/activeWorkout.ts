/**
 * Whether a held session is a workout to go back to.
 *
 * A session left as 'completed' is a finished one still held until its summary clears it (an
 * install from before the finish cleared it at once can hold one for good). It is not running:
 * Start has to start, and no button may offer to resume it. navigateToActiveWorkout (App.tsx)
 * refuses it, so every caller that decides whether to take the resume path has to ask this same
 * question, or its tap dead-ends on the refusal: the widget tile and the cardio screen's resume
 * sheet each tested only "is there a session" (bug hunt 2026-10-03).
 *
 * Paused counts: it is still a session the button resumes.
 */
export function isWorkoutInProgress(session: { status: string } | null | undefined): boolean {
  return session != null && session.status !== 'completed';
}
