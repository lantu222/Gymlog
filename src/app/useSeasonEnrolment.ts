import { useCallback } from 'react';

import type { ProgramSeason } from '../lib/programSeasons';
import { addSeasonEnrolment } from '../lib/seasonEnrolment';
import type { AppPreferences } from '../types/models';

/**
 * Signing up for a season: the one callback the season screen's button runs.
 *
 * Moved verbatim from VinhaApp in App.tsx in the phase-C split (2026-10-01).
 * A hook because it is a useCallback, and VinhaApp calls this exactly where
 * the lines stood — after useRecordsAndMilestones, before useGoalFlow — so
 * every hook keeps its slot.
 */
export interface SeasonEnrolmentDeps {
  /** The reader's preferences: the season enrolments already stored. */
  preferences: AppPreferences;
  /** The app context's preference writer. */
  updatePreferences: (patch: Partial<AppPreferences>) => Promise<unknown>;
}

export function useSeasonEnrolment(deps: SeasonEnrolmentDeps) {
  const { preferences, updatePreferences } = deps;

  /**
   * Signing up for a season — the whole act, in one place.
   *
   * It writes a row and nothing else. Adopting the season programme is a
   * separate decision made on the season screen, because it replaces what you
   * are training today and that needs the sentence next to it.
   */
  const handleEnrolSeason = useCallback(
    (season: ProgramSeason, year: number) => {
      void updatePreferences({
        seasonEnrolments: addSeasonEnrolment(preferences.seasonEnrolments, {
          season,
          year,
          joinedAt: new Date().toISOString(),
        }),
      });
    },
    [preferences.seasonEnrolments, updatePreferences],
  );

  return {
    handleEnrolSeason,
  };
}
