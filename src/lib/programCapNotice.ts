import { resolveActiveProgramCap } from './activeProgramSet';

/**
 * How full the set of running programmes is, for the line the programme list
 * shows above itself.
 *
 * The cap was enforced and never mentioned until the try that failed, so the
 * reader met it as a refusal rather than as a number they had been watching
 * (user 2026-08-26).
 *
 * This began as a toast on every adoption and was the wrong shape twice over.
 * A popup that says what the screen behind it already shows is exactly what the
 * reader keeps asking to be rid of ("otit ohjelman käyttöön", #bugs
 * 2026-08-26); and a count nobody is near is a sign about nothing, which
 * teaches people to stop reading signs. So it lives on the list it describes,
 * and appears only once there is one place left. The point was never to
 * report — it was to stop the cap arriving as news.
 *
 * Two caps exist and only this one belongs here. `FREE_CUSTOM_PROGRAM_LIMIT`
 * counts programmes you have BUILT; this one counts programmes you are
 * RUNNING, and it is the one adopting spends.
 */

export interface ProgramCapState {
  used: number;
  cap: number;
  /** Every place taken: the next choice means dropping something. */
  atCap: boolean;
  /** One place left. The last moment a warning can still be useful. */
  lastPlace: boolean;
}

export interface ProgramCapStateInput {
  /** Ids running right now. */
  activePlanIds: readonly string[];
  proUnlocked: boolean;
}

export function describeProgramCap({ activePlanIds, proUnlocked }: ProgramCapStateInput): ProgramCapState {
  const cap = resolveActiveProgramCap(proUnlocked);
  // De-duplicated: the set is written that way everywhere, but a stored list
  // from an older build can still hold a repeat, and counting one twice would
  // tell a reader with one programme that they are full.
  const used = new Set(activePlanIds).size;
  return {
    used,
    cap,
    atCap: used >= cap,
    lastPlace: used === cap - 1,
  };
}

/**
 * The i18n key for the line, or null when there is nothing worth saying.
 *
 * Null is the common answer, and it is the whole design: a reader with one
 * programme of five places is not being warned about anything.
 */
export function programCapLineKey(state: ProgramCapState): 'atCap' | 'lastPlace' | null {
  if (state.atCap) {
    return 'atCap';
  }
  return state.lastPlace ? 'lastPlace' : null;
}
