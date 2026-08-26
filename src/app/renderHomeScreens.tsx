import React from 'react';

import { isAiCoachLiveConfigured, requestProgrammeComposition } from '../lib/aiCoachClient';
import { recordCoachQuestion, resolveCoachQuota } from '../lib/aiCoachQuota';
import { buildProgrammeDraft, composeProgrammePreview, resolveLiveProposal } from '../lib/programmeBrief';
import { recordSuggestionAccepted, recordSuggestionRejected } from '../lib/coachSuggestions';
import { t } from '../lib/i18n';
import { ProgramLimitReachedError } from '../lib/programSlots';
import { AppRoute, ROOT_ROUTES } from '../navigation/routes';
import { haptics } from '../utils/haptics';
import { AICoachChatScreen } from '../screens/AICoachChatScreen';
import { AICoachScreen } from '../screens/AICoachScreen';
import { AiProgramComposerScreen } from '../screens/AiProgramComposerScreen';
import { CardioScreen } from '../screens/CardioScreen';
import { HistoryScreen } from '../screens/HistoryScreen';
import { SessionAnalysisScreen } from '../screens/SessionAnalysisScreen';
import {
  AppDatabase,
  AppPreferences,
  MeasurementKind,
  MeasurementUnit,
  WorkoutTemplateDraft,
} from '../types/models';

type ChatScreenProps = React.ComponentProps<typeof AICoachChatScreen>;
type CardioScreenProps = React.ComponentProps<typeof CardioScreen>;
type HistoryScreenProps = React.ComponentProps<typeof HistoryScreen>;

/**
 * The home tab's sub-screens — cardio, the coach surfaces, history and the
 * session analysis — moved verbatim from App.tsx's render chain in the
 * phase-A split (2026-08-26). The dashboard itself stays behind: it is the
 * chain's final else and doubles as the safety net for a route whose guard
 * state was just cleared, which is App.tsx's business, not a tab's.
 */
export interface HomeScreensDeps {
  route: AppRoute;
  navigate: (route: AppRoute) => void;
  navigateBack: (fallback?: AppRoute | null) => void;
  preferences: AppPreferences;
  updatePreferences: (patch: Partial<AppPreferences>) => Promise<unknown>;
  workout: { activeSession: unknown; discardWorkout: () => void };
  cardioSessions: CardioScreenProps['cardioSessions'];
  cardioSaving: boolean;
  setCardioSaving: (saving: boolean) => void;
  saveCardioSession: (input: Parameters<CardioScreenProps['onSaveCardioSession']>[0]) => Promise<unknown>;
  navigateToActiveWorkout: (message?: string) => boolean;
  setFinishSaveState: (value: {
    status: 'idle' | 'saving' | 'error';
    sessionId: string | null;
    message: string | null;
  }) => void;
  showToast: (message: string) => void;
  homeAiPromptSuggestions: React.ComponentProps<typeof AICoachScreen>['suggestions'];
  aiCoachTrainingContext: ChatScreenProps['trainingContext'];
  handleOpenAICoach: (prompt: string) => void;
  handleSelectAiCoachAction: React.ComponentProps<typeof AICoachScreen>['onSelectAction'];
  exerciseLibrary: AppDatabase['exerciseLibrary'];
  programSlots: { canCreate: boolean };
  setProgramLimitVisible: (visible: boolean) => void;
  workoutTemplates: Array<{ name: string }>;
  upsertWorkoutTemplate: (draft: WorkoutTemplateDraft) => Promise<string>;
  workoutSessions: HistoryScreenProps['sessions'];
  getSessionLogs: HistoryScreenProps['getSessionLogs'];
  deleteCompletedWorkoutSession: (sessionId: string) => Promise<unknown>;
  unitPreference: HistoryScreenProps['unitPreference'];
  coachProUnlocked: boolean;
  database: Pick<AppDatabase, 'workoutSessions' | 'bodyweightEntries' | 'measurementEntries'>;
  coachChatIntro: ChatScreenProps['intro'];
  coachLastSession: ChatScreenProps['lastSession'];
  homePinnedStatCardKeys: string[];
  addBodyweightEntry: (weightKg: number) => Promise<unknown>;
  addMeasurementEntry: (kind: MeasurementKind, value: number, unit: MeasurementUnit) => Promise<unknown>;
  accountBackup: { state: { status: string; email: string | null } };
  sessionAnalysis: React.ComponentProps<typeof SessionAnalysisScreen>['analysis'];
}

export function renderHomeScreens(deps: HomeScreensDeps): React.ReactElement | null {
  const {
    route,
    navigate,
    navigateBack,
    preferences,
    updatePreferences,
    workout,
    cardioSessions,
    cardioSaving,
    setCardioSaving,
    saveCardioSession,
    navigateToActiveWorkout,
    setFinishSaveState,
    showToast,
    homeAiPromptSuggestions,
    aiCoachTrainingContext,
    handleOpenAICoach,
    handleSelectAiCoachAction,
    exerciseLibrary,
    programSlots,
    setProgramLimitVisible,
    workoutTemplates,
    upsertWorkoutTemplate,
    workoutSessions,
    getSessionLogs,
    deleteCompletedWorkoutSession,
    unitPreference,
    coachProUnlocked,
    database,
    coachChatIntro,
    coachLastSession,
    homePinnedStatCardKeys,
    addBodyweightEntry,
    addMeasurementEntry,
    accountBackup,
    sessionAnalysis,
  } = deps;

  if (route.tab !== 'home') {
    return null;
  }

  if (route.screen === 'cardio') {
    return (
      <CardioScreen
        language={preferences.appLanguage}
        keepScreenAwake={preferences.keepScreenAwakeDuringWorkout}
        cardioSessions={cardioSessions}
        hasActiveStrengthSession={Boolean(workout.activeSession)}
        isSaving={cardioSaving}
        onResumeStrengthSession={() => {
          navigateToActiveWorkout();
        }}
        onDiscardStrengthSession={() => {
          workout.discardWorkout();
          setFinishSaveState({ status: 'idle', sessionId: null, message: null });
        }}
        onSaveCardioSession={async (input) => {
          setCardioSaving(true);
          try {
            await saveCardioSession(input);
            // No "saved" toast: the session appears in the history the screen
            // returns to, and the haptic says it landed (user 2026-08-26,
            // "kaikki tämmöiset pitäisi saada pois apista"). Failures still
            // speak — an error is the one thing that has no other signal.
            void haptics.success();
          } catch (error) {
            console.error('Failed to save cardio session', error);
            showToast(t(preferences.appLanguage, 'toast.cardioSaveFailed'));
            throw error;
          } finally {
            setCardioSaving(false);
          }
        }}
        onLeave={() => navigateBack(ROOT_ROUTES.home)}
      />
    );
  }

  if (route.screen === 'ai') {
    return (
      <AICoachScreen
        language={preferences.appLanguage}
        initialPrompt={route.prompt}
        suggestions={homeAiPromptSuggestions}
        trainingContext={aiCoachTrainingContext}
        onBack={() => navigateBack(ROOT_ROUTES.home)}
        onSubmitPrompt={handleOpenAICoach}
        onSelectAction={handleSelectAiCoachAction}
      />
    );
  }

  if (route.screen === 'ai_setup') {
    // "AI assisted", rebuilt as one text field (feedback round 2, #3). Live
    // when a coach server is configured, the deterministic composer
    // otherwise — the same proposal shape either way, and every exercise in
    // it a library exercise. Saving makes a programme of the reader's own,
    // which the free-tier cap counts like any other.
    return (
      <AiProgramComposerScreen
        language={preferences.appLanguage}
        // Keyed on the brief so a second handover from the chat mounts a fresh
        // screen instead of dropping a new brief into one already showing a
        // proposal for the old one.
        key={`compose:${route.brief ?? ''}`}
        preferences={preferences}
        liveConfigured={isAiCoachLiveConfigured()}
        initialBrief={route.brief}
        onBack={() => navigateBack(ROOT_ROUTES.home)}
        compose={async (brief) => {
          const live = await requestProgrammeComposition({
            brief,
            context: aiCoachTrainingContext,
            language: preferences.appLanguage,
          });
          if (live) {
            return resolveLiveProposal(live, brief, exerciseLibrary, preferences.defaultRestSeconds);
          }
          return composeProgrammePreview(brief, preferences, exerciseLibrary);
        }}
        onSave={async (proposal) => {
          if (!programSlots.canCreate) {
            setProgramLimitVisible(true);
            return;
          }
          const draft = buildProgrammeDraft(
            proposal,
            workoutTemplates.map((item) => item.name),
          );
          try {
            const workoutTemplateId = await upsertWorkoutTemplate(draft);
            // The programme's own page is the confirmation — it opens next.
            void haptics.success();
            navigate({ tab: 'workout', screen: 'program', programType: 'custom', workoutTemplateId });
          } catch (error) {
            if (error instanceof ProgramLimitReachedError) {
              setProgramLimitVisible(true);
              return;
            }
            console.error('Failed to save composed programme', error);
            showToast(t(preferences.appLanguage, 'toast.aiBuildFailed'));
          }
        }}
      />
    );
  }

  if (route.screen === 'history' || route.screen === 'session') {
    return (
      <HistoryScreen
        sessions={workoutSessions}
        cardioSessions={cardioSessions}
        unitPreference={unitPreference}
        language={preferences.appLanguage}
        selectedSessionId={route.screen === 'session' ? route.sessionId : undefined}
        getSessionLogs={getSessionLogs}
        onSelectSession={(sessionId) => navigate({ tab: 'home', screen: 'session', sessionId })}
        onDeleteSession={(sessionId) => void deleteCompletedWorkoutSession(sessionId)}
        onBack={() => navigateBack(ROOT_ROUTES.home)}
      />
    );
  }

  if (route.screen === 'ai_chat') {
    return (
      <AICoachChatScreen
        language={preferences.appLanguage}
        proUnlocked={coachProUnlocked}
        liveConfigured={isAiCoachLiveConfigured()}
        onlineNoticeAcknowledged={preferences.aiOnlineNoticeAcknowledged}
        onAcknowledgeOnlineNotice={() => void updatePreferences({ aiOnlineNoticeAcknowledged: true })}
        freeQuestionsRemaining={resolveCoachQuota(preferences.aiCoachFreeQuota).remaining}
        onFreeQuestionUsed={() =>
          void updatePreferences({ aiCoachFreeQuota: recordCoachQuestion(preferences.aiCoachFreeQuota) })
        }
        trainingContext={aiCoachTrainingContext}
        intro={coachChatIntro}
        sessionCount={database.workoutSessions.length}
        quickAskKeys={['coach.chip.analyze', 'coach.chip.program', 'coach.chip.protein']}
        lastSession={coachLastSession}
        onOpenAnalysis={(sessionId) => navigate({ tab: 'home', screen: 'analysis', sessionId })}
        onOpenPremium={() => navigate({ tab: 'profile', screen: 'premium' })}
        pinnedStatCardKeys={homePinnedStatCardKeys}
        onLogMeasurement={async (intent) => {
          if (intent.kind === 'bodyweight') {
            await addBodyweightEntry(intent.value);
          } else {
            await addMeasurementEntry(intent.kind, intent.value, intent.unit === 'kg' ? 'cm' : intent.unit);
          }
        }}
        onPinStatCard={(key) => {
          if (!homePinnedStatCardKeys.includes(key)) {
            void updatePreferences({ homeStatCardKeys: [...homePinnedStatCardKeys, key] });
          }
        }}
        onSetGoal={async (intent) => {
          const latestOf = (values: Array<{ recordedAt: string; value: number }>) =>
            values.length > 0
              ? values.reduce((best, entry) => (entry.recordedAt > best.recordedAt ? entry : best)).value
              : null;
          const startValue =
            intent.kind === 'bodyweight'
              ? latestOf(database.bodyweightEntries.map((entry) => ({ recordedAt: entry.recordedAt, value: entry.weight })))
              : latestOf(
                  database.measurementEntries
                    .filter((entry) => entry.kind === intent.kind)
                    .map((entry) => ({ recordedAt: entry.recordedAt, value: entry.value })),
                );
          const id = `goal-${Date.now().toString(36)}`;
          await updatePreferences({
            coachGoals: [
              // One goal per kind: restating replaces, it does not stack.
              ...preferences.coachGoals.filter((goal) => goal.kind !== intent.kind),
              {
                id,
                text: intent.text,
                kind: intent.kind,
                targetValue: intent.targetValue,
                unit: intent.unit ?? (intent.kind === 'bodyweight' ? 'kg' : intent.kind === 'bodyfat' ? '%' : 'cm'),
                startValue,
                createdAt: new Date().toISOString(),
              },
            ],
            // Saying a goal out loud makes it the one the coach answers
            // against. There is no other way to change it yet — goals have no
            // screen of their own — so the spoken word has to be the switch.
            primaryGoalId: id,
          });
        }}
        weighInReminderEnabled={preferences.notificationPrefs.weighInReminder}
        onOpenMeasure={(kind) =>
          // Bodyweight has a screen of its own; everything else is a section
          // of Progress that can open on the right measurement.
          navigate(
            kind === 'bodyweight'
              ? { tab: 'progress', screen: 'bodyweight' }
              : { tab: 'progress', screen: 'list', section: 'measures', measure: kind },
          )
        }
        onEnableWeighInReminder={() =>
          void updatePreferences({
            notificationPrefs: { ...preferences.notificationPrefs, weighInReminder: true },
          })
        }
        onCoachSuggestionResolved={(kind, accepted) =>
          void updatePreferences({
            coachSuggestionState: accepted
              ? recordSuggestionAccepted(preferences.coachSuggestionState, kind)
              : recordSuggestionRejected(preferences.coachSuggestionState, kind),
          })
        }
        // The conversation, handed to the composer. The route guard sends a
        // free reader to the Pro page from here, which is why the button below
        // the offer says so before it is tapped.
        onComposeProgramme={(brief) => navigate({ tab: 'home', screen: 'ai_setup', brief })}
        transcriptReporter={accountBackup.state.status === 'signed_in' ? accountBackup.state.email : null}
      />
    );
  }

  if (route.screen === 'analysis') {
    return (
      <SessionAnalysisScreen
        analysis={sessionAnalysis}
        language={preferences.appLanguage}
        onBack={() => navigateBack(ROOT_ROUTES.home)}
        onAskCoach={() => navigate({ tab: 'home', screen: 'ai_chat' })}
      />
    );
  }

  return null;
}
