/**
 * The shape of a cloud backup — built here, parsed here, and nowhere else.
 *
 * The payload is the two AsyncStorage stores that matter: the app database
 * (minus the exercise library, which is regenerated on every load exactly as
 * the local save path strips it) and the workout history. The active session
 * is deliberately not backed up: a mid-workout snapshot restored onto another
 * phone is a workout the reader is not doing.
 *
 * Restore goes through the same normalizers as a local load, so a backup from
 * an older app version is handled the way an older local database is — with
 * defaults, not a crash.
 */
import type { AppDatabase } from '../types/models';
import type { WorkoutHistoryStore } from '../features/workout/workoutTypes';

export const ACCOUNT_BACKUP_VERSION = 1;

export interface AccountBackupPayload {
  version: typeof ACCOUNT_BACKUP_VERSION;
  exportedAt: string;
  database: Omit<AppDatabase, 'exerciseLibrary'>;
  workoutHistory: WorkoutHistoryStore;
}

/** What the restore dialog says, so the reader knows what they are accepting. */
export interface AccountBackupSummary {
  exportedAt: string;
  workoutCount: number;
  cardioCount: number;
  customProgramCount: number;
  bodyweightCount: number;
}

export function buildAccountBackupPayload(
  database: AppDatabase,
  workoutHistory: WorkoutHistoryStore,
  exportedAt: string,
): AccountBackupPayload {
  const { exerciseLibrary: _stripped, ...rest } = database;
  return {
    version: ACCOUNT_BACKUP_VERSION,
    exportedAt,
    database: rest,
    workoutHistory,
  };
}

/**
 * Whether a server response is a backup this app can restore. Shape-checks
 * only what this module itself relies on; field-level repair belongs to the
 * normalizers the restore path already runs.
 */
export function parseAccountBackupPayload(raw: unknown): AccountBackupPayload | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const candidate = raw as Partial<AccountBackupPayload>;
  if (candidate.version !== ACCOUNT_BACKUP_VERSION) {
    return null;
  }
  if (typeof candidate.exportedAt !== 'string' || !candidate.exportedAt) {
    return null;
  }
  if (!candidate.database || typeof candidate.database !== 'object') {
    return null;
  }
  if (!candidate.workoutHistory || typeof candidate.workoutHistory !== 'object') {
    return null;
  }
  return candidate as AccountBackupPayload;
}

export function describeAccountBackup(payload: AccountBackupPayload): AccountBackupSummary {
  const database = payload.database as Partial<AppDatabase>;
  return {
    exportedAt: payload.exportedAt,
    workoutCount: Array.isArray(database.workoutSessions) ? database.workoutSessions.length : 0,
    cardioCount: Array.isArray(database.cardioSessions) ? database.cardioSessions.length : 0,
    customProgramCount: Array.isArray(database.workoutTemplates) ? database.workoutTemplates.length : 0,
    bodyweightCount: Array.isArray(database.bodyweightEntries) ? database.bodyweightEntries.length : 0,
  };
}

/**
 * Whether the device has anything a restore would overwrite. A fresh install
 * restores without asking; a device with logged work gets the choice.
 */
export function hasLocalDataWorthKeeping(database: AppDatabase): boolean {
  return (
    database.workoutSessions.length > 0 ||
    database.cardioSessions.length > 0 ||
    database.bodyweightEntries.length > 0 ||
    database.workoutTemplates.length > 0
  );
}
