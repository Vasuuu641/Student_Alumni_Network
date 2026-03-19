import { Injectable } from '@nestjs/common';
import { CohereClient } from 'cohere-ai';
import { PrismaService } from '../../database/prisma/prisma.service';
import { ThreadLLMService, SimilarThread } from 'src/domain/services/thread-llm.service';
import { ThreadPanel } from 'src/domain/entities/thread.entity';

@Injectable()
export class CohereThreadLLMService implements ThreadLLMService {
  private readonly cohere: CohereClient;

  constructor(private readonly prisma: PrismaService) {
    this.cohere = new CohereClient({
      token: process.env.COHERE_API_KEY,
    });
  }

  async embedThread(threadId: string, title: string): Promise<void> {
    try {
      const response = await this.cohere.embed({
        texts: [title],
        model: 'embed-english-v3.0',
        inputType: 'search_document',
        embeddingTypes: ['float'],
      });

      const embedding = (response.embeddings as any).float[0] as number[];
      const vectorLiteral = `[${embedding.join(',')}]`;
      const now = new Date().toISOString();

      await this.prisma.$executeRaw`
        INSERT INTO "ThreadEmbedding" (id, "threadId", embedding, "createdAt", "updatedAt")
        VALUES (
          gen_random_uuid(),
          ${threadId},
          ${vectorLiteral}::vector,
          ${now}::timestamp,
          ${now}::timestamp
        )
        ON CONFLICT ("threadId") DO UPDATE
          SET embedding = ${vectorLiteral}::vector,
              "updatedAt" = ${now}::timestamp
      `;
    } catch (error) {
      console.error(`Failed to embed thread ${threadId}:`, error.message);
      throw error;
    }
  }

  async findSimilarThreads(
    query: string,
    userPanel: ThreadPanel | null,
    limit: number = 5,
    threshold: number = 0.65,
  ): Promise<SimilarThread[]> {
    try {
      // Embed the query text
      const response = await this.cohere.embed({
        texts: [query],
        model: 'embed-english-v3.0',
        inputType: 'search_query',
        embeddingTypes: ['float'],
      });

      const embedding = (response.embeddings as any).float[0] as number[];
      const vectorLiteral = `[${embedding.join(',')}]`;

      // Build panel filter
      // If userPanel is null search both panels
      // If userPanel is ACADEMIC only return ACADEMIC threads
      // If userPanel is ALUMNI return both panels since alumni can access both
      const panelFilter = userPanel === ThreadPanel.ACADEMIC
        ? `AND t.panel = 'ACADEMIC'`
        : '';

      const results = await this.prisma.$queryRawUnsafe<Array<{
        threadId: string;
        title: string;
        panel: string;
        replyCount: number;
        voteScore: number;
        similarity: number;
      }>>(
        `
        SELECT
          t.id AS "threadId",
          t.title,
          t.panel,
          t."replyCount",
          t."voteScore",
          1 - (te.embedding <=> $1::vector) AS similarity
        FROM "ThreadEmbedding" te
        JOIN "Thread" t ON t.id = te."threadId"
        WHERE t.status != 'DELETED'
          ${panelFilter}
          AND 1 - (te.embedding <=> $1::vector) >= $2
        ORDER BY te.embedding <=> $1::vector
        LIMIT $3
        `,
        vectorLiteral,
        threshold,
        limit,
      );

      return results.map((r) => ({
        threadId: r.threadId,
        title: r.title,
        panel: r.panel as ThreadPanel,
        replyCount: Number(r.replyCount),
        voteScore: Number(r.voteScore),
        similarityScore: Number(r.similarity),
      }));
    } catch (error) {
      console.error('Failed to find similar threads:', error.message);
      throw error;
    }
  }
}