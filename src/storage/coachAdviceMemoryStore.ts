/**
 * Where the coach's own memory lives on the phone.
 *
 * Its own AsyncStorage key, and not a field on AppDatabase, for one reason:
 * the database is what the cloud backup uploads (lib/accountBackup sends all
 * of it but the exercise library). The privacy policy says coach questions and
 * briefs are not kept by us at all, and a takeaway carries the substance of
 * the question that produced it — so it stays on the device that asked, and
 * signing in to back up a training log does not quietly ship a transcript of
 * what someone asked their coach.
 *
 * Same reasoning as features/account/accountStore, from the other direction:
 * that one is out of the database because a restore must not overwrite it,
 * this one because an upload must not carry it.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { CoachAdviceMemoryEntry, parseCoachAdviceMemory } from '../lib/coachAdviceMemory';

const STORAGE_KEY = '@vinha/coach/memory/v1';

/**
 * What is on the disk, normalized. Never throws and never returns null: a
 * missing, empty or damaged file all mean the same thing to the caller —
 * the coach has not said anything it needs to remember.
 */
export async function loadCoachAdviceMemory(): Promise<CoachAdviceMemoryEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    return parseCoachAdviceMemory(JSON.parse(raw));
  } catch {
    return [];
  }
}

/**
 * Write the memory back.
 *
 * Failures are swallowed on purpose. This runs right after an answer has been
 * rendered, and a full disk must not turn a coach reply the reader is already
 * reading into an error — the worst case is that the next question arrives
 * without one line of context.
 */
export async function saveCoachAdviceMemory(memory: CoachAdviceMemoryEntry[]): Promise<void> {
  try {
    if (memory.length === 0) {
      await AsyncStorage.removeItem(STORAGE_KEY);
      return;
    }
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(memory));
  } catch {
    // Intentionally silent — see above.
  }
}

/** Forget everything. Used by the data reset, which must leave nothing behind. */
export async function clearCoachAdviceMemory(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    // A reset that cannot reach the disk has already failed louder elsewhere.
  }
}
