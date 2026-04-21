import type { RecommendationConfidence, RecommendationResult } from '../types/recommendation';

export interface RecommendationConfidenceCopy {
  title: string;
  body: string;
}

export function buildRecommendationOptionIds(
  recommendation: Pick<RecommendationResult, 'featuredProgramId' | 'secondaryProgramId' | 'alternativeProgramIds'>,
): string[] {
  return [
    recommendation.featuredProgramId,
    recommendation.secondaryProgramId,
    ...recommendation.alternativeProgramIds,
  ].filter((programId, index, optionIds): programId is string => {
    return typeof programId === 'string' && programId.length > 0 && optionIds.indexOf(programId) === index;
  });
}

export function getRecommendationConfidenceCopy(confidence: RecommendationConfidence): RecommendationConfidenceCopy {
  switch (confidence) {
    case 'high':
      return {
        title: 'Strong match',
        body: 'This plan is the clearest fit for your current goal, schedule, and setup.',
      };
    case 'medium':
      return {
        title: 'Best fit right now',
        body: 'This plan edges out the others, but there are still a couple of solid alternatives below.',
      };
    case 'low':
    default:
      return {
        title: 'Close match',
        body: 'These options are close. Start with this one, or pick one of the alternatives if it looks more like your week.',
      };
  }
}
