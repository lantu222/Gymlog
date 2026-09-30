import { useCallback } from 'react';
import { Alert } from 'react-native';
import { AccountBackupApi, SignInOutcome } from '../features/account/useAccountBackup';
import { confirmUploadCopy, restoreQuestionCopy } from '../lib/accountBackupCopy';
import { I18nKey, t } from '../lib/i18n';
import { AppPreferences } from '../types/models';

/**
 * What the reader is told after a sign-in or a "Back up now", and the dialogs
 * that ask before anything is restored or uploaded.
 *
 * Moved out of App.tsx in the phase-B split (2026-09-30), verbatim and in the
 * order it stood there: presentAccountOutcome, handleAccountSignIn, then the
 * "Back up now" comment and handleAccountBackupNow. A hook because all three
 * are useCallbacks; their deps are as they were, the presenter's
 * eslint-disabled list (which leaves showToast out) included. The
 * account-name effect above them and handleSetupHandoffDone below stay in
 * App.tsx.
 */
export interface AccountOutcomeDeps {
  accountBackup: AccountBackupApi;
  preferences: AppPreferences;
  showToast: (message: string) => void;
}

export function useAccountOutcome(deps: AccountOutcomeDeps) {
  const { accountBackup, preferences, showToast } = deps;

  /**
   * The whole sign-in conversation: outcome toasts, and the one dialog that
   * appears when both the phone and the cloud hold data. Shared by the
   * hand-off card and the Settings row so both tell the same story.
   */
  const presentAccountOutcome = useCallback((outcome: SignInOutcome, failedKey: I18nKey) => {
    const language = preferences.appLanguage;
    if (outcome.kind === 'backed_up') {
      // No toast. The backup row states the result better than a bar can: it
      // carries the account and, in green, when the cloud copy was written.
      // A pill saying "Varmuuskopioitu" over a row that already says
      // "juuri nyt" is the class of message the reader has asked to be rid of
      // four times (#bugs 2026-08-26, prio 1).
      return outcome.kind;
    }
    if (outcome.kind === 'restored') {
      showToast(t(language, 'account.restore.restored'));
      return outcome.kind;
    }
    if (outcome.kind === 'restore_failed') {
      showToast(t(language, 'account.restore.failed'));
      return outcome.kind;
    }
    if (outcome.kind === 'failed') {
      showToast(t(language, failedKey));
      return outcome.kind;
    }
    if (outcome.kind === 'not_backed_up') {
      // Signed in all the same: "Sign-in failed" here told a signed-in reader
      // they were not. What failed is the backup.
      showToast(t(language, 'account.backupFailed'));
      return outcome.kind;
    }
    if (outcome.kind === 'unavailable') {
      showToast(t(language, 'account.signInUnavailable'));
      return outcome.kind;
    }
    if (outcome.kind === 'confirm_upload') {
      // Another account's data on this phone: asked before it becomes this
      // account's backup (break round, 2026-09-28). Not dismissable — the
      // pending question would dangle with the automatic backup held.
      const copy = confirmUploadCopy(outcome, language);
      Alert.alert(
        copy.title,
        copy.body,
        [
          { text: copy.skip, style: 'cancel', onPress: () => void accountBackup.resolveUploadChoice('skip') },
          {
            text: copy.upload,
            onPress: () => {
              void accountBackup.resolveUploadChoice('upload').then((result) => {
                // Only the failure speaks. Success is the row's green timestamp.
                if (result === 'failed') {
                  showToast(t(language, 'account.backupFailed'));
                }
              });
            },
          },
        ],
        { cancelable: false },
      );
      return outcome.kind;
    }
    if (outcome.kind !== 'choice') {
      // Cancelled: the reader changed their mind, or signed out meanwhile,
      // and neither is an error.
      return outcome.kind;
    }
    const copy = restoreQuestionCopy(outcome.summary, language);
    const keepLocal = () => {
      void accountBackup.resolveRestoreChoice('keep_local').then((result) => {
        // Only the failure speaks. Success is the row's green timestamp.
        if (result === 'failed') {
          showToast(t(language, 'account.backupFailed'));
        }
      });
    };
    const ask = () =>
      Alert.alert(
        copy.title,
        copy.body,
        [
          {
            text: copy.keepLocal,
            onPress: () => {
              const replace = copy.replace;
              if (!replace) {
                keepLocal();
                return;
              }
              // This phone holds far less than the cloud copy it would
              // replace — a phone that was just set up, or one whose
              // database was set aside. One tap was enough to lose the
              // history, so it is asked again, naming what goes.
              Alert.alert(
                replace.title,
                replace.body,
                [
                  // Back to the first question: dismissing would leave the
                  // pending choice dangling with no way back.
                  { text: replace.back, style: 'cancel', onPress: ask },
                  { text: replace.confirm, style: 'destructive', onPress: keepLocal },
                ],
                { cancelable: false },
              );
            },
          },
          {
            text: copy.useBackup,
            style: 'destructive',
            onPress: () => {
              void accountBackup.resolveRestoreChoice('restore').then((result) => {
                // Both results speak: this button replaces the phone's data, and
                // silence after it is no answer to whether it did.
                if (result !== 'cancelled') {
                  showToast(t(language, result === 'done' ? 'account.restore.restored' : 'account.restore.failed'));
                }
              });
            },
          },
        ],
        // Dismissing would leave the pending choice dangling with no way back.
        { cancelable: false },
      );
    ask();
    return outcome.kind;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountBackup, preferences.appLanguage]);

  const handleAccountSignIn = useCallback(
    async () => presentAccountOutcome(await accountBackup.signIn(), 'account.signInFailed'),
    [accountBackup, presentAccountOutcome],
  );

  // "Back up now" tells the same story as sign-in: on a phone that has never
  // synced it may have to ask restore-or-keep before it can write anything.
  const handleAccountBackupNow = useCallback(
    async () => presentAccountOutcome(await accountBackup.backUpOrAsk(), 'account.backupFailed'),
    [accountBackup, presentAccountOutcome],
  );

  return { handleAccountSignIn, handleAccountBackupNow };
}
