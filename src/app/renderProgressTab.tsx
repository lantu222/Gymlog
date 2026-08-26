import React from 'react';

import { AppRoute, ROOT_ROUTES } from '../navigation/routes';
import { ProgressScreen } from '../screens/ProgressScreen';
import { AppPreferences, MeasurementKind, MeasurementUnit } from '../types/models';
import { haptics } from '../utils/haptics';

type ProgressScreenProps = React.ComponentProps<typeof ProgressScreen>;

/**
 * The progress tab — one screen, three routes (list, detail, bodyweight),
 * moved verbatim from App.tsx's render chain in the phase-A split
 * (2026-08-26). A plain function, not a component: React sees the same
 * ProgressScreen element the chain produced, so the screen instance
 * survives route changes within the tab exactly as before.
 */
export interface ProgressTabDeps {
  route: AppRoute;
  navigate: (route: AppRoute) => void;
  resetToRoute: (route: AppRoute) => void;
  preferences: AppPreferences;
  updatePreferences: (patch: Partial<AppPreferences>) => Promise<unknown>;
  personalRecords: NonNullable<ProgressScreenProps['records']>;
  distinctRecordCount: number;
  recordSources: NonNullable<ProgressScreenProps['setLogSources']>;
  trackedProgress: ProgressScreenProps['summaries'];
  bodyweightProgress: ProgressScreenProps['bodyweightProgress'];
  measurementEntries: ProgressScreenProps['measurementEntries'];
  workoutSessions: ProgressScreenProps['workoutSessions'];
  activityCalendar: ProgressScreenProps['activityCalendar'];
  homeTrainingSchedule: ProgressScreenProps['trainingSchedule'];
  progressTrainingRhythm: ProgressScreenProps['rhythm'];
  progressWeeklyTarget: ProgressScreenProps['weeklyTargetSessions'];
  unitPreference: ProgressScreenProps['unitPreference'];
  proWeeklyRead: ProgressScreenProps['weeklyRead'];
  proPlateauMoment: ProgressScreenProps['readMoment'];
  coachProUnlocked: boolean;
  addBodyweightEntry: (weightKg: number) => Promise<unknown>;
  addMeasurementEntry: (kind: MeasurementKind, value: number, unit: MeasurementUnit) => Promise<unknown>;
  homeRecentSessions: ProgressScreenProps['recentSessions'];
}

export function renderProgressTab(deps: ProgressTabDeps): React.ReactElement | null {
  const {
    route,
    navigate,
    resetToRoute,
    preferences,
    updatePreferences,
    personalRecords,
    distinctRecordCount,
    recordSources,
    trackedProgress,
    bodyweightProgress,
    measurementEntries,
    workoutSessions,
    activityCalendar,
    homeTrainingSchedule,
    progressTrainingRhythm,
    progressWeeklyTarget,
    unitPreference,
    proWeeklyRead,
    proPlateauMoment,
    coachProUnlocked,
    addBodyweightEntry,
    addMeasurementEntry,
    homeRecentSessions,
  } = deps;

  if (route.tab !== 'progress') {
    return null;
  }

  return (
    <ProgressScreen
      topRecords={personalRecords.weight.slice(0, 3)}
      recordCount={distinctRecordCount}
      records={personalRecords}
      setLogSources={recordSources}
      onStartWorkout={() => resetToRoute(ROOT_ROUTES.home)}
      summaries={trackedProgress}
      bodyweightProgress={bodyweightProgress}
      measurementEntries={measurementEntries}
      workoutSessions={workoutSessions}
      activityCalendar={activityCalendar}
      // The same resolved rhythm Home and the widget mark their calendars
      // from — cycle or weekdays — so a 2-on-1-off reader sees the same
      // training days on every calendar in the app.
      trainingSchedule={homeTrainingSchedule}
      rhythm={progressTrainingRhythm}
      weeklyTargetSessions={progressWeeklyTarget}
      unitPreference={unitPreference}
      weeklyRead={proWeeklyRead}
      readMoment={proPlateauMoment}
      proUnlocked={coachProUnlocked}
      onOpenPremium={() => navigate({ tab: 'profile', screen: 'premium' })}
      language={preferences.appLanguage}
      selectedExerciseKey={route.screen === 'detail' ? route.exerciseKey : undefined}
      initialSection={route.screen === 'list' ? route.section : undefined}
      initialMeasure={route.screen === 'list' ? route.measure : undefined}
      scrollToTarget={route.screen === 'list' ? route.scrollTo : undefined}
      showBodyweightDetail={route.screen === 'bodyweight'}
      onAddBodyweight={async (weightKg) => {
        await addBodyweightEntry(weightKg);
        // No "saved" toast (user 2026-08-25: "outo pilleri... ihan turha").
        // The save announces itself: the dot lands on the chart, and the
        // haptic says it landed.
        void haptics.success();
      }}
      // The same height the questionnaire asks for and the profile stores —
      // the BMI card edits that field rather than keeping a second copy.
      heightCm={preferences.setupHeightCm}
      onSaveHeight={(nextHeightCm) => void updatePreferences({ setupHeightCm: nextHeightCm })}
      onAddMeasurement={async (kind, value, unit) => {
        await addMeasurementEntry(kind, value, unit);
        // No "saved" toast, same rule as bodyweight (user 2026-08-25:
        // "teksti mittaus tallennettu poistetaan ja kaikki tämmöiset").
        // The value lands on the card in front of the reader; the haptic
        // says it landed.
        void haptics.success();
      }}
      recentSessions={homeRecentSessions}
      onOpenSessionHistory={() => navigate({ tab: 'home', screen: 'history' })}
      onOpenRecentSession={(sessionId) => navigate({ tab: 'home', screen: 'session', sessionId })}
    />
  );
}
