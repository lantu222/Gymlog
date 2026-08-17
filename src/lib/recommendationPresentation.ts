import type { RecommendationResult } from '../types/recommendation';

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
