export type RootTabKey = 'home' | 'workout' | 'progress' | 'profile';

export type AppRoute =
  | {
      tab: 'home';
      screen: 'dashboard';
    }
  | {
      /** The middle AI button. Always the chat — never a paywall. */
      tab: 'home';
      screen: 'ai_chat';
      /**
       * A question the app is asking on the reader's behalf, carried in from a
       * coach demo moment. Present only on the hop out of the completion
       * screen; the chat clears it as it sends.
       */
      demoQuestion?: string;
      /** Which moment it is, so the chat can spend it when it truly sends. */
      demoMomentKey?: string;
    }
  | {
      tab: 'home';
      screen: 'ai';
      prompt?: string;
    }
  | {
      tab: 'home';
      screen: 'history';
    }
  | {
      tab: 'home';
      screen: 'cardio';
    }
  | {
      tab: 'home';
      screen: 'session';
      sessionId: string;
    }
  | {
      /** The coach's written-out analysis of one logged session. */
      tab: 'home';
      screen: 'analysis';
      sessionId: string;
    }
  | {
      tab: 'workout';
      screen: 'programs_home';
    }
  | {
      /**
       * A season as a screen, not a filter: dates, week N of 26, the reader's
       * own points and the programs that belong to it.
       */
      tab: 'workout';
      screen: 'season';
      season: 'winter' | 'summer';
    }
  | {
      /**
       * Ready-made targets. Its own screen rather than a sheet on the Programs
       * tab, because "what am I aiming at" is a decision, and a decision that
       * arrives as a drawer over the thing you were reading gets dismissed.
       */
      tab: 'workout';
      screen: 'goalPicker';
    }
  | {
      tab: 'workout';
      screen: 'list';
    }
  | {
      tab: 'workout';
      screen: 'plans';
    }
  | {
      tab: 'workout';
      screen: 'detail';
      exerciseId: string;
    }
  | {
      tab: 'workout';
      screen: 'program';
      programType: 'ready' | 'custom';
      workoutTemplateId: string;
    }
  | {
      tab: 'workout';
      screen: 'programDay';
      programType: 'ready' | 'custom';
      workoutTemplateId: string;
      sessionId: string;
    }
  | {
      tab: 'workout';
      screen: 'empty';
    }
  | {
      tab: 'workout';
      screen: 'editor';
      workoutTemplateId?: string;
      prefillName?: string;
      prefillExerciseLibraryId?: string;
    }
  | {
      tab: 'workout';
      screen: 'template';
      workoutTemplateId?: string;
    }
  | {
      tab: 'workout';
      screen: 'guided';
      workoutTemplateId: string;
    }
  | {
      tab: 'workout';
      screen: 'summary';
    }
  | {
      tab: 'workout';
      screen: 'celebration';
    }
  | {
      tab: 'progress';
      screen: 'list';
      section?: 'overview' | 'records' | 'tracked' | 'measures';
      /**
       * Which measurement the measures section opens on. A Home stat card for
       * body fat used to open the section on whatever was selected last, and
       * the reader had to find body fat again to log it.
       */
      measure?: string;
      /**
       * Scroll the overview to a named block on arrival. The widget's
       * calendar tap lands here, and the calendar lives mid-page — arriving
       * at the top of the overview is arriving somewhere else (2026-08-25).
       */
      scrollTo?: 'activity';
    }
  | {
      tab: 'progress';
      screen: 'detail';
      exerciseKey: string;
    }
  | {
      tab: 'progress';
      screen: 'bodyweight';
    }
  | {
      tab: 'profile';
      screen: 'list';
    }
  | {
      tab: 'profile';
      screen: 'settings';
    }
  | {
      tab: 'profile';
      screen: 'my_data';
    }
  | {
      tab: 'profile';
      screen: 'export_plan';
    }
  | {
      tab: 'profile';
      screen: 'edit_profile';
    }
  | {
      tab: 'profile';
      screen: 'training_plan';
      /** Opens on the weekday editor — set when the week is still unknown. */
      editSchedule?: boolean;
    }
  | {
      tab: 'profile';
      screen: 'notifications';
    }
  | {
      tab: 'profile';
      screen: 'training_break';
    }
  | {
      tab: 'profile';
      screen: 'promo';
    }
  | {
      tab: 'profile';
      screen: 'subscription';
    }
  | {
      tab: 'profile';
      screen: 'membership_end';
    }
  | {
      tab: 'profile';
      screen: 'premium';
      /**
       * Why the reader is here. The paywall sold automated progression to
       * someone who had just been stopped by the programme cap and said
       * nothing about programmes, so the moment that opened it now travels
       * with the route.
       */
      reason?: 'program_cap';
    }
  | {
      tab: 'profile';
      screen: 'premium_unlock';
      /**
       * Which package the reader picked on the paywall. Carried here because
       * nothing else knows: there is no billing to ask, and the paywall's
       * selection is local state that dies with the screen.
       */
      plan?: 'monthly' | 'yearly' | 'lifetime';
    }
  | {
      tab: 'profile';
      screen: 'legal';
      /** Privacy policy or terms — same screen, same source data. */
      document: 'privacy' | 'terms';
    }
  | {
      tab: 'profile';
      screen: 'setup';
      /**
       * Questionnaire entry point: 'avoid' jumps straight to the limitations
       * step (My data), 'location' re-runs the whole flow for a fresh plan.
       * Absent = edit mode's default (review overview).
       */
      stage?: 'location' | 'avoid';
    };

export const ROOT_ROUTES: Record<RootTabKey, AppRoute> = {
  home: { tab: 'home', screen: 'dashboard' },
  workout: { tab: 'workout', screen: 'list' },
  progress: { tab: 'progress', screen: 'list' },
  profile: { tab: 'profile', screen: 'list' },
};

export const WORKOUT_PLAN_ROUTE: AppRoute = { tab: 'workout', screen: 'plans' };
