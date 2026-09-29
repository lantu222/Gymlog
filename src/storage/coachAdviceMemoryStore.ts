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
 * Set when an erase could not be verified twice in a row (see
 * `clearCoachAdviceMemory` below) — a restore had already landed on disk, so
 * the erase could not be retried indefinitely without holding up the "done"
 * the reader is shown. `loadCoachAdviceMemory` honours it before the coach
 * reads anything (recheck round, 2026-09-29).
 */
const PENDING_ERASE_KEY = '@vinha/coach/memory/pendingerase/v1';

/**
 * What is on the disk, normalized. Never throws and never returns null: a
 * missing, empty or damaged file all mean the same thing to the caller —
 * the coach has not said anything it needs to remember.
 *
 * Finishes a pending erase first — an account restore whose own erase failed
 * twice (see `clearCoachAdviceMemory`) leaves this marked, and the memory it
 * could not reach must not reach the coach either, on this or any later
 * launch, until it does.
 */
export async function loadCoachAdviceMemory(): Promise<CoachAdviceMemoryEntry[]> {
  await finishPendingErase();
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

async function finishPendingErase(): Promise<void> {
  try {
    const pending = await AsyncStorage.getItem(PENDING_ERASE_KEY);
    if (!pending) {
      return;
    }
    await AsyncStorage.removeItem(STORAGE_KEY);
    await AsyncStorage.removeItem(PENDING_ERASE_KEY);
  } catch {
    // Left standing; the next launch that can reach the disk finishes it.
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

/**
 * Forget everything. Used by the data reset, which must leave nothing
 * behind, and by an account restore's own cleanup (see useAccountBackup's
 * `onRestored`) — a restore that has already replaced the database and the
 * workout history with another account's, and cannot undo that just because
 * this last, unrelated write fails.
 *
 * Retries once before giving up: a full disk or a slow write is often gone a
 * moment later. If both attempts fail, marks the key as still owed rather
 * than swallowing it silently — the next launch's `loadCoachAdviceMemory`
 * finishes the erase before the coach reads anything.
 */
export async function clearCoachAdviceMemory(): Promise<void> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
      // Best-effort: a pending flag from an earlier failed attempt is now
      // moot, but this cannot fail the erase that just succeeded.
      await AsyncStorage.removeItem(PENDING_ERASE_KEY).catch(() => undefined);
      return;
    } catch {
      // One retry below.
    }
  }
  try {
    await AsyncStorage.setItem(PENDING_ERASE_KEY, '1');
  } catch {
    // Nothing left to try; a disk that refuses this has already refused the
    // erase itself twice.
  }
}
