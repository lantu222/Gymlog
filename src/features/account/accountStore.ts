/**
 * The signed-in account record — device identity, not user data.
 *
 * Deliberately its own AsyncStorage key rather than a field on AppDatabase:
 * the database is what gets backed up and restored, and the account is the
 * thing doing the backing up. Restoring a backup onto a new phone must not
 * un-sign-in the person who just signed in to fetch it.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@vinha/account/v1';

export interface StoredAccount {
  sub: string;
  email: string | null;
  name: string | null;
  lastBackupAt: string | null;
  /**
   * How much of the log the cloud copy held when this phone last wrote or read
   * it (countBackupItems). The automatic backup compares against it so a phone
   * that has lost its log does not quietly replace the copy that still has it.
   * Null when unknown (an account stored before this was kept).
   */
  lastBackupItemCount: number | null;
  /**
   * The same for the workout history (countHistoryItems), which is set aside
   * on its own when it cannot be read and was not counted above. Null when
   * unknown: an account stored before it was kept looks at the copy once.
   */
  lastBackupHistoryCount: number | null;
  /**
   * accountBackupFingerprint of the data this phone last uploaded or
   * restored. The automatic backup runs while the data differs from it, so an
   * edit is backed up and a failed upload is tried again — the counts it used
   * to watch missed the first and marked the second done before it happened.
   * Null when unknown (one upload settles it).
   */
  lastBackupFingerprint: string | null;
  /**
   * True after "Delete cloud backup": the automatic backup stays out until
   * the reader backs up themselves, or signs in again.
   */
  autoBackupPaused: boolean;
  /**
   * The version (the server's ETag) of the cloud copy this phone last wrote
   * or restored: the one copy its next upload may replace. The server refuses
   * a write naming any other, so a second phone on the account can no longer
   * overwrite what the first one wrote (server audit, 2026-09-21). Null when
   * unknown — never synced, stored by an older build, or a server that does
   * not send versions yet — and then the next backup reads the copy first.
   */
  cloudVersion: string | null;
}

/** The stored record, repaired: an account written by an older build lacks the newer fields. */
export function normalizeStoredAccount(parsed: Partial<StoredAccount> | null | undefined): StoredAccount | null {
  if (!parsed || typeof parsed !== 'object' || typeof parsed.sub !== 'string' || !parsed.sub) {
    return null;
  }
  const count = (value: unknown) =>
    typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : null;
  return {
    sub: parsed.sub,
    email: typeof parsed.email === 'string' ? parsed.email : null,
    name: typeof parsed.name === 'string' ? parsed.name : null,
    lastBackupAt: typeof parsed.lastBackupAt === 'string' ? parsed.lastBackupAt : null,
    lastBackupItemCount: count(parsed.lastBackupItemCount),
    lastBackupHistoryCount: count(parsed.lastBackupHistoryCount),
    lastBackupFingerprint:
      typeof parsed.lastBackupFingerprint === 'string' && parsed.lastBackupFingerprint ? parsed.lastBackupFingerprint : null,
    autoBackupPaused: parsed.autoBackupPaused === true,
    // Absent on every account stored before versions were kept: unknown,
    // which reads the copy once rather than trusting a version never seen.
    cloudVersion: typeof parsed.cloudVersion === 'string' && parsed.cloudVersion ? parsed.cloudVersion : null,
  };
}

export async function loadStoredAccount(): Promise<StoredAccount | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    return normalizeStoredAccount(JSON.parse(raw) as Partial<StoredAccount>);
  } catch {
    return null;
  }
}

export async function saveStoredAccount(account: StoredAccount): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(account));
}

export async function clearStoredAccount(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
