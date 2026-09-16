/**
 * The same programme, before and after the reader changed a lift in it.
 *
 * Editing a ready programme makes the reader their own copy of it — that is
 * what "the catalog original stays untouched" costs — and the copy carries a
 * new template id. Everything that counts a programme's work counts it by
 * template id, so the moment the copy exists the programme reads as brand
 * new: the Home hero drops from week 3 to week 1, the block's session total
 * starts from nothing, and work logged for a season stops scoring because the
 * season asks for ITS programme's id (2026-09-15 audit).
 *
 * Nothing about the reader's training changed. `sourceTemplateId` already
 * records which catalog programme a copy came from, so the ids that mean "this
 * programme" are knowable — this is the one place that resolves them, so no
 * counter has to know how copying works.
 */

/** Only the fields lineage reads. The stored template carries more. */
export interface ProgrammeLineageTemplate {
  id: string;
  sourceTemplateId?: string | null;
}

/**
 * Every template id that counts as the same programme as `templateId`: the
 * template itself, the catalog programme it was copied from, and every copy
 * made from that same original — a reader who edited, reset and edited again
 * has two copies of one programme, and the block they are running is the same
 * block either way.
 *
 * The ids come back in a stable order: the given one first, then the source,
 * then the siblings in the order they are stored.
 */
export function programmeLineageIds(
  templateId: string,
  templates: readonly ProgrammeLineageTemplate[],
): string[] {
  const own = templates.find((template) => template.id === templateId) ?? null;
  const origin = own?.sourceTemplateId ?? templateId;
  const ids = [templateId];
  const add = (id: string | null | undefined) => {
    if (id && !ids.includes(id)) {
      ids.push(id);
    }
  };

  add(origin);
  for (const template of templates) {
    if (template.sourceTemplateId === origin) {
      add(template.id);
    }
  }
  return ids;
}

/** A logged session, as lineage reads it. */
export interface LineageSession {
  workoutTemplateId?: string | null;
  workoutTemplateSessionId?: string | null;
}

/**
 * Yesterday's sessions, wearing the ids the copy's plan knows them by.
 *
 * The rotation asks "which day comes next" by matching a plan entry against a
 * logged session, template id and day id both. A copy's days carry new ids,
 * so the day after the copy was made the rotation found no match at all and
 * offered day 1 — to a reader who trained day 3 yesterday.
 *
 * The copy is built from the original day by day, in order, so at that moment
 * the two lists line up exactly. That is the only claim made here: day `n` of
 * the original is day `n` of the copy. Once the copy no longer has the same
 * number of days, the reader has rearranged their programme and the lists no
 * longer line up — then nothing is translated, and the rotation starts over
 * rather than guessing at a day.
 */
export function alignHistoryToCopiedDays<T extends LineageSession>(
  sessions: readonly T[],
  mapping: {
    fromTemplateIds: readonly string[];
    fromSessionIds: readonly string[];
    toTemplateId: string;
    toSessionIds: readonly string[];
  },
): T[] {
  const { fromTemplateIds, fromSessionIds, toTemplateId, toSessionIds } = mapping;
  if (fromSessionIds.length === 0 || fromSessionIds.length !== toSessionIds.length) {
    return [...sessions];
  }

  const from = new Set(fromTemplateIds.filter((id) => id !== toTemplateId));
  if (from.size === 0) {
    return [...sessions];
  }

  return sessions.map((session) => {
    if (!session.workoutTemplateId || !from.has(session.workoutTemplateId)) {
      return session;
    }
    const dayIndex = session.workoutTemplateSessionId
      ? fromSessionIds.indexOf(session.workoutTemplateSessionId)
      : -1;
    if (dayIndex === -1) {
      return session;
    }
    return {
      ...session,
      workoutTemplateId: toTemplateId,
      workoutTemplateSessionId: toSessionIds[dayIndex],
    };
  });
}
