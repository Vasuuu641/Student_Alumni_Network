import { Inject, Injectable } from '@nestjs/common';
import { StudyGroup } from '../../domain/entities/study-group.entity';
import type { StudyGroupRepository } from '../../domain/repositories/study-group.repository';
import { studyGroupsVisibility, studyGroupMemberRole, studyGroupStatus } from '../../domain/entities/study-group.entity';
import type { StudyGroupMemberRepository } from '../../domain/repositories/study-group-member.repository';
import type { UserRepository } from '../../domain/repositories/user.repository';
import { Email } from '../../domain/value-objects/email.vo';

export interface FormGroupRequest {
  name: string;
  description: string;
  visibility: studyGroupsVisibility;
  ownerId: string;
  maxMembers?: number | null;
  initialMemberIds?: string[];
}

@Injectable()
export class FormGroupUseCase {
  constructor(
    @Inject('StudyGroupRepository')
    private readonly studyGroupRepository: StudyGroupRepository,
    @Inject('StudyGroupMemberRepository')
    private readonly studyGroupMemberRepository: StudyGroupMemberRepository,
    @Inject('UserRepository')
    private readonly userRepository: UserRepository,
  ) {}

  async execute(request: FormGroupRequest): Promise<StudyGroup> {
    const { name, description, visibility, ownerId, maxMembers = null, initialMemberIds } = request;

    const distinctInitialMemberIdentifiers = Array.from(
      new Set((initialMemberIds ?? []).map((value) => value.trim()).filter(Boolean)),
    );

    const invalidMemberIdentifiers: string[] = [];
    const resolvedInitialMemberIds: string[] = [];

    for (const identifier of distinctInitialMemberIdentifiers) {
      const user = await this.resolveUserByIdentifier(identifier);
      if (!user) {
        invalidMemberIdentifiers.push(identifier);
        continue;
      }

      if (user.id !== ownerId) {
        resolvedInitialMemberIds.push(user.id);
      }
    }

    const distinctInitialMemberIds = Array.from(new Set(resolvedInitialMemberIds));

    if (invalidMemberIdentifiers.length > 0) {
      throw new Error(`Some selected members were not found: ${invalidMemberIdentifiers.join(', ')}`);
    }

    const now = new Date();

    const group = new StudyGroup(
      undefined as any,
      name,
      description,
      visibility,
      studyGroupStatus.ACTIVE,
      ownerId,
      now,
      now,
    );

    // Persist and return the created domain entity
    const created = await this.studyGroupRepository.create(group);

    // Owner must also be an active member for policy checks and posting permissions
    await this.studyGroupMemberRepository.addMember(
      created.id,
      ownerId,
      studyGroupMemberRole.OWNER,
    );

    for (const userId of distinctInitialMemberIds) {
      await this.studyGroupMemberRepository.addMember(
        created.id,
        userId,
        studyGroupMemberRole.MEMBER,
      );
    }

    return created;
  }

  private async resolveUserByIdentifier(identifier: string) {
    if (identifier.includes('@')) {
      try {
        return await this.userRepository.findByEmail(new Email(identifier));
      } catch {
        return null;
      }
    }

    return this.userRepository.findById(identifier);
  }
}
