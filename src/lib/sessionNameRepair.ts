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

/**
 * The candidate localized EXCEPT its last segment, which stays English.
 *
 * The wound is mixed-language: the clip happened in the English source
 * ("Full Body + C...") and the duplication then localized what it could,
 * leaving "Koko keho + C..." in the store. Its stem matches neither the
 * English candidate (F ≠ K) nor the full Finnish one ("Koko keho +
 * Kiertoharjoittelu", K ≠ C) — only this half-translated form does.
 */
function headLocalized(focus: string): string {
  const parts = focus.split(/(\s*[&+/]\s*)/);
  const lastIndex = parts.length - 1;
  return parts
    .map((part, index) =>
      /^\s*[&+/]\s*$/.test(part) || index === lastIndex ? part : localizeWorkoutFocus(part, 'fi'),
    )
    .join('');
}

let candidateCache: string[] | null = null;

/** Every catalog session focus — English, Finnish, and head-localized. */
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
      for (const form of [focus, localizeWorkoutFocus(focus, 'fi'), headLocalized(focus)]) {
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
  // Two OR more dots: the wound on the user's phone was transcribed as both
  // "H..." and "H..", and requiring exactly three left the two-dot form
  // uncured through a whole build (2026-08-25). One dot stays a sentence end.
  const cut = trimmed.match(/^(.*?)\s*(?:\.{2,}|…)$/);
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
