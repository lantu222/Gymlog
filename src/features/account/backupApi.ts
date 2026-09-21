/**
 * The app's side of the backup endpoint. Thin on purpose: identity comes from
 * googleAuth, the payload shape from lib/accountBackup, and this file only
 * moves bytes. Configured by EXPO_PUBLIC_BACKUP_API_URL; without it the
 * feature is absent, same rule as the coach URL.
 */
import type { AccountBackupPayload } from '../../lib/accountBackup';
import { decodeAccountBackupBody, encodeAccountBackupBody, parseAccountBackupPayload } from '../../lib/accountBackup';

const BACKUP_API_URL = (process.env.EXPO_PUBLIC_BACKUP_API_URL ?? '').trim();
const REQUEST_TIMEOUT_MS = 20000;

export function isBackupApiConfigured(): boolean {
  return BACKUP_API_URL.length > 0;
}

/**
 * The server's answer to an upload that named a copy the cloud no longer
 * holds: another phone on the account wrote since this one last did, and
 * nothing was written (api/backup.ts, "Versions").
 */
export const BACKUP_CHANGED = 'BACKUP_CHANGED';

/** `version` is the cloud copy's ETag; null from a server that does not send one yet. */
export type BackupUploadResult = { ok: true; savedAt: string; version: string | null } | { ok: false; error: string };
export type BackupDownloadResult =
  | { ok: true; payload: AccountBackupPayload; version: string | null }
  | { ok: false; error: 'NO_BACKUP' | string };

function versionOf(body: { version?: unknown }): string | null {
  return typeof body.version === 'string' && body.version ? body.version : null;
}

function withTimeout(): { signal: AbortSignal; cleanup: () => void } {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  return { signal: controller.signal, cleanup: () => clearTimeout(timeout) };
}

/**
 * Writes the backup over the copy this phone knows, and no other.
 *
 * `expectedVersion` is the version of the cloud copy this phone last wrote or
 * restored, or null when it knows there is none (the first backup). The
 * server refuses the write when the cloud holds anything else, and this
 * answers BACKUP_CHANGED — the caller asks the reader instead of overwriting.
 */
export async function uploadBackup(
  idToken: string,
  payload: AccountBackupPayload,
  expectedVersion: string | null,
): Promise<BackupUploadResult> {
  if (!BACKUP_API_URL) {
    return { ok: false, error: 'NOT_CONFIGURED' };
  }
  const { signal, cleanup } = withTimeout();
  try {
    const response = await fetch(BACKUP_API_URL, {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${idToken}`,
        'x-backup-expected-version': expectedVersion ?? 'none',
      },
      // Compressed once the history is large; see ACCOUNT_BACKUP_COMPRESS_ABOVE_CHARS.
      body: encodeAccountBackupBody(payload),
      signal,
    });
    const body = (await response.json()) as { ok?: boolean; savedAt?: string; error?: string; version?: unknown };
    if (response.ok && body.ok && typeof body.savedAt === 'string') {
      return { ok: true, savedAt: body.savedAt, version: versionOf(body) };
    }
    // Only the server's own answer: a 412 from anything else is not a copy
    // another phone wrote, and must not start the restore-or-keep question.
    if (response.status === 412 && body.error === BACKUP_CHANGED) {
      return { ok: false, error: BACKUP_CHANGED };
    }
    return { ok: false, error: body.error ?? `HTTP_${response.status}` };
  } catch {
    return { ok: false, error: 'NETWORK' };
  } finally {
    cleanup();
  }
}

export async function downloadBackup(idToken: string): Promise<BackupDownloadResult> {
  if (!BACKUP_API_URL) {
    return { ok: false, error: 'NOT_CONFIGURED' };
  }
  const { signal, cleanup } = withTimeout();
  try {
    const response = await fetch(BACKUP_API_URL, {
      method: 'GET',
      headers: { authorization: `Bearer ${idToken}` },
      signal,
    });
    const body = (await response.json()) as { ok?: boolean; payload?: unknown; error?: string; version?: unknown };
    // Only the server's own answer, never any 404: "no backup" makes the app
    // upload this phone's data as the first one, over whatever is really there.
    if (response.status === 404 && body.error === 'NO_BACKUP') {
      return { ok: false, error: 'NO_BACKUP' };
    }
    if (response.ok && body.ok) {
      const parsed = parseAccountBackupPayload(decodeAccountBackupBody(body.payload));
      if (parsed) {
        return { ok: true, payload: parsed, version: versionOf(body) };
      }
      return { ok: false, error: 'UNRECOGNIZED_PAYLOAD' };
    }
    return { ok: false, error: body.error ?? `HTTP_${response.status}` };
  } catch {
    return { ok: false, error: 'NETWORK' };
  } finally {
    cleanup();
  }
}

export async function deleteBackup(idToken: string): Promise<{ ok: boolean }> {
  if (!BACKUP_API_URL) {
    return { ok: false };
  }
  const { signal, cleanup } = withTimeout();
  try {
    const response = await fetch(BACKUP_API_URL, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${idToken}` },
      signal,
    });
    // The server's own yes, not just a 2xx from whatever answered.
    const body = (await response.json().catch(() => null)) as { ok?: boolean } | null;
    return { ok: response.ok && body?.ok === true };
  } catch {
    return { ok: false };
  } finally {
    cleanup();
  }
}
