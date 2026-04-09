import { Inject, Injectable } from '@nestjs/common';
import type { StudyGroupRepository } from '../../domain/repositories/study-group.repository';
import { studyGroupsVisibility } from '../../domain/entities/study-group.entity';

export interface ListGroupsRequest {
  visibility?: studyGroupsVisibility;
  ownerId?: string;
}

@Injectable()
export class ListGroupsUseCase {
  constructor(
    @Inject('StudyGroupRepository')
    private readonly studyGroupRepository: StudyGroupRepository,
  ) {}

  async execute(request: ListGroupsRequest) {
    const { visibility, ownerId } = request;
    if (ownerId) return this.studyGroupRepository.findByOwnerId(ownerId);
    if (visibility !== undefined) return this.studyGroupRepository.findByVisibility(visibility);
    // default: public groups
    return this.studyGroupRepository.findByVisibility(studyGroupsVisibility.PUBLIC);
  }
}
