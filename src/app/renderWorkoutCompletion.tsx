import React from 'react';

import type { CoachDemoMoment } from '../lib/coachDemoMoments';
import { AppRoute, ROOT_ROUTES } from '../navigation/routes';
import { WorkoutCompletionScreen } from '../screens/WorkoutCompletionScreen';
import { AppPreferences, SessionFeel } from '../types/models';
import type { CompletionSummaryState } from './workoutCompletionState';

type CompletionProps = React.ComponentProps<typeof WorkoutCompletionScreen>;

/**
 * Workout Complete, moved verbatim from App.tsx's render chain in phase C of
 * the split (2026-10-01). The branch's guard — the route AND a summary still
 * in hand — stays in App.tsx: when the finish-flow state was just cleared the
 * chain must fall through to the dashboard, which is App.tsx's business.
 */
export interface WorkoutCompletionDeps {
  preferences: AppPreferences;
  completionWeekProgress: CompletionProps['weekProgress'];
  guidedNextUp: CompletionProps['nextUp'];
  completionSummary: CompletionSummaryState;
  coachProUnlocked: boolean;
  proCompletionMoment: {
    conclusion: { teaser: string; body: string };
    moment: NonNullable<CompletionProps['lockedInsight']>['moment'];
  } | null;
  navigate: (nextRoute: AppRoute) => void;
  coachDemoQuestion: string | null;
  coachDemoMoment: CoachDemoMoment | null;
  updateCompletedWorkoutSession: (sessionId: string, patch: { feel?: SessionFeel | null }) => Promise<void>;
  workout: { clearCompletedWorkout: () => void };
  leaveFinishedWorkout: (nextRoute: AppRoute) => void;
}

export function renderWorkoutCompletion(deps: WorkoutCompletionDeps): React.ReactNode {
  const {
    preferences,
    completionWeekProgress,
    guidedNextUp,
    completionSummary,
    coachProUnlocked,
    proCompletionMoment,
    navigate,
    coachDemoQuestion,
    coachDemoMoment,
    updateCompletedWorkoutSession,
    workout,
    leaveFinishedWorkout,
  } = deps;

  let content: React.ReactNode = null;
  content = (
    <WorkoutCompletionScreen
      language={preferences.appLanguage}
      weekProgress={completionWeekProgress}
      nextUp={guidedNextUp}
      workoutName={completionSummary.workoutName}
      performedAt={completionSummary.performedAt}
      durationMinutes={completionSummary.durationMinutes}
      setsCompleted={completionSummary.setsCompleted}
      exercisesLogged={completionSummary.exercisesLogged}
      muscles={completionSummary.muscles}
      exerciseCards={completionSummary.exerciseCards}
      whatMoved={completionSummary.whatMoved}
      movementById={completionSummary.movementById}
      prCards={completionSummary.prCards}
      // Moment 1 is for free users only — Pro gets the conclusions unlocked
      // at the surfaces where they live, not a lock on its own screen.
      lockedInsight={
        !coachProUnlocked && proCompletionMoment
          ? {
              teaser: proCompletionMoment.conclusion.teaser,
              body: proCompletionMoment.conclusion.body,
              moment: proCompletionMoment.moment,
            }
          : null
      }
      onOpenPremium={() => navigate({ tab: 'profile', screen: 'premium' })}
      demoQuestion={coachDemoQuestion}
      onSendDemoQuestion={() => {
        if (!coachDemoMoment || !coachDemoQuestion) {
          return;
        }
        // Spending it HERE was wrong, and the device found it: the chat
        // will not send while the online disclosure is unacknowledged, so a
        // reader who met that sheet for the first time and backed out lost
        // one of three answers without ever getting one. The moment is now
        // spent by the chat, at the moment it actually dispatches the send.
        navigate({
          tab: 'home',
          screen: 'ai_chat',
          demoQuestion: coachDemoQuestion,
          demoMomentKey: coachDemoMoment.key,
        });
      }}
      onDone={(feel) => {
        // The verdict lands on the already-saved session; leaving does not
        // wait for the write (it goes through the same serial queue every
        // other database write uses).
        if (feel) {
          void updateCompletedWorkoutSession(completionSummary.sessionId, { feel });
        }
        workout.clearCompletedWorkout();
        leaveFinishedWorkout(ROOT_ROUTES.home);
      }}
    />
  );
  return content;
}
