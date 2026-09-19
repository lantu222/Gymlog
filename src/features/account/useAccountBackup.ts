/**
 * Sign in, back up, restore — the whole account feature behind one hook,
 * instantiated once in App.tsx.
 *
 * Truthfulness rules, same as saved workouts:
 * - "Backed up" is only reported after the server accepted the write.
 * - A restore only replaces local data after the payload parsed and the
 *   providers committed it — the workout history included.
 * - When both the phone and the cloud hold data, nobody's copy is destroyed
 *   without the reader choosing (`SignInOutcome.choice`).
 * - Sign-out (and Reset, which signs out first) ends whatever was still
 *   running: nothing that was in flight may sign the account back in, or
 *   restore onto a phone that has just been emptied.
 *
 * The ID token is short-lived, so background backups fetch a fresh one via
 * silent sign-in. Only Google's "no saved credential" downgrades the account
 * to signed-out; offline is a backup that failed, and is tried again.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import type { AppDatabase } from '../../types/models';
import type { WorkoutHistoryStore } from '../workout/workoutTypes';
import {
  AccountBackupPayload,
  AccountBackupSummary,
  accountBackupFingerprint,
  BackupLookResult,
  buildAccountBackupPayload,
  countBackupItems,
  decideAfterLook,
  describeAccountBackup,
  describeRestoreChoice,
  hasLocalDataWorthKeeping,
  planBackup,
  RestoreChoiceSummary,
} from '../../lib/accountBackup';
import { BackupDownloadResult, deleteBackup, downloadBackup, isBackupApiConfigured, uploadBackup } from './backupApi';
import { getFreshIdToken, isGoogleSignInConfigured, signInWithGoogle, signOutGoogle } from './googleAuth';
import { clearStoredAccount, loadStoredAccount, saveStoredAccount, StoredAccount } from './accountStore';

export type AccountBackupPhase = 'idle' | 'signing_in' | 'backing_up' | 'restoring' | 'deleting';

export interface AccountBackupState {
  /** 'unavailable' — this build has no sign-in configured; show nothing. */
  status: 'unavailable' | 'loading' | 'signed_out' | 'signed_in';
  email: string | null;
  name: string | null;
  lastBackupAt: string | null;
}

export type SignInOutcome =
  | { kind: 'unavailable' }
  /** The reader closed the sheet, or sign-out overtook the operation. Nothing to say. */
  | { kind: 'cancelled' }
  | { kind: 'failed' }
  /**
   * Signed in, but the cloud copy could not be read or the first one written.
   * Not a failed sign-in: the reader is signed in, and "Sign-in failed" told
   * them otherwise.
   */
  | { kind: 'not_backed_up' }
  /** No cloud backup existed; the local data was uploaded as the first one. */
  | { kind: 'backed_up' }
  /** Fresh device, cloud had data — restored without asking. */
  | { kind: 'restored'; summary: AccountBackupSummary }
  /** Signed in, and the phone refused to write the backup it downloaded. */
  | { kind: 'restore_failed' }
  /** Both sides matter. Call resolveRestoreChoice with the reader's answer. */
  | { kind: 'choice'; summary: RestoreChoiceSummary };

/** How an operation the reader started ended. 'cancelled': sign-out or Reset overtook it. */
export type AccountOperationResult = 'done' | 'failed' | 'cancelled';

export interface AccountBackupApi {
  available: boolean;
  state: AccountBackupState;
  phase: AccountBackupPhase;
  signIn: () => Promise<SignInOutcome>;
  resolveRestoreChoice: (choice: 'restore' | 'keep_local') => Promise<AccountOperationResult>;
  /** The automatic backup: never asks, and never writes over an unseen copy. */
  backupNow: () => Promise<boolean>;
  /**
   * "Back up now". On a phone that has never synced, or whose upload would
   * shrink the cloud copy, it can come back as 'choice' or 'restored',
   * exactly like sign-in.
   */
  backUpOrAsk: () => Promise<SignInOutcome>;
  signOut: () => Promise<void>;
  deleteRemoteBackup: () => Promise<AccountOperationResult>;
}

export interface AccountBackupInput {
  /** Both stores loaded: an upload before the history has loaded writes an empty one. */
  hydrated: boolean;
  /** A workout or run is going. A restore would put it away, so it is asked about. */
  liveSession: boolean;
  database: AppDatabase;
  workoutHistory: WorkoutHistoryStore;
  /**
   * Replaces local data through the providers' own normalize-and-save path,
   * resolving with what was committed once it is on disk.
   */
  restoreDatabase: (input: Partial<AppDatabase>) => Promise<AppDatabase>;
  restoreWorkoutHistory: (history: WorkoutHistoryStore) => Promise<WorkoutHistoryStore>;
}

/** How long the data has to stay still before the automatic backup looks at it. */
const AUTO_BACKUP_QUIET_MS = 8000;

/** Thrown inside an operation that sign-out overtook; never reaches the caller. */
class Superseded extends Error {}

function lookResult(remote: BackupDownloadResult): BackupLookResult {
  if (remote.ok) {
    return { kind: 'backup', itemCount: countBackupItems(remote.payload.database) };
  }
  return remote.error === 'NO_BACKUP' ? { kind: 'none' } : { kind: 'unreachable' };
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
  // Operations read the account from here, not from the render that started
  // them: the automatic backup runs from a timer, and an operation that has
  // just written the account reads its own write.
  const accountRef = useRef(account);
  accountRef.current = account;
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  /**
   * Bumped by sign-out — and so by Reset, which signs out before it wipes.
   * Every operation notes it when it starts and checks it after each await.
   * Without it an upload that finished after sign-out wrote the account back
   * (signed in again, on an empty phone that then backed itself up), and a
   * download that finished after Reset restored onto the wiped phone.
   */
  const generationRef = useRef(0);
  // The ref moves with the state, not a render later: the automatic backup's
  // timer reads it, and must not start beside an operation that began in the
  // same tick.
  const enterPhase = (next: AccountBackupPhase) => {
    phaseRef.current = next;
    setPhase(next);
  };
  const ensureCurrent = (generation: number) => {
    if (generationRef.current !== generation) {
      throw new Superseded();
    }
  };
  const endPhase = (generation: number) => {
    // Sign-out already put the phase back, and may have started something new.
    if (generationRef.current === generation) {
      enterPhase('idle');
    }
  };

  /**
   * An automatic look that found a copy this phone has never seen. The
   * automatic path cannot ask about it, so it does not download it again
   * every time the app comes back — once per run of the app is enough.
   */
  const unseenCopyFoundRef = useRef(false);

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
    accountRef.current = next;
    setAccount(next);
    if (next) {
      await saveStoredAccount(next);
    } else {
      await clearStoredAccount();
    }
  }, []);

  const uploadCurrent = useCallback(
    async (idToken: string, base: StoredAccount, generation: number): Promise<boolean> => {
      const { database, workoutHistory } = latestRef.current;
      const payload = buildAccountBackupPayload(database, workoutHistory, new Date().toISOString());
      // Taken with the payload: an edit made while the upload runs is still a
      // difference afterwards, and gets its own backup.
      const fingerprint = accountBackupFingerprint(database, workoutHistory);
      const result = await uploadBackup(idToken, payload);
      ensureCurrent(generation);
      if (!result.ok) {
        return false;
      }
      await persistAccount({
        ...base,
        lastBackupAt: result.savedAt,
        lastBackupItemCount: countBackupItems(database),
        lastBackupFingerprint: fingerprint,
        // The reader's own backup (or restore, or sign-in) is what lifts a
        // delete's pause.
        autoBackupPaused: false,
      });
      return true;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [persistAccount],
  );

  /** Both stores, each on disk before the next; resolves with the fingerprint of what landed. */
  const applyRestore = useCallback(async (payload: AccountBackupPayload, generation: number): Promise<string> => {
    const { database: previous, restoreDatabase, restoreWorkoutHistory } = latestRef.current;
    const database = await restoreDatabase(payload.database);
    ensureCurrent(generation);
    let history: WorkoutHistoryStore;
    try {
      history = await restoreWorkoutHistory(payload.workoutHistory);
    } catch (error) {
      // The database is already the backup's. Put this phone's back, so the
      // failure the reader is shown ("nothing on this phone changed") is
      // true, and the next backup cannot pair the backup's log with this
      // phone's history. A disk that refuses this too has already refused
      // one write; the account is left unsynced either way (the callers).
      // Not after sign-out: that is Reset, which has wiped the phone since,
      // and the old database written back would undo the wipe.
      if (generationRef.current === generation) {
        try {
          await restoreDatabase(previous);
        } catch (rollbackError) {
          console.error('Backup restore could not be undone', rollbackError);
        }
      }
      throw error;
    }
    ensureCurrent(generation);
    return accountBackupFingerprint(database, history);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Parks the cloud copy and hands the reader the question, with both
   * sides' counts. The stored count becomes the cloud's, so the automatic
   * backup cannot shrink the copy while the question is open or after
   * "keep" is refused.
   */
  const askRestoreOrKeep = useCallback(
    async (idToken: string, base: StoredAccount, payload: AccountBackupPayload): Promise<SignInOutcome> => {
      const pendingAccount = { ...base, lastBackupItemCount: countBackupItems(payload.database) };
      pendingRestoreRef.current = { payload, idToken, account: pendingAccount };
      const summary = describeRestoreChoice(payload, latestRef.current.database, latestRef.current.liveSession);
      await persistAccount(pendingAccount);
      return { kind: 'choice', summary };
    },
    [persistAccount],
  );

  /**
   * What this phone does once it has seen the cloud's answer: ask when both
   * sides hold data, restore onto an empty phone, upload as the first backup
   * only on a confirmed "no backup", and otherwise stay signed in without
   * claiming a backup. Shared by sign-in and by "Back up now" on a phone that
   * has never synced, so the second gets the same question as the first.
   */
  const settleWithRemote = useCallback(
    async (idToken: string, base: StoredAccount, remote: BackupDownloadResult, generation: number): Promise<SignInOutcome> => {
      if (remote.ok) {
        if (hasLocalDataWorthKeeping(latestRef.current.database, latestRef.current.liveSession)) {
          // Both sides have data — nobody's copy dies without a decision.
          return await askRestoreOrKeep(idToken, base, remote.payload);
        }
        const summary = describeAccountBackup(remote.payload);
        const remoteItemCount = countBackupItems(remote.payload.database);
        enterPhase('restoring');
        let fingerprint: string;
        try {
          fingerprint = await applyRestore(remote.payload, generation);
        } catch (error) {
          if (error instanceof Superseded) {
            throw error;
          }
          // The disk refused the restore (full, or a row too big). Signed in,
          // nothing synced, so the next "Back up now" asks again — and the
          // reader is told now instead of seeing nothing happen.
          console.error('Backup restore failed', error);
          ensureCurrent(generation);
          await persistAccount({ ...base, lastBackupItemCount: remoteItemCount });
          return { kind: 'restore_failed' };
        }
        await persistAccount({
          ...base,
          lastBackupAt: remote.payload.exportedAt,
          lastBackupItemCount: remoteItemCount,
          // What is on the phone now is the cloud copy; nothing to upload.
          lastBackupFingerprint: fingerprint,
          // Phone and cloud agree again, by the reader's own doing — the
          // same as an upload. Left paused (a delete, then this phone restoring
          // a copy another phone wrote), the row showed a fresh backup time
          // while nothing was ever backed up again.
          autoBackupPaused: false,
        });
        return { kind: 'restored', summary };
      }
      if (remote.error !== 'NO_BACKUP') {
        // The server is unreachable or spoke nonsense: signed in, not backed
        // up, and the state says so instead of inventing a timestamp.
        await persistAccount(base);
        return { kind: 'not_backed_up' };
      }

      enterPhase('backing_up');
      const uploaded = await uploadCurrent(idToken, base, generation);
      if (!uploaded) {
        await persistAccount(base);
        return { kind: 'not_backed_up' };
      }
      return { kind: 'backed_up' };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [applyRestore, askRestoreOrKeep, persistAccount, uploadCurrent],
  );

  const signIn = useCallback(async (): Promise<SignInOutcome> => {
    if (!available) {
      return { kind: 'unavailable' };
    }
    const generation = generationRef.current;
    enterPhase('signing_in');
    try {
      const result = await signInWithGoogle();
      ensureCurrent(generation);
      if (result.status !== 'signed_in') {
        return { kind: result.status === 'cancelled' ? 'cancelled' : result.status === 'unavailable' ? 'unavailable' : 'failed' };
      }
      unseenCopyFoundRef.current = false;
      const base: StoredAccount = {
        sub: result.account.sub,
        email: result.account.email,
        name: result.account.name,
        lastBackupAt: null,
        lastBackupItemCount: null,
        lastBackupFingerprint: null,
        autoBackupPaused: false,
      };

      const remote = await downloadBackup(result.account.idToken);
      ensureCurrent(generation);
      return await settleWithRemote(result.account.idToken, base, remote, generation);
    } catch (error) {
      if (error instanceof Superseded) {
        return { kind: 'cancelled' };
      }
      throw error;
    } finally {
      endPhase(generation);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [available, settleWithRemote]);

  const resolveRestoreChoice = useCallback(
    async (choice: 'restore' | 'keep_local'): Promise<AccountOperationResult> => {
      const pending = pendingRestoreRef.current;
      if (!pending) {
        return 'failed';
      }
      const current = pending.account;
      pendingRestoreRef.current = null;
      const generation = generationRef.current;
      try {
        if (choice === 'restore') {
          enterPhase('restoring');
          let fingerprint: string;
          try {
            fingerprint = await applyRestore(pending.payload, generation);
          } catch (error) {
            if (error instanceof Superseded) {
              throw error;
            }
            // A refused write: the caller says so. The account is left
            // unsynced — also when it was synced before, as on the "Back up
            // now" path — so the automatic backup never writes over the copy
            // the reader chose, and "Back up now" asks again (PR #119 review).
            console.error('Backup restore failed', error);
            ensureCurrent(generation);
            await persistAccount({ ...current, lastBackupAt: null, lastBackupFingerprint: null });
            return 'failed';
          }
          await persistAccount({
            ...current,
            lastBackupAt: pending.payload.exportedAt,
            lastBackupFingerprint: fingerprint,
            autoBackupPaused: false,
          });
          return 'done';
        }
        // The reader chose this phone, and was asked twice if it holds less.
        enterPhase('backing_up');
        return (await uploadCurrent(pending.idToken, current, generation)) ? 'done' : 'failed';
      } catch (error) {
        if (error instanceof Superseded) {
          return 'cancelled';
        }
        throw error;
      } finally {
        endPhase(generation);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [applyRestore, persistAccount, uploadCurrent],
  );

  /**
   * One backup. `interactive` is the reader pressing "Back up now"; the
   * automatic backup is not. What it may do is decided by planBackup and
   * decideAfterLook (lib/accountBackup).
   */
  const runBackup = useCallback(
    async (interactive: boolean): Promise<SignInOutcome> => {
      const current = accountRef.current;
      if (!available || !current) {
        return { kind: 'failed' };
      }
      if (pendingRestoreRef.current) {
        // The reader has not answered restore-or-keep yet. An upload now would
        // answer it for them, by overwriting the copy they may be about to pick.
        return { kind: 'failed' };
      }
      if (!interactive && !current.lastBackupAt && unseenCopyFoundRef.current) {
        return { kind: 'failed' };
      }
      const plan = planBackup({ interactive, sync: current, localItemCount: countBackupItems(latestRef.current.database) });
      if (plan === 'skip') {
        return { kind: 'failed' };
      }
      const generation = generationRef.current;
      enterPhase('backing_up');
      try {
        const token = await getFreshIdToken();
        ensureCurrent(generation);
        if (token.status === 'signed_out') {
          // Google has no session for this app any more; saying "signed in"
          // would promise backups that cannot happen.
          pendingRestoreRef.current = null;
          await persistAccount(null);
          return { kind: 'failed' };
        }
        if (token.status !== 'ok') {
          // Offline, most likely. Still signed in: the next change, or the
          // next time the app comes to the front, tries again.
          return { kind: 'failed' };
        }
        const idToken = token.idToken;
        if (plan === 'look') {
          const remote = await downloadBackup(idToken);
          ensureCurrent(generation);
          const decision = decideAfterLook({
            interactive,
            neverSynced: !current.lastBackupAt,
            remote: lookResult(remote),
            localItemCount: countBackupItems(latestRef.current.database),
          });
          if (decision === 'settle') {
            // The reader is here to answer, so they get sign-in's question —
            // otherwise nothing but signing out and in again would ever lift
            // this (PR #119 review).
            return await settleWithRemote(idToken, current, remote, generation);
          }
          if (decision === 'ask' && remote.ok) {
            // "Back up now" on a phone holding far less than the copy it
            // would replace: the reader decides, with both counts in front
            // of them, instead of the upload deciding for them.
            return await askRestoreOrKeep(idToken, current, remote.payload);
          }
          if (decision === 'hold' && remote.ok) {
            await persistAccount({ ...current, lastBackupItemCount: countBackupItems(remote.payload.database) });
            return { kind: 'failed' };
          }
          if (decision !== 'upload') {
            if (remote.ok && !current.lastBackupAt) {
              unseenCopyFoundRef.current = true;
            }
            return { kind: 'failed' };
          }
        }
        return (await uploadCurrent(idToken, current, generation)) ? { kind: 'backed_up' } : { kind: 'failed' };
      } catch (error) {
        if (error instanceof Superseded) {
          return { kind: 'cancelled' };
        }
        throw error;
      } finally {
        endPhase(generation);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [askRestoreOrKeep, available, persistAccount, settleWithRemote, uploadCurrent],
  );

  /**
   * The automatic backup in flight, if any. Its timer can fire while the
   * delete confirmation is open, after the row's busy check has passed.
   */
  const automaticBackupRef = useRef<Promise<boolean> | null>(null);
  const backupNow = useCallback((): Promise<boolean> => {
    const running = runBackup(false).then((outcome) => outcome.kind === 'backed_up');
    automaticBackupRef.current = running;
    const clear = () => {
      if (automaticBackupRef.current === running) {
        automaticBackupRef.current = null;
      }
    };
    running.then(clear, clear);
    return running;
  }, [runBackup]);
  const backUpOrAsk = useCallback(() => runBackup(true), [runBackup]);

  const signOut = useCallback(async () => {
    // First, before any await: whatever is still running belongs to the
    // account being left, and must not write it back.
    generationRef.current += 1;
    pendingRestoreRef.current = null;
    unseenCopyFoundRef.current = false;
    enterPhase('idle');
    await persistAccount(null);
    await signOutGoogle();
  }, [persistAccount]);

  const deleteRemoteBackup = useCallback(async (): Promise<AccountOperationResult> => {
    if (!available || !accountRef.current) {
      return 'failed';
    }
    const generation = generationRef.current;
    const automatic = automaticBackupRef.current;
    if (automatic) {
      // An upload already on its way lands after a quick DELETE and puts the
      // copy back — and its account write lifts the pause. So the delete
      // goes after it.
      await automatic.catch(() => false);
      if (generationRef.current !== generation) {
        return 'cancelled';
      }
    }
    // Read after the wait: the backup that just ran may have written it.
    const current = accountRef.current;
    if (!current) {
      return 'failed';
    }
    // A phase like every other operation, so Sign out and the other rows wait
    // for it instead of racing its account write.
    enterPhase('deleting');
    try {
      const token = await getFreshIdToken();
      ensureCurrent(generation);
      if (token.status === 'signed_out') {
        pendingRestoreRef.current = null;
        await persistAccount(null);
        return 'failed';
      }
      if (token.status !== 'ok') {
        return 'failed';
      }
      const result = await deleteBackup(token.idToken);
      ensureCurrent(generation);
      if (!result.ok) {
        return 'failed';
      }
      // Paused rather than signed out. The reader asked for the copy to go,
      // not the account; signing them out would be a second thing they did
      // not ask for. But left running, the automatic backup wrote the whole
      // history back eight seconds after the next weigh-in, and the delete
      // was undone without a word. The row now says "No backup yet", and
      // "Back up now" — their own decision — is what starts backups again.
      await persistAccount({
        ...current,
        lastBackupAt: null,
        lastBackupItemCount: null,
        lastBackupFingerprint: null,
        autoBackupPaused: true,
      });
      return 'done';
    } catch (error) {
      if (error instanceof Superseded) {
        return 'cancelled';
      }
      throw error;
    } finally {
      endPhase(generation);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [available, persistAccount]);

  // Auto-backup: when signed in and the data differs from what the cloud copy
  // was made of, push a fresh copy after a quiet pause. The fingerprint moves
  // with edits as well as additions, and is only advanced by an upload that
  // landed — so a failed one is still a difference the next look finds.
  const backupNowRef = useRef(backupNow);
  backupNowRef.current = backupNow;
  /** A look that came while another account operation ran; taken once that ends. */
  const lookWaitingRef = useRef(false);
  const lookRef = useRef<() => void>(() => undefined);
  lookRef.current = () => {
    const current = accountRef.current;
    const { database, hydrated, workoutHistory } = latestRef.current;
    if (!available || !current || !hydrated) {
      return;
    }
    if (phaseRef.current !== 'idle') {
      lookWaitingRef.current = true;
      return;
    }
    lookWaitingRef.current = false;
    if (current.lastBackupFingerprint === accountBackupFingerprint(database, workoutHistory)) {
      return;
    }
    void backupNowRef.current();
  };

  const signedIn = account !== null;
  useEffect(() => {
    if (!available || !signedIn || !input.hydrated) {
      return undefined;
    }
    // Every change restarts the pause; the look decides whether anything changed.
    const timer = setTimeout(() => lookRef.current(), AUTO_BACKUP_QUIET_MS);
    return () => clearTimeout(timer);
  }, [available, signedIn, input.hydrated, input.database, input.workoutHistory]);

  useEffect(() => {
    // Not on every return to idle: a backup that failed would then retry
    // itself every eight seconds for as long as the phone is offline.
    if (phase !== 'idle' || !lookWaitingRef.current) {
      return undefined;
    }
    const timer = setTimeout(() => lookRef.current(), AUTO_BACKUP_QUIET_MS);
    return () => clearTimeout(timer);
  }, [phase]);

  useEffect(() => {
    if (!available) {
      return undefined;
    }
    // Coming back to the app is the retry: offline at the time is the usual
    // reason a backup did not land.
    let timer: ReturnType<typeof setTimeout> | null = null;
    const subscription = AppState.addEventListener('change', (next) => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      if (next === 'active') {
        timer = setTimeout(() => lookRef.current(), AUTO_BACKUP_QUIET_MS);
      }
    });
    return () => {
      if (timer) {
        clearTimeout(timer);
      }
      subscription.remove();
    };
  }, [available]);

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
