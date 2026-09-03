import React from 'react';
import { Alert } from 'react-native';

import { AccountBackupApi } from '../features/account/useAccountBackup';
import { buildCancelSurveyAnswer } from '../lib/cancelSurvey';
import { isDemoBuild } from '../lib/demoMode';
import { formatWorkoutDisplayLabel } from '../lib/displayLabel';
import { t } from '../lib/i18n';
import { localizeSessionFocus } from '../lib/sessionNameLabel';
import { MOCK_BILLING, nextChargeAt } from '../lib/subscriptionView';
import { AppRoute, ROOT_ROUTES } from '../navigation/routes';
import {
  getNotificationPermissionGranted,
  requestNotificationPermission,
} from '../utils/appNotifications';
import { EditProfileScreen } from '../screens/EditProfileScreen';
import { ExportPlanScreen } from '../screens/ExportPlanScreen';
import { LegalDocumentScreen } from '../screens/LegalDocumentScreen';
import { MembershipEndScreen } from '../screens/MembershipEndScreen';
import { MilestonesScreen } from '../screens/MilestonesScreen';
import { MyDataScreen } from '../screens/MyDataScreen';
import { NotificationsScreen } from '../screens/NotificationsScreen';
import { PremiumScreen } from '../screens/PremiumScreen';
import { PremiumUnlockScreen } from '../screens/PremiumUnlockScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { PromoCodeScreen } from '../screens/PromoCodeScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { SubscriptionScreen } from '../screens/SubscriptionScreen';
import { TrainingBreakScreen } from '../screens/TrainingBreakScreen';
import { TrainingPlanScreen } from '../screens/TrainingPlanScreen';
import { AppDatabase, AppPreferences, SetupWeekday, WorkoutTemplateDraft } from '../types/models';
import { CompletionSummaryState, WorkoutCelebrationState } from './workoutCompletionState';

/**
 * The profile tab's screens, one route branch each — moved verbatim from
 * App.tsx's render chain in the phase-A split (2026-08-26). Plain functions,
 * not components, so React sees exactly the tree the chain produced and no
 * remount semantics change.
 *
 * The deps interface is the seam: everything a profile screen needs from the
 * switchboard, named. Types lean on ComponentProps where the screen already
 * owns the shape, so this file never restates one.
 */
export interface ProfileTabDeps {
  route: AppRoute;
  navigate: (route: AppRoute) => void;
  navigateBack: (fallback?: AppRoute | null) => void;
  resetToRoute: (route: AppRoute) => void;
  preferences: AppPreferences;
  updatePreferences: (patch: Partial<AppPreferences>) => Promise<unknown>;
  coachProUnlocked: boolean;
  proCoachSpecimen: React.ComponentProps<typeof PremiumUnlockScreen>['coachSpecimen'];
  proEntitlement: React.ComponentProps<typeof SubscriptionScreen>['entitlement'];
  profilePlanSummary: {
    name: string | null;
    daysPerWeek: number | null;
    exerciseCount: number | null;
    sessionNames: string[];
  };
  homeActivePlanCard: {
    programId: string;
    programType: 'ready' | 'custom';
    nextSession: { id: string };
    sessions: Array<{
      id: string;
      title: string;
      exercises: Array<{ name: string }>;
      totalSets?: number | null;
    }>;
  } | null;
  exerciseBrowserItems: React.ComponentProps<typeof TrainingPlanScreen>['exerciseLibrary'];
  exerciseNameBook: React.ComponentProps<typeof TrainingPlanScreen>['nameBook'];
  teachExerciseName: (wrote: string, target: { name: string; libraryItemId: string }) => void;
  handlePickProgramImage: () => Promise<string | null>;
  handleChangeTrainingDays: (days: SetupWeekday[]) => Promise<void>;
  programSlots: { canCreate: boolean };
  setProgramLimitVisible: (visible: boolean) => void;
  upsertWorkoutTemplate: (draft: WorkoutTemplateDraft) => Promise<string>;
  /** How many ready programmes the sheet's catalog door is promising. */
  readyProgramCount: number;
  /** Whether AI-assisted composition opens the chat or the paywall. */
  proUnlocked: boolean;
  exportablePlans: React.ComponentProps<typeof ExportPlanScreen>['plans'];
  database: Pick<AppDatabase, 'workoutSessions' | 'exerciseLogs'>;
  settingsScrollOffsetRef: React.MutableRefObject<number>;
  homeWidgetState: { supported: boolean; added: boolean } | null;
  handleAddHomeWidget: () => Promise<void>;
  accountBackup: AccountBackupApi;
  handleAccountSignIn: () => Promise<unknown>;
  showToast: (message: string) => void;
  setSettingsImportVisible: (visible: boolean) => void;
  setRatingSheetVisible: (visible: boolean) => void;
  resetAllData: () => Promise<void>;
  setCompletionSummary: (value: CompletionSummaryState | null) => void;
  setWorkoutCelebration: (value: WorkoutCelebrationState | null) => void;
  setFinishSaveState: (value: {
    status: 'idle' | 'saving' | 'error';
    sessionId: string | null;
    message: string | null;
  }) => void;
  workout: { clearCompletedWorkout: () => void };
  lifetimeSummary: React.ComponentProps<typeof ProfileScreen>['lifetime'];
  milestoneLedger: React.ComponentProps<typeof MilestonesScreen>['ledger'];
  trackedProgress: React.ComponentProps<typeof ProfileScreen>['trackedProgress'];
  exerciseLibrary: React.ComponentProps<typeof ProfileScreen>['exerciseLibrary'];
  unitPreference: React.ComponentProps<typeof ProfileScreen>['unitPreference'];
  homeTrainingDayIndexes: number[];
  distinctRecordCount: number;
}

export function renderProfileTab(deps: ProfileTabDeps): React.ReactElement | null {
  const {
    route,
    navigate,
    navigateBack,
    resetToRoute,
    preferences,
    updatePreferences,
    coachProUnlocked,
    proCoachSpecimen,
    proEntitlement,
    profilePlanSummary,
    homeActivePlanCard,
    exerciseBrowserItems,
    exerciseNameBook,
    teachExerciseName,
    handlePickProgramImage,
    handleChangeTrainingDays,
    programSlots,
    setProgramLimitVisible,
    upsertWorkoutTemplate,
    readyProgramCount,
    proUnlocked,
    exportablePlans,
    database,
    settingsScrollOffsetRef,
    homeWidgetState,
    handleAddHomeWidget,
    accountBackup,
    handleAccountSignIn,
    showToast,
    setSettingsImportVisible,
    setRatingSheetVisible,
    resetAllData,
    setCompletionSummary,
    setWorkoutCelebration,
    setFinishSaveState,
    workout,
    lifetimeSummary,
    milestoneLedger,
    trackedProgress,
    exerciseLibrary,
    unitPreference,
    homeTrainingDayIndexes,
    distinctRecordCount,
  } = deps;

  if (route.tab !== 'profile') {
    return null;
  }

  if (route.screen === 'premium') {
    return (
      <PremiumScreen
        reason={route.reason ?? null}
        language={preferences.appLanguage}
        proUnlocked={coachProUnlocked}
        onManageSubscription={() => navigate({ tab: 'profile', screen: 'subscription' })}
        onBack={() => navigateBack(ROOT_ROUTES.profile)}
        onPurchase={(plan) => {
          /**
           * The one purchase in the app.
           *
           * There is no billing account yet, so no money moves — but everything
           * else is real: the instant and the term are recorded, every renewal
           * date in the app is counted from them rather than written (the bug
           * #bugs logged when the receipt shipped a hardcoded "15.9.2026"),
           * cancelling runs it to the end of the period, and then the
           * entitlement stops. Wiring billing replaces this one write and
           * nothing else.
           *
           * It only ever turns Pro ON. The button that used to turn it back off
           * from this page is gone: ending a membership is the subscription
           * screen's job, and a paywall with an off switch is not a paywall.
           */
          void updatePreferences({
            mockSubscriptionPurchasedAt: new Date().toISOString(),
            mockSubscriptionTerm: plan,
            // A re-purchase after cancelling starts a fresh subscription.
            mockSubscriptionCancelledAt: null,
          });
          navigate({ tab: 'profile', screen: 'premium_unlock', plan });
        }}
        onOpenLegal={(document) => navigate({ tab: 'profile', screen: 'legal', document })}
      />
    );
  }

  if (route.screen === 'premium_unlock') {
    return (
      <PremiumUnlockScreen
        language={preferences.appLanguage}
        plan={route.plan}
        // The reads just unlocked; this is the first one, from their own log.
        coachSpecimen={proCoachSpecimen}
        onOpenAnalysis={() => navigate({ tab: 'progress', screen: 'list' })}
        onManageSubscription={() => navigate({ tab: 'profile', screen: 'subscription' })}
        onSeeEverything={() => navigate({ tab: 'profile', screen: 'premium' })}
        // The badge names the moment only when there is a record of it. A
        // promo went live when it was redeemed, not now — with no instant to
        // show, the badge says "live" and leaves the time out.
        liveSince={preferences.mockSubscriptionPurchasedAt ?? null}
        // Counted here, from the instant the purchase was recorded plus the
        // term's own length. One function, shared with the subscription screen.
        renewsAt={nextChargeAt(
          route.plan ?? preferences.mockSubscriptionTerm,
          preferences.mockSubscriptionPurchasedAt ?? MOCK_BILLING.lastChargedAt,
        )}
        // "Takaisin treeniin" goes to Home, not back to the tab the purchase
        // happened to start from. The route lives under `profile` because the
        // paywall does, but the button names a destination and the reader takes
        // it literally: Home is where training starts.
        //
        // Straight Home. The theme offer used to sit in between, because the
        // unlock screen listed dark as one of the things that just changed —
        // it does not any more (free since 2026-08-23), and offering a choice
        // the reader already made during onboarding is asking twice.
        onDone={() => resetToRoute(ROOT_ROUTES.home)}
      />
    );
  }

  if (route.screen === 'training_plan') {
    return (
      <TrainingPlanScreen
        language={preferences.appLanguage}
        startEditingSchedule={route.editSchedule === true}
        planName={profilePlanSummary.name}
        planType={homeActivePlanCard?.programType ?? null}
        planDaysPerWeek={profilePlanSummary.daysPerWeek}
        planExerciseCount={profilePlanSummary.exerciseCount}
        sessions={(homeActivePlanCard?.sessions ?? []).map((session) => ({
          id: session.id,
          // Focus only, no "Päivä N:" — the row's position already says which
          // day this is, and the ordinal cost the name its width (#bugs
          // 2026-08-25).
          title: localizeSessionFocus(formatWorkoutDisplayLabel(session.title), preferences.appLanguage),
          exerciseCount: session.exercises.length,
          totalSets: session.totalSets ?? 0,
          isNext: session.id === homeActivePlanCard?.nextSession.id,
        }))}
        trainingDays={preferences.setupAvailableDays}
        trainingCycle={preferences.trainingCycle}
        exerciseLibrary={exerciseBrowserItems}
        nameBook={exerciseNameBook}
        onTeachName={(wrote, exercise) => teachExerciseName(wrote, { name: exercise.name, libraryItemId: exercise.id })}
        onPickImage={handlePickProgramImage}
        onBack={() => navigateBack(ROOT_ROUTES.profile)}
        onChangeTrainingDays={(days) => void handleChangeTrainingDays(days)}
        onChangeTrainingCycle={(cycle) => void updatePreferences({ trainingCycle: cycle })}
        onEditCustomPlan={
          homeActivePlanCard?.programType === 'custom'
            ? () =>
                navigate({ tab: 'workout', screen: 'template', workoutTemplateId: homeActivePlanCard.programId })
            : undefined
        }
        onAiAssisted={() => navigate({ tab: 'home', screen: 'ai_chat' })}
        onBrowseCatalog={() => navigate({ tab: 'workout', screen: 'catalog' })}
        catalogCount={readyProgramCount}
        proUnlocked={proUnlocked}
        onOpenPaywall={() => navigate({ tab: 'profile', screen: 'premium' })}
        onBuildYourself={() =>
          programSlots.canCreate
            ? navigate({ tab: 'workout', screen: 'template' })
            : setProgramLimitVisible(true)
        }
        onImportProgram={async (draft) => {
          const workoutTemplateId = await upsertWorkoutTemplate(draft);
          navigate({ tab: 'workout', screen: 'program', programType: 'custom', workoutTemplateId });
        }}
      />
    );
  }

  if (route.screen === 'notifications') {
    return (
      <NotificationsScreen
        language={preferences.appLanguage}
        prefs={preferences.notificationPrefs}
        trainingDays={preferences.setupAvailableDays}
        onTrainingBreak={preferences.trainingBreak !== null}
        onBack={() => navigateBack({ tab: 'profile', screen: 'settings' })}
        onChange={(patch) =>
          void updatePreferences({ notificationPrefs: { ...preferences.notificationPrefs, ...patch } })
        }
        requestPermission={requestNotificationPermission}
        checkPermission={getNotificationPermissionGranted}
        onOpenTrainingPlan={() => navigate({ tab: 'profile', screen: 'training_plan' })}
      />
    );
  }

  if (route.screen === 'training_break') {
    return (
      <TrainingBreakScreen
        language={preferences.appLanguage}
        trainingBreak={preferences.trainingBreak}
        onBack={() => navigateBack({ tab: 'profile', screen: 'settings' })}
        onStartBreak={(reason, note) =>
          void updatePreferences({ trainingBreak: { reason, note, startedAt: new Date().toISOString() } })
        }
        onEndBreak={() => void updatePreferences({ trainingBreak: null })}
      />
    );
  }

  if (route.screen === 'milestones') {
    return (
      <MilestonesScreen
        language={preferences.appLanguage}
        lifetime={lifetimeSummary}
        ledger={milestoneLedger}
        unitPreference={unitPreference}
        onBack={() => navigateBack({ tab: 'profile', screen: 'list' })}
      />
    );
  }

  if (route.screen === 'promo') {
    return (
      <PromoCodeScreen
        language={preferences.appLanguage}
        promoProUntil={preferences.promoProUntil}
        // The one rule about who has Pro, not a second clock comparison.
        promoActive={proEntitlement.source === 'promo'}
        onBack={() => navigateBack({ tab: 'profile', screen: 'settings' })}
        // Only the promo date is stored. Flipping the preview switch here too
        // would make a 30-day code permanent Pro, because nothing ever turns
        // that switch back off — resolveProEntitlement reads the date itself.
        onRedeemed={(proUntilIso) => void updatePreferences({ promoProUntil: proUntilIso })}
      />
    );
  }

  if (route.screen === 'subscription') {
    return (
      <SubscriptionScreen
        language={preferences.appLanguage}
        entitlement={proEntitlement}
        // Only an *expired* promo means "lapsed". A live one is active Pro and
        // resolveSubscriptionView reads it from the entitlement instead.
        lapsedPromoUntil={proEntitlement.unlocked ? null : preferences.promoProUntil}
        mockTerm={preferences.mockSubscriptionTerm}
        mockCancelled={preferences.mockSubscriptionCancelledAt !== null}
        purchasedAt={preferences.mockSubscriptionPurchasedAt}
        onChangeMockTerm={(term) => void updatePreferences({ mockSubscriptionTerm: term })}
        onChangeMockCancelled={(cancelled) =>
          void updatePreferences({
            mockSubscriptionCancelledAt: cancelled ? new Date().toISOString() : null,
          })
        }
        demoBuild={isDemoBuild()}
        onBack={() => navigateBack({ tab: 'profile', screen: 'settings' })}
        onManageMembership={() => navigate({ tab: 'profile', screen: 'membership_end' })}
        onOpenPremium={() => navigate({ tab: 'profile', screen: 'premium' })}
      />
    );
  }

  if (route.screen === 'membership_end') {
    return (
      <MembershipEndScreen
        language={preferences.appLanguage}
        // The entitlement names its own source, so the screen never has to
        // guess which of promo / demo switch is keeping Pro on.
        source={proEntitlement.source ?? 'none'}
        promoUntil={proEntitlement.promoUntil}
        // Counted from the same instant the subscription screen counts from,
        // or the two screens name different dates for the same period.
        periodEndsAt={nextChargeAt(
          preferences.mockSubscriptionTerm,
          preferences.mockSubscriptionPurchasedAt ?? MOCK_BILLING.lastChargedAt,
        )}
        onBack={() => navigateBack({ tab: 'profile', screen: 'subscription' })}
        onKeep={() => navigateBack({ tab: 'profile', screen: 'subscription' })}
        // Cancelling leaves Pro switched ON until the period ends — that is what
        // the page promises two lines above the button, so ending it on the spot
        // would contradict the screen the reader is standing on.
        onEndNow={() => void updatePreferences({ mockSubscriptionCancelledAt: new Date().toISOString() })}
        onSurveyDone={(reasons, note) => {
          const answer = buildCancelSurveyAnswer(reasons, note, new Date().toISOString());
          if (answer) {
            void updatePreferences({ cancelSurveyAnswer: answer });
          }
        }}
      />
    );
  }

  if (route.screen === 'legal') {
    return (
      <LegalDocumentScreen
        document={route.document}
        language={preferences.appLanguage}
        onBack={() => navigateBack({ tab: 'profile', screen: 'settings' })}
      />
    );
  }

  if (route.screen === 'edit_profile') {
    return (
      <EditProfileScreen
        language={preferences.appLanguage}
        initialName={preferences.profileName}
        onBack={() => navigateBack({ tab: 'profile', screen: 'settings' })}
        onSave={(name) => void updatePreferences({ profileName: name })}
      />
    );
  }

  if (route.screen === 'my_data') {
    return (
      <MyDataScreen
        language={preferences.appLanguage}
        preferences={preferences}
        onBack={() => navigateBack({ tab: 'profile', screen: 'settings' })}
        onSaveBasics={(patch) => void updatePreferences(patch)}
        onEditLimitations={() => navigate({ tab: 'profile', screen: 'setup', stage: 'avoid' })}
        onCreateNewPlan={() => navigate({ tab: 'profile', screen: 'setup', stage: 'location' })}
      />
    );
  }

  if (route.screen === 'export_plan') {
    return (
      <ExportPlanScreen
        language={preferences.appLanguage}
        plans={exportablePlans}
        log={{ sessions: database.workoutSessions, logs: database.exerciseLogs }}
        onBack={() => navigateBack({ tab: 'profile', screen: 'settings' })}
      />
    );
  }

  if (route.screen === 'settings') {
    return (
      <SettingsScreen
        preferences={preferences}
        initialScrollOffset={settingsScrollOffsetRef.current}
        onScrollOffsetChange={(offsetY) => {
          settingsScrollOffsetRef.current = offsetY;
        }}
        onOpenEditProfile={() => navigate({ tab: 'profile', screen: 'edit_profile' })}
        onBack={() => navigateBack(ROOT_ROUTES.profile)}
        onPreferencesChange={async (patch) => {
          await updatePreferences(patch);
        }}
        onOpenMyData={() => navigate({ tab: 'profile', screen: 'my_data' })}
        onImportPlan={() => setSettingsImportVisible(true)}
        onExportPlan={() => navigate({ tab: 'profile', screen: 'export_plan' })}
        homeWidget={
          homeWidgetState?.supported
            ? { added: homeWidgetState.added, onAdd: () => void handleAddHomeWidget() }
            : null
        }
        onOpenNotifications={() => navigate({ tab: 'profile', screen: 'notifications' })}
        onOpenTrainingBreak={() => navigate({ tab: 'profile', screen: 'training_break' })}
        onOpenPromo={() => navigate({ tab: 'profile', screen: 'promo' })}
        onOpenSubscription={() => navigate({ tab: 'profile', screen: 'subscription' })}
        onOpenPremium={() => navigate({ tab: 'profile', screen: 'premium' })}
        account={
          accountBackup.available
            ? {
                signedIn: accountBackup.state.status === 'signed_in',
                email: accountBackup.state.email,
                lastBackupAt: accountBackup.state.lastBackupAt,
                busy: accountBackup.phase !== 'idle',
                onSignIn: () => void handleAccountSignIn(),
                onBackupNow: () => {
                  void accountBackup.backupNow().then((ok) => {
                    // Only the failure speaks; the row's green timestamp is
                    // the success, and it is already on screen.
                    if (!ok) {
                      showToast(t(preferences.appLanguage, 'account.backupFailed'));
                    }
                  });
                },
                onSignOut: () => void accountBackup.signOut(),
                onDeleteRemote: () => {
                  Alert.alert(
                    t(preferences.appLanguage, 'account.deleteRemote'),
                    t(preferences.appLanguage, 'account.deleteRemote.sub'),
                    [
                      { text: t(preferences.appLanguage, 'common.cancel'), style: 'cancel' },
                      {
                        text: t(preferences.appLanguage, 'account.deleteRemote'),
                        style: 'destructive',
                        onPress: () => {
                          // The one the reader photographed off the phone and
                          // marked prio 1: a white bar reading "Pilvivarmuus-
                          // kopio poistettu" over a row that has just changed
                          // to "Ei vielä varmuuskopiota". The row is the
                          // answer; the bar was the app saying it twice.
                          void accountBackup.deleteRemoteBackup();
                        },
                      },
                    ],
                  );
                },
              }
            : null
        }
        onOpenLegal={(document) => navigate({ tab: 'profile', screen: 'legal', document })}
        onResetAllData={async () => {
          // Sign out BEFORE wiping: reset while signed in would let the
          // auto-backup push the freshly emptied database over the cloud
          // copy — the reset would silently destroy the one safety net it
          // is the safety net for. Signed out, the cloud copy survives and
          // the next sign-in offers it back.
          await accountBackup.signOut();
          await resetAllData();
          setCompletionSummary(null);
          setWorkoutCelebration(null);
          setFinishSaveState({ status: 'idle', sessionId: null, message: null });
          workout.clearCompletedWorkout();
          resetToRoute(ROOT_ROUTES.home);
        }}
      />
    );
  }

  return (
    <ProfileScreen
      preferences={preferences}
      lifetime={lifetimeSummary}
      trackedProgress={trackedProgress}
      exerciseLibrary={exerciseLibrary}
      unitPreference={unitPreference}
      onOpenSettings={() => navigate({ tab: 'profile', screen: 'settings' })}
      recordCount={distinctRecordCount}
      milestoneLedger={milestoneLedger}
      onOpenMilestones={() => navigate({ tab: 'profile', screen: 'milestones' })}
      onOpenRecords={() => navigate({ tab: 'progress', screen: 'list', section: 'records' })}
      onEditProfile={() => navigate({ tab: 'profile', screen: 'edit_profile' })}
      onOpenRating={() => setRatingSheetVisible(true)}
    />
  );
}
