import { Inject, Injectable, Logger } from '@nestjs/common';
import { CohereClient } from 'cohere-ai';
import { ThreadPanel } from 'src/domain/entities/thread.entity';
import type { AlumniRepository } from 'src/domain/repositories/alumni.repository';

export interface MentorMatch {
  userId: string;
  score: number;
  reason: string;
  matchedSignals: string[];
}

export interface MentorClusterRequest {
  title: string;
  description: string | null;
  panel: ThreadPanel;
  limit?: number;
  excludeUserIds?: string[];
}

@Injectable()
export class MentorClusteringService {
  private readonly logger = new Logger(MentorClusteringService.name);
  private readonly cohere: CohereClient | null;

  constructor(
    @Inject('AlumniRepository')
    private readonly alumniRepository: AlumniRepository,
  ) {
    this.cohere = process.env.COHERE_API_KEY
      ? new CohereClient({ token: process.env.COHERE_API_KEY })
      : null;
  }

  async findRelevantMentors(request: MentorClusterRequest): Promise<MentorMatch[]> {
    if (request.panel !== ThreadPanel.ALUMNI) {
      return [];
    }

    const safeLimit = Math.max(1, Math.min(request.limit ?? 3, 5));
    const allAlumni = await this.alumniRepository.findAll();
    const excluded = new Set(request.excludeUserIds ?? []);

    const candidates = allAlumni.filter((alumni) => !excluded.has(alumni.userId));
    if (candidates.length === 0) {
      return [];
    }

    const queryText = [request.title, request.description ?? '']
      .filter(Boolean)
      .join(' ')
      .slice(0, 3500);

    const candidateProfiles = candidates.map((alumni) => ({
      alumni,
      text: this.buildAlumniProfileText(alumni).slice(0, 3500),
    }));

    if (!this.cohere) {
      return this.fallbackMatches(queryText, candidateProfiles, safeLimit);
    }

    try {
      const queryResponse = await this.cohere.embed({
        texts: [queryText],
        model: 'embed-english-v3.0',
        inputType: 'search_query',
        embeddingTypes: ['float'],
      });

      const documentsResponse = await this.cohere.embed({
        texts: candidateProfiles.map((candidate) => candidate.text),
        model: 'embed-english-v3.0',
        inputType: 'search_document',
        embeddingTypes: ['float'],
      });

      const queryVector = (queryResponse.embeddings as any).float[0] as number[];
      const documentVectors = (documentsResponse.embeddings as any).float as number[][];

      return candidateProfiles
        .map((candidate, index) => {
          const score = this.cosineSimilarity(queryVector, documentVectors[index] ?? []);
          return {
            userId: candidate.alumni.userId,
            score,
            reason: `AI mentor match ${(score * 100).toFixed(1)}%`,
            matchedSignals: candidate.alumni.interests.slice(0, 5),
          } satisfies MentorMatch;
        })
        .filter((match) => match.score >= 0.35)
        .sort((a, b) => b.score - a.score)
        .slice(0, safeLimit);
    } catch (error) {
      this.logger.warn(
        `Mentor clustering AI failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
      return this.fallbackMatches(queryText, candidateProfiles, safeLimit);
    }
  }

  private fallbackMatches(
    queryText: string,
    candidates: Array<{ alumni: { userId: string; interests: string[]; major: string | null; jobTitle: string | null; company: string | null; bio: string | null }; text: string }>,
    limit: number,
  ): MentorMatch[] {
    const queryTokens = this.tokenize(queryText);

    return candidates
      .map((candidate) => {
        const profileTokens = this.tokenize(candidate.text);
        const overlap = Array.from(profileTokens).filter((token) => queryTokens.has(token));
        const score = Math.min(1, overlap.length / Math.max(4, profileTokens.size || 1));

        return {
          userId: candidate.alumni.userId,
          score,
          reason: overlap.length > 0 ? `Keyword mentor match on ${overlap.slice(0, 3).join(', ')}` : 'Weak mentor match',
          matchedSignals: candidate.alumni.interests.slice(0, 5),
        } satisfies MentorMatch;
      })
      .filter((match) => match.score >= 0.25)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  private buildAlumniProfileText(alumni: {
    interests: string[];
    major: string | null;
    jobTitle: string | null;
    company: string | null;
    bio: string | null;
  }): string {
    return [
      alumni.major,
      alumni.jobTitle,
      alumni.company,
      alumni.bio,
      ...(alumni.interests ?? []),
    ]
      .filter(Boolean)
      .join(' ');
  }

  private tokenize(text: string): Set<string> {
    return new Set(
      text
        .toLowerCase()
        .split(/[^a-z0-9]+/g)
        .map((token) => token.trim())
        .filter((token) => token.length >= 3),
    );
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (!a.length || !b.length || a.length !== b.length) {
      return 0;
    }

    let dot = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i += 1) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}