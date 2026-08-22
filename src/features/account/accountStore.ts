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
}

export async function loadStoredAccount(): Promise<StoredAccount | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<StoredAccount>;
    if (typeof parsed.sub !== 'string' || !parsed.sub) {
      return null;
    }
    return {
      sub: parsed.sub,
      email: typeof parsed.email === 'string' ? parsed.email : null,
      name: typeof parsed.name === 'string' ? parsed.name : null,
      lastBackupAt: typeof parsed.lastBackupAt === 'string' ? parsed.lastBackupAt : null,
    };
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
