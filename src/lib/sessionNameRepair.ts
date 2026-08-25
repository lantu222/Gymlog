import { WORKOUT_TEMPLATES_V1 } from '../features/workout/workoutCatalog';
import { localizeWorkoutFocus } from './sessionNameLabel';

/**
 * Completing a session name that was SAVED already truncated.
 *
 * Found on a real phone (2026-08-25): the user's own programme carried days
 * literally named "… + H..." and "… + C...". Every display-side fix bounced
 * off it — prefixes were stripped, lines were widened, fonts shrank, and the
 * ellipsis stayed, because the three dots were in the stored string. The
 * chase is written up in the day's commits; the short version is that a name
 * clipped at creation cannot be un-clipped by any renderer.
 *
 * The lost letters are recoverable, though: composed programmes take their
 * day names from catalog sessions, so the visible stem is a prefix of a name
 * the catalog still holds in full. "Full Body + H..." has exactly one
 * completion among the catalog's session focuses ("Full Body + HIIT"), and
 * the Finnish-saved form matches the same way through the localizer.
 *
 * Only an UNAMBIGUOUS completion is applied. A stem matching two catalog
 * names, or none, keeps its ellipsis — an honest "..." beats a guessed name.
 */

/** "Day 1: Full Body + HIIT" → "Full Body + HIIT"; bare names pass through. */
function focusOf(name: string): string {
  const match = name.trim().match(/^(?:.*?\b(?:Day|Päivä)\s+\d+\s*:\s*)?(.*)$/i);
  return (match?.[1] ?? '').trim();
}

let candidateCache: string[] | null = null;

/** Every catalog session focus, in English and in Finnish, deduplicated. */
function candidates(): string[] {
  if (candidateCache) {
    return candidateCache;
  }
  const seen = new Set<string>();
  const out: string[] = [];
  for (const template of WORKOUT_TEMPLATES_V1) {
    for (const session of template.sessions) {
      const focus = focusOf(session.name);
      if (!focus) {
        continue;
      }
      for (const form of [focus, localizeWorkoutFocus(focus, 'fi')]) {
        const key = form.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          out.push(form);
        }
      }
    }
  }
  candidateCache = out;
  return out;
}

export function repairTruncatedSessionName(name: string): string {
  const trimmed = name.trim();
  const cut = trimmed.match(/^(.*?)(?:\.{3}|…)$/);
  if (!cut) {
    return name;
  }

  const stem = cut[1].trimEnd();
  const dayPrefix = stem.match(/^(.*?\b(?:Day|Päivä)\s+\d+\s*:\s*)(.*)$/i);
  const prefix = dayPrefix ? dayPrefix[1] : '';
  const focusStem = (dayPrefix ? dayPrefix[2] : stem).trim();
  if (!focusStem) {
    return name;
  }

  const needle = focusStem.toLowerCase();
  const completions = candidates().filter((candidate) => candidate.toLowerCase().startsWith(needle));
  if (completions.length !== 1) {
    return name;
  }
  return `${prefix}${completions[0]}`;
}
