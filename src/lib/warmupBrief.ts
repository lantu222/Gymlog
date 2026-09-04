/**
 * What today's session is about to load — for the reader warming up their own
 * way (design: workout session flow, screen 4).
 *
 * A deliberate distinction from what this screen used to hold. It once listed
 * the drills the app would have run, and that was removed on 2026-08-26
 * because it is the app arguing with a choice it had just offered. This is the
 * opposite claim: not "here is what you skipped" but "here is what you are
 * about to lift", which is the one thing that makes a self-run warm-up better
 * rather than merely faster. It never names a drill.
 */
import { libraryLabel } from './libraryLabel';
import { buildOverviewScheme, OverviewCaution, resolveOverviewCaution } from './sessionOverviewRows';
import { AppLanguage, SetupCautionFlag, UnitPreference } from '../types/models';

export interface WarmupBriefExercise {
  /** The library name, untranslated — the caution matcher reads English. */
  exerciseName: string;
  /** From the library row; null when the lift is not in it. */
  bodyPart: string | null;
  setCount: number;
  repsLabel: string;
  timed: boolean;
  loadKg: number | null;
}

export interface WarmupBriefFirstLift {
  /** Untranslated; the screen puts it through its own name label. */
  exerciseName: string;
  /** "4 × 7 · 62,5 kg". */
  scheme: string;
}

export interface WarmupBrief {
  /** Localized body-part labels, deduped, in the order the session meets them. */
  areas: string[];
  /**
   * Flagged areas today's lifts actually touch — deduped by area, because the
   * chip is about the body part and not about which lift found it.
   */
  cautions: OverviewCaution[];
  firstLift: WarmupBriefFirstLift | null;
}

export function buildWarmupBrief(
  exercises: ReadonlyArray<WarmupBriefExercise>,
  cautionFlags: ReadonlyArray<SetupCautionFlag> | null | undefined,
  language: AppLanguage,
  unitPreference: UnitPreference = 'kg',
): WarmupBrief {
  const areas: string[] = [];
  const cautions: OverviewCaution[] = [];

  exercises.forEach((exercise) => {
    if (exercise.bodyPart) {
      const label = libraryLabel(exercise.bodyPart, language);
      if (label && !areas.includes(label)) {
        areas.push(label);
      }
    }

    const caution = resolveOverviewCaution(exercise.exerciseName, cautionFlags, language);
    if (caution && !cautions.some((existing) => existing.area === caution.area)) {
      cautions.push(caution);
    }
  });

  const first = exercises[0] ?? null;

  return {
    areas,
    cautions,
    firstLift: first
      ? {
          exerciseName: first.exerciseName,
          scheme: buildOverviewScheme(
            {
              exerciseName: first.exerciseName,
              setCount: first.setCount,
              repsLabel: first.repsLabel,
              timed: first.timed,
              loadKg: first.loadKg,
            },
            language,
            unitPreference,
          ),
        }
      : null,
  };
}
