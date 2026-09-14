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
import { gunzipSync, gzipSync, strFromU8 } from 'fflate';

import type { AppDatabase } from '../types/models';
import type { WorkoutHistoryStore } from '../features/workout/workoutTypes';
import { base64ToBytes, bytesToBase64 } from './base64';
import { utf8Encode } from './utf8';

export const ACCOUNT_BACKUP_VERSION = 1;

/**
 * Above this many characters of JSON, the upload is compressed.
 *
 * The endpoint caps a request body (4 MB, under Vercel's 4.5 MB), and the
 * history grows about 8 KB a session with nothing trimmed — plain JSON stopped
 * fitting at roughly 250 sessions under the old 2 MB cap, after which every
 * backup failed. Training logs are the same keys over and over and gzip to a
 * tenth of their size or less, so a compressed backup fits thousands of
 * sessions.
 *
 * Below the threshold the body stays plain JSON, exactly as before: every
 * build that can restore a backup today can still restore those.
 */
export const ACCOUNT_BACKUP_COMPRESS_ABOVE_CHARS = 1_000_000;

/** The one encoding a compressed backup uses. */
export const ACCOUNT_BACKUP_ENCODING = 'gzip-base64';

interface CompressedAccountBackup {
  encoding: typeof ACCOUNT_BACKUP_ENCODING;
  data: string;
}

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

/** The request body for an upload: plain JSON, or its compressed envelope once it is large. */
export function encodeAccountBackupBody(payload: AccountBackupPayload): string {
  const json = JSON.stringify(payload);
  if (json.length <= ACCOUNT_BACKUP_COMPRESS_ABOVE_CHARS) {
    return json;
  }
  const envelope: CompressedAccountBackup = {
    encoding: ACCOUNT_BACKUP_ENCODING,
    // Not fflate's strToU8: its no-TextEncoder fallback mangles emoji (lib/utf8).
    data: bytesToBase64(gzipSync(utf8Encode(json), { level: 6 })),
  };
  return JSON.stringify(envelope);
}

/**
 * What the server handed back, unwrapped when it is a compressed envelope.
 *
 * Anything else passes through untouched for `parseAccountBackupPayload` to
 * judge. An envelope that does not decompress to JSON comes back as null, so
 * it is refused like any other wrong-shaped download rather than thrown.
 */
export function decodeAccountBackupBody(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object' || (raw as { encoding?: unknown }).encoding !== ACCOUNT_BACKUP_ENCODING) {
    return raw;
  }
  const data = (raw as { data?: unknown }).data;
  if (typeof data !== 'string') {
    return null;
  }
  const bytes = base64ToBytes(data);
  if (!bytes) {
    return null;
  }
  try {
    return JSON.parse(strFromU8(gunzipSync(bytes)));
  } catch {
    return null;
  }
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
