// notification-ai-scoring.service.ts
import { Inject, Injectable, Logger } from '@nestjs/common';
import { CohereClient } from 'cohere-ai';
import type { UserInterestProfileRepository } from 'src/domain/repositories/user-interest.repository';

@Injectable()
export class NotificationAIScoringService {
  private readonly logger = new Logger(NotificationAIScoringService.name);
  private cohere: CohereClient;

  constructor(
    @Inject('UserInterestProfileRepository')
    private readonly interestProfileRepository: UserInterestProfileRepository,
  ) {
    this.cohere = new CohereClient({
      token: process.env.COHERE_API_KEY,
    });
  }

  async scoreNotification(
    userId: string,
    notificationTitle: string,
    notificationBody: string,
    threadTitle?: string,
    threadPanel?: 'ACADEMIC' | 'ALUMNI',
  ): Promise<{ score: number; reason: string }> {
    try {
      const profile = await this.interestProfileRepository.findByUserId(userId);

      if (!profile) {
        return { score: 0.5, reason: 'No interest profile found' };
      }

      const panelWeight = threadPanel ? profile.getWeightForPanel(threadPanel) : 0.5;

      const combinedText = [notificationTitle, notificationBody, threadTitle]
        .filter(Boolean)
        .join(' ');

      const userTopics = profile.getTopics().map((t) => t.name).join(', ');
      const userInterests = `Topics of interest: ${userTopics || 'general'}`;

      // Two separate calls, matching MentorClusteringService's query/document split —
      // asymmetric inputType is required for meaningful retrieval-style similarity.
      const [interestResponse, notificationResponse] = await Promise.all([
        this.cohere.embed({
          texts: [userInterests],
          model: 'embed-english-v3.0',
          inputType: 'search_query',
          embeddingTypes: ['float'],
        }),
        this.cohere.embed({
          texts: [combinedText],
          model: 'embed-english-v3.0',
          inputType: 'search_document',
          embeddingTypes: ['float'],
        }),
      ]);

      const interestEmbedding = (interestResponse.embeddings as any)?.float?.[0] as
        | number[]
        | undefined;
      const notificationEmbedding = (notificationResponse.embeddings as any)?.float?.[0] as
        | number[]
        | undefined;

      if (!interestEmbedding || !notificationEmbedding) {
        return {
          score: panelWeight * 0.7,
          reason: 'Embedding failed, using panel weight',
        };
      }

      const semanticSimilarity = this.cosineSimilarity(notificationEmbedding, interestEmbedding);
      const finalScore = Math.max(0, Math.min(1, semanticSimilarity * panelWeight));

      return {
        score: finalScore,
        reason: `Semantic match: ${(semanticSimilarity * 100).toFixed(1)}% + panel weight ${(panelWeight * 100).toFixed(1)}%`,
      };
    } catch (error) {
      this.logger.warn(`AI scoring failed for user ${userId}: ${this.formatError(error)}`);
      return { score: 0.5, reason: 'AI scoring failed, using fallback' };
    }
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA * normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }

  private formatError(error: unknown): string {
    return error instanceof Error ? error.message : 'unknown error';
  }
}