import { Injectable, BadRequestException } from '@nestjs/common';
import { CohereClient } from 'cohere-ai';
import { PrismaService } from '../../database/prisma/prisma.service';
import type {
  RecommendedStudyGroup,
  StudyGroupRecommendationService,
} from '../../../domain/services/study-group-recommendation.service';

@Injectable()
export class CohereStudyGroupRecommendationService implements StudyGroupRecommendationService {
  private readonly cohere: CohereClient;

  constructor(private readonly prisma: PrismaService) {
    this.cohere = new CohereClient({ token: process.env.COHERE_API_KEY });
  }

  async recommendForUser(userId: string, limit: number = 8): Promise<RecommendedStudyGroup[]> {
    const safeLimit = Math.max(1, Math.min(limit, 20));

    // Fetch user profile data
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        student: true,
        alumni: true,
        professor: true,
      },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Extract user interests and profile info
    const userInterests = this.extractUserInterests(user);

    if (!userInterests || userInterests.length === 0) {
      throw new BadRequestException(
        'Please complete your profile with interests to get personalized recommendations. Update your profile in the onboarding or settings.'
      );
    }

    const memberships = await this.prisma.studyGroupMember.findMany({
      where: {
        userId,
        joinStatus: 'ACTIVE' as any,
      },
      include: {
        group: true,
      },
    });

    const joinedIds = new Set(memberships.map((m: any) => m.groupId));
    const archiveDelegate = (this.prisma as any).studyGroupUserArchive;
    const archivedIds = new Set(
      archiveDelegate
        ? (
            await archiveDelegate.findMany({
              where: { userId },
              select: { groupId: true },
            })
          ).map((archive: any) => archive.groupId)
        : [],
    );

    const candidates = await this.prisma.studyGroup.findMany({
      where: {
        status: 'ACTIVE' as any,
        visibility: 'PUBLIC' as any,
        id: { notIn: Array.from(new Set([...joinedIds, ...archivedIds])) },
      },
      orderBy: [{ lastActivityAt: 'desc' }],
      take: 200,
    });

    if (candidates.length === 0) {
      return [];
    }

    // Build user profile from interests + current group membership
    const userProfileParts = [
      userInterests.join(' '),
      ...memberships.map((m: any) => {
        const tags = Array.isArray(m.group?.topicTags) ? m.group.topicTags.join(' ') : '';
        return `${m.group?.name ?? ''} ${m.group?.description ?? ''} ${tags}`.trim();
      }),
    ];
    const profileText = userProfileParts.filter(Boolean).join('\n');

    if (!profileText.trim()) {
      return candidates.slice(0, safeLimit).map((group: any) => ({
        id: group.id,
        name: group.name,
        description: group.description,
        visibility: group.visibility,
        score: 0,
        matchingSignals: [],
      }));
    }

    const candidateTexts = candidates.map((group: any) => {
      const tags = Array.isArray(group.topicTags) ? group.topicTags.join(' ') : '';
      return `${group.name} ${group.description ?? ''} ${tags}`.trim();
    });

    try {
      const queryEmbeddingResponse = await this.cohere.embed({
        texts: [profileText.slice(0, 3500)],
        model: 'embed-english-v3.0',
        inputType: 'search_query',
        embeddingTypes: ['float'],
      });

      const documentEmbeddingResponse = await this.cohere.embed({
        texts: candidateTexts.map((text) => text.slice(0, 3500)),
        model: 'embed-english-v3.0',
        inputType: 'search_document',
        embeddingTypes: ['float'],
      });

      const queryVector = (queryEmbeddingResponse.embeddings as any).float[0] as number[];
      const documentVectors = (documentEmbeddingResponse.embeddings as any).float as number[][];

      return candidates
        .map((group: any, index: number) => {
          const score = this.cosineSimilarity(queryVector, documentVectors[index] ?? []);
          return {
            id: group.id,
            name: group.name,
            description: group.description,
            visibility: group.visibility,
            score,
            matchingSignals: (Array.isArray(group.topicTags) ? group.topicTags : []).slice(0, 5),
          } as RecommendedStudyGroup;
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, safeLimit);
    } catch {
      // Fallback if AI provider is unavailable.
      return candidates.slice(0, safeLimit).map((group: any) => ({
        id: group.id,
        name: group.name,
        description: group.description,
        visibility: group.visibility,
        score: 0,
        matchingSignals: (Array.isArray(group.topicTags) ? group.topicTags : []).slice(0, 5),
      }));
    }
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

  private extractUserInterests(user: any): string[] {
    const interests: string[] = [];

    // Extract interests from the user's role-specific profile
    if (user.student?.interests && Array.isArray(user.student.interests)) {
      interests.push(...user.student.interests);
    }
    if (user.alumni?.interests && Array.isArray(user.alumni.interests)) {
      interests.push(...user.alumni.interests);
    }
    if (user.professor?.interests && Array.isArray(user.professor.interests)) {
      interests.push(...user.professor.interests);
    }

    // Add major/faculty info if available
    if (user.student?.major) {
      interests.push(user.student.major);
    }
    if (user.alumni?.major) {
      interests.push(user.alumni.major);
    }
    if (user.professor?.faculty) {
      interests.push(user.professor.faculty);
    }

    // Deduplicate and trim
    return Array.from(new Set(interests.map((i) => i.trim()).filter(Boolean)));
  }
}
