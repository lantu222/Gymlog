import { getRecommendationProgramDefinition } from './recommendationCatalog';
import type { RecommendationProgrammeProfile, TemplateFamilyId } from '../types/recommendation';

function buildFamilyProgrammeProfile(programId: string, familyId: TemplateFamilyId): RecommendationProgrammeProfile {
  switch (familyId) {
    case 'strength_base':
      return {
        programId,
        familyId,
        blockLengthWeeks: 6,
        progressionStyle: 'strength_wave',
        phaseLabels: ['Weeks 1-2 Base volume', 'Week 3 Push week', 'Week 4 Easier week', 'Weeks 5-6 Heavier rebuild'],
        volumeProgression: 'Build volume first across the opening weeks, then pull it back in the easier week before the final heavier push.',
        intensityProgression: 'Add load conservatively only after clean sets land at the top of the range, then tighten reps in the last two weeks.',
        exerciseStability: 'Keep anchor lifts stable for the whole block and only rotate support lifts if recovery or equipment demands it.',
        easierWeek: {
          week: 4,
          reason: 'Cut top-set fatigue and total hard work before rebuilding heavier in the final stretch.',
        },
      };
    case 'powerbuilding':
      return {
        programId,
        familyId,
        blockLengthWeeks: 6,
        progressionStyle: 'powerbuilding_wave',
        phaseLabels: ['Weeks 1-2 Heavy base', 'Week 3 Hard push', 'Week 4 Easier week', 'Weeks 5-6 Heavy + volume finish'],
        volumeProgression: 'Open with enough bodybuilding volume to support the heavy lifts, reduce it in week 4, then bring it back for the finish.',
        intensityProgression: 'Keep the first half strength-led, then let the last two weeks peak the heavy work while preserving volume days.',
        exerciseStability: 'Hold strength anchors steady and keep volume-day accessories mostly stable so performance and hypertrophy both stay trackable.',
        easierWeek: {
          week: 4,
          reason: 'Use a pivot week to drop fatigue before the final heavy plus volume push.',
        },
      };
    case 'mass_hypertrophy':
      return {
        programId,
        familyId,
        blockLengthWeeks: 8,
        progressionStyle: 'hypertrophy_accumulation',
        phaseLabels: ['Weeks 1-3 Volume build', 'Week 4 Hardest accumulation', 'Week 5 Easier week', 'Weeks 6-8 Rebuild and finish'],
        volumeProgression: 'Accumulate more total work early, strip it back briefly in week 5, then rebuild with slightly harder sets in the final phase.',
        intensityProgression: 'Most progression comes from reps and set quality first, with load increases added once the target ranges are stable.',
        exerciseStability: 'Keep the main movement menu steady so muscle groups get repeated exposures instead of constant novelty.',
        easierWeek: {
          week: 5,
          reason: 'Trim fatigue after the highest-volume stretch so the final weeks can still be productive.',
        },
      };
    case 'full_body_minimal':
      return {
        programId,
        familyId,
        blockLengthWeeks: 6,
        progressionStyle: 'minimal_consistency',
        phaseLabels: ['Weeks 1-2 Groove the pattern', 'Week 3 Add a little work', 'Week 4 Easier week', 'Weeks 5-6 Repeat heavier'],
        volumeProgression: 'Keep total work tight and only add a little volume if recovery stays easy.',
        intensityProgression: 'Nudge load upward in small steps after repeatable clean sessions instead of chasing aggressive weekly jumps.',
        exerciseStability: 'Exercises stay very stable so busy weeks do not break the rhythm.',
        easierWeek: {
          week: 4,
          reason: 'Reset fatigue and keep consistency high before the final repeat of the block.',
        },
      };
    case 'joint_friendly':
      return {
        programId,
        familyId,
        blockLengthWeeks: 6,
        progressionStyle: 'recovery_rebuild',
        phaseLabels: ['Weeks 1-2 Reset', 'Weeks 3-4 Rebuild tolerance', 'Week 5 Easier week', 'Week 6 Exit week'],
        volumeProgression: 'Increase total work slowly and only after the previous week feels repeatable.',
        intensityProgression: 'Keep intensity moderate and progress by smoother execution, range, or reps before adding load.',
        exerciseStability: 'Hold the movement menu steady to make recovery signals obvious and avoid irritation from constant swaps.',
        easierWeek: {
          week: 5,
          reason: 'Protect joints and connective tissue before the final week of the block.',
        },
      };
    case 'athletic_recomp':
      return {
        programId,
        familyId,
        blockLengthWeeks: 6,
        progressionStyle: 'hybrid_wave',
        phaseLabels: ['Weeks 1-2 Base rhythm', 'Week 3 Extend density', 'Week 4 Easier week', 'Weeks 5-6 Stronger finish'],
        volumeProgression: 'Progress by adding a little density or total work while keeping the weekly rhythm sustainable.',
        intensityProgression: 'Increase speed, load, or interval quality gradually rather than chasing one hard metric only.',
        exerciseStability: 'Keep the weekly structure stable while allowing small swaps around conditioning or mobility emphasis.',
        easierWeek: {
          week: 4,
          reason: 'Drop density before the last push so the hybrid work stays recoverable.',
        },
      };
    case 'low_equipment':
      return {
        programId,
        familyId,
        blockLengthWeeks: 6,
        progressionStyle: 'resource_limited_progression',
        phaseLabels: ['Weeks 1-2 Build the habit', 'Week 3 Add rounds or reps', 'Week 4 Easier week', 'Weeks 5-6 Repeat harder'],
        volumeProgression: 'Use reps, rounds, or shorter rest as the main volume lever when load options are limited.',
        intensityProgression: 'Progress through tighter execution and harder variations before chasing more external load.',
        exerciseStability: 'Keep swaps minimal so low-equipment progression stays measurable.',
        easierWeek: {
          week: 4,
          reason: 'Lower the density briefly so the block stays repeatable with limited equipment.',
        },
      };
    case 'glute_priority':
      return {
        programId,
        familyId,
        blockLengthWeeks: 8,
        progressionStyle: 'focus_volume_wave',
        phaseLabels: ['Weeks 1-3 Build glute volume', 'Week 4 Hard push', 'Week 5 Easier week', 'Weeks 6-8 Repeat with heavier top work'],
        volumeProgression: 'Bias more total work toward the focus area early, then rebuild it after the easier week.',
        intensityProgression: 'Let the focus lifts get slightly heavier in the second half while accessories keep the weekly volume high.',
        exerciseStability: 'Keep the focus lifts stable across the block and rotate only non-essential accessories.',
        easierWeek: {
          week: 5,
          reason: 'Make room for another focused volume wave without burying recovery.',
        },
      };
    default:
      return {
        programId,
        familyId,
        blockLengthWeeks: 6,
        progressionStyle: 'steady_progression',
        phaseLabels: ['Weeks 1-3 Build', 'Week 4 Easier week', 'Weeks 5-6 Rebuild'],
        volumeProgression: 'Add work gradually across the first half, reduce it briefly, then rebuild.',
        intensityProgression: 'Increase load only when quality stays stable across the prescribed ranges.',
        exerciseStability: 'Keep the core exercise menu steady for the whole block.',
        easierWeek: {
          week: 4,
          reason: 'Manage fatigue before the final push.',
        },
      };
  }
}

export function buildRecommendationProgrammeProfile(programId: string): RecommendationProgrammeProfile {
  const definition = getRecommendationProgramDefinition(programId);
  if (!definition) {
    throw new Error(`Unknown recommendation programme: ${programId}`);
  }

  return buildFamilyProgrammeProfile(programId, definition.familyId);
}

export function getRecommendationProgrammeSummary(programId: string) {
  let profile: RecommendationProgrammeProfile;
  try {
    profile = buildRecommendationProgrammeProfile(programId);
  } catch {
    return null;
  }
  const openingPhase = profile.phaseLabels[0]?.replace(/^Weeks?\s+/i, '') ?? 'base phase';

  return `${profile.blockLengthWeeks}-week block with ${openingPhase.toLowerCase()}, an easier week in week ${profile.easierWeek.week}, and a ${profile.progressionStyle.replace(/_/g, ' ')} finish. ${profile.volumeProgression}`;
}
