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
}

/** The stored record, repaired: an account written by an older build lacks the newer fields. */
export function normalizeStoredAccount(parsed: Partial<StoredAccount> | null | undefined): StoredAccount | null {
  if (!parsed || typeof parsed !== 'object' || typeof parsed.sub !== 'string' || !parsed.sub) {
    return null;
  }
  return {
    sub: parsed.sub,
    email: typeof parsed.email === 'string' ? parsed.email : null,
    name: typeof parsed.name === 'string' ? parsed.name : null,
    lastBackupAt: typeof parsed.lastBackupAt === 'string' ? parsed.lastBackupAt : null,
    lastBackupItemCount:
      typeof parsed.lastBackupItemCount === 'number' && Number.isFinite(parsed.lastBackupItemCount) && parsed.lastBackupItemCount >= 0
        ? Math.floor(parsed.lastBackupItemCount)
        : null,
    lastBackupFingerprint:
      typeof parsed.lastBackupFingerprint === 'string' && parsed.lastBackupFingerprint ? parsed.lastBackupFingerprint : null,
    autoBackupPaused: parsed.autoBackupPaused === true,
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
