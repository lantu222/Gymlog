import { getRecommendationProgramDefinition } from './recommendationCatalog';
import type { RecommendationProgrammeProfile, RecommendationTrainingBlock, TemplateFamilyId } from '../types/recommendation';

const STARTER_BLOCK_LENGTH_WEEKS = 4;
const STARTER_PHASE_LABELS = ['Week 1 Baseline', 'Week 2 Build', 'Week 3 Build', 'Week 4 Review + easier week'];

function buildFamilyProgrammeProfile(programId: string, familyId: TemplateFamilyId): RecommendationProgrammeProfile {
  switch (familyId) {
    case 'strength_base':
      return {
        programId,
        familyId,
        blockLengthWeeks: STARTER_BLOCK_LENGTH_WEEKS,
        progressionStyle: 'strength_wave',
        phaseLabels: STARTER_PHASE_LABELS,
        volumeProgression: 'Use week 1 as the baseline volume, build in weeks 2-3, then pull fatigue back in week 4 before deciding whether to repeat or edit.',
        intensityProgression: 'Add load conservatively only after clean sets land at the top of the range, then keep week 4 easier for review.',
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
        blockLengthWeeks: STARTER_BLOCK_LENGTH_WEEKS,
        progressionStyle: 'powerbuilding_wave',
        phaseLabels: STARTER_PHASE_LABELS,
        volumeProgression: 'Open with enough bodybuilding volume to support the heavy lifts, build for two weeks, then reduce fatigue in week 4.',
        intensityProgression: 'Keep the first three weeks strength-led, then use week 4 to review performance before repeating or adjusting the block.',
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
        blockLengthWeeks: STARTER_BLOCK_LENGTH_WEEKS,
        progressionStyle: 'hypertrophy_accumulation',
        phaseLabels: STARTER_PHASE_LABELS,
        volumeProgression: 'Start with repeatable volume, add reps or quality in weeks 2-3, then use week 4 as an easier review week.',
        intensityProgression: 'Most progression comes from reps and set quality first, with load increases added once the target ranges are stable.',
        exerciseStability: 'Keep the main movement menu steady so muscle groups get repeated exposures instead of constant novelty.',
        easierWeek: {
          week: 4,
          reason: 'Trim fatigue after the first build stretch and decide whether to repeat, edit, or move to a harder block.',
        },
      };
    case 'full_body_minimal':
      return {
        programId,
        familyId,
        blockLengthWeeks: STARTER_BLOCK_LENGTH_WEEKS,
        progressionStyle: 'minimal_consistency',
        phaseLabels: STARTER_PHASE_LABELS,
        volumeProgression: 'Keep total work tight, add a little work in weeks 2-3 only if recovery stays easy, then review in week 4.',
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
        blockLengthWeeks: STARTER_BLOCK_LENGTH_WEEKS,
        progressionStyle: 'recovery_rebuild',
        phaseLabels: STARTER_PHASE_LABELS,
        volumeProgression: 'Increase total work slowly in weeks 2-3 and only after the previous week feels repeatable.',
        intensityProgression: 'Keep intensity moderate and progress by smoother execution, range, or reps before adding load.',
        exerciseStability: 'Hold the movement menu steady to make recovery signals obvious and avoid irritation from constant swaps.',
        easierWeek: {
          week: 4,
          reason: 'Protect joints and connective tissue before deciding whether to repeat or move on.',
        },
      };
    case 'athletic_recomp':
      return {
        programId,
        familyId,
        blockLengthWeeks: STARTER_BLOCK_LENGTH_WEEKS,
        progressionStyle: 'hybrid_wave',
        phaseLabels: STARTER_PHASE_LABELS,
        volumeProgression: 'Progress by adding a little density or total work in weeks 2-3 while keeping the weekly rhythm sustainable.',
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
        blockLengthWeeks: STARTER_BLOCK_LENGTH_WEEKS,
        progressionStyle: 'resource_limited_progression',
        phaseLabels: STARTER_PHASE_LABELS,
        volumeProgression: 'Use reps, rounds, or shorter rest as the main volume lever in weeks 2-3 when load options are limited.',
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
        blockLengthWeeks: STARTER_BLOCK_LENGTH_WEEKS,
        progressionStyle: 'focus_volume_wave',
        phaseLabels: STARTER_PHASE_LABELS,
        volumeProgression: 'Bias more total work toward the focus area in weeks 2-3, then review recovery in week 4.',
        intensityProgression: 'Let the focus lifts get slightly heavier in the second half while accessories keep the weekly volume high.',
        exerciseStability: 'Keep the focus lifts stable across the block and rotate only non-essential accessories.',
        easierWeek: {
          week: 4,
          reason: 'Make room for another focused wave without burying recovery.',
        },
      };
    default:
      return {
        programId,
        familyId,
        blockLengthWeeks: STARTER_BLOCK_LENGTH_WEEKS,
        progressionStyle: 'steady_progression',
        phaseLabels: STARTER_PHASE_LABELS,
        volumeProgression: 'Add work gradually in weeks 2-3, then reduce it briefly and review in week 4.',
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

export function buildRecommendationTrainingBlock(programId: string): RecommendationTrainingBlock {
  const profile = buildRecommendationProgrammeProfile(programId);

  return {
    blockLengthWeeks: profile.blockLengthWeeks,
    currentWeek: 1,
    currentWeekRole: 'baseline',
    weekRoles: ['baseline', 'build', 'build', 'review'],
    summary: `Start with week 1 as a baseline, build in weeks 2-3, then use week 4 as an easier review week.`,
    nextWeekAction: 'After week 1, repeat the same weekly structure in week 2 and add reps or load only when the previous sessions were clean.',
  };
}
