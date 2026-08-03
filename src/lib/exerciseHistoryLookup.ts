/**
 * Finding a lift's history by NAME, across every slot it has ever been done in.
 *
 * The workout history is keyed by slot — `<template>:<session>:<slot>` — which
 * is the right key for "what did you do here last time". It is the wrong key
 * for "have you ever done this lift". A back squat performed in another
 * program, on another day of the same program, or in an empty workout lives
 * under a different slot, so a new slot for the same lift opened at zero even
 * though the answer was sitting in the store. Every history entry already
 * records `exerciseName`, so nothing new has to be written to make this work —
 * only read differently.
 *
 * This is a lookup of something KNOWN, never an estimate. It answers "you have
 * lifted this before, here is what you lifted"; it does not answer "here is
 * what you could probably lift", which is a different question with a
 * different (and much weaker) basis.
 */

import { WorkoutSlotHistoryEntry, WorkoutSlotHistorySet } from '../features/workout/workoutTypes';

function normalizeExerciseName(name: string): string {
  return name.trim().toLowerCase();
}

function parseTime(iso: string): number {
  const value = Date.parse(iso);
  // An unparseable stamp sorts oldest rather than poisoning the comparison.
  return Number.isFinite(value) ? value : 0;
}

function heaviestLoadKg(entry: WorkoutSlotHistoryEntry): number {
  return entry.sets.reduce((max, set) => Math.max(max, set.loadKg), 0);
}

export interface NamedHistoryOptions {
  /**
   * Reject entries where every set was logged at 0 kg. For a loaded lift such
   * an entry is not a weight, it is the absence of one — and the app really
   * does produce them (the guided player used to hide the weight field
   * entirely, so sets went in at zero). Bodyweight work must NOT set this:
   * there, 0 kg is the honest answer.
   */
  requireLoaded?: boolean;
}

/**
 * The most recent non-skipped entry for this exercise name, from any slot.
 * Returns null when the lift has never been logged (or only emptily).
 */
export function findLatestEntryForExerciseName(
  slotHistory: Record<string, WorkoutSlotHistoryEntry[]>,
  exerciseName: string,
  options: NamedHistoryOptions = {},
): WorkoutSlotHistoryEntry | null {
  const target = normalizeExerciseName(exerciseName ?? '');
  if (!target) {
    return null;
  }

  let best: WorkoutSlotHistoryEntry | null = null;
  let bestTime = -Infinity;

  Object.values(slotHistory ?? {}).forEach((entries) => {
    (entries ?? []).forEach((entry) => {
      if (!entry || entry.skipped || entry.sets.length === 0) {
        return;
      }
      if (normalizeExerciseName(entry.exerciseName ?? '') !== target) {
        return;
      }
      if (options.requireLoaded && heaviestLoadKg(entry) <= 0) {
        return;
      }
      const time = parseTime(entry.performedAt);
      if (time > bestTime) {
        best = entry;
        bestTime = time;
      }
    });
  });

  return best;
}

/**
 * The set to prefill from: the one that was logged at this index, else the
 * one that sat in this position. Shared so the slot-keyed and name-keyed
 * paths cannot disagree about which set of an entry answers for a set index.
 */
export function findHistoricalSetForIndex(
  entry: WorkoutSlotHistoryEntry | null | undefined,
  setIndex: number,
): WorkoutSlotHistorySet | null {
  if (!entry) {
    return null;
  }
  return entry.sets.find((item) => item.setIndex === setIndex) ?? entry.sets[setIndex] ?? null;
}
