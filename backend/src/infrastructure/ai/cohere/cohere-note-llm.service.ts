import { Injectable } from '@nestjs/common';
import { CohereClient } from 'cohere-ai';
import { PrismaService } from '../../database/prisma/prisma.service';
import { NoteLLMService, RelatedThread } from 'src/domain/services/note-llm-service';

@Injectable()
export class CohereNoteLLMService implements NoteLLMService {
  private readonly cohere: CohereClient;

  constructor(private readonly prisma: PrismaService) {
    this.cohere = new CohereClient({
      token: process.env.COHERE_API_KEY,
    });
  }

  // ─── Text extraction ──────────────────────────────────────────────────────

  private extractTextFromTipTap(json: any): string {
    if (!json) return '';
    if (json.type === 'text' && typeof json.text === 'string') {
      return json.text;
    }
    if (Array.isArray(json.content)) {
      return json.content
        .map((node: any) => this.extractTextFromTipTap(node))
        .join(' ');
    }
    return '';
  }

  // ─── Chunking ─────────────────────────────────────────────────────────────

  private chunkText(text: string, chunkSize: number = 300, overlap: number = 50): string[] {
    const words = text.split(/\s+/).filter(w => w.length > 0);
    if (words.length === 0) return [];

    const chunks: string[] = [];
    let start = 0;

    while (start < words.length) {
      const end = Math.min(start + chunkSize, words.length);
      chunks.push(words.slice(start, end).join(' '));
      if (end === words.length) break;
      start += chunkSize - overlap;
    }

    return chunks;
  }

  // ─── Embed note ───────────────────────────────────────────────────────────

  async embedNote(noteId: string, title: string, contentJson: unknown): Promise<void> {
    try {
      const bodyText = this.extractTextFromTipTap(contentJson);
      const fullText = `${title}\n\n${bodyText}`.trim();

      if (fullText.length < 20) return;

      const chunks = this.chunkText(fullText);
      if (chunks.length === 0) return;

      // Delete existing chunks and embeddings for this note
      await this.prisma.noteChunk.deleteMany({ where: { noteId } });

      // Embed all chunks in one Cohere batch call
      const response = await this.cohere.embed({
        texts: chunks,
        model: 'embed-english-v3.0',
        inputType: 'search_document',
        embeddingTypes: ['float'],
      });

      const embeddings = (response.embeddings as any).float as number[][];

      // Store each chunk and its embedding
      for (let i = 0; i < chunks.length; i++) {
        const chunk = await this.prisma.noteChunk.create({
          data: {
            id: this.generateId(),
            noteId,
            chunkIndex: i,
            chunkText: chunks[i],
          },
        });

        const vectorLiteral = `[${embeddings[i].join(',')}]`;
        const now = new Date().toISOString();

        await this.prisma.$queryRawUnsafe(
          `
          INSERT INTO "NoteChunkEmbedding" (id, "chunkId", "noteId", embedding, "createdAt")
          VALUES (gen_random_uuid(), $1, $2, $3::vector, $4::timestamp)
          ON CONFLICT ("chunkId") DO UPDATE
            SET embedding = $3::vector
          `,
          chunk.id,
          noteId,
          vectorLiteral,
          now,
        );
      }
    } catch (error) {
      console.error(`Failed to embed note ${noteId}:`, error.message);
      throw error;
    }
  }

  // ─── Find related threads ─────────────────────────────────────────────────

  async findRelatedThreads(
    title: string,
    contentJson: unknown,
    limit: number = 5,
    threshold: number = 0.55,
  ): Promise<RelatedThread[]> {
    try {
      const bodyText = this.extractTextFromTipTap(contentJson);
      const fullText = `${title}\n\n${bodyText}`.trim();

      if (fullText.length < 20) return [];

      // For real-time search embed just the current text as a query
      const response = await this.cohere.embed({
        texts: [fullText.slice(0, 2000)],
        model: 'embed-english-v3.0',
        inputType: 'search_query',
        embeddingTypes: ['float'],
      });

      const embedding = (response.embeddings as any).float[0] as number[];
      const vectorLiteral = `[${embedding.join(',')}]`;

      // Search against ThreadEmbedding table
      // Group by thread and take the best matching chunk score
      const results = await this.prisma.$queryRawUnsafe<Array<{
        threadId: string;
        title: string;
        description: string | null;
        panel: string;
        replyCount: number;
        voteScore: number;
        similarity: number;
      }>>(
        `
        SELECT
          t.id AS "threadId",
          t.title,
          t.description,
          t.panel,
          t."replyCount",
          t."voteScore",
          1 - (te.embedding <=> $1::vector) AS similarity
        FROM "ThreadEmbedding" te
        JOIN "Thread" t ON t.id = te."threadId"
        WHERE 1 - (te.embedding <=> $1::vector) >= $2
          AND t.status <> 'DELETED'
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
        description: r.description,
        panel: r.panel,
        replyCount: Number(r.replyCount),
        voteScore: Number(r.voteScore),
        similarityScore: Number(r.similarity),
      }));
    } catch (error) {
      console.error('Failed to find related threads:', error.message);
      throw error;
    }
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2, 11);
  }
}