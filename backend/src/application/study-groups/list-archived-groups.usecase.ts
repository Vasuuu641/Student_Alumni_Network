import { Inject, Injectable } from '@nestjs/common';
import type { StudyGroupRepository } from '../../domain/repositories/study-group.repository';
import type { StudyGroupUserArchiveRepository } from '../../domain/repositories/study-group-user-archive.repository';

@Injectable()
export class ListArchivedGroupsUseCase {
  constructor(
    @Inject('StudyGroupRepository')
    private readonly studyGroupRepository: StudyGroupRepository,
    @Inject('StudyGroupUserArchiveRepository')
    private readonly archiveRepository: StudyGroupUserArchiveRepository,
  ) {}

  async execute(userId: string) {
    const archivedIds = await this.archiveRepository.findArchivedGroupIdsByUserId(userId);
    if (archivedIds.length === 0) {
      return [];
    }

    return this.studyGroupRepository.findByIds(archivedIds);
  }
}
