import { Inject, Injectable } from '@nestjs/common';
import type {
  RecommendedStudyGroup,
  StudyGroupRecommendationService,
} from '../../domain/services/study-group-recommendation.service';

@Injectable()
export class RecommendGroupsUseCase {
  constructor(
    @Inject('StudyGroupRecommendationService')
    private readonly recommendationService: StudyGroupRecommendationService,
  ) {}

  async execute(input: { userId: string; limit?: number }): Promise<RecommendedStudyGroup[]> {
    const limit = Math.max(1, Math.min(input.limit ?? 3, 3));
    return this.recommendationService.recommendForUser(input.userId, limit);
  }
}
