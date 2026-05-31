import { Inject, Injectable, Logger } from '@nestjs/common';
import { CohereClient } from 'cohere-ai';
import { UserInterestProfile } from 'src/domain/entities/user-interest.entity';
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

  /**
   * Score a notification using AI semantic similarity + interest weights.
   * Returns a score (0-1) indicating relevance to the user.
   */
  async scoreNotification(
    userId: string,
    notificationTitle: string,
    notificationBody: string,
    threadTitle?: string,
    threadPanel?: 'ACADEMIC' | 'ALUMNI',
  ): Promise<{
    score: number;
    reason: string;
  }> {
    try {
      const profile = await this.interestProfileRepository.findByUserId(userId);

      if (!profile) {
        return { score: 0.5, reason: 'No interest profile found' };
      }

      const panelWeight = threadPanel
        ? profile.getWeightForPanel(threadPanel)
        : 0.5;

      const combinedText = [notificationTitle, notificationBody, threadTitle]
        .filter(Boolean)
        .join(' ');

      const userTopics = profile
        .getTopics()
        .map((t) => t.name)
        .join(', ');
      const userInterests = `Topics of interest: ${userTopics || 'general'}`;

      const embeddingResponse = await this.cohere.embed({
        texts: [combinedText, userInterests],
        model: 'embed-english-v3.0',
        inputType: 'search_document',
      });

      const embeddings = (embeddingResponse as any).embeddings as number[][] | undefined;

      if (!embeddings || embeddings.length < 2) {
        return {
          score: panelWeight * 0.7,
          reason: 'Embedding failed, using panel weight',
        };
      }

      const notificationEmbedding = embeddings[0];
      const interestEmbedding = embeddings[1];

      const semanticSimilarity = this.cosineSimilarity(
        notificationEmbedding,
        interestEmbedding,
      );

      const finalScore = Math.max(0, Math.min(1, semanticSimilarity * panelWeight));

      return {
        score: finalScore,
        reason: `Semantic match: ${(semanticSimilarity * 100).toFixed(1)}% + panel weight ${(panelWeight * 100).toFixed(1)}%`,
      };
    } catch (error) {
      this.logger.warn(
        `AI scoring failed for user ${userId}: ${this.formatError(error)}`,
      );
      return {
        score: 0.5,
        reason: 'AI scoring failed, using fallback',
      };
    }
  }

  /**
   * Compute cosine similarity between two embedding vectors.
   */
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
