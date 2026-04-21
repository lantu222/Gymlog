export type RootTabKey = 'home' | 'workout' | 'progress' | 'profile';

export type AppRoute =
  | {
      tab: 'home';
      screen: 'dashboard';
    }
  | {
      tab: 'home';
      screen: 'ai';
      prompt?: string;
    }
  | {
      tab: 'home';
      screen: 'ai_setup';
    }
  | {
      tab: 'home';
      screen: 'history';
    }
  | {
      tab: 'home';
      screen: 'session';
      sessionId: string;
    }
  | {
      tab: 'home';
      screen: 'starting_week';
      recommendedProgramId: string;
      source: 'first_run' | 'edit' | 'active';
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
      screen: 'editor';
      workoutTemplateId?: string;
      prefillName?: string;
    }
  | {
      tab: 'workout';
      screen: 'template';
      workoutTemplateId?: string;
    }
  | {
      tab: 'workout';
      screen: 'log';
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
      screen: 'plan_settings';
    }
  | {
      tab: 'profile';
      screen: 'exercise_preferences';
    }
  | {
      tab: 'profile';
      screen: 'equipment';
    }
  | {
      tab: 'profile';
      screen: 'joint_swaps';
    }
  | {
      tab: 'profile';
      screen: 'premium';
    }
  | {
      tab: 'profile';
      screen: 'setup';
    };

export const ROOT_ROUTES: Record<RootTabKey, AppRoute> = {
  home: { tab: 'home', screen: 'dashboard' },
  workout: { tab: 'workout', screen: 'list' },
  progress: { tab: 'progress', screen: 'list' },
  profile: { tab: 'profile', screen: 'list' },
};

export const WORKOUT_PLAN_ROUTE: AppRoute = { tab: 'workout', screen: 'plans' };
