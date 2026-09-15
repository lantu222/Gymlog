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
  autoBackupWouldShrinkLog,
  buildAccountBackupPayload,
  describeAccountBackup,
  hasLocalDataWorthKeeping,
} from '../../lib/accountBackup';
import { BackupDownloadResult, deleteBackup, downloadBackup, isBackupApiConfigured, uploadBackup } from './backupApi';
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
  /** The automatic backup: never asks, and never writes over an unseen copy. */
  backupNow: () => Promise<boolean>;
  /**
   * "Back up now". On a phone that has never synced it can come back as
   * 'choice' or 'restored', exactly like sign-in.
   */
  backUpOrAsk: () => Promise<SignInOutcome>;
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

  // The payload waiting on the reader's restore-or-keep answer, with the
  // account it belongs to. The account travels with it because the answer is
  // given from a dialog opened by the render that started sign-in, whose
  // `account` was still null — reading it from there made "Use backup" return
  // without restoring anything, and "Keep this phone's data" report a failure.
  const pendingRestoreRef = useRef<{ payload: AccountBackupPayload; idToken: string; account: StoredAccount } | null>(null);
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
        await persistAccount({ ...base, lastBackupAt: result.savedAt, lastBackupSessionCount: database.workoutSessions.length });
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

  /**
   * What this phone does once it has seen the cloud's answer: ask when both
   * sides hold data, restore onto an empty phone, upload as the first backup
   * only on a confirmed "no backup", and otherwise stay signed in without
   * claiming a backup. Shared by sign-in and by "Back up now" on a phone that
   * has never synced, so the second gets the same question as the first.
   */
  const settleWithRemote = useCallback(
    async (idToken: string, base: StoredAccount, remote: BackupDownloadResult): Promise<SignInOutcome> => {
      if (remote.ok) {
        const summary = describeAccountBackup(remote.payload);
        const remoteSessionCount = remote.payload.database.workoutSessions?.length ?? 0;
        if (hasLocalDataWorthKeeping(latestRef.current.database)) {
          // Both sides have data — nobody's copy dies without a decision.
          // The count is the cloud's, so the automatic backup cannot shrink it
          // while the question is open or after "keep" is refused.
          const pendingAccount = { ...base, lastBackupSessionCount: remoteSessionCount };
          pendingRestoreRef.current = { payload: remote.payload, idToken, account: pendingAccount };
          await persistAccount(pendingAccount);
          return { kind: 'choice', summary };
        }
        setPhase('restoring');
        await applyRestore(remote.payload);
        await persistAccount({ ...base, lastBackupAt: remote.payload.exportedAt, lastBackupSessionCount: remoteSessionCount });
        return { kind: 'restored', summary };
      }
      if (remote.error !== 'NO_BACKUP') {
        // The server is unreachable or spoke nonsense: signed in, not backed
        // up, and the state says so instead of inventing a timestamp.
        await persistAccount(base);
        return { kind: 'failed' };
      }

      setPhase('backing_up');
      const uploaded = await uploadCurrent(idToken, base);
      if (!uploaded) {
        await persistAccount(base);
        return { kind: 'failed' };
      }
      return { kind: 'backed_up' };
    },
    [applyRestore, persistAccount, uploadCurrent],
  );

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
        lastBackupSessionCount: null,
      };

      const remote = await downloadBackup(result.account.idToken);
      return await settleWithRemote(result.account.idToken, base, remote);
    } finally {
      setPhase('idle');
    }
  }, [available, settleWithRemote]);

  const resolveRestoreChoice = useCallback(
    async (choice: 'restore' | 'keep_local'): Promise<boolean> => {
      const pending = pendingRestoreRef.current;
      if (!pending) {
        return false;
      }
      const current = pending.account;
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
    [applyRestore, persistAccount, uploadCurrent],
  );

  /**
   * One backup. `interactive` is the reader pressing "Back up now"; the
   * automatic backup is not.
   */
  const runBackup = useCallback(
    async (interactive: boolean): Promise<SignInOutcome> => {
      if (!available || !account) {
        return { kind: 'failed' };
      }
      if (pendingRestoreRef.current) {
        // The reader has not answered restore-or-keep yet. An upload now would
        // answer it for them, by overwriting the copy they may be about to pick.
        return { kind: 'failed' };
      }
      setPhase('backing_up');
      try {
        const idToken = await getFreshIdToken();
        if (!idToken) {
          // The Google session is gone; saying "signed in" would promise
          // backups that cannot happen.
          await persistAccount(null);
          return { kind: 'failed' };
        }
        if (!account.lastBackupAt) {
          // This phone has never written or read the cloud copy: sign-in could
          // not reach it, or the app closed on the restore-or-keep question.
          // Whatever is there has not been seen, so it is not overwritten.
          const remote = await downloadBackup(idToken);
          if (interactive) {
            // The reader is here to answer, so they get sign-in's question —
            // otherwise nothing but signing out and in again would ever lift
            // this (PR #119 review).
            return await settleWithRemote(idToken, account, remote);
          }
          // Unattended, only a confirmed "no backup" lets this phone's data be
          // the first.
          if (remote.ok || remote.error !== 'NO_BACKUP') {
            return { kind: 'failed' };
          }
        }
        return (await uploadCurrent(idToken, account)) ? { kind: 'backed_up' } : { kind: 'failed' };
      } finally {
        setPhase('idle');
      }
    },
    [account, available, persistAccount, settleWithRemote, uploadCurrent],
  );

  const backupNow = useCallback(async (): Promise<boolean> => (await runBackup(false)).kind === 'backed_up', [runBackup]);
  const backUpOrAsk = useCallback(() => runBackup(true), [runBackup]);

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
      await persistAccount({ ...account, lastBackupAt: null, lastBackupSessionCount: null });
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
  const accountRef = useRef(account);
  accountRef.current = account;

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
      if (autoBackupWouldShrinkLog(latestRef.current.database.workoutSessions.length, accountRef.current?.lastBackupSessionCount ?? null)) {
        return;
      }
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
    backUpOrAsk,
    signOut,
    deleteRemoteBackup,
  };
}
