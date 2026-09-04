export interface RecommendedStudyGroup {
  id: string;
  name: string;
  description: string;
  visibility: string;
  score: number;
  matchingSignals: string[];
}

export interface StudyGroupRecommendationService {
  recommendForUser(userId: string, limit?: number): Promise<RecommendedStudyGroup[]>;
}
