import { useMemo } from 'react';

import { buildFatigueModel } from '../lib/fatigueModel';
import {
  buildCompletionConclusion,
  buildNextSessionMoment,
  buildPlateauConclusion,
  buildPlateauDetection,
  buildPlateauMoment,
  buildWeeklyRead,
  detectPlateau,
  pickCompletionLift,
  plateauEpisodeKey,
} from '../lib/proInsights';
import { toProgressionFatigueSignal } from '../lib/progressionGate';
import { buildLiftHistories } from '../lib/trainingHistory';
import type { AppDatabase, AppPreferences } from '../types/models';

/**
 * The paywall moments' data layer: lift histories and the fatigue model built
 * from the logged sets, the progression gate's fatigue signal, the plateau and
 * completion moments, the weekly read and the Pro page's coach specimen.
 *
 * Moved verbatim from VinhaApp in App.tsx in the phase-B split (2026-09-30).
 * A hook, not a helper: these are memos that build on one another, and
 * VinhaApp calls this exactly where the lines stood — right after
 * useDaySummaries, before homeActiveWorkoutSummary — so every hook keeps its
 * slot. That is still below setNumberLanguage, which the plateau and weekly
 * builders' number formatting needs to have run.
 *
 * In the moved comments below, "here" and "below" mean App.tsx:
 * findPlateauDetection is called further down VinhaApp. The dismissed-episode
 * set, the plateau lift and the completion lift stay inside; VinhaApp reads
 * only what this returns.
 */
export interface ProInsightsDeps {
  /** The whole database: the workout sessions and exercise logs are read. */
  database: AppDatabase;
  /** The reader's preferences: language, level and the dismissed plateau episodes. */
  preferences: AppPreferences;
}

export function useProInsights(deps: ProInsightsDeps) {
  const { database, preferences } = deps;

  // The paywall-moments data layer: real lift histories → detections (free)
  // and deterministic conclusions (Pro / blurred). Pure, from logged sets.
  const proLiftHistories = useMemo(
    () => buildLiftHistories(database.workoutSessions, database.exerciseLogs),
    [database.exerciseLogs, database.workoutSessions],
  );
  const proFatigue = useMemo(
    () =>
      buildFatigueModel({
        workoutSessions: database.workoutSessions,
        exerciseLogs: database.exerciseLogs,
      }),
    [database.exerciseLogs, database.workoutSessions],
  );
  /**
   * Recovery, in the shape the progression gate acts on.
   *
   * The gate has carried fatigue holds since it was written, and nothing ever
   * passed a signal in — so the paywall's "Pro reads your load and eases off
   * before fatigue costs you a week" described something that never happened
   * on a single set. This is the wire.
   *
   * It rides on the progression options, which resolveProgressionOptions
   * already gates behind Pro, so the hold is a paid behaviour by construction
   * rather than by a second check that could drift from the first.
   */
  const progressionFatigueSignal = useMemo(
    () => toProgressionFatigueSignal(proFatigue),
    [proFatigue],
  );
  // Episodes the reader already said "selvä" to — one tap on Home, kept
  // through database.ts normalisation like every other dismiss list. Read
  // only here: the in-workout reminder (findPlateauDetection below) ignores
  // it on purpose, per the owner's "muistutus kun seuraavalla kerralla on
  // sumo" (#bugs 2026-09-29).
  const dismissedPlateauEpisodes = useMemo(
    () => new Set(preferences.dismissedPlateauEpisodes),
    [preferences.dismissedPlateauEpisodes],
  );
  const proPlateauLift = useMemo(
    () => detectPlateau(proLiftHistories, dismissedPlateauEpisodes),
    [proLiftHistories, dismissedPlateauEpisodes],
  );
  const proPlateau = useMemo(
    () =>
      proPlateauLift
        ? {
            detection: buildPlateauDetection(proPlateauLift, preferences.appLanguage),
            conclusion: buildPlateauConclusion(proPlateauLift, preferences.appLanguage, preferences.setupLevel),
            moment: buildPlateauMoment(proPlateauLift, preferences.appLanguage, preferences.setupLevel),
            episodeKey: plateauEpisodeKey(proPlateauLift),
          }
        : null,
    [preferences.appLanguage, preferences.setupLevel, proPlateauLift],
  );
  const proWeeklyRead = useMemo(
    () => buildWeeklyRead(proLiftHistories, proFatigue, preferences.appLanguage, preferences.setupLevel),
    [preferences.appLanguage, preferences.setupLevel, proFatigue, proLiftHistories],
  );
  const proCompletionLift = useMemo(() => pickCompletionLift(proLiftHistories), [proLiftHistories]);
  const proCompletionMoment = useMemo(
    () =>
      proCompletionLift
        ? {
            conclusion: buildCompletionConclusion(proCompletionLift, preferences.appLanguage, preferences.setupLevel),
            moment: buildNextSessionMoment(proCompletionLift, preferences.appLanguage, preferences.setupLevel),
          }
        : null,
    [preferences.appLanguage, preferences.setupLevel, proCompletionLift],
  );
  // The Pro page's coach specimen: the deterministic read of the user's own
  // stalled lift — the same text Pro unlocks at the plateau moments.
  const proCoachSpecimen = useMemo(
    () => (proPlateau ? proPlateau.conclusion.body : null),
    [proPlateau],
  );

  return {
    proLiftHistories,
    proFatigue,
    progressionFatigueSignal,
    proPlateau,
    proWeeklyRead,
    proCompletionMoment,
    proCoachSpecimen,
  };
}
