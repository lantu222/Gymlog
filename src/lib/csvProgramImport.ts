import type { WorkoutTemplateDraft } from '../types/models';

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
  for (const char of line) {
    if (char === '"') {
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

function matchExercise(rawName: string, library: CsvLibraryEntry[]) {
  const normalized = normalizeName(rawName);
  if (!normalized) {
    return { matchedName: null, libraryItemId: null, suggestion: null };
  }
  const compact = normalized.replace(/ /g, '');

  let containsCandidate: CsvLibraryEntry | null = null;
  let bestOverlap: { entry: CsvLibraryEntry; score: number } | null = null;

  for (const entry of library) {
    const entryNormalized = normalizeName(entry.name);
    // Exact match, tolerant of spacing/punctuation ("Dead Lift" === "Deadlift").
    if (entryNormalized === normalized || entryNormalized.replace(/ /g, '') === compact) {
      return { matchedName: entry.name, libraryItemId: entry.id, suggestion: null };
    }
    if (
      !containsCandidate
      && normalized.length >= 5
      && (entryNormalized.includes(normalized) || normalized.includes(entryNormalized))
    ) {
      containsCandidate = entry;
    }
    const score = tokenOverlapScore(normalized, entryNormalized);
    if (score > (bestOverlap?.score ?? 0)) {
      bestOverlap = { entry, score };
    }
  }

  if (containsCandidate) {
    return { matchedName: containsCandidate.name, libraryItemId: containsCandidate.id, suggestion: null };
  }
  if (bestOverlap && bestOverlap.score >= 0.5) {
    return { matchedName: null, libraryItemId: null, suggestion: bestOverlap.entry.name };
  }
  return { matchedName: null, libraryItemId: null, suggestion: null };
}

export function parseCsvProgram(text: string, library: CsvLibraryEntry[]): CsvProgramPreview {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const errors: string[] = [];

  if (!lines.length) {
    return { rows: [], matchedCount: 0, unmatchedCount: 0, dayCount: 0, errors: ['The file is empty.'] };
  }

  const delimiter = detectDelimiter(lines[0]);
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
      errors: ['Header row must contain the columns Day, Exercise, Sets and Reps.'],
    };
  }

  const rows: CsvProgramRow[] = [];
  for (let index = 1; index < lines.length; index += 1) {
    const cells = splitCsvLine(lines[index], delimiter);
    const day = (cells[dayIndex] ?? '').trim();
    const exerciseName = (cells[exerciseIndex] ?? '').trim();
    const sets = Number.parseInt((cells[setsIndex] ?? '').trim(), 10);
    const reps = parseReps((cells[repsIndex] ?? '').trim());

    if (!day || !exerciseName) {
      errors.push(`Row ${index + 1}: missing day or exercise name.`);
      continue;
    }
    if (!Number.isFinite(sets) || sets <= 0) {
      errors.push(`Row ${index + 1}: sets must be a positive number.`);
      continue;
    }
    if (!reps) {
      errors.push(`Row ${index + 1}: reps must be a number or a range like 6-10.`);
      continue;
    }

    rows.push({
      day,
      exerciseName,
      sets,
      repMin: reps.repMin,
      repMax: reps.repMax,
      ...matchExercise(exerciseName, library),
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
