import { resolveActiveProgramCap } from './activeProgramSet';

/**
 * What to say about the programme limit at the moment a programme is taken on.
 *
 * The cap existed and was enforced, but the reader met it exactly once: as a
 * wall, on the try that failed. Everything before that was silent, so the
 * limit came as news at the worst possible moment (user 2026-08-26).
 *
 * The counter is attached to the ACT rather than parked on a screen. An
 * always-visible "1/2" is a sign about a limit nobody is near — noise that
 * teaches the reader to stop reading signs. Adopting a programme is rare and
 * is the one moment the number means something, so that is where it goes.
 *
 * Two caps exist and only this one belongs here. `FREE_CUSTOM_PROGRAM_LIMIT`
 * counts programmes you have BUILT; this one counts programmes you are
 * RUNNING, and it is the one adopting spends. Quoting both at once would make
 * the reader hold two numbers to understand one action.
 */

export interface ProgramCapNotice {
  /** Programmes running after this one is taken on. */
  used: number;
  cap: number;
  /**
   * True on the reader's first programme, when the number needs saying in
   * words rather than as a fraction.
   *
   * Read off the set rather than stored as a flag: "this is your first" is a
   * fact about right now, and a reader who dropped everything and started
   * again is having a first programme again. A stored flag would also need a
   * migration to say something the data already knows.
   */
  explain: boolean;
  /** True when this fills the last place — the next choice is a decision. */
  atCap: boolean;
}

export interface ProgramCapNoticeInput {
  /** Ids already running, BEFORE this adoption. */
  activePlanIds: readonly string[];
  proUnlocked: boolean;
}

export function buildProgramCapNotice({
  activePlanIds,
  proUnlocked,
}: ProgramCapNoticeInput): ProgramCapNotice {
  const cap = resolveActiveProgramCap(proUnlocked);
  // The set is de-duplicated wherever it is written, but a stored list from an
  // older build can still hold a repeat, and counting one twice would tell the
  // reader they are full when they are not.
  const before = new Set(activePlanIds).size;
  // What it will be once this one is in. The reader is told the state they are
  // about to be in, not the one they are leaving.
  const used = Math.min(before + 1, cap);
  return {
    used,
    cap,
    explain: before === 0,
    // Only worth flagging when there is a place to lose. A Pro reader with
    // five is at the cap too, and telling them to upgrade would be selling
    // them what they own — the caller says "drop one", never "buy".
    atCap: used >= cap,
  };
}

/** The i18n key the notice should be spoken with. */
export function programCapNoticeKey(notice: ProgramCapNotice): 'first' | 'last' | 'count' {
  if (notice.explain) {
    return 'first';
  }
  return notice.atCap ? 'last' : 'count';
}
