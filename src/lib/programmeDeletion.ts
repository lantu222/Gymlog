/**
 * Whether a programme can be deleted right now.
 *
 * Not while a workout of it is on the clock. The guided player is routed by
 * its programme's id, and the route guard sends a route whose programme no
 * longer exists back to the list — so deleting your own programme with one of
 * its days running locked the reader out of that session. Home's "Resume",
 * the lock-screen card and every programme's "Start" go through the same
 * redirect to the running session and bounced off the same guard: the sets
 * logged so far could never be saved, and no programme session could start
 * while it sat there (live-session audit, 2026-09-20).
 *
 * Refusing is the answer that loses nothing. Deleting anyway and letting the
 * session outlive its programme would need the player, the save and the
 * programme pages to agree on a programme that is gone; saying no takes one
 * sentence, and the delete goes through once the workout is saved or
 * discarded. A finished session waiting on its summary is already saved, and
 * does not hold the programme.
 */
export function liveSessionBlocksProgrammeDelete(
  activeSession: { templateId: string; status: string } | null | undefined,
  workoutTemplateId: string,
): boolean {
  return Boolean(
    activeSession && activeSession.templateId === workoutTemplateId && activeSession.status !== 'completed',
  );
}
