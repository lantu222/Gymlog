import type { AppLanguage, ExerciseNameBookEntry, WorkoutTemplateDraft } from '../types/models';
import { collapseCellWhitespace, splitCsvRecords } from './csvRecords';
import { lookupNameBook } from './exerciseNameBook';
import { t } from './i18n';

/**
 * CSV program import (design_handoff_programs_redesign):
 * columns Day, Exercise, Sets, Reps — lenient on header casing, delimiter
 * (comma / semicolon / tab) and rep formats ("8", "6-10", "6–10").
 * Exercise names are fuzzy-matched against the exercise library; unmatched
 * rows are flagged (with a suggestion when one is close) so the user can
 * fix or skip them before importing.
 */

export interface CsvLibraryEntry {
  id: string;
  name: string;
}

export interface CsvProgramRow {
  day: string;
  exerciseName: string;
  sets: number;
  repMin: number;
  repMax: number;
  matchedName: string | null;
  libraryItemId: string | null;
  suggestion: string | null;
  /**
   * Matched because the reader taught this spelling, not because the fuzzy
   * match found it. Worth showing: it is the difference between the app
   * guessing and the app remembering.
   */
  viaNameBook: boolean;
}

export interface CsvProgramPreview {
  rows: CsvProgramRow[];
  matchedCount: number;
  unmatchedCount: number;
  dayCount: number;
  errors: string[];
}

function normalizeName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/**
 * A programme's rhythm is one weekday mask (ProgramDetailScreen's week strip
 * is seven chips, `getTrainingDayIndexes` clamps to `Math.min(dayCount, 7)`).
 * An 8-day CSV used to import 8 sessions while the title, the chips and the
 * rhythm editor could only ever show seven of them — the reader saw "8 days"
 * on a plan the app could never schedule past day 7 (2026-09-26). Capping
 * here, with a visible reason, keeps the title, the chips and the rhythm
 * editor telling the same number.
 */
const MAX_TRAINING_DAYS = 7;

function detectDelimiter(headerLine: string) {
  if (headerLine.includes('\t')) {
    return '\t';
  }
  if (headerLine.includes(';')) {
    return ';';
  }
  return ',';
}

function splitCsvLine(line: string, delimiter: string) {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      // A doubled quote inside a quoted cell is one literal quote — the CSV
      // escape. This dropped every quote character instead, so a lift called
      // Bench ("close grip") arrived with its quotes silently removed. Found
      // when the photo importer, which writes this format itself, round
      // -tripped a name through it (2026-08-24).
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }
    if (char === delimiter && !inQuotes) {
      cells.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }
  cells.push(current.trim());
  return cells;
}

function parseReps(value: string): { repMin: number; repMax: number } | null {
  const match = value.replace(/\s+/g, '').match(/^(\d+)(?:[-–—x/](\d+))?$/);
  if (!match) {
    return null;
  }
  const first = Number.parseInt(match[1], 10);
  const second = match[2] ? Number.parseInt(match[2], 10) : first;
  if (!Number.isFinite(first) || first <= 0 || !Number.isFinite(second) || second <= 0) {
    return null;
  }
  return { repMin: Math.min(first, second), repMax: Math.max(first, second) };
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Whether `needle` occurs in `haystack` as whole words, not merely as a run of
 * characters — "up" inside "ups" is not "up". Both sides have already been
 * through `normalizeName`, which leaves tokens separated by single spaces, so
 * a boundary is simply the string's edge or a space.
 */
function containsWholeWords(haystack: string, needle: string): boolean {
  if (!needle) {
    return false;
  }
  return new RegExp(`(^|\\s)${escapeRegExp(needle)}(\\s|$)`).test(haystack);
}

function tokenOverlapScore(left: string, right: string) {
  const leftTokens = new Set(left.split(' ').filter(Boolean));
  const rightTokens = new Set(right.split(' ').filter(Boolean));
  if (!leftTokens.size || !rightTokens.size) {
    return 0;
  }
  let shared = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) {
      shared += 1;
    }
  }
  return shared / Math.max(leftTokens.size, rightTokens.size);
}

function matchExercise(
  rawName: string,
  library: CsvLibraryEntry[],
  nameBook: readonly ExerciseNameBookEntry[],
) {
  const normalized = normalizeName(rawName);
  if (!normalized) {
    return { matchedName: null, libraryItemId: null, suggestion: null, viaNameBook: false };
  }

  // The reader's own vocabulary wins outright, before any guessing.
  //
  // It has to come first, not last: "alatalja" shares no letters with "Seated
  // Cable Row", but it might well overlap 50 % of the tokens in some unrelated
  // lift, and a fuzzy guess that beats a taught answer would make the teaching
  // pointless. Being told is better evidence than being clever.
  const learned = lookupNameBook(nameBook, rawName);
  if (learned) {
    return {
      matchedName: learned.exerciseName,
      libraryItemId: learned.libraryItemId,
      suggestion: null,
      viaNameBook: true,
    };
  }

  const compact = normalized.replace(/ /g, '');

  const containsMatches: CsvLibraryEntry[] = [];
  let bestOverlap: { entry: CsvLibraryEntry; score: number } | null = null;

  for (const entry of library) {
    const entryNormalized = normalizeName(entry.name);
    // Exact match, tolerant of spacing/punctuation ("Dead Lift" === "Deadlift").
    if (entryNormalized === normalized || entryNormalized.replace(/ /g, '') === compact) {
      return { matchedName: entry.name, libraryItemId: entry.id, suggestion: null, viaNameBook: false };
    }
    if (
      normalized.length >= 5
      && (containsWholeWords(entryNormalized, normalized) || containsWholeWords(normalized, entryNormalized))
    ) {
      containsMatches.push(entry);
    }
    const score = tokenOverlapScore(normalized, entryNormalized);
    if (score > (bestOverlap?.score ?? 0)) {
      bestOverlap = { entry, score };
    }
  }

  // A generic name — "Deadlift", "Pull Up", "Press" — is a whole-word
  // substring of dozens of more specific library entries. Taking the first
  // one found used to turn a photographed or CSV "Deadlift" into e.g.
  // "Romanian Deadlift" or a machine variant with no way for the reader to
  // notice (#bugs). A contains-match is only trustworthy when it names
  // exactly one entry; an ambiguous one falls through to the ordinary
  // suggestion path below, same as any other near-miss.
  if (containsMatches.length === 1) {
    const match = containsMatches[0];
    return { matchedName: match.name, libraryItemId: match.id, suggestion: null, viaNameBook: false };
  }
  if (bestOverlap && bestOverlap.score >= 0.5) {
    return { matchedName: null, libraryItemId: null, suggestion: bestOverlap.entry.name, viaNameBook: false };
  }
  return { matchedName: null, libraryItemId: null, suggestion: null, viaNameBook: false };
}

export function parseCsvProgram(
  text: string,
  library: CsvLibraryEntry[],
  nameBook: readonly ExerciseNameBookEntry[] = [],
  // The errors are shown to the reader as they are, so they are written in
  // the app's language; English was the only one until 2026-09-26.
  language: AppLanguage = 'en',
): CsvProgramPreview {
  // The separator off the raw first line, before any quote-aware splitting:
  // the record splitter needs it to know where a quoted field can open, and
  // the header itself is never quoted or wrapped across lines.
  const delimiter = detectDelimiter((text.split(/\r?\n/, 1)[0] ?? '').trim());
  // A record ends at a line break OUTSIDE an open quote. Splitting on every
  // raw line break instead tore a quoted cell that itself held one — an Excel
  // cell wrapped with Alt+Enter, or a model-returned name that copied a
  // spreadsheet's own wrap — into two rows: the exercise vanished and the
  // error below named a row the reader's sheet does not have (#bugs).
  const lines = splitCsvRecords(text, delimiter)
    .map((line) => line.trim())
    .filter(Boolean);
  const errors: string[] = [];

  if (!lines.length) {
    return { rows: [], matchedCount: 0, unmatchedCount: 0, dayCount: 0, errors: [t(language, 'csv.error.empty')] };
  }

  const header = splitCsvLine(lines[0], delimiter).map((cell) => normalizeName(cell));
  const dayIndex = header.findIndex((cell) => cell === 'day' || cell === 'session');
  const exerciseIndex = header.findIndex((cell) => cell === 'exercise' || cell === 'exercise name' || cell === 'lift');
  const setsIndex = header.findIndex((cell) => cell === 'sets');
  const repsIndex = header.findIndex((cell) => cell === 'reps' || cell === 'rep range');

  if (dayIndex < 0 || exerciseIndex < 0 || setsIndex < 0 || repsIndex < 0) {
    return {
      rows: [],
      matchedCount: 0,
      unmatchedCount: 0,
      dayCount: 0,
      errors: [t(language, 'csv.error.header')],
    };
  }

  const rows: CsvProgramRow[] = [];
  const seenDayKeys = new Set<string>();
  const skippedDayKeys = new Set<string>();
  for (let index = 1; index < lines.length; index += 1) {
    const cells = splitCsvLine(lines[index], delimiter);
    // Collapsed, not just trimmed: a quoted cell can carry the line break it
    // was wrapped with (Alt+Enter, or a photographed cell copied verbatim),
    // and that wrap is not part of the name.
    const day = collapseCellWhitespace(cells[dayIndex] ?? '');
    const exerciseName = collapseCellWhitespace(cells[exerciseIndex] ?? '');
    // A whole number, all of it. parseInt read "2,5" as 2 and "3-4" as 3 and
    // reported nothing (decimal audit, 2026-09-21); a count of sets that is
    // not one is the reader's to fix, like a missing name.
    const setsText = (cells[setsIndex] ?? '').trim();
    const sets = /^\d+$/.test(setsText) ? Number(setsText) : Number.NaN;
    const reps = parseReps((cells[repsIndex] ?? '').trim());

    if (!day || !exerciseName) {
      errors.push(t(language, 'csv.error.missing', { row: index + 1 }));
      continue;
    }
    if (!Number.isFinite(sets) || sets <= 0) {
      errors.push(t(language, 'csv.error.sets', { row: index + 1 }));
      continue;
    }
    if (!reps) {
      errors.push(t(language, 'csv.error.reps', { row: index + 1 }));
      continue;
    }

    const dayKey = normalizeName(day);
    if (!seenDayKeys.has(dayKey)) {
      if (seenDayKeys.size >= MAX_TRAINING_DAYS) {
        if (!skippedDayKeys.has(dayKey)) {
          skippedDayKeys.add(dayKey);
          errors.push(t(language, 'csv.error.dayCap', { row: index + 1, day, max: MAX_TRAINING_DAYS }));
        }
        continue;
      }
      seenDayKeys.add(dayKey);
    }

    rows.push({
      day,
      exerciseName,
      sets,
      repMin: reps.repMin,
      repMax: reps.repMax,
      ...matchExercise(exerciseName, library, nameBook),
    });
  }

  const matchedCount = rows.filter((row) => row.matchedName).length;
  return {
    rows,
    matchedCount,
    unmatchedCount: rows.length - matchedCount,
    dayCount: new Set(rows.map((row) => normalizeName(row.day))).size,
    errors,
  };
}

/** Builds a custom-template draft from the matched rows; unmatched rows are skipped. */
export function buildDraftFromCsvPreview(preview: CsvProgramPreview, programName: string): WorkoutTemplateDraft {
  const sessionsByDay = new Map<string, { name: string; exercises: WorkoutTemplateDraft['sessions'][number]['exercises'] }>();

  for (const row of preview.rows) {
    if (!row.matchedName) {
      continue;
    }
    const key = normalizeName(row.day);
    const session = sessionsByDay.get(key) ?? { name: row.day, exercises: [] };
    session.exercises.push({
      name: row.matchedName,
      targetSets: row.sets,
      repMin: row.repMin,
      repMax: row.repMax,
      restSeconds: 90,
      trackedDefault: true,
      libraryItemId: row.libraryItemId,
    });
    sessionsByDay.set(key, session);
  }

  return {
    name: programName,
    sessions: [...sessionsByDay.values()],
  };
}
