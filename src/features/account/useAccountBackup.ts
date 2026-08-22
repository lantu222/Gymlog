/**
 * Sign in, back up, restore — the whole account feature behind one hook,
 * instantiated once in App.tsx.
 *
 * Truthfulness rules, same as saved workouts:
 * - "Backed up" is only reported after the server accepted the write.
 * - A restore only replaces local data after the payload parsed and the
 *   providers committed it.
 * - When both the phone and the cloud hold data, nobody's copy is destroyed
 *   without the reader choosing (`SignInOutcome.choice`).
 *
 * The ID token is short-lived, so background backups fetch a fresh one via
 * silent sign-in; when that fails the account downgrades to signed-out rather
 * than pretending backups still happen.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { AppDatabase } from '../../types/models';
import type { WorkoutHistoryStore } from '../workout/workoutTypes';
import {
  AccountBackupPayload,
  AccountBackupSummary,
  buildAccountBackupPayload,
  describeAccountBackup,
  hasLocalDataWorthKeeping,
} from '../../lib/accountBackup';
import { deleteBackup, downloadBackup, isBackupApiConfigured, uploadBackup } from './backupApi';
import { getFreshIdToken, isGoogleSignInConfigured, signInWithGoogle, signOutGoogle } from './googleAuth';
import { clearStoredAccount, loadStoredAccount, saveStoredAccount, StoredAccount } from './accountStore';

export type AccountBackupPhase = 'idle' | 'signing_in' | 'backing_up' | 'restoring';

export interface AccountBackupState {
  /** 'unavailable' — this build has no sign-in configured; show nothing. */
  status: 'unavailable' | 'loading' | 'signed_out' | 'signed_in';
  email: string | null;
  name: string | null;
  lastBackupAt: string | null;
}

export type SignInOutcome =
  | { kind: 'unavailable' }
  | { kind: 'cancelled' }
  | { kind: 'failed' }
  /** No cloud backup existed; the local data was uploaded as the first one. */
  | { kind: 'backed_up' }
  /** Fresh device, cloud had data — restored without asking. */
  | { kind: 'restored'; summary: AccountBackupSummary }
  /** Both sides hold data. Call resolveRestoreChoice with the reader's answer. */
  | { kind: 'choice'; summary: AccountBackupSummary };

export interface AccountBackupApi {
  available: boolean;
  state: AccountBackupState;
  phase: AccountBackupPhase;
  signIn: () => Promise<SignInOutcome>;
  resolveRestoreChoice: (choice: 'restore' | 'keep_local') => Promise<boolean>;
  backupNow: () => Promise<boolean>;
  signOut: () => Promise<void>;
  deleteRemoteBackup: () => Promise<boolean>;
}

export interface AccountBackupInput {
  hydrated: boolean;
  database: AppDatabase;
  workoutHistory: WorkoutHistoryStore;
  /** Replaces local data through the providers' own normalize-and-save path. */
  restoreDatabase: (input: Partial<AppDatabase>) => Promise<void>;
  restoreWorkoutHistory: (history: WorkoutHistoryStore) => void;
}

export function useAccountBackup(input: AccountBackupInput): AccountBackupApi {
  const available = isGoogleSignInConfigured() && isBackupApiConfigured();
  const [account, setAccount] = useState<StoredAccount | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [phase, setPhase] = useState<AccountBackupPhase>('idle');

  // The payload waiting on the reader's restore-or-keep answer.
  const pendingRestoreRef = useRef<{ payload: AccountBackupPayload; idToken: string } | null>(null);
  const latestRef = useRef(input);
  latestRef.current = input;

  useEffect(() => {
    let cancelled = false;
    void loadStoredAccount().then((stored) => {
      if (!cancelled) {
        setAccount(stored);
        setLoaded(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const persistAccount = useCallback(async (next: StoredAccount | null) => {
    setAccount(next);
    if (next) {
      await saveStoredAccount(next);
    } else {
      await clearStoredAccount();
    }
  }, []);

  const uploadCurrent = useCallback(
    async (idToken: string, base: StoredAccount): Promise<boolean> => {
      const { database, workoutHistory } = latestRef.current;
      const payload = buildAccountBackupPayload(database, workoutHistory, new Date().toISOString());
      const result = await uploadBackup(idToken, payload);
      if (result.ok) {
        await persistAccount({ ...base, lastBackupAt: result.savedAt });
        return true;
      }
      return false;
    },
    [persistAccount],
  );

  const applyRestore = useCallback(async (payload: AccountBackupPayload): Promise<void> => {
    const { restoreDatabase, restoreWorkoutHistory } = latestRef.current;
    await restoreDatabase(payload.database);
    restoreWorkoutHistory(payload.workoutHistory);
  }, []);

  const signIn = useCallback(async (): Promise<SignInOutcome> => {
    if (!available) {
      return { kind: 'unavailable' };
    }
    setPhase('signing_in');
    try {
      const result = await signInWithGoogle();
      if (result.status !== 'signed_in') {
        return { kind: result.status === 'cancelled' ? 'cancelled' : result.status === 'unavailable' ? 'unavailable' : 'failed' };
      }
      const base: StoredAccount = {
        sub: result.account.sub,
        email: result.account.email,
        name: result.account.name,
        lastBackupAt: null,
      };

      const remote = await downloadBackup(result.account.idToken);
      if (remote.ok) {
        const summary = describeAccountBackup(remote.payload);
        if (hasLocalDataWorthKeeping(latestRef.current.database)) {
          // Both sides have data — nobody's copy dies without a decision.
          pendingRestoreRef.current = { payload: remote.payload, idToken: result.account.idToken };
          await persistAccount(base);
          return { kind: 'choice', summary };
        }
        setPhase('restoring');
        await applyRestore(remote.payload);
        await persistAccount({ ...base, lastBackupAt: remote.payload.exportedAt });
        return { kind: 'restored', summary };
      }
      if (remote.error !== 'NO_BACKUP') {
        // The server is unreachable or spoke nonsense: signed in, not backed
        // up, and the state says so instead of inventing a timestamp.
        await persistAccount(base);
        return { kind: 'failed' };
      }

      setPhase('backing_up');
      const uploaded = await uploadCurrent(result.account.idToken, base);
      if (!uploaded) {
        await persistAccount(base);
        return { kind: 'failed' };
      }
      return { kind: 'backed_up' };
    } finally {
      setPhase('idle');
    }
  }, [available, applyRestore, persistAccount, uploadCurrent]);

  const resolveRestoreChoice = useCallback(
    async (choice: 'restore' | 'keep_local'): Promise<boolean> => {
      const pending = pendingRestoreRef.current;
      const current = account;
      if (!pending || !current) {
        return false;
      }
      pendingRestoreRef.current = null;
      if (choice === 'restore') {
        setPhase('restoring');
        try {
          await applyRestore(pending.payload);
          await persistAccount({ ...current, lastBackupAt: pending.payload.exportedAt });
          return true;
        } finally {
          setPhase('idle');
        }
      }
      setPhase('backing_up');
      try {
        return await uploadCurrent(pending.idToken, current);
      } finally {
        setPhase('idle');
      }
    },
    [account, applyRestore, persistAccount, uploadCurrent],
  );

  const backupNow = useCallback(async (): Promise<boolean> => {
    if (!available || !account) {
      return false;
    }
    setPhase('backing_up');
    try {
      const idToken = await getFreshIdToken();
      if (!idToken) {
        // The Google session is gone; saying "signed in" would promise
        // backups that cannot happen.
        await persistAccount(null);
        return false;
      }
      return await uploadCurrent(idToken, account);
    } finally {
      setPhase('idle');
    }
  }, [account, available, persistAccount, uploadCurrent]);

  const signOut = useCallback(async () => {
    await signOutGoogle();
    await persistAccount(null);
    pendingRestoreRef.current = null;
  }, [persistAccount]);

  const deleteRemoteBackup = useCallback(async (): Promise<boolean> => {
    if (!available || !account) {
      return false;
    }
    const idToken = await getFreshIdToken();
    if (!idToken) {
      return false;
    }
    const result = await deleteBackup(idToken);
    if (result.ok) {
      await persistAccount({ ...account, lastBackupAt: null });
    }
    return result.ok;
  }, [account, available, persistAccount]);

  // Auto-backup: when signed in and the logged data changes, push a fresh
  // copy after a quiet pause. Counts, not object identity — the database
  // object changes on every preference write, and re-uploading eight weeks of
  // history because a toggle flipped would be noise.
  const backupFingerprint = [
    input.database.workoutSessions.length,
    input.database.cardioSessions.length,
    input.database.bodyweightEntries.length,
    input.database.measurementEntries.length,
    input.database.workoutTemplates.length,
  ].join('|');
  const lastFingerprintRef = useRef<string | null>(null);
  const backupNowRef = useRef(backupNow);
  backupNowRef.current = backupNow;

  useEffect(() => {
    if (!available || !account || !input.hydrated || phase !== 'idle') {
      return undefined;
    }
    if (lastFingerprintRef.current === null) {
      // First observation is the baseline, not a change.
      lastFingerprintRef.current = backupFingerprint;
      return undefined;
    }
    if (lastFingerprintRef.current === backupFingerprint) {
      return undefined;
    }
    const timer = setTimeout(() => {
      lastFingerprintRef.current = backupFingerprint;
      void backupNowRef.current();
    }, 8000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [available, account !== null, input.hydrated, backupFingerprint, phase]);

  const state = useMemo<AccountBackupState>(() => {
    if (!available) {
      return { status: 'unavailable', email: null, name: null, lastBackupAt: null };
    }
    if (!loaded) {
      return { status: 'loading', email: null, name: null, lastBackupAt: null };
    }
    if (!account) {
      return { status: 'signed_out', email: null, name: null, lastBackupAt: null };
    }
    return {
      status: 'signed_in',
      email: account.email,
      name: account.name,
      lastBackupAt: account.lastBackupAt,
    };
  }, [account, available, loaded]);

  return {
    available,
    state,
    phase,
    signIn,
    resolveRestoreChoice,
    backupNow,
    signOut,
    deleteRemoteBackup,
  };
}
