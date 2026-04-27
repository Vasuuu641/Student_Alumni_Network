import { Inject, Injectable } from '@nestjs/common';
import type { StudyGroupRepository } from '../../domain/repositories/study-group.repository';
import type { StudyGroupMemberRepository } from '../../domain/repositories/study-group-member.repository';
import type { StudyGroupUserArchiveRepository } from '../../domain/repositories/study-group-user-archive.repository';
import { studyGroupsVisibility, studyGroupJoinStatus } from '../../domain/entities/study-group.entity';

export interface ListGroupsRequest {
  visibility?: studyGroupsVisibility;
  userId?: string;
}

@Injectable()
export class ListGroupsUseCase {
  constructor(
    @Inject('StudyGroupRepository')
    private readonly studyGroupRepository: StudyGroupRepository,
    @Inject('StudyGroupMemberRepository')
    private readonly memberRepository: StudyGroupMemberRepository,
    @Inject('StudyGroupUserArchiveRepository')
    private readonly archiveRepository: StudyGroupUserArchiveRepository,
  ) {}

  async execute(request: ListGroupsRequest) {
    const { visibility, userId } = request;
    const archivedIds = userId ? await this.archiveRepository.findArchivedGroupIdsByUserId(userId) : [];

    if (visibility !== undefined) {
      const groups = await this.studyGroupRepository.findByVisibility(visibility);
      if (!userId) {
        return groups;
      }

      const joinedGroupIds = new Set(
        (await this.memberRepository.findByUserId(userId))
          .filter((member) => member.joinStatus === studyGroupJoinStatus.ACTIVE)
          .map((member) => member.studyGroupId),
      );

      return groups.filter((group) => !joinedGroupIds.has(group.id) && !archivedIds.includes(group.id));
    }

    if (!userId) {
      return this.studyGroupRepository.findByVisibility(studyGroupsVisibility.PUBLIC);
    }

    const ownedGroups = await this.studyGroupRepository.findByOwnerId(userId);
    const joinedGroupIds = (await this.memberRepository.findByUserId(userId))
      .filter((member) => member.joinStatus === studyGroupJoinStatus.ACTIVE)
      .map((member) => member.studyGroupId);

    const joinedGroups = await this.studyGroupRepository.findByIds(joinedGroupIds);
    const combined = [...ownedGroups, ...joinedGroups].filter((group) => !archivedIds.includes(group.id));
    const unique = new Map(combined.map((group) => [group.id, group]));
    return Array.from(unique.values());
  }
}
