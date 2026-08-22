/**
 * The app's side of the backup endpoint. Thin on purpose: identity comes from
 * googleAuth, the payload shape from lib/accountBackup, and this file only
 * moves bytes. Configured by EXPO_PUBLIC_BACKUP_API_URL; without it the
 * feature is absent, same rule as the coach URL.
 */
import type { AccountBackupPayload } from '../../lib/accountBackup';
import { parseAccountBackupPayload } from '../../lib/accountBackup';

const BACKUP_API_URL = (process.env.EXPO_PUBLIC_BACKUP_API_URL ?? '').trim();
const REQUEST_TIMEOUT_MS = 20000;

export function isBackupApiConfigured(): boolean {
  return BACKUP_API_URL.length > 0;
}

export type BackupUploadResult = { ok: true; savedAt: string } | { ok: false; error: string };
export type BackupDownloadResult =
  | { ok: true; payload: AccountBackupPayload }
  | { ok: false; error: 'NO_BACKUP' | string };

function withTimeout(): { signal: AbortSignal; cleanup: () => void } {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  return { signal: controller.signal, cleanup: () => clearTimeout(timeout) };
}

export async function uploadBackup(idToken: string, payload: AccountBackupPayload): Promise<BackupUploadResult> {
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
      },
      body: JSON.stringify(payload),
      signal,
    });
    const body = (await response.json()) as { ok?: boolean; savedAt?: string; error?: string };
    if (response.ok && body.ok && typeof body.savedAt === 'string') {
      return { ok: true, savedAt: body.savedAt };
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
    const body = (await response.json()) as { ok?: boolean; payload?: unknown; error?: string };
    if (response.status === 404 || body.error === 'NO_BACKUP') {
      return { ok: false, error: 'NO_BACKUP' };
    }
    if (response.ok && body.ok) {
      const parsed = parseAccountBackupPayload(body.payload);
      if (parsed) {
        return { ok: true, payload: parsed };
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
    return { ok: response.ok };
  } catch {
    return { ok: false };
  } finally {
    cleanup();
  }
}
