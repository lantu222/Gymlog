/**
 * "Do I already have my own version of this ready programme?"
 *
 * Two things in this app make a copy of a catalog programme. Editing a lift in
 * one forks it, and that fork records where it came from — `sourceTemplateId`,
 * see programLineage. Onboarding makes one too: the questionnaire fits the
 * recommended programme to the answers, and what the reader trains is that
 * fitted copy, saved as a programme of their own. That copy recorded nothing,
 * so nothing downstream could tell it apart from a programme typed in by hand
 * (audit round 4, 2026-09-20). The catalog page went on showing the composed
 * week while its buttons worked on the untouched original: the day editor could
 * not find the copy and made a second one, and "Take this programme" adopted the
 * catalog version beside the copy the reader was already training.
 *
 * The link is written now — onboarding's draft carries `sourceTemplateId` like
 * any other copy — and this module is the one place that asks the question, so
 * no screen has to know how copying works.
 *
 * Installs made before the link existed still have a copy with no field on it,
 * and they are the installs the bug was reported from. Those copies are
 * knowable anyway: composing renames every day, and the names it gives carry
 * the programme they were composed from — `onboarding_<programme id>_<n>`, see
 * programDayComposer. That is the fallback, and it reads a day id rather than
 * a programme name, so it does not care what language the copy was made in.
 */

/** Only the fields the question is asked of. The stored template carries more. */
export interface ProgrammeCopyTemplate {
  id: string;
  sourceTemplateId?: string | null;
  sessions?: readonly { id: string }[];
}

/**
 * The day ids a composed week of this programme carries.
 *
 * `onboarding_` alone would be ambiguous — every composed week starts that way
 * — so the programme id is part of the test. It is not the whole test: what
 * follows this prefix has to be the day's number, or a programme whose id
 * merely begins with another's would answer for it.
 */
export function onboardingSessionIdPrefix(readyTemplateId: string): string {
  return `onboarding_${readyTemplateId}_`;
}

/** Whether this stored template is the reader's own version of that programme. */
export function isCopyOfReadyProgramme(
  template: ProgrammeCopyTemplate,
  readyTemplateId: string,
): boolean {
  if (template.id === readyTemplateId) {
    return false;
  }
  if (template.sourceTemplateId === readyTemplateId) {
    return true;
  }
  const prefix = onboardingSessionIdPrefix(readyTemplateId);
  // The day number has to be a day number. A prefix test on its own read the
  // first day of a composed "tpl_strong_starter_v2" as a copy of
  // "tpl_strong_starter", which is a different programme with a shorter name.
  return (template.sessions ?? []).some(
    (session) => session.id.startsWith(prefix) && /^[0-9]+$/.test(session.id.slice(prefix.length)),
  );
}

/**
 * The reader's own version of a ready programme, or null.
 *
 * The first one, in stored order. A reader can end up with two — a copy from
 * onboarding and a fork of the same programme made later — and this answers
 * with the older, which is the one the plans point at.
 */
export function findReadyProgrammeCopyId(
  readyTemplateId: string,
  templates: readonly ProgrammeCopyTemplate[],
): string | null {
  return templates.find((template) => isCopyOfReadyProgramme(template, readyTemplateId))?.id ?? null;
}

/**
 * The catalog programme a stored template is a copy of, or null.
 *
 * The other direction, for the questions asked programme-first: is this thing
 * the reader is running the same programme as that card. Only ids the caller
 * offers count, so a link to a programme the catalog no longer has answers
 * null rather than naming a ghost.
 */
export function resolveSourceReadyProgrammeId(
  template: ProgrammeCopyTemplate,
  readyTemplateIds: readonly string[],
): string | null {
  if (template.sourceTemplateId && readyTemplateIds.includes(template.sourceTemplateId)) {
    return template.sourceTemplateId;
  }
  return readyTemplateIds.find((readyId) => isCopyOfReadyProgramme(template, readyId)) ?? null;
}

/**
 * Every programme the reader is running, named the way the catalog names it.
 *
 * "Sinulle" drops what you already run, by template id — and the id of a copy
 * is not the id of the programme it is a copy of, so the row went on
 * recommending the very programme the questionnaire had just handed over. The
 * ids come back with the copies' own ids kept: the caller is testing
 * membership, and both names of one programme are true.
 */
export function expandRunningIdsWithSources(
  runningTemplateIds: readonly string[],
  templates: readonly ProgrammeCopyTemplate[],
  readyTemplateIds: readonly string[],
): string[] {
  const ids: string[] = [];
  const add = (id: string) => {
    if (!ids.includes(id)) {
      ids.push(id);
    }
  };
  for (const runningId of runningTemplateIds) {
    add(runningId);
    const template = templates.find((item) => item.id === runningId);
    const source = template ? resolveSourceReadyProgrammeId(template, readyTemplateIds) : null;
    if (source) {
      add(source);
    }
  }
  return ids;
}
